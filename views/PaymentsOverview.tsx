import React, { useState, useMemo } from 'react';
import { 
    Plus, 
    Copy, 
    Check, 
    ChevronDown, 
    ChevronUp, 
    Search,
    Clock,
    AlertCircle,
    X,
    GripVertical,
    Trash2,
    History,
    Calendar,
    AlertTriangle,
    XCircle,
    Wallet,
    CreditCard,
    Hash,
    RotateCcw
} from 'lucide-react';
import { Provider, ProviderAccount, Transfer } from '../types';

const formatCurrencyInput = (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (!clean) return '';
    return Number(clean).toLocaleString('es-AR');
};

const parseCurrencyInput = (val: string) => {
    return val.replace(/\./g, '');
};

interface PaymentsOverviewProps {
    providers: Provider[];
    onDeleteProvider: (id: string) => void;
    onUpdateProviders: (provider: Provider) => void;
    transfers: Transfer[];
    onUpdateTransfers: (transfer: Transfer) => void;
    onConfirmTransfer: (id: string, status: 'Pendiente' | 'Realizado') => void;
    onDeleteTransfer: (id: string) => void;
}

export const PaymentsOverview: React.FC<PaymentsOverviewProps> = ({ 
    providers, onDeleteProvider, onUpdateProviders, transfers, onUpdateTransfers, onConfirmTransfer, onDeleteTransfer
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});
    const [expandedAccHistory, setExpandedAccHistory] = useState<Record<string, boolean>>({});
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [preSelectedProviderId, setPreSelectedProviderId] = useState<string | null>(null);
    const [preSelectedAccountId, setPreSelectedAccountId] = useState<string | null>(null);
    
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

    const handleCopy = (id: string, text: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleDeleteRequest = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        e.preventDefault();
        setConfirmingDeleteId(id);
    };

    const executeDelete = () => {
        if (confirmingDeleteId) {
            onDeleteProvider(confirmingDeleteId);
            setConfirmingDeleteId(null);
        }
    };

    const handleCancelTransfer = (t: Transfer) => {
        if (window.confirm(`¿Realmente desea ELIMINAR el registro de pago de ${t.clientName} por $${t.amount.toLocaleString('es-AR')}? Esta acción es definitiva.`)) {
            onDeleteTransfer(t.id);
        }
    };

    const openModal = (providerId?: string, accountId?: string) => {
        setPreSelectedProviderId(providerId || null);
        setPreSelectedAccountId(accountId || null);
        setIsModalOpen(true);
    };

    const filteredProviders = (providers || []).filter(p => 
        p.status !== 'Desactivado' &&
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const pendingConfirmations = (transfers || []).filter(t => t.status === 'Pendiente');

    return (
        <div className="flex flex-col gap-8 pb-20 animate-in fade-in">
            {/* BANNER DE PAGOS PENDIENTES - DISEÑO COMPACTO CIRCULAR */}
            {pendingConfirmations.length > 0 && (
                <div className="flex flex-col gap-2 animate-in slide-in-from-top-4 duration-500">
                    {pendingConfirmations.map(t => (
                        <div key={t.id} className="bg-[#fff3e0] dark:bg-orange-950/40 border border-[#ffe0b2] dark:border-orange-800/40 rounded-2xl p-3 md:p-4 flex items-center justify-between gap-4 shadow-sm group">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="p-2 bg-[#ff6d00] text-white rounded-full flex items-center justify-center shrink-0 shadow-sm">
                                    <AlertCircle size={18} strokeWidth={3} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-[#bf360c] dark:text-orange-400 font-black text-sm md:text-base tracking-tight truncate uppercase italic">
                                        Pago: {t.clientName}
                                    </h4>
                                    <p className="text-[#e65100] dark:text-orange-300/80 text-[10px] font-black uppercase tracking-widest mt-0.5 truncate">
                                        $ {(Number(t.amount) || 0).toLocaleString('es-AR')} → {providers.find(p => p.id === t.providerId)?.name || 'S/D'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {/* BOTÓN CANCELAR (X) DIRECTO */}
                                <button 
                                    onClick={() => handleCancelTransfer(t)}
                                    className="h-10 w-10 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-full transition-all shadow-md active:scale-90 cursor-pointer"
                                    title="Eliminar registro (Error)"
                                >
                                    <X size={20} strokeWidth={3} />
                                </button>
                                
                                {/* BOTÓN CONFIRMAR (CHECK) */}
                                <button 
                                    onClick={() => onConfirmTransfer(t.id, 'Realizado')} 
                                    className="h-10 w-10 flex items-center justify-center bg-[#1b5e20] hover:bg-[#2e7d32] text-white rounded-full transition-all shadow-lg active:scale-90 cursor-pointer"
                                    title="Confirmar Pago"
                                >
                                    <Check size={20} strokeWidth={3} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight uppercase italic">Tablero General</h2>
                    <p className="text-muted text-sm mt-1">Metas de cobro por proveedor activo.</p>
                </div>
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                    <input type="text" placeholder="Buscar proveedor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-surface border border-surfaceHighlight rounded-xl py-2.5 pl-11 pr-4 text-sm text-text outline-none focus:border-primary transition-all shadow-sm font-bold uppercase" />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredProviders.map((provider) => {
                    const isFrenado = provider.status === 'Frenado';
                    const providerTransfers = transfers.filter(t => t.providerId === provider.id && t.status !== 'Archivado');
                    const totalRealized = providerTransfers.filter(t => t.status === 'Realizado').reduce((s, t) => s + (Number(t.amount) || 0), 0);
                    const totalPending = providerTransfers.filter(t => t.status === 'Pendiente').reduce((s, t) => s + (Number(t.amount) || 0), 0);
                    const goal = Number(provider.goalAmount) || 0;
                    const realizedPct = goal > 0 ? (totalRealized / goal) * 100 : 0;
                    const pendingPct = goal > 0 ? (totalPending / goal) * 100 : 0;

                    return (
                        <div key={provider.id} className={`bg-surface border rounded-3xl flex flex-col shadow-sm transition-all duration-300 hover:border-primary/30 group relative overflow-hidden ${isFrenado ? 'border-red-200 bg-red-50/10' : 'border-surfaceHighlight'}`}>
                            
                            <div className="flex items-center justify-between p-4 border-b border-surfaceHighlight/50 bg-background/20 shrink-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">#{provider.priority}</span>
                                    <h3 className={`text-sm font-black uppercase ${isFrenado ? 'text-red-700 dark:text-red-400' : 'text-text'}`}>{provider.name}</h3>
                                </div>
                                <button 
                                    type="button"
                                    onClick={(e) => handleDeleteRequest(e, provider.id)} 
                                    className="p-2 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer active:scale-90 relative z-30"
                                    title="Eliminar Proveedor"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            <div className="p-6">
                                <div className="flex justify-between items-end mb-4">
                                    <div>
                                        <span className={`text-[10px] font-black uppercase tracking-wider ${isFrenado ? 'text-red-500' : 'text-blue-500'}`}>{provider.status}</span>
                                        <div className="flex flex-col mt-1">
                                            <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Recolectado</span>
                                            <p className="text-xl font-black text-green-500 tracking-tight">$ {totalRealized.toLocaleString('es-AR')} <span className="text-blue-500 text-sm font-bold ml-1">(+ $ {totalPending.toLocaleString('es-AR')})</span></p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Meta</span>
                                        <p className="text-xl font-black text-text tracking-tighter">$ {goal.toLocaleString('es-AR')}</p>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-[11px] font-bold">
                                        <span className="text-muted">Progreso: <span className="text-text">{Math.min(100, realizedPct + pendingPct).toFixed(0)}%</span></span>
                                        <span className="text-muted">Falta: $ {Math.max(0, goal - totalRealized - totalPending).toLocaleString('es-AR')}</span>
                                    </div>
                                    <DualProgressBar realizedPct={realizedPct} pendingPct={pendingPct} />
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => setExpandedProviders(p => ({ ...p, [provider.id]: !p[provider.id] }))}
                                    className="w-full py-2 text-[10px] font-black uppercase text-primary hover:bg-primary/5 rounded-xl flex items-center justify-center gap-2 transition-all border border-transparent hover:border-primary/20 cursor-pointer"
                                >
                                    {expandedProviders[provider.id] ? 'Ocultar Cuentas' : 'Ver Detalles de Pago'}
                                    {expandedProviders[provider.id] ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                                </button>
                            </div>

                            {expandedProviders[provider.id] && (
                                <div className="border-t border-surfaceHighlight bg-background/30 p-4 flex flex-col gap-4 animate-in slide-in-from-top-2">
                                    {(provider.accounts || []).filter(acc => acc.status === 'Activa').map(account => {
                                        const accountTransfers = (transfers || []).filter(t => t.accountId === account.id && t.status !== 'Archivado');
                                        const accRealized = accountTransfers.filter(t => t.status === 'Realizado').reduce((s, t) => s + (Number(t.amount) || 0), 0);
                                        const accPending = accountTransfers.filter(t => t.status === 'Pendiente').reduce((s, t) => s + (Number(t.amount) || 0), 0);
                                        const accMeta = Number(account.metaAmount) || 0;
                                        const isCompleted = accMeta > 0 && accRealized >= accMeta;

                                        return (
                                            <div key={account.id} className={`bg-surface border rounded-2xl p-5 shadow-sm space-y-4 transition-all ${isCompleted ? 'border-green-500/50' : 'border-surfaceHighlight'}`}>
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <h4 className="text-sm font-black text-text flex items-center gap-2">{account.condition} {isCompleted && <Check size={14} className="text-green-500" />}</h4>
                                                        <span className="text-[10px] text-muted font-bold uppercase">Meta: $ {accMeta.toLocaleString('es-AR')}</span>
                                                    </div>
                                                    <button type="button" onClick={() => openModal(provider.id, account.id)} className="flex items-center gap-2 bg-primary hover:bg-primaryHover text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-md active:scale-95 cursor-pointer"><Plus size={12}/> Agregar $</button>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-[10px] font-black">
                                                        <span className="text-green-500">$ {accRealized.toLocaleString('es-AR')} {accPending > 0 && <span className="text-blue-500 ml-1">(+ $ {accPending.toLocaleString('es-AR')})</span>}</span>
                                                        {accMeta > 0 && <span className="text-muted">{Math.min(100, (accRealized / accMeta) * 100).toFixed(0)}%</span>}
                                                    </div>
                                                    {accMeta > 0 && <DualProgressBar realizedPct={(accRealized / accMeta) * 100} pendingPct={(accPending / accMeta) * 100} height="h-2" />}
                                                </div>
                                                <div className="bg-background/40 rounded-xl overflow-hidden border border-surfaceHighlight/50">
                                                    <button type="button" onClick={() => setExpandedAccHistory(prev => ({ ...prev, [account.id]: !prev[account.id] }))} className="w-full flex items-center justify-between p-3 hover:bg-background/60 transition-colors cursor-pointer">
                                                        <div className="flex items-center gap-2">
                                                            <History size={14} className="text-muted" />
                                                            <span className="text-[9px] font-black uppercase text-muted tracking-widest">Historial Reciente</span>
                                                        </div>
                                                        {expandedAccHistory[account.id] ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                                                    </button>
                                                    {expandedAccHistory[account.id] && (
                                                        <div className="px-3 pb-3 flex flex-col gap-2 max-h-40 overflow-y-auto">
                                                            {accountTransfers.length > 0 ? accountTransfers.map(tr => (
                                                                <div key={tr.id} className="flex justify-between items-center text-[10px] font-bold py-1 border-t border-surfaceHighlight/30 first:border-none">
                                                                    <span className="text-text">{tr.clientName} ({tr.date})</span>
                                                                    <span className={tr.status === 'Realizado' ? 'text-green-500' : 'text-blue-500'}>$ {(Number(tr.amount) || 0).toLocaleString('es-AR')}</span>
                                                                </div>
                                                            )) : <p className="text-[9px] text-muted italic py-1 text-center">Sin movimientos.</p>}
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="flex flex-col gap-2 pt-3 border-t border-surfaceHighlight">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-[9px] font-black text-muted uppercase tracking-tighter">Titular</span>
                                                            <span className="text-[11px] font-bold text-text truncate">{account.holder || 'S/D'}</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        <div className="flex items-center justify-between bg-background/50 rounded-lg px-2 py-1.5 border border-surfaceHighlight/50">
                                                            <div className="flex flex-col min-w-0 overflow-hidden">
                                                                <span className="text-[8px] font-black text-primary uppercase">Alias</span>
                                                                <span className="text-[10px] font-mono font-bold text-text truncate uppercase">{account.identifierAlias || '-'}</span>
                                                            </div>
                                                            <button 
                                                                onClick={() => handleCopy(`${account.id}-alias`, account.identifierAlias)} 
                                                                className="ml-2 p-1.5 rounded-md hover:bg-primary/10 text-muted hover:text-primary transition-all active:scale-90"
                                                            >
                                                                {copiedId === `${account.id}-alias` ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                                            </button>
                                                        </div>

                                                        <div className="flex items-center justify-between bg-background/50 rounded-lg px-2 py-1.5 border border-surfaceHighlight/50">
                                                            <div className="flex flex-col min-w-0 overflow-hidden">
                                                                <span className="text-[8px] font-black text-blue-500 uppercase">CBU / CVU</span>
                                                                <span className="text-[10px] font-mono font-bold text-text truncate">{account.identifierCBU || '-'}</span>
                                                            </div>
                                                            <button 
                                                                onClick={() => handleCopy(`${account.id}-cbu`, account.identifierCBU)} 
                                                                className="ml-2 p-1.5 rounded-md hover:bg-blue-500/10 text-muted hover:text-blue-500 transition-all active:scale-90"
                                                            >
                                                                {copiedId === `${account.id}-cbu` ? <Check size={12} className="text-green-500" /> : <Hash size={12} />}
                                                            </button>
                                                        </div>
                                                    </div>
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

            <button type="button" onClick={() => openModal()} className="fixed bottom-10 right-10 w-16 h-16 rounded-full bg-primary hover:bg-primaryHover text-white shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 group z-40 cursor-pointer">
                <Plus size={32} className="group-hover:rotate-90 transition-transform duration-300" />
            </button>

            {confirmingDeleteId && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
                    <div className="bg-surface w-full max-w-sm rounded-3xl border border-red-500/30 shadow-2xl p-8 flex flex-col items-center text-center gap-6">
                        <div className="p-4 bg-red-500/10 rounded-full text-red-500">
                            <AlertTriangle size={48} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-text uppercase">¿Eliminar Proveedor?</h3>
                            <p className="text-sm text-muted mt-2">Esta acción borrará permanentemente al proveedor y todas sus transacciones registradas.</p>
                        </div>
                        <div className="flex flex-col w-full gap-3">
                            <button 
                                onClick={executeDelete}
                                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-lg transition-all active:scale-95 uppercase text-xs tracking-widest"
                            >
                                Sí, Eliminar de la Base
                            </button>
                            <button 
                                onClick={() => setConfirmingDeleteId(null)}
                                className="w-full py-4 bg-surfaceHighlight text-text font-black rounded-2xl transition-all hover:bg-surfaceHighlight/80 uppercase text-xs tracking-widest"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <NewTransferModal 
                    providers={providers}
                    transfers={transfers}
                    initialProviderId={preSelectedProviderId} initialAccountId={preSelectedAccountId}
                    onClose={() => setIsModalOpen(false)} 
                    onSave={(t) => { onUpdateTransfers(t); }}
                />
            )}
        </div>
    );
};

const DualProgressBar: React.FC<{ realizedPct: number, pendingPct: number, height?: string, isProjected?: boolean }> = ({ realizedPct, pendingPct, height = "h-2.5", isProjected = false }) => {
    const r = Number(realizedPct) || 0;
    const p = Number(pendingPct) || 0;
    return (
        <div className={`w-full ${height} bg-slate-200 dark:bg-slate-950 rounded-full overflow-hidden flex shadow-inner border border-surfaceHighlight`}>
            <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${Math.min(100, r)}%` }} />
            <div className={`h-full ${isProjected ? 'bg-blue-500' : 'bg-blue-400 opacity-40'} relative transition-all duration-300`} style={{ width: `${Math.min(100 - r, p)}%` }} />
        </div>
    );
};

const NewTransferModal: React.FC<{ providers: Provider[], transfers: Transfer[], initialProviderId: string | null, initialAccountId: string | null, onClose: () => void, onSave: (t: Transfer) => void }> = ({ providers, transfers, initialProviderId, initialAccountId, onClose, onSave }) => {
    const [activeTab, setActiveTab] = useState<'Pendiente' | 'Realizado'>('Pendiente');
    const [clientName, setClientName] = useState('');
    const [amountDisplay, setAmountDisplay] = useState(''); 
    const [date, setDate] = useState(new Date().toLocaleDateString('es-AR'));
    const [selectedProviderId, setSelectedProviderId] = useState(initialProviderId || (providers[0]?.id || ''));
    const [selectedAccountId, setSelectedAccountId] = useState(initialAccountId || '');
    const [notes, setNotes] = useState('');

    const selectedProvider = providers.find(p => p.id === selectedProviderId);
    const amountVal = parseFloat(parseCurrencyInput(amountDisplay)) || 0;

    const handleConfirm = () => {
        if (!clientName || !amountVal || !selectedProviderId || !selectedAccountId) return alert("Complete todos los campos.");
        const newTransfer: Transfer = { 
            id: `t-${Date.now()}`, clientName, amount: amountVal, date, providerId: selectedProviderId, 
            accountId: selectedAccountId, notes, status: activeTab, isLoadedInSystem: false 
        };
        onSave(newTransfer);
        onClose();
    };

    const providerMeta = Number(selectedProvider?.goalAmount) || 1;
    
    const currentProviderTotal = useMemo(() => {
        const pTransfers = transfers.filter(t => t.providerId === selectedProviderId && t.status !== 'Archivado');
        const realized = pTransfers.filter(t => t.status === 'Realizado').reduce((s, t) => s + t.amount, 0);
        const pending = pTransfers.filter(t => t.status === 'Pendiente').reduce((s, t) => s + t.amount, 0);
        return { realized, pending };
    }, [transfers, selectedProviderId]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-surface w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden border border-surfaceHighlight">
                <div className="flex items-center justify-between p-6 border-b border-surfaceHighlight">
                    <h3 className="text-xl font-black text-text tracking-tight uppercase italic">Nueva Transferencia</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-surfaceHighlight text-muted cursor-pointer"><X size={24} /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-2xl border border-surfaceHighlight/30">
                        <button onClick={() => setActiveTab('Pendiente')} className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${activeTab === 'Pendiente' ? 'bg-surface text-primary shadow-sm' : 'text-muted'}`}><Clock size={18} /> Pendiente</button>
                        <button onClick={() => setActiveTab('Realizado')} className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${activeTab === 'Realizado' ? 'bg-surface text-text shadow-sm' : 'text-muted'}`}><Check size={18} /> Realizado</button>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Proveedor Destino</label>
                                <select value={selectedProviderId} onChange={e => { setSelectedProviderId(e.target.value); setSelectedAccountId(''); }} className="w-full bg-surface border border-surfaceHighlight rounded-xl py-3 px-4 text-sm font-black text-primary outline-none cursor-pointer appearance-none focus:border-primary shadow-sm">
                                    {(providers || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Fecha</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                                    <input type="text" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-surface border border-surfaceHighlight rounded-xl py-3 pl-10 pr-4 text-sm font-bold text-text outline-none focus:border-primary" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-4 border border-surfaceHighlight/50 space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-muted uppercase tracking-widest">Progreso Global: {selectedProvider?.name}</span>
                                <span className="text-[10px] font-bold text-text">Meta: $ {providerMeta.toLocaleString('es-AR')}</span>
                            </div>
                            <DualProgressBar 
                                realizedPct={((currentProviderTotal.realized + (activeTab === 'Realizado' ? amountVal : 0)) / providerMeta) * 100} 
                                pendingPct={((currentProviderTotal.pending + (activeTab === 'Pendiente' ? amountVal : 0)) / providerMeta) * 100} 
                                height="h-3" 
                                isProjected={true} 
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Cliente / Origen</label>
                                <input type="text" placeholder="Nombre..." value={clientName} onChange={e => setClientName(e.target.value)} className="w-full bg-surface border border-surfaceHighlight rounded-xl py-3 px-4 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Monto a Transferir ($)</label>
                                <input type="text" placeholder="0" value={amountDisplay} onChange={e => setAmountDisplay(formatCurrencyInput(e.target.value))} className="w-full bg-surface border border-surfaceHighlight rounded-xl py-3 px-4 text-sm font-black text-green-600 outline-none focus:border-primary shadow-inner" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Seleccionar Cuenta (Ver Progreso Actual)</label>
                            <div className="flex flex-col gap-3">
                                {(selectedProvider?.accounts || []).filter(a => a.status === 'Activa').map(acc => {
                                    const isSel = selectedAccountId === acc.id;
                                    const accMeta = Number(acc.metaAmount) || 0;
                                    
                                    const accTransfers = transfers.filter(t => t.accountId === acc.id && t.status !== 'Archivado');
                                    const accRealized = accTransfers.filter(t => t.status === 'Realizado').reduce((s, t) => s + t.amount, 0);
                                    const accPending = accTransfers.filter(t => t.status === 'Pendiente').reduce((s, t) => s + t.amount, 0);
                                    
                                    const totalAccPaid = accRealized + accPending;
                                    const currentPct = accMeta > 0 ? (totalAccPaid / accMeta) * 100 : 0;
                                    
                                    const projRealized = accRealized + (isSel && activeTab === 'Realizado' ? amountVal : 0);
                                    const projPending = accPending + (isSel && activeTab === 'Pendiente' ? amountVal : 0);

                                    return (
                                        <button 
                                            key={acc.id} 
                                            onClick={() => setSelectedAccountId(acc.id)} 
                                            className={`p-4 rounded-2xl border transition-all text-left flex flex-col gap-2 cursor-pointer ${isSel ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'bg-background border-surfaceHighlight hover:border-primary/30 shadow-sm'}`}
                                        >
                                            <div className="flex justify-between items-start w-full">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSel ? 'border-primary bg-white' : 'border-surfaceHighlight bg-surface'}`}>
                                                        {isSel && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                                                    </div>
                                                    <div>
                                                        <span className={`text-sm font-black ${isSel ? 'text-primary' : 'text-text'}`}>{acc.condition}</span>
                                                        <p className="text-[9px] text-muted font-bold uppercase">{acc.holder}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black text-text">$ {totalAccPaid.toLocaleString('es-AR')}</p>
                                                    <p className="text-[9px] text-muted uppercase font-bold tracking-tighter">de $ {accMeta.toLocaleString('es-AR')}</p>
                                                </div>
                                            </div>
                                            
                                            {accMeta > 0 && (
                                                <div className="space-y-1 mt-1">
                                                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-950 rounded-full overflow-hidden flex">
                                                        <div className="h-full bg-green-500/50" style={{ width: `${Math.min(100, currentPct)}%` }} />
                                                        {isSel && (
                                                            <div className="h-full bg-primary animate-pulse" style={{ width: `${Math.min(100 - currentPct, (amountVal / accMeta) * 100)}%` }} />
                                                        )}
                                                    </div>
                                                    {isSel && (
                                                        <div className="flex justify-between items-center text-[9px] font-black">
                                                            <span className="text-primary italic">Proyectado: $ {(projRealized + projPending).toLocaleString('es-AR')}</span>
                                                            <span className="text-muted">{Math.min(100, ((projRealized + projPending)/accMeta)*100).toFixed(0)}%</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Notas (Opcional)</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm text-text focus:border-primary outline-none resize-none h-20 shadow-inner" placeholder="Escribe aquí algún detalle extra..."></textarea>
                        </div>
                    </div>
                </div>

                <div className="p-6 pt-0">
                    <button onClick={handleConfirm} className="w-full py-4 rounded-2xl bg-primary hover:bg-primaryHover text-white font-black shadow-xl shadow-primary/30 transition-all active:scale-[0.98] uppercase tracking-widest text-sm cursor-pointer flex items-center justify-center gap-3">
                        <Wallet size={20} />
                        Confirmar Pago {activeTab}
                    </button>
                </div>
            </div>
        </div>
    );
};