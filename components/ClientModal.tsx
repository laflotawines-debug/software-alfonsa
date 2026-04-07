import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { ClientMaster } from '../types';
import { AlertCircle, Loader2, Save, X, Building2, Contact2, MapPin, Phone, Mail, Hash, CheckCircle2 } from 'lucide-react';

interface ClientModalProps {
    initialData: ClientMaster | null;
    onClose: () => void;
    onSuccess: (client?: ClientMaster) => void;
}

export const ClientModal: React.FC<ClientModalProps> = ({ initialData, onClose, onSuccess }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [classifications, setClassifications] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        codigo: initialData?.codigo || '',
        nombre: initialData?.nombre || '',
        domicilio: initialData?.domicilio || '',
        localidad: initialData?.localidad || '',
        provincia: initialData?.provincia || '',
        celular: initialData?.celular || '',
        email: initialData?.email || '',
        price_list: initialData?.price_list || 2, // Default to List 2
        contacto: initialData?.contacto || '',
        activo: initialData?.activo !== false, // Default to true
        classification_id: initialData?.classification_id || ''
    });

    const isEdit = !!initialData;

    useEffect(() => {
        const fetchClassifications = async () => {
            const { data, error } = await supabase.from('client_classifications').select('*').order('name');
            if (!error && data) {
                setClassifications(data);
            }
        };
        fetchClassifications();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.codigo || !formData.nombre) return setError("Código y Nombre son obligatorios.");
        
        setIsSaving(true);
        setError(null);
        try {
            const payload = {
                codigo: formData.codigo.trim().toUpperCase(),
                nombre: formData.nombre.trim().toUpperCase(),
                domicilio: formData.domicilio?.trim().toUpperCase() || null,
                localidad: formData.localidad?.trim().toUpperCase() || null,
                provincia: formData.provincia?.trim().toUpperCase() || null,
                celular: formData.celular?.trim() || null,
                email: formData.email?.trim().toLowerCase() || null,
                price_list: formData.price_list,
                contacto: formData.contacto?.trim().toUpperCase() || null,
                activo: formData.activo,
                classification_id: formData.classification_id || null
            };

            if (isEdit) {
                const { error: updError } = await supabase
                    .from('clients_master')
                    .update(payload)
                    .eq('codigo', initialData.codigo);
                if (updError) throw updError;
                onSuccess(payload as ClientMaster);
            } else {
                const { error: insError } = await supabase.from('clients_master').insert([payload]);
                if (insError) {
                    if (insError.code === '23505') throw new Error("El código de cliente ya existe.");
                    throw insError;
                }
                onSuccess(payload as ClientMaster);
            }
        } catch (err: any) {
            if (err.message?.includes("Could not find the 'price_list' column")) {
                setError("⚠️ Error de Base de Datos: Falta la columna 'price_list'. Por favor solicite al administrador ejecutar el script de actualización.");
            } else if (err.message?.includes("Could not find the 'contacto' column")) {
                setError("⚠️ Error de Base de Datos: Falta la columna 'contacto'. Por favor solicite al administrador ejecutar el script de actualización.");
            } else if (err.message?.includes("Could not find the 'activo' column")) {
                setError("⚠️ Error de Base de Datos: Falta la columna 'activo'. Por favor solicite al administrador ejecutar el script de actualización.");
            } else {
                setError(err.message);
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-surface w-full max-w-2xl rounded-3xl border border-surfaceHighlight shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-surfaceHighlight flex justify-between items-center bg-background/30 shrink-0">
                    <h3 className="text-xl font-black text-text uppercase italic">
                        {isEdit ? `Editando: ${initialData.nombre}` : 'Ficha de Nuevo Cliente'}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-surfaceHighlight rounded-full text-muted transition-colors"><X size={24}/></button>
                </div>
                
                <div className="overflow-y-auto p-8">
                    <form onSubmit={handleSave} className="space-y-6">
                        {error && (
                            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-600 text-xs font-bold flex items-center gap-3 animate-in shake">
                                <AlertCircle size={18} /> {error}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                            <div className="md:col-span-12 flex justify-between items-center">
                                <div className="flex-1 max-w-xs">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 mb-1 block">Clasificación</label>
                                    <select
                                        value={formData.classification_id}
                                        onChange={(e) => setFormData({ ...formData, classification_id: e.target.value })}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-2 px-3 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase"
                                    >
                                        <option value="">SIN CLASIFICAR</option>
                                        {classifications.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <label className="flex items-center gap-3 cursor-pointer group select-none">
                                    <span className={`text-xs font-black uppercase transition-colors ${formData.activo ? 'text-primary' : 'text-muted'}`}>
                                        {formData.activo ? 'Cliente Activo' : 'Cliente Inactivo'}
                                    </span>
                                    <div className="relative w-12 h-7">
                                        <input 
                                            type="checkbox" 
                                            checked={formData.activo} 
                                            onChange={e => setFormData({...formData, activo: e.target.checked})} 
                                            className="sr-only" 
                                        />
                                        <div className={`absolute inset-0 rounded-full transition-all shadow-inner ${formData.activo ? 'bg-primary' : 'bg-surfaceHighlight'}`}></div>
                                        <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${formData.activo ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                    </div>
                                </label>
                            </div>

                            <div className="md:col-span-12 space-y-2">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Lista de Precios Predeterminada</label>
                                <div className="flex gap-4 p-4 bg-surfaceHighlight/30 rounded-2xl border border-surfaceHighlight overflow-x-auto">
                                    {[1, 2, 3, 4].map((listNum) => (
                                        <label key={listNum} className={`flex-1 min-w-[80px] flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${formData.price_list === listNum ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'bg-background border-surfaceHighlight text-muted hover:border-primary/30'}`}>
                                            <input 
                                                type="radio" 
                                                name="price_list" 
                                                value={listNum} 
                                                checked={formData.price_list === listNum} 
                                                onChange={() => setFormData({...formData, price_list: listNum})} 
                                                className="hidden" 
                                            />
                                            <span className="text-xs font-black uppercase">Lista {listNum}</span>
                                            {formData.price_list === listNum && <CheckCircle2 size={14} />}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="md:col-span-4 space-y-2">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Código Único *</label>
                                <div className="relative">
                                    <Hash className={`absolute left-4 top-1/2 -translate-y-1/2 ${isEdit ? 'text-muted/30' : 'text-muted'}`} size={16} />
                                    <input 
                                        required 
                                        type="text" 
                                        disabled={isEdit}
                                        value={formData.codigo} 
                                        onChange={e => setFormData({...formData, codigo: e.target.value})} 
                                        className={`w-full bg-background border border-surfaceHighlight rounded-2xl py-3.5 pl-11 text-sm font-black text-text outline-none focus:border-primary shadow-inner uppercase ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                        placeholder="0000" 
                                    />
                                </div>
                                {isEdit && <p className="text-[8px] font-bold text-muted uppercase ml-1">El código no puede cambiarse en edición.</p>}
                            </div>
                            <div className="md:col-span-8 space-y-2">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Nombre / Razón Social *</label>
                                <div className="relative">
                                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                                    <input required type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full bg-background border border-surfaceHighlight rounded-2xl py-3.5 pl-11 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase" placeholder="NOMBRE COMPLETO" />
                                </div>
                            </div>

                            <div className="md:col-span-12 space-y-2">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Contacto Principal</label>
                                <div className="relative">
                                    <Contact2 className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                                    <input type="text" value={formData.contacto} onChange={e => setFormData({...formData, contacto: e.target.value})} className="w-full bg-background border border-surfaceHighlight rounded-2xl py-3.5 pl-11 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase" placeholder="NOMBRE DEL ENCARGADO" />
                                </div>
                            </div>

                            <div className="md:col-span-12 space-y-2">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Dirección de Entrega</label>
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                                    <input type="text" value={formData.domicilio} onChange={e => setFormData({...formData, domicilio: e.target.value})} className="w-full bg-background border border-surfaceHighlight rounded-2xl py-3.5 pl-11 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase" placeholder="CALLE Y NÚMERO" />
                                </div>
                            </div>

                            <div className="md:col-span-6 space-y-2">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Localidad</label>
                                <input type="text" value={formData.localidad} onChange={e => setFormData({...formData, localidad: e.target.value})} className="w-full bg-background border border-surfaceHighlight rounded-2xl py-3.5 px-5 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase" placeholder="V. MERCEDES" />
                            </div>
                            <div className="md:col-span-6 space-y-2">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Provincia</label>
                                <input type="text" value={formData.provincia} onChange={e => setFormData({...formData, provincia: e.target.value})} className="w-full bg-background border border-surfaceHighlight rounded-2xl py-3.5 px-5 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase" placeholder="SAN LUIS" />
                            </div>

                            <div className="md:col-span-6 space-y-2">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Celular / WhatsApp</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                                    <input type="text" value={formData.celular} onChange={e => setFormData({...formData, celular: e.target.value})} className="w-full bg-background border border-surfaceHighlight rounded-2xl py-3.5 pl-11 text-sm font-bold text-text outline-none focus:border-primary shadow-inner" placeholder="2657 000000" />
                                </div>
                            </div>
                            <div className="md:col-span-6 space-y-2">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Correo Electrónico</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                                    <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-background border border-surfaceHighlight rounded-2xl py-3.5 pl-11 text-sm font-bold text-text outline-none focus:border-primary shadow-inner" placeholder="ejemplo@email.com" />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4 pt-6">
                            <button type="button" onClick={onClose} className="flex-1 py-4 text-text font-black text-xs hover:bg-surfaceHighlight rounded-2xl border border-surfaceHighlight uppercase transition-all">Cancelar</button>
                            <button 
                                type="submit" 
                                disabled={isSaving}
                                className="flex-1 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:bg-primaryHover uppercase text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70"
                            >
                                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                {isEdit ? 'Actualizar Ficha' : 'Guardar Cliente'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
