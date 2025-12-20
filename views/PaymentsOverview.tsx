
import React, { useState } from 'react';
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
    Calendar
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
}

export const PaymentsOverview: React.FC<PaymentsOverviewProps> = ({ 
    providers, onDeleteProvider, onUpdateProviders, transfers, onUpdateTransfers, onConfirmTransfer 
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});
    const [expandedAccHistory, setExpandedAccHistory] = useState<Record<string, boolean>>({});
    const [copiedId, setCopiedId] = useState<string | null>(null);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [preSelectedProviderId, setPreSelectedProviderId] = useState<string | null>(null);
    const [preSelectedAccountId, setPreSelectedAccountId] = useState<string | null>(null);

    const handleCopy = (id: string, text: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const openModal = (providerId?: string, accountId?: string) => {
        setPreSelectedProviderId(providerId || null);
        setPreSelectedAccountId(accountId || null);
        setIsModalOpen(true);
    };

    const filteredProviders = providers.filter(p => 
        p.status !== 'Desactivado' &&
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const pendingConfirmations = transfers.filter(t => t.status === 'Pendiente');

    return (
        <div className="flex flex-col gap-8 pb-20">
            {pendingConfirmations.length > 0 && (
                <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-4">
                    {pendingConfirmations.slice(0, 2).map(t => (
                        <div key={t.id} className="bg-orange-100 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-500 text-white rounded-full"><AlertCircle size={20} /></div>
                                <div>
                                    <h4 className="text-orange-700 dark:text-orange-300 font-bold text-sm">Pago Pendiente: {t.clientName}</h4>
                                    <p className="text-xs text-orange-600/80 dark:text-orange-300/60 font-medium">MONTO: $ {t.amount.toLocaleString('es-AR')} | DESTINO: {providers.find(p => p.id === t.providerId)?.name}</p>
                                </div>
                            </div>
                            <button onClick={() => onConfirmTransfer(t.id, 'Realizado')} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-xl text-xs font-black uppercase transition-all shadow-lg active:scale-95">Confirmar</button>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight">Tablero General</h2>
                    <p className="text-muted text-sm mt-1">Gestión de pagos y metas por proveedor</p>
                </div>
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                    <input type="text" placeholder="Buscar proveedor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-surface border border-surfaceHighlight rounded-xl py-2.5 pl-11 pr-4 text-sm text-text outline-none focus:border-primary transition-all shadow-sm" />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredProviders.map((provider) => {
                    const isFrenado = provider.status === 'Frenado';
                    const activeAccounts = provider.accounts.filter(acc => acc.status === 'Activa');
                    const totalRealized = activeAccounts.reduce((sum, acc) => sum + acc.currentAmount, 0);
                    const totalPending = activeAccounts.reduce((sum, acc) => sum + acc.pendingAmount, 0);
                    const realizedPct = provider.goalAmount > 0 ? (totalRealized / provider.goalAmount) * 100 : 0;
                    const pendingPct = provider.goalAmount > 0 ? (totalPending / provider.goalAmount) * 100 : 0;

                    return (
                        <div key={provider.id} className={`bg-surface border rounded-2xl flex flex-col shadow-sm transition-all duration-300 hover:border-primary/30 group/card relative ${isFrenado ? 'border-red-200 bg-red-50/10' : 'border-surfaceHighlight'}`}>
                            <div className="absolute top-4 left-4 p-1 text-muted opacity-0 group-hover/card:opacity-100 transition-opacity"><GripVertical size={20} /></div>
                            <div className="p-6 pl-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">#{provider.priority}</span>
                                            <h3 className={`text-xl font-black ${isFrenado ? 'text-red-700 dark:text-red-400' : 'text-text'}`}>{provider.name}</h3>
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${isFrenado ? 'text-red-500' : 'text-blue-500'}`}>{provider.status}</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <div className="text-right">
                                            <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Meta</span>
                                            <p className="text-xl font-black text-text tracking-tighter">$ {provider.goalAmount.toLocaleString('es-AR')}</p>
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onDeleteProvider(provider.id); }} 
                                            className="p-2 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all z-10" 
                                            title="Eliminar Proveedor"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-[11px] font-bold">
                                        <span className="text-muted">Recolectado: <span className="text-green-500 font-black">$ {totalRealized.toLocaleString('es-AR')}</span> <span className="text-blue-500 font-black">(+ $ {totalPending.toLocaleString('es-AR')})</span></span>
                                        <span className="text-muted">Falta: $ {Math.max(0, provider.goalAmount - totalRealized - totalPending).toLocaleString('es-AR')}</span>
                                    </div>
                                    <DualProgressBar realizedPct={realizedPct} pendingPct={pendingPct} />
                                </div>
                                <button onClick={() => setExpandedProviders(p => ({ ...p, [provider.id]: !p[provider.id] }))} className="w-full py-2 text-xs font-bold text-primary hover:bg-primary/5 rounded-lg flex items-center justify-center gap-2 transition-all border border-transparent hover:border-primary/20">
                                    {expandedProviders[provider.id] ? 'Ocultar Cuentas' : 'Ver Cuentas'}
                                    {expandedProviders[provider.id] ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                                </button>
                            </div>

                            {expandedProviders[provider.id] && (
                                <div className="border-t border-surfaceHighlight bg-background/30 p-4 flex flex-col gap-4 animate-in slide-in-from-top-2">
                                    {activeAccounts.map(account => {
                                        const hasMeta = (account.metaAmount || 0) > 0;
                                        const isCompleted = hasMeta && account.currentAmount >= account.metaAmount;
                                        const accountTransfers = transfers.filter(t => t.accountId === account.id);
                                        return (
                                            <div key={account.id} className={`bg-surface border rounded-2xl p-5 shadow-sm space-y-4 transition-all ${isCompleted ? 'border-green-500/50 shadow-green-500/5' : 'border-surfaceHighlight'}`}>
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <h4 className="text-sm font-black text-text flex items-center gap-2">{account.condition} {isCompleted && <Check size={14} className="text-green-500" />}</h4>
                                                        <span className="text-[10px] text-muted font-bold uppercase">Meta: $ {(account.metaAmount || 0).toLocaleString('es-AR')}</span>
                                                    </div>
                                                    <button onClick={() => openModal(provider.id, account.id)} className="flex items-center gap-2 bg-primary hover:bg-primaryHover text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-md active:scale-95"><Plus size={12}/> Agregar $</button>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-[10px] font-black">
                                                        <span className="text-green-500">$ {account.currentAmount.toLocaleString('es-AR')} {account.pendingAmount > 0 && <span className="text-blue-500 ml-1">(+ $ {account.pendingAmount.toLocaleString('es-AR')})</span>}</span>
                                                        {hasMeta && <span className="text-muted">{Math.min(100, (account.currentAmount / account.metaAmount) * 100).toFixed(0)}%</span>}
                                                    </div>
                                                    {hasMeta && <DualProgressBar realizedPct={(account.currentAmount / account.metaAmount) * 100} pendingPct={(account.pendingAmount / account.metaAmount) * 100} height="h-2" />}
                                                </div>
                                                <div className="bg-background/40 rounded-xl overflow-hidden border border-surfaceHighlight/50">
                                                    <button onClick={() => setExpandedAccHistory(prev => ({ ...prev, [account.id]: !prev[account.id] }))} className="w-full flex items-center justify-between p-3 hover:bg-background/60 transition-colors">
                                                        <div className="flex items-center gap-2">
                                                            <History size={14} className="text-muted" />
                                                            <span className="text-[9px] font-black uppercase text-muted tracking-widest">Historial ({accountTransfers.length})</span>
                                                        </div>
                                                        {expandedAccHistory[account.id] ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                                                    </button>
                                                    {expandedAccHistory[account.id] && (
                                                        <div className="px-3 pb-3 flex flex-col gap-2 max-h-40 overflow-y-auto">
                                                            {accountTransfers.length > 0 ? accountTransfers.map(tr => (
                                                                <div key={tr.id} className="flex justify-between items-center text-[10px] font-bold py-1 border-t border-surfaceHighlight/30 first:border-none">
                                                                    <span className="text-text">{tr.clientName} ({tr.date})</span>
                                                                    <span className={tr.status === 'Realizado' ? 'text-green-500' : 'text-blue-500'}>$ {tr.amount.toLocaleString('es-AR')}</span>
                                                                </div>
                                                            )) : <p className="text-[9px] text-muted italic py-1">Sin movimientos.</p>}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 gap-y-1 text-[10px] pt-2 border-t border-surfaceHighlight">
                                                    <span className="text-muted">Titular: <b className="text-text truncate block">{account.holder}</b></span>
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span className="text-right text-muted font-mono">{account.identifierAlias}</span>
                                                        <button onClick={() => handleCopy(account.id, account.identifierAlias)} className="p-1 hover:text-primary transition-colors">{copiedId === account.id ? <Check size={12} className="text-green-500"/> : <Copy size={12}/>}</button>
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

            <button onClick={() => openModal()} className="fixed bottom-10 right-10 w-16 h-16 rounded-full bg-primary hover:bg-primaryHover text-white shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 group z-40">
                <Plus size={32} className="group-hover:rotate-90 transition-transform duration-300" />
            </button>

            {isModalOpen && (
                <NewTransferModal 
                    providers={providers}
                    initialProviderId={preSelectedProviderId} initialAccountId={preSelectedAccountId}
                    onClose={() => setIsModalOpen(false)} 
                    onSave={(t) => { onUpdateTransfers(t); }}
                />
            )}
        </div>
    );
};

const DualProgressBar: React.FC<{ realizedPct: number, pendingPct: number, height?: string, isProjected?: boolean }> = ({ realizedPct, pendingPct, height = "h-2.5", isProjected = false }) => (
    <div className={`w-full ${height} bg-slate-200 dark:bg-slate-950 rounded-full overflow-hidden flex shadow-inner border border-surfaceHighlight`}>
        <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${Math.min(100, realizedPct)}%` }} />
        <div className={`h-full ${isProjected ? 'bg-blue-500' : 'bg-blue-400 opacity-40'} relative transition-all duration-300`} style={{ width: `${Math.min(100 - realizedPct, pendingPct)}%` }} />
    </div>
);

const NewTransferModal: React.FC<{ providers: Provider[], initialProviderId: string | null, initialAccountId: string | null, onClose: () => void, onSave: (t: Transfer) => void }> = ({ providers, initialProviderId, initialAccountId, onClose, onSave }) => {
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
            id: `t-${Date.now()}`, 
            clientName, 
            amount: amountVal, 
            date, 
            providerId: selectedProviderId, 
            accountId: selectedAccountId, 
            notes, 
            status: activeTab, 
            isLoadedInSystem: false 
        };
        onSave(newTransfer);
        onClose();
    };

    const providerMeta = selectedProvider?.goalAmount || 1;
    const totalProviderRealized = selectedProvider?.accounts.reduce((sum, a) => sum + a.currentAmount, 0) || 0;
    const existingProviderPending = selectedProvider?.accounts.reduce((sum, a) => sum + a.pendingAmount, 0) || 0;
    
    const projectedAmount = amountVal;
    const totalAccumulated = totalProviderRealized + existingProviderPending + (activeTab === 'Pendiente' ? projectedAmount : 0);
    const remainingToGoal = Math.max(0, providerMeta - totalAccumulated);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-surface w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden border border-surfaceHighlight">
                <div className="flex items-center justify-between p-6 border-b border-surfaceHighlight">
                    <h3 className="text-xl font-black text-text tracking-tight uppercase">Nueva Transferencia</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-surfaceHighlight text-muted"><X size={24} /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-2xl border border-surfaceHighlight/30">
                        <button onClick={() => setActiveTab('Pendiente')} className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'Pendiente' ? 'bg-surface text-primary shadow-sm' : 'text-muted'}`}><Clock size={18} /> Pendiente</button>
                        <button onClick={() => setActiveTab('Realizado')} className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'Realizado' ? 'bg-surface text-text shadow-sm' : 'text-muted'}`}><Check size={18} /> Realizado</button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Cliente / Origen</label>
                            <input type="text" placeholder="Nombre del cliente" value={clientName} onChange={e => setClientName(e.target.value)} className="w-full bg-surface border border-surfaceHighlight rounded-xl py-3 px-4 text-sm text-text outline-none focus:border-primary shadow-inner" />
                        </div>
                        
                        <div>
                            <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Monto ($)</label>
                            <input type="text" placeholder="0.00" value={amountDisplay} onChange={e => setAmountDisplay(formatCurrencyInput(e.target.value))} className="w-full bg-surface border border-surfaceHighlight rounded-xl py-3 px-4 text-sm font-black text-text outline-none focus:border-primary shadow-inner" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Fecha</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                                    <input type="text" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-surface border border-surfaceHighlight rounded-xl py-3 pl-10 pr-4 text-sm text-text outline-none focus:border-primary" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Proveedor</label>
                                <select value={selectedProviderId} onChange={e => { setSelectedProviderId(e.target.value); setSelectedAccountId(''); }} className="w-full bg-surface border border-surfaceHighlight rounded-xl py-3 px-4 text-sm font-bold text-text outline-none cursor-pointer appearance-none focus:border-primary">
                                    {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-4 border border-surfaceHighlight/50 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-black text-text dark:text-slate-100 tracking-tight">Balance de Meta</span>
                                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Meta: $ {providerMeta.toLocaleString('es-AR')}</span>
                            </div>
                            
                            <DualProgressBar 
                                realizedPct={((totalProviderRealized + (activeTab === 'Realizado' ? projectedAmount : 0)) / providerMeta) * 100} 
                                pendingPct={((existingProviderPending + (activeTab === 'Pendiente' ? projectedAmount : 0)) / providerMeta) * 100} 
                                height="h-3" 
                                isProjected={true} 
                            />

                            <div className="grid grid-cols-2 gap-y-2">
                                <div className="flex flex-col">
                                    <span className="text-[9px] text-muted font-bold uppercase">Ya Pagado (Realizado)</span>
                                    <span className="text-green-500 font-black text-xs">$ {(totalProviderRealized + (activeTab === 'Realizado' ? projectedAmount : 0)).toLocaleString('es-AR')}</span>
                                </div>
                                <div className="flex flex-col text-right">
                                    <span className="text-[9px] text-muted font-bold uppercase">En Espera (Pendiente)</span>
                                    <span className="text-blue-500 font-black text-xs">$ {(existingProviderPending + (activeTab === 'Pendiente' ? projectedAmount : 0)).toLocaleString('es-AR')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Cuenta de Destino</label>
                            <div className="flex flex-col gap-3">
                                {selectedProvider?.accounts.filter(a => a.status === 'Activa').map(acc => {
                                    const isSel = selectedAccountId === acc.id;
                                    const accMeta = acc.metaAmount || 0;
                                    return (
                                        <button key={acc.id} onClick={() => setSelectedAccountId(acc.id)} className={`p-4 rounded-2xl border transition-all text-left flex flex-col gap-2 ${isSel ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'bg-surface border-surfaceHighlight hover:border-surfaceHighlight/80 shadow-sm'}`}>
                                            <div className="flex justify-between items-center w-full">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSel ? 'border-primary' : 'border-surfaceHighlight'}`}>
                                                        {isSel && <div className="w-2 h-2 bg-primary rounded-full" />}
                                                    </div>
                                                    <span className={`text-sm font-black ${isSel ? 'text-primary' : 'text-text dark:text-slate-100'}`}>{acc.condition}</span>
                                                </div>
                                                <span className="text-[9px] font-black text-muted uppercase">$ {acc.currentAmount.toLocaleString('es-AR')}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Notas (Opcional)</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm text-text outline-none focus:border-primary resize-none h-20 shadow-inner" placeholder="Información adicional..."></textarea>
                        </div>
                    </div>
                </div>

                <div className="p-6 pt-0">
                    <button onClick={handleConfirm} className="w-full py-4 rounded-2xl bg-primary hover:bg-primaryHover text-white font-black shadow-xl shadow-primary/30 transition-all active:scale-[0.98] uppercase tracking-widest text-sm">
                        Registrar {activeTab}
                    </button>
                </div>
            </div>
        </div>
    );
};
