
import React, { useState, useEffect } from 'react';
import { 
    Calculator, 
    Search, 
    AlertCircle, 
    CheckCircle2, 
    Loader2, 
    Warehouse, 
    ArrowRight,
    ArrowDown,
    ArrowUp,
    Boxes,
    Info,
    X
} from 'lucide-react';
import { supabase } from '../supabase';
import { MasterProduct, WarehouseCode, User as UserType } from '../types';

export const InventoryAdjustments: React.FC<{ currentUser: UserType }> = ({ currentUser }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<MasterProduct[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<MasterProduct | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    // Form states
    const [warehouse, setWarehouse] = useState<string>('LLERENA');
    const [quantity, setQuantity] = useState('');
    const [reasonType, setReasonType] = useState('Merma');
    const [reasonText, setReasonText] = useState('');

    const handleSearch = async (val: string) => {
        setSearchTerm(val);
        if (val.length < 3) { setSearchResults([]); return; }
        const { data } = await supabase.from('master_products')
            .select('*')
            .or(`desart.ilike.%${val}%,codart.ilike.%${val}%,cbarra.eq.${val}`)
            .limit(5);
        setSearchResults(data || []);
    };

    const selectProduct = (p: MasterProduct) => {
        setSelectedProduct(p);
        setSearchResults([]);
        setSearchTerm('');
        setQuantity('');
        setReasonText('');
    };

    const handleAdjust = async () => {
        const qty = parseFloat(quantity);
        if (!selectedProduct || isNaN(qty) || qty === 0) return alert("Ingrese una cantidad válida");
        
        const currentStock = warehouse === 'LLERENA' ? (selectedProduct.stock_llerena || 0) : (selectedProduct.stock_betbeder || 0);
        if (currentStock + qty < 0) return alert("Operación inválida: El stock resultante no puede ser negativo.");

        if (!reasonText && reasonType === 'Otro') return alert("Especifique el motivo.");

        setIsSaving(true);
        try {
            const finalReason = `${reasonType}: ${reasonText}`.trim();
            const { error } = await supabase.rpc('ajustar_stock', {
                p_warehouse: warehouse, // Envía 'LLERENA' o 'BETBEDER' como TEXT
                p_codart: selectedProduct.codart,
                p_quantity: qty,
                p_reason: finalReason,
                p_user_id: currentUser.id
            });

            if (error) throw error;
            
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                setSelectedProduct(null);
            }, 3000);
        } catch (e: any) {
            alert("Error: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const currentWarehouseStock = selectedProduct 
        ? (warehouse === 'LLERENA' ? (selectedProduct.stock_llerena || 0) : (selectedProduct.stock_betbeder || 0))
        : 0;
    
    const resultingStock = currentWarehouseStock + (parseFloat(quantity) || 0);

    return (
        <div className="flex flex-col gap-8 pb-10 max-w-4xl mx-auto animate-in fade-in">
            <div>
                <h2 className="text-3xl font-black text-text tracking-tight flex items-center gap-3 uppercase italic">
                    <Calculator className="text-primary" size={32} />
                    Ajustes de Stock
                </h2>
                <p className="text-muted text-sm mt-1 font-medium italic">Correciones manuales para mermas, roturas o sobrantes.</p>
            </div>

            <div className="bg-surface border border-surfaceHighlight rounded-3xl p-8 shadow-sm relative overflow-visible">
                {!selectedProduct ? (
                    <div className="space-y-4">
                        <label className="text-xs font-black uppercase text-muted tracking-widest ml-1">Seleccionar Artículo para Ajustar</label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
                            <input 
                                autoFocus
                                type="text" 
                                placeholder="Escribe el nombre o código..." 
                                value={searchTerm}
                                onChange={e => handleSearch(e.target.value)}
                                className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase"
                            />
                            {searchResults.length > 0 && (
                                <div className="absolute top-full left-0 w-full bg-surface border border-primary/30 rounded-2xl shadow-2xl mt-2 overflow-hidden z-50">
                                    {searchResults.map(p => (
                                        <button 
                                            key={p.codart}
                                            onClick={() => selectProduct(p)}
                                            className="w-full p-4 hover:bg-primary/5 text-left border-b border-surfaceHighlight last:border-none flex justify-between items-center group"
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-text uppercase group-hover:text-primary">{p.desart}</span>
                                                <span className="text-[9px] font-mono text-muted">#{p.codart}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <span className="text-[9px] font-black text-blue-500 uppercase">LLE: {p.stock_llerena || 0}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[9px] font-black text-orange-500 uppercase">BBD: {p.stock_betbeder || 0}</span>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 animate-in zoom-in-95">
                        <div className="flex justify-between items-start border-b border-surfaceHighlight pb-6">
                            <div>
                                <h3 className="text-xl font-black text-text uppercase leading-tight">{selectedProduct.desart}</h3>
                                <p className="text-xs font-mono text-primary font-bold mt-1">CODART: #{selectedProduct.codart}</p>
                            </div>
                            <button onClick={() => setSelectedProduct(null)} className="p-2 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><X size={24}/></button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">1. Seleccionar Depósito</label>
                                    <div className="flex gap-3">
                                        {['LLERENA', 'BETBEDER'].map(w => (
                                            <button 
                                                key={w}
                                                onClick={() => setWarehouse(w)}
                                                className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border ${warehouse === w ? 'bg-primary text-white border-primary shadow-lg' : 'bg-background text-muted border-surfaceHighlight hover:bg-surfaceHighlight'}`}
                                            >
                                                {w}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">2. Motivo del Ajuste</label>
                                    <select 
                                        value={reasonType} 
                                        onChange={e => setReasonType(e.target.value)}
                                        className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 px-5 font-black text-text outline-none focus:border-primary appearance-none cursor-pointer"
                                    >
                                        <option value="Merma">Merma / Vencimiento</option>
                                        <option value="Rotura">Rotura / Daño</option>
                                        <option value="Error de carga">Error de Carga Anterior</option>
                                        <option value="Auditoría">Auditoría / Conteo Físico</option>
                                        <option value="Otro">Otro Motivo...</option>
                                    </select>
                                    <input 
                                        type="text" 
                                        placeholder="Descripción adicional..."
                                        value={reasonText}
                                        onChange={e => setReasonText(e.target.value)}
                                        className="w-full bg-background border border-surfaceHighlight rounded-2xl py-3 px-5 text-sm font-bold text-text outline-none focus:border-primary shadow-inner"
                                    />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">3. Cantidad (+/-)</label>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            placeholder="0"
                                            value={quantity}
                                            onChange={e => setQuantity(e.target.value)}
                                            className={`w-full bg-background border rounded-3xl py-10 px-6 text-5xl font-black text-center outline-none focus:ring-4 focus:ring-primary/20 transition-all ${parseFloat(quantity) < 0 ? 'text-red-500 border-red-500/30' : 'text-green-500 border-green-500/30'}`}
                                        />
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2">
                                            <button onClick={() => setQuantity(prev => (parseFloat(prev)||0 + 1).toString())} className="p-2 bg-surface border border-surfaceHighlight rounded-lg text-muted hover:text-primary"><ArrowUp size={20}/></button>
                                            <button onClick={() => setQuantity(prev => (parseFloat(prev)||0 - 1).toString())} className="p-2 bg-surface border border-surfaceHighlight rounded-lg text-muted hover:text-primary"><ArrowDown size={20}/></button>
                                        </div>
                                    </div>
                                    <p className="text-[9px] text-muted text-center font-black uppercase tracking-widest">Usa "-" para mermas o "+" para ingresos manuales</p>
                                </div>

                                <div className="bg-background/50 rounded-3xl p-6 border border-surfaceHighlight space-y-4 shadow-inner">
                                    <div className="flex justify-between items-center text-xs font-bold uppercase">
                                        <span className="text-muted">Stock Actual en {warehouse}:</span>
                                        <span className="text-text">{currentWarehouseStock}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs font-black uppercase">
                                        <span className="text-muted">Impacto de Ajuste:</span>
                                        <span className={parseFloat(quantity) < 0 ? 'text-red-500' : 'text-green-500'}>{parseFloat(quantity) > 0 ? '+' : ''}{quantity || 0}</span>
                                    </div>
                                    <div className="h-px bg-surfaceHighlight"></div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase text-muted tracking-widest">Stock Resultante</span>
                                        <span className={`text-2xl font-black ${resultingStock < 0 ? 'text-red-600 animate-pulse' : 'text-primary'}`}>
                                            {resultingStock}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-surfaceHighlight">
                            {success ? (
                                <div className="flex items-center justify-center gap-3 text-green-500 font-black animate-in zoom-in-95">
                                    <CheckCircle2 size={32} />
                                    <span className="text-xl uppercase italic">¡Ajuste Procesado con Éxito!</span>
                                </div>
                            ) : (
                                <button 
                                    onClick={handleAdjust}
                                    disabled={isSaving || resultingStock < 0 || !quantity || parseFloat(quantity) === 0}
                                    className="w-full py-6 bg-primary hover:bg-primaryHover text-white rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSaving ? <Loader2 size={18} className="animate-spin mx-auto" /> : `Confirmar Ajuste en ${warehouse}`}
                                </button>
                            )}
                            {resultingStock < 0 && (
                                <p className="mt-3 text-center text-[10px] font-black text-red-500 uppercase flex items-center justify-center gap-2">
                                    <AlertCircle size={14} /> El stock no puede ser negativo. Ajusta el valor.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
            
            <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 flex gap-4">
                <Info size={24} className="text-primary shrink-0" />
                <div>
                    <h4 className="text-xs font-black text-primary uppercase tracking-widest">Regla de Integridad</h4>
                    <p className="text-[10px] text-muted font-bold leading-relaxed uppercase mt-1">Los ajustes se graban en el libro mayor como un movimiento inmutable de tipo "Ajuste". Si te equivocas, debes generar otro ajuste compensatorio.</p>
                </div>
            </div>
        </div>
    );
};
