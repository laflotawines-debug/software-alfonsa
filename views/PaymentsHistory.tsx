
import React, { useState } from 'react';
import { 
    Search, 
    Clock, 
    Check,
    Trash2,
    ChevronDown,
    ChevronUp,
    Users,
    Database,
    Archive,
    Filter
} from 'lucide-react';
import { Transfer, Provider } from '../types';

interface PaymentsHistoryProps {
    transfers: Transfer[];
    onDeleteTransfer: (id: string) => void;
    onClearHistory: () => void;
    onUpdateTransfers: (t: Transfer) => void;
    onUpdateStatus: (id: string, status: 'Pendiente' | 'Realizado' | 'Archivado') => void;
    providers: Provider[];
}

export const PaymentsHistory: React.FC<PaymentsHistoryProps> = ({ 
    transfers, onDeleteTransfer, onClearHistory, onUpdateTransfers, onUpdateStatus, providers
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});
    const [showArchived, setShowArchived] = useState(false);

    const toggleTransferStatus = (e: React.MouseEvent, transferId: string) => {
        e.stopPropagation();
        const transfer = transfers.find(t => t.id === transferId);
        if (!transfer) return;
        const newStatus = transfer.status === 'Pendiente' ? 'Realizado' : 'Pendiente';
        onUpdateStatus(transferId, newStatus);
    };

    const toggleLoadedInSystem = (e: React.MouseEvent, transferId: string) => {
        e.stopPropagation();
        const transfer = transfers.find(t => t.id === transferId);
        if (!transfer) return;
        onUpdateTransfers({ ...transfer, isLoadedInSystem: !transfer.isLoadedInSystem });
    };

    const handleDelete = (e: React.MouseEvent, transferId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.confirm("¿Está seguro de eliminar este registro del historial? Esta acción es definitiva.")) {
            onDeleteTransfer(transferId);
        }
    };

    const handleClearAll = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.confirm("¡ATENCIÓN! ¿Está seguro de limpiar TODO el historial de transferencias? Esta acción borrará incluso los registros archivados.")) {
            onClearHistory();
        }
    };

    const filteredTransfers = transfers.filter(t => {
        const matchesSearch = t.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              t.notes?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesArchive = showArchived ? true : t.status !== 'Archivado';
        return matchesSearch && matchesArchive;
    });

    const providersWithHistory = providers.filter(p => filteredTransfers.some(t => t.providerId === p.id));

    return (
        <div className="flex flex-col gap-6 pb-20 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight">Historial de Transferencias</h2>
                    <p className="text-muted text-sm mt-1">Registro detallado de todos los pagos ingresados.</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setShowArchived(!showArchived)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-black uppercase text-[10px] transition-all shadow-sm ${showArchived ? 'bg-orange-500 text-white border-orange-600' : 'bg-surface border-surfaceHighlight text-muted hover:text-text'}`}
                    >
                        <Archive size={16} /> {showArchived ? 'Ocultar Archivados' : 'Ver Archivados'}
                    </button>
                    <button 
                        type="button"
                        onClick={handleClearAll} 
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white text-[10px] font-black uppercase transition-all shadow-sm"
                    >
                        <Trash2 size={16} /> Limpiar Historial
                    </button>
                </div>
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                <input type="text" placeholder="Buscar por cliente o nota..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-surface border border-surfaceHighlight rounded-xl py-3 pl-11 pr-4 text-sm text-text outline-none focus:border-primary shadow-sm" />
            </div>

            <div className="flex flex-col gap-4">
                {providersWithHistory.map(provider => {
                    const providerTransfers = filteredTransfers.filter(t => t.providerId === provider.id);
                    const isExpanded = expandedProviders[provider.id];
                    const totalAmount = providerTransfers.filter(t => t.status !== 'Archivado').reduce((sum, t) => sum + t.amount, 0);

                    return (
                        <div key={provider.id} className="bg-surface border border-surfaceHighlight rounded-2xl overflow-hidden shadow-sm transition-all duration-300">
                            <button type="button" onClick={() => setExpandedProviders(prev => ({ ...prev, [provider.id]: !prev[provider.id] }))} className="w-full flex items-center justify-between p-5 bg-background/30 hover:bg-background/50 transition-colors cursor-pointer">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-primary/10 text-primary rounded-lg"><Users size={20} /></div>
                                    <div className="text-left"><h3 className="text-lg font-black text-text leading-tight">{provider.name}</h3><p className="text-[10px] text-muted font-bold uppercase">{providerTransfers.length} registros en lista</p></div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-[10px] text-muted font-black uppercase">Suma Actual</p>
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
                                                <th className="p-4 text-center w-12">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-surfaceHighlight">
                                            {providerTransfers.map(t => (
                                                <tr key={t.id} className={`hover:bg-surfaceHighlight/10 transition-colors group ${t.status === 'Archivado' ? 'opacity-50 grayscale italic bg-background/40' : ''}`}>
                                                    <td className="p-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            {t.status === 'Archivado' ? (
                                                                <div className="w-7 h-7 flex items-center justify-center text-muted" title="Archivado (No suma al tablero)">
                                                                    <Archive size={14} />
                                                                </div>
                                                            ) : (
                                                                <button 
                                                                    type="button"
                                                                    onClick={(e) => toggleTransferStatus(e, t.id)} 
                                                                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all active:scale-90 cursor-pointer ${t.status === 'Realizado' ? 'border-green-500 text-green-500 bg-green-500/5 hover:bg-green-500 hover:text-white' : 'border-orange-500 text-orange-500 bg-orange-500/5 hover:bg-orange-500 hover:text-white'}`}
                                                                >
                                                                    {t.status === 'Realizado' ? <Check size={14} strokeWidth={3} /> : <Clock size={14} strokeWidth={3} />}
                                                                </button>
                                                            )}

                                                            <button 
                                                                type="button"
                                                                onClick={(e) => toggleLoadedInSystem(e, t.id)}
                                                                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all active:scale-90 font-black text-xs cursor-pointer ${t.isLoadedInSystem ? 'bg-primary border-primary text-white' : 'border-surfaceHighlight text-muted hover:border-primary/50'}`}
                                                            >
                                                                C
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-xs font-bold text-muted">{t.date}</td>
                                                    <td className="p-4">
                                                        <p className="text-sm font-black text-text leading-tight">{t.clientName}</p>
                                                        {t.notes && <p className="text-[10px] text-muted truncate max-w-[200px]">{t.notes}</p>}
                                                    </td>
                                                    <td className="p-4 text-[10px] font-black text-muted uppercase">
                                                        {provider.accounts.find(a => a.id === t.accountId)?.condition || '-'}
                                                    </td>
                                                    <td className="p-4 text-right font-black text-text">$ {t.amount.toLocaleString('es-AR')}</td>
                                                    <td className="p-4 text-center">
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => handleDelete(e, t.id)} 
                                                            className="p-2 text-muted hover:text-red-500 transition-all rounded-lg hover:bg-red-500/10 cursor-pointer"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
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
