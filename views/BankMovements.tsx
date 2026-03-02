import React, { useState, useEffect } from 'react';
import { 
    Landmark, 
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
    Info,
    CreditCard
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

export const BankMovements: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedBank, setSelectedBank] = useState<'Mercado Pago' | 'Galicia'>('Mercado Pago');
    const [accountNumber, setAccountNumber] = useState('727040'); // Placeholder
    const [selectedConceptId, setSelectedConceptId] = useState('');
    const [transferAmount, setTransferAmount] = useState('');
    const [comments, setComments] = useState('');
    
    // Data State
    const [concepts, setConcepts] = useState<CashConcept[]>([]);
    const [checks, setChecks] = useState<CheckItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Check Modal State
    const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
    const [newCheck, setNewCheck] = useState<Omit<CheckItem, 'id'>>({
        number: '',
        bank: '',
        date: new Date().toISOString().split('T')[0],
        amount: 0
    });

    useEffect(() => {
        fetchConcepts();
    }, []);

    useEffect(() => {
        // Update account number based on bank selection (mock logic)
        if (selectedBank === 'Mercado Pago') setAccountNumber('727040');
        else if (selectedBank === 'Galicia') setAccountNumber('4005-2345-11');
    }, [selectedBank]);

    const fetchConcepts = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('cash_concepts')
            .select('*')
            .eq('category', 'banco')
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
        // Logic to save movement will go here later
        console.log({
            date,
            bank: selectedBank,
            accountNumber,
            conceptId: selectedConceptId,
            transferAmount: parseFloat(transferAmount) || 0,
            comments,
            checks
        });
        alert('Funcionalidad de guardado pendiente de implementación');
    };

    const totalChecks = checks.reduce((acc, curr) => acc + curr.amount, 0);

    return (
        <div className="flex flex-col gap-6 pb-20 animate-in fade-in duration-300">
            {/* Header */}
            <div>
                <h2 className="text-3xl font-black text-text tracking-tight flex items-center gap-3 uppercase italic">
                    <Landmark className="text-primary" size={36} /> Movimientos de Bancos
                </h2>
                <p className="text-muted text-sm mt-1 font-medium">Gestión de ingresos y egresos bancarios.</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Main Form Column */}
                <div className="flex-1 space-y-6">
                    {/* Datos del Movimiento Card */}
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm relative">
                        <div className="flex justify-between items-center mb-6 border-b border-surfaceHighlight pb-4">
                            <h3 className="text-lg font-black text-orange-500 uppercase flex items-center gap-2">
                                <CreditCard size={20} /> Datos del Movimiento
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-muted uppercase">Estado:</span>
                                <span className="bg-blue-500/10 text-blue-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase">
                                    Borrador
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted uppercase ml-1">N° de Cuenta</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={accountNumber}
                                        readOnly
                                        className="w-1/2 bg-surfaceHighlight/30 border border-surfaceHighlight rounded-xl py-3 px-4 text-sm font-bold text-muted outline-none"
                                    />
                                    <select 
                                        value={selectedBank}
                                        onChange={e => setSelectedBank(e.target.value as any)}
                                        className="w-1/2 bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-sm font-bold outline-none focus:border-primary transition-all appearance-none"
                                    >
                                        <option value="Mercado Pago">Mercado Pago</option>
                                        <option value="Galicia">Galicia</option>
                                    </select>
                                </div>
                            </div>

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
                        </div>

                        <div className="space-y-1 mb-6">
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
                                <button className="px-4 py-3 bg-surfaceHighlight hover:bg-surfaceHighlight/80 rounded-xl text-muted font-bold text-xs uppercase transition-colors flex items-center gap-1">
                                    <Plus size={14} /> Nuevo
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1 mb-6">
                            <label className="text-[10px] font-black text-muted uppercase ml-1">Comentarios</label>
                            <textarea 
                                placeholder="Ingrese observaciones adicionales..."
                                value={comments}
                                onChange={e => setComments(e.target.value)}
                                className="w-full bg-background border border-surfaceHighlight rounded-xl p-4 text-sm font-medium outline-none focus:border-primary transition-all resize-none h-24"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-muted uppercase ml-1">Monto Transferencia / Depósito</label>
                            <div className="relative w-full md:w-1/2">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-bold">$</span>
                                <input 
                                    type="number" 
                                    placeholder="0.00"
                                    value={transferAmount}
                                    onChange={e => setTransferAmount(e.target.value)}
                                    className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-8 pr-12 text-lg font-black outline-none focus:border-primary transition-all"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-[10px] font-bold">ARS</span>
                            </div>
                        </div>
                    </div>

                    {/* Detalle de Cheques / Valores Card */}
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm flex flex-col h-[400px]">
                        <div className="flex justify-between items-center mb-4 border-b border-surfaceHighlight pb-4">
                            <h3 className="text-lg font-black text-text uppercase flex items-center gap-2">
                                <Banknote className="text-slate-500" size={20} /> Detalle de Cheques / Valores
                            </h3>
                            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase">
                                Total Items: {checks.length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-auto border border-surfaceHighlight rounded-xl bg-background mb-4">
                            <table className="w-full text-left">
                                <thead className="bg-surfaceHighlight/30 text-[10px] text-muted font-black uppercase sticky top-0">
                                    <tr>
                                        <th className="p-3 w-10">#</th>
                                        <th className="p-3">Cheque N°</th>
                                        <th className="p-3">Banco</th>
                                        <th className="p-3">Fecha Cobro</th>
                                        <th className="p-3 text-right">Importe</th>
                                        <th className="p-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surfaceHighlight">
                                    {checks.map((check, index) => (
                                        <tr key={check.id} className="hover:bg-surfaceHighlight/10">
                                            <td className="p-3 text-xs font-bold text-muted">{index + 1}</td>
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
                                            <td colSpan={6} className="p-12 text-center">
                                                <p className="text-muted text-xs italic mb-2">No se han agregado cheques a este movimiento.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-between items-center bg-surfaceHighlight/20 p-4 rounded-xl">
                            <span className="text-xs font-black text-muted uppercase">Total Cheques:</span>
                            <span className="text-lg font-black text-text">$ {totalChecks.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
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
                                <Banknote size={18} /> Agregar Valor
                            </button>
                            <button className="w-full py-4 bg-background border border-surfaceHighlight hover:bg-surfaceHighlight text-text rounded-xl font-black uppercase text-xs transition-all active:scale-95 flex items-center justify-center gap-2">
                                <Trash2 size={16} /> Borrar Item
                            </button>
                            
                            <div className="my-4 border-t border-surfaceHighlight"></div>

                            <button className="w-full py-4 bg-background border border-red-200 text-red-500 hover:bg-red-50 rounded-xl font-black uppercase text-xs transition-all active:scale-95 flex items-center justify-center gap-2">
                                <X size={16} /> Cancelar
                            </button>

                            <button onClick={handleFinish} className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black uppercase text-xs shadow-lg shadow-green-600/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                                <Check size={18} /> Terminar
                            </button>
                        </div>
                    </div>

                    {/* Ayuda Widget */}
                    <div className="bg-blue-500/5 border border-blue-500/10 rounded-3xl p-6">
                        <div className="flex gap-3">
                            <Info className="text-blue-500 shrink-0" size={20} />
                            <div>
                                <h4 className="text-xs font-black text-blue-600 uppercase mb-2">Ayuda</h4>
                                <p className="text-[10px] text-blue-600/80 leading-relaxed">
                                    Ingrese los cheques uno por uno utilizando el botón "Agregar Valor". Verifique el importe total antes de terminar.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Check Modal */}
            {isCheckModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-background w-full max-w-md rounded-3xl border border-surfaceHighlight shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-surfaceHighlight bg-surface flex justify-between items-center">
                            <h3 className="text-lg font-black text-text uppercase italic">Agregar Valor</h3>
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
