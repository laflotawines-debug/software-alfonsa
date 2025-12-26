
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, 
    Plus, 
    Trash2, 
    FileText, 
    MessageCircle, 
    ChevronDown, 
    Filter,
    ShoppingCart,
    Package,
    X,
    Minus,
    Loader2,
    RefreshCw,
    AlertTriangle,
    ChevronLeft
} from 'lucide-react';
import { supabase } from '../supabase';
import { MasterProduct } from '../types';
import { jsPDF } from 'jspdf';

interface CartItem {
    codart: string;
    qty: number;
}

export const Presupuestador: React.FC = () => {
    const [products, setProducts] = useState<MasterProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeList, setActiveList] = useState<number>(1);
    const [selectedFamily, setSelectedFamily] = useState<string>('TODAS');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [clientName, setClientName] = useState('');
    const [isCartOpenMobile, setIsCartOpenMobile] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const PAGE_SIZE = 1000;
            let allProducts: MasterProduct[] = [];
            let from = 0;

            while (true) {
                const { data, error } = await supabase
                    .from('master_products')
                    .select('*')
                    .gt('stock_llerena', 0) 
                    .order('desart', { ascending: true })
                    .range(from, from + PAGE_SIZE - 1);

                if (error) throw error;
                if (!data || data.length === 0) break;

                allProducts = [...allProducts, ...data];
                if (data.length < PAGE_SIZE) break;
                from += PAGE_SIZE;
            }
            setProducts(allProducts);
        } catch (err) {
            console.error("Error cargando productos:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const getProductPrice = (product: MasterProduct, list: number) => {
        switch (list) {
            case 1: return product.pventa_1;
            case 2: return product.pventa_2;
            case 3: return product.pventa_3;
            case 4: return product.pventa_4;
            default: return product.pventa_1;
        }
    };

    const families = useMemo(() => {
        const unique = Array.from(new Set(products.map(p => p.familia).filter(Boolean)));
        return ['TODAS', ...unique.sort()];
    }, [products]);

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.desart.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 p.codart.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesFamily = selectedFamily === 'TODAS' || p.familia === selectedFamily;
            return matchesSearch && matchesFamily;
        });
    }, [products, searchTerm, selectedFamily]);

    const addToCart = (codart: string, qty: number) => {
        const product = products.find(p => p.codart === codart);
        if (!product) return;

        const maxStock = product.stock_llerena || 0;

        setCart(prev => {
            const existing = prev.find(item => item.codart === codart);
            if (existing) {
                const newTotalQty = existing.qty + qty;
                const limitedQty = Math.min(newTotalQty, maxStock);
                if (newTotalQty > maxStock) {
                    alert(`Solo hay ${maxStock} unidades disponibles de ${product.desart}. Se ha ajustado al máximo.`);
                }
                return prev.map(item => item.codart === codart ? { ...item, qty: limitedQty } : item);
            }
            const safeQty = Math.min(qty, maxStock);
            return [...prev, { codart: codart, qty: safeQty }];
        });
    };

    const removeFromCart = (codart: string) => {
        setCart(prev => prev.filter(item => item.codart !== codart));
    };

    const updateCartQty = (codart: string, newQty: number) => {
        const product = products.find(p => p.codart === codart);
        if (!product) return;

        const maxStock = product.stock_llerena || 0;
        
        if (newQty <= 0) { removeFromCart(codart); return; }
        
        const safeQty = Math.min(newQty, maxStock);
        if (newQty > maxStock) {
            alert(`Stock insuficiente. El máximo disponible es ${maxStock}.`);
        }

        setCart(prev => prev.map(item => item.codart === codart ? { ...item, qty: safeQty } : item));
    };

    const cartDetails = useMemo(() => {
        return cart.map(item => {
            const product = products.find(p => p.codart === item.codart);
            if (!product) return null;
            const price = getProductPrice(product, activeList);
            return { ...product, qty: item.qty, price: price, subtotal: price * item.qty };
        }).filter(Boolean);
    }, [cart, products, activeList]);

    const totalBudget = cartDetails.reduce((acc, item) => acc + (item?.subtotal || 0), 0);

    const generatePDF = () => {
        if (cartDetails.length === 0) return;
        const doc = new jsPDF();
        doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(228, 124, 0);
        doc.text('ALFONSA - PRESUPUESTO', 20, 20);
        doc.setFontSize(10).setTextColor(100).setFont('helvetica', 'normal');
        doc.text(`Cliente: ${clientName || 'Consumidor Final'}`, 20, 30);
        doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 150, 30);
        let y = 50;
        doc.setFont('helvetica', 'bold').text('Artículo', 20, y);
        doc.text('Cant.', 120, y);
        doc.text('Precio', 150, y, { align: 'right' });
        doc.text('Subtotal', 190, y, { align: 'right' });
        y += 7;
        doc.setFont('helvetica', 'normal');
        cartDetails.forEach(item => {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.text(item!.desart.substring(0, 45), 20, y);
            doc.text(item!.qty.toString(), 120, y);
            doc.text(`$ ${item!.price.toLocaleString('es-AR')}`, 150, y, { align: 'right' });
            doc.text(`$ ${item!.subtotal.toLocaleString('es-AR')}`, 190, y, { align: 'right' });
            y += 7;
        });
        y += 10;
        doc.setFontSize(16).setFont('helvetica', 'bold').setTextColor(0);
        doc.text(`TOTAL: $ ${totalBudget.toLocaleString('es-AR')}`, 190, y, { align: 'right' });
        doc.save(`presupuesto_${Date.now()}.pdf`);
    };

    return (
        <div className="flex h-[calc(100vh-140px)] overflow-hidden -m-4 md:-m-8 relative">
            <div className="flex-1 flex flex-col bg-background overflow-hidden border-r border-surfaceHighlight">
                <div className="p-4 md:p-6 bg-surface border-b border-surfaceHighlight flex flex-col gap-4 shadow-sm z-10">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex bg-background p-1 rounded-xl border border-surfaceHighlight overflow-x-auto no-scrollbar shrink-0">
                            {[1, 2, 3, 4].map(num => (
                                <button key={num} onClick={() => setActiveList(num)} className={`px-4 md:px-5 py-2 rounded-lg text-[10px] md:text-xs font-black uppercase transition-all whitespace-nowrap ${activeList === num ? 'bg-surface text-primary shadow-sm border border-surfaceHighlight/50' : 'text-muted hover:text-text'}`}>Lista {num}</button>
                            ))}
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-2 flex-1 w-full">
                            <div className="relative flex-1 w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                                <input type="text" placeholder="Buscar artículo..." className="w-full bg-background border border-surfaceHighlight rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary shadow-inner" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            </div>
                            <div className="relative w-full sm:w-auto">
                                <select value={selectedFamily} onChange={(e) => setSelectedFamily(e.target.value)} className="w-full appearance-none bg-surface border border-surfaceHighlight rounded-xl py-2.5 pl-10 pr-10 text-sm font-bold text-muted focus:text-primary outline-none cursor-pointer transition-all sm:min-w-[160px]">
                                    {families.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                                <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] md:text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                            <Package size={12} className="text-primary" />
                            {filteredProducts.length} Artículos (DEP: LLERENA)
                        </span>
                        {isLoading && <Loader2 className="animate-spin text-primary" size={14} />}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-background/50">
                    {isLoading ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-50"><Loader2 className="animate-spin text-primary mb-2" size={32} /><p className="font-black text-[10px] uppercase tracking-widest">Sincronizando Stock Llerena...</p></div>
                    ) : filteredProducts.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredProducts.map((product) => (
                                <ProductCard 
                                    key={product.codart} 
                                    product={product} 
                                    activeList={activeList} 
                                    onAdd={addToCart} 
                                    getPrice={getProductPrice} 
                                    currentInCart={cart.find(c => c.codart === product.codart)?.qty || 0}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40"><AlertTriangle size={32} className="text-muted mb-4" /><p className="text-xs font-bold text-muted">Sin stock en Llerena para este filtro.</p></div>
                    )}
                </div>
            </div>

            <div className={`fixed inset-0 z-50 md:relative md:inset-auto md:flex md:w-[380px] lg:w-[420px] bg-surface flex flex-col shadow-2xl transition-transform duration-300 ${isCartOpenMobile ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
                <div className="p-4 md:p-6 border-b border-surfaceHighlight flex items-center justify-between bg-surface shrink-0">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsCartOpenMobile(false)} className="md:hidden p-2 -ml-2 text-muted"><ChevronLeft size={24} /></button>
                        <h3 className="text-lg md:text-xl font-black text-text uppercase italic">Presupuesto</h3>
                    </div>
                    <div className="px-3 py-1 bg-primary text-white rounded-full text-[10px] font-black uppercase">{cart.length}</div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40"><ShoppingCart size={32} className="text-muted mb-4" /><p className="text-xs font-bold text-muted uppercase">Vacío</p></div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {cartDetails.map((item) => item && (
                                <div key={item.codart} className="flex flex-col bg-background/50 border border-surfaceHighlight rounded-2xl p-4 gap-3">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <p className="text-[9px] font-black text-primary uppercase mb-1">{item.familia}</p>
                                            <h4 className="text-[11px] font-black text-text uppercase leading-tight">{item.desart}</h4>
                                        </div>
                                        <button onClick={() => removeFromCart(item.codart)} className="p-1.5 text-muted hover:text-red-500"><Trash2 size={14} /></button>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center bg-surface rounded-xl border border-surfaceHighlight overflow-hidden">
                                            <button onClick={() => updateCartQty(item.codart, item.qty - 1)} className="p-2 text-muted"><Minus size={12}/></button>
                                            <input 
                                                type="number" 
                                                value={item.qty} 
                                                max={item.stock_llerena}
                                                onChange={(e) => updateCartQty(item.codart, parseInt(e.target.value) || 0)} 
                                                className="w-10 bg-transparent text-center text-[11px] font-black outline-none" 
                                            />
                                            <button onClick={() => updateCartQty(item.codart, item.qty + 1)} className="p-2 text-muted"><Plus size={12}/></button>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-bold text-muted">$ {item.price.toLocaleString('es-AR')}</p>
                                            <p className="text-sm font-black text-text">$ {item.subtotal.toLocaleString('es-AR')}</p>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-[9px] font-bold text-muted italic">Máximo: {item.stock_llerena} unid.</span>
                                        {item.qty >= (item.stock_llerena || 0) && (
                                            <span className="text-[8px] font-black text-orange-500 uppercase tracking-widest">Límite alcanzado</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 md:p-6 bg-background/80 backdrop-blur border-t border-surfaceHighlight space-y-4 shrink-0">
                    <div className="flex justify-between items-end">
                        <span className="text-[10px] font-black text-muted uppercase">Total Estimado</span>
                        <span className="text-3xl font-black text-primary tracking-tighter">$ {totalBudget.toLocaleString('es-AR')}</span>
                    </div>
                    <input type="text" placeholder="Nombre Cliente..." className="w-full bg-surface border border-surfaceHighlight rounded-xl py-3 px-4 text-sm outline-none focus:border-primary font-bold shadow-sm" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={generatePDF} disabled={cart.length === 0} className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-slate-600 text-white font-black text-[11px] uppercase disabled:opacity-50"><FileText size={16} /> PDF</button>
                        <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(clientName)}`, '_blank')} disabled={cart.length === 0} className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-green-600 text-white font-black text-[11px] uppercase disabled:opacity-50"><MessageCircle size={16} /> WA</button>
                    </div>
                </div>
            </div>

            {cart.length > 0 && !isCartOpenMobile && (
                <button onClick={() => setIsCartOpenMobile(true)} className="md:hidden fixed bottom-6 right-6 w-16 h-16 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center z-40 animate-bounce"><ShoppingCart size={24} /></button>
            )}
        </div>
    );
};

