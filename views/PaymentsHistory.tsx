
import React, { useState } from 'react';
import { 
    Search, 
    Clock, 
    Check,
    Trash2,
    ChevronDown,
    ChevronUp,
    Users,
    Database
} from 'lucide-react';
import { Transfer, Provider } from '../types';

interface PaymentsHistoryProps {
    transfers: Transfer[];
    onDeleteTransfer: (id: string) => void;
    onClearHistory: () => void;
    onUpdateTransfers: (t: Transfer) => void; // Cambiado a objeto único
    onUpdateStatus: (id: string, status: 'Pendiente' | 'Realizado') => void; // Agregado
    providers: Provider[];
}

export const PaymentsHistory: React.FC<PaymentsHistoryProps> = ({ 
    transfers, onDeleteTransfer, onClearHistory, onUpdateTransfers, onUpdateStatus, providers
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});

    const toggleTransferStatus = (transferId: string) => {
        const transfer = transfers.find(t => t.id === transferId);
        if (!transfer) return;

        const isConfirming = transfer.status === 'Pendiente';
        const newStatus = isConfirming ? 'Realizado' : 'Pendiente';

        // Usamos el manejador centralizado de App.tsx para actualizar el estado y los balances
        onUpdateStatus(transferId, newStatus);
    };

    const toggleLoadedInSystem = (transferId: string) => {
        const transfer = transfers.find(t => t.id === transferId);
        if (!transfer) return;
        
        // Enviamos la actualización del campo de sistema a App.tsx
        onUpdateTransfers({ ...transfer, isLoadedInSystem: !transfer.isLoadedInSystem });
    };

    const handleDelete = (transferId: string) => {
        if (!window.confirm("¿Desea eliminar este registro? (No afecta balances de cuenta)")) return;
        onDeleteTransfer(transferId);
    };

    const handleClearAll = () => {
        if (!window.confirm("¿Está seguro de limpiar TODO el historial? Los balances actuales no se verán afectados.")) return;
        onClearHistory();
    };

    const filteredTransfers = transfers.filter(t => 
        t.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.notes?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const providersWithHistory = providers.filter(p => filteredTransfers.some(t => t.providerId === p.id));

    return (
        <div className="flex flex-col gap-6 pb-20 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight">Historial de Transferencias</h2>
                    <p className="text-muted text-sm mt-1">Registro de pagos agrupados por proveedor.</p>
                </div>
                <button 
                    onClick={handleClearAll} 
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-black uppercase transition-all shadow-sm active:scale-95"
                >
                    <Trash2 size={16} /> Limpiar Historial
                </button>
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                <input type="text" placeholder="Buscar por cliente o nota..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-surface border border-surfaceHighlight rounded-xl py-3 pl-11 pr-4 text-sm text-text outline-none focus:border-primary shadow-sm" />
            </div>

            <div className="flex flex-col gap-4">
                {providersWithHistory.map(provider => {
                    const providerTransfers = filteredTransfers.filter(t => t.providerId === provider.id);
                    const isExpanded = expandedProviders[provider.id];
                    const totalAmount = providerTransfers.reduce((sum, t) => sum + t.amount, 0);

                    return (
                        <div key={provider.id} className="bg-surface border border-surfaceHighlight rounded-2xl overflow-hidden shadow-sm transition-all duration-300">
                            <button onClick={() => setExpandedProviders(prev => ({ ...prev, [provider.id]: !prev[provider.id] }))} className="w-full flex items-center justify-between p-5 bg-background/30 hover:bg-background/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-primary/10 text-primary rounded-lg"><Users size={20} /></div>
                                    <div className="text-left"><h3 className="text-lg font-black text-text leading-tight">{provider.name}</h3><p className="text-[10px] text-muted font-bold uppercase">{providerTransfers.length} registros realizados</p></div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-[10px] text-muted font-black uppercase">Acumulado</p>
                                        <p className="text-lg font-black text-text">$ {totalAmount.toLocaleString('es-AR')}</p>
                                    </div>
                                    {isExpanded ? <ChevronUp className="text-muted" /> : <ChevronDown className="text-muted" />}
                                </div>
                            </button>
                            {isExpanded && (
                                <div className="overflow-x-auto border-t border-surfaceHighlight animate-in slide-in-from-top-2">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-background/10 text-[10px] text-muted uppercase font-black border-b border-surfaceHighlight tracking-widest">
                                                <th className="p-4 text-center w-28">Estado / Sist</th>
                                                <th className="p-4">Fecha</th>
                                                <th className="p-4">Cliente / Origen</th>
                                                <th className="p-4">Cuenta</th>
                                                <th className="p-4 text-right">Monto</th>
                                                <th className="p-4 text-center w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-surfaceHighlight">
                                            {providerTransfers.map(t => (
                                                <tr key={t.id} className="hover:bg-surfaceHighlight/10 transition-colors group">
                                                    <td className="p-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            {/* Check/Clock Status Button */}
                                                            <button 
                                                                onClick={() => toggleTransferStatus(t.id)} 
                                                                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all active:scale-90 ${t.status === 'Realizado' ? 'border-green-500 text-green-500 bg-green-500/5 hover:bg-green-500 hover:text-white' : 'border-orange-500 text-orange-500 bg-orange-500/5 hover:bg-orange-500 hover:text-white'}`}
                                                                title={t.status === 'Realizado' ? 'Confirmado' : 'Pendiente de confirmación'}
                                                            >
                                                                {t.status === 'Realizado' ? <Check size={14} strokeWidth={3} /> : <Clock size={14} strokeWidth={3} />}
                                                            </button>

                                                            {/* System "C" Button */}
                                                            <button 
                                                                onClick={() => toggleLoadedInSystem(t.id)}
                                                                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all active:scale-90 font-black text-xs ${t.isLoadedInSystem ? 'bg-primary border-primary text-white' : 'border-surfaceHighlight text-muted hover:border-primary/50'}`}
                                                                title={t.isLoadedInSystem ? 'Ingresado al sistema' : 'Marcar como ingresado al sistema'}
                                                            >
                                                                C
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-xs font-bold text-muted">{t.date}</td>
                                                    <td className="p-4"><p className="text-sm font-black text-text leading-tight">{t.clientName}</p>{t.notes && <p className="text-[10px] text-muted truncate max-w-[200px]">{t.notes}</p>}</td>
                                                    <td className="p-4 text-[10px] font-black text-muted uppercase">{provider.accounts.find(a => a.id === t.accountId)?.condition || '-'}</td>
                                                    <td className="p-4 text-right font-black text-text">$ {t.amount.toLocaleString('es-AR')}</td>
                                                    <td className="p-4 text-center"><button onClick={() => handleDelete(t.id)} className="p-1.5 text-muted hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 rounded hover:bg-red-500/10"><Trash2 size={14} /></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
