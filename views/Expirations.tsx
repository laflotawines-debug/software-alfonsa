
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
    Loader2,
    Truck,
    History,
    Boxes,
    Package,
    Building2,
    Check
} from 'lucide-react';
import { ProductExpiration, ExpirationStatus } from '../types';
import { supabase } from '../supabase';

type ExpiryTab = 'manual' | 'system';

export const Expirations: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ExpiryTab>('system');
    const [rawText, setRawText] = useState('');
    const [manualItems, setManualItems] = useState<ProductExpiration[]>([]);
    const [systemItems, setSystemItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<ExpirationStatus | 'TODOS'>('TODOS');
    
    // Estado para confirmación de eliminación
    const [confirmingId, setConfirmingId] = useState<string | null>(null);

    // --- CARGAR DATOS MANUALES ---
    const fetchManualExpirations = async () => {
        const { data, error } = await supabase
            .from('product_expirations')
            .select('*')
            .order('expiry_date', { ascending: true });
        
        if (!error && data) {
            setManualItems(data.map(mapToAppFormat));
        }
    };

    // --- CARGAR DATOS DE SISTEMA (INGRESOS) ---
    const fetchSystemExpirations = async () => {
        const { data, error } = await supabase
            .from('stock_inbound_items')
            .select(`
                *,
                master_products(desart),
                stock_inbounds(
                    created_at,
                    warehouse_id,
                    warehouses(name),
                    providers_master(razon_social)
                )
            `)
            .not('expiry_date', 'is', null)
            .order('expiry_date', { ascending: true });

        if (!error && data) {
            setSystemItems(data.map(item => {
                const mapped = mapToAppFormat({
                    id: item.id,
                    product_name: item.master_products?.desart || 'Desc. no disponible',
                    total_quantity: item.quantity,
                    expiry_date: item.expiry_date
                });
                return {
                    ...mapped,
                    provider: item.stock_inbounds?.providers_master?.razon_social || 'S/D',
                    warehouse: item.stock_inbounds?.warehouses?.name || 'S/D',
                    inboundDate: item.stock_inbounds?.created_at
                };
            }));
        }
    };

    const mapToAppFormat = (item: any): ProductExpiration => {
        const expiryDate = new Date(item.expiry_date + 'T12:00:00');
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
    };

    const fetchData = async () => {
        setIsLoading(true);
        await Promise.all([fetchManualExpirations(), fetchSystemExpirations()]);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    // --- PROCESAR TEXTO MANUAL ---
    const processAndSaveManual = async () => {
        if (!rawText.trim()) return;
        setIsSaving(true);
        const regex = /(?:(\d+)\s*x\s*(\d+)\s+)?(.*?)\s*\(([\d/]+)\)/gi;
        const matches = Array.from(rawText.matchAll(regex));
        const inserts = matches.map(match => {
            const qty1 = match[1] ? parseInt(match[1]) : 1;
            const qty2 = match[2] ? parseInt(match[2]) : 1;
            const totalQty = qty1 * qty2;
            const productName = match[3].trim();
            const dateStr = match[4];
            const dateParts = dateStr.split('/');
            let day = parseInt(dateParts[0]);
            let month = parseInt(dateParts[1]) - 1;
            let year = parseInt(dateParts[2]);
            if (year < 100) year += 2000;
            return {
                product_name: productName,
                total_quantity: totalQty,
                expiry_date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            };
        });

        if (inserts.length > 0) {
            const { error } = await supabase.from('product_expirations').insert(inserts);
            if (!error) { setRawText(''); await fetchManualExpirations(); }
            else alert("Error al guardar.");
        } else alert("Formato incorrecto. Ejemplo: 2x4 speed (02/06/26)");
        setIsSaving(false);
    };

    // --- ACCIONES DE ELIMINACIÓN ---
    const handleRemoveManual = async (id: string) => {
        const { error } = await supabase.from('product_expirations').delete().eq('id', id);
        if (!error) {
            setManualItems(prev => prev.filter(i => i.id !== id));
            setConfirmingId(null);
        }
    };

    const handleRemoveSystem = async (id: string) => {
        const { error } = await supabase
            .from('stock_inbound_items')
            .update({ expiry_date: null })
            .eq('id', id);

        if (!error) {
            setSystemItems(prev => prev.filter(i => i.id !== id));
            setConfirmingId(null);
        } else {
            alert("Error al limpiar el registro.");
        }
    };

    const currentItems = activeTab === 'manual' ? manualItems : systemItems;

    const filteredItems = useMemo(() => {
        return currentItems
            .filter(i => {
                const matchesSearch = i.productName.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesStatus = statusFilter === 'TODOS' || i.status === statusFilter;
                return matchesSearch && matchesStatus;
            })
            .sort((a, b) => a.daysRemaining - b.daysRemaining);
    }, [currentItems, searchTerm, statusFilter, activeTab]);

    return (
        <div className="flex flex-col gap-8 pb-10 max-w-7xl mx-auto">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight uppercase italic flex items-center gap-3">
                        <Calendar className="text-primary" size={36} />
                        Control de Vencimientos
                    </h2>
                    <p className="text-muted text-sm mt-1 font-medium italic">Seguimiento de lotes próximos a caducar.</p>
                </div>
                
                <div className="flex p-1.5 bg-surface border border-surfaceHighlight rounded-2xl shadow-sm gap-1">
                    <button 
                        onClick={() => { setActiveTab('system'); setConfirmingId(null); }}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase transition-all ${activeTab === 'system' ? 'bg-primary text-white shadow-lg' : 'text-muted hover:bg-surfaceHighlight'}`}
                    >
                        <Boxes size={16} /> Desde Ingresos
                    </button>
                    <button 
                        onClick={() => { setActiveTab('manual'); setConfirmingId(null); }}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase transition-all ${activeTab === 'manual' ? 'bg-primary text-white shadow-lg' : 'text-muted hover:bg-surfaceHighlight'}`}
                    >
                        <History size={16} /> Carga Manual
                    </button>
                </div>
            </div>

            {activeTab === 'manual' && (
                <div className="bg-surface rounded-3xl p-6 border border-surfaceHighlight shadow-sm animate-in slide-in-from-top-4 duration-300">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-muted uppercase tracking-widest ml-1 flex items-center gap-2">
                                <History size={14} className="text-primary" /> Agregar Histórico Informativo
                            </label>
                            <span className="text-[10px] text-muted italic">Formato: 2x4 nombre producto (DD/MM/YY)</span>
                        </div>
                        <textarea 
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            placeholder="Ejemplo: 2x4 speed 250 (02/06/26)&#10;10x12 amstel (15/12/25)"
                            className="w-full bg-background border border-surfaceHighlight rounded-2xl p-4 text-sm text-text focus:border-primary outline-none transition-all min-h-[100px] shadow-inner font-mono"
                        />
                        <button 
                            onClick={processAndSaveManual}
                            disabled={!rawText.trim() || isSaving}
                            className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-slate-900 text-white font-black uppercase tracking-widest text-xs shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                            Guardar en Historial Manual
                        </button>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full md:max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar en vencimientos..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-surface border border-surfaceHighlight rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary shadow-sm uppercase"
                        />
                    </div>
                    <div className="flex gap-2">
                        <FilterButton label="Crítico" active={statusFilter === 'CRÍTICO'} onClick={() => setStatusFilter('CRÍTICO')} color="bg-red-500" />
                        <FilterButton label="Próximo" active={statusFilter === 'PRÓXIMO'} onClick={() => setStatusFilter('PRÓXIMO')} color="bg-pink-500" />
                        <FilterButton label="Normal" active={statusFilter === 'NORMAL'} onClick={() => setStatusFilter('NORMAL')} color="bg-green-500" />
                        {statusFilter !== 'TODOS' && (
                            <button onClick={() => setStatusFilter('TODOS')} className="p-2 text-muted hover:text-red-500"><X size={20}/></button>
                        )}
                    </div>
                </div>

                <div className="bg-surface rounded-3xl border border-surfaceHighlight shadow-sm overflow-hidden min-h-[400px]">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 size={40} className="text-primary animate-spin" />
                            <p className="text-muted font-bold text-xs uppercase tracking-widest">Consultando Base de Datos...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-background/50 text-[10px] text-muted uppercase font-black tracking-widest border-b border-surfaceHighlight">
                                        <th className="p-5 pl-8">Artículo</th>
                                        <th className="p-5 text-center">Cantidad</th>
                                        <th className="p-5 text-center">Vencimiento</th>
                                        <th className="p-5 text-center">Días</th>
                                        {activeTab === 'system' && <th className="p-5">Origen / Proveedor</th>}
                                        <th className="p-5 text-center">Alerta</th>
                                        <th className="p-5 text-right pr-8">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surfaceHighlight">
                                    {filteredItems.map((item) => {
                                        const isConfirming = confirmingId === item.id;
                                        
                                        return (
                                            <tr key={item.id} className={`group hover:bg-background/20 transition-colors ${getStatusRowColor(item.status)}`}>
                                                <td className="p-5 pl-8">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center border shadow-inner ${item.status === 'CRÍTICO' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-surface border-surfaceHighlight text-muted'}`}>
                                                            {activeTab === 'manual' ? <History size={20}/> : <Package size={20}/>}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-text uppercase leading-tight">{item.productName}</p>
                                                            {activeTab === 'system' && <p className="text-[9px] font-bold text-primary uppercase mt-1">Depósito: {item.warehouse}</p>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-5 text-center text-xs text-muted font-bold">{item.quantity}</td>
                                                <td className="p-5 text-center text-xs text-text font-black tracking-tighter">
                                                    {item.expiryDate.toLocaleDateString('es-AR')}
                                                </td>
                                                <td className={`p-5 text-center text-sm font-black ${item.daysRemaining < 0 ? 'text-red-500' : 'text-text'}`}>
                                                    {item.daysRemaining < 0 ? `Vencido` : `${item.daysRemaining}d`}
                                                </td>
                                                {activeTab === 'system' && (
                                                    <td className="p-5">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black text-text uppercase flex items-center gap-1"><Building2 size={10} className="text-primary"/> {item.provider}</span>
                                                            <span className="text-[9px] text-muted font-bold mt-0.5">Ingreso: {new Date(item.inboundDate).toLocaleDateString()}</span>
                                                        </div>
                                                    </td>
                                                )}
                                                <td className="p-5 text-center">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase border ${getStatusBadgeColor(item.status)}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(item.status)}`}></span>
                                                        {item.status}
                                                    </span>
                                                </td>
                                                <td className="p-5 text-right pr-8">
                                                    <div className="flex justify-end items-center gap-2">
                                                        {isConfirming ? (
                                                            <div className="flex items-center gap-1 animate-in zoom-in-95 duration-200">
                                                                <button 
                                                                    onClick={() => activeTab === 'manual' ? handleRemoveManual(item.id) : handleRemoveSystem(item.id)}
                                                                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                                                                >
                                                                    Confirmar
                                                                </button>
                                                                <button 
                                                                    onClick={() => setConfirmingId(null)}
                                                                    className="p-1.5 bg-surfaceHighlight text-text rounded-lg hover:bg-surfaceHighlight/80"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button 
                                                                onClick={() => {
                                                                    setConfirmingId(item.id);
                                                                    // Autoreset tras 4 segundos si no confirma
                                                                    setTimeout(() => setConfirmingId(prev => prev === item.id ? null : prev), 4000);
                                                                }}
                                                                className="p-2.5 text-muted hover:text-red-500 bg-background/50 hover:bg-red-500/10 rounded-xl transition-all shadow-sm border border-surfaceHighlight"
                                                                title="Limpiar de la lista"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredItems.length === 0 && (
                                        <tr>
                                            <td colSpan={activeTab === 'system' ? 7 : 6} className="p-24 text-center">
                                                <div className="flex flex-col items-center justify-center opacity-30 italic">
                                                    <AlertCircle size={48} className="mb-3 text-muted" />
                                                    <p className="font-black uppercase tracking-widest text-xs">Sin alertas detectadas</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const FilterButton: React.FC<{ label: string, active: boolean, onClick: () => void, color: string }> = ({ label, active, onClick, color }) => (
    <button 
        onClick={onClick}
        className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border
            ${active 
                ? `${color} text-white border-transparent` 
                : 'bg-surface border-surfaceHighlight text-muted hover:bg-surfaceHighlight'
            }
        `}
    >
        {label}
    </button>
);

const getStatusRowColor = (status: ExpirationStatus) => {
    switch (status) {
        case 'CRÍTICO': return 'bg-red-500/[0.03]';
        case 'PRÓXIMO': return 'bg-pink-500/[0.03]';
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
