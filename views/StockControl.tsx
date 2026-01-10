
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Plus, 
    Search, 
    Trash2, 
    Loader2, 
    CheckCircle2, 
    AlertCircle, 
    ChevronRight, 
    Package, 
    Filter, 
    User as UserIcon,
    ClipboardCheck, 
    Warehouse,
    Save,
    RotateCcw,
    X,
    FileSpreadsheet,
    Check,
    Calendar,
    AlertTriangle,
    CheckSquare,
    Square,
    LayoutList,
    ArrowRightLeft,
    ChevronDown,
    ArrowRight,
    Edit3,
    ArrowUpRight,
    ArrowDownLeft,
    XCircle
} from 'lucide-react';
import { supabase } from '../supabase';
import { User, StockControlSession, StockControlItem, MasterProduct } from '../types';
import * as XLSX from 'xlsx';

interface StockControlProps {
    currentUser: User;
}

export const StockControl: React.FC<StockControlProps> = ({ currentUser }) => {
    const [mode, setMode] = useState<'list' | 'create' | 'execution' | 'review'>('list');
    const [sessions, setSessions] = useState<any[]>([]);
    const [activeSession, setActiveSession] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
    
    // --- CREATE MODE STATES ---
    const [newName, setNewName] = useState('');
    const [warehouseId, setWarehouseId] = useState('');
    const [warehouses, setWarehouses] = useState<{id: string, name: string}[]>([]);
    const [products, setProducts] = useState<MasterProduct[]>([]);
    const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
    const [filters, setFilters] = useState({ family: 'TODAS', subfamily: 'TODAS', provider: 'TODOS', search: '' });

    // --- EXECUTION / REVIEW STATES ---
    const [controlItems, setControlItems] = useState<any[]>([]);
    const [isSavingCount, setIsSavingCount] = useState(false);

    const isVale = currentUser.role === 'vale';

    const fetchSessions = async () => {
        setIsLoading(true);
        try {
            const { data } = await supabase
                .from('stock_control_sessions')
                .select(`*, warehouses(name), stock_control_items(id, stock_control_counts(user_id))`)
                .order('created_at', { ascending: false });
            
            if (data) {
                const mapped = data.map(s => {
                    const items = s.stock_control_items || [];
                    const allUserIds = items.flatMap((i: any) => i.stock_control_counts.map((c: any) => c.user_id));
                    const uniqueUsers = Array.from(new Set(allUserIds));
                    return {
                        ...s, warehouse_name: s.warehouses?.name, item_count: items.length, assigned_users: uniqueUsers,
                        user_progress: uniqueUsers.map(uid => {
                            const countedByThisUser = items.filter((i: any) => i.stock_control_counts.some((c: any) => c.user_id === uid)).length;
                            return { userId: uid, count: countedByThisUser };
                        })
                    };
                });
                setSessions(mapped);
            }
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    useEffect(() => {
        fetchSessions();
        if (isVale) {
            supabase.from('warehouses').select('*').then(res => res.data && setWarehouses(res.data));
            supabase.from('master_products').select('*').order('desart').then(res => res.data && setProducts(res.data));
        }
    }, [isVale]);

    const handleDeleteSession = async (id: string) => {
        try {
            const { error } = await supabase.from('stock_control_sessions').delete().eq('id', id);
            if (error) throw error;
            setSessions(prev => prev.filter(s => s.id !== id));
            setConfirmingDeleteId(null);
        } catch (e: any) { alert("Error: " + e.message); }
    };

    const handleCreateSession = async () => {
        if (!newName || !warehouseId || selectedProducts.size === 0) return alert("Faltan datos.");
        setIsLoading(true);
        try {
            const { data: session, error } = await supabase.from('stock_control_sessions').insert({
                name: newName, warehouse_id: warehouseId, status: 'active', created_by: currentUser.id
            }).select().single();
            if (error) throw error;
            const warehouseObj = warehouses.find(w => w.id === warehouseId);
            const itemsToInsert = Array.from(selectedProducts).map(cod => {
                const p = products.find(prod => prod.codart === cod);
                const stock = warehouseObj?.name === 'LLERENA' ? p?.stock_llerena : p?.stock_betbeder;
                return { session_id: session.id, codart: cod, system_qty: stock || 0 };
            });
            await supabase.from('stock_control_items').insert(itemsToInsert);
            setMode('list');
            fetchSessions();
            setSelectedProducts(new Set());
            setNewName('');
        } catch (e: any) { alert(e.message); } finally { setIsLoading(false); }
    };

    const startSessionExecution = async (session: any) => {
        setActiveSession(session);
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('stock_control_items')
                .select('*, master_products(desart), stock_control_counts(user_id, qty, profiles(name))')
                .eq('session_id', session.id)
                .order('id');
            if (data) {
                setControlItems(data.map((item: any) => ({
                    id: item.id, session_id: item.session_id, codart: item.codart, desart: item.master_products?.desart, system_qty: item.system_qty, corrected_qty: item.corrected_qty,
                    counts: item.stock_control_counts.map((c: any) => ({ user_id: c.user_id, user_name: c.profiles?.name, qty: c.qty }))
                })));
                setMode(isVale ? 'review' : 'execution');
            }
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    const handleSavePhysicalCount = async (itemId: string, qty: number) => {
        if (isNaN(qty)) return;
        setIsSavingCount(true);
        try {
            await supabase.from('stock_control_counts').upsert({ item_id: itemId, user_id: currentUser.id, qty: qty }, { onConflict: 'item_id,user_id' });
            setControlItems(prev => prev.map(i => i.id === itemId ? { ...i, counts: [...i.counts.filter((c: any) => c.user_id !== currentUser.id), { user_id: currentUser.id, user_name: currentUser.name, qty: qty }] } : i));
        } catch (e: any) { alert(e.message); } finally { setIsSavingCount(false); }
    };

    const handleAdminCorrection = async (itemId: string, val: number | null) => {
        try {
            await supabase.from('stock_control_items').update({ corrected_qty: val }).eq('id', itemId);
            setControlItems(prev => prev.map(i => i.id === itemId ? { ...i, corrected_qty: val } : i));
        } catch (e) { alert("Error"); }
    };

    // --- FIX: Added missing handleExportExcel function to resolve the 'Cannot find name' error on line 197 ---
    const handleExportExcel = () => {
        if (!activeSession || controlItems.length === 0) return;

        const data = controlItems.map(item => {
            const c1 = item.counts[0];
            const c2 = item.counts[1];
            const finalVal = (item.corrected_qty !== null && item.corrected_qty !== undefined) ? item.corrected_qty : item.system_qty;
            const diff = finalVal - item.system_qty;

            return {
                'Código': item.codart,
                'Producto': item.desart,
                'Stock Sistema': item.system_qty,
                'Conteo Armador 1': c1 ? c1.qty : 'Pendiente',
                'Armador 1 Nombre': c1 ? c1.user_name : '-',
                'Conteo Armador 2': c2 ? c2.qty : 'Pendiente',
                'Armador 2 Nombre': c2 ? c2.user_name : '-',
                'Stock Corregido': item.corrected_qty ?? item.system_qty,
                'Diferencia (Ajuste)': diff
            };
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
        XLSX.writeFile(wb, `Auditoria_${activeSession.name}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const filteredProducts = useMemo(() => {
        // Lógica de búsqueda tipo Google
        const keywords = filters.search.toLowerCase().split(/\s+/).filter(k => k.length > 0);
        
        return products.filter(p => {
            const textToSearch = `${p.desart} ${p.codart}`.toLowerCase();
            const matchesSearch = keywords.every(k => textToSearch.includes(k));
            
            const matchesFamily = filters.family === 'TODAS' || p.familia === filters.family;
            const matchesProv = filters.provider === 'TODOS' || p.nomprov === filters.provider;
            return matchesFamily && matchesProv && matchesSearch;
        }).slice(0, 200);
    }, [products, filters]);

    const families = useMemo(() => Array.from(new Set(products.map(p => p.familia).filter(Boolean))), [products]);
    const providers = useMemo(() => Array.from(new Set(products.map(p => p.nomprov).filter(Boolean))), [products]);

    if (mode === 'create') {
        return (
            <div className="flex flex-col gap-6 pb-20 animate-in slide-in-from-right duration-300">
                <div className="flex items-center gap-4"><button onClick={() => setMode('list')} className="p-2 rounded-full hover:bg-surfaceHighlight text-muted transition-colors"><ChevronRight className="rotate-180" size={24}/></button><h2 className="text-2xl font-black text-text uppercase italic">Crear Auditoría</h2></div>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6"><div className="lg:col-span-1 space-y-4"><div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm space-y-4 sticky top-24"><h4 className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Configuración</h4><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre del Control..." className="w-full bg-background border border-surfaceHighlight rounded-xl p-3.5 text-sm font-bold outline-none focus:border-primary uppercase shadow-inner" /><select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl p-3.5 text-sm font-bold outline-none cursor-pointer appearance-none uppercase"><option value="">Depósito...</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select><div className="pt-4 border-t border-surfaceHighlight"><div className="flex justify-between items-center mb-4 px-1"><span className="text-[10px] font-black text-muted uppercase">Seleccionados</span><span className="text-sm font-black text-primary bg-primary/10 px-3 py-1 rounded-full">{selectedProducts.size}</span></div><button onClick={handleCreateSession} disabled={selectedProducts.size === 0 || !newName || !warehouseId} className="w-full py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-primaryHover transition-all active:scale-95 disabled:opacity-30">Generar Auditoría</button></div></div></div><div className="lg:col-span-3 space-y-6"><div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4"><div className="relative"><Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14}/><select value={filters.family} onChange={e => setFilters({...filters, family: e.target.value})} className="w-full bg-background border border-surfaceHighlight rounded-xl p-2.5 pl-10 text-xs font-bold uppercase outline-none appearance-none"><option value="TODAS">FAMILIAS</option>{families.map(f => <option key={f} value={f}>{f}</option>)}</select></div><div className="relative"><Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14}/><select value={filters.provider} onChange={e => setFilters({...filters, provider: e.target.value})} className="w-full bg-background border border-surfaceHighlight rounded-xl p-2.5 pl-10 text-xs font-bold uppercase outline-none appearance-none"><option value="TODOS">PROVEEDORES</option>{providers.map(p => <option key={p} value={p}>{p}</option>)}</select></div><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14}/><input value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} placeholder="BUSCAR ARTÍCULO..." className="w-full bg-background border border-surfaceHighlight rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold outline-none focus:border-primary uppercase shadow-inner"/></div></div><div className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm"><table className="w-full text-left border-collapse"><thead className="bg-background/50 border-b border-surfaceHighlight text-[10px] text-muted font-black uppercase tracking-widest"><tr><th className="p-4 w-12 text-center"><button onClick={() => { const next = new Set(selectedProducts); const allVisibleIn = filteredProducts.every(p => selectedProducts.has(p.codart)); if (allVisibleIn) filteredProducts.forEach(p => next.delete(p.codart)); else filteredProducts.forEach(p => next.add(p.codart)); setSelectedProducts(next); }}>{filteredProducts.every(p => selectedProducts.has(p.codart)) ? <CheckSquare className="text-primary"/> : <Square/>}</button></th><th className="p-4">Artículo</th><th className="p-4">Familia</th><th className="p-4 text-right pr-6">Acción</th></tr></thead><tbody className="divide-y divide-surfaceHighlight">{filteredProducts.map(p => (<tr key={p.codart} className={`hover:bg-primary/5 transition-colors cursor-pointer group ${selectedProducts.has(p.codart) ? 'bg-primary/5' : ''}`} onClick={() => { const next = new Set(selectedProducts); if (next.has(p.codart)) next.delete(p.codart); else next.add(p.codart); setSelectedProducts(next); }}><td className="p-4 text-center">{selectedProducts.has(p.codart) ? <CheckSquare className="text-primary" size={20}/> : <Square size={20}/>}</td><td className="p-4"><p className="text-xs font-black text-text uppercase truncate max-w-[350px]">{p.desart}</p><p className="text-[10px] font-mono text-muted">#{p.codart}</p></td><td className="p-4"><span className="text-[10px] font-bold text-muted uppercase bg-background px-2 py-0.5 rounded border border-surfaceHighlight">{p.familia || 'S/D'}</span></td><td className="p-4 text-right pr-6"><ChevronRight className="ml-auto text-muted opacity-30" size={16}/></td></tr>))}</tbody></table></div></div></div>
            </div>
        );
    }

    if (mode === 'execution' && activeSession) {
        return (
            <div className="flex flex-col gap-6 pb-20 animate-in fade-in duration-300 max-w-4xl mx-auto"><div className="bg-orange-600 rounded-3xl p-8 text-white shadow-xl shadow-orange-600/20 relative overflow-hidden"><div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div><div className="flex items-center gap-4 mb-4 relative z-10"><Package size={40}/> <h2 className="text-3xl font-black uppercase italic tracking-tight">{activeSession.name}</h2></div><p className="text-xs font-bold opacity-90 leading-relaxed uppercase tracking-widest max-w-lg">Auditoría Ciega: Registra la cantidad física exacta.</p></div><div className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm"><div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-background/50 border-b border-surfaceHighlight text-[10px] text-muted font-black uppercase tracking-widest"><tr><th className="p-5 pl-8">Código</th><th className="p-5">Producto</th><th className="p-5 text-center w-36">Cantidad</th><th className="p-5 text-center w-24">Estado</th></tr></thead><tbody className="divide-y divide-surfaceHighlight">{controlItems.map(item => { const myCount = item.counts.find((c: any) => c.user_id === currentUser.id); const isCorrect = myCount && Math.round(myCount.qty) === Math.round(item.system_qty); return (<tr key={item.id} className="hover:bg-background/50 transition-colors"><td className="p-5 pl-8"><span className="font-mono text-[11px] font-black text-primary bg-primary/5 px-2 py-1 rounded border border-primary/20">#{item.codart}</span></td><td className="p-5"><p className="text-sm font-black text-text uppercase leading-tight">{item.desart}</p></td><td className="p-5"><div className="flex items-center bg-background border border-surfaceHighlight rounded-xl overflow-hidden shadow-inner px-2 focus-within:border-primary transition-all"><input type="number" defaultValue={myCount?.qty} placeholder="CARGAR" onBlur={(e) => handleSavePhysicalCount(item.id, parseFloat(e.target.value))} className="w-full bg-transparent border-none py-3 text-center text-sm font-black outline-none" /></div></td><td className="p-5 text-center">{myCount ? (<div className="flex items-center justify-center animate-in zoom-in">{isCorrect ? (<div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-green-600 flex items-center justify-center"><CheckCircle2 size={24} /></div>) : (<div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-green-500/20 text-red-600 flex items-center justify-center animate-pulse"><AlertTriangle size={24} /></div>)}</div>) : <div className="h-8 w-8 rounded-full border-2 border-dashed border-muted/20 mx-auto" />}</td></tr>); })}</tbody></table></div></div><button onClick={() => setMode('list')} className="w-full py-4 bg-surface border border-surfaceHighlight text-text hover:bg-surfaceHighlight rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-sm">Finalizar Auditoría</button></div>
        );
    }

    if (mode === 'review' && activeSession) {
        return (
            <div className="flex flex-col gap-6 pb-20 animate-in fade-in"><div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border border-slate-700"><div className="flex items-center gap-4"><button onClick={() => setMode('list')} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-all"><ChevronRight className="rotate-180" size={24}/></button><div><h2 className="text-2xl font-black uppercase italic tracking-tight">{activeSession.name}</h2><p className="text-[10px] opacity-60 font-black uppercase tracking-[0.2em] mt-1">Conciliación: <span className="text-primary">{activeSession.warehouse_name}</span></p></div></div><div className="flex gap-3 w-full md:w-auto"><button onClick={handleExportExcel} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 px-6 py-4 rounded-2xl text-xs font-black uppercase shadow-lg shadow-green-900/40 transition-all active:scale-95"><FileSpreadsheet size={18}/> Exportar</button><button onClick={() => setMode('list')} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 px-6 py-4 rounded-2xl text-xs font-black uppercase transition-all">Regresar</button></div></div><div className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm"><div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-background/50 border-b border-surfaceHighlight text-[10px] text-muted font-black uppercase tracking-widest"><tr><th className="p-4 w-12 text-center">Estado</th><th className="p-4">Artículo</th><th className="p-4 text-center">Sistema</th><th className="p-4">Armador 1</th><th className="p-4">Armador 2</th><th className="p-4 text-center">Corregido</th><th className="p-4 text-right pr-10">Ajuste</th></tr></thead><tbody className="divide-y divide-surfaceHighlight">{controlItems.map(item => { const c1 = item.counts[0]; const c2 = item.counts[1]; const finalVal = (item.corrected_qty !== null && item.corrected_qty !== undefined) ? item.corrected_qty : item.system_qty; const diff = finalVal - item.system_qty; const hasConflict = (c1 && c1.qty !== item.system_qty) || (c2 && c2.qty !== item.system_qty) || (c1 && c2 && c1.qty !== c2.qty); const isAdminSet = item.corrected_qty !== null && item.corrected_qty !== undefined; return (<tr key={item.id} className={`hover:bg-primary/5 transition-colors group ${hasConflict && !isAdminSet ? 'bg-orange-500/[0.02]' : ''}`}><td className="p-4 text-center">{diff === 0 ? (<div className="h-8 w-8 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center mx-auto"><CheckCircle2 size={16}/></div>) : (<div className="h-8 w-8 rounded-full bg-orange-500/10 text-orange-600 flex items-center justify-center mx-auto animate-pulse"><AlertTriangle size={16}/></div>)}</td><td className="p-4"><p className="text-xs font-black text-text uppercase leading-tight truncate max-w-[280px]">{item.desart}</p><p className="text-[9px] font-mono text-muted">#{item.codart}</p></td><td className="p-4 text-center"><span className="text-xs font-black text-muted bg-background px-4 py-2 rounded-xl border border-surfaceHighlight shadow-inner">{item.system_qty}</span></td><td className="p-4">{c1 ? (<div className="flex flex-col"><span className="text-[8px] font-black text-muted uppercase truncate max-w-[80px]">{c1.user_name}</span><span className={`text-sm font-black ${c1.qty === item.system_qty ? 'text-green-600' : 'text-orange-600'}`}>{c1.qty}</span></div>) : <span className="text-[9px] text-muted italic">Pendiente</span>}</td><td className="p-4">{c2 ? (<div className="flex flex-col"><span className="text-[8px] font-black text-muted uppercase truncate max-w-[80px]">{c2.user_name}</span><span className={`text-sm font-black ${c2.qty === item.system_qty ? 'text-green-600' : 'text-orange-600'}`}>{c2.qty}</span></div>) : <span className="text-[9px] text-muted italic">Pendiente</span>}</td><td className="p-4 text-center"><div className="relative group/edit"><input type="number" defaultValue={item.corrected_qty ?? ''} placeholder={item.system_qty.toString()} onBlur={e => handleAdminCorrection(item.id, e.target.value === '' ? null : parseFloat(e.target.value))} className={`w-24 bg-background border rounded-xl py-2 px-3 text-center text-sm font-black outline-none transition-all shadow-inner ${isAdminSet ? 'border-primary text-primary' : 'border-surfaceHighlight text-muted'}`} />{hasConflict && !isAdminSet && <AlertTriangle size={10} className="absolute -right-1 -top-1 text-orange-500 animate-bounce" />}</div></td><td className="p-4 text-right pr-10"><div className={`text-lg font-black italic flex items-center justify-end gap-2 ${diff === 0 ? 'text-muted/20' : diff > 0 ? 'text-green-600' : 'text-red-600'}`}>{diff > 0 && '+'} {diff}{diff > 0 ? <ArrowUpRight size={16}/> : diff < 0 ? <ArrowDownLeft size={16}/> : null}</div></td></tr>); })}</tbody></table></div></div></div>
        );
    }

    return (
        <div className="flex flex-col gap-8 pb-10 animate-in fade-in"><div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6"><div><h2 className="text-3xl font-black text-text tracking-tight uppercase italic flex items-center gap-3"><ClipboardCheck className="text-primary" size={36} />Auditorías de Stock</h2><p className="text-muted text-sm mt-1 font-medium">Controles físicos por depósito.</p></div>{isVale && (<button onClick={() => setMode('create')} className="bg-primary hover:bg-primaryHover text-white px-10 py-4 rounded-2xl font-black text-sm uppercase transition-all shadow-xl shadow-primary/20 active:scale-95 flex items-center gap-3"><Plus size={20} /> Crear Nuevo Control</button>)}</div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{isLoading ? (<div className="col-span-full py-20 flex justify-center"><Loader2 className="animate-spin text-primary" size={48} /></div>) : sessions.length === 0 ? (<div className="col-span-full py-24 text-center border-2 border-dashed border-surfaceHighlight rounded-3xl bg-surface/30 opacity-50"><Package size={48} className="mx-auto mb-4 text-muted" /><p className="font-black uppercase tracking-widest text-muted italic">No hay controles activos.</p></div>) : sessions.map(session => { const uniqueUsers = session.assigned_users || []; const alreadyIn = uniqueUsers.includes(currentUser.id); const isFull = uniqueUsers.length >= 2; const isConfirming = confirmingDeleteId === session.id; return (<div key={session.id} className="bg-surface border border-surfaceHighlight rounded-3xl p-7 shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col gap-6 relative overflow-hidden"><div className={`absolute top-0 left-0 w-2 h-full ${session.status === 'active' ? 'bg-primary' : 'bg-green-500'}`}></div><div className="flex justify-between items-start"><div className="min-w-0 flex-1"><h3 className="text-xl font-black text-text uppercase italic leading-tight group-hover:text-primary transition-colors truncate pr-2">{session.name}</h3><div className="flex flex-col gap-1.5 mt-3"><p className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5"><Warehouse size={12} className="text-primary"/> Depósito: {session.warehouse_name}</p><p className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5"><LayoutList size={12} className="text-primary"/> {session.item_count} Artículos</p><p className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5"><Calendar size={12} className="text-primary"/> {new Date(session.created_at).toLocaleDateString()}</p></div></div><div className="flex flex-col items-end gap-2 shrink-0">{isConfirming ? (<div className="flex items-center gap-1 animate-in slide-in-from-right-4 duration-300"><button onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }} className="px-3 py-2 bg-red-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-red-500/20 active:scale-90 transition-all">Confirmar</button><button onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(null); }} className="p-2 bg-surfaceHighlight text-text rounded-xl"><X size={14}/></button></div>) : (<button onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(session.id); setTimeout(() => setConfirmingDeleteId(null), 4000); }} className="p-2 text-muted hover:text-red-500 transition-colors bg-background rounded-xl border border-surfaceHighlight shadow-sm"><Trash2 size={18}/></button>)}</div></div><div className="space-y-4"><h4 className="text-[9px] font-black text-muted uppercase tracking-[0.2em] border-b border-surfaceHighlight pb-2 mb-3">Progreso</h4><div className="space-y-4">{(session.user_progress || []).map((prog: any, idx: number) => { const percentage = (prog.count / session.item_count) * 100; return (<div key={idx} className="space-y-2"><div className="flex justify-between items-center text-[10px] font-black uppercase"><span className="text-text flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Armador {idx + 1}</span><span className="text-primary bg-primary/10 px-2 py-0.5 rounded">{prog.count} / {session.item_count}</span></div><div className="h-2.5 w-full bg-background border border-surfaceHighlight rounded-full overflow-hidden shadow-inner"><div className="h-full bg-primary transition-all duration-700 ease-out" style={{ width: `${percentage}%` }} /></div></div>); })}{uniqueUsers.length < 2 && (<div className="flex items-center gap-3 p-4 bg-background border border-dashed border-surfaceHighlight rounded-2xl opacity-40"><UserIcon size={16} className="text-muted" /><span className="text-[10px] font-black text-muted uppercase tracking-widest">Esperando segundo...</span></div>)}</div></div><div className="mt-2 pt-4 border-t border-surfaceHighlight/50">{isVale ? (<button onClick={() => startSessionExecution(session)} className="w-full py-4 bg-slate-900 text-white hover:bg-slate-800 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-3 active:scale-95"><ArrowRightLeft size={18}/> Conciliar</button>) : (<button disabled={isFull && !alreadyIn} onClick={() => startSessionExecution(session)} className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95 ${alreadyIn ? 'bg-green-600 text-white shadow-green-600/20' : isFull ? 'bg-surfaceHighlight text-muted opacity-50' : 'bg-primary text-white shadow-primary/20'}`}>{alreadyIn ? <RotateCcw size={18}/> : <ClipboardCheck size={18}/>}{alreadyIn ? 'Continuar' : isFull ? 'Completa' : 'Comenzar'}</button>)}</div></div>); })}</div></div>
    );
};
