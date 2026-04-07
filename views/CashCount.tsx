
import React, { useState, useMemo, useEffect } from 'react';
import { 
    Banknote, 
    RefreshCw, 
    CheckCircle2, 
    TrendingUp, 
    DollarSign, 
    Calculator, 
    AlertTriangle, 
    Wallet, 
    Calendar, 
    Plus, 
    Trash2, 
    X, 
    Loader2, 
    History, 
    ChevronDown, 
    ChevronRight, 
    Eye,
    ArrowDownCircle,
    Save
} from 'lucide-react';
import { supabase } from '../supabase';
import { User } from '../types';

const FajoRow: React.FC<{ label: string, value: number, onChange: (v: number) => void, multiplier: number, color?: string }> = ({ label, value, onChange, multiplier, color = "text-text" }) => {
    const subtotal = value * multiplier;
    return (
        <div className="flex items-center justify-between p-4 border-b border-surfaceHighlight last:border-none hover:bg-surfaceHighlight/20 transition-colors">
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${color.replace('text-', 'bg-')}`}></div>
                <span className={`text-sm font-bold uppercase ${color}`}>{label}</span>
            </div>
            <div className="flex items-center gap-6">
                <input 
                    type="number" 
                    value={value === 0 ? '' : value}
                    onChange={e => onChange(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="w-20 bg-surface border border-surfaceHighlight rounded-xl py-2 text-center font-black text-text outline-none focus:border-primary shadow-inner"
                />
                <div className="w-32 text-right">
                    <span className="text-xs font-bold text-muted uppercase block tracking-wider text-[8px]">Subtotal</span>
                    <span className="text-sm font-black text-text opacity-60">$ {subtotal === 0 ? '-' : subtotal.toLocaleString('es-AR')}</span>
                </div>
            </div>
        </div>
    );
};

interface ChequeItem {
    id: string;
    amount: number;
}

interface CashCountRecord {
    id: string;
    created_at: string;
    created_by?: string;
    status?: 'borrador' | 'cerrado';
    updated_at?: string;
    // Totales
    physical_total: number;
    system_total: number;
    difference: number;
    // Detalle Efectivo
    initial_change: number;
    loose_cash: number;
    bundles_1k: number;
    bundles_2k: number;
    bundles_10k: number;
    bundles_20k: number;
    // Detalle USD
    usd_quantity: number;
    usd_rate: number;
    usd_total_ars: number;
    // Detalle Cheques
    cheques_count: number;
    cheques_total: number;
    cheques_detail: ChequeItem[];
}

const MathInput = ({ value, onChange, placeholder }: { value: number, onChange: (val: number) => void, placeholder?: string }) => {
    const [localValue, setLocalValue] = useState(value === 0 ? '' : value.toLocaleString('es-AR'));

    // Sync from parent if changed externally (e.g. loaded from DB)
    useEffect(() => {
        // Only override if we are not currently typing an expression
        if (!/[+\-*/]/.test(localValue)) {
            setLocalValue(value === 0 ? '' : value.toLocaleString('es-AR'));
        }
    }, [value]);

    const evaluateExpression = (expr: string): number | null => {
        try {
            // Remove dots (thousands separators), equals signs, and spaces
            const cleanExpr = expr.replace(/[=.\s]/g, '');
            if (/^[\d+\-*/]+$/.test(cleanExpr)) {
                // eslint-disable-next-line no-new-func
                const result = new Function('return ' + cleanExpr)();
                if (!isNaN(result) && isFinite(result)) {
                    return Math.round(result);
                }
            }
        } catch (e) {
            // ignore
        }
        return null;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        
        if (val.includes('=')) {
            const result = evaluateExpression(val);
            if (result !== null) {
                onChange(result);
                setLocalValue(result.toLocaleString('es-AR'));
                return;
            }
        }
        
        setLocalValue(val);
        
        // If it's just a number (can include dots), update parent immediately
        if (!/[+\-*/=]/.test(val)) {
            const num = parseInt(val.replace(/\./g, '')) || 0;
            onChange(num);
        }
    };

    const handleBlur = () => {
        const result = evaluateExpression(localValue);
        if (result !== null) {
            onChange(result);
            setLocalValue(result === 0 ? '' : result.toLocaleString('es-AR'));
        } else {
            const num = parseInt(localValue.replace(/\./g, '')) || 0;
            onChange(num);
            setLocalValue(num === 0 ? '' : num.toLocaleString('es-AR'));
        }
    };

    return (
        <input 
            type="text" 
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            className="w-32 bg-surface border border-surfaceHighlight rounded-xl py-2 px-3 text-right font-black text-text outline-none focus:border-primary shadow-inner"
        />
    );
};

export const CashCount: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [view, setView] = useState<'new' | 'history'>('new');
    const [history, setHistory] = useState<CashCountRecord[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    
    // Estado para saber si estamos editando un borrador existente o creando uno nuevo
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
    const [dataOriginMessage, setDataOriginMessage] = useState<string | null>(null);

    // Basic Inputs
    const [initialChange, setInitialChange] = useState(0);
    const [looseCash, setLooseCash] = useState(0); // Popurrí

    // Bundles (Fajos x100)
    const [bundles1k, setBundles1k] = useState(0);
    const [bundles2k, setBundles2k] = useState(0);
    const [bundles10k, setBundles10k] = useState(0);
    const [bundles20k, setBundles20k] = useState(0);

    // USD Logic
    const [usdQuantity, setUsdQuantity] = useState(0);
    const [usdRate, setUsdRate] = useState(0);

    // Cheques Logic
    const [chequeList, setChequeList] = useState<ChequeItem[]>([]);
    const [chequeInput, setChequeInput] = useState('');

    // System Comparison
    const [systemTotal, setSystemTotal] = useState(0);
    
    // UI State
    const [isSaving, setIsSaving] = useState(false);

    // --- EFFECTS ---
    useEffect(() => {
        if (view === 'history') {
            fetchHistory();
        } else if (view === 'new') {
            fetchLatestSession();
        }
    }, [view]);

    const fetchLatestSession = async () => {
        try {
            // Buscamos el último registro creado por CUALQUIERA, o filtrado por usuario si se prefiere.
            // Aquí traemos el último global para mantener continuidad de caja.
            const { data, error } = await supabase
                .from('cash_counts')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                // Cargar los valores siempre
                setInitialChange(data.initial_change || 0);
                setLooseCash(data.loose_cash || 0);
                setBundles1k(data.bundles_1k || 0);
                setBundles2k(data.bundles_2k || 0);
                setBundles10k(data.bundles_10k || 0);
                setBundles20k(data.bundles_20k || 0);
                setUsdQuantity(data.usd_quantity || 0);
                setUsdRate(data.usd_rate || 0);
                
                if (Array.isArray(data.cheques_detail)) {
                    setChequeList(data.cheques_detail);
                }

                // LÓGICA CRÍTICA:
                // Si el último registro es un BORRADOR, lo retomamos (seteamos currentDraftId).
                // Si el último registro está CERRADO, cargamos los datos como plantilla pero currentDraftId es NULL (será uno nuevo).
                
                if (data.status === 'borrador') {
                    setCurrentDraftId(data.id);
                    setSystemTotal(data.system_total || 0); // En borrador recuperamos también el total sistema
                    setDataOriginMessage(`Continuando borrador del ${new Date(data.created_at).toLocaleDateString()}`);
                } else {
                    setCurrentDraftId(null);
                    setSystemTotal(0); // Empezamos sistema de cero si es un día nuevo
                    setDataOriginMessage("Valores iniciales cargados del cierre anterior.");
                }

                // Limpiar mensaje
                setTimeout(() => setDataOriginMessage(null), 5000);
            }
        } catch (e) {
            console.error("Error loading session:", e);
        }
    };

    const fetchHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('cash_counts')
                .select('*')
                .eq('status', 'cerrado') // Solo mostrar cerrados en historial
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            setHistory(data || []);
        } catch (e) {
            console.error("Error fetching history:", e);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    // --- CALCULATIONS ---

    const totalBundles = useMemo(() => {
        return (
            (bundles1k * 100 * 1000) + 
            (bundles2k * 100 * 2000) + 
            (bundles10k * 100 * 10000) + 
            (bundles20k * 100 * 20000)
        );
    }, [bundles1k, bundles2k, bundles10k, bundles20k]);

    const totalCash = useMemo(() => {
        return initialChange + looseCash + totalBundles;
    }, [initialChange, looseCash, totalBundles]);

    const totalUsdArs = useMemo(() => {
        return usdQuantity * usdRate;
    }, [usdQuantity, usdRate]);

    const totalCheques = useMemo(() => {
        return chequeList.reduce((acc, curr) => acc + curr.amount, 0);
    }, [chequeList]);

    const physicalTotal = useMemo(() => {
        return totalCash + totalUsdArs + totalCheques;
    }, [totalCash, totalUsdArs, totalCheques]);

    const difference = physicalTotal - systemTotal;

    // --- HANDLERS ---

    const handleAddCheque = () => {
        const val = parseInt(chequeInput.replace(/\./g, ''));
        if (val > 0) {
            setChequeList([...chequeList, { id: Math.random().toString(36), amount: val }]);
            setChequeInput('');
        }
    };

    const handleRemoveCheque = (id: string) => {
        setChequeList(prev => prev.filter(c => c.id !== id));
    };

    const resetForm = () => {
        setInitialChange(0);
        setLooseCash(0);
        setBundles1k(0);
        setBundles2k(0);
        setBundles10k(0);
        setBundles20k(0);
        setUsdQuantity(0);
        setUsdRate(0);
        setChequeList([]);
        setSystemTotal(0);
        setCurrentDraftId(null);
    };

    const handleClear = () => {
        if(confirm("¿Limpiar formulario? Esto reiniciará los campos a cero.")) {
            resetForm();
        }
    };

    const saveData = async (status: 'borrador' | 'cerrado') => {
        // Validaciones básicas
        const pTotal = Number(physicalTotal) || 0;
        const sTotal = Number(systemTotal) || 0;
        
        // Si intenta cerrar caja con todo en 0, alertar (pero permitir guardar borrador vacío si quiere)
        if (status === 'cerrado' && pTotal === 0 && sTotal === 0) {
            alert("⚠️ No puedes cerrar una caja vacía. Ingresa los valores contados.");
            return;
        }

        if (status === 'cerrado' && !confirm("¿Confirmar CIERRE DE CAJA?\n\nEsto finalizará el turno y guardará el historial definitivo.")) {
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                created_by: currentUser.id,
                status: status, // 'borrador' o 'cerrado'
                physical_total: pTotal,
                system_total: sTotal,
                difference: pTotal - sTotal,
                
                // Desglose
                initial_change: Number(initialChange) || 0,
                loose_cash: Number(looseCash) || 0,
                bundles_1k: Number(bundles1k) || 0,
                bundles_2k: Number(bundles2k) || 0,
                bundles_10k: Number(bundles10k) || 0,
                bundles_20k: Number(bundles20k) || 0,
                usd_quantity: Number(usdQuantity) || 0,
                usd_rate: Number(usdRate) || 0,
                usd_total_ars: Number(totalUsdArs) || 0,
                cheques_count: chequeList.length,
                cheques_total: Number(totalCheques) || 0,
                cheques_detail: chequeList,
                updated_at: new Date().toISOString()
            };

            if (currentDraftId) {
                // ACTUALIZAR REGISTRO EXISTENTE (Borrador -> Borrador o Borrador -> Cerrado)
                const { error } = await supabase
                    .from('cash_counts')
                    .update(payload)
                    .eq('id', currentDraftId);
                
                if (error) throw error;
                
                if (status === 'cerrado') {
                    alert("✅ Caja Cerrada Exitosamente.");
                    setCurrentDraftId(null);
                    await fetchHistory();
                    setView('history');
                } else {
                    // Feedback visual sutil podría ir aquí
                    setDataOriginMessage("Borrador actualizado " + new Date().toLocaleTimeString());
                    setTimeout(() => setDataOriginMessage(null), 3000);
                }

            } else {
                // INSERTAR NUEVO REGISTRO
                const { data, error } = await supabase
                    .from('cash_counts')
                    .insert([payload])
                    .select()
                    .single();
                
                if (error) throw error;

                if (status === 'borrador') {
                    setCurrentDraftId(data.id); // Ahora estamos editando este ID
                    setDataOriginMessage("Borrador creado");
                    setTimeout(() => setDataOriginMessage(null), 3000);
                } else {
                    alert("✅ Caja Cerrada Exitosamente.");
                    setCurrentDraftId(null);
                    await fetchHistory();
                    setView('history');
                }
            }

        } catch (e: any) {
            console.error("Error saving:", e);
            alert("Error al guardar: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const performDeleteRecord = async (id: string) => {
        try {
            const { error } = await supabase.from('cash_counts').delete().eq('id', id);
            if (error) throw error;
            setHistory(prev => prev.filter(r => r.id !== id));
            setDeletingId(null);
        } catch (e: any) {
            alert("Error al eliminar: " + e.message);
        }
    };

    return (
        <div className="flex flex-col gap-6 pb-40 animate-in fade-in max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight flex items-center gap-3 uppercase italic">
                        <Banknote className="text-primary" size={32} /> Arqueo de Caja
                    </h2>
                    <p className="text-muted text-sm mt-1 font-medium italic">Control y cierre de caja diario.</p>
                </div>
                
                {/* TABS */}
                <div className="flex bg-surface p-1 rounded-2xl border border-surfaceHighlight shadow-sm">
                    <button 
                        onClick={() => setView('new')} 
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${view === 'new' ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-text'}`}
                    >
                        <Calculator size={16}/> Operación
                    </button>
                    <button 
                        onClick={() => setView('history')} 
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${view === 'history' ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-text'}`}
                    >
                        <History size={16}/> Historial
                    </button>
                </div>
            </div>

            {view === 'new' ? (
                <>
                    {dataOriginMessage && (
                        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-600 px-4 py-3 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
                            <ArrowDownCircle size={20} />
                            <div>
                                <p className="text-xs font-black uppercase">Estado</p>
                                <p className="text-[10px] font-medium opacity-80">{dataOriginMessage}</p>
                            </div>
                        </div>
                    )}

                    <div className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm animate-in slide-in-from-left-4">
                        {/* SECCIÓN 1: GENERAL */}
                        <div className="p-4 bg-background/50 border-b border-surfaceHighlight flex justify-between items-center">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest">Detalle General</span>
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest">Cantidad / Monto</span>
                        </div>
                        <div className="p-2">
                            <div className="flex items-center justify-between p-4 border-b border-surfaceHighlight">
                                <span className="text-sm font-bold uppercase text-text">CAMBIO INICIAL</span>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-black text-text hidden sm:block">$ {initialChange.toLocaleString('es-AR')}</span>
                                    <MathInput 
                                        value={initialChange}
                                        onChange={setInitialChange}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-4">
                                <span className="text-sm font-bold uppercase text-text">POPURRÍ (Sueltos)</span>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-black text-text hidden sm:block">$ {looseCash.toLocaleString('es-AR')}</span>
                                    <MathInput 
                                        value={looseCash}
                                        onChange={setLooseCash}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* SECCIÓN 2: FAJOS */}
                        <div className="p-4 bg-background/50 border-y border-surfaceHighlight flex justify-between items-center">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest">Fajos de Billetes (x100 un.)</span>
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest">Cantidad de Fajos</span>
                        </div>
                        <div className="p-2">
                            <FajoRow label="FAJOS x 1.000" value={bundles1k} onChange={setBundles1k} multiplier={100000} color="text-orange-500" />
                            <FajoRow label="FAJOS x 2.000" value={bundles2k} onChange={setBundles2k} multiplier={200000} color="text-blue-500" />
                            <FajoRow label="FAJOS x 10.000" value={bundles10k} onChange={setBundles10k} multiplier={1000000} color="text-purple-500" />
                            <FajoRow label="FAJOS x 20.000" value={bundles20k} onChange={setBundles20k} multiplier={2000000} color="text-red-500" />
                        </div>

                        {/* SECCIÓN 3: VALORES ADICIONALES */}
                        <div className="p-4 bg-background/50 border-y border-surfaceHighlight flex justify-between items-center">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest">Valores Adicionales</span>
                        </div>
                        <div className="p-2">
                            {/* DÓLARES */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-surfaceHighlight gap-4">
                                <span className="text-sm font-bold uppercase text-text flex items-center gap-2">
                                    <DollarSign size={16} className="text-green-600"/> USD (Dólares)
                                </span>
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold text-muted uppercase ml-1">Cantidad</span>
                                        <input 
                                            type="number" 
                                            value={usdQuantity === 0 ? '' : usdQuantity}
                                            onChange={e => setUsdQuantity(parseFloat(e.target.value) || 0)}
                                            placeholder="Cant."
                                            className="w-20 bg-surface border border-surfaceHighlight rounded-xl py-2 px-3 text-center font-black text-text outline-none focus:border-primary shadow-inner"
                                        />
                                    </div>
                                    <span className="mt-4 text-muted font-black">x</span>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold text-muted uppercase ml-1">Cotización</span>
                                        <input 
                                            type="number" 
                                            value={usdRate === 0 ? '' : usdRate}
                                            onChange={e => setUsdRate(parseFloat(e.target.value) || 0)}
                                            placeholder="$ Valor"
                                            className="w-24 bg-surface border border-surfaceHighlight rounded-xl py-2 px-3 text-center font-black text-text outline-none focus:border-primary shadow-inner"
                                        />
                                    </div>
                                    <span className="mt-4 text-muted font-black">=</span>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[9px] font-bold text-muted uppercase">Total ARS</span>
                                        <span className="text-lg font-black text-green-600">$ {totalUsdArs.toLocaleString('es-AR')}</span>
                                    </div>
                                </div>
                            </div>

                            {/* CHEQUES */}
                            <div className="flex flex-col p-4 gap-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold uppercase text-text flex items-center gap-2">
                                        <Wallet size={16} className="text-indigo-500"/> Cheques
                                    </span>
                                    <span className="text-sm font-black text-text">
                                        Total: $ {totalCheques.toLocaleString('es-AR')}
                                    </span>
                                </div>
                                
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={chequeInput}
                                        onChange={e => {
                                            // Permitir formato moneda mientras escribe
                                            const raw = e.target.value.replace(/\D/g, '');
                                            const val = parseInt(raw);
                                            if (!isNaN(val)) setChequeInput(val.toLocaleString('es-AR'));
                                            else setChequeInput('');
                                        }}
                                        onKeyDown={e => e.key === 'Enter' && handleAddCheque()}
                                        placeholder="Monto del cheque..."
                                        className="flex-1 bg-surface border border-surfaceHighlight rounded-xl py-2 px-4 text-sm font-black text-text outline-none focus:border-primary shadow-inner"
                                    />
                                    <button 
                                        onClick={handleAddCheque}
                                        disabled={!chequeInput}
                                        className="bg-surfaceHighlight hover:bg-primary hover:text-white text-text p-2 rounded-xl transition-all shadow-sm disabled:opacity-50"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>

                                {/* Lista de Cheques */}
                                {chequeList.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {chequeList.map(cheque => (
                                            <div key={cheque.id} className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 px-3 py-1.5 rounded-lg flex items-center gap-2 animate-in zoom-in">
                                                <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">$ {cheque.amount.toLocaleString('es-AR')}</span>
                                                <button onClick={() => handleRemoveCheque(cheque.id)} className="text-indigo-400 hover:text-red-500 transition-colors">
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* SECCIÓN RESUMEN INFORMATIVO */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-surface border border-surfaceHighlight rounded-2xl p-4 flex flex-col justify-between shadow-sm">
                            <p className="text-[10px] font-black text-muted uppercase tracking-widest">Efectivo Físico Total</p>
                            <p className="text-xl font-black text-text mt-1">$ {totalCash.toLocaleString('es-AR')}</p>
                            <p className="text-[9px] text-muted mt-1">(Popurrí + Cambio + Fajos)</p>
                        </div>
                        <div className="bg-surface border border-surfaceHighlight rounded-2xl p-4 flex flex-col justify-between shadow-sm">
                            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Total Cheques</p>
                            <p className="text-xl font-black text-indigo-600 mt-1">$ {totalCheques.toLocaleString('es-AR')}</p>
                            <p className="text-[9px] text-muted mt-1">({chequeList.length} cheques cargados)</p>
                        </div>
                        <div className="bg-surface border border-surfaceHighlight rounded-2xl p-4 flex flex-col justify-between shadow-sm">
                            <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Total Dólares (ARS)</p>
                            <p className="text-xl font-black text-green-600 mt-1">$ {totalUsdArs.toLocaleString('es-AR')}</p>
                            <p className="text-[9px] text-muted mt-1">({usdQuantity} USD x ${usdRate})</p>
                        </div>
                    </div>

                    {/* BARRA FLOTANTE DE RESULTADOS */}
                    <div className="fixed bottom-0 left-0 w-full bg-surface border-t border-surfaceHighlight p-3 md:p-6 shadow-2xl z-[70] animate-in slide-in-from-bottom-4">
                        <div className="max-w-5xl mx-auto flex flex-col xl:flex-row items-center gap-3 md:gap-6 justify-between">
                            
                            <div className="grid grid-cols-2 md:flex md:flex-row gap-2 md:gap-4 w-full xl:w-auto">
                                <div className="bg-green-500/10 border border-green-500/20 rounded-xl md:rounded-2xl p-2 md:p-3 flex-1 md:w-48 text-right">
                                    <p className="text-[8px] md:text-[9px] font-black text-green-700 uppercase tracking-widest">Total General</p>
                                    <p className="text-lg md:text-2xl font-black text-green-600 tracking-tighter truncate">$ {physicalTotal.toLocaleString('es-AR')}</p>
                                </div>
                                
                                <div className={`rounded-xl md:rounded-2xl p-2 md:p-3 flex-1 md:w-48 text-right border ${difference >= 0 ? 'bg-blue-500/10 border-blue-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                                    <p className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest ${difference >= 0 ? 'text-blue-700' : 'text-red-700'}`}>Diferencia</p>
                                    <div className="flex items-center justify-end gap-1 md:gap-2">
                                        {difference !== 0 && (difference > 0 ? <TrendingUp size={14} className="text-blue-500 md:w-4 md:h-4" /> : <AlertTriangle size={14} className="text-red-500 md:w-4 md:h-4" />)}
                                        <p className={`text-lg md:text-2xl font-black tracking-tighter truncate ${difference >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                            $ {difference.toLocaleString('es-AR')}
                                        </p>
                                    </div>
                                </div>

                                <div className="col-span-2 md:col-span-1 bg-slate-100 dark:bg-slate-900/50 border border-surfaceHighlight rounded-xl md:rounded-2xl p-2 md:p-3 flex-1 md:w-64">
                                    <p className="text-[8px] md:text-[9px] font-black text-muted uppercase tracking-widest mb-1 flex items-center gap-1"><Calculator size={10}/> Total en Sistema</p>
                                    <input 
                                        type="text" 
                                        value={systemTotal === 0 ? '' : systemTotal.toLocaleString('es-AR')}
                                        onChange={e => {
                                            const val = parseInt(e.target.value.replace(/\./g, '')) || 0;
                                            setSystemTotal(val);
                                        }}
                                        placeholder="Pegar Monto..."
                                        className="w-full bg-transparent text-lg md:text-xl font-black text-text outline-none placeholder-muted/30"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 md:gap-3 w-full xl:w-auto">
                                <button type="button" onClick={handleClear} className="px-3 py-3 md:px-4 md:py-4 rounded-xl md:rounded-2xl border border-surfaceHighlight bg-surface hover:bg-surfaceHighlight text-text font-black text-xs uppercase transition-all flex items-center justify-center gap-2">
                                    <RefreshCw size={16}/>
                                </button>
                                
                                {/* BOTÓN GUARDAR BORRADOR */}
                                <button 
                                    type="button"
                                    onClick={() => saveData('borrador')}
                                    disabled={isSaving}
                                    className="flex-1 px-4 py-3 md:px-6 md:py-4 rounded-xl md:rounded-2xl border-2 border-blue-500/50 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-black text-[10px] md:text-xs uppercase transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16}/>}
                                    <span className="hidden sm:inline">Guardar Cambios</span>
                                    <span className="sm:hidden">Guardar</span>
                                </button>

                                {/* BOTÓN CERRAR CAJA */}
                                <button 
                                    type="button"
                                    onClick={() => saveData('cerrado')}
                                    disabled={isSaving}
                                    className="flex-1 px-4 py-3 md:px-8 md:py-4 rounded-xl md:rounded-2xl bg-[#e47c00] hover:bg-[#cc6f00] text-white font-black text-[10px] md:text-xs uppercase shadow-xl shadow-orange-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16}/>}
                                    Cerrar Caja
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex flex-col gap-4 animate-in slide-in-from-right-4">
                    {isLoadingHistory ? (
                        <div className="py-20 text-center"><Loader2 size={48} className="animate-spin text-primary mx-auto"/></div>
                    ) : history.length === 0 ? (
                        <div className="py-20 text-center border-2 border-dashed border-surfaceHighlight rounded-3xl opacity-50">
                            <History size={48} className="mx-auto mb-4 text-muted"/>
                            <p className="font-black text-muted uppercase">No hay registros históricos</p>
                        </div>
                    ) : (
                        history.map(record => (
                            <div key={record.id} className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm transition-all hover:shadow-md">
                                <div 
                                    onClick={() => setExpandedHistoryId(expandedHistoryId === record.id ? null : record.id)}
                                    className="p-6 cursor-pointer flex flex-col md:flex-row justify-between items-center gap-4 hover:bg-surfaceHighlight/30 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black border border-primary/20">
                                            {new Date(record.created_at).getDate()}
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-black text-text uppercase">Arqueo {new Date(record.created_at).toLocaleDateString('es-AR')}</h4>
                                            <p className="text-xs font-bold text-muted uppercase">{new Date(record.created_at).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})} Hs</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-8">
                                        <div className="text-right hidden sm:block">
                                            <p className="text-[10px] font-black text-muted uppercase tracking-widest">Total Físico</p>
                                            <p className="text-xl font-black text-text">$ {record.physical_total.toLocaleString('es-AR')}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-muted uppercase tracking-widest">Diferencia</p>
                                            <p className={`text-xl font-black ${record.difference >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                                                {record.difference > 0 ? '+' : ''}{record.difference.toLocaleString('es-AR')}
                                            </p>
                                        </div>
                                        {expandedHistoryId === record.id ? <ChevronDown className="text-muted"/> : <ChevronRight className="text-muted"/>}
                                    </div>
                                </div>

                                {expandedHistoryId === record.id && (
                                    <div className="bg-background/30 border-t border-surfaceHighlight p-6 animate-in slide-in-from-top-2">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                            <div className="bg-surface p-4 rounded-2xl border border-surfaceHighlight">
                                                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2 border-b border-surfaceHighlight pb-1">Efectivo</p>
                                                <div className="space-y-1 text-xs">
                                                    <div className="flex justify-between"><span className="text-muted font-bold">Cambio:</span> <span className="font-black text-text">$ {record.initial_change.toLocaleString()}</span></div>
                                                    <div className="flex justify-between"><span className="text-muted font-bold">Popurrí:</span> <span className="font-black text-text">$ {record.loose_cash.toLocaleString()}</span></div>
                                                    
                                                    {/* BREAKDOWN DE FAJOS */}
                                                    <div className="mt-2 pt-2 border-t border-surfaceHighlight/50 space-y-1">
                                                        <p className="text-[9px] font-black text-muted uppercase">Fajos (x100 un.):</p>
                                                        {record.bundles_1k > 0 && (
                                                            <div className="flex justify-between text-[10px]">
                                                                <span className="text-orange-500 font-bold">1.000 x {record.bundles_1k}</span> 
                                                                <span className="text-text">$ {(record.bundles_1k * 100000).toLocaleString()}</span>
                                                            </div>
                                                        )}
                                                        {record.bundles_2k > 0 && (
                                                            <div className="flex justify-between text-[10px]">
                                                                <span className="text-blue-500 font-bold">2.000 x {record.bundles_2k}</span> 
                                                                <span className="text-text">$ {(record.bundles_2k * 200000).toLocaleString()}</span>
                                                            </div>
                                                        )}
                                                        {record.bundles_10k > 0 && (
                                                            <div className="flex justify-between text-[10px]">
                                                                <span className="text-purple-500 font-bold">10.000 x {record.bundles_10k}</span> 
                                                                <span className="text-text">$ {(record.bundles_10k * 1000000).toLocaleString()}</span>
                                                            </div>
                                                        )}
                                                        {record.bundles_20k > 0 && (
                                                            <div className="flex justify-between text-[10px]">
                                                                <span className="text-red-500 font-bold">20.000 x {record.bundles_20k}</span> 
                                                                <span className="text-text">$ {(record.bundles_20k * 2000000).toLocaleString()}</span>
                                                            </div>
                                                        )}
                                                        {record.bundles_1k === 0 && record.bundles_2k === 0 && record.bundles_10k === 0 && record.bundles_20k === 0 && (
                                                            <span className="text-[9px] text-muted italic">Sin fajos</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="bg-surface p-4 rounded-2xl border border-surfaceHighlight">
                                                <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-2 border-b border-surfaceHighlight pb-1">Dólares</p>
                                                <div className="flex justify-between items-end">
                                                    <div>
                                                        <p className="text-2xl font-black text-green-600">{record.usd_quantity}</p>
                                                        <p className="text-[9px] font-bold text-muted uppercase">x $ {record.usd_rate}</p>
                                                    </div>
                                                    <p className="text-sm font-black text-text">= $ {record.usd_total_ars.toLocaleString()}</p>
                                                </div>
                                            </div>
                                            <div className="bg-surface p-4 rounded-2xl border border-surfaceHighlight">
                                                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2 border-b border-surfaceHighlight pb-1">Cheques</p>
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex justify-between items-end">
                                                        <p className="text-2xl font-black text-indigo-600">{record.cheques_count}</p>
                                                        <p className="text-sm font-black text-text">$ {record.cheques_total.toLocaleString()}</p>
                                                    </div>
                                                    {record.cheques_detail && Array.isArray(record.cheques_detail) && record.cheques_detail.length > 0 && (
                                                        <div className="max-h-20 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                                                            {record.cheques_detail.map((c: any, i: number) => (
                                                                <div key={i} className="text-[9px] font-bold text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded flex justify-between">
                                                                    <span>Cheque #{i+1}</span>
                                                                    <span>$ {Number(c.amount).toLocaleString()}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-end">
                                            {deletingId === record.id ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-red-500 uppercase mr-2">¿Borrar permanentemente?</span>
                                                    <button 
                                                        onClick={() => performDeleteRecord(record.id)}
                                                        className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-xl text-[10px] font-black uppercase transition-all shadow-md"
                                                    >
                                                        Confirmar
                                                    </button>
                                                    <button 
                                                        onClick={() => setDeletingId(null)}
                                                        className="px-3 py-2 bg-surfaceHighlight text-text hover:bg-surfaceHighlight/80 rounded-xl text-[10px] font-black uppercase transition-all"
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => setDeletingId(record.id)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all"
                                                >
                                                    <Trash2 size={14}/> Eliminar Registro
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
