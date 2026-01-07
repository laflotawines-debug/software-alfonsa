
import React, { useState, useEffect, useMemo } from 'react';
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
    X,
    Import,
    ClipboardCheck,
    ChevronRight,
    History,
    CheckSquare,
    AlertTriangle,
    ArrowUpRight,
    ArrowDownLeft
} from 'lucide-react';
import { supabase } from '../supabase';
import { MasterProduct, WarehouseCode, User as UserType, StockControlSession } from '../types';

export const InventoryAdjustments: React.FC<{ currentUser: UserType }> = ({ currentUser }) => {
    const [mode, setMode] = useState<'manual' | 'import_select' | 'import_review'>('manual');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<MasterProduct[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<MasterProduct | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    // Manual Form states
    const [warehouse, setWarehouse] = useState<string>('LLERENA');
    const [quantity, setQuantity] = useState('');
    const [reasonType, setReasonType] = useState('Merma');
    const [reasonText, setReasonText] = useState('');

    // Import states
    const [availableSessions, setAvailableSessions] = useState<any[]>([]);
    const [selectedSession, setSelectedSession] = useState<any | null>(null);
    const [diffItems, setDiffItems] = useState<any[]>([]);

    const fetchSessions = async () => {
        setIsLoading(true);
        try {
            const { data } = await supabase
                .from('stock_control_sessions')
                .select('*, warehouses(name), stock_control_items(id, codart, system_qty, corrected_qty)')
                .order('created_at', { ascending: false });
            
            if (data) {
                // Solo mostrar sesiones que tengan ítems con diferencias
                const sessionsWithDiffs = data.filter(s => {
                    return s.stock_control_items?.some((i: any) => 
                        i.corrected_qty !== null && Math.round(i.corrected_qty) !== Math.round(i.system_qty)
                    );
                }).map(s => ({
                    ...s,
                    warehouse_name: s.warehouses?.name
                }));
                setAvailableSessions(sessionsWithDiffs);
            }
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    const handleSelectSession = (session: any) => {
        setSelectedSession(session);
        // Filtrar solo los ítems que tienen diferencias para la revisión
        const diffs = session.stock_control_items
            .filter((i: any) => i.corrected_qty !== null && Math.round(i.corrected_qty) !== Math.round(i.system_qty))
            .map((i: any) => ({
                ...i,
                diff: i.corrected_qty - i.system_qty
            }));
        setDiffItems(diffs);
        setMode('import_review');
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
                p_warehouse: warehouse,
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

    const handleBulkAdjust = async () => {
        if (!selectedSession || diffItems.length === 0) return;
        setIsSaving(true);
        try {
            const reason = `Ajuste Masivo Auditoría: ${selectedSession.name}`;
            const wh = selectedSession.warehouse_name;

            for (const item of diffItems) {
                const { error } = await supabase.rpc('ajustar_stock', {
                    p_warehouse: wh,
                    p_codart: item.codart,
                    p_quantity: item.diff,
                    p_reason: reason,
                    p_user_id: currentUser.id
                });
                if (error) console.error(`Error ajustando ${item.codart}:`, error.message);
            }

            // Marcar sesión como finalizada si no lo estaba
            await supabase.from('stock_control_sessions').update({ status: 'finished' }).eq('id', selectedSession.id);

            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                setMode('manual');
                setSelectedSession(null);
                setDiffItems([]);
            }, 3000);
        } catch (e: any) {
            alert("Error procesando ajustes masivos: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const currentWarehouseStock = selectedProduct 
        ? (warehouse === 'LLERENA' ? (selectedProduct.stock_llerena || 0) : (selectedProduct.stock_betbeder || 0))
        : 0;
    
    const resultingStock = currentWarehouseStock + (parseFloat(quantity) || 0);

    // UI: SELECCIÓN DE SESIÓN
    if (mode === 'import_select') {
        return (
            <div className="flex flex-col gap-6 pb-10 max-w-4xl mx-auto animate-in slide-in-from-right">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setMode('manual')} className="p-2 rounded-full hover:bg-surfaceHighlight text-muted transition-colors"><ChevronRight className="rotate-180" size={24}/></button>
                        <h2 className="text-2xl font-black text-text uppercase italic">Importar desde Auditoría</h2>
                    </div>
                    {isLoading && <Loader2 size={24} className="animate-spin text-primary" />}
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {availableSessions.length === 0 ? (
                        <div className="py-20 text-center border-2 border-dashed border-surfaceHighlight rounded-3xl opacity-50">
                            <ClipboardCheck size={48} className="mx-auto mb-4 text-muted" />
                            <p className="font-bold text-muted uppercase">No hay auditorías con diferencias pendientes de ajuste.</p>
                        </div>
                    ) : availableSessions.map(session => (
                        <button 
                            key={session.id} 
                            onClick={() => handleSelectSession(session)}
                            className="bg-surface border border-surfaceHighlight p-6 rounded-3xl flex items-center justify-between hover:border-primary group transition-all text-left shadow-sm"
                        >
                            <div className="flex items-center gap-5">
                                <div className="p-4 bg-background border border-surfaceHighlight rounded-2xl text-primary group-hover:border-primary/30 shadow-inner">
                                    <ClipboardCheck size={24}/>
                                </div>
                                <div>
                                    <h4 className="text-lg font-black text-text uppercase italic leading-tight">{session.name}</h4>
                                    <div className="flex gap-3 mt-1">
                                        <span className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1"><Warehouse size={12}/> {session.warehouse_name}</span>
                                        <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-1"><AlertTriangle size={12}/> Diferencias detectadas</span>
                                    </div>
                                </div>
                            </div>
                            <ChevronRight size={24} className="text-muted group-hover:text-primary transition-all"/>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // UI: REVISIÓN DE AJUSTES MASIVOS
    if (mode === 'import_review' && selectedSession) {
        return (
            <div className="flex flex-col gap-6 pb-10 max-w-5xl mx-auto animate-in zoom-in-95">
                <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border border-slate-700">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setMode('import_select')} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-all"><ChevronRight className="rotate-180" size={24}/></button>
                        <div>
                            <h2 className="text-2xl font-black uppercase italic tracking-tight">{selectedSession.name}</h2>
                            <p className="text-[10px] opacity-60 font-black uppercase tracking-[0.2em] mt-1">Aplicando ajustes en Depósito: <span className="text-primary">{selectedSession.warehouse_name}</span></p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                         <span className="text-[10px] font-black uppercase bg-orange-500 text-white px-3 py-1.5 rounded-full shadow-lg shadow-orange-900/40">{diffItems.length} Diferencias</span>
                    </div>
                </div>

                <div className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                        <thead className="bg-background/50 border-b border-surfaceHighlight text-[10px] text-muted font-black uppercase tracking-widest">
                            <tr>
                                <th className="p-4 pl-8">Artículo</th>
                                <th className="p-4 text-center">Stock Sistema</th>
                                <th className="p-4 text-center">Stock Real (Contado)</th>
                                <th className="p-4 text-right pr-8">Ajuste a Realizar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surfaceHighlight">
                            {diffItems.map((item, idx) => (
                                <tr key={idx} className="hover:bg-primary/5 transition-colors">
                                    <td className="p-4 pl-8">
                                        <p className="text-xs font-black text-text uppercase">Art. #{item.codart}</p>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="text-xs font-bold text-muted">{item.system_qty}</span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="text-xs font-black text-text bg-background px-3 py-1.5 rounded-xl border border-surfaceHighlight">{item.corrected_qty}</span>
                                    </td>
                                    <td className="p-4 text-right pr-8">
                                        <div className={`text-lg font-black italic flex items-center justify-end gap-2 ${item.diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {item.diff > 0 && '+'} {item.diff}
                                            {item.diff > 0 ? <ArrowUpRight size={18}/> : <ArrowDownLeft size={18}/>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col gap-4">
                    {success ? (
                        <div className="flex flex-col items-center justify-center p-8 bg-green-500/10 border border-green-500/20 rounded-3xl text-green-600 gap-3 animate-in zoom-in-95">
                            <CheckCircle2 size={48} />
                            <h4 className="text-xl font-black uppercase italic">¡Ajustes Masivos Aplicados!</h4>
                            <p className="text-sm font-bold opacity-80 uppercase tracking-widest">El stock ha sido sincronizado con éxito.</p>
                        </div>
                    ) : (
                        <button 
                            onClick={handleBulkAdjust}
                            disabled={isSaving}
                            className="w-full py-6 bg-primary hover:bg-primaryHover text-white rounded-3xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 size={24} className="animate-spin mx-auto" /> : `Procesar ${diffItems.length} Ajustes en ${selectedSession.warehouse_name}`}
                        </button>
                    )}
                    <button onClick={() => setMode('manual')} className="text-[10px] font-black text-muted hover:text-text uppercase tracking-widest text-center py-2 transition-colors">Cancelar y Volver al modo manual</button>
                </div>
            </div>
        );
    }

    // UI: MODO MANUAL (PREDETERMINADO)
    return (
        <div className="flex flex-col gap-8 pb-10 max-w-4xl mx-auto animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight flex items-center gap-3 uppercase italic">
                        <Calculator className="text-primary" size={32} />
                        Ajustes de Stock
                    </h2>
                    <p className="text-muted text-sm mt-1 font-medium italic">Correciones manuales para mermas, roturas o sobrantes.</p>
                </div>
                <button 
                    onClick={() => { setMode('import_select'); fetchSessions(); }}
                    className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-surface border border-surfaceHighlight text-text hover:text-primary transition-all font-black text-[11px] uppercase shadow-sm group"
                >
                    <Import size={18} className="group-hover:translate-y-[-2px] transition-transform" />
                    Importar de Auditoría
                </button>
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
                        </div>
                    </div>
                )}
            </div>
            
            <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 flex gap-4">
                <Info size={24} className="text-primary shrink-0" />
                <div>
                    <h4 className="text-xs font-black text-primary uppercase tracking-widest">Integridad de Auditoría</h4>
                    <p className="text-[10px] text-muted font-bold leading-relaxed uppercase mt-1">Al importar desde auditoría, solo se procesarán los artículos donde el administrador haya validado la cantidad corregida.</p>
                </div>
            </div>
        </div>
    );
};
