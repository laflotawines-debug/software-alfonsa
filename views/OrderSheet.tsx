
import React, { useState, useMemo, useEffect } from 'react';
import { 
    ArrowLeft, 
    Truck, 
    Calendar, 
    MapPin, 
    Plus, 
    X, 
    Save, 
    Search, 
    Trash2, 
    FileEdit, 
    ClipboardList, 
    Check, 
    Fuel, 
    Lock,
    Unlock,
    User,
    DollarSign,
    CreditCard,
    AlertCircle,
    ChevronRight,
    Edit3,
    Receipt,
    Wallet,
    ArrowDownRight,
    TrendingUp
} from 'lucide-react';
import { Trip, TripClient, User as UserType, TripExpense, PaymentStatus, DetailedOrder, OrderStatus } from '../types';
import { hasPermission } from '../logic';

interface OrderSheetProps {
    currentUser: UserType;
    orders: DetailedOrder[]; 
    trips: Trip[];
    onSaveTrip: (trip: Trip) => void;
    onDeleteTrip: (tripId: string) => void;
    selectedTripId: string | null;
    onSelectTrip: (id: string | null) => void;
}

export const OrderSheet: React.FC<OrderSheetProps> = ({ 
    currentUser, 
    orders, 
    trips, 
    onSaveTrip, 
    onDeleteTrip,
    selectedTripId,
    onSelectTrip
}) => {
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [tripToEdit, setTripToEdit] = useState<Trip | null>(null);

    const selectedTrip = useMemo(() => 
        trips.find(t => t.id === selectedTripId), 
    [trips, selectedTripId]);

    const handleSave = (newTrip: Trip) => {
        onSaveTrip(newTrip);
        setIsEditorOpen(false);
        setTripToEdit(null);
    };

    const handleDelete = (tripId: string) => {
        if (selectedTripId === tripId) onSelectTrip(null);
        setTimeout(() => onDeleteTrip(tripId), 50);
    };

    const handleCreateNew = () => {
        setTripToEdit(null);
        setIsEditorOpen(true);
    };

    const handleEditTrip = (trip: Trip) => {
        setTripToEdit(trip);
        setIsEditorOpen(true);
    };

    if (isEditorOpen) {
        return (
            <TripEditor 
                initialData={tripToEdit}
                onClose={() => setIsEditorOpen(false)}
                onSave={handleSave}
                availableOrders={orders}
            />
        );
    }

    if (selectedTrip) {
        return (
            <TripDetailView 
                trip={selectedTrip} 
                currentUser={currentUser}
                onBack={() => onSelectTrip(null)}
                onUpdateTrip={onSaveTrip} 
                onEditRequest={() => handleEditTrip(selectedTrip)}
                onDelete={() => handleDelete(selectedTrip.id)}
            />
        );
    }

    return (
        <TripListView 
            trips={trips} 
            onSelect={onSelectTrip} 
            onCreate={handleCreateNew}
            onDelete={handleDelete}
            currentUser={currentUser}
        />
    );
};

