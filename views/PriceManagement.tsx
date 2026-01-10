
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, 
    RefreshCw, 
    Loader2, 
    DollarSign, 
    Save,
    Building2,
    Zap,
    Percent,
    CheckSquare,
    Square,
    ArrowUpRight,
    ArrowDownRight,
    AlertCircle,
    Check,
    ListChecks,
    X,
    AlertTriangle
} from 'lucide-react';
import { supabase } from '../supabase';
import { MasterProduct, User } from '../types';
import { roundToCommercial } from '../logic';

interface PriceManagementProps {
    currentUser: User;
}

interface PriceProposal {
    codart: string;
    desart: string;
    dbOriginal: number[]; 
    proposed: number[];   
    isModified: boolean;
}

export const PriceManagement: React.FC<PriceManagementProps> = ({ currentUser }) => {
    const [dbProducts, setDbProducts] = useState<MasterProduct[]>([]); 
    const [workingProducts, setWorkingProducts] = useState<MasterProduct[]>([]); 
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [providerFilter, setProviderFilter] = useState('TODOS');
    const [percentages, setPercentages] = useState<{ [key: number]: string }>({ 1: '0', 2: '0', 3: '0' });
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [pendingPayload, setPendingPayload] = useState<any[]>([]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const PAGE_SIZE = 1000;
            let allProducts: MasterProduct[] = [];
            let from = 0;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('master_products')
                    .select('*')
                    .order('desart', { ascending: true })
                    .range(from, from + PAGE_SIZE - 1);
                
                if (error) throw error;
                if (data && data.length > 0) {
                    allProducts = [...allProducts, ...data];
                    if (data.length < PAGE_SIZE) hasMore = false;
                    else from += PAGE_SIZE;
                } else {
                    hasMore = false;
                }
            }
            setDbProducts(allProducts);
            setWorkingProducts(allProducts);
            setPercentages({ 1: '0', 2: '0', 3: '0' });
            setSelectedIds(new Set());
        } catch (err: any) {
            console.error("Error cargando maestro:", err);
            alert("Error al cargar los productos.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const providers = useMemo(() => {
        const unique = Array.from(new Set(dbProducts.map(p => p.nomprov).filter(Boolean)));
        return ['TODOS', ...unique.sort()];
    }, [dbProducts]);

    const proposals = useMemo((): PriceProposal[] => {
        return workingProducts.map(p => {
            const original = dbProducts.find(db => db.codart === p.codart);
            const dbOriginal = [
                original?.pventa_1 || 0, 
                original?.pventa_2 || 0, 
                original?.pventa_3 || 0, 
                original?.pventa_4 || 0
            ];
            const proposed = [p.pventa_1, p.pventa_2, p.pventa_3, p.pventa_4];

            [1, 2, 3].forEach(listNum => {
                const pct = parseFloat(percentages[listNum]) || 0;
                if (pct !== 0) {
                    const increased = proposed[listNum - 1] * (1 + pct / 100);
                    proposed[listNum - 1] = roundToCommercial(increased);
                } else {
                    proposed[listNum - 1] = roundToCommercial(proposed[listNum - 1]);
                }
            });

            const rawL4 = proposed[1] * 0.92; 
            proposed[3] = roundToCommercial(rawL4);
            const isModified = proposed.some((val, idx) => Math.round(val) !== Math.round(dbOriginal[idx]));

            return { codart: p.codart, desart: p.desart, dbOriginal, proposed, isModified };
        });
    }, [dbProducts, workingProducts, percentages]);

    const filteredProposals = useMemo(() => {
        // Lógica de búsqueda tipo Google
        const keywords = searchTerm.toLowerCase().split(/\s+/).filter(k => k.length > 0);
        
        return proposals.filter(p => {
            const prod = workingProducts.find(orig => orig.codart === p.codart);
            const textToSearch = `${p.desart} ${p.codart}`.toLowerCase();
            
            const matchesSearch = keywords.every(k => textToSearch.includes(k));
            const matchesProv = providerFilter === 'TODOS' || prod?.nomprov === providerFilter;
            return matchesSearch && matchesProv;
        });
    }, [proposals, searchTerm, providerFilter, workingProducts]);

    const toggleSelectAllFiltered = () => {
        if (selectedIds.size >= filteredProposals.length && filteredProposals.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredProposals.map(p => p.codart)));
        }
    };

    const selectOnlyModified = () => {
        const modified = filteredProposals.filter(p => p.isModified);
        if (modified.length === 0) return alert("No hay cambios detectados.");
        setSelectedIds(new Set(modified.map(p => p.codart)));
    };

    const prepareSave = () => {
        let targetProposals = proposals.filter(p => selectedIds.has(p.codart));
        if (targetProposals.length === 0) {
            targetProposals = filteredProposals.filter(p => p.isModified);
        }
        if (targetProposals.length === 0) return alert("Sin cambios.");
        const payload = targetProposals.map(p => ({
            codart: p.codart,
            pventa_1: Math.round(p.proposed[0]),
            pventa_2: Math.round(p.proposed[1]),
            pventa_3: Math.round(p.proposed[2]),
            pventa_4: Math.round(p.proposed[3]),
            updated_at: new Date().toISOString()
        }));
        setPendingPayload(payload);
        setIsConfirmModalOpen(true);
    };

    const executeSave = async () => {
        if (pendingPayload.length === 0) return;
        setIsSaving(true);
        setIsConfirmModalOpen(false);
        try {
            const updatePromises = pendingPayload.map(async (item) => {
                const { error } = await supabase.from('master_products').update({
                    pventa_1: item.pventa_1, pventa_2: item.pventa_2, pventa_3: item.pventa_3, pventa_4: item.pventa_4, updated_at: item.updated_at
                }).eq('codart', item.codart);
                return { codart: item.codart, success: !error };
            });
            const results = await Promise.all(updatePromises);
            const successfulCount = results.filter(r => r.success).length;
            alert(`Éxito! Se sincronizaron ${successfulCount} artículos.`);
            setPendingPayload([]);
            await fetchData(); 
        } catch (err: any) {
            alert("Error al guardar.");
        } finally {
            setIsSaving(false);
        }
    };

    if (currentUser.role !== 'vale') return <div className="p-20 text-center font-black uppercase opacity-20">Acceso Denegado</div>;

    const modifiedInFilterCount = filteredProposals.filter(p => p.isModified).length;

    return (
        <div className="flex flex-col gap-6 pb-20 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight flex items-center gap-3 uppercase italic">
                        <DollarSign className="text-primary" size={32} /> Gestión Masiva de Precios
                    </h2>
                    <p className="text-muted text-sm mt-1 font-medium italic">Sincronización masiva con redondeo comercial (50/100).</p>
                </div>
                <button onClick={fetchData} className="p-4 rounded-2xl bg-surface border border-surfaceHighlight text-muted hover:text-primary transition-all shadow-sm">
                    <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {[1, 2, 3].map(num => (
                    <div key={num} className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest">Ajuste Lista {num}</span>
                            <Percent size={14} className="text-primary" />
                        </div>
                        <div className="relative">
                            <input type="number" value={percentages[num]} onChange={e => setPercentages({...percentages, [num]: e.target.value})} className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 px-6 text-2xl font-black text-text outline-none focus:border-primary transition-all shadow-inner" />
                            <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-muted">%</span>
                        </div>
                    </div>
                ))}
                <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 shadow-sm flex flex-col justify-center items-center gap-2 group">
                    <div className="flex items-center gap-2 text-primary"><Zap size={18} className="animate-pulse" /><span className="text-[10px] font-black uppercase tracking-widest">Lista 4 Automatizada</span></div>
                    <p className="text-[11px] font-bold text-text text-center leading-tight uppercase">L4 se calcula como:<br/>L2 Propuesta - 8%</p>
                    <p className="text-[9px] font-bold text-muted uppercase text-center tracking-tighter italic mt-1">Redondeo final a 50 incluido</p>
                </div>
            </div>

            <div className="bg-surface border border-surfaceHighlight rounded-3xl p-5 shadow-sm flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                    <input type="text" placeholder="Buscar por artículo o código..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary transition-all shadow-inner uppercase" />
                </div>
                <div className="w-full md:w-64 relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                    <select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 pl-11 pr-4 text-sm font-black text-muted outline-none cursor-pointer appearance-none uppercase">
                        {providers.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
                <div className="flex gap-2 shrink-0"><button onClick={selectOnlyModified} className="bg-primary/10 text-primary px-4 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-primary/20 hover:bg-primary/20 transition-all flex items-center gap-2"><ListChecks size={14}/> Marcar Modificados ({modifiedInFilterCount})</button></div>
            </div>

            <div className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-background/50 text-[10px] text-muted uppercase font-black tracking-widest border-b border-surfaceHighlight">
                            <tr>
                                <th className="p-4 w-12 text-center"><button onClick={toggleSelectAllFiltered}>{selectedIds.size > 0 && selectedIds.size >= filteredProposals.length ? <CheckSquare className="text-primary" /> : <Square />}</button></th>
                                <th className="p-4">Artículo</th>
                                <th className="p-4 text-right">Lista 1 (x50)</th>
                                <th className="p-4 text-right">Lista 2</th>
                                <th className="p-4 text-right">Lista 3</th>
                                <th className="p-4 text-right">Lista 4 (-8%)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surfaceHighlight">
                            {isLoading ? (
                                <tr><td colSpan={6} className="p-20 text-center"><Loader2 size={48} className="animate-spin text-primary mx-auto" /></td></tr>
                            ) : filteredProposals.length === 0 ? (
                                <tr><td colSpan={6} className="p-20 text-center text-muted font-bold italic uppercase">Sin resultados.</td></tr>
                            ) : filteredProposals.map((p) => {
                                const isSelected = selectedIds.has(p.codart);
                                return (
                                    <tr key={p.codart} onClick={() => { const next = new Set(selectedIds); if (next.has(p.codart)) next.delete(p.codart); else next.add(p.codart); setSelectedIds(next); }} className={`group hover:bg-primary/5 transition-colors cursor-pointer ${isSelected ? 'bg-primary/5' : ''} ${p.isModified ? 'bg-green-50/20 dark:bg-green-900/10' : ''}`}>
                                        <td className="p-4 text-center">{isSelected ? <CheckSquare className="text-primary mx-auto" /> : <Square className="mx-auto" />}</td>
                                        <td className="p-4"><div className="flex flex-col"><span className="text-xs font-black text-text uppercase leading-tight truncate max-w-[250px]">{p.desart}</span><div className="flex items-center gap-2 mt-0.5"><span className="text-[9px] font-mono text-muted">#{p.codart}</span>{p.isModified && <span className="text-[8px] bg-green-600 text-white px-1.5 py-0.5 rounded font-black uppercase animate-pulse">Pendiente</span>}</div></div></td>
                                        {[0, 1, 2, 3].map(idx => {
                                            const originalVal = Math.round(p.dbOriginal[idx]);
                                            const proposedVal = Math.round(p.proposed[idx]);
                                            const isChanged = proposedVal !== originalVal;
                                            const isL4 = idx === 3;
                                            return (
                                                <td key={idx} className={`p-4 text-right ${isL4 ? 'bg-primary/5' : ''}`}>
                                                    <div className="flex flex-col items-end"><span className={`text-xs font-black ${isChanged ? 'text-primary' : 'text-text'}`}>$ {proposedVal.toLocaleString('es-AR')}</span>{isChanged && (<div className="flex items-center gap-1 text-[8px] font-black uppercase text-muted">{proposedVal > originalVal ? <ArrowUpRight size={8} className="text-green-500" /> : <ArrowDownRight size={8} className="text-red-500" />} $ {originalVal.toLocaleString('es-AR')}</div>)}</div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-4">
                <button onClick={prepareSave} disabled={isSaving} className={`w-full p-6 rounded-3xl font-black uppercase tracking-[0.2em] shadow-2xl transition-all flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${(selectedIds.size > 0 || modifiedInFilterCount > 0) ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-surfaceHighlight text-muted'}`}>
                    {isSaving ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
                    {isSaving ? 'Sincronizando...' : (selectedIds.size > 0 ? `Confirmar ${selectedIds.size} marcados` : `Confirmar ${modifiedInFilterCount} cambios en filtro`)}
                </button>
            </div>

            {isConfirmModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-surface w-full max-w-md rounded-[2.5rem] border border-primary/20 shadow-2xl p-10 flex flex-col items-center text-center gap-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-primary"></div>
                        <div className="p-6 bg-primary/10 rounded-full text-primary"><AlertTriangle size={48} /></div>
                        <div className="space-y-3"><h3 className="text-2xl font-black text-text uppercase italic tracking-tight">¿Sincronizar Cambios?</h3><p className="text-sm text-muted font-medium leading-relaxed uppercase">Se actualizarán <span className="text-primary font-black">{pendingPayload.length} artículos</span>.<br/><span className="text-[10px] mt-2 block">Los precios se redondearán a múltiplos de 50.</span></p></div>
                        <div className="flex flex-col w-full gap-3"><button onClick={executeSave} className="w-full py-5 bg-primary hover:bg-primaryHover text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 uppercase text-xs flex items-center justify-center gap-2"><Check size={18} /> Confirmar Guardado</button><button onClick={() => { setIsConfirmModalOpen(false); setPendingPayload([]); }} className="w-full py-5 bg-surfaceHighlight text-text font-black rounded-2xl transition-all hover:bg-surfaceHighlight/80 uppercase text-xs tracking-widest">Cancelar</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};
