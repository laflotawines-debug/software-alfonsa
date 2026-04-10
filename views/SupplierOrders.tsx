
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Truck, 
    Plus, 
    Search, 
    Trash2, 
    Loader2, 
    CheckCircle2, 
    AlertCircle, 
    ChevronDown, 
    ChevronRight, 
    Calendar, 
    FileText, 
    Package, 
    X, 
    Building2, 
    Save, 
    Clock, 
    RefreshCw,
    Info,
    Upload,
    FileUp,
    ExternalLink,
    Paperclip,
    XCircle,
    Sparkles,
    Calculator,
    PackagePlus,
    Boxes,
    Copy
} from 'lucide-react';
import { supabase } from '../supabase';
import { SupplierOrder, SupplierOrderItem, User, SupplierMaster, MasterProduct } from '../types';
import { ProductDetailModal } from '../components/ProductDetailModal';

interface SupplierOrdersProps {
    currentUser: User;
}

export const SupplierOrders: React.FC<SupplierOrdersProps> = ({ currentUser }) => {
    const [tab, setTab] = useState<'pendiente' | 'enviado' | 'confirmado'>('pendiente');
    const [orders, setOrders] = useState<SupplierOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<SupplierOrder | null>(null);
    const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
    
    // Estado para manejar la confirmación de borrado local en cada tarjeta
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('supplier_orders')
                .select('*, supplier_order_items(*, master_products(desart, units_per_box))')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            if (data) {
                const mapped = data.map((o: any) => ({
                    ...o,
                    items: (o.supplier_order_items || []).map((i: any) => ({
                        ...i,
                        desart: i.master_products?.desart || 'Artículo no encontrado',
                        units_per_box: i.master_products?.units_per_box || 6
                    }))
                }));
                setOrders(mapped);
                
                if (searchTerm.length === 0 && mapped.length > 0 && expandedProviders.size === 0) {
                    const firstProvider = mapped[0].supplier_code;
                    setExpandedProviders(new Set([firstProvider]));
                }
            }
        } catch (e: any) { 
            console.error("Error al obtener pedidos:", e.message); 
            const { data } = await supabase.from('supplier_orders').select('*, supplier_order_items(*)').order('created_at', { ascending: false });
            if (data) setOrders(data as any);
        } finally { 
            setIsLoading(false); 
        }
    };

    useEffect(() => { fetchOrders(); }, []);

    const filteredOrders = useMemo(() => {
        const keywords = searchTerm.toLowerCase().split(/\s+/).filter(k => k.length > 0);
        return orders.filter(o => {
            if (o.status !== tab) return false;
            const textToSearch = `${o.supplier_name} ${o.id}`.toLowerCase();
            return keywords.every(k => textToSearch.includes(k));
        });
    }, [orders, tab, searchTerm]);

    const groupedOrders = useMemo(() => {
        const groups: Record<string, { name: string, items: SupplierOrder[] }> = {};
        filteredOrders.forEach(o => {
            const code = o.supplier_code;
            if (!groups[code]) groups[code] = { name: o.supplier_name || code, items: [] };
            groups[code].items.push(o);
        });
        return Object.entries(groups).sort((a, b) => a[1].name.localeCompare(b[1].name));
    }, [filteredOrders]);

    const handleMarkAsRequested = async (orderId: string) => {
        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('supplier_orders')
                .update({ status: 'enviado' })
                .eq('id', orderId);
            if (error) throw error;
            await fetchOrders();
        } catch (e: any) { alert(e.message); } finally { setIsLoading(false); }
    };

    const handleConfirmArrival = async (orderId: string) => {
        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('supplier_orders')
                .update({ status: 'confirmado' })
                .eq('id', orderId);
            if (error) throw error;
            await fetchOrders();
        } catch (e: any) { alert(e.message); } finally { setIsLoading(false); }
    };

    const handleDeleteOrder = async (orderId: string) => {
        const order = orders.find(o => o.id === orderId);
        setIsLoading(true);
        try {
            // 1. Borrar PDF del storage si existe
            if (order?.pdf_url) {
                const urlParts = order.pdf_url.split('/');
                const filePath = urlParts[urlParts.length - 1];
                if (filePath) {
                    await supabase.storage.from('supplier-orders').remove([filePath]);
                }
            }
            
            // 2. Borrar de la base de datos (items se borran por CASCADE)
            const { error } = await supabase.from('supplier_orders').delete().eq('id', orderId);
            if (error) throw error;
            
            // 3. Limpiar estado y refrescar
            setDeletingId(null);
            await fetchOrders();
        } catch (e: any) { 
            alert("Error al eliminar: " + e.message); 
        } finally { 
            setIsLoading(false); 
        }
    };

    const toggleProvider = (code: string) => {
        const next = new Set(expandedProviders);
        if (next.has(code)) next.delete(code); else next.add(code);
        setExpandedProviders(next);
    };

    return (
        <div className="flex flex-col gap-6 pb-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight flex items-center gap-3 uppercase italic">
                        <Truck className="text-primary" size={32} />
                        Pedidos a Proveedores
                    </h2>
                    <p className="text-muted text-sm mt-1 font-medium flex items-center gap-2">
                        <Info size={14} className="text-primary" />
                        Registro organizativo para <span className="font-bold text-primary uppercase">Llerena</span>. <span className="font-bold text-orange-500">No afecta el stock real.</span>
                    </p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button 
                        onClick={fetchOrders}
                        className="p-4 rounded-2xl bg-surface border border-surfaceHighlight text-muted hover:text-primary transition-all shadow-sm"
                    >
                        <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button 
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex-1 md:flex-none bg-primary hover:bg-primaryHover text-white px-8 py-4 rounded-2xl font-black text-sm uppercase transition-all shadow-xl shadow-primary/20 active:scale-95 flex items-center gap-2"
                    >
                        <Plus size={20} /> Nuevo Pedido
                    </button>
                </div>
            </div>

            {/* Tabs & Search */}
            <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-surface p-2 rounded-2xl border border-surfaceHighlight shadow-sm">
                <div className="flex gap-1 w-full lg:w-auto">
                    {[
                        { id: 'pendiente', label: 'Borradores', icon: <Clock size={16}/> },
                        { id: 'enviado', label: 'Solicitados', icon: <PackagePlus size={16}/> },
                        { id: 'confirmado', label: 'Confirmados', icon: <CheckCircle2 size={16}/> }
                    ].map(t => (
                        <button 
                            key={t.id}
                            onClick={() => { setTab(t.id as any); setDeletingId(null); }}
                            className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase transition-all ${tab === t.id ? 'bg-primary text-white shadow-lg' : 'text-muted hover:bg-surfaceHighlight'}`}
                        >
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>
                <div className="relative w-full lg:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar por proveedor..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase"
                    />
                </div>
            </div>

            {/* List Content */}
            <div className="flex flex-col gap-4">
                {isLoading && orders.length === 0 ? (
                    <div className="py-24 flex justify-center"><Loader2 size={48} className="animate-spin text-primary" /></div>
                ) : groupedOrders.length === 0 ? (
                    <div className="py-24 text-center border-2 border-dashed border-surfaceHighlight rounded-3xl bg-surface/30 opacity-50">
                        <Truck size={48} className="mx-auto mb-4 text-muted" />
                        <p className="font-black uppercase tracking-widest text-muted italic">No hay pedidos {tab}s.</p>
                    </div>
                ) : groupedOrders.map(([code, group]) => {
                    const isExpanded = expandedProviders.has(code);
                    return (
                        <div key={code} className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm transition-all duration-300">
                            <button 
                                onClick={() => toggleProvider(code)}
                                className="w-full p-6 flex items-center justify-between hover:bg-primary/5 transition-colors text-left group"
                            >
                                <div className="flex items-center gap-5">
                                    <div className="h-12 w-12 rounded-2xl bg-background border border-surfaceHighlight flex items-center justify-center text-primary group-hover:border-primary/30 transition-colors shadow-inner">
                                        <Building2 size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-text uppercase italic leading-tight group-hover:text-primary transition-colors">{group.name}</h3>
                                        <p className="text-[10px] font-black text-muted uppercase tracking-widest mt-1">
                                            {group.items.length} Pedido(s) registrado(s)
                                        </p>
                                    </div>
                                </div>
                                {isExpanded ? <ChevronDown className="text-muted" /> : <ChevronRight className="text-muted" />}
                            </button>

                            {isExpanded && (
                                <div className="p-4 bg-background/20 border-t border-surfaceHighlight space-y-3 animate-in slide-in-from-top-2">
                                    {group.items.map(order => (
                                        <div key={order.id} className="bg-surface border border-surfaceHighlight rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 hover:border-primary/30 transition-all shadow-sm">
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">#{order.id.substring(0,6).toUpperCase()}</span>
                                                    <div className="flex items-center gap-2 text-text font-black uppercase text-sm">
                                                        <Calendar size={14} className="text-primary" />
                                                        Est: {new Date(order.estimated_arrival).toLocaleDateString()}
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="text-[10px] font-bold text-muted uppercase flex items-center gap-1">
                                                        <Package size={12} /> {order.items?.length || 0} Artículos
                                                    </span>
                                                    {order.pdf_url && (
                                                        <a href={order.pdf_url} target="_blank" rel="noreferrer" className="text-[10px] font-black text-blue-500 hover:underline flex items-center gap-1 bg-blue-500/5 px-2 py-0.5 rounded border border-blue-500/20">
                                                            <FileText size={12} /> Ver PDF Adjunto
                                                        </a>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex gap-2 w-full md:w-auto">
                                                {/* Botón de Detalle */}
                                                <button 
                                                    onClick={() => setSelectedOrder(order)}
                                                    className="flex-1 md:flex-none px-4 py-2.5 rounded-xl border border-surfaceHighlight text-text hover:bg-surfaceHighlight font-black text-[10px] uppercase transition-all"
                                                >
                                                    Ver Detalle
                                                </button>

                                                {/* Botón de Acción Principal */}
                                                {tab === 'pendiente' && (
                                                    <button 
                                                        onClick={() => handleMarkAsRequested(order.id)}
                                                        className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-black text-[10px] uppercase shadow-lg shadow-blue-900/20 transition-all active:scale-95"
                                                    >
                                                        Pedido Solicitado
                                                    </button>
                                                )}
                                                {tab === 'enviado' && (
                                                    <button 
                                                        onClick={() => handleConfirmArrival(order.id)}
                                                        className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-green-600 text-white hover:bg-green-700 font-black text-[10px] uppercase shadow-lg shadow-green-900/20 transition-all active:scale-95"
                                                    >
                                                        Confirmar Llegada
                                                    </button>
                                                )}

                                                {/* Botón de Eliminar (En ambos pero con confirmación visual) */}
                                                {deletingId === order.id ? (
                                                    <div className="flex gap-1 animate-in zoom-in-95">
                                                        <button 
                                                            onClick={() => handleDeleteOrder(order.id)}
                                                            className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-black text-[10px] uppercase shadow-lg transition-all active:scale-95"
                                                        >
                                                            ¿Borrar?
                                                        </button>
                                                        <button 
                                                            onClick={() => setDeletingId(null)}
                                                            className="p-2.5 rounded-xl bg-surfaceHighlight text-text"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={() => setDeletingId(order.id)}
                                                        className="flex-1 md:flex-none p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                                        title="Eliminar registro"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Create Order Modal */}
            {isCreateModalOpen && (
                <CreateSupplierOrderModal 
                    onClose={() => setIsCreateModalOpen(false)}
                    onSuccess={() => { setIsCreateModalOpen(false); fetchOrders(); }}
                    currentUser={currentUser}
                />
            )}

            {/* Detail Modal */}
            {selectedOrder && (
                <SupplierOrderDetailModal 
                    order={selectedOrder}
                    onClose={() => setSelectedOrder(null)}
                    onUpdate={() => { setSelectedOrder(null); fetchOrders(); }}
                    tab={tab}
                />
            )}
        </div>
    );
};

// --- MODAL DE CREACIÓN OPTIMIZADO PARA TECLADO ---
const CreateSupplierOrderModal: React.FC<{ onClose: () => void, onSuccess: () => void, currentUser: User }> = ({ onClose, onSuccess, currentUser }) => {
    const [suppliers, setSuppliers] = useState<SupplierMaster[]>([]);
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [arrivalDate, setArrivalDate] = useState('');
    const [items, setItems] = useState<{codart: string, desart: string, qty: number, boxes: number, units_per_box: number}[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [searchProd, setSearchProd] = useState('');
    const [searchResults, setSearchResults] = useState<MasterProduct[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0); // Cursor para flechas
    
    // Estado para la calculadora de bultos
    const [activeProduct, setActiveProduct] = useState<MasterProduct | null>(null);
    const [tempBoxes, setTempBoxes] = useState<string>('1');
    const [tempUnitsPerBox, setTempUnitsPerBox] = useState<string>('');

    // Refs para control de foco
    const searchInputRef = useRef<HTMLInputElement>(null);
    const boxesInputRef = useRef<HTMLInputElement>(null);

    // Estado para el PDF
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
    const supplierInputRef = useRef<HTMLDivElement>(null);
    const [isCreatingProduct, setIsCreatingProduct] = useState(false);

    useEffect(() => {
        supabase.from('providers_master').select('*').eq('activo', true).order('razon_social').then(res => res.data && setSuppliers(res.data));
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (supplierInputRef.current && !supplierInputRef.current.contains(event.target as Node)) {
                setShowSupplierDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectSupplier = (supplier: SupplierMaster) => {
        setSelectedSupplier(supplier.codigo);
        setSupplierSearchTerm(supplier.razon_social);
        setShowSupplierDropdown(false);
    };

    const filteredSuppliers = useMemo(() => {
        if (!supplierSearchTerm) return suppliers;
        const terms = supplierSearchTerm.toLowerCase().split(/\s+/).filter(t => t.length > 0);
        return suppliers.filter(s => {
            const text = `${s.razon_social} ${s.codigo}`.toLowerCase();
            return terms.every(term => text.includes(term));
        });
    }, [suppliers, supplierSearchTerm]);

    const handleSearchProd = async (val: string) => {
        setSearchProd(val);
        const trimmed = val.trim();
        if (trimmed.length < 2) { 
            setSearchResults([]); 
            setIsSearching(false);
            setSelectedIndex(0);
            return; 
        }
        
        setIsSearching(true);
        try {
            const tokens = trimmed.split(/\s+/).filter(t => t.length > 0);
            let query = supabase.from('master_products').select('codart, desart, units_per_box, stock_llerena, stock_ideal').neq('familia', 'ELIMINADOS');
            tokens.forEach(token => {
                query = query.ilike('desart', `%${token}%`);
            });
            const { data, error } = await query.limit(10);
            if (error) throw error;
            setSearchResults(data || []);
            setSelectedIndex(0);
        } catch (e) {
            console.error("Error en búsqueda:", e);
        } finally {
            setIsSearching(false);
        }
    };

    // Navegación por teclado en la lista de búsqueda
    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (searchResults.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % searchResults.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                handleSelectFromSearch(searchResults[selectedIndex]);
            }
        }
    };

    // Al seleccionar un producto, mostramos el mini-panel de calculadora
    const handleSelectFromSearch = (p: MasterProduct) => {
        setActiveProduct(p);
        setTempBoxes('1');
        setTempUnitsPerBox(String(p.units_per_box || 6));
        setSearchResults([]);
        setSearchProd('');
        
        // Pequeño timeout para asegurar que el input se renderizó
        setTimeout(() => {
            boxesInputRef.current?.focus();
            boxesInputRef.current?.select();
        }, 10);
    };

    const addItem = () => {
        if (!activeProduct) return;
        const b = parseInt(tempBoxes) || 0;
        const u = parseInt(tempUnitsPerBox) || 0;

        if (b <= 0 && u <= 0) {
            alert("Ingrese una cantidad válida.");
            return;
        }

        const totalQty = b * u;

        const existing = items.find(i => i.codart === activeProduct.codart);
        if (existing) {
            setItems(items.map(i => i.codart === activeProduct.codart ? {
                ...i,
                boxes: i.boxes + b,
                qty: i.qty + totalQty
            } : i));
        } else {
            setItems([...items, { 
                codart: activeProduct.codart, 
                desart: activeProduct.desart, 
                qty: totalQty,
                boxes: b,
                units_per_box: u
            }]);
        }
        
        setActiveProduct(null);
        // Volver el foco a la búsqueda para el siguiente producto
        setTimeout(() => {
            searchInputRef.current?.focus();
        }, 10);
    };

    const handleCalculatorKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addItem();
        } else if (e.key === 'Escape') {
            setActiveProduct(null);
            searchInputRef.current?.focus();
        }
    };

    const handleSave = async () => {
        if (!selectedSupplier || !arrivalDate || items.length === 0) return alert("Complete los datos obligatorios.");
        setIsSaving(true);
        try {
            const supplier = suppliers.find(s => s.codigo === selectedSupplier);
            let finalPdfUrl = null;

            if (pdfFile) {
                const fileExt = pdfFile.name.split('.').pop();
                const fileName = `${Date.now()}_${selectedSupplier}.${fileExt}`;
                const { data: uploadData, error: uploadErr } = await supabase.storage
                    .from('supplier-orders')
                    .upload(fileName, pdfFile);
                
                if (uploadErr) throw uploadErr;
                const { data: { publicUrl } } = supabase.storage.from('supplier-orders').getPublicUrl(fileName);
                finalPdfUrl = publicUrl;
            }
            
            const { data: order, error: orderErr } = await supabase.from('supplier_orders').insert({
                supplier_code: selectedSupplier,
                supplier_name: supplier?.razon_social,
                estimated_arrival: arrivalDate,
                status: 'pendiente',
                pdf_url: finalPdfUrl,
                created_by: currentUser.id
            }).select().single();

            if (orderErr) throw orderErr;

            const { error: itemsErr } = await supabase.from('supplier_order_items').insert(
                items.map(i => ({ 
                    order_id: order.id, 
                    codart: i.codart, 
                    quantity: i.qty 
                }))
            );

            if (itemsErr) throw itemsErr;
            onSuccess();
        } catch (e: any) { 
            alert("Error al guardar: " + e.message); 
        } finally { 
            setIsSaving(false); 
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-background w-full max-w-5xl rounded-3xl border border-surfaceHighlight shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
                <div className="p-6 border-b border-surfaceHighlight bg-surface flex justify-between items-center">
                    <h3 className="text-xl font-black text-text uppercase italic">Registrar Pedido a Proveedor</h3>
                    <button onClick={onClose} className="p-2 hover:bg-surfaceHighlight rounded-full text-muted transition-all"><X size={24}/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        
                        {/* BUSCADOR DE ARTÍCULOS - CONTROLADO POR TECLADO */}
                        <div className="space-y-2 relative">
                            <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1 flex items-center gap-2">
                                <Sparkles size={12}/> Buscar Artículo para Agregar
                            </label>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                                <input 
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchProd}
                                    onChange={e => handleSearchProd(e.target.value)}
                                    onKeyDown={handleSearchKeyDown}
                                    placeholder="Escribe para buscar... Ej: 'fer bran'"
                                    className="w-full bg-surface border border-surfaceHighlight rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase transition-all"
                                />
                                {isSearching && <div className="absolute right-4 top-1/2 -translate-y-1/2"><Loader2 size={16} className="animate-spin text-primary"/></div>}
                            </div>
                            {searchResults.length > 0 && (
                                <div className="absolute top-full left-0 w-full bg-surface border border-primary/30 rounded-2xl shadow-2xl mt-1 z-50 overflow-hidden">
                                    {searchResults.map((p, idx) => {
                                        const suggested = (p.stock_ideal || 0) - (p.stock_llerena || 0);
                                        return (
                                        <button 
                                            key={p.codart} 
                                            onClick={() => handleSelectFromSearch(p)} 
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                            className={`w-full p-4 text-left border-b border-surfaceHighlight last:border-none flex justify-between items-center group transition-colors ${selectedIndex === idx ? 'bg-primary/10' : 'hover:bg-primary/5'}`}
                                        >
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-xs font-black uppercase ${selectedIndex === idx ? 'text-primary' : 'text-text'}`}>{p.desart}</span>
                                                    {suggested > 0 && (
                                                        <span className="text-[9px] font-black text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded uppercase whitespace-nowrap">Sug: {suggested} un.</span>
                                                    )}
                                                    <span className="text-[9px] font-black text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded uppercase whitespace-nowrap">Sto: {p.stock_llerena || 0} un.</span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[9px] font-mono text-muted">#{p.codart}</span>
                                                    <span className="text-[9px] font-bold text-primary/60 uppercase italic">Empaque: {p.units_per_box || 6} un.</span>
                                                </div>
                                            </div>
                                            {selectedIndex === idx && <Plus size={14} className="text-primary animate-in zoom-in shrink-0" />}
                                        </button>
                                    )})}
                                </div>
                            )}
                        </div>

                        {/* MINI PANEL CALCULADORA - INTEGRACIÓN TECLADO */}
                        {activeProduct && (
                            <div className="p-6 bg-primary/5 border border-primary/20 rounded-3xl space-y-4 animate-in zoom-in-95">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-black text-primary uppercase text-sm leading-tight flex-1 pr-4">{activeProduct.desart}</h4>
                                    <button onClick={() => setActiveProduct(null)} className="p-1 text-muted hover:text-red-500"><X size={18}/></button>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-muted uppercase ml-1">Cant. Cajas (Enter para agregar)</label>
                                        <div className="relative">
                                            <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40" size={14} />
                                            <input 
                                                ref={boxesInputRef}
                                                type="number" 
                                                value={tempBoxes} 
                                                onChange={e => setTempBoxes(e.target.value)} 
                                                onKeyDown={handleCalculatorKeyDown}
                                                className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 pl-10 text-center font-black outline-none focus:border-primary shadow-sm" 
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-muted uppercase ml-1">Unidades x Caja</label>
                                        <input 
                                            type="number" 
                                            value={tempUnitsPerBox} 
                                            onChange={e => setTempUnitsPerBox(e.target.value)} 
                                            onKeyDown={handleCalculatorKeyDown}
                                            className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-center font-black text-muted outline-none focus:border-primary shadow-sm" 
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-primary/10">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-muted uppercase tracking-widest">Total a pedir</span>
                                        <span className="text-xl font-black text-text">
                                            {(parseInt(tempBoxes)||0) * (parseInt(tempUnitsPerBox)||0)} <small className="text-[10px] text-muted">unidades</small>
                                        </span>
                                    </div>
                                    <button 
                                        onClick={addItem} 
                                        className="bg-primary hover:bg-primaryHover text-white px-6 py-3 rounded-xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all flex items-center gap-2"
                                    >
                                        <PackagePlus size={16} /> Agregar al Pedido
                                    </button>
                                </div>
                                <p className="text-[8px] font-black text-muted text-center uppercase tracking-widest">ESC para cancelar • ENTER para confirmar</p>
                            </div>
                        )}

                        <div className="h-px bg-surfaceHighlight/50"></div>

                        <div className="space-y-2 relative" ref={supplierInputRef}>
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Proveedor</label>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                                <input 
                                    type="text"
                                    value={supplierSearchTerm}
                                    onChange={e => {
                                        setSupplierSearchTerm(e.target.value);
                                        setSelectedSupplier('');
                                        setShowSupplierDropdown(true);
                                    }}
                                    onFocus={() => setShowSupplierDropdown(true)}
                                    placeholder="Buscar proveedor..."
                                    className="w-full bg-surface border border-surfaceHighlight rounded-2xl py-4 pl-12 pr-10 font-black text-text outline-none focus:border-primary shadow-inner uppercase"
                                />
                                {selectedSupplier && (
                                    <button 
                                        onClick={() => {
                                            setSelectedSupplier('');
                                            setSupplierSearchTerm('');
                                            setShowSupplierDropdown(true);
                                        }}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-red-500"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                            
                            {showSupplierDropdown && (supplierSearchTerm || filteredSuppliers.length > 0) && (
                                <div className="absolute top-full left-0 w-full bg-surface border border-surfaceHighlight rounded-2xl shadow-2xl mt-1 z-50 max-h-60 overflow-y-auto">
                                    {filteredSuppliers.length > 0 ? (
                                        filteredSuppliers.map(s => (
                                            <button
                                                key={s.codigo}
                                                onClick={() => handleSelectSupplier(s)}
                                                className="w-full text-left px-5 py-3 hover:bg-surfaceHighlight border-b border-surfaceHighlight last:border-none transition-colors"
                                            >
                                                <p className="text-xs font-black text-text uppercase">{s.razon_social}</p>
                                                <p className="text-[9px] font-mono text-muted">#{s.codigo}</p>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center text-muted text-xs italic uppercase">
                                            No se encontraron proveedores
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Fecha Estimada de Llegada</label>
                            <input 
                                type="date"
                                value={arrivalDate}
                                onChange={e => setArrivalDate(e.target.value)}
                                className="w-full bg-surface border border-surfaceHighlight rounded-2xl py-4 px-5 font-black text-text outline-none focus:border-primary shadow-inner"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Comprobante PDF (Opcional)</label>
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className={`group relative border-2 border-dashed rounded-2xl p-6 transition-all flex flex-col items-center justify-center gap-3 cursor-pointer
                                    ${pdfFile ? 'border-blue-500 bg-blue-500/5' : 'border-surfaceHighlight hover:border-primary/50 bg-background/50'}`}
                            >
                                {pdfFile ? (
                                    <>
                                        <div className="h-10 w-10 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg"><FileText size={20}/></div>
                                        <div className="text-center">
                                            <p className="text-xs font-black text-blue-600 uppercase truncate max-w-[200px]">{pdfFile.name}</p>
                                            <button onClick={(e) => { e.stopPropagation(); setPdfFile(null); }} className="text-[9px] font-black text-red-500 uppercase mt-1 hover:underline">Quitar archivo</button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <FileUp size={32} className="text-muted group-hover:text-primary transition-colors" />
                                        <p className="text-[10px] font-black text-muted uppercase tracking-tighter">Adjuntar PDF de Orden de Compra</p>
                                    </>
                                )}
                                <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} />
                            </div>
                        </div>
                    </div>

                    {/* LISTA DE ITEMS CARGADOS */}
                    <div className="bg-surface/50 border border-surfaceHighlight rounded-3xl p-6 flex flex-col h-full min-h-[350px]">
                        <div className="flex items-center justify-between mb-4 border-b border-surfaceHighlight pb-2">
                            <h4 className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                               <Boxes size={14} className="text-primary" /> Artículos en el Pedido ({items.length})
                            </h4>
                            <button 
                                onClick={() => setIsCreatingProduct(true)}
                                className="bg-orange-500 hover:bg-orange-600 text-white p-1.5 rounded-lg transition-colors shadow-sm active:scale-95"
                                title="Crear Nuevo Artículo"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                            {items.map((item, idx) => (
                                <div key={idx} className="bg-background border border-surfaceHighlight rounded-xl p-4 flex justify-between items-center group animate-in slide-in-from-right-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-black text-text uppercase truncate">{item.desart}</p>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[9px] font-mono text-muted bg-surfaceHighlight/50 px-1.5 py-0.5 rounded">#{item.codart}</span>
                                            <span className="text-[10px] font-black text-primary uppercase italic">
                                                {item.boxes}x{item.units_per_box} — <span className="text-text">{item.qty} unidades</span>
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 ml-4">
                                        <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="p-2 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            ))}
                            {items.length === 0 && <div className="h-full flex flex-col items-center justify-center text-muted opacity-40"><Package size={40} /><p className="text-[10px] font-bold uppercase mt-2">Lista vacía</p></div>}
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-surface border-t border-surfaceHighlight flex gap-4">
                    <button onClick={onClose} className="flex-1 py-4 font-black uppercase text-xs text-muted hover:bg-surfaceHighlight rounded-2xl border border-surfaceHighlight transition-all">Cancelar</button>
                    <button onClick={handleSave} disabled={isSaving || items.length === 0} className={`flex-[2] py-4 rounded-2xl font-black uppercase text-xs shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 ${isSaving || items.length === 0 ? 'bg-surfaceHighlight text-muted cursor-not-allowed' : 'bg-primary text-white hover:bg-primaryHover'}`}>
                        {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Guardar Pedido (F10)
                    </button>
                </div>

                {isCreatingProduct && (
                    <ProductDetailModal 
                        product={null} 
                        existingFamilies={[]}
                        existingSubfamilies={[]}
                        onClose={(created) => { 
                            setIsCreatingProduct(false);
                            // Si se creó, el usuario puede buscarlo inmediatamente
                        }} 
                        currentUser={currentUser}
                        masterSuppliers={suppliers}
                    />
                )}
            </div>
        </div>
    );
};

// --- MODAL DE DETALLE ---
const SupplierOrderDetailModal: React.FC<{ order: SupplierOrder, onClose: () => void, onUpdate: () => void, tab: 'pendiente' | 'enviado' | 'confirmado' }> = ({ order, onClose, onUpdate, tab }) => {
    const [items, setItems] = useState<SupplierOrderItem[]>(order.items || []);
    const [hasChanges, setHasChanges] = useState(false);
    const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [currentPdfUrl, setCurrentPdfUrl] = useState(order.pdf_url);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [searchProd, setSearchProd] = useState('');
    const [searchResults, setSearchResults] = useState<MasterProduct[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [activeProduct, setActiveProduct] = useState<MasterProduct | null>(null);
    const [tempBoxes, setTempBoxes] = useState<string>('1');
    const [tempUnitsPerBox, setTempUnitsPerBox] = useState<string>('');
    const searchInputRef = useRef<HTMLInputElement>(null);
    const boxesInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (order.items) setItems(order.items);
        setCurrentPdfUrl(order.pdf_url);
    }, [order]);

    const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${order.supplier_code}.${fileExt}`;
            const { data: uploadData, error: uploadErr } = await supabase.storage
                .from('supplier-orders')
                .upload(fileName, file);
            
            if (uploadErr) throw uploadErr;
            const { data: { publicUrl } } = supabase.storage.from('supplier-orders').getPublicUrl(fileName);
            
            const newUrls = currentPdfUrl ? currentPdfUrl.split(',').filter(Boolean) : [];
            newUrls.push(publicUrl);
            const newPdfUrl = newUrls.join(',');

            const { error: updateErr } = await supabase
                .from('supplier_orders')
                .update({ pdf_url: newPdfUrl })
                .eq('id', order.id);
            
            if (updateErr) throw updateErr;
            
            setCurrentPdfUrl(newPdfUrl);
            setHasChanges(true);
        } catch (e: any) {
            alert("Error al subir PDF: " + e.message);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeletePdf = async (urlToDelete: string) => {
        setIsUploading(true);
        try {
            const newUrls = currentPdfUrl ? currentPdfUrl.split(',').filter(Boolean).filter(u => u !== urlToDelete) : [];
            const newPdfUrl = newUrls.join(',');

            const { error: updateErr } = await supabase
                .from('supplier_orders')
                .update({ pdf_url: newPdfUrl })
                .eq('id', order.id);
            
            if (updateErr) throw updateErr;
            setCurrentPdfUrl(newPdfUrl);
            setHasChanges(true);
        } catch (e: any) {
            alert("Error al eliminar PDF: " + e.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleUpdateQty = async (itemId: string, val: string) => {
        const newQty = val === '' ? 0 : parseInt(val);
        if (val !== '' && isNaN(newQty)) return;
        
        setItems(items.map(i => i.id === itemId ? {...i, quantity: newQty} : i));
        setHasChanges(true);

        if (newQty > 0) {
            try {
                const { error } = await supabase.from('supplier_order_items').update({ quantity: newQty }).eq('id', itemId);
                if (error) throw error;
            } catch (e: any) { alert(e.message); }
        }
    };

    const handleRemoveItem = async (itemId: string) => {
        try {
            const { error } = await supabase.from('supplier_order_items').delete().eq('id', itemId);
            if (error) throw error;
            setItems(items.filter(i => i.id !== itemId));
            setHasChanges(true);
            setDeletingItemId(null);
        } catch (e: any) { alert(e.message); }
    };

    const handleSearchProd = async (val: string) => {
        setSearchProd(val);
        const trimmed = val.trim();
        if (trimmed.length < 2) { 
            setSearchResults([]); 
            setIsSearching(false);
            setSelectedIndex(0);
            return; 
        }
        
        setIsSearching(true);
        try {
            const tokens = trimmed.split(/\s+/).filter(t => t.length > 0);
            let query = supabase.from('master_products').select('codart, desart, units_per_box, stock_llerena, stock_ideal').neq('familia', 'ELIMINADOS');
            tokens.forEach(token => {
                query = query.ilike('desart', `%${token}%`);
            });
            const { data, error } = await query.limit(10);
            if (error) throw error;
            setSearchResults(data || []);
            setSelectedIndex(0);
        } catch (e) {
            console.error("Error en búsqueda:", e);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (searchResults.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % searchResults.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                handleSelectFromSearch(searchResults[selectedIndex]);
            }
        }
    };

    const handleSelectFromSearch = (p: MasterProduct) => {
        setActiveProduct(p);
        setTempBoxes('1');
        setTempUnitsPerBox(String(p.units_per_box || 6));
        setSearchResults([]);
        setSearchProd('');
        
        setTimeout(() => {
            boxesInputRef.current?.focus();
            boxesInputRef.current?.select();
        }, 10);
    };

    const handleCalculatorKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddItem();
        } else if (e.key === 'Escape') {
            setActiveProduct(null);
            searchInputRef.current?.focus();
        }
    };

    const handleAddItem = async () => {
        if (!activeProduct) return;
        const b = parseInt(tempBoxes) || 0;
        const u = parseInt(tempUnitsPerBox) || 0;

        if (b <= 0 && u <= 0) {
            alert("Ingrese una cantidad válida.");
            return;
        }

        const totalQty = b * u;

        try {
            const existing = items.find(i => i.codart === activeProduct.codart);
            if (existing) {
                alert("El producto ya está en el pedido. Puede modificar su cantidad.");
                return;
            }

            const { data, error } = await supabase.from('supplier_order_items').insert({
                order_id: order.id,
                codart: activeProduct.codart,
                quantity: totalQty
            }).select('*, master_products(desart, units_per_box)').single();

            if (error) throw error;

            const newItem = {
                ...data,
                desart: data.master_products?.desart || activeProduct.desart,
                units_per_box: data.master_products?.units_per_box || activeProduct.units_per_box || 6
            };

            setItems([...items, newItem]);
            setHasChanges(true);
            setActiveProduct(null);
            setSearchProd('');
            setTempBoxes('1');
            searchInputRef.current?.focus();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleCopyOrder = () => {
        const header = `PEDIDO ${order.supplier_name}`;
        const body = items.map(item => {
            const upb = item.units_per_box || 6;
            const boxes = Math.floor(item.quantity / upb);
            // Format: 2x6 (12) PRODUCT NAME
            return `${boxes}x${upb} (${item.quantity}) ${item.desart}`;
        }).join('\n');

        const fullText = `${header}\n\n${body}`;
        navigator.clipboard.writeText(fullText);
        alert("Pedido copiado al portapapeles");
    };

    const handleClose = () => {
        if (hasChanges) {
            onUpdate();
        } else {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-background w-full max-w-2xl rounded-3xl border border-surfaceHighlight shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
                <div className="p-6 border-b border-surfaceHighlight bg-surface flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-text uppercase italic">Detalle de Pedido</h3>
                        <p className="text-[10px] text-muted font-bold uppercase">{order.supplier_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleCopyOrder}
                            className="p-2 rounded-full hover:bg-surfaceHighlight text-primary transition-all"
                            title="Copiar pedido"
                        >
                            <Copy size={20}/>
                        </button>
                        <button onClick={handleClose} className="p-2 rounded-full hover:bg-surfaceHighlight text-muted transition-all"><X size={24}/></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Tarjetas de Información Rápida */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-background/50 border border-surfaceHighlight rounded-2xl flex items-center gap-4">
                            <Calendar size={20} className="text-primary" />
                            <div><p className="text-[10px] font-black text-muted uppercase">Llegada Estimada</p><p className="text-sm font-black text-text">{new Date(order.estimated_arrival).toLocaleDateString()}</p></div>
                        </div>
                        <div className="p-4 bg-background/50 border border-surfaceHighlight rounded-2xl flex items-center gap-4">
                            <Clock size={20} className="text-primary" />
                            <div><p className="text-[10px] font-black text-muted uppercase">Estado Actual</p><p className="text-sm font-black text-primary uppercase">{order.status}</p></div>
                        </div>
                    </div>

                    {/* Sección de PDF */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Comprobantes PDF</label>
                        {currentPdfUrl && currentPdfUrl.split(',').filter(Boolean).length > 0 && (
                            <div className="space-y-2">
                                {currentPdfUrl.split(',').filter(Boolean).map((url, idx) => (
                                    <div key={idx} className="p-4 bg-blue-600 rounded-2xl text-white flex items-center justify-between shadow-lg shadow-blue-900/20">
                                        <div className="flex items-center gap-3">
                                            <FileText size={24} />
                                            <div>
                                                <p className="text-[10px] font-black uppercase opacity-80 leading-none">Comprobante Adjunto {idx + 1}</p>
                                                <p className="text-xs font-bold mt-1">Archivo de orden de compra</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <a 
                                                href={url} 
                                                target="_blank" 
                                                rel="noreferrer" 
                                                className="px-4 py-2 bg-white text-blue-600 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-blue-50 transition-colors"
                                            >
                                                <ExternalLink size={14} /> Abrir
                                            </a>
                                            <button 
                                                onClick={() => handleDeletePdf(url)}
                                                className="px-4 py-2 bg-red-500 text-white rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-red-400 transition-colors"
                                            >
                                                <Trash2 size={14} /> Eliminar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="w-full p-4 border-2 border-dashed border-surfaceHighlight rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-all group"
                        >
                            {isUploading ? (
                                <Loader2 size={24} className="animate-spin text-primary" />
                            ) : (
                                <>
                                    <FileUp size={24} className="text-muted group-hover:text-primary transition-colors" />
                                    <p className="text-[10px] font-black text-muted uppercase group-hover:text-primary transition-colors">Adjuntar Comprobante PDF</p>
                                </>
                            )}
                        </button>
                        <input 
                            ref={fileInputRef}
                            type="file" 
                            accept=".pdf" 
                            className="hidden" 
                            onChange={handleUploadPdf} 
                        />
                    </div>

                    {/* Add Product Section */}
                    {tab !== 'confirmado' && (
                        <div className="border border-surfaceHighlight rounded-2xl p-4 bg-surface space-y-4">
                            <h4 className="text-xs font-black uppercase text-muted flex items-center gap-2"><Sparkles size={12}/> Buscar Artículo para Agregar</h4>
                            
                            <div className="space-y-2 relative">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                                    <input 
                                        ref={searchInputRef}
                                        type="text"
                                        value={searchProd}
                                        onChange={e => handleSearchProd(e.target.value)}
                                        onKeyDown={handleSearchKeyDown}
                                        placeholder="Escribe para buscar... Ej: 'fer bran'"
                                        className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase transition-all"
                                    />
                                    {isSearching && <div className="absolute right-4 top-1/2 -translate-y-1/2"><Loader2 size={16} className="animate-spin text-primary"/></div>}
                                </div>
                                {searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 w-full bg-surface border border-primary/30 rounded-2xl shadow-2xl mt-1 z-50 overflow-hidden">
                                        {searchResults.map((p, idx) => {
                                            const suggested = (p.stock_ideal || 0) - (p.stock_llerena || 0);
                                            return (
                                            <button 
                                                key={p.codart} 
                                                onClick={() => handleSelectFromSearch(p)} 
                                                onMouseEnter={() => setSelectedIndex(idx)}
                                                className={`w-full p-4 text-left border-b border-surfaceHighlight last:border-none flex justify-between items-center group transition-colors ${selectedIndex === idx ? 'bg-primary/10' : 'hover:bg-primary/5'}`}
                                            >
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={`text-xs font-black uppercase ${selectedIndex === idx ? 'text-primary' : 'text-text'}`}>{p.desart}</span>
                                                        {suggested > 0 && (
                                                            <span className="text-[9px] font-black text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded uppercase whitespace-nowrap">Sug: {suggested} un.</span>
                                                        )}
                                                        <span className="text-[9px] font-black text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded uppercase whitespace-nowrap">Sto: {p.stock_llerena || 0} un.</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[9px] font-mono text-muted">#{p.codart}</span>
                                                        <span className="text-[9px] font-bold text-primary/60 uppercase italic">Empaque: {p.units_per_box || 6} un.</span>
                                                    </div>
                                                </div>
                                                {selectedIndex === idx && <Plus size={14} className="text-primary animate-in zoom-in shrink-0" />}
                                            </button>
                                        )})}
                                    </div>
                                )}
                            </div>

                            {activeProduct && (
                                <div className="p-6 bg-primary/5 border border-primary/20 rounded-3xl space-y-4 animate-in zoom-in-95">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-black text-primary uppercase text-sm leading-tight flex-1 pr-4">{activeProduct.desart}</h4>
                                        <button onClick={() => setActiveProduct(null)} className="p-1 text-muted hover:text-red-500"><X size={18}/></button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-muted uppercase ml-1">Cant. Cajas (Enter para agregar)</label>
                                            <div className="relative">
                                                <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40" size={14} />
                                                <input 
                                                    ref={boxesInputRef}
                                                    type="number" 
                                                    value={tempBoxes} 
                                                    onChange={e => setTempBoxes(e.target.value)} 
                                                    onKeyDown={handleCalculatorKeyDown}
                                                    className="w-full bg-background border border-surfaceHighlight rounded-xl p-3 pl-10 text-center font-black outline-none focus:border-primary shadow-sm" 
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-muted uppercase ml-1">Unidades por Caja</label>
                                            <div className="relative">
                                                <Boxes className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40" size={14} />
                                                <input 
                                                    type="number" 
                                                    value={tempUnitsPerBox} 
                                                    onChange={e => setTempUnitsPerBox(e.target.value)} 
                                                    onKeyDown={handleCalculatorKeyDown}
                                                    className="w-full bg-background border border-surfaceHighlight rounded-xl p-3 pl-10 text-center font-black outline-none focus:border-primary shadow-sm" 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-primary/10">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-muted uppercase">Total a pedir:</span>
                                            <span className="text-lg font-black text-primary">{(parseInt(tempBoxes)||0) * (parseInt(tempUnitsPerBox)||0)} un.</span>
                                        </div>
                                        <button 
                                            onClick={handleAddItem}
                                            className="bg-primary text-white px-6 py-3 rounded-xl font-black text-xs uppercase shadow-lg shadow-primary/20 hover:bg-primaryHover transition-all active:scale-95 flex items-center gap-2"
                                        >
                                            <Plus size={16}/> Agregar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="border border-surfaceHighlight rounded-2xl overflow-hidden bg-surface">
                        <table className="w-full text-left">
                            <thead className="bg-background/50 text-[10px] text-muted uppercase font-black tracking-widest border-b border-surfaceHighlight">
                                <tr>
                                    <th className="p-4">Artículo</th>
                                    <th className="p-4 text-center">Cantidad Total</th>
                                    {tab !== 'confirmado' && <th className="p-4 text-center w-24"></th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surfaceHighlight">
                                {items.map(item => {
                                    // Calculamos bultos solo para visualización
                                    const upb = item.units_per_box || 6;
                                    const boxes = Math.floor(item.quantity / upb);
                                    const loose = item.quantity % upb;

                                    return (
                                        <tr key={item.id}>
                                            <td className="p-4">
                                                <p className="text-xs font-black text-text uppercase">{item.desart || 'Cargando...'}</p>
                                                <p className="text-[9px] font-mono text-muted">#{item.codart} — Empaque: {upb} un.</p>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col items-center justify-center gap-1">
                                                    {tab !== 'confirmado' ? (
                                                        <input 
                                                            type="number" 
                                                            value={item.quantity === 0 ? '' : item.quantity} 
                                                            onChange={e => handleUpdateQty(item.id, e.target.value)}
                                                            className="w-16 bg-background border border-surfaceHighlight rounded-lg p-1.5 text-center font-black text-xs outline-none focus:border-primary" 
                                                        />
                                                    ) : (
                                                        <span className="font-black text-text">{item.quantity} un.</span>
                                                    )}
                                                    <span className="text-[9px] font-bold text-primary uppercase italic">
                                                        ({boxes} CJ {loose > 0 ? `+ ${loose}` : ''})
                                                    </span>
                                                </div>
                                            </td>
                                            {tab !== 'confirmado' && (
                                                <td className="p-4 text-center">
                                                    {deletingItemId === item.id ? (
                                                        <div className="flex items-center justify-center gap-2 animate-in zoom-in">
                                                            <button onClick={() => handleRemoveItem(item.id)} className="bg-red-500 text-white p-1.5 rounded-lg hover:bg-red-600 transition-colors" title="Confirmar"><CheckCircle2 size={14}/></button>
                                                            <button onClick={() => setDeletingItemId(null)} className="bg-surfaceHighlight text-text p-1.5 rounded-lg hover:bg-surfaceHighlight/80 transition-colors" title="Cancelar"><X size={14}/></button>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => setDeletingItemId(item.id)} className="text-muted hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                                {items.length === 0 && (
                                    <tr><td colSpan={3} className="p-10 text-center text-muted italic text-xs uppercase">Sin artículos registrados</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="p-6 bg-surface border-t border-surfaceHighlight">
                    <button onClick={handleClose} className="w-full py-4 font-black uppercase text-xs text-text hover:bg-surfaceHighlight rounded-2xl border border-surfaceHighlight transition-all">
                        {hasChanges ? "Guardar y Cerrar" : "Cerrar Detalle"}
                    </button>
                    {tab === 'confirmado' && (
                        <button 
                            onClick={() => { onClose(); onUpdate(); }} 
                            className="w-full mt-2 py-4 bg-primary/10 text-primary font-black uppercase text-xs rounded-2xl border border-primary/20 hover:bg-primary hover:text-white transition-all"
                        >
                            Listo
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