const ProductCard: React.FC<{ 
    product: MasterProduct; 
    activeList: number; 
    onAdd: (codart: string, qty: number) => void;
    getPrice: (p: MasterProduct, l: number) => number;
    currentInCart: number;
}> = ({ product, activeList, onAdd, getPrice, currentInCart }) => {
    const [qty, setQty] = useState(1);
    const stock = product.stock_llerena || 0;
    const currentPrice = getPrice(product, activeList);
    const availableToOrder = Math.max(0, stock - currentInCart);

    return (
        <div className={`bg-surface border border-surfaceHighlight rounded-2xl p-4 flex flex-col gap-3 hover:shadow-lg transition-all group relative overflow-hidden ${availableToOrder <= 0 ? 'opacity-70' : ''}`}>
            {/* Header: Stock y Familia */}
            <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[9px] font-black text-primary uppercase truncate flex-1">
                    {product.familia || 'Sin Familia'}
                </span>
                <span className={`px-2 py-0.5 rounded text-[8px] font-black border shrink-0 ${availableToOrder <= 0 ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'}`}>
                    {stock} LLERENA
                </span>
            </div>
            
            {/* Cuerpo: Nombre y Código */}
            <div className="flex-1">
                <h4 className="text-xs font-black text-text leading-tight uppercase min-h-[32px] line-clamp-2">
                    {product.desart}
                </h4>
                <p className="text-[9px] font-mono text-muted mt-1 opacity-50">#{product.codart}</p>
            </div>

            {/* Precio */}
            <div className="flex flex-col items-end">
                <span className="text-[8px] font-black text-muted uppercase tracking-wider">Precio Lista {activeList}</span>
                <div className="flex items-baseline gap-1">
                    <span className="text-[10px] font-black text-muted">$</span>
                    <span className="text-2xl font-black text-primary tracking-tighter">{currentPrice.toLocaleString('es-AR')}</span>
                </div>
            </div>

            {/* Controles de Cantidad */}
            <div className="flex gap-2 pt-1">
                <input 
                    type="number" 
                    value={qty} 
                    min={1} 
                    max={availableToOrder}
                    disabled={availableToOrder <= 0}
                    onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setQty(Math.min(val, availableToOrder));
                    }} 
                    className="w-16 bg-background border border-surfaceHighlight rounded-xl py-2.5 text-center text-xs font-black outline-none focus:border-primary shadow-inner disabled:cursor-not-allowed" 
                />
                <button 
                    onClick={() => { 
                        if (qty > 0 && availableToOrder > 0) { 
                            onAdd(product.codart, qty); 
                            setQty(1); 
                        } 
                    }} 
                    disabled={availableToOrder <= 0}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all active:scale-95 disabled:bg-muted disabled:cursor-not-allowed ${availableToOrder <= 0 ? 'text-muted' : 'bg-primary text-white'}`}
                >
                    <Plus size={14} /> 
                    {availableToOrder <= 0 ? 'Sin Stock' : 'Agregar'}
                </button>
            </div>
            {availableToOrder > 0 && availableToOrder < stock && (
                <p className="text-[9px] text-muted text-center font-bold">Quedan {availableToOrder} disponibles</p>
            )}
        </div>
    );
};
