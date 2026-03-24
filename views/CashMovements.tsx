import React, { useState, useEffect } from 'react';
import { 
    ArrowRightLeft, 
    Calendar, 
    Plus, 
    Trash2, 
    CheckSquare, 
    Check, 
    X, 
    ArrowLeft, 
    Wallet,
    Banknote,
    DollarSign,
    MessageSquare
} from 'lucide-react';
import { supabase } from '../supabase';
import { User } from '../types';

interface CashConcept {
    id: string;
    name: string;
    type: 'ingreso' | 'egreso';
    category: 'caja' | 'banco';
}

interface CheckItem {
    id: string;
    number: string;
    bank: string;
    date: string;
    amount: number;
}

export const CashMovements: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedConceptId, setSelectedConceptId] = useState('');
    const [cashAmount, setCashAmount] = useState('');
    const [usdAmount, setUsdAmount] = useState('');
    const [comments, setComments] = useState('');
    
    // Data State
    const [concepts, setConcepts] = useState<CashConcept[]>([]);
    const [checks, setChecks] = useState<CheckItem[]>([]);
    const [dailyTotal, setDailyTotal] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
    const [newCheck, setNewCheck] = useState({
        number: '',
        bank: '',
        date: new Date().toISOString().split('T')[0],
        amount: 0
    });

    useEffect(() => {
        fetchConcepts();
        fetchDailyTotal();
    }, []);

    const fetchDailyTotal = async () => {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('cash_movements')
            .select('amount_ars, type')
            .eq('date', today);
        
        if (!error && data) {
            const total = data.reduce((acc, curr) => {
                return curr.type === 'ingreso' ? acc + Number(curr.amount_ars) : acc - Number(curr.amount_ars);
            }, 0);
            setDailyTotal(total);
        }
    };

    const fetchConcepts = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('cash_concepts')
            .select('*')
            .eq('category', 'caja')
            .eq('active', true)
            .order('name');
        
        if (error) {
            console.error('Error fetching concepts:', error);
        } else {
            setConcepts(data || []);
        }
        setIsLoading(false);
    };

    const handleAddCheck = () => {
        if (!newCheck.number || !newCheck.bank || newCheck.amount <= 0) return;
        setChecks([...checks, { ...newCheck, id: crypto.randomUUID() }]);
        setNewCheck({
            number: '',
            bank: '',
            date: new Date().toISOString().split('T')[0],
            amount: 0
        });
        setIsCheckModalOpen(false);
    };

    const handleRemoveCheck = (id: string) => {
        setChecks(checks.filter(c => c.id !== id));
    };

    const handleFinish = async () => {
        if (!selectedConceptId) {
            alert('Seleccione un concepto');
            return;
        }

        const concept = concepts.find(c => c.id === selectedConceptId);
        if (!concept) return;

        const ars = parseFloat(cashAmount) || 0;
        const usd = parseFloat(usdAmount) || 0;

        if (ars === 0 && usd === 0 && checks.length === 0) {
            alert('Ingrese al menos un monto o un cheque');
            return;
        }

        setIsSaving(true);
        try {
            // 1. Insert into cash_movements
            const { data: movement, error: movementError } = await supabase
                .from('cash_movements')
                .insert({
                    date,
                    concept_id: selectedConceptId,
                    amount_ars: ars,
                    amount_usd: usd,
                    comments,
                    created_by: currentUser.id,
                    type: concept.type,
                    branch: 'Llerena'
                })
                .select()
                .single();

            if (movementError) throw movementError;

            // 2. Insert checks if any
            if (checks.length > 0) {
                const checksToInsert = checks.map(c => ({
                    movement_id: movement.id,
                    bank: c.bank,
                    number: c.number,
                    amount: c.amount,
                    due_date: c.date,
                    status: 'en_cartera'
                }));

                const { error: checksError } = await supabase
                    .from('checks')
                    .insert(checksToInsert);

                if (checksError) throw checksError;
            }

            alert('✅ Movimiento registrado con éxito');
            
            // Reset form
            setSelectedConceptId('');
            setCashAmount('');
            setUsdAmount('');
            setComments('');
            setChecks([]);
            
            // Refresh total
            fetchDailyTotal();
            
        } catch (e: any) {
            console.error('Error saving movement:', e);
            alert('❌ Error al guardar: ' + e.message);
        } finally {
            setIsSaving(true);
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 pb-20 animate-in fade-in duration-300">
            {/* Header */}
            <div>
                <h2 className="text-3xl font-black text-text tracking-tight flex items-center gap-3 uppercase italic">
                    <ArrowRightLeft className="text-primary" size={36} /> Movimientos de Caja
                </h2>
                <p className="text-muted text-sm mt-1 font-medium">Gestión de ingresos y egresos diarios.</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Main Form Column */}
                <div className="flex-1 space-y-6">
                    {/* Datos del Movimiento Card */}
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-6 border-b border-surfaceHighlight pb-4">
                            <h3 className="text-lg font-black text-text uppercase flex items-center gap-2">
                                <Wallet className="text-orange-500" size={20} /> Datos del Movimiento
                            </h3>
                            <span className="bg-blue-500/10 text-blue-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase">
                                N° {Math.floor(Math.random() * 1000000)} {/* Placeholder ID */}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted uppercase ml-1">Fecha Movimiento</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                                    <input 
                                        type="date" 
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 pr-4 text-sm font-bold outline-none focus:border-primary transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted uppercase ml-1">Concepto</label>
                                <div className="flex gap-2">
                                    <select 
                                        value={selectedConceptId}
                                        onChange={e => setSelectedConceptId(e.target.value)}
                                        className="flex-1 bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-sm font-bold outline-none focus:border-primary transition-all appearance-none"
                                    >
                                        <option value="">Seleccione un Concepto</option>
                                        {concepts.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.name} ({c.type})
                                            </option>
                                        ))}
                                    </select>
                                    <button className="p-3 bg-surfaceHighlight hover:bg-surfaceHighlight/80 rounded-xl text-muted transition-colors">
                                        <Plus size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted uppercase ml-1">Efectivo ($)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-bold">$</span>
                                    <input 
                                        type="number" 
                                        placeholder="0.00"
                                        value={cashAmount}
                                        onChange={e => setCashAmount(e.target.value)}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-8 pr-12 text-sm font-black outline-none focus:border-primary transition-all"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-[10px] font-bold">ARS</span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted uppercase ml-1">Dólares (u$s)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-bold">u$s</span>
                                    <input 
                                        type="number" 
                                        placeholder="0.00"
                                        value={usdAmount}
                                        onChange={e => setUsdAmount(e.target.value)}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 pr-12 text-sm font-black outline-none focus:border-primary transition-all"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-[10px] font-bold">USD</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-muted uppercase ml-1">Comentarios</label>
                            <textarea 
                                placeholder="Ingrese detalles adicionales..."
                                value={comments}
                                onChange={e => setComments(e.target.value)}
                                className="w-full bg-background border border-surfaceHighlight rounded-xl p-4 text-sm font-medium outline-none focus:border-primary transition-all resize-none h-24"
                            />
                        </div>
                    </div>

                    {/* Cheques del Movimiento Card */}
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm flex flex-col h-[400px]">
                        <div className="flex justify-between items-center mb-4 border-b border-surfaceHighlight pb-4">
                            <h3 className="text-lg font-black text-text uppercase flex items-center gap-2">
                                <Banknote className="text-orange-500" size={20} /> Cheques del Movimiento
                            </h3>
                            <span className="text-xs font-black text-muted uppercase">
                                Total Cheques: {checks.length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-auto border border-surfaceHighlight rounded-xl bg-background">
                            <table className="w-full text-left">
                                <thead className="bg-surfaceHighlight/30 text-[10px] text-muted font-black uppercase sticky top-0">
                                    <tr>
                                        <th className="p-3">Cheque N°</th>
                                        <th className="p-3">Banco</th>
                                        <th className="p-3">Fecha</th>
                                        <th className="p-3 text-right">Importe</th>
                                        <th className="p-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surfaceHighlight">
                                    {checks.map(check => (
                                        <tr key={check.id} className="hover:bg-surfaceHighlight/10">
                                            <td className="p-3 text-xs font-bold text-text">{check.number}</td>
                                            <td className="p-3 text-xs font-medium text-muted uppercase">{check.bank}</td>
                                            <td className="p-3 text-xs font-medium text-muted">{new Date(check.date).toLocaleDateString()}</td>
                                            <td className="p-3 text-xs font-black text-text text-right">$ {check.amount.toLocaleString('es-AR')}</td>
                                            <td className="p-3 text-center">
                                                <button onClick={() => handleRemoveCheck(check.id)} className="text-muted hover:text-red-500 transition-colors">
                                                    <X size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {checks.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-muted text-xs italic">
                                                No hay cheques cargados
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Sidebar Actions Column */}
                <div className="w-full lg:w-80 flex flex-col gap-6">
                    {/* Actions Card */}
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm">
                        <h3 className="text-sm font-black text-text uppercase mb-4">Acciones</h3>
                        <div className="space-y-3">
                            <button 
                                onClick={() => setIsCheckModalOpen(true)}
                                className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black uppercase text-xs shadow-lg shadow-orange-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <Plus size={18} /> Agregar Cheque
                            </button>
                            <button className="w-full py-4 bg-background border border-surfaceHighlight hover:bg-surfaceHighlight text-text rounded-xl font-black uppercase text-xs transition-all active:scale-95 flex items-center justify-center gap-2">
                                <Trash2 size={16} /> Borrar Cheque
                            </button>
                            <button className="w-full py-4 bg-background border border-surfaceHighlight hover:bg-surfaceHighlight text-text rounded-xl font-black uppercase text-xs transition-all active:scale-95 flex items-center justify-center gap-2">
                                <CheckSquare size={16} /> Seleccionar
                            </button>
                            
                            <div className="my-4 border-t border-surfaceHighlight"></div>

                            <button 
                                onClick={handleFinish} 
                                disabled={isSaving}
                                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black uppercase text-xs shadow-lg shadow-green-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isSaving ? <span className="animate-spin">⌛</span> : <Check size={18} />} Terminar
                            </button>
                            <button className="w-full py-4 bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 rounded-xl font-black uppercase text-xs transition-all active:scale-95 flex items-center justify-center gap-2">
                                <X size={18} /> Cancelar
                            </button>

                            <button className="w-full py-2 text-muted hover:text-text text-[10px] font-bold uppercase flex items-center justify-center gap-1 mt-2">
                                <ArrowLeft size={12} /> Anterior
                            </button>
                        </div>
                    </div>

                    {/* Resumen de Caja Widget */}
                    <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
                        <div className="relative z-10">
                            <h4 className="text-xs font-medium text-slate-400 uppercase mb-1">Resumen de Caja</h4>
                            <div className="flex items-baseline gap-2 mb-1">
                                <span className="text-3xl font-black">$ {dailyTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase">+0%</span>
                            </div>
                            <p className="text-[10px] text-slate-500">Total acumulado hoy</p>
                        </div>
                        {/* Decorative background elements */}
                        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"></div>
                        <div className="absolute -left-6 -top-6 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl"></div>
                    </div>
                </div>
            </div>

            {/* Add Check Modal */}
            {isCheckModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-background w-full max-w-md rounded-3xl border border-surfaceHighlight shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-surfaceHighlight bg-surface flex justify-between items-center">
                            <h3 className="text-lg font-black text-text uppercase italic">Agregar Cheque</h3>
                            <button onClick={() => setIsCheckModalOpen(false)}><X size={20} className="text-muted hover:text-text"/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted uppercase ml-1">Banco</label>
                                <input type="text" value={newCheck.bank} onChange={e => setNewCheck({...newCheck, bank: e.target.value})} className="w-full bg-background border border-surfaceHighlight rounded-xl p-3 text-sm font-bold outline-none uppercase" placeholder="Ej: GALICIA" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-muted uppercase ml-1">N° Cheque</label>
                                    <input type="text" value={newCheck.number} onChange={e => setNewCheck({...newCheck, number: e.target.value})} className="w-full bg-background border border-surfaceHighlight rounded-xl p-3 text-sm font-bold outline-none" placeholder="00000000" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-muted uppercase ml-1">Fecha Cobro</label>
                                    <input type="date" value={newCheck.date} onChange={e => setNewCheck({...newCheck, date: e.target.value})} className="w-full bg-background border border-surfaceHighlight rounded-xl p-3 text-sm font-bold outline-none" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted uppercase ml-1">Importe ($)</label>
                                <input type="number" value={newCheck.amount || ''} onChange={e => setNewCheck({...newCheck, amount: parseFloat(e.target.value) || 0})} className="w-full bg-background border border-surfaceHighlight rounded-xl p-3 text-lg font-black outline-none" placeholder="0.00" />
                            </div>
                        </div>
                        <div className="p-6 bg-surface border-t border-surfaceHighlight flex gap-3">
                            <button onClick={() => setIsCheckModalOpen(false)} className="flex-1 py-3 border border-surfaceHighlight rounded-xl font-black text-xs uppercase text-muted hover:bg-surfaceHighlight">Cancelar</button>
                            <button onClick={handleAddCheck} className="flex-[2] py-3 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg hover:bg-primaryHover">Agregar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
