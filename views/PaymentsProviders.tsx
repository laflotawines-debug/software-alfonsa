
import React, { useState } from 'react';
import { 
    Plus, 
    Edit2, 
    X,
    Trash2,
    PauseCircle,
    Eye,
    EyeOff,
    XCircle
} from 'lucide-react';
import { Provider, ProviderAccount, ProviderStatus } from '../types';

const formatCurrencyInput = (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (!clean) return '';
    return Number(clean).toLocaleString('es-AR');
};

const parseCurrencyInput = (val: string) => {
    return val.replace(/\./g, '');
};

interface PaymentsProvidersProps {
    providers: Provider[];
    onUpdateProviders: (p: Provider) => void;
    onDeleteProvider: (id: string) => void;
}

export const PaymentsProviders: React.FC<PaymentsProvidersProps> = ({ providers, onUpdateProviders, onDeleteProvider }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProvider, setEditingProvider] = useState<Provider | null>(null);

    const handleOpenModal = (provider?: Provider) => {
        setEditingProvider(provider || null);
        setIsModalOpen(true);
    };

    const handleSave = (providerData: Provider) => {
        onUpdateProviders(providerData);
        setIsModalOpen(false);
        setEditingProvider(null);
    };

    const handleDelete = (id: string) => {
        if (!window.confirm("¿Eliminar este proveedor permanentemente?")) return;
        onDeleteProvider(id);
    };

    return (
        <div className="flex flex-col gap-6 pb-20 animate-in fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black text-text tracking-tight">Gestionar Proveedores</h2>
                <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-primary hover:bg-primaryHover text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all shadow-lg active:scale-95"><Plus size={18} /> Nuevo Proveedor</button>
            </div>
            <div className="bg-surface border border-surfaceHighlight rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-background/50 border-b border-surfaceHighlight text-[10px] text-muted uppercase font-black tracking-widest">
                            <th className="p-4 pl-6">Nombre</th>
                            <th className="p-4 text-center">Prioridad</th>
                            <th className="p-4 text-center">Cuentas</th>
                            <th className="p-4 text-center">Estado</th>
                            <th className="p-4 pr-6 text-right">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-surfaceHighlight">
                        {providers.map(p => (
                            <tr key={p.id} className="hover:bg-surfaceHighlight/10 transition-colors group">
                                <td className="p-4 pl-6"><div className="flex items-center gap-2"><span className="font-bold text-sm text-text">{p.name}</span>{p.status === 'Frenado' && <PauseCircle size={14} className="text-red-500" />}</div></td>
                                <td className="p-4 text-center"><span className="text-xs font-black text-muted bg-background px-2 py-0.5 rounded border border-surfaceHighlight">#{p.priority}</span></td>
                                <td className="p-4 text-center"><span className="text-xs text-muted font-bold">{p.accounts.length}</span></td>
                                <td className="p-4 text-center"><span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${p.status === 'Activado' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-muted/10 text-muted border-muted/20'}`}>{p.status}</span></td>
                                <td className="p-4 pr-6 text-right flex justify-end gap-2">
                                    <button onClick={() => handleOpenModal(p)} className="p-2 text-muted hover:text-primary rounded-lg hover:bg-primary/10 transition-all"><Edit2 size={16} /></button>
                                    <button onClick={() => handleDelete(p.id)} className="p-2 text-muted hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-all"><Trash2 size={16} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {isModalOpen && <NewProviderModal onClose={() => setIsModalOpen(false)} onSave={handleSave} initialData={editingProvider} />}
        </div>
    );
};

const NewProviderModal: React.FC<{ onClose: () => void; onSave: (data: Provider) => void; initialData: Provider | null }> = ({ onClose, onSave, initialData }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [goalAmountDisplay, setGoalAmountDisplay] = useState(initialData?.goalAmount ? formatCurrencyInput(initialData.goalAmount.toString()) : '0');
    const [priority, setPriority] = useState(initialData?.priority?.toString() || '3');
    const [status, setStatus] = useState<ProviderStatus>(initialData?.status || 'Activado');
    const [accounts, setAccounts] = useState<ProviderAccount[]>(initialData?.accounts || []);

    const handleAddAccount = () => {
        const newAcc: ProviderAccount = { 
            id: `acc-${Date.now()}`, 
            providerId: initialData?.id || '', 
            condition: '', 
            holder: '', 
            identifierAlias: '', 
            identifierCBU: '', 
            metaAmount: 0, 
            currentAmount: 0, 
            pendingAmount: 0, 
            status: 'Activa' 
        };
        setAccounts([...accounts, newAcc]);
    };

    const toggleAccountStatus = (accId: string) => {
        setAccounts(prev => prev.map(a => {
            if (a.id !== accId) return a;
            return { ...a, status: a.status === 'Activa' ? 'Inactiva' : 'Activa' };
        }));
    };

    const submit = () => {
        if (!name) return alert("Ingrese un nombre");
        // Aseguramos que siempre haya un ID válido, incluso si es temporal
        const finalId = (initialData && initialData.id) ? initialData.id : `p-${Date.now()}`;
        
        onSave({ 
            id: finalId, 
            name, 
            goalAmount: parseFloat(parseCurrencyInput(goalAmountDisplay)) || 0, 
            priority: parseInt(priority) || 1, 
            status, 
            accounts 
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-surface w-full max-w-xl rounded-2xl border border-surfaceHighlight shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-surfaceHighlight bg-surface flex justify-between items-center">
                    <h3 className="text-xl font-black text-text uppercase tracking-tight">Configurar Proveedor</h3>
                    <button onClick={onClose} className="p-1 hover:bg-surfaceHighlight rounded-full text-muted"><X size={24} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">NOMBRE</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del proveedor" className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-text outline-none focus:border-primary shadow-inner" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">META TOTAL ($)</label>
                            <input type="text" value={goalAmountDisplay} onChange={e => setGoalAmountDisplay(formatCurrencyInput(e.target.value))} placeholder="0" className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 font-black text-text outline-none focus:border-primary shadow-inner" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">PRIORIDAD</label>
                            <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 font-bold text-text outline-none focus:border-primary appearance-none cursor-pointer">
                                <option value="1">1 - Muy Baja</option>
                                <option value="2">2 - Baja</option>
                                <option value="3">3 - Media</option>
                                <option value="4">4 - Alta</option>
                                <option value="5">5 - Crítica</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">ESTADO</label>
                        <select value={status} onChange={e => setStatus(e.target.value as ProviderStatus)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 font-bold text-text outline-none focus:border-primary appearance-none cursor-pointer">
                            <option value="Activado">✅ Activado (Visible)</option>
                            <option value="Frenado">🛑 Frenado</option>
                            <option value="Desactivado">❌ Desactivado (Oculto)</option>
                        </select>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-surfaceHighlight pb-2">
                            <h4 className="text-sm font-black text-text uppercase tracking-widest">Cuentas</h4>
                            <button onClick={handleAddAccount} className="text-[10px] font-black text-primary hover:text-primaryHover tracking-wider uppercase">+ AGREGAR CUENTA</button>
                        </div>
                        <div className="flex flex-col gap-4">
                            {accounts.map(acc => (
                                <div key={acc.id} className={`bg-surface border border-surfaceHighlight rounded-2xl p-4 relative space-y-3 animate-in zoom-in-95 shadow-sm transition-opacity ${acc.status === 'Inactiva' ? 'opacity-50 grayscale' : ''}`}>
                                    <div className="absolute top-2 right-2 flex gap-1">
                                        <button 
                                            onClick={() => toggleAccountStatus(acc.id)} 
                                            className={`p-1.5 rounded-lg transition-colors ${acc.status === 'Activa' ? 'text-green-500 hover:bg-green-500/10' : 'text-muted hover:bg-surfaceHighlight'}`}
                                            title={acc.status === 'Activa' ? 'Ocultar' : 'Activar'}
                                        >
                                            {acc.status === 'Activa' ? <Eye size={16}/> : <EyeOff size={16}/>}
                                        </button>
                                        <button onClick={() => setAccounts(p => p.filter(a => a.id !== acc.id))} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg"><XCircle size={16}/></button>
                                    </div>
                                    <div className="grid grid-cols-12 gap-3">
                                        <input placeholder="Condición" value={acc.condition} onChange={e => setAccounts(p => p.map(a => a.id === acc.id ? { ...a, condition: e.target.value } : a))} className="col-span-8 bg-background border border-surfaceHighlight rounded-xl px-4 py-2 text-xs font-bold text-text shadow-inner" />
                                        <input placeholder="Meta Obj" value={(acc.metaAmount || 0) === 0 ? '' : formatCurrencyInput(acc.metaAmount.toString())} onChange={e => {
                                                const rawVal = parseCurrencyInput(e.target.value);
                                                setAccounts(p => p.map(a => a.id === acc.id ? { ...a, metaAmount: parseFloat(rawVal) || 0 } : a));
                                            }} className="col-span-4 bg-background border border-surfaceHighlight rounded-xl px-4 py-2 text-xs font-black text-right text-text shadow-inner" />
                                    </div>
                                    <input placeholder="Titular" value={acc.holder} onChange={e => setAccounts(p => p.map(a => a.id === acc.id ? { ...a, holder: e.target.value } : a))} className="w-full bg-background border border-surfaceHighlight rounded-xl px-4 py-2 text-xs text-text shadow-inner" />
                                    <div className="grid grid-cols-2 gap-3">
                                        <input placeholder="Alias" value={acc.identifierAlias} onChange={e => setAccounts(p => p.map(a => a.id === acc.id ? { ...a, identifierAlias: e.target.value } : a))} className="bg-background border border-surfaceHighlight rounded-xl px-4 py-2 text-[10px] font-mono text-text shadow-inner" />
                                        <input placeholder="CBU" value={acc.identifierCBU} onChange={e => setAccounts(p => p.map(a => a.id === acc.id ? { ...a, identifierCBU: e.target.value } : a))} className="bg-background border border-surfaceHighlight rounded-xl px-4 py-2 text-[10px] font-mono text-text shadow-inner" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-surfaceHighlight bg-surface flex gap-4">
                    <button onClick={onClose} className="flex-1 py-4 text-text font-black text-sm hover:bg-surfaceHighlight rounded-xl transition-all uppercase tracking-widest">Cancelar</button>
                    <button onClick={submit} className="flex-1 py-4 bg-primary hover:bg-primaryHover text-white font-black rounded-xl shadow-xl shadow-primary/20 transition-all text-sm uppercase tracking-widest">Guardar</button>
                </div>
            </div>
        </div>
    );
};