const TripListView: React.FC<{
    trips: Trip[];
    onSelect: (id: string) => void;
    onCreate: () => void;
    onDelete: (id: string) => void;
    currentUser: UserType;
}> = ({ trips, onSelect, onCreate, onDelete, currentUser }) => {
    const canManage = hasPermission(currentUser, 'orders.sheet_manage');

    return (
        <div className="flex flex-col gap-6 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-text tracking-tight">Planilla de Viajes</h2>
                    <p className="text-muted text-sm">Gestiona recorridos y cobranzas.</p>
                </div>
                {canManage && (
                    <button 
                        onClick={onCreate}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary hover:bg-primaryHover text-white font-bold text-sm shadow-lg shadow-primary/20 transition-all"
                    >
                        <Plus size={18} />
                        Nuevo Viaje
                    </button>
                )}
            </div>

            {trips.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-surfaceHighlight rounded-3xl bg-surface/30 text-center px-6">
                    <Truck size={48} className="text-muted opacity-30 mb-4" />
                    <h3 className="font-bold text-xl text-text">No hay viajes registrados</h3>
                    <p className="text-muted text-sm max-w-xs mt-2">Crea una planilla para comenzar el registro.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {trips.map(trip => (
                        <div 
                            key={trip.id}
                            onClick={() => onSelect(trip.id)}
                            className="bg-surface border border-surfaceHighlight rounded-2xl p-6 cursor-pointer hover:border-primary/50 transition-all group flex flex-col gap-4 shadow-sm"
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col gap-1">
                                    <h3 className="text-lg font-black text-text group-hover:text-primary transition-colors leading-tight">{trip.name || trip.displayId}</h3>
                                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded self-start border ${trip.status === 'CLOSED' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                                        {trip.status === 'CLOSED' ? 'Cerrado' : 'En Progreso'}
                                    </span>
                                </div>
                                {canManage && trip.status !== 'CLOSED' && (
                                    <button onClick={(e) => { e.stopPropagation(); onDelete(trip.id); }} className="p-2 text-muted hover:text-red-500 transition-colors">
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-col gap-2 text-sm text-muted">
                                <span className="flex items-center gap-2 font-medium"><Truck size={14}/> {trip.driverName}</span>
                                <span className="flex items-center gap-2 font-medium"><Calendar size={14}/> {trip.date}</span>
                            </div>
                            <div className="mt-auto pt-4 border-t border-surfaceHighlight flex justify-between items-center">
                                <span className="text-xs font-bold text-muted uppercase">{trip.clients.length} Clientes</span>
                                <span className="font-black text-text">$ {trip.clients.reduce((acc, c) => acc + (c.previousBalance || 0) + (c.currentInvoiceAmount || 0), 0).toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const TripDetailView: React.FC<{
    trip: Trip;
    currentUser: UserType;
    onBack: () => void;
    onUpdateTrip: (trip: Trip) => void;
    onEditRequest: () => void;
    onDelete: () => void;
}> = ({ trip, currentUser, onBack, onUpdateTrip, onEditRequest, onDelete }) => {
    const [selectedClient, setSelectedClient] = useState<TripClient | null>(null);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    
    const [editingPrevBal, setEditingPrevBal] = useState<string | null>(null); 
    const [tempPrevBal, setTempPrevBal] = useState<string>('');

    const canManage = hasPermission(currentUser, 'orders.sheet_manage');
    const isClosed = trip.status === 'CLOSED';

    const getClientTotals = (c: TripClient) => {
        const totalDebt = (c.previousBalance || 0) + (c.currentInvoiceAmount || 0);
        const totalPaid = (c.paymentCash || 0) + (c.paymentTransfer || 0);
        const remaining = totalDebt - totalPaid;
        return { totalDebt, totalPaid, remaining };
    };

    const tripTotals = useMemo(() => {
        let expectedTotal = 0; 
        let collectedCash = 0;
        let collectedTransfer = 0;
        (trip.clients || []).forEach(c => {
            const { totalDebt } = getClientTotals(c);
            expectedTotal += totalDebt;
            collectedCash += (c.paymentCash || 0);
            collectedTransfer += (c.paymentTransfer || 0);
        });
        const totalExpenses = (trip.expenses || []).reduce((acc, e) => acc + (e.amount || 0), 0);
        return { expectedTotal, collectedCash, collectedTransfer, totalExpenses, cashToRender: collectedCash - totalExpenses };
    }, [trip]);

    const handleUpdatePayment = (clientId: string, cash: number, transfer: number, isTransferExpected: boolean, prevBalance?: number, currentInvoice?: number) => {
        const updatedClients = trip.clients.map(c => {
            if (c.id !== clientId) return c;
            const bPrev = canManage && prevBalance !== undefined ? prevBalance : (c.previousBalance || 0);
            const bCurr = canManage && currentInvoice !== undefined ? currentInvoice : (c.currentInvoiceAmount || 0);
            const totalDebt = bPrev + bCurr;
            const totalPaid = cash + transfer;
            let status: PaymentStatus = 'PENDING';
            if (totalPaid >= totalDebt - 1) status = 'PAID'; 
            else if (totalPaid > 0) status = 'PARTIAL';
            return { ...c, previousBalance: bPrev, currentInvoiceAmount: bCurr, paymentCash: cash, paymentTransfer: transfer, isTransferExpected, status };
        });
        onUpdateTrip({ ...trip, clients: updatedClients });
        setSelectedClient(null);
    };

    const handleAddExpense = (expense: Omit<TripExpense, 'id' | 'timestamp'>) => {
        const newExpense: TripExpense = { ...expense, id: `exp-${Date.now()}`, timestamp: new Date() };
        onUpdateTrip({ ...trip, expenses: [...(trip.expenses || []), newExpense] });
        setIsExpenseModalOpen(false);
    };

    const toggleStatus = () => {
        if (!canManage) return;
        onUpdateTrip({ ...trip, status: isClosed ? 'IN_PROGRESS' : 'CLOSED' });
    };

    const startInlineEdit = (client: TripClient) => {
        if (!canManage || isClosed) return;
        setEditingPrevBal(client.id);
        setTempPrevBal(client.previousBalance.toString());
    };

    const saveInlineEdit = (client: TripClient) => {
        const newVal = parseFloat(tempPrevBal);
        if (!isNaN(newVal)) {
            handleUpdatePayment(client.id, client.paymentCash, client.paymentTransfer, client.isTransferExpected, newVal, client.currentInvoiceAmount);
        }
        setEditingPrevBal(null);
    };

    return (
        <div className="flex flex-col gap-6 pb-20">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-surfaceHighlight text-muted hover:text-text transition-colors"><ArrowLeft size={24} /></button>
                    <div className="flex gap-2">
                        {canManage && (
                            <button onClick={toggleStatus} className={`p-2 rounded-lg border transition-all ${isClosed ? 'border-orange-500/50 text-orange-500' : 'border-green-500/50 text-green-500'}`} title={isClosed ? "Reabrir" : "Cerrar Viaje"}>
                                {isClosed ? <Unlock size={20}/> : <Lock size={20}/>}
                            </button>
                        )}
                        {canManage && !isClosed && (
                            <button onClick={onEditRequest} className="p-2 rounded-lg border border-surfaceHighlight text-text hover:bg-surfaceHighlight" title="Editar Estructura">
                                <FileEdit size={20} />
                            </button>
                        )}
                    </div>
                </div>
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-text tracking-tight leading-tight">{trip.name || trip.displayId}</h2>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs md:text-sm text-muted font-bold uppercase tracking-wider mt-1">
                        <span className="flex items-center gap-1"><Truck size={14} className="text-primary"/> {trip.driverName}</span>
                        <span className="flex items-center gap-1"><Calendar size={14} className="text-primary"/> {trip.date}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <SummaryCard label="Cobrar" value={tripTotals.expectedTotal} color="text-text" />
                <SummaryCard label="Cobrado" value={tripTotals.collectedCash + tripTotals.collectedTransfer} color="text-green-500" />
                <SummaryCard label="Gastos" value={tripTotals.totalExpenses} color="text-red-500" />
                <div className="col-span-2 lg:col-span-1 bg-blue-600 rounded-xl p-4 md:p-6 text-white shadow-lg shadow-blue-500/20">
                    <span className="text-[10px] font-bold uppercase opacity-80">Efectivo Neto</span>
                    <p className="text-2xl md:text-3xl font-black mt-1">$ {(tripTotals.cashToRender || 0).toLocaleString()}</p>
                </div>
            </div>

            <div className="flex gap-2">
                {!isClosed && (
                    <button onClick={() => setIsExpenseModalOpen(true)} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 text-red-500 font-bold text-sm border border-red-500/20">
                        <Fuel size={18} /> Gasto
                    </button>
                )}
                <button onClick={() => setIsReportOpen(true)} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-surface border border-surfaceHighlight text-text font-bold text-sm">
                    <ClipboardList size={18} /> Rendición
                </button>
            </div>

            <div className="space-y-3">
                <h3 className="text-lg font-bold text-text mb-2">Listado de Clientes</h3>
                
                {/* VISTA MOBILE (TARJETAS) */}
                <div className="md:hidden flex flex-col gap-4">
                    {(trip.clients || []).map(c => {
                        const { totalDebt, totalPaid, remaining } = getClientTotals(c);
                        const isPaid = c.status === 'PAID';
                        return (
                            <div key={c.id} className="bg-surface border border-surfaceHighlight rounded-2xl p-5 shadow-sm space-y-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-black text-text uppercase leading-tight">{c.name}</p>
                                        <p className="text-[10px] text-muted font-bold uppercase mt-1 flex items-center gap-1"><MapPin size={10}/> {c.address}</p>
                                    </div>
                                    <StatusBadge status={c.status} />
                                </div>
                                <div className="grid grid-cols-2 gap-2 py-3 border-y border-surfaceHighlight/50">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-muted uppercase">Deuda Total</span>
                                        <span className="text-sm font-black text-text">$ {totalDebt.toLocaleString()}</span>
                                    </div>
                                    <div className="flex flex-col text-right">
                                        <span className="text-[9px] font-black text-muted uppercase">Cobrado</span>
                                        <span className="text-sm font-black text-green-500">$ {totalPaid.toLocaleString()}</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setSelectedClient(c)}
                                    className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${isPaid ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-primary text-white shadow-lg shadow-primary/20 active:scale-[0.98]'}`}
                                >
                                    {isPaid ? 'Ver / Editar' : 'Registrar Cobro'}
                                </button>
                            </div>
                        );
                    })}
                    {trip.clients.length === 0 && <p className="text-center py-10 text-muted italic text-sm">Sin clientes en este viaje.</p>}
                </div>

                {/* VISTA DESKTOP (TABLA) */}
                <div className="hidden md:block bg-surface border border-surfaceHighlight rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-background/50 border-b border-surfaceHighlight text-[10px] text-muted uppercase font-black">
                                <th className="p-4">Cliente</th>
                                <th className="p-4 text-right">Anterior</th>
                                <th className="p-4 text-right">Factura</th>
                                <th className="p-4 text-right">Total</th>
                                <th className="p-4 text-center">Estado</th>
                                <th className="p-4 text-right">Cobrado</th>
                                <th className="p-4 text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surfaceHighlight">
                            {(trip.clients || []).map(c => {
                                const { totalDebt, totalPaid } = getClientTotals(c);
                                const isPaid = c.status === 'PAID';
                                const isEditing = editingPrevBal === c.id;
                                return (
                                    <tr key={c.id} className="hover:bg-surfaceHighlight/30 transition-colors">
                                        <td className="p-4">
                                            <p className="font-bold text-sm text-text">{c.name}</p>
                                            <p className="text-[10px] text-muted uppercase font-bold">{c.address}</p>
                                        </td>
                                        <td className="p-4 text-right font-bold text-muted group/edit relative">
                                            {isEditing ? (
                                                <input autoFocus type="number" value={tempPrevBal} onChange={e => setTempPrevBal(e.target.value)} onBlur={() => saveInlineEdit(c)} onKeyDown={e => e.key === 'Enter' && saveInlineEdit(c)} className="w-24 bg-background border border-primary rounded px-2 py-1 text-right font-bold text-text outline-none" />
                                            ) : (
                                                <div onClick={() => startInlineEdit(c)} className={`inline-flex items-center gap-1 ${canManage && !isClosed ? 'cursor-edit hover:text-primary transition-colors' : ''}`}>
                                                    $ {(c.previousBalance || 0).toLocaleString()}
                                                    {canManage && !isClosed && <Edit3 size={10} className="opacity-0 group-hover/edit:opacity-50" />}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right text-muted font-bold">$ {(c.currentInvoiceAmount || 0).toLocaleString()}</td>
                                        <td className="p-4 text-right font-black text-text">$ {(totalDebt || 0).toLocaleString()}</td>
                                        <td className="p-4 text-center"><StatusBadge status={c.status} /></td>
                                        <td className="p-4 text-right font-bold text-green-500">$ {(totalPaid || 0).toLocaleString()}</td>
                                        <td className="p-4 text-center">
                                            <button onClick={() => setSelectedClient(c)} className={`px-4 py-1.5 rounded-lg font-bold text-xs transition-colors ${isPaid ? 'text-primary hover:bg-primary/5' : 'bg-primary text-white hover:bg-primaryHover'}`}>
                                                {canManage ? (isPaid ? 'Editar' : 'Cobrar/Edit') : (isPaid ? 'Ver' : 'Cobrar')}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedClient && (
                <PaymentModal 
                    client={selectedClient} 
                    totals={getClientTotals(selectedClient)} 
                    onClose={() => setSelectedClient(null)} 
                    onSave={handleUpdatePayment} 
                    isVale={canManage}
                />
            )}
            {isExpenseModalOpen && (
                <ExpenseModal onClose={() => setIsExpenseModalOpen(false)} onSave={handleAddExpense} />
            )}
            {isReportOpen && (
                <TripReportModal trip={trip} onClose={() => setIsReportOpen(false)} />
            )}
        </div>
    );
};

const SummaryCard: React.FC<{ label: string, value: number, color: string }> = ({ label, value, color }) => (
    <div className="bg-surface border border-surfaceHighlight rounded-xl p-4 md:p-6 shadow-sm flex flex-col justify-between">
        <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{label}</span>
        <p className={`text-xl md:text-2xl font-black mt-1 ${color}`}>$ {(value || 0).toLocaleString()}</p>
    </div>
);

const StatusBadge: React.FC<{ status: PaymentStatus }> = ({ status }) => (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
        status === 'PAID' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
        status === 'PARTIAL' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 
        'bg-gray-500/10 text-muted border-gray-500/20'
    }`}>
        {status === 'PAID' ? 'PAGADO' : status === 'PARTIAL' ? 'PARCIAL' : 'PENDIENTE'}
    </span>
);

const ManualClientModal: React.FC<{ onClose: () => void; onAdd: (data: any) => void }> = ({ onClose, onAdd }) => {
    const [name, setName] = useState('');
    const [prev, setPrev] = useState('');
    const [inv, setInv] = useState('');
    const [address, setAddress] = useState('');
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
             <div className="bg-background w-full max-w-md rounded-2xl border border-surfaceHighlight p-6 shadow-2xl">
                <h3 className="font-bold text-lg mb-6 text-text">Agregar Cliente Manual</h3>
                <div className="space-y-4">
                    <input className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm font-bold text-text outline-none focus:border-primary shadow-sm" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre" />
                    <input className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm font-bold text-text outline-none focus:border-primary shadow-sm" value={address} onChange={e => setAddress(e.target.value)} placeholder="Dirección/Zona" />
                    <div className="grid grid-cols-2 gap-4">
                        <input className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm font-bold text-text outline-none focus:border-primary shadow-sm" type="number" value={prev} onChange={e => setPrev(e.target.value)} placeholder="Saldo Ant." />
                        <input className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm font-bold text-text outline-none focus:border-primary shadow-sm" type="number" value={inv} onChange={e => setInv(e.target.value)} placeholder="Factura" />
                    </div>
                    <button onClick={() => onAdd({ name, address, previousBalance: parseFloat(prev)||0, currentInvoiceAmount: parseFloat(inv)||0 })} className="w-full py-4 rounded-xl bg-primary text-white font-black shadow-lg shadow-primary/20 mt-4 transition-all">Agregar Cliente</button>
                    <button onClick={onClose} className="w-full py-2 text-muted font-bold">Cancelar</button>
                </div>
             </div>
        </div>
    );
};

const ImportOrdersModal: React.FC<{ orders: DetailedOrder[]; selectedRoute?: string; onClose: () => void; onImport: (selected: DetailedOrder[]) => void }> = ({ orders, selectedRoute, onClose, onImport }) => {
    const available = orders.filter(o => (o.status === OrderStatus.EN_TRANSITO || o.status === OrderStatus.FACTURA_CONTROLADA) && (selectedRoute ? o.zone === selectedRoute : true));
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const toggle = (id: string) => { const next = new Set(selectedIds); if (next.has(id)) next.delete(id); else next.add(id); setSelectedIds(next); };
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
             <div className="bg-background w-full max-w-2xl rounded-2xl border border-surfaceHighlight flex flex-col max-h-[85vh] shadow-2xl">
                <div className="p-6 border-b border-surfaceHighlight flex justify-between items-center bg-surface rounded-t-2xl">
                    <h3 className="font-bold text-lg">Importar Pedidos {selectedRoute && `(${selectedRoute})`}</h3>
                    <button onClick={onClose} className="p-2 -mr-2"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {available.map(o => (
                        <div key={o.id} onClick={() => toggle(o.id)} className={`p-4 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${selectedIds.has(o.id) ? 'bg-primary/5 border-primary shadow-sm' : 'bg-surface border border-surfaceHighlight hover:border-primary/50'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedIds.has(o.id) ? 'bg-primary border-primary' : 'border-muted'}`}>{selectedIds.has(o.id) && <Check size={14} className="text-white"/>}</div>
                                <div><p className="font-bold text-sm text-text">{o.clientName}</p><p className="text-[10px] text-muted font-bold uppercase">{o.displayId}</p></div>
                            </div>
                            <p className="font-black text-text">$ {(o.total || 0).toLocaleString()}</p>
                        </div>
                    ))}
                    {available.length === 0 && <p className="text-center py-20 text-muted italic">No hay pedidos disponibles para importar en esta zona.</p>}
                </div>
                <div className="p-4 border-t border-surfaceHighlight flex justify-between items-center bg-surface rounded-b-2xl">
                    <span className="text-sm font-bold text-muted">{selectedIds.size} seleccionados</span>
                    <button onClick={() => onImport(available.filter(o => selectedIds.has(o.id)))} disabled={selectedIds.size === 0} className="px-6 py-2 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-50 shadow-lg shadow-blue-500/20">Importar</button>
                </div>
             </div>
        </div>
    );
};

const PaymentModal: React.FC<{ client: TripClient; totals: any; onClose: () => void; onSave: any; isVale: boolean }> = ({ client, totals, onClose, onSave, isVale }) => {
    const [cash, setCash] = useState(client.paymentCash > 0 ? client.paymentCash.toString() : '');
    const [transfer, setTransfer] = useState(client.paymentTransfer > 0 ? client.paymentTransfer.toString() : '');
    const [isExpected, setIsExpected] = useState(client.isTransferExpected);
    const [prevBal, setPrevBal] = useState((client.previousBalance || 0).toString());
    const [currInv, setCurrInv] = useState((client.currentInvoiceAmount || 0).toString());
    const handleConfirm = () => { onSave(client.id, parseFloat(cash)||0, parseFloat(transfer)||0, isExpected, isVale ? parseFloat(prevBal)||0 : undefined, isVale ? parseFloat(currInv)||0 : undefined); };
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
            <div className="bg-background w-full max-w-sm rounded-2xl border border-surfaceHighlight p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center"><h3 className="font-bold text-lg text-text">Registro de Cobro</h3><button onClick={onClose}><X size={24} className="text-muted"/></button></div>
                <div className="p-4 bg-surfaceHighlight/20 rounded-xl border border-surfaceHighlight"><p className="text-[10px] font-bold text-muted uppercase">Cliente</p><p className="font-black text-text text-lg leading-tight mt-1">{client.name}</p></div>
                {isVale && (
                    <div className="p-4 bg-orange-500/5 rounded-xl border border-orange-500/20 space-y-4">
                        <div className="flex items-center gap-2 text-orange-500 mb-2"><Edit3 size={16}/><span className="text-[10px] font-bold uppercase tracking-widest">Edición de Saldos (Admin)</span></div>
                        <div className="grid grid-cols-2 gap-4">
                            <input className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm font-bold text-text outline-none focus:border-primary shadow-sm" type="number" value={prevBal} onChange={e => setPrevBal(e.target.value)} />
                            <input className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm font-bold text-text outline-none focus:border-primary shadow-sm" type="number" value={currInv} onChange={e => setCurrInv(e.target.value)} />
                        </div>
                    </div>
                )}
                <div className="space-y-4">
                    {!isVale && (<div className="bg-surfaceHighlight/20 p-4 rounded-xl"><span className="text-[10px] font-bold uppercase text-muted">Deuda Total</span><p className="text-2xl font-black text-text">$ {(totals.totalDebt || 0).toLocaleString()}</p></div>)}
                    <div className="flex flex-col gap-4">
                        <input type="number" value={cash} onChange={e => setCash(e.target.value)} className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-xl font-black text-green-500 shadow-inner" placeholder="Efectivo Recibido" />
                        <input type="number" value={transfer} onChange={e => setTransfer(e.target.value)} className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-xl font-black text-blue-500 shadow-inner" placeholder="Transf. Confirmada" />
                        <label className="flex items-center gap-3 p-4 bg-surfaceHighlight/30 rounded-xl cursor-pointer border border-surfaceHighlight transition-all hover:bg-surfaceHighlight/50">
                            <input type="checkbox" checked={isExpected} onChange={e => setIsExpected(e.target.checked)} className="w-6 h-6 accent-primary rounded-md" />
                            <div className="flex flex-col"><span className="text-sm font-bold text-text">Cliente promete transferir</span></div>
                        </label>
                    </div>
                    <button onClick={handleConfirm} className="w-full py-4 rounded-xl bg-green-600 text-white font-black shadow-lg shadow-green-600/20 mt-4 active:scale-[0.98] transition-all">Confirmar Registro</button>
                    <button onClick={onClose} className="w-full py-2 text-muted font-bold text-sm">Cancelar</button>
                </div>
            </div>
        </div>
    );
};

const ExpenseModal: React.FC<{ onClose: () => void; onSave: any }> = ({ onClose, onSave }) => {
    const [type, setType] = useState<TripExpense['type']>('combustible');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
             <div className="bg-background w-full max-w-sm rounded-2xl border border-surfaceHighlight p-6 shadow-2xl">
                <h3 className="font-bold text-lg mb-6 text-text flex items-center gap-2"><Fuel size={20} className="text-red-500" /> Registro de Gasto</h3>
                <div className="space-y-4">
                    <select value={type} onChange={e => setType(e.target.value as any)} className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 font-bold text-text outline-none focus:border-primary shadow-sm">
                        <option value="combustible">⛽ Combustible</option>
                        <option value="viatico">🥪 Viáticos / Comida</option>
                        <option value="peaje">🛣️ Peajes</option>
                        <option value="otro">⚙️ Otros</option>
                    </select>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-xl font-black text-red-500 shadow-inner" placeholder="$ 0" />
                    <input value={note} onChange={e => setNote(e.target.value)} className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm text-text outline-none focus:border-primary shadow-sm" placeholder="Observación" />
                    <button onClick={() => onSave({ type, amount: parseFloat(amount)||0, note })} className="w-full py-4 rounded-xl bg-red-600 text-white font-black shadow-lg shadow-red-600/20 mt-4 active:scale-[0.98] transition-all">Guardar Gasto</button>
                    <button onClick={onClose} className="w-full py-2 text-muted font-bold text-sm">Cancelar</button>
                </div>
             </div>
        </div>
    );
};

const TripReportModal: React.FC<{ trip: Trip; onClose: () => void }> = ({ trip, onClose }) => {
    const cash = (trip.clients || []).reduce((acc, c) => acc + (c.paymentCash || 0), 0);
    const trans = (trip.clients || []).reduce((acc, c) => acc + (c.paymentTransfer || 0), 0);
    const exp = (trip.expenses || []).reduce((acc, e) => acc + (e.amount || 0), 0);
    const net = cash - exp;

    const pendingClients = useMemo(() => {
        return (trip.clients || []).filter(c => {
            const totalDebt = (c.previousBalance || 0) + (c.currentInvoiceAmount || 0);
            const totalPaid = (c.paymentCash || 0) + (c.paymentTransfer || 0);
            return totalPaid < totalDebt - 1; // Margen de error de 1 peso
        });
    }, [trip.clients]);

    const totalPending = useMemo(() => {
        return (trip.clients || []).reduce((acc, c) => {
            const totalDebt = (c.previousBalance || 0) + (c.currentInvoiceAmount || 0);
            const totalPaid = (c.paymentCash || 0) + (c.paymentTransfer || 0);
            return acc + Math.max(0, totalDebt - totalPaid);
        }, 0);
    }, [trip.clients]);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="bg-background w-full max-w-3xl rounded-[2.5rem] border border-surfaceHighlight shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-8 border-b border-surfaceHighlight flex justify-between items-center bg-surface shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                            <ClipboardList size={28} />
                        </div>
                        <div>
                            <h3 className="font-black text-2xl text-text uppercase italic tracking-tight leading-none">Rendición de Viaje</h3>
                            <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-2">{trip.name || trip.displayId}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 -mr-2 text-muted hover:text-text transition-colors"><X size={28}/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-10 scrollbar-thin">
                    {/* TOTALES PRINCIPALES */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <SummaryMiniCard label="Cobrado Efectivo" value={cash} icon={<Wallet size={16}/>} color="text-green-500" />
                        <SummaryMiniCard label="Cobrado Transf." value={trans} icon={<CreditCard size={16}/>} color="text-blue-500" />
                        <SummaryMiniCard label="Total Gastos" value={exp} icon={<Fuel size={16}/>} color="text-red-500" />
                    </div>

                    {/* SALDO NETO DESTACADO */}
                    <div className="bg-blue-600 p-8 rounded-3xl text-white text-center shadow-xl shadow-blue-500/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                        <span className="text-xs font-black uppercase tracking-[0.2em] opacity-80">Saldo Neto a Entregar (Efectivo)</span>
                        <p className="text-6xl font-black mt-3 leading-none italic tracking-tighter">$ {(net || 0).toLocaleString()}</p>
                        <p className="text-[10px] font-bold uppercase mt-4 opacity-60">(Efectivo - Gastos)</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* LISTADO DE PENDIENTES */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between border-b border-surfaceHighlight pb-2">
                                <h4 className="text-sm font-black text-text uppercase flex items-center gap-2">
                                    <ArrowDownRight size={18} className="text-orange-500" /> Saldo Pendiente
                                </h4>
                                <span className="text-xs font-black text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">$ {totalPending.toLocaleString()}</span>
                            </div>
                            <div className="space-y-2">
                                {pendingClients.map(c => {
                                    const totalDebt = (c.previousBalance || 0) + (c.currentInvoiceAmount || 0);
                                    const totalPaid = (c.paymentCash || 0) + (c.paymentTransfer || 0);
                                    const pending = totalDebt - totalPaid;
                                    return (
                                        <div key={c.id} className="flex justify-between items-center p-3 bg-surface border border-surfaceHighlight rounded-xl shadow-sm">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-text uppercase leading-tight">{c.name}</span>
                                                <span className="text-[9px] font-bold text-muted uppercase">Deuda: $ {totalDebt.toLocaleString()}</span>
                                            </div>
                                            <span className="text-xs font-black text-red-500">$ {pending.toLocaleString()}</span>
                                        </div>
                                    );
                                })}
                                {pendingClients.length === 0 && <p className="text-center py-6 text-[10px] font-bold text-muted uppercase italic">Todo cobrado</p>}
                            </div>
                        </div>

                        {/* LISTADO DE GASTOS */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between border-b border-surfaceHighlight pb-2">
                                <h4 className="text-sm font-black text-text uppercase flex items-center gap-2">
                                    <Fuel size={18} className="text-red-500" /> Detalle de Gastos
                                </h4>
                            </div>
                            <div className="space-y-2">
                                {(trip.expenses || []).map(e => (
                                    <div key={e.id} className="p-3 bg-surface border border-surfaceHighlight rounded-xl shadow-sm space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[9px] font-black text-red-500 uppercase tracking-widest bg-red-500/5 px-2 py-0.5 rounded">{e.type}</span>
                                            <span className="text-sm font-black text-text">$ {e.amount.toLocaleString()}</span>
                                        </div>
                                        {e.note && (
                                            <p className="text-[10px] font-bold text-muted uppercase italic leading-tight">
                                                Obs: {e.note}
                                            </p>
                                        )}
                                    </div>
                                ))}
                                {(trip.expenses || []).length === 0 && <p className="text-center py-6 text-[10px] font-bold text-muted uppercase italic">Sin gastos registrados</p>}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 border-t border-surfaceHighlight bg-surface shrink-0">
                    <button onClick={onClose} className="w-full py-5 rounded-[1.5rem] bg-surfaceHighlight font-black text-text uppercase text-xs tracking-[0.2em] transition-all hover:bg-surfaceHighlight/80 active:scale-[0.98]">Cerrar Rendición</button>
                </div>
            </div>
        </div>
    );
};

const SummaryMiniCard: React.FC<{ label: string, value: number, color: string, icon: React.ReactNode }> = ({ label, value, color, icon }) => (
    <div className="bg-surface border border-surfaceHighlight rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-primary/20 transition-all">
        <div className="flex items-center gap-2 mb-2">
            <span className="text-muted">{icon}</span>
            <span className="text-[9px] font-black text-muted uppercase tracking-widest">{label}</span>
        </div>
        <p className={`text-xl font-black ${color}`}>$ {(value || 0).toLocaleString()}</p>
    </div>
);

const TripEditor: React.FC<{
    initialData: Trip | null;
    onClose: () => void;
    onSave: (trip: Trip) => void;
    availableOrders: DetailedOrder[];
}> = ({ initialData, onClose, onSave, availableOrders }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [driverName, setDriverName] = useState(initialData?.driverName || '');
    const [route, setRoute] = useState(initialData?.route || '');
    const [date, setDate] = useState(initialData?.date || new Date().toLocaleDateString('es-AR'));
    const [clients, setClients] = useState<TripClient[]>(initialData?.clients || []);
    const [isManualAddOpen, setIsManualAddOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    
    const handleSave = () => { 
        if (!name || !driverName) { alert("Complete Nombre y Conductor"); return; } 
        // No generamos 'id' si es nuevo, dejamos que App.tsx lo maneje o mandamos undefined
        onSave({ 
            id: initialData?.id || '', 
            displayId: initialData?.displayId || `#${Math.floor(Math.random()*10000)}`, 
            name, 
            status: initialData?.status || 'PLANNING', 
            driverName, 
            route: route || 'Sin asignar', 
            date, 
            clients, 
            expenses: initialData?.expenses || [] 
        }); 
    };

    return (
        <div className="flex flex-col gap-6 pb-20 max-w-6xl mx-auto w-full">
            <div className="flex items-center gap-4"><button onClick={onClose} className="p-2 rounded-full hover:bg-surfaceHighlight text-muted hover:text-text transition-colors"><ArrowLeft size={24} /></button><h2 className="text-2xl font-black text-text">{initialData ? 'Editar Viaje' : 'Nuevo Viaje'}</h2><button onClick={handleSave} className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 transition-all"><Save size={18} /> Guardar</button></div>
            <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-sm">
                <input className="md:col-span-3 bg-surface border border-surfaceHighlight rounded-xl p-3 text-lg font-bold outline-none focus:border-primary shadow-sm" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del Viaje" />
                <input className="bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm font-bold shadow-sm" value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="Conductor" />
                <select className="bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm font-bold shadow-sm" value={route} onChange={e => setRoute(e.target.value)}><option value="">-- Seleccionar Zona --</option><option value="V. Mercedes">V. Mercedes</option><option value="San Luis">San Luis</option><option value="Norte">Norte</option></select>
                <input className="bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm font-bold shadow-sm" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6 flex flex-col gap-6 shadow-sm">
                <div className="flex justify-between items-center border-b border-surfaceHighlight pb-4"><h3 className="text-lg font-bold text-text">Clientes ({clients.length})</h3><div className="flex gap-2"><button onClick={() => setIsImportOpen(true)} className="px-4 py-2 rounded-lg bg-blue-500/10 text-blue-500 font-bold text-xs">Importar</button><button onClick={() => setIsManualAddOpen(true)} className="px-4 py-2 rounded-lg bg-surfaceHighlight text-text font-bold text-xs">Manual</button></div></div>
                <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="text-xs text-muted uppercase"><th>Cliente</th><th className="text-right">Saldo Ant.</th><th className="text-right">Factura</th><th className="text-right">Total</th><th className="text-center w-12"></th></tr></thead><tbody className="divide-y divide-surfaceHighlight">{clients.map(c => (<tr key={c.id}><td className="py-3 font-bold text-sm">{c.name}</td><td className="py-3 text-right text-muted">$ {c.previousBalance.toLocaleString()}</td><td className="py-3 text-right text-muted">$ {c.currentInvoiceAmount.toLocaleString()}</td><td className="py-3 text-right font-black">$ {(c.previousBalance + c.currentInvoiceAmount).toLocaleString()}</td><td className="py-3 text-center"><button onClick={() => setClients(clients.filter(cl => cl.id !== c.id))} className="p-2 text-muted hover:text-red-500"><Trash2 size={16}/></button></td></tr>))}</tbody></table></div>
            </div>
            {isManualAddOpen && <ManualClientModal onClose={() => setIsManualAddOpen(false)} onAdd={(d) => { setClients([...clients, { id: `tc-${Date.now()}`, ...d, paymentCash: 0, paymentTransfer: 0, isTransferExpected: false, status: 'PENDING' }]); setIsManualAddOpen(false); }} />}
            {isImportOpen && <ImportOrdersModal orders={availableOrders} selectedRoute={route} onClose={() => setIsImportOpen(false)} onImport={(sel) => { setClients([...clients, ...sel.map(o => ({ id: `tc-${o.id}`, name: o.clientName, address: o.zone||'', previousBalance: 0, currentInvoiceAmount: o.total, paymentCash: 0, paymentTransfer: 0, isTransferExpected: false, status: 'PENDING' as PaymentStatus }))]); setIsImportOpen(false); }} />}
        </div>
    );
};
