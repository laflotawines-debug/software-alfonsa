
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, 
    Plus, 
    Truck, 
    RefreshCw, 
    Loader2, 
    Trash2, 
    Edit2,
    Save,
    X,
    Building2,
    CheckCircle2,
    XCircle,
    Hash
} from 'lucide-react';
import { supabase } from '../supabase';
import { SupplierMaster, User as UserType } from '../types';

interface SuppliersMasterProps {
    currentUser: UserType;
}

export const SuppliersMaster: React.FC<SuppliersMasterProps> = ({ currentUser }) => {
    const [suppliers, setSuppliers] = useState<SupplierMaster[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<SupplierMaster | null>(null);

    const fetchSuppliers = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('providers_master')
                .select('*')
                .order('codigo', { ascending: true });
            if (error) throw error;
            setSuppliers(data || []);
        } catch (err) {
            console.error("Error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSuppliers();
    }, []);

    const filteredSuppliers = useMemo(() => {
        const lower = searchTerm.toLowerCase();
        return suppliers.filter(s => 
            s.razon_social.toLowerCase().includes(lower) || 
            s.codigo.toLowerCase().includes(lower)
        );
    }, [suppliers, searchTerm]);

    const handleDelete = async (codigo: string) => {
        if (!window.confirm("¿Estás seguro de eliminar este proveedor? Esto afectará a las vistas que dependen de este código.")) return;
        try {
            const { error } = await supabase.from('providers_master').delete().eq('codigo', codigo);
            if (error) throw error;
            await fetchSuppliers();
        } catch (err: any) {
            alert("Error al eliminar: " + err.message);
        }
    };

    const handleSave = async (data: Partial<SupplierMaster>) => {
        try {
            if (editingSupplier) {
                // El código es PK, si cambia es un insert/delete, mejor no permitir cambiar el código en edición simple
                const { error } = await supabase
                    .from('providers_master')
                    .update({ razon_social: data.razon_social, activo: data.activo })
                    .eq('codigo', editingSupplier.codigo);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('providers_master').insert([data]);
                if (error) throw error;
            }
            setIsModalOpen(false);
            setEditingSupplier(null);
            await fetchSuppliers();
        } catch (err: any) {
            alert("Error al guardar: " + err.message);
        }
    };

    if (currentUser.role !== 'vale') {
        return <div className="p-10 text-center text-muted uppercase font-black tracking-widest">Acceso Denegado</div>;
    }

    return (
        <div className="flex flex-col gap-6 pb-20 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight flex items-center gap-3 uppercase italic">
                        <Truck className="text-primary" size={32} />
                        Maestro de Proveedores
                    </h2>
                    <p className="text-muted text-sm mt-1 font-medium">Fuente de verdad para el catálogo de artículos.</p>
                </div>
                <button 
                    onClick={() => { setEditingSupplier(null); setIsModalOpen(true); }} 
                    className="bg-primary hover:bg-primaryHover text-white px-8 py-4 rounded-2xl font-black text-sm uppercase transition-all shadow-xl shadow-primary/20 active:scale-95 flex items-center gap-2"
                >
                    <Plus size={20} /> Nuevo Proveedor
                </button>
            </div>

            <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
                    <input 
                        type="text" 
                        placeholder="Buscar por código o razón social..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary transition-all shadow-inner"
                    />
                </div>
            </div>

            <div className="bg-surface border border-surfaceHighlight rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-background/50 text-[10px] text-muted uppercase font-black tracking-widest border-b border-surfaceHighlight">
                            <tr>
                                <th className="p-4 w-24">Código</th>
                                <th className="p-4">Razón Social / Identidad</th>
                                <th className="p-4 text-center">Estado</th>
                                <th className="p-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surfaceHighlight">
                            {isLoading ? (
                                <tr><td colSpan={4} className="p-20 text-center"><Loader2 className="animate-spin text-primary mx-auto" /></td></tr>
                            ) : filteredSuppliers.map(s => (
                                <tr key={s.codigo} className="hover:bg-primary/5 transition-colors group">
                                    <td className="p-4">
                                        <span className="font-mono font-black text-primary bg-primary/10 px-2 py-1 rounded border border-primary/20">{s.codigo}</span>
                                    </td>
                                    <td className="p-4">
                                        <span className="font-bold text-text uppercase">{s.razon_social}</span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${s.activo ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                            {s.activo ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                            {s.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button 
                                                onClick={() => { setEditingSupplier(s); setIsModalOpen(true); }}
                                                className="p-2.5 text-muted hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(s.codigo)}
                                                className="p-2.5 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <SupplierModal 
                    initialData={editingSupplier} 
                    onClose={() => { setIsModalOpen(false); setEditingSupplier(null); }} 
                    onSave={handleSave}
                />
            )}
        </div>
    );
};

const SupplierModal: React.FC<{ initialData: SupplierMaster | null, onClose: () => void, onSave: (data: Partial<SupplierMaster>) => void }> = ({ initialData, onClose, onSave }) => {
    const [codigo, setCodigo] = useState(initialData?.codigo || '');
    const [razonSocial, setRazonSocial] = useState(initialData?.razon_social || '');
    const [activo, setActivo] = useState(initialData ? initialData.activo : true);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface w-full max-w-md rounded-3xl border border-surfaceHighlight shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-surfaceHighlight flex justify-between items-center bg-background/30">
                    <h3 className="text-xl font-black text-text uppercase italic">Ficha de Proveedor</h3>
                    <button onClick={onClose} className="p-2 hover:bg-surfaceHighlight rounded-full text-muted"><X size={24}/></button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); onSave({ codigo, razon_social: razonSocial, activo }); }} className="p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Código (Ej: 0001)</label>
                        <div className="relative">
                            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                            <input 
                                disabled={!!initialData}
                                type="text" 
                                value={codigo} 
                                onChange={e => setCodigo(e.target.value)} 
                                required 
                                className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 pl-12 pr-4 text-sm font-black text-text outline-none focus:border-primary shadow-inner disabled:opacity-50" 
                                placeholder="0000"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Razón Social</label>
                        <div className="relative">
                            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                            <input 
                                type="text" 
                                value={razonSocial} 
                                onChange={e => setRazonSocial(e.target.value)} 
                                required 
                                className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase" 
                                placeholder="Nombre del proveedor"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-background/50 rounded-2xl border border-surfaceHighlight">
                        <span className="text-xs font-black text-text uppercase">Estado Activo</span>
                        <button 
                            type="button"
                            onClick={() => setActivo(!activo)}
                            className={`w-14 h-8 rounded-full transition-all relative ${activo ? 'bg-primary' : 'bg-surfaceHighlight'}`}
                        >
                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all ${activo ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>
                    <div className="flex gap-4 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 py-4 text-text font-black text-xs hover:bg-surfaceHighlight rounded-2xl border border-surfaceHighlight uppercase">Cancelar</button>
                        <button type="submit" className="flex-1 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:bg-primaryHover uppercase text-xs flex items-center justify-center gap-2">
                            <Save size={18} /> Guardar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
