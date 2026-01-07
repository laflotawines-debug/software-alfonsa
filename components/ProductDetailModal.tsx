
import React, { useState } from 'react';
import { 
    X, 
    Save, 
    Info, 
    DollarSign, 
    Boxes,
    Loader2,
    Truck,
    AlertCircle,
    Layers,
    Edit3,
    Hash,
    Type,
    Building2,
    Package
} from 'lucide-react';
import { MasterProduct, User, SupplierMaster } from '../types';
import { supabase } from '../supabase';

interface ProductDetailModalProps {
    product: MasterProduct | null;
    existingFamilies: string[];
    existingSubfamilies: string[];
    onClose: (updated?: boolean) => void;
    currentUser: User;
    masterSuppliers: SupplierMaster[];
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ 
    product, 
    existingFamilies,
    existingSubfamilies,
    onClose, 
    currentUser, 
    masterSuppliers 
}) => {
    const isCreate = !product;
    const [isSaving, setIsSaving] = useState(false);
    
    // Estados para controlar si usamos select o input manual
    const [manualFamily, setManualFamily] = useState(false);
    const [manualSubfamily, setManualSubfamily] = useState(false);

    const [formData, setFormData] = useState({
        codart: product?.codart || '',
        desart: product?.desart || '',
        costo: product?.costo || 0,
        codprove: product?.codprove || '',
        nomprov: product?.nomprov || '', // Valor de texto del proveedor (Excel)
        familia: product?.familia || '',
        nsubf: product?.nsubf || '',
        units_per_box: product?.units_per_box ?? 6, // Valor por defecto 6
        pventa_1: product?.pventa_1 || 0,
        pventa_2: product?.pventa_2 || 0,
        pventa_3: product?.pventa_3 || 0,
        pventa_4: product?.pventa_4 || 0,
    });

    const isVale = currentUser.role === 'vale';

    const handleSave = async () => {
        if (!formData.codart || !formData.desart) {
            alert("Código y Descripción son obligatorios.");
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                codart: formData.codart.toUpperCase(),
                desart: formData.desart.toUpperCase(),
                costo: formData.costo,
                codprove: formData.codprove || null,
                nomprov: formData.nomprov?.toUpperCase() || null, // Guardamos el nombre de texto
                familia: formData.familia?.toUpperCase() || null,
                nsubf: formData.nsubf?.toUpperCase() || null,
                units_per_box: formData.units_per_box,
                pventa_1: formData.pventa_1,
                pventa_2: formData.pventa_2,
                pventa_3: formData.pventa_3,
                pventa_4: formData.pventa_4,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('master_products')
                .upsert(payload, { onConflict: 'codart' });

            if (error) throw error;
            
            onClose(true);
        } catch (err: any) {
            alert("Error al guardar: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const calculateMargin = (price: number) => {
        const cost = formData.costo || 0;
        if (cost === 0 || !price) return 0;
        return ((price - cost) / price) * 100;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-background w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-surfaceHighlight">
                
                {/* Header */}
                <div className="p-6 md:p-8 bg-surface border-b border-surfaceHighlight flex items-center justify-between shrink-0">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest mb-1">
                            <Boxes size={14} /> {isCreate ? 'ALTA DE PRODUCTO' : 'GESTIÓN DE ARTÍCULO'}
                        </div>
                        <h2 className="text-2xl font-black text-text tracking-tighter">
                            {isCreate ? 'Nuevo Registro' : `#${product.codart}`} — <span className="opacity-60 italic">Edición Maestra</span>
                        </h2>
                    </div>

                    {!isCreate && (
                        <div className="flex items-center gap-4 mr-8">
                            <div className="bg-background/50 border border-surfaceHighlight rounded-2xl px-4 py-2 flex flex-col items-center">
                                <span className="text-[8px] font-black text-muted uppercase">Betbeder</span>
                                <span className="text-lg font-black text-orange-500 leading-none">{product.stock_betbeder || 0}</span>
                            </div>
                            <div className="bg-background/50 border border-surfaceHighlight rounded-2xl px-4 py-2 flex flex-col items-center">
                                <span className="text-[8px] font-black text-muted uppercase">Llerena</span>
                                <span className="text-lg font-black text-blue-500 leading-none">{product.stock_llerena || 0}</span>
                            </div>
                        </div>
                    )}

                    <button onClick={() => onClose()} className="p-2 text-muted hover:text-text rounded-full hover:bg-surfaceHighlight transition-all">
                        <X size={28} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col lg:flex-row gap-8 bg-background/50">
                    <div className="flex-1 space-y-8">
                        
                        {/* Información General */}
                        <section className="bg-surface rounded-2xl p-6 border border-surfaceHighlight shadow-sm space-y-6">
                            <h3 className="text-lg font-bold text-text flex items-center gap-2 italic uppercase tracking-tighter">
                                <Info className="text-primary" size={20} /> Datos Principales
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 flex items-center gap-1">
                                        <Hash size={10} /> Código de Artículo *
                                    </label>
                                    <input 
                                        type="text" 
                                        disabled={!isCreate}
                                        value={formData.codart}
                                        onChange={(e) => setFormData({...formData, codart: e.target.value})}
                                        placeholder="Ej: 7500"
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 px-5 text-sm font-black text-text outline-none focus:border-primary shadow-inner uppercase disabled:opacity-50"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 flex items-center gap-1">
                                        <Type size={10} /> Nombre / Descripción *
                                    </label>
                                    <input 
                                        type="text" 
                                        value={formData.desart}
                                        onChange={(e) => setFormData({...formData, desart: e.target.value})}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 px-5 text-sm font-black text-text outline-none focus:border-primary shadow-inner uppercase"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center ml-1">
                                        <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1">
                                            Familia
                                        </label>
                                        <button 
                                            onClick={() => setManualFamily(!manualFamily)}
                                            className="text-[9px] font-black text-primary hover:underline uppercase flex items-center gap-1"
                                        >
                                            <Edit3 size={10} /> {manualFamily ? 'Elegir de lista' : 'Entrada manual'}
                                        </button>
                                    </div>
                                    {manualFamily ? (
                                        <input 
                                            type="text" 
                                            value={formData.familia}
                                            onChange={(e) => setFormData({...formData, familia: e.target.value})}
                                            className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 px-5 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase"
                                            placeholder="NUEVA FAMILIA"
                                        />
                                    ) : (
                                        <select 
                                            value={formData.familia}
                                            onChange={(e) => setFormData({...formData, familia: e.target.value})}
                                            className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 px-5 text-sm font-bold text-text outline-none focus:border-primary appearance-none cursor-pointer uppercase"
                                        >
                                            <option value="">SIN FAMILIA</option>
                                            {existingFamilies.map(f => <option key={f} value={f}>{f}</option>)}
                                        </select>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center ml-1">
                                        <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1">
                                            <Layers size={10} /> Subfamilia
                                        </label>
                                        <button 
                                            onClick={() => setManualSubfamily(!manualSubfamily)}
                                            className="text-[9px] font-black text-primary hover:underline uppercase flex items-center gap-1"
                                        >
                                            <Edit3 size={10} /> {manualSubfamily ? 'Elegir de lista' : 'Entrada manual'}
                                        </button>
                                    </div>
                                    {manualSubfamily ? (
                                        <input 
                                            type="text" 
                                            value={formData.nsubf}
                                            onChange={(e) => setFormData({...formData, nsubf: e.target.value})}
                                            className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 px-5 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase"
                                            placeholder="NUEVA SUBFAMILIA"
                                        />
                                    ) : (
                                        <select 
                                            value={formData.nsubf}
                                            onChange={(e) => setFormData({...formData, nsubf: e.target.value})}
                                            className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 px-5 text-sm font-bold text-text outline-none focus:border-primary appearance-none cursor-pointer uppercase"
                                        >
                                            <option value="">SIN SUBFAMILIA</option>
                                            {existingSubfamilies.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 flex items-center gap-1">
                                        <Truck size={10} /> Proveedor Oficial (Vínculo Master)
                                    </label>
                                    <select 
                                        value={formData.codprove}
                                        onChange={(e) => setFormData({...formData, codprove: e.target.value})}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 px-5 text-sm font-bold text-text outline-none focus:border-primary appearance-none cursor-pointer"
                                    >
                                        <option value="">SIN VÍNCULO OFICIAL</option>
                                        {masterSuppliers.map(s => (
                                            <option key={s.codigo} value={s.codigo}>{s.codigo} - {s.razon_social}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 flex items-center gap-1">
                                        <Building2 size={10} /> Proveedor Referencia (Nombre Excel)
                                    </label>
                                    <input 
                                        type="text" 
                                        value={formData.nomprov}
                                        onChange={(e) => setFormData({...formData, nomprov: e.target.value})}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 px-5 text-sm font-black text-blue-600 outline-none focus:border-primary shadow-inner uppercase"
                                        placeholder="Ej: COCA COLA"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 flex items-center gap-1">
                                        <DollarSign size={10} /> Costo Unitario ($)
                                    </label>
                                    <input 
                                        type="number" 
                                        disabled={!isVale}
                                        value={formData.costo}
                                        onChange={(e) => setFormData({...formData, costo: parseFloat(e.target.value) || 0})}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 px-5 text-sm font-black text-orange-500 outline-none focus:border-primary shadow-inner disabled:opacity-50"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 flex items-center gap-1">
                                        <Package size={10} /> Unidades por Caja
                                    </label>
                                    <input 
                                        type="number" 
                                        value={formData.units_per_box}
                                        onChange={(e) => setFormData({...formData, units_per_box: parseInt(e.target.value) || 0})}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 px-5 text-sm font-black text-primary outline-none focus:border-primary shadow-inner"
                                        placeholder="Default: 6"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Precios de Venta */}
                        <section className="bg-surface rounded-2xl p-6 border border-surfaceHighlight shadow-sm">
                            <h3 className="text-lg font-bold text-text flex items-center gap-2 mb-6 italic uppercase tracking-tighter">
                                <DollarSign className="text-primary" size={20} /> Estructura de Precios
                            </h3>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {[1, 2, 3, 4].map((num) => {
                                    const key = `pventa_${num}` as keyof typeof formData;
                                    const price = formData[key] as number;
                                    const margin = calculateMargin(price);
                                    return (
                                        <div key={num} className="bg-background border border-surfaceHighlight rounded-2xl p-4 flex flex-col gap-3 shadow-inner">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] font-black text-muted uppercase">Lista {num} {num === 4 && "(CHINA)"}</span>
                                                {isVale && (
                                                    <span className={`text-[9px] font-black uppercase ${margin > 20 ? 'text-green-500' : 'text-orange-500'}`}>
                                                        Utilidad: {margin.toFixed(1)}%
                                                    </span>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold text-sm">$</span>
                                                <input 
                                                    type="number" 
                                                    value={price}
                                                    onChange={(e) => setFormData({...formData, [key]: parseFloat(e.target.value) || 0})}
                                                    className="w-full bg-surface border border-surfaceHighlight rounded-xl py-3 pl-10 pr-4 text-lg font-black text-text outline-none focus:border-primary shadow-sm"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    </div>

                    {/* Lateral Actions */}
                    <div className="w-full lg:w-72 flex flex-col gap-6 shrink-0">
                        <div className="bg-surface rounded-2xl p-6 border border-surfaceHighlight shadow-sm flex flex-col gap-4">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest border-b border-surfaceHighlight pb-2 mb-2 text-center">Acciones</span>
                            
                            <button 
                                onClick={handleSave}
                                disabled={isSaving}
                                className="w-full flex items-center justify-center gap-3 py-4 bg-primary hover:bg-primaryHover text-white rounded-xl font-black text-sm shadow-xl shadow-primary/20 transition-all active:scale-95 uppercase tracking-tighter disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                {isSaving ? "Guardando..." : (isCreate ? "Crear Artículo" : "Guardar Cambios")}
                            </button>

                            <button 
                                onClick={() => onClose()}
                                className="w-full flex items-center justify-center gap-3 py-4 bg-background border border-surfaceHighlight text-text hover:bg-surfaceHighlight rounded-xl font-black text-sm transition-all uppercase tracking-tighter"
                            >
                                <X size={20} /> Cancelar
                            </button>
                        </div>

                        <div className="bg-primary/5 rounded-2xl p-5 border border-primary/20">
                            <div className="flex items-center gap-3 text-primary mb-3">
                                <AlertCircle size={18} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Información</span>
                            </div>
                            <p className="text-[10px] text-muted font-bold leading-relaxed uppercase">
                                {isCreate 
                                    ? "Al crear un nuevo artículo, este aparecerá automáticamente en el catálogo con stock en cero." 
                                    : "Los cambios realizados aquí impactan directamente en el maestro de precios y stock."}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
