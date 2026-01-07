
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Truck, Plus, Search, Trash2, Loader2, Send, AlertCircle, 
    ChevronLeft, Check, Edit2, AlertTriangle, Square, CheckSquare,
    XCircle, AlertOctagon, Hash, FileText, X, CheckCircle2, Eye,
    PackagePlus, Minus, Building2, ChevronDown, ChevronRight, History, 
    UserCheck, Calendar, Filter, XCircle as CloseIcon, CalendarDays,
    Boxes,
    Clock
} from 'lucide-react';
import { supabase } from '../supabase';
import { StockInbound, MasterProduct, User as UserType, WarehouseCode } from '../types';

export const InventoryInbounds: React.FC<{ currentUser: UserType }> = ({ currentUser }) => {
    const [view, setView] = useState<'list' | 'create'>('list');
    const [tab, setTab] = useState<'pendientes' | 'finalizados'>('pendientes');
    const [inbounds, setInbounds] = useState<StockInbound[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    const [reviewInbound, setReviewInbound] = useState<StockInbound | null>(null);
    const [detailsInbound, setDetailsInbound] = useState<StockInbound | null>(null);

    const [selectedProvider, setSelectedProvider] = useState('');
    const [supplierRef, setSupplierRef] = useState(''); 
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
    const [warehouses, setWarehouses] = useState<{id: string, name: string}[]>([]);
    const [providers, setProviders] = useState<{codigo: string, razon_social: string}[]>([]);
    const [draftItems, setDraftItems] = useState<any[]>([]);

    // Estados para búsqueda avanzada
    const [productSearch, setProductSearch] = useState('');
    const [foundProducts, setFoundProducts] = useState<MasterProduct[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0); 
    const [activeProduct, setActiveProduct] = useState<MasterProduct | null>(null);
    
    // Inputs de calculadora
    const [boxes, setBoxes] = useState('');
    const [unitsPerBox, setUnitsPerBox] = useState('12');
    const [looseUnits, setLooseUnits] = useState('');

    const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

    // Refs para control de foco
    const searchInputRef = useRef<HTMLInputElement>(null);
    const boxesInputRef = useRef<HTMLInputElement>(null);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            const [inbRes, whRes, provRes] = await Promise.all([
                supabase.from('stock_inbounds')
                    .select('*, providers_master(razon_social), warehouses(name)')
                    .order('created_at', { ascending: false }),
                supabase.from('warehouses').select('*'),
                supabase.from('providers_master').select('codigo, razon_social').eq('activo', true)
            ]);

            if (inbRes.data) setInbounds(inbRes.data.map(i => ({
                ...i,
                supplier_name: i.providers_master?.razon_social || i.supplier_code,
                warehouse_name: i.warehouses?.name
            })));
            if (whRes.data) setWarehouses(whRes.data);
            if (provRes.data) setProviders(provRes.data);
        } catch (err) { 
            console.error("Error cargando ingresos:", err); 
        } finally { 
            setIsLoading(false); 
        }
    };

    useEffect(() => { fetchInitialData(); }, []);

    const filteredInbounds = useMemo(() => {
        return inbounds.filter(inb => {
            // Filtro por Tab
            const isPending = inb.status === 'enviado' || inb.status === 'borrador';
            if (tab === 'pendientes' && !isPending) return false;
            if (tab === 'finalizados' && isPending) return false;

            // Filtro por Búsqueda
            const matchesSearch = 
                (inb.supplier_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (inb.supplier_code?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (inb.observations?.toLowerCase() || '').includes(searchTerm.toLowerCase());
            
            // Filtro por Fecha
            const inbDate = inb.created_at.split('T')[0];
            const matchesDate = !dateFilter || inbDate === dateFilter;

            return matchesSearch && matchesDate;
        });
    }, [inbounds, searchTerm, dateFilter, tab]);

    const groupedInbounds = useMemo(() => {
        const groups: Record<string, { name: string, items: StockInbound[] }> = {};
        filteredInbounds.forEach(inb => {
            const key = inb.supplier_code;
            if (!groups[key]) groups[key] = { name: inb.supplier_name || key, items: [] };
            groups[key].items.push(inb);
        });
        return Object.entries(groups).sort((a, b) => a[1].name.localeCompare(b[1].name));
    }, [filteredInbounds]);

    // LÓGICA DE BÚSQUEDA KEYBOARD-FRIENDLY
    const handleProductSearch = async (val: string) => {
        setProductSearch(val);
        const trimmed = val.trim();
        if (trimmed.length < 2) { 
            setFoundProducts([]); 
            setSelectedIndex(0);
            return; 
        }

        const words = trimmed.split(/\s+/).filter(w => w.length > 0);
        let query = supabase.from('master_products').select('*');
        words.forEach(word => {
            query = query.ilike('desart', `%${word}%`);
        });

        const { data } = await query.limit(10);
        setFoundProducts(data || []);
        setSelectedIndex(0);
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (foundProducts.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % foundProducts.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + foundProducts.length) % foundProducts.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                handleSelectProduct(foundProducts[selectedIndex]);
            }
        }
    };

    const handleSelectProduct = (p: MasterProduct) => {
        setActiveProduct(p);
        setFoundProducts([]);
        setProductSearch('');
        setBoxes('');
        setLooseUnits('');
        setUnitsPerBox(String(p.units_per_box || 12));
        
        // Foco inmediato en Cajas
        setTimeout(() => boxesInputRef.current?.focus(), 10);
    };

    const totalUnitsToAdd = useMemo(() => {
        const b = parseInt(boxes) || 0;
        const upb = parseInt(unitsPerBox) || 0;
        const lu = parseInt(looseUnits) || 0;
        return (b * upb) + lu;
    }, [boxes, unitsPerBox, looseUnits]);

    const addToDraft = () => {
        if (!activeProduct || totalUnitsToAdd <= 0) return;
        setDraftItems([{
            product: activeProduct,
            boxes: parseInt(boxes) || 0,
            unitsPerBox: parseInt(unitsPerBox) || 0,
            looseUnits: parseInt(looseUnits) || 0,
            total: totalUnitsToAdd
        }, ...draftItems]);
        
        setActiveProduct(null);
        // Devolver foco al buscador
        setTimeout(() => searchInputRef.current?.focus(), 10);
    };

    const handleCalculatorKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addToDraft();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setActiveProduct(null);
            setTimeout(() => searchInputRef.current?.focus(), 10);
        }
    };

    const handleFinalizeAndSend = async () => {
        if (!selectedProvider || !selectedWarehouse || !supplierRef || draftItems.length === 0) {
            return alert("Faltan datos obligatorios.");
        }
        setIsSaving(true);
        try {
            const { data: inbound, error: inbErr } = await supabase.from('stock_inbounds').insert({
                supplier_code: selectedProvider, 
                warehouse_id: selectedWarehouse,
                observations: supplierRef.trim(),
                status: 'enviado',
                created_by: currentUser.id
            }).select().single();
            if (inbErr) throw inbErr;
            const itemsToInsert = draftItems.map(item => ({ 
                inbound_id: inbound.id, 
                codart: item.product.codart, 
                quantity: item.total 
            }));
            const { error: itemsErr } = await supabase.from('stock_inbound_items').insert(itemsToInsert);
            if (itemsErr) throw itemsErr;
            setDraftItems([]); setSupplierRef(''); setSelectedProvider(''); setSelectedWarehouse('');
            setView('list'); fetchInitialData();
        } catch (e: any) { alert("Error: " + e.message); } finally { setIsSaving(false); }
    };

    const handleAnular = async (inb: StockInbound) => {
        if (inb.status === 'aprobado') return alert("No se puede anular un ingreso ya aprobado.");
        setIsLoading(true);
        try {
            const { error } = await supabase.rpc('anular_ingreso_stock', { p_inbound_id: inb.id });
            if (error) throw error;
            await fetchInitialData();
        } catch (e: any) { alert("Error: " + e.message); } finally { setIsLoading(false); }
    };

    const handleAprobarStock = async (id: string): Promise<boolean> => {
        const { error } = await supabase.rpc('aprobar_ingreso_stock', { p_inbound_id: id });
        if (error) throw error;
        await fetchInitialData();
        return true;
    };

    if (view === 'create') {
        return (
            <div className="flex flex-col gap-6 pb-20 animate-in slide-in-from-right duration-300">
                <div className="flex items-center gap-4">
                    <button onClick={() => setView('list')} className="p-2 rounded-full hover:bg-surfaceHighlight text-muted transition-colors"><ChevronLeft size={24}/></button>
                    <h2 className="text-2xl font-black text-text uppercase italic">Cargar Mercadería</h2>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted uppercase ml-1">Proveedor</label>
                                <select value={selectedProvider} onChange={e => setSelectedProvider(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl p-3 text-sm font-bold outline-none uppercase cursor-pointer focus:border-primary transition-all">
                                    <option value="">Seleccionar...</option>
                                    {providers.map(p => <option key={p.codigo} value={p.codigo}>{p.razon_social}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted uppercase ml-1">Nro Comprobante</label>
                                <div className="relative">
                                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                                    <input type="text" placeholder="Ej: 0001-00045" value={supplierRef} onChange={e => setSupplierRef(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl p-3 pl-9 text-sm font-black outline-none uppercase focus:border-primary shadow-inner" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted uppercase ml-1">Depósito Arribo</label>
                                <select value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl p-3 text-sm font-bold outline-none uppercase focus:border-primary transition-all">
                                    <option value="">Seleccionar...</option>
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm space-y-6">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                                <input 
                                    ref={searchInputRef}
                                    type="text" 
                                    placeholder="Búsqueda: Ej 'fer bran 750'..." 
                                    value={productSearch} 
                                    onChange={e => handleProductSearch(e.target.value)} 
                                    onKeyDown={handleSearchKeyDown}
                                    className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary uppercase shadow-inner transition-all" 
                                />
                                {foundProducts.length > 0 && (
                                    <div className="absolute top-full left-0 w-full bg-surface border border-primary/30 rounded-2xl shadow-2xl mt-2 z-50 overflow-hidden">
                                        {foundProducts.map((p, idx) => (
                                            <button 
                                                key={p.codart} 
                                                onClick={() => handleSelectProduct(p)} 
                                                onMouseEnter={() => setSelectedIndex(idx)}
                                                className={`w-full p-4 text-left border-b border-surfaceHighlight last:border-none flex justify-between items-center group transition-colors ${selectedIndex === idx ? 'bg-primary/10' : 'hover:bg-primary/5'}`}
                                            >
                                                <div className="flex flex-col">
                                                    <span className={`text-xs font-black uppercase ${selectedIndex === idx ? 'text-primary' : 'text-text'}`}>{p.desart}</span>
                                                    <span className="text-[10px] font-mono text-muted">#{p.codart}</span>
                                                </div>
                                                <Plus size={14} className={`text-primary transition-opacity ${selectedIndex === idx ? 'opacity-100' : 'opacity-0'}`} />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {activeProduct && (
                                <div className="p-6 bg-primary/5 border border-primary/20 rounded-3xl space-y-6 animate-in zoom-in-95">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-black text-primary uppercase text-sm">{activeProduct.desart}</h4>
                                            <p className="text-[10px] font-bold text-muted uppercase">Stock Betbeder: {activeProduct.stock_betbeder} | Llerena: {activeProduct.stock_llerena}</p>
                                        </div>
                                        <button onClick={() => setActiveProduct(null)} className="p-1 hover:text-red-500"><X size={20}/></button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-muted uppercase ml-1">Cajas (Enter p/ agregar)</label>
                                            <input 
                                                ref={boxesInputRef}
                                                type="number" 
                                                value={boxes} 
                                                onChange={e => setBoxes(e.target.value)} 
                                                onKeyDown={handleCalculatorKeyDown}
                                                className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-center font-black outline-none focus:border-primary shadow-sm" 
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-muted uppercase ml-1">Un. x Caja</label>
                                            <input 
                                                type="number" 
                                                value={unitsPerBox} 
                                                onChange={e => setUnitsPerBox(e.target.value)} 
                                                onKeyDown={handleCalculatorKeyDown}
                                                className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-center font-black text-muted/60 outline-none focus:border-primary shadow-sm" 
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-muted uppercase ml-1">Sueltas</label>
                                            <input 
                                                type="number" 
                                                value={looseUnits} 
                                                onChange={e => setLooseUnits(e.target.value)} 
                                                onKeyDown={handleCalculatorKeyDown}
                                                className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-center font-black outline-none focus:border-primary shadow-sm" 
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-primary/10">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-muted uppercase tracking-widest">A ingresar</span>
                                            <span className="text-2xl font-black text-text">{totalUnitsToAdd} <small className="text-[10px]">unidades</small></span>
                                        </div>
                                        <button onClick={addToDraft} className="bg-primary text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-primaryHover transition-all active:scale-95 flex items-center gap-2">
                                            <PackagePlus size={18} /> Agregar Ítem
                                        </button>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[8px] font-black text-muted uppercase tracking-[0.2em]">ESC para cancelar • ENTER para confirmar • TAB para navegar</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm flex flex-col h-[600px]">
                        <h3 className="text-sm font-black text-text uppercase italic border-b border-surfaceHighlight pb-3 mb-4 flex items-center gap-2">
                            <Boxes size={16} className="text-primary" /> Items Cargados ({draftItems.length})
                        </h3>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                            {draftItems.map((item, idx) => (
                                <div key={idx} className="p-4 bg-background border border-surfaceHighlight rounded-2xl flex justify-between items-center group animate-in slide-in-from-right-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-black text-text uppercase truncate">{item.product.desart}</p>
                                        <p className="text-[9px] text-primary font-black uppercase tracking-tighter mt-0.5">
                                            {item.boxes} CJ x {item.unitsPerBox} {item.looseUnits > 0 ? `+ ${item.looseUnits}` : ''} = <span className="text-text">{item.total} un.</span>
                                        </p>
                                    </div>
                                    <button onClick={() => setDraftItems(draftItems.filter((_, i) => i !== idx))} className="ml-4 p-2 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all">
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            ))}
                            {draftItems.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-muted opacity-30 italic">
                                    <Truck size={48} className="mb-2" />
                                    <p className="text-xs font-black uppercase tracking-widest">Lista Vacía</p>
                                </div>
                            )}
                        </div>
                        <button onClick={handleFinalizeAndSend} disabled={isSaving || draftItems.length === 0} className={`w-full mt-6 py-5 rounded-2xl font-black text-xs uppercase shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 ${isSaving || draftItems.length === 0 ? 'bg-surfaceHighlight text-muted cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700 shadow-green-900/20'}`}>
                            {isSaving ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>} Finalizar y Enviar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const pendingCount = inbounds.filter(i => i.status === 'enviado' || i.status === 'borrador').length;
    const finalCount = inbounds.filter(i => i.status === 'aprobado' || i.status === 'anulado').length;

    return (
        <div className="flex flex-col gap-8 pb-10 max-w-6xl mx-auto animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight flex items-center gap-3 uppercase italic"><Truck className="text-primary" size={32} /> Ingresos de Stock</h2>
                    <p className="text-muted text-sm mt-1 font-medium italic">Gestión de arribos por proveedor.</p>
                </div>
                <button onClick={() => setView('create')} className="bg-primary hover:bg-primaryHover text-white px-8 py-4 rounded-2xl font-black text-sm uppercase shadow-xl shadow-primary/20 active:scale-95 flex items-center gap-2 transition-all">
                    <Plus size={20} /> Nuevo Ingreso
                </button>
            </div>

            {/* TABS DE SEPARACIÓN */}
            <div className="flex bg-surface p-1 rounded-2xl border border-surfaceHighlight shadow-sm w-full md:w-fit gap-1">
                <button 
                    onClick={() => setTab('pendientes')} 
                    className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-3 rounded-xl font-black text-xs uppercase transition-all ${tab === 'pendientes' ? 'bg-primary text-white shadow-lg' : 'text-muted hover:bg-surfaceHighlight'}`}
                >
                    <Clock size={16} /> Pendientes
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${tab === 'pendientes' ? 'bg-white text-primary' : 'bg-surfaceHighlight text-muted'}`}>{pendingCount}</span>
                </button>
                <button 
                    onClick={() => setTab('finalizados')} 
                    className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-3 rounded-xl font-black text-xs uppercase transition-all ${tab === 'finalizados' ? 'bg-primary text-white shadow-lg' : 'text-muted hover:bg-surfaceHighlight'}`}
                >
                    <CheckCircle2 size={16} /> Finalizados
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${tab === 'finalizados' ? 'bg-white text-primary' : 'bg-surfaceHighlight text-muted'}`}>{finalCount}</span>
                </button>
            </div>

            <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                    <input type="text" placeholder="Buscar por Proveedor o Comprobante..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase" />
                </div>
                <div className="w-full md:w-56 relative">
                    <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                    <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary shadow-inner cursor-pointer" />
                </div>
            </div>

            <div className="flex flex-col gap-4">
                {isLoading && !inbounds.length ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={48} /></div>
                ) : groupedInbounds.length === 0 ? (
                    <div className="py-24 text-center border-2 border-dashed border-surfaceHighlight rounded-3xl bg-surface/30 opacity-50">
                        <PackageSearch size={48} className="mx-auto mb-4 text-muted" />
                        <p className="font-black uppercase tracking-widest text-muted italic">No se encontraron ingresos {tab}.</p>
                    </div>
                ) : groupedInbounds.map(([code, group]) => {
                    const isExpanded = expandedSupplier === code || (searchTerm.length > 2);
                    const pendingInGroup = group.items.filter(i => i.status === 'enviado').length;

                    return (
                        <div key={code} className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm transition-all duration-300">
                            <button onClick={() => setExpandedSupplier(isExpanded ? null : code)} className="w-full p-6 flex items-center justify-between hover:bg-primary/5 transition-colors text-left group">
                                <div className="flex items-center gap-5">
                                    <div className="h-12 w-12 rounded-2xl bg-background border border-surfaceHighlight flex items-center justify-center text-primary shadow-inner"><Building2 size={24} /></div>
                                    <div>
                                        <h3 className="text-lg font-black text-text uppercase italic leading-tight group-hover:text-primary transition-colors">{group.name}</h3>
                                        <div className="flex gap-3 mt-1">
                                            <span className="text-[10px] font-black text-muted uppercase flex items-center gap-1"><History size={12}/> {group.items.length} Ingresos</span>
                                            {tab === 'pendientes' && pendingInGroup > 0 && <span className="text-[9px] font-black bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded border border-blue-500/20">{pendingInGroup} Pendiente(s)</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">{isExpanded ? <ChevronDown className="text-muted" /> : <ChevronRight className="text-muted" />}</div>
                            </button>

                            {isExpanded && (
                                <div className="border-t border-surfaceHighlight bg-background/20 animate-in slide-in-from-top-2 duration-300">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-background/40 text-[10px] text-muted uppercase font-black tracking-widest border-b border-surfaceHighlight">
                                                <tr><th className="p-4 pl-8">Fecha / ID</th><th className="p-4">Comprobante</th><th className="p-4 text-center">Depósito</th><th className="p-4 text-center">Estado</th><th className="p-4 pr-8 text-right">Acciones</th></tr>
                                            </thead>
                                            <tbody className="divide-y divide-surfaceHighlight/50">
                                                {group.items.map(inb => (
                                                    <tr key={inb.id} className="hover:bg-primary/5 transition-colors">
                                                        <td className="p-4 pl-8"><div className="flex flex-col"><span className="text-[10px] font-black text-text">#{inb.display_number}</span><span className="text-[10px] font-bold text-muted">{new Date(inb.created_at).toLocaleDateString()}</span></div></td>
                                                        <td className="p-4"><span className="text-xs font-bold text-text uppercase italic">{inb.observations || 'S/REF'}</span></td>
                                                        <td className="p-4 text-center"><span className="px-2 py-0.5 rounded text-[8px] font-black border text-muted uppercase">{inb.warehouse_name || 'S/D'}</span></td>
                                                        <td className="p-4 text-center"><span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${inb.status === 'borrador' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-200' : inb.status === 'enviado' ? 'bg-blue-500/10 text-blue-600 border-blue-200' : inb.status === 'aprobado' ? 'bg-green-500/10 text-green-600 border-green-200' : 'bg-red-500/10 text-red-600 border-red-200'}`}>{inb.status}</span></td>
                                                        <td className="p-4 pr-8 text-right"><div className="flex justify-end gap-2">{inb.status === 'enviado' && currentUser.role === 'vale' ? (<button onClick={() => setReviewInbound(inb)} className="p-2 bg-blue-600 text-white rounded-xl shadow-md hover:bg-blue-700 transition-all active:scale-95" title="Revisar e Ingresar"><Eye size={16}/></button>) : (<button onClick={() => setDetailsInbound(inb)} className="p-2 bg-surfaceHighlight text-text rounded-xl shadow-sm hover:bg-primary/10 hover:text-primary transition-all" title="Ver Detalle"><Eye size={16}/></button>)}{inb.status === 'enviado' && currentUser.role === 'vale' && (<button onClick={() => handleAnular(inb)} className="p-2 text-muted hover:text-red-500 rounded-xl transition-all" title="Anular"><Trash2 size={16}/></button>)}</div></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {reviewInbound && <InboundReviewModal inbound={reviewInbound} currentUser={currentUser} onClose={() => setReviewInbound(null)} onApproved={handleAprobarStock} />}
            {detailsInbound && <InboundDetailsModal inbound={detailsInbound} onClose={() => setDetailsInbound(null)} />}
        </div>
    );
};

const PackageSearch: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = "" }) => (
    <div className={`relative ${className}`}><Search size={size} /><div className="absolute -bottom-1 -right-1 bg-surface rounded-full p-0.5"><Truck size={size * 0.6} className="text-primary" /></div></div>
);

// --- MODAL DE REVISIÓN CON EDICIÓN DE UNIDADES ---
const InboundReviewModal: React.FC<{ 
    inbound: StockInbound, currentUser: UserType, onClose: () => void, onApproved: (id: string) => Promise<boolean> 
}> = ({ inbound, currentUser, onClose, onApproved }) => {
    const [items, setItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<MasterProduct[]>([]);

    useEffect(() => {
        (async () => {
            setIsLoading(true);
            const { data } = await supabase.from('stock_inbound_items').select('*, master_products(desart)').eq('inbound_id', inbound.id);
            if (data) setItems(data);
            setIsLoading(false);
        })();
    }, [inbound.id]);

    const handleSearch = async (val: string) => {
        setSearchTerm(val);
        if (val.trim().length < 2) { setSearchResults([]); return; }
        const words = val.trim().split(/\s+/);
        let query = supabase.from('master_products').select('*');
        words.forEach(w => query = query.ilike('desart', `%${w}%`));
        const { data } = await query.limit(5);
        setSearchResults(data || []);
    };

    const addItem = async (p: MasterProduct) => {
        const { data, error } = await supabase.from('stock_inbound_items').insert({ inbound_id: inbound.id, codart: p.codart, quantity: 1 }).select().single();
        if (!error) { setItems([...items, { ...data, master_products: { desart: p.desart } }]); setSearchTerm(''); setSearchResults([]); }
    };

    const removeItem = async (id: string) => {
        const { error } = await supabase.from('stock_inbound_items').delete().eq('id', id);
        if (!error) { setItems(items.filter(i => i.id !== id)); const n = new Set(checkedItems); n.delete(id); setCheckedItems(n); }
    };

    const updateQty = async (id: string, qty: number) => {
        if (qty < 0) return;
        const { error } = await supabase.from('stock_inbound_items').update({ quantity: qty }).eq('id', id);
        if (!error) setItems(items.map(i => i.id === id ? { ...i, quantity: qty } : i));
    };

    const handleLocalApprove = async () => {
        if (items.length === 0) return setErrorMsg("Ingreso vacío.");
        if (checkedItems.size !== items.length) return setErrorMsg(`⚠️ Verifica todos los ítems.`);
        setIsSaving(true);
        try { await onApproved(inbound.id); onClose(); } catch (e: any) { setErrorMsg(e.message); } finally { setIsSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background w-full max-w-4xl rounded-3xl border border-surfaceHighlight shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-surfaceHighlight bg-surface flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-text uppercase italic tracking-tight">Revisión: Ingreso #{inbound.display_number}</h3>
                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Proveedor: <span className="text-primary">{inbound.supplier_name}</span> | Ref: {inbound.observations}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-surfaceHighlight transition-all"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {errorMsg && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 text-xs font-bold flex items-center gap-3 animate-in shake"><AlertCircle size={16}/> {errorMsg}</div>}
                    
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                        <input type="text" placeholder="Búsqueda inteligente: Ej 'fer bran'..." value={searchTerm} onChange={e => handleSearch(e.target.value)} className="w-full bg-surface border border-surfaceHighlight rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold outline-none focus:border-primary uppercase shadow-inner" />
                        {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 w-full bg-surface border border-primary/30 rounded-2xl shadow-xl mt-1 z-50 overflow-hidden">
                                {searchResults.map(p => (
                                    <button key={p.codart} onClick={() => addItem(p)} className="w-full p-4 hover:bg-primary/5 text-left border-b border-surfaceHighlight flex justify-between items-center group transition-colors">
                                        <div className="flex flex-col"><span className="text-xs font-black uppercase group-hover:text-primary">{p.desart}</span><span className="text-[9px] text-muted">#{p.codart}</span></div>
                                        <PackagePlus size={16} className="text-primary" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {isLoading ? <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" size={32} /></div> : (
                        <div className="border border-surfaceHighlight rounded-2xl overflow-hidden bg-surface shadow-sm">
                            <table className="w-full text-left">
                                <thead className="bg-background/50 text-[9px] text-muted uppercase font-black tracking-widest border-b border-surfaceHighlight">
                                    <tr>
                                        <th className="p-4 w-12 text-center">OK</th>
                                        <th className="p-4">Artículo</th>
                                        <th className="p-4 text-center w-48">Unidades Recibidas</th>
                                        <th className="p-4 text-center w-12">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surfaceHighlight">
                                    {items.map(i => (
                                        <tr key={i.id} className={`transition-colors ${checkedItems.has(i.id) ? 'bg-green-500/5' : ''}`}>
                                            <td className="p-4 text-center">
                                                <button 
                                                    onClick={() => {const n = new Set(checkedItems); n.has(i.id) ? n.delete(i.id) : n.add(i.id); setCheckedItems(n);}}
                                                    className="transition-transform active:scale-90"
                                                >
                                                    {checkedItems.has(i.id) ? <CheckSquare size={22} className="text-green-500" /> : <Square size={22} className="text-muted/50" />}
                                                </button>
                                            </td>
                                            <td className="p-4">
                                                <p className="text-xs font-black uppercase text-text leading-tight">{i.master_products?.desart}</p>
                                                <p className="text-[9px] font-mono text-muted">#{i.codart}</p>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button 
                                                        onClick={() => updateQty(i.id, i.quantity - 1)}
                                                        className="p-1.5 rounded-lg bg-background border border-surfaceHighlight text-muted hover:text-red-500 hover:border-red-200 transition-all"
                                                    >
                                                        <Minus size={14}/>
                                                    </button>
                                                    <input 
                                                        type="number" 
                                                        value={i.quantity}
                                                        onChange={(e) => updateQty(i.id, parseInt(e.target.value) || 0)}
                                                        className="w-20 bg-background border border-surfaceHighlight rounded-xl py-2 text-center text-sm font-black text-primary outline-none focus:border-primary shadow-inner"
                                                    />
                                                    <button 
                                                        onClick={() => updateQty(i.id, i.quantity + 1)}
                                                        className="p-1.5 rounded-lg bg-background border border-surfaceHighlight text-muted hover:text-green-500 hover:border-green-200 transition-all"
                                                    >
                                                        <Plus size={14}/>
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <button onClick={() => removeItem(i.id)} className="p-2 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 size={16}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div className="p-6 bg-surface border-t border-surfaceHighlight flex flex-col sm:flex-row gap-4">
                    <button onClick={onClose} className="flex-1 py-4 font-black uppercase text-xs text-muted hover:bg-surfaceHighlight rounded-2xl border border-surfaceHighlight transition-all">Cerrar</button>
                    <button 
                        onClick={handleLocalApprove} 
                        disabled={isSaving || items.length === 0} 
                        className={`flex-[2] py-4 rounded-2xl font-black uppercase text-xs shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 ${checkedItems.size === items.length && items.length > 0 ? 'bg-green-600 text-white hover:bg-green-700 shadow-green-900/20' : 'bg-surfaceHighlight text-muted cursor-not-allowed'}`}
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18}/>} Confirmar e Ingresar Stock
                    </button>
                </div>
            </div>
        </div>
    );
};

const InboundDetailsModal: React.FC<{ 
    inbound: StockInbound, 
    onClose: () => void 
}> = ({ inbound, onClose }) => {
    const [items, setItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        (async () => {
            setIsLoading(true);
            const { data } = await supabase.from('stock_inbound_items').select('*, master_products(desart)').eq('inbound_id', inbound.id);
            if (data) setItems(data);
            setIsLoading(false);
        })();
    }, [inbound.id]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background w-full max-w-2xl rounded-3xl border border-surfaceHighlight shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
                <div className="p-6 border-b border-surfaceHighlight bg-surface flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-text uppercase italic tracking-tight">Detalle Ingreso #{inbound.display_number}</h3>
                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest">{inbound.supplier_name} | {inbound.status}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-surfaceHighlight transition-all"><X size={24}/></button>
                </div>
                
                <div className="p-6 grid grid-cols-2 gap-4 bg-background/50 border-b border-surfaceHighlight">
                    <div className="flex items-center gap-3"><Calendar size={18} className="text-primary"/><div className="flex flex-col"><span className="text-[10px] font-black text-muted uppercase">Fecha de Arribo</span><span className="text-xs font-bold text-text">{new Date(inbound.created_at).toLocaleString()}</span></div></div>
                    <div className="flex items-center gap-3"><UserCheck size={18} className="text-primary"/><div className="flex flex-col"><span className="text-[10px] font-black text-muted uppercase">Estado</span><span className="text-xs font-black uppercase text-green-600">{inbound.status}</span></div></div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? <Loader2 className="animate-spin mx-auto text-primary" /> : (
                        <div className="border border-surfaceHighlight rounded-2xl overflow-hidden bg-surface shadow-sm">
                            <table className="w-full text-left">
                                <thead className="bg-background/50 text-[10px] text-muted uppercase font-black border-b border-surfaceHighlight tracking-widest">
                                    <tr><th className="p-4">Artículo</th><th className="p-4 text-center">Cantidad Recibida</th></tr>
                                </thead>
                                <tbody className="divide-y divide-surfaceHighlight">
                                    {items.map(i => (
                                        <tr key={i.id} className="hover:bg-background/10 transition-colors">
                                            <td className="p-4">
                                                <p className="text-xs font-black uppercase text-text leading-tight">{i.master_products?.desart}</p>
                                                <p className="text-[9px] font-mono text-muted">#{i.codart}</p>
                                            </td>
                                            <td className="p-4 text-center font-black text-primary text-base">{i.quantity} un.</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div className="p-6 bg-surface border-t border-surfaceHighlight">
                    <button onClick={onClose} className="w-full py-4 font-black uppercase text-xs text-text hover:bg-surfaceHighlight rounded-2xl border border-surfaceHighlight transition-all shadow-sm">Cerrar Detalle</button>
                </div>
            </div>
        </div>
    );
};
