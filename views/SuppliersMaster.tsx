
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
    Hash,
    MapPin,
    Phone,
    Mail,
    Store
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
                .order('razon_social', { ascending: true });
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
            s.nombre_comercial?.toLowerCase().includes(lower) ||
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
            const payload = {
                codigo: data.codigo,
                razon_social: data.razon_social,
                nombre_comercial: data.nombre_comercial,
                domicilio: data.domicilio,
                localidad: data.localidad,
                provincia: data.provincia,
                celular: data.celular,
                email: data.email,
                activo: data.activo
            };

            if (editingSupplier) {
                // El código es PK, no se actualiza
                const { error } = await supabase
                    .from('providers_master')
                    .update(payload)
                    .eq('codigo', editingSupplier.codigo);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('providers_master').insert([payload]);
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
                        placeholder="Buscar por código, razón social o nombre comercial..." 
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
                                <th className="p-4">Identidad</th>
                                <th className="p-4">Ubicación</th>
                                <th className="p-4">Contacto</th>
                                <th className="p-4 text-center">Estado</th>
                                <th className="p-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surfaceHighlight">
                            {isLoading ? (
                                <tr><td colSpan={6} className="p-20 text-center"><Loader2 className="animate-spin text-primary mx-auto" /></td></tr>
                            ) : filteredSuppliers.map(s => (
                                <tr key={s.codigo} className="hover:bg-primary/5 transition-colors group">
                                    <td className="p-4 align-top">
                                        <span className="font-mono font-black text-primary bg-primary/10 px-2 py-1 rounded border border-primary/20">{s.codigo}</span>
                                    </td>
                                    <td className="p-4 align-top">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-text uppercase text-sm leading-tight">{s.razon_social}</span>
                                            {s.nombre_comercial && (
                                                <span className="text-[10px] font-bold text-muted flex items-center gap-1 mt-1 uppercase">
                                                    <Store size={10} /> {s.nombre_comercial}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 align-top">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-xs font-bold text-text uppercase">
                                                {s.localidad || '-'}
                                            </span>
                                            <span className="text-[9px] font-bold text-muted uppercase tracking-wider">
                                                {s.provincia || '-'}
                                            </span>
                                            {s.domicilio && (
                                                <span className="text-[9px] text-muted uppercase flex items-center gap-1 mt-0.5">
                                                    <MapPin size={8} /> {s.domicilio}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 align-top">
                                        <div className="flex flex-col gap-1">
                                            <div className={`flex items-center gap-1.5 text-xs font-bold ${s.celular ? 'text-text' : 'text-muted opacity-30'}`}>
                                                <Phone size={12} className="text-primary" /> {s.celular || '-'}
                                            </div>
                                            <div className={`flex items-center gap-1.5 text-[10px] font-medium ${s.email ? 'text-text' : 'text-muted opacity-30'}`}>
                                                <Mail size={12} className="text-blue-500" /> {s.email || '-'}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center align-top">
                                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${s.activo ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                            {s.activo ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                            {s.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right align-top">
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
    const [formData, setFormData] = useState({
        codigo: initialData?.codigo || '',
        razon_social: initialData?.razon_social || '',
        nombre_comercial: initialData?.nombre_comercial || '',
        domicilio: initialData?.domicilio || '',
        localidad: initialData?.localidad || '',
        provincia: initialData?.provincia || '',
        celular: initialData?.celular || '',
        email: initialData?.email || '',
        activo: initialData ? initialData.activo : true
    });

    const isEdit = !!initialData;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface w-full max-w-2xl rounded-3xl border border-surfaceHighlight shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-surfaceHighlight flex justify-between items-center bg-background/30 shrink-0">
                    <h3 className="text-xl font-black text-text uppercase italic">
                        {isEdit ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-surfaceHighlight rounded-full text-muted"><X size={24}/></button>
                </div>
                
                <form onSubmit={(e) => { e.preventDefault(); onSave(formData); }} className="flex-1 overflow-y-auto p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        {/* IDENTIDAD */}
                        <div className="md:col-span-4 space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Código (Ej: 0001)</label>
                            <div className="relative">
                                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                                <input 
                                    disabled={isEdit}
                                    type="text" 
                                    value={formData.codigo} 
                                    onChange={e => setFormData({...formData, codigo: e.target.value})} 
                                    required 
                                    className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 pl-12 pr-4 text-sm font-black text-text outline-none focus:border-primary shadow-inner disabled:opacity-50 uppercase" 
                                    placeholder="0000"
                                />
                            </div>
                        </div>
                        <div className="md:col-span-8 space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Razón Social *</label>
                            <div className="relative">
                                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                                <input 
                                    type="text" 
                                    value={formData.razon_social} 
                                    onChange={e => setFormData({...formData, razon_social: e.target.value})} 
                                    required 
                                    className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase" 
                                    placeholder="Razón Social Legal"
                                />
                            </div>
                        </div>

                        <div className="md:col-span-12 space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Nombre Comercial (Fantasía)</label>
                            <div className="relative">
                                <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                                <input 
                                    type="text" 
                                    value={formData.nombre_comercial} 
                                    onChange={e => setFormData({...formData, nombre_comercial: e.target.value})} 
                                    className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase" 
                                    placeholder="Nombre visible / Fantasía"
                                />
                            </div>
                        </div>

                        {/* UBICACIÓN */}
                        <div className="md:col-span-12 space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Domicilio</label>
                            <div className="relative">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                                <input 
                                    type="text" 
                                    value={formData.domicilio} 
                                    onChange={e => setFormData({...formData, domicilio: e.target.value})} 
                                    className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase" 
                                    placeholder="Calle y Número"
                                />
                            </div>
                        </div>

                        <div className="md:col-span-6 space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Localidad</label>
                            <input 
                                type="text" 
                                value={formData.localidad} 
                                onChange={e => setFormData({...formData, localidad: e.target.value})} 
                                className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 px-5 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase" 
                                placeholder="Localidad"
                            />
                        </div>
                        <div className="md:col-span-6 space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Provincia</label>
                            <input 
                                type="text" 
                                value={formData.provincia} 
                                onChange={e => setFormData({...formData, provincia: e.target.value})} 
                                className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 px-5 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase" 
                                placeholder="Provincia"
                            />
                        </div>

                        {/* CONTACTO */}
                        <div className="md:col-span-6 space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Celular / WhatsApp</label>
                            <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                                <input 
                                    type="text" 
                                    value={formData.celular} 
                                    onChange={e => setFormData({...formData, celular: e.target.value})} 
                                    className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary shadow-inner" 
                                    placeholder="Número de contacto"
                                />
                            </div>
                        </div>
                        <div className="md:col-span-6 space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Correo Electrónico</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                                <input 
                                    type="email" 
                                    value={formData.email} 
                                    onChange={e => setFormData({...formData, email: e.target.value})} 
                                    className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary shadow-inner" 
                                    placeholder="email@proveedor.com"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-background/50 rounded-2xl border border-surfaceHighlight">
                        <span className="text-xs font-black text-text uppercase">Estado Activo</span>
                        <button 
                            type="button"
                            onClick={() => setFormData({...formData, activo: !formData.activo})}
                            className={`w-14 h-8 rounded-full transition-all relative ${formData.activo ? 'bg-primary' : 'bg-surfaceHighlight'}`}
                        >
                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all ${formData.activo ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>
                </form>

                <div className="p-6 border-t border-surfaceHighlight bg-surface shrink-0 flex gap-4">
                    <button type="button" onClick={onClose} className="flex-1 py-4 text-text font-black text-xs hover:bg-surfaceHighlight rounded-2xl border border-surfaceHighlight uppercase transition-all">Cancelar</button>
                    <button onClick={(e) => { e.preventDefault(); onSave(formData); }} className="flex-1 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:bg-primaryHover uppercase text-xs flex items-center justify-center gap-2 transition-all active:scale-95">
                        <Save size={18} /> Guardar
                    </button>
                </div>
            </div>
        </div>
    );
};
