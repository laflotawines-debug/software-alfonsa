
import React, { useState, useMemo, useEffect } from 'react';
import { 
    Search, 
    Download, 
    Trash2, 
    ChevronLeft, 
    ChevronRight, 
    Wand2, 
    X,
    Filter,
    Calendar,
    ArrowUpDown,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { ProductExpiration, ExpirationStatus } from '../types';
import { supabase } from '../supabase';

export const Expirations: React.FC = () => {
    const [rawText, setRawText] = useState('');
    const [items, setItems] = useState<ProductExpiration[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<ExpirationStatus | 'TODOS'>('TODOS');

    // --- CARGAR DATOS DE SUPABASE ---
    const fetchExpirations = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('product_expirations')
            .select('*')
            .order('expiry_date', { ascending: true });
        
        if (!error && data) {
            const mapped = data.map(item => {
                const expiryDate = new Date(item.expiry_date + 'T12:00:00'); // Evitar problemas de zona horaria
                const today = new Date();
                today.setHours(0,0,0,0);
                const diffTime = expiryDate.getTime() - today.getTime();
                const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                let status: ExpirationStatus = 'NORMAL';
                if (daysRemaining < 30) status = 'CRÍTICO';
                else if (daysRemaining < 90) status = 'PRÓXIMO';
                else if (daysRemaining < 180) status = 'MODERADO';

                return {
                    id: item.id,
                    productName: item.product_name,
                    quantity: `${item.total_quantity} unidades`,
                    expiryDate,
                    daysRemaining,
                    status
                };
            });
            setItems(mapped);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchExpirations();
    }, []);

    // --- LÓGICA DE PROCESAMIENTO Y GUARDADO ---
    const processAndSave = async () => {
        if (!rawText.trim()) return;
        setIsSaving(true);

        // Regex mejorada para capturar: (Cant1)x(Cant2) (Nombre) ((Fecha))
        // Ejemplo: 2x4 speed 250 (02/06/26)
        const regex = /(?:(\d+)\s*x\s*(\d+)\s+)?(.*?)\s*\(([\d/]+)\)/gi;
        const matches = Array.from(rawText.matchAll(regex));
        
        const inserts = matches.map(match => {
            const qty1 = match[1] ? parseInt(match[1]) : 1;
            const qty2 = match[2] ? parseInt(match[2]) : 1;
            const totalQty = qty1 * qty2; // Lógica 2x4 = 8
            const productName = match[3].trim();
            const dateStr = match[4];

            const dateParts = dateStr.split('/');
            let day = parseInt(dateParts[0]);
            let month = parseInt(dateParts[1]) - 1;
            let year = parseInt(dateParts[2]);
            if (year < 100) year += 2000;

            // Formato ISO para Postgres (YYYY-MM-DD)
            const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            return {
                product_name: productName,
                total_quantity: totalQty,
                expiry_date: isoDate
            };
        });

        if (inserts.length > 0) {
            const { error } = await supabase.from('product_expirations').insert(inserts);
            if (error) {
                alert("Error al guardar en la base de datos");
            } else {
                setRawText('');
                await fetchExpirations();
            }
        } else {
            alert("No se detectó el formato correcto. Ejemplo: 2x4 speed (02/06/26)");
        }
        setIsSaving(false);
    };

    const handleRemove = async (id: string) => {
        const { error } = await supabase.from('product_expirations').delete().eq('id', id);
        if (!error) {
            setItems(prev => prev.filter(i => i.id !== id));
        }
    };

    const handleClear = async () => {
        if (window.confirm('¿Desea eliminar TODOS los registros de la base de datos?')) {
            const { error } = await supabase.from('product_expirations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (!error) fetchExpirations();
        }
    };

    const exportToCSV = () => {
        const headers = ["Producto", "Cantidad", "Vencimiento", "Dias Restantes", "Estado"];
        const rows = items.map(i => [
            i.productName,
            i.quantity,
            i.expiryDate.toLocaleDateString(),
            i.daysRemaining,
            i.status
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `vencimientos_${new Date().toLocaleDateString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- FILTRADO Y ORDENAMIENTO (Por defecto los más críticos arriba) ---
    const filteredItems = useMemo(() => {
        return items
            .filter(i => {
                const matchesSearch = i.productName.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesStatus = statusFilter === 'TODOS' || i.status === statusFilter;
                return matchesSearch && matchesStatus;
            })
            .sort((a, b) => a.daysRemaining - b.daysRemaining); // Siempre los más vencidos/próximos primero
    }, [items, searchTerm, statusFilter]);

    return (
        <div className="flex flex-col gap-8 pb-10 max-w-7xl mx-auto">
            
            <div>
                <h2 className="text-3xl font-black text-text tracking-tight uppercase">Control de Vencimientos</h2>
                <p className="text-muted text-sm mt-1">Base de datos persistente para seguimiento de caducidad.</p>
            </div>

            <div className="bg-surface rounded-2xl p-6 border border-surfaceHighlight shadow-sm">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-black text-muted uppercase tracking-widest">Agregar Lote</label>
                        <p className="text-[10px] text-muted mb-2 italic">Formato: 2x4 nombre producto (DD/MM/YY)</p>
                    </div>
                    <textarea 
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        placeholder="Ejemplo: 2x4 speed 250 (02/06/26)&#10;10x12 amstel (15/12/25)"
                        className="w-full bg-background border border-surfaceHighlight rounded-xl p-4 text-sm text-text focus:border-primary outline-none transition-all min-h-[120px] shadow-inner font-mono"
                    />
                    <button 
                        onClick={processAndSave}
                        disabled={!rawText.trim() || isSaving}
                        className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-primary hover:bg-primaryHover text-white font-black uppercase tracking-widest text-sm shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
                        {isSaving ? 'Guardando en Base de Datos...' : 'Procesar y Guardar'}
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full md:max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar por producto..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-surface border border-surfaceHighlight rounded-xl py-3 pl-11 pr-4 text-sm text-text outline-none focus:border-primary shadow-sm"
                        />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <button 
                            onClick={exportToCSV}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-surface border border-surfaceHighlight text-text hover:bg-surfaceHighlight transition-all font-bold text-xs"
                        >
                            <Download size={16} /> Exportar CSV
                        </button>
                        <button 
                            onClick={handleClear}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-all font-black text-xs shadow-lg shadow-red-500/10"
                        >
                            <Trash2 size={16} /> Limpiar Todo
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <FilterButton label="Todos" active={statusFilter === 'TODOS'} onClick={() => setStatusFilter('TODOS')} color="bg-slate-700" />
                    <FilterButton label="Crítico" active={statusFilter === 'CRÍTICO'} onClick={() => setStatusFilter('CRÍTICO')} color="bg-red-500" dot />
                    <FilterButton label="Próximo" active={statusFilter === 'PRÓXIMO'} onClick={() => setStatusFilter('PRÓXIMO')} color="bg-pink-500" dot />
                    <FilterButton label="Moderado" active={statusFilter === 'MODERADO'} onClick={() => setStatusFilter('MODERADO')} color="bg-yellow-500" dot />
                    <FilterButton label="Normal" active={statusFilter === 'NORMAL'} onClick={() => setStatusFilter('NORMAL')} color="bg-green-500" dot />
                </div>

                <div className="bg-surface rounded-2xl border border-surfaceHighlight shadow-sm overflow-hidden min-h-[300px]">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 size={40} className="text-primary animate-spin" />
                            <p className="text-muted font-bold text-sm uppercase tracking-widest">Sincronizando con Servidor...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-background/50 text-[10px] text-muted uppercase font-black tracking-widest border-b border-surfaceHighlight">
                                        <th className="p-4">Producto</th>
                                        <th className="p-4 text-center">Cant. Total</th>
                                        <th className="p-4 text-center">Vencimiento</th>
                                        <th className="p-4 text-center">Días Faltantes</th>
                                        <th className="p-4 text-center">Estado Alerta</th>
                                        <th className="p-4 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surfaceHighlight">
                                    {filteredItems.map((item) => (
                                        <tr key={item.id} className={`group hover:bg-background/20 transition-colors ${getStatusRowColor(item.status)}`}>
                                            <td className="p-4 text-sm font-bold text-text uppercase">{item.productName}</td>
                                            <td className="p-4 text-center text-xs text-muted font-bold">{item.quantity}</td>
                                            <td className="p-4 text-center text-xs text-text font-mono">{item.expiryDate.toLocaleDateString()}</td>
                                            <td className={`p-4 text-center text-sm font-black ${item.daysRemaining < 0 ? 'text-red-500' : 'text-text'}`}>
                                                {item.daysRemaining < 0 ? `Vencido (${Math.abs(item.daysRemaining)}d)` : `${item.daysRemaining}d`}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${getStatusBadgeColor(item.status)}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(item.status)}`}></span>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button 
                                                    onClick={() => handleRemove(item.id)}
                                                    className="p-2 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <X size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredItems.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center">
                                                <AlertCircle size={40} className="mx-auto text-muted opacity-20 mb-3" />
                                                <p className="text-muted font-bold italic">No hay productos en seguimiento.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                    
                    <div className="p-4 bg-background/30 flex justify-between items-center text-[10px] font-bold text-muted uppercase tracking-widest">
                        <span>Base de Datos: {items.length} productos registrados</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const FilterButton: React.FC<{ label: string, active: boolean, onClick: () => void, color: string, dot?: boolean }> = ({ label, active, onClick, color, dot }) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all shadow-sm border
            ${active 
                ? `${color} text-white border-transparent` 
                : 'bg-surface border-surfaceHighlight text-muted hover:bg-surfaceHighlight'
            }
        `}
    >
        {dot && <span className={`w-2 h-2 rounded-full ${active ? 'bg-white' : color}`}></span>}
        {label}
    </button>
);

const getStatusRowColor = (status: ExpirationStatus) => {
    switch (status) {
        case 'CRÍTICO': return 'bg-red-500/[0.03]';
        case 'PRÓXIMO': return 'bg-pink-500/[0.03]';
        case 'NORMAL': return 'bg-green-500/[0.03]';
        default: return '';
    }
};

const getStatusBadgeColor = (status: ExpirationStatus) => {
    switch (status) {
        case 'CRÍTICO': return 'bg-red-100 text-red-600 border-red-200 dark:bg-red-900/20 dark:border-red-800/50';
        case 'PRÓXIMO': return 'bg-pink-100 text-pink-600 border-pink-200 dark:bg-pink-900/20 dark:border-pink-800/50';
        case 'MODERADO': return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800/50';
        case 'NORMAL': return 'bg-green-100 text-green-600 border-green-200 dark:bg-green-900/20 dark:border-green-800/50';
    }
};

const getStatusDotColor = (status: ExpirationStatus) => {
    switch (status) {
        case 'CRÍTICO': return 'bg-red-500';
        case 'PRÓXIMO': return 'bg-pink-500';
        case 'MODERADO': return 'bg-yellow-500';
        case 'NORMAL': return 'bg-green-500';
    }
};
