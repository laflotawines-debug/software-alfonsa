
import React, { useState } from 'react';
import { 
    X, 
    Save, 
    Trash2, 
    Info, 
    Tag, 
    DollarSign, 
    History, 
    MoreVertical, 
    Package, 
    CheckCircle2,
    Calendar,
    ArrowUpRight,
    FileText,
    Boxes,
    HelpCircle,
    Sun,
    Moon
} from 'lucide-react';
import { MasterProduct, User } from '../types';

interface ProductDetailModalProps {
    product: MasterProduct;
    onClose: () => void;
    currentUser: User;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, onClose, currentUser }) => {
    const [isSaving, setIsSaving] = useState(false);
    const isVale = currentUser.role === 'vale';

    const calculateMargin = (price: number) => {
        const cost = product.costo || 0;
        if (cost === 0 || !price) return 0;
        return ((price - cost) / price) * 100;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-background w-full max-w-6xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-surfaceHighlight animate-in zoom-in-95 duration-300">
                
                {/* Header Superior Estilo Alfonsa */}
                <div className="p-6 md:p-8 bg-surface border-b border-surfaceHighlight flex items-center justify-between shrink-0">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest mb-1">
                            <Boxes size={14} /> GESTIÓN DE INVENTARIO
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-text tracking-tighter">
                            Edición de Artículo <span className="text-muted opacity-50 font-mono">#{product.codart}</span>
                        </h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="p-2 text-muted hover:text-text rounded-full hover:bg-surfaceHighlight transition-all">
                            <X size={28} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col lg:flex-row gap-8 bg-background/50">
                    
                    {/* Columna Izquierda: Información del Producto */}
                    <div className="flex-1 flex flex-col gap-8">
                        
                        {/* 1. Información General (Estructura de Referencia) */}
                        <section className="bg-surface rounded-2xl p-6 border border-surfaceHighlight shadow-sm relative">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-text flex items-center gap-2 italic uppercase tracking-tighter">
                                    <Info className="text-primary" size={20} /> Información General
                                </h3>
                                <div className="flex items-center gap-2">
                                    <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                                        <CheckCircle2 size={12} className="text-white" />
                                    </div>
                                    <span className="text-[10px] font-black text-muted uppercase">Llevar Stock Activo</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Nombre del Artículo / Descripción</label>
                                    <input 
                                        type="text" 
                                        defaultValue={product.desart}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 px-5 text-sm font-black text-text outline-none focus:border-primary shadow-inner uppercase"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Cód. de Barras</label>
                                    <input 
                                        type="text" 
                                        placeholder="(Dato Opcional)"
                                        defaultValue={product.cbarra}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 px-5 text-sm font-medium text-text outline-none focus:border-primary shadow-inner"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Cód. Proveedor</label>
                                    <input 
                                        type="text" 
                                        placeholder="(Dato Opcional)"
                                        defaultValue={product.codprove}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 px-5 text-sm font-medium text-text outline-none focus:border-primary shadow-inner"
                                    />
                                </div>
                                
                                {/* Campo Costo: Solo visible para VALE */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Costo Unitario</label>
                                    {isVale ? (
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-bold">$</span>
                                            <input 
                                                type="text" 
                                                defaultValue={(product.costo || 0).toFixed(2)}
                                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 pl-8 pr-16 text-sm font-black text-orange-500 outline-none focus:border-primary shadow-inner"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted uppercase">Sin IVA</span>
                                        </div>
                                    ) : (
                                        <div className="w-full bg-surfaceHighlight/30 border border-dashed border-surfaceHighlight rounded-xl py-3.5 px-5 flex items-center justify-center italic text-xs text-muted">
                                            Información reservada para administración
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* 2. Clasificación */}
                        <section className="bg-surface rounded-2xl p-6 border border-surfaceHighlight shadow-sm">
                            <h3 className="text-lg font-bold text-text flex items-center gap-2 mb-6 italic uppercase tracking-tighter">
                                <Tag className="text-primary" size={20} /> Clasificación Logística
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Proveedor Titular</label>
                                    <select className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 px-5 text-sm font-bold text-text outline-none focus:border-primary shadow-inner cursor-pointer appearance-none uppercase">
                                        <option>{product.nomprov || 'SIN PROVEEDOR'}</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Familia</label>
                                    <select className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 px-5 text-sm font-bold text-text outline-none focus:border-primary shadow-inner cursor-pointer appearance-none uppercase">
                                        <option>{product.familia || 'SIN FAMILIA'}</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Subfamilia</label>
                                    <select className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 px-5 text-sm font-bold text-text outline-none focus:border-primary shadow-inner cursor-pointer appearance-none uppercase">
                                        <option>{product.nsubf || 'SIN SUBFAMILIA'}</option>
                                    </select>
                                </div>
                            </div>
                        </section>

                        {/* 3. Precios de Venta */}
                        <section className="bg-surface rounded-2xl p-6 border border-surfaceHighlight shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-text flex items-center gap-2 italic uppercase tracking-tighter">
                                    <DollarSign className="text-primary" size={20} /> Precios de Venta Oficiales
                                </h3>
                                <div className="px-3 py-1 bg-orange-100 dark:bg-orange-500/10 text-orange-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-orange-200 dark:border-orange-500/20">
                                    Iva Incluido (China / Mayorista)
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {[1, 2, 3, 4].map((num) => {
                                    const price = (product as any)[`pventa_${num}`] || 0;
                                    const margin = calculateMargin(price);
                                    return (
                                        <div key={num} className="bg-background border border-surfaceHighlight rounded-2xl p-4 flex flex-col gap-3 shadow-inner">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] font-black text-muted uppercase">Lista {num}</span>
                                                {isVale && (
                                                    <span className={`text-[9px] font-black uppercase ${margin > 25 ? 'text-green-500' : 'text-orange-500'}`}>
                                                        Utilidad: {margin.toFixed(1)}%
                                                    </span>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs font-bold">$</span>
                                                <input 
                                                    type="text" 
                                                    defaultValue={price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                    className="w-full bg-surface border border-surfaceHighlight rounded-xl py-2.5 pl-7 pr-3 text-sm font-black text-text outline-none focus:border-primary shadow-sm text-right"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    </div>

                    {/* Columna Derecha: Barra Lateral de Acciones */}
                    <div className="w-full lg:w-72 flex flex-col gap-6 shrink-0">
                        
                        {/* Panel Acciones Críticas */}
                        <div className="bg-surface rounded-2xl p-6 border border-surfaceHighlight shadow-sm flex flex-col gap-4">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest border-b border-surfaceHighlight pb-2 mb-2">Acciones Rápidas</span>
                            <button className="w-full flex items-center justify-center gap-3 py-4 bg-primary hover:bg-primaryHover text-white rounded-xl font-black text-sm shadow-xl shadow-primary/20 transition-all active:scale-95 uppercase tracking-tighter">
                                <CheckCircle2 size={20} /> Aceptar Cambios
                            </button>
                            <button onClick={onClose} className="w-full flex items-center justify-center gap-3 py-4 bg-background border border-surfaceHighlight text-text hover:bg-surfaceHighlight rounded-xl font-black text-sm transition-all uppercase tracking-tighter">
                                <X size={20} /> Cancelar
                            </button>
                        </div>

                        {/* Herramientas de Gestión */}
                        <div className="bg-surface rounded-2xl p-6 border border-surfaceHighlight shadow-sm flex flex-col gap-2">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest border-b border-surfaceHighlight pb-2 mb-4">Herramientas</span>
                            <button className="flex items-center gap-4 p-3 rounded-xl hover:bg-surfaceHighlight transition-colors text-text font-bold text-sm group">
                                <div className="p-2 bg-background rounded-lg text-muted group-hover:text-primary transition-colors"><Boxes size={18} /></div>
                                Movimiento Stock
                            </button>
                            <button className="flex items-center gap-4 p-3 rounded-xl hover:bg-surfaceHighlight transition-colors text-text font-bold text-sm group">
                                <div className="p-2 bg-background rounded-lg text-muted group-hover:text-primary transition-colors"><History size={18} /></div>
                                Seguimiento Histórico
                            </button>
                            <div className="h-px bg-surfaceHighlight my-2"></div>
                            <button className="flex items-center gap-4 p-3 rounded-xl hover:bg-red-500/10 transition-colors text-red-500 font-bold text-sm group">
                                <div className="p-2 bg-red-500/10 rounded-lg text-red-500"><Trash2 size={18} /></div>
                                Eliminar Artículo
                            </button>
                        </div>

                        {/* Auditoría de Venta */}
                        <div className="bg-blue-500/5 rounded-2xl p-6 border border-blue-500/10 flex flex-col gap-4">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-muted uppercase">Última Salida:</p>
                                <p className="text-sm font-black text-text italic">{product.last_sale_date || '12/11/2025'}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-muted uppercase">Comprobante Ref:</p>
                                <p className="text-sm font-mono text-muted tracking-tighter">{product.last_invoice_ref || '0001-00002873'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
