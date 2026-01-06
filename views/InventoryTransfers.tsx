
import React, { useState, useMemo } from 'react';
import { 
    ArrowRightLeft, 
    ArrowRight, 
    Warehouse, 
    Search, 
    Trash2, 
    Plus, 
    Loader2, 
    CheckCircle2, 
    AlertCircle,
    Boxes,
    Package
} from 'lucide-react';
import { supabase } from '../supabase';
import { MasterProduct, WarehouseCode, User as UserType } from '../types';

interface TransferItem {
    product: MasterProduct;
    quantity: number;
}

export const InventoryTransfers: React.FC<{ currentUser: UserType }> = ({ currentUser }) => {
    const [origin, setOrigin] = useState<WarehouseCode>('LLERENA');
    const [destination, setDestination] = useState<WarehouseCode>('BETBEDER');
    const [items, setItems] = useState<TransferItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [transferCode, setTransferCode] = useState('');

    // Search states
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<MasterProduct[]>([]);

    const switchWarehouses = () => {
        setOrigin(destination);
        setDestination(origin);
        setItems([]); // Limpiar carga porque el stock cambia
    };

    const handleSearch = async (val: string) => {
        setSearchTerm(val);
        if (val.length < 3) { setSearchResults([]); return; }
        const { data } = await supabase.from('master_products')
            .select('*')
            .or(`desart.ilike.%${val}%,codart.ilike.%${val}%,cbarra.eq.${val}`)
            .limit(5);
        setSearchResults(data || []);
    };

    const addItem = (p: MasterProduct) => {
        if (items.find(i => i.product.codart === p.codart)) return alert("El producto ya está en la lista.");
        const stock = origin === 'LLERENA' ? (p.stock_llerena || 0) : (p.stock_betbeder || 0);
        if (stock <= 0) return alert("El producto seleccionado no tiene stock disponible en el depósito de origen.");
        
        setItems([...items, { product: p, quantity: 1 }]);
        setSearchTerm('');
        setSearchResults([]);
    };

    const updateQty = (codart: string, qty: number) => {
        setItems(prev => prev.map(item => {
            if (item.product.codart !== codart) return item;
            const stock = origin === 'LLERENA' ? (item.product.stock_llerena || 0) : (item.product.stock_betbeder || 0);
            const safeQty = Math.max(1, Math.min(qty, stock));
            return { ...item, quantity: safeQty };
        }));
    };

    const removeItem = (codart: string) => {
        setItems(prev => prev.filter(i => i.product.codart !== codart));
    };

    const handleTransfer = async () => {
        if (items.length === 0) return alert("Cargue productos para transferir.");
        setIsSaving(true);
        try {
            const displayCode = `TRF-${Math.random().toString(36).substring(7).toUpperCase()}`;
            const itemsJson = items.map(i => ({ codart: i.product.codart, qty: i.quantity }));

            const { error } = await supabase.rpc('transferir_stock', {
                p_origin: origin,
                p_destination: destination,
                p_items: itemsJson,
                p_reference_code: displayCode, // Cambiado de p_display_code
                p_user_id: currentUser.id
            });

            if (error) throw error;

            setTransferCode(displayCode);
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                setItems([]);
            }, 5000);
        } catch (e: any) {
            alert("Error: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 pb-20 max-w-6xl mx-auto animate-in fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight flex items-center gap-3 uppercase italic">
                        <ArrowRightLeft className="text-primary" size={32} />
                        Transferencias Inter-depósito
                    </h2>
                    <p className="text-muted text-sm mt-1 font-medium italic">Movimiento controlado de stock entre Llerena y Betbeder.</p>
                </div>
            </div>

            {/* Visual Warehouses */}
            <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-6 bg-surface border border-surfaceHighlight rounded-3xl p-8 shadow-sm">
                <WarehouseBox type="origin" warehouse={origin} />
                <div className="flex flex-col items-center gap-4">
                    <button onClick={switchWarehouses} className="p-6 bg-background border border-surfaceHighlight rounded-full hover:border-primary hover:text-primary transition-all shadow-lg active:rotate-180 group">
                        <ArrowRightLeft size={32} className="group-hover:scale-110 transition-transform" />
                    </button>
                    <span className="text-[10px] font-black uppercase text-muted tracking-widest">Cambiar Dirección</span>
                </div>
                <WarehouseBox type="destination" warehouse={destination} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Search and List */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-black uppercase text-muted tracking-widest flex items-center gap-2"><Plus size={14} className="text-primary"/> Cargar Productos</h3>
                            <span className="text-[9px] font-bold text-muted uppercase italic">Contexto Origen: <b className="text-primary">{origin}</b></span>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
                            <input 
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
                                            onClick={() => addItem(p)}
                                            className="w-full p-4 hover:bg-primary/5 text-left border-b border-surfaceHighlight last:border-none flex justify-between items-center group"
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-text uppercase group-hover:text-primary">{p.desart}</span>
                                                <span className="text-[9px] font-mono text-muted">#{p.codart}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-[10px] font-black uppercase ${origin === 'LLERENA' ? 'text-blue-500' : 'text-orange-500'}`}>Stock: {origin === 'LLERENA' ? p.stock_llerena : p.stock_betbeder}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mt-6 border border-surfaceHighlight rounded-2xl overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-background/50 text-[10px] text-muted uppercase font-black tracking-widest border-b border-surfaceHighlight">
                                    <tr>
                                        <th className="p-4">Artículo</th>
                                        <th className="p-4 text-center">Disponible</th>
                                        <th className="p-4 text-center">Transferir</th>
                                        <th className="p-4 text-center w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surfaceHighlight">
                                    {items.map(item => {
                                        const stock = origin === 'LLERENA' ? (item.product.stock_llerena || 0) : (item.product.stock_betbeder || 0);
                                        return (
                                            <tr key={item.product.codart} className="hover:bg-background/10 transition-colors">
                                                <td className="p-4">
                                                    <p className="text-xs font-black text-text uppercase leading-tight">{item.product.desart}</p>
                                                    <p className="text-[9px] font-mono text-muted mt-1">#{item.product.codart}</p>
                                                </td>
                                                <td className="p-4 text-center font-bold text-sm text-muted">{stock}</td>
                                                <td className="p-4 text-center">
                                                    <div className="flex items-center justify-center bg-background border border-surfaceHighlight rounded-xl overflow-hidden max-w-[120px] mx-auto">
                                                        <button onClick={() => updateQty(item.product.codart, item.quantity - 1)} className="p-2 text-muted hover:text-primary transition-colors">-</button>
                                                        <input 
                                                            type="number" 
                                                            value={item.quantity} 
                                                            onChange={e => updateQty(item.product.codart, parseInt(e.target.value)||0)}
                                                            className="w-12 bg-transparent text-center text-xs font-black text-text outline-none" 
                                                        />
                                                        <button onClick={() => updateQty(item.product.codart, item.quantity + 1)} className="p-2 text-muted hover:text-primary transition-colors">+</button>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <button onClick={() => removeItem(item.product.codart)} className="p-2 text-muted hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {items.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-[10px] text-muted font-bold uppercase italic">No has cargado artículos para transferir.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Summary Column */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm flex flex-col gap-6">
                        <h3 className="text-sm font-black text-text uppercase italic tracking-widest border-b border-surfaceHighlight pb-3">Resumen de Transferencia</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-xs font-bold uppercase">
                                <span className="text-muted">Origen:</span>
                                <span className={origin === 'LLERENA' ? 'text-blue-500' : 'text-orange-500'}>{origin}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-bold uppercase">
                                <span className="text-muted">Destino:</span>
                                <span className={destination === 'LLERENA' ? 'text-blue-500' : 'text-orange-500'}>{destination}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-bold uppercase">
                                <span className="text-muted">Total Ítems:</span>
                                <span className="text-text">{items.length}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-bold uppercase">
                                <span className="text-muted">Unidades Totales:</span>
                                <span className="text-text font-black">{items.reduce((s, i) => s + i.quantity, 0)}</span>
                            </div>
                        </div>

                        {success ? (
                            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex flex-col items-center gap-2 animate-in zoom-in-95">
                                <CheckCircle2 className="text-green-500" size={32} />
                                <p className="text-[10px] font-black text-green-600 uppercase">Transferencia Exitosa</p>
                                <p className="text-[12px] font-mono font-black text-text">{transferCode}</p>
                            </div>
                        ) : (
                            <button 
                                onClick={handleTransfer}
                                disabled={isSaving || items.length === 0}
                                className="w-full py-5 bg-primary hover:bg-primaryHover text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Confirmar Transferencia'}
                            </button>
                        )}
                    </div>

                    <div className="p-6 bg-primary/5 rounded-3xl border border-primary/20 flex gap-4">
                        <AlertCircle size={20} className="text-primary shrink-0" />
                        <p className="text-[9px] text-muted font-bold leading-relaxed uppercase">Esta operación genera dos movimientos simultáneos y actualiza ambos stocks maestros en una sola transacción atómica.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const WarehouseBox: React.FC<{ type: 'origin' | 'destination', warehouse: WarehouseCode }> = ({ type, warehouse }) => {
    const isLlerena = warehouse === 'LLERENA';
    return (
        <div className={`flex flex-col items-center p-8 rounded-3xl border-2 transition-all shadow-sm ${isLlerena ? 'bg-blue-500/5 border-blue-500/20' : 'bg-orange-500/5 border-orange-500/20'}`}>
            <span className="text-[10px] font-black uppercase text-muted tracking-widest mb-3 opacity-50">{type === 'origin' ? 'Desde' : 'Hacia'}</span>
            <Warehouse size={48} className={isLlerena ? 'text-blue-500' : 'text-orange-500'} />
            <h4 className={`text-2xl font-black mt-4 ${isLlerena ? 'text-blue-600' : 'text-orange-600'}`}>{warehouse}</h4>
        </div>
    );
};
