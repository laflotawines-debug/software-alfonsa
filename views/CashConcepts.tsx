import React, { useState, useEffect } from 'react';
import { 
    Tag, 
    Plus, 
    Search, 
    Trash2, 
    Loader2, 
    Check, 
    X, 
    Edit2, 
    ArrowUp, 
    ArrowDown, 
    Printer, 
    LogOut, 
    Info,
    Wallet,
    Landmark
} from 'lucide-react';
import { supabase } from '../supabase';

// Types
interface CashConcept {
    id: string;
    name: string;
    type: 'ingreso' | 'egreso';
    category: 'caja' | 'banco';
    active: boolean;
    created_at?: string;
}

export const CashConcepts: React.FC = () => {
    // State
    const [concepts, setConcepts] = useState<CashConcept[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchCaja, setSearchCaja] = useState('');
    const [searchBanco, setSearchBanco] = useState('');
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingConcept, setEditingConcept] = useState<CashConcept | null>(null);
    const [modalCategory, setModalCategory] = useState<'caja' | 'banco'>('caja');
    
    // Form State
    const [formData, setFormData] = useState({
        name: '',
        type: 'ingreso' as 'ingreso' | 'egreso'
    });
    const [isSaving, setIsSaving] = useState(false);

    // Fetch Data
    const fetchConcepts = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('cash_concepts')
            .select('*')
            .order('name');
        
        if (error) {
            console.error('Error fetching concepts:', error);
            // Fallback or empty if table doesn't exist
        } else {
            setConcepts(data || []);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchConcepts();
    }, []);

    // Handlers
    const handleOpenModal = (category: 'caja' | 'banco', concept?: CashConcept) => {
        setModalCategory(category);
        if (concept) {
            setEditingConcept(concept);
            setFormData({ name: concept.name, type: concept.type });
        } else {
            setEditingConcept(null);
            setFormData({ name: '', type: 'egreso' }); // Default to egreso
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name.trim()) return;
        setIsSaving(true);
        
        try {
            if (editingConcept) {
                const { error } = await supabase
                    .from('cash_concepts')
                    .update({ 
                        name: formData.name, 
                        type: formData.type 
                    })
                    .eq('id', editingConcept.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('cash_concepts')
                    .insert({
                        name: formData.name,
                        type: formData.type,
                        category: modalCategory,
                        active: true
                    });
                if (error) throw error;
            }
            await fetchConcepts();
            setIsModalOpen(false);
        } catch (e) {
            console.error(e);
            alert('Error al guardar. Asegúrese de que la tabla cash_concepts exista.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!editingConcept) return;
        if (!confirm('¿Seguro que desea eliminar este concepto?')) return;
        
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('cash_concepts')
                .delete()
                .eq('id', editingConcept.id);
            if (error) throw error;
            await fetchConcepts();
            setIsModalOpen(false);
        } catch (e) {
            console.error(e);
            alert('Error al eliminar');
        } finally {
            setIsSaving(false);
        }
    };

    // Filtered Lists
    const cajaConcepts = concepts.filter(c => c.category === 'caja' && c.name.toLowerCase().includes(searchCaja.toLowerCase()));
    const bancoConcepts = concepts.filter(c => c.category === 'banco' && c.name.toLowerCase().includes(searchBanco.toLowerCase()));

    // Render
    return (
        <div className="flex flex-col gap-6 pb-20 animate-in fade-in duration-300">
            {/* Header */}
            <div>
                <h2 className="text-3xl font-black text-text tracking-tight flex items-center gap-3 uppercase italic">
                    <Tag className="text-primary" size={36} /> Maestro de Conceptos de Ingreso / Egreso
                </h2>
                <p className="text-muted text-sm mt-1 font-medium">Administra los conceptos utilizados para los movimientos de caja y cuentas bancarias.</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Caja Column */}
                <div className="flex-1 bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm flex flex-col h-[600px]">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <Wallet className="text-orange-500" size={24} />
                            <h3 className="text-lg font-black text-text uppercase">Conceptos de Caja</h3>
                        </div>
                        <span className="bg-orange-500/10 text-orange-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                            Activos: {cajaConcepts.length}
                        </span>
                    </div>
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                        <input 
                            type="text" 
                            placeholder="Buscar concepto de caja..." 
                            value={searchCaja}
                            onChange={e => setSearchCaja(e.target.value)}
                            className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:border-primary transition-all"
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                        {cajaConcepts.map(c => (
                            <div key={c.id} onClick={() => handleOpenModal('caja', c)} className="p-4 bg-background border border-surfaceHighlight rounded-xl flex justify-between items-center hover:border-primary/50 cursor-pointer transition-all group">
                                <span className="font-bold text-text text-sm">{c.name}</span>
                                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${c.type === 'ingreso' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                                    {c.type}
                                </span>
                            </div>
                        ))}
                        {cajaConcepts.length === 0 && <p className="text-center text-muted text-xs italic py-10">No hay conceptos</p>}
                    </div>
                </div>

                {/* Banco Column */}
                <div className="flex-1 bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm flex flex-col h-[600px]">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <Landmark className="text-orange-500" size={24} />
                            <h3 className="text-lg font-black text-text uppercase">Conceptos de Bancos</h3>
                        </div>
                        <span className="bg-orange-500/10 text-orange-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                            Activos: {bancoConcepts.length}
                        </span>
                    </div>
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                        <input 
                            type="text" 
                            placeholder="Buscar concepto de banco..." 
                            value={searchBanco}
                            onChange={e => setSearchBanco(e.target.value)}
                            className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:border-primary transition-all"
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                        {bancoConcepts.map(c => (
                            <div key={c.id} onClick={() => handleOpenModal('banco', c)} className="p-4 bg-background border border-surfaceHighlight rounded-xl flex justify-between items-center hover:border-primary/50 cursor-pointer transition-all group">
                                <span className="font-bold text-text text-sm">{c.name}</span>
                                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${c.type === 'ingreso' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                                    {c.type}
                                </span>
                            </div>
                        ))}
                        {bancoConcepts.length === 0 && <p className="text-center text-muted text-xs italic py-10">No hay conceptos</p>}
                    </div>
                </div>

                {/* Actions Column */}
                <div className="w-full lg:w-72 flex flex-col gap-4">
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm">
                        <h3 className="text-sm font-black text-text uppercase mb-4">Acciones Rápidas</h3>
                        <div className="space-y-3">
                            <button onClick={() => handleOpenModal('caja')} className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black uppercase text-xs shadow-lg shadow-orange-500/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                                <Plus size={18} /> Nuevo Concepto Caja
                            </button>
                            <button onClick={() => handleOpenModal('banco')} className="w-full py-4 bg-background border border-surfaceHighlight hover:bg-surfaceHighlight text-text rounded-xl font-black uppercase text-xs transition-all active:scale-95 flex items-center justify-center gap-2">
                                <Plus size={18} /> Nuevo Concepto Banco
                            </button>
                        </div>
                        <div className="my-6 border-t border-surfaceHighlight"></div>
                        <div className="space-y-3">
                            <button className="w-full py-3 text-muted hover:text-text hover:bg-surfaceHighlight rounded-xl font-bold uppercase text-[10px] flex items-center gap-3 px-4 transition-all">
                                <Printer size={16} /> Imprimir Reporte
                            </button>
                            <button className="w-full py-3 text-muted hover:text-text hover:bg-surfaceHighlight rounded-xl font-bold uppercase text-[10px] flex items-center gap-3 px-4 transition-all">
                                <LogOut size={16} /> Salir
                            </button>
                        </div>
                    </div>

                    <div className="bg-blue-500/5 border border-blue-500/10 rounded-3xl p-6">
                        <div className="flex gap-3">
                            <Info className="text-blue-500 shrink-0" size={20} />
                            <div>
                                <h4 className="text-xs font-black text-blue-600 uppercase mb-1">Consejo</h4>
                                <p className="text-[10px] text-blue-600/80 leading-relaxed">
                                    Utilice el buscador para filtrar rápidamente entre cientos de conceptos registrados.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-background w-full max-w-md rounded-3xl border border-surfaceHighlight shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-surfaceHighlight bg-surface flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-text uppercase italic">Configuración de Concepto</h3>
                                <p className="text-[10px] text-muted font-bold uppercase">Gestión de ingresos y egresos de {modalCategory}</p>
                            </div>
                            <div className="bg-orange-100 p-2 rounded-full">
                                <Wallet className="text-orange-500" size={20} />
                            </div>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted uppercase ml-1">Código de Concepto</label>
                                <div className="bg-surfaceHighlight/30 rounded-xl p-3 text-sm font-mono text-muted font-bold">
                                    # {editingConcept ? editingConcept.id.slice(0, 8) : 'AUTOGENERADO'}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted uppercase ml-1">Denominación</label>
                                <div className="relative">
                                    <Edit2 className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                                    <input 
                                        type="text" 
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        placeholder="Ej: Pago a Proveedores" 
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl p-3 pl-9 text-sm font-bold outline-none focus:border-primary transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted uppercase ml-1">Tipo de Movimiento</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button 
                                        onClick={() => setFormData({...formData, type: 'ingreso'})}
                                        className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${formData.type === 'ingreso' ? 'bg-green-500/10 border-green-500 text-green-600' : 'bg-surface border-surfaceHighlight text-muted hover:border-green-500/50'}`}
                                    >
                                        <div className={`p-2 rounded-full ${formData.type === 'ingreso' ? 'bg-green-500 text-white' : 'bg-surfaceHighlight'}`}>
                                            <ArrowUp size={20} />
                                        </div>
                                        <span className="text-xs font-black uppercase">Entrada</span>
                                        <span className="text-[9px] opacity-70">Ingreso de dinero</span>
                                    </button>
                                    <button 
                                        onClick={() => setFormData({...formData, type: 'egreso'})}
                                        className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${formData.type === 'egreso' ? 'bg-red-500/10 border-red-500 text-red-600' : 'bg-surface border-surfaceHighlight text-muted hover:border-red-500/50'}`}
                                    >
                                        <div className={`p-2 rounded-full ${formData.type === 'egreso' ? 'bg-red-500 text-white' : 'bg-surfaceHighlight'}`}>
                                            <ArrowDown size={20} />
                                        </div>
                                        <span className="text-xs font-black uppercase">Salida</span>
                                        <span className="text-[9px] opacity-70">Egreso de dinero</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-surface border-t border-surfaceHighlight flex flex-col gap-3">
                            <div className="flex gap-3">
                                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 border border-surfaceHighlight rounded-xl font-black text-xs uppercase text-muted hover:bg-surfaceHighlight transition-all flex items-center justify-center gap-2">
                                    <X size={16} /> Cancelar
                                </button>
                                <button onClick={handleSave} disabled={isSaving || !formData.name} className="flex-[2] py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-orange-500/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                                    {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Aceptar
                                </button>
                            </div>
                            {editingConcept && (
                                <button onClick={handleDelete} className="w-full py-2 text-red-500 hover:bg-red-500/10 rounded-xl font-bold text-[10px] uppercase transition-all flex items-center justify-center gap-2">
                                    <Trash2 size={14} /> Borrar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
