
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Truck, Plus, Search, Trash2, Loader2, Send, AlertCircle, 
    ChevronLeft, Check, Edit2, AlertTriangle, Square, CheckSquare,
    XCircle, AlertOctagon, Hash, FileText, X, CheckCircle2, Eye,
    PackagePlus, Minus, Building2, ChevronDown, ChevronRight, History, 
    UserCheck, Calendar, Filter, XCircle as CloseIcon, CalendarDays,
    Boxes,
    Clock,
    RefreshCw,
    Warehouse,
    User
} from 'lucide-react';
import { supabase } from '../supabase';
import { StockInbound, MasterProduct, User as UserType, WarehouseCode } from '../types';

export const InventoryInbounds: React.FC<{ currentUser: UserType }> = ({ currentUser }) => {
    const [view, setView] = useState<'list' | 'create'>('list');
    const [tab, setTab] = useState<'pendientes' | 'finalizados'>('pendientes');
    const [inbounds, setInbounds] = useState<(StockInbound & { user_name?: string })[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    const [reviewInbound, setReviewInbound] = useState<StockInbound | null>(null);
    const [detailsInbound, setDetailsInbound] = useState<StockInbound | null>(null);

    // Estado para confirmación de eliminación
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

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
    const [tempExpiry, setTempExpiry] = useState(''); 

    const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

    // Refs para control de foco
    const searchInputRef = useRef<HTMLInputElement>(null);
    const boxesInputRef = useRef<HTMLInputElement>(null);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            const [inbRes, whRes, provRes] = await Promise.all([
                supabase.from('stock_inbounds')
                    .select('*, providers_master(razon_social), warehouses(name), profiles:created_by(name)')
                    .order('created_at', { ascending: false }),
                supabase.from('warehouses').select('*'),
                supabase.from('providers_master').select('codigo, razon_social').eq('activo', true)
            ]);

            if (inbRes.data) setInbounds(inbRes.data.map((i: any) => ({
                ...i,
                supplier_name: i.providers_master?.razon_social || i.supplier_code,
                warehouse_name: i.warehouses?.name,
                user_name: i.profiles?.name || 'Sistema'
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
            const isPending = inb.status === 'enviado' || inb.status === 'borrador';
            if (tab === 'pendientes' && !isPending) return false;
            if (tab === 'finalizados' && isPending) return false;

            const matchesSearch = 
                (inb.supplier_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (inb.supplier_code?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (inb.observations?.toLowerCase() || '').includes(searchTerm.toLowerCase());
            
            const inbDate = inb.created_at.split('T')[0];
            const matchesDate = !dateFilter || inbDate === dateFilter;

            return matchesSearch && matchesDate;
        });
    }, [inbounds, searchTerm, dateFilter, tab]);

    const groupedInbounds = useMemo(() => {
        const groups: Record<string, { name: string, items: (StockInbound & { user_name?: string })[] }> = {};
        filteredInbounds.forEach(inb => {
            const key = inb.supplier_code;
            if (!groups[key]) groups[key] = { name: inb.supplier_name || key, items: [] };
            groups[key].items.push(inb);
        });
        return Object.entries(groups).sort((a, b) => a[1].name.localeCompare(b[1].name));
    }, [filteredInbounds]);

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
        setTempExpiry('');
        setUnitsPerBox(String(p.units_per_box || 12));
        
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
            total: totalUnitsToAdd,
            expiry: tempExpiry 
        }, ...draftItems]);
        
        setActiveProduct(null);
        setTempExpiry('');
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
                quantity: item.total,
                expiry_date: item.expiry || null 
            }));
            const { error: itemsErr } = await supabase.from('stock_inbound_items').insert(itemsToInsert);
            if (itemsErr) throw itemsErr;
            setDraftItems([]); setSupplierRef(''); setSelectedProvider(''); setSelectedWarehouse('');
            setView('list'); fetchInitialData();
        } catch (e: any) { alert("Error: " + e.message); } finally { setIsSaving(false); }
    };

    const handleAnular = async (inb: StockInbound) => {
        if (inb.status === 'aprobado') return alert("No se puede anular un ingreso ya aprobado.");
        // Se elimina el confirm del navegador, la UI maneja la confirmación
        setIsLoading(true);
        try {
            const { error } = await supabase.rpc('anular_ingreso_stock', { p_inbound_id: inb.id });
            if (error) throw error;
            setConfirmingDeleteId(null);
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
                {/* ... resto del formulario de creación se mantiene igual ... */}
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
                                <div className="p-6 bg-primary/5 border border-primary/20 rounded-3xl space-y-6 animate-in zoom-in-95 relative">
                                    <button onClick={() => setActiveProduct(null)} className="absolute top-6 right-6 p-1 text-muted hover:text-red-500 transition-colors">
                                        <X size={20}/>
                                    </button>
                                    <div className="flex flex-col gap-4 pr-10">
                                        <div className="flex-1">
                                            <h4 className="font-black text-primary uppercase text-sm leading-tight">{activeProduct.desart}</h4>
                                            <p className="text-[10px] font-bold text-muted uppercase mt-0.5">Stock Betbeder: {activeProduct.stock_betbeder} | Llerena: {activeProduct.stock_llerena}</p>
                                        </div>
                                        <div className="flex flex-col gap-1 w-full max-w-[280px]">
                                            <label className="text-[9px] font-black text-muted uppercase ml-1">Vencimiento (Opcional)</label>
                                            <input type="date" lang="es-AR" value={tempExpiry} onChange={e => setTempExpiry(e.target.value)} className="w-full bg-surface border border-surfaceHighlight rounded-xl px-3 py-2 text-[11px] font-black text-text outline-none focus:border-primary shadow-sm cursor-pointer" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-1"><label className="text-[9px] font-black text-muted uppercase ml-1">cajas</label><input ref={boxesInputRef} type="number" value={boxes} onChange={e => setBoxes(e.target.value)} onKeyDown={handleCalculatorKeyDown} className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-center font-black outline-none focus:border-primary shadow-sm" /></div>
                                        <div className="space-y-1"><label className="text-[9px] font-black text-muted uppercase ml-1">Un. x Caja</label><input type="number" value={unitsPerBox} onChange={e => setUnitsPerBox(e.target.value)} onKeyDown={handleCalculatorKeyDown} className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-center font-black text-muted/60 outline-none focus:border-primary shadow-sm" /></div>
                                        <div className="space-y-1"><label className="text-[9px] font-black text-muted uppercase ml-1">Sueltas</label><input type="number" value={looseUnits} onChange={e => setLooseUnits(e.target.value)} onKeyDown={handleCalculatorKeyDown} className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-center font-black outline-none focus:border-primary shadow-sm" /></div>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-primary/10">
                                        <div className="flex flex-col"><span className="text-[10px] font-black text-muted uppercase tracking-widest">A ingresar</span><span className="text-2xl font-black text-text">{totalUnitsToAdd} <small className="text-[10px]">unidades</small></span></div>
                                        <button onClick={addToDraft} className="bg-primary text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-primaryHover transition-all active:scale-95 flex items-center gap-2"><PackagePlus size={18} /> Agregar Ítem</button>
                                    </div>
                                    <div className="text-center"><p className="text-[8px] font-black text-muted uppercase tracking-[0.2em]">ESC para cancelar • ENTER para confirmar • TAB para navegar</p></div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm flex flex-col h-[600px]">
                        <h3 className="text-sm font-black text-text uppercase italic border-b border-surfaceHighlight pb-3 mb-4 flex items-center gap-2"><Boxes size={16} className="text-primary" /> Items Cargados ({draftItems.length})</h3>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                            {draftItems.map((item, idx) => (
                                <div key={idx} className="p-4 bg-background border border-surfaceHighlight rounded-2xl flex justify-between items-center group animate-in slide-in-from-right-2">
                                    <div className="min-w-0 flex-1"><p className="text-[11px] font-black text-text uppercase truncate">{item.product.desart}</p>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5"><p className="text-[9px] text-primary font-black uppercase tracking-tighter">{item.boxes} CJ x {item.unitsPerBox} {item.looseUnits > 0 ? `+ ${item.looseUnits}` : ''} = <span className="text-text">{item.total} un.</span></p>
                                            {item.expiry && <span className="text-[9px] font-black text-orange-500 uppercase flex items-center gap-1 bg-orange-500/5 px-1.5 py-0.5 rounded border border-orange-500/20"><Calendar size={10} /> {new Date(item.expiry + 'T12:00:00').toLocaleDateString('es-AR')}</span>}
                                        </div>
                                    </div>
                                    <button onClick={() => setDraftItems(draftItems.filter((_, i) => i !== idx))} className="ml-4 p-2 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 size={16}/></button>
                                </div>
                            ))}
                        </div>
                        <button onClick={handleFinalizeAndSend} disabled={isSaving || draftItems.length === 0} className={`w-full mt-6 py-5 rounded-2xl font-black text-xs uppercase shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 ${isSaving || draftItems.length === 0 ? 'bg-surfaceHighlight text-muted cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700 shadow-green-900/20'}`}>{isSaving ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>} Finalizar y Enviar</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 pb-20 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight flex items-center gap-3 uppercase italic">
                        <Truck className="text-primary" size={36} /> Ingresos de Stock
                    </h2>
                    <p className="text-muted text-sm mt-1 font-medium">Control de recepción de mercadería y conciliación.</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button onClick={fetchInitialData} className="p-4 rounded-2xl bg-surface border border-surfaceHighlight text-muted hover:text-primary transition-all shadow-sm">
                        <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={() => setView('create')} className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-primary hover:bg-primaryHover text-white px-8 py-4 rounded-2xl font-black text-sm uppercase transition-all shadow-xl shadow-primary/20 active:scale-95">
                        <Plus size={20} /> Nuevo Ingreso
                    </button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-surface p-2 rounded-2xl border border-surfaceHighlight shadow-sm">
                <div className="flex gap-1 w-full lg:w-auto">
                    {[ { id: 'pendientes', label: 'Pendientes', icon: <Clock size={16}/> }, { id: 'finalizados', label: 'Finalizados', icon: <CheckCircle2 size={16}/> } ].map(t => (
                        <button key={t.id} onClick={() => setTab(t.id as any)} className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase transition-all ${tab === t.id ? 'bg-primary text-white shadow-lg' : 'text-muted hover:bg-surfaceHighlight'}`}>{t.icon} {t.label}</button>
                    ))}
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                        <input type="text" placeholder="Buscar por proveedor o ref..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase" />
                    </div>
                    <div className="flex bg-background border border-surfaceHighlight rounded-xl overflow-hidden shadow-inner">
                        <div className="px-3 flex items-center text-muted"><Calendar size={14}/></div>
                        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="bg-transparent py-3 pr-4 text-xs font-black outline-none cursor-pointer" />
                        {dateFilter && <button onClick={() => setDateFilter('')} className="px-3 text-red-500 hover:bg-red-50"><X size={14}/></button>}
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                {isLoading && inbounds.length === 0 ? (
                    <div className="py-24 flex justify-center"><Loader2 size={48} className="animate-spin text-primary" /></div>
                ) : groupedInbounds.length === 0 ? (
                    <div className="py-24 text-center border-2 border-dashed border-surfaceHighlight rounded-3xl bg-surface/30 opacity-50"><Truck size={48} className="mx-auto mb-4 text-muted" /><p className="font-black uppercase tracking-widest text-muted italic">Sin registros que coincidan.</p></div>
                ) : groupedInbounds.map(([pCode, group]) => {
                    const isExpanded = expandedSupplier === pCode;
                    return (
                        <div key={pCode} className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm transition-all duration-300">
                            <button onClick={() => setExpandedSupplier(isExpanded ? null : pCode)} className="w-full p-6 flex items-center justify-between hover:bg-primary/5 transition-colors text-left group">
                                <div className="flex items-center gap-5"><div className="h-12 w-12 rounded-2xl bg-background border border-surfaceHighlight flex items-center justify-center text-primary group-hover:border-primary/30 shadow-inner"><Building2 size={24}/></div><div><h3 className="text-lg font-black text-text uppercase italic leading-tight group-hover:text-primary transition-colors">{group.name}</h3><p className="text-[10px] font-black text-muted uppercase tracking-widest mt-1">{group.items.length} Ingreso(s) registrados</p></div></div>
                                {isExpanded ? <ChevronDown className="text-muted" /> : <ChevronRight className="text-muted" />}
                            </button>
                            {isExpanded && (
                                <div className="p-4 bg-background/20 border-t border-surfaceHighlight space-y-3 animate-in slide-in-from-top-2">
                                    {group.items.map(inb => {
                                        const isConfirming = confirmingDeleteId === inb.id;
                                        return (
                                            <div key={inb.id} className="bg-surface border border-surfaceHighlight rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 hover:border-primary/30 transition-all shadow-sm">
                                                <div className="flex-1 space-y-2"><div className="flex items-center gap-3"><span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">#{inb.display_number}</span><div className="flex items-center gap-2 text-text font-black uppercase text-sm italic"><FileText size={14} className="text-primary" />Ref: {inb.observations || 'S/REF'}</div></div>
                                                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                                                        <span className="text-[10px] font-bold text-muted uppercase flex items-center gap-1"><Calendar size={12} /> {new Date(inb.created_at).toLocaleDateString()}</span>
                                                        <span className="text-[10px] font-bold text-muted uppercase flex items-center gap-1"><Warehouse size={12} /> {inb.warehouse_name}</span>
                                                        <span className="text-[10px] font-bold text-muted uppercase flex items-center gap-1"><User size={12} /> {inb.user_name}</span>
                                                        <StatusBadge status={inb.status} />
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 w-full md:w-auto">
                                                    <button onClick={() => setDetailsInbound(inb)} className="flex-1 md:flex-none px-4 py-2.5 rounded-xl border border-surfaceHighlight text-text hover:bg-surfaceHighlight font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2 shadow-sm"><Eye size={16}/> Detalle</button>
                                                    {inb.status === 'enviado' && currentUser.role === 'vale' && (<button onClick={() => setReviewInbound(inb)} className="flex-1 md:flex-none px-6 py-2.5 rounded-xl bg-green-600 text-white hover:bg-green-700 font-black text-[10px] uppercase shadow-lg shadow-green-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"><Check size={16}/> Aprobar</button>)}
                                                    {inb.status !== 'aprobado' && inb.status !== 'anulado' && (
                                                        isConfirming ? (
                                                            <div className="flex items-center gap-1 animate-in zoom-in-95">
                                                                <button onClick={() => handleAnular(inb)} className="px-3 py-2.5 bg-red-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-red-500/20 active:scale-90 transition-all">Confirmar</button>
                                                                <button onClick={() => setConfirmingDeleteId(null)} className="p-2.5 bg-surfaceHighlight text-text rounded-xl"><X size={14}/></button>
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => setConfirmingDeleteId(inb.id)} className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm" title="Anular Ingreso"><Trash2 size={16}/></button>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {reviewInbound && (
                <InboundReviewModal 
                    inbound={reviewInbound} 
                    onClose={() => setReviewInbound(null)} 
                    onApprove={async () => {
                        const ok = await handleAprobarStock(reviewInbound.id);
                        if (ok) setReviewInbound(null);
                    }}
                />
            )}

            {detailsInbound && (
                <InboundDetailsModal 
                    inbound={detailsInbound} 
                    onClose={() => setDetailsInbound(null)} 
                    currentUser={currentUser}
                    onRefresh={fetchInitialData}
                />
            )}
        </div>
    );
};

// --- SUB-COMPONENTES MODALES ---

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    let styles = "bg-muted/10 text-muted border-muted/20";
    if (status === 'enviado') styles = "bg-blue-500/10 text-blue-600 border-blue-500/20";
    if (status === 'aprobado') styles = "bg-green-500/10 text-green-600 border-green-500/20";
    if (status === 'anulado') styles = "bg-red-500/10 text-red-600 border-red-200";
    return <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${styles}`}>{status}</span>;
};

const InboundReviewModal: React.FC<{ inbound: StockInbound, onClose: () => void, onApprove: () => void }> = ({ inbound, onClose, onApprove }) => {
    const [items, setItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        supabase.from('stock_inbound_items').select('*, master_products(desart)').eq('inbound_id', inbound.id).then(res => {
            if (res.data) setItems(res.data.map(i => ({ ...i, desart: i.master_products?.desart })));
            setIsLoading(false);
        });
    }, [inbound]);

    const handleConfirm = async () => {
        setIsProcessing(true);
        try { await onApprove(); } catch (e) { alert("Error al aprobar"); } finally { setIsProcessing(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-background w-full max-w-2xl rounded-3xl border border-surfaceHighlight shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
                <div className="p-6 border-b border-surfaceHighlight bg-surface flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-text uppercase italic">Conciliación de Ingreso</h3>
                        <p className="text-[10px] text-muted font-bold uppercase">{inbound.supplier_name} | Ref: {inbound.observations}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-surfaceHighlight rounded-full text-muted transition-all"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-2xl flex gap-4"><AlertTriangle className="text-orange-500 shrink-0" size={20} /><p className="text-[10px] text-orange-700 dark:text-orange-300 font-bold uppercase leading-relaxed">Al aprobar este ingreso, las cantidades se sumarán automáticamente al stock real del depósito <b className="underline">{inbound.warehouse_name}</b>.</p></div>
                    <div className="border border-surfaceHighlight rounded-2xl overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-background/50 text-[9px] text-muted font-black uppercase border-b border-surfaceHighlight"><tr><th className="p-4">Artículo</th><th className="p-4 text-center">Cantidad a Ingresar</th></tr></thead>
                            <tbody className="divide-y divide-surfaceHighlight">{isLoading ? (<tr><td colSpan={2} className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-primary"/></td></tr>) : items.map(item => (<tr key={item.id} className="bg-surface/50"><td className="p-4"><p className="text-xs font-black text-text uppercase">{item.desart}</p><p className="text-[9px] font-mono text-muted">#{item.codart}</p></td><td className="p-4 text-center font-black text-sm text-primary">{item.quantity} un.</td></tr>))}</tbody>
                        </table>
                    </div>
                </div>
                <div className="p-6 bg-surface border-t border-surfaceHighlight flex gap-3"><button onClick={onClose} className="flex-1 py-4 font-black text-xs uppercase text-muted hover:bg-surfaceHighlight rounded-2xl border border-surfaceHighlight transition-all">Cancelar</button><button onClick={handleConfirm} disabled={isProcessing} className="flex-[2] py-4 bg-green-600 hover:bg-green-700 text-white font-black rounded-2xl shadow-xl shadow-green-900/20 transition-all active:scale-95 flex items-center justify-center gap-3 uppercase text-xs">{isProcessing ? <Loader2 size={18} className="animate-spin"/> : <CheckCircle2 size={18}/>} Confirmar y Sumar Stock</button></div>
            </div>
        </div>
    );
};

const InboundDetailsModal: React.FC<{ inbound: StockInbound, onClose: () => void, currentUser: UserType, onRefresh: () => void }> = ({ inbound, onClose, currentUser, onRefresh }) => {
    const [items, setItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const isVale = currentUser.role === 'vale';
    const canEdit = isVale && (inbound.status === 'enviado' || inbound.status === 'borrador');

    // Estados para buscador manual interno
    const [showSearch, setShowSearch] = useState(false);
    const [searchProd, setSearchProd] = useState('');
    const [foundProds, setFoundProds] = useState<MasterProduct[]>([]);
    const [selectedProd, setSelectedProd] = useState<MasterProduct | null>(null);
    const [newQty, setNewQty] = useState('1');

    useEffect(() => {
        supabase.from('stock_inbound_items').select('*, master_products(desart, codart)').eq('inbound_id', inbound.id).then(res => {
            if (res.data) setItems(res.data.map(i => ({ ...i, desart: i.master_products?.desart })));
            setIsLoading(false);
        });
    }, [inbound]);

    const handleUpdateQty = async (itemId: string, qty: number) => {
        // CORRECCIÓN: Impedir actualizar con 0 o negativo para evitar violación de Check Constraint
        if (qty <= 0) return;
        
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity: qty } : i));
        const { error } = await supabase.from('stock_inbound_items').update({ quantity: qty }).eq('id', itemId);
        if (error) console.error(error);
    };

    const handleRemoveItem = async (itemId: string) => {
        if (!confirm("¿Quitar artículo de este ingreso?")) return;
        const { error } = await supabase.from('stock_inbound_items').delete().eq('id', itemId);
        if (!error) setItems(prev => prev.filter(i => i.id !== itemId));
    };

    const handleSearch = async (val: string) => {
        setSearchProd(val);
        if (val.trim().length < 2) { setFoundProds([]); return; }
        const { data } = await supabase.from('master_products').select('*').ilike('desart', `%${val}%`).limit(5);
        if (data) setFoundProds(data);
    };

    const handleAddManualItem = async () => {
        // CORRECCIÓN: Impedir agregar con cantidad 0 o vacía
        const qty = parseInt(newQty);
        if (!selectedProd || isNaN(qty) || qty <= 0) {
            alert("Ingrese una cantidad válida mayor a 0.");
            return;
        }

        setIsSaving(true);
        try {
            const { data, error } = await supabase.from('stock_inbound_items').insert({
                inbound_id: inbound.id,
                codart: selectedProd.codart,
                quantity: qty
            }).select().single();
            
            if (error) throw error;
            
            setItems([...items, { ...data, desart: selectedProd.desart }]);
            setSelectedProd(null);
            setNewQty('1');
            setShowSearch(false);
        } catch (e: any) { 
            alert("Error al agregar: " + e.message); 
        } finally { 
            setIsSaving(false); 
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background w-full max-w-3xl rounded-3xl border border-surfaceHighlight shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
                <div className="p-6 border-b border-surfaceHighlight bg-surface flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-text uppercase italic tracking-tight">Detalle de Ingreso</h3>
                        <p className="text-[10px] text-muted font-bold uppercase">{inbound.supplier_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {canEdit && !showSearch && (
                            <button onClick={() => setShowSearch(true)} className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl text-[10px] font-black uppercase hover:bg-primary hover:text-white transition-all">
                                <Plus size={14}/> Agregar Ítem
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-surfaceHighlight rounded-full text-muted transition-all"><X size={24}/></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {showSearch && (
                        <div className="p-6 bg-primary/5 border border-primary/20 rounded-3xl space-y-4 animate-in zoom-in-95">
                            <div className="flex justify-between items-center">
                                <h4 className="text-xs font-black text-primary uppercase">Agregar Producto Manual</h4>
                                <button onClick={() => setShowSearch(false)}><X size={16}/></button>
                            </div>
                            <div className="relative">
                                <input type="text" placeholder="Búsqueda..." value={searchProd} onChange={e => handleSearch(e.target.value)} className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm font-bold outline-none uppercase" />
                                {foundProds.length > 0 && (
                                    <div className="absolute top-full left-0 w-full bg-surface border border-surfaceHighlight rounded-xl shadow-xl mt-1 z-50 overflow-hidden">
                                        {foundProds.map(p => (
                                            <button key={p.codart} onClick={() => { setSelectedProd(p); setFoundProds([]); setSearchProd(p.desart); }} className="w-full p-3 text-left hover:bg-primary/5 text-xs font-bold uppercase border-b border-surfaceHighlight last:border-none">{p.desart}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {selectedProd && (
                                <div className="flex items-center gap-4 animate-in fade-in">
                                    <input type="number" min="1" value={newQty} onChange={e => setNewQty(e.target.value)} className="w-24 bg-surface border border-surfaceHighlight rounded-xl p-3 text-center font-black" />
                                    <button onClick={handleAddManualItem} className="flex-1 py-3 bg-primary text-white font-black rounded-xl uppercase text-xs shadow-lg">Confirmar Adición</button>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-surface border border-surfaceHighlight p-4 rounded-2xl flex items-center gap-4">
                            <Calendar size={20} className="text-primary"/>
                            <div><p className="text-[9px] font-black text-muted uppercase tracking-widest">Fecha Registro</p><p className="text-xs font-black text-text">{new Date(inbound.created_at).toLocaleString()}</p></div>
                        </div>
                        <div className="bg-surface border border-surfaceHighlight p-4 rounded-2xl flex items-center gap-4">
                            <Warehouse size={20} className="text-primary"/>
                            <div><p className="text-[9px] font-black text-muted uppercase tracking-widest">Depósito Destino</p><p className="text-xs font-black text-text uppercase">{inbound.warehouse_name}</p></div>
                        </div>
                    </div>
                    
                    <div className="border border-surfaceHighlight rounded-2xl overflow-hidden bg-surface">
                        <table className="w-full text-left">
                            <thead className="bg-background/50 text-[9px] text-muted font-black uppercase border-b border-surfaceHighlight">
                                <tr>
                                    <th className="p-4">Artículo</th>
                                    <th className="p-4 text-center">Cantidad</th>
                                    {canEdit && <th className="p-4 w-12"></th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surfaceHighlight">
                                {isLoading ? (
                                    <tr><td colSpan={3} className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-primary"/></td></tr>
                                ) : items.map(item => (
                                    <tr key={item.id}>
                                        <td className="p-4"><p className="text-xs font-black text-text uppercase">{item.desart}</p><p className="text-[9px] font-mono text-muted">#{item.codart}</p></td>
                                        <td className="p-4 text-center">
                                            {canEdit ? (
                                                <div className="flex items-center justify-center gap-1">
                                                    <input 
                                                        type="number" 
                                                        min="1"
                                                        value={item.quantity} 
                                                        onChange={e => handleUpdateQty(item.id, parseInt(e.target.value) || 0)}
                                                        className="w-20 bg-background border border-surfaceHighlight rounded-lg p-2 text-center font-black text-sm outline-none focus:border-primary"
                                                    />
                                                </div>
                                            ) : (
                                                <span className="font-black text-sm text-text">{item.quantity} un.</span>
                                            )}
                                        </td>
                                        {canEdit && (
                                            <td className="p-4 text-center">
                                                <button onClick={() => handleRemoveItem(item.id)} className="p-2 text-muted hover:text-red-500"><Trash2 size={16}/></button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="p-6 bg-surface border-t border-surfaceHighlight flex gap-2">
                    <button onClick={() => { onRefresh(); onClose(); }} className="w-full py-4 font-black uppercase text-xs text-text hover:bg-surfaceHighlight rounded-2xl border border-surfaceHighlight transition-all">Cerrar y Actualizar</button>
                </div>
            </div>
        </div>
    );
};
