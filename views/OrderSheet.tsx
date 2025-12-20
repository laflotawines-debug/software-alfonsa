
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
    Edit3
} from 'lucide-react';
import { Trip, TripClient, User as UserType, TripExpense, PaymentStatus, DetailedOrder, OrderStatus } from '../types';

interface OrderSheetProps {
    currentUser: UserType;
    orders: DetailedOrder[]; 
    trips: Trip[];
    onSaveTrip: (trip: Trip) => void;
    onDeleteTrip: (tripId: string) => void;
}

// ==========================================
// MAIN COMPONENT: ORDER SHEET CONTROLLER
// ==========================================

export const OrderSheet: React.FC<OrderSheetProps> = ({ currentUser, orders, trips, onSaveTrip, onDeleteTrip }) => {
    const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
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
        if (selectedTripId === tripId) setSelectedTripId(null);
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
                onBack={() => setSelectedTripId(null)}
                onUpdateTrip={onSaveTrip} 
                onEditRequest={() => handleEditTrip(selectedTrip)}
                onDelete={() => handleDelete(selectedTrip.id)}
            />
        );
    }

    return (
        <TripListView 
            trips={trips} 
            onSelect={setSelectedTripId} 
            onCreate={handleCreateNew}
            onDelete={handleDelete}
            currentUser={currentUser}
        />
    );
};

// ==========================================
// SUB-VIEW 1: TRIP LIST
// ==========================================

const TripListView: React.FC<{
    trips: Trip[];
    onSelect: (id: string) => void;
    onCreate: () => void;
    onDelete: (id: string) => void;
    currentUser: UserType;
}> = ({ trips, onSelect, onCreate, onDelete, currentUser }) => {
    const isVale = currentUser.role === 'vale';

    return (
        <div className="flex flex-col gap-6 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-text tracking-tight">Planilla de Viajes</h2>
                    <p className="text-muted text-sm">Gestiona recorridos y cobranzas.</p>
                </div>
                {isVale && (
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
                                {isVale && trip.status !== 'CLOSED' && (
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
                                <span className="font-black text-text">$ {trip.clients.reduce((acc, c) => acc + c.previousBalance + c.currentInvoiceAmount, 0).toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ==========================================
// SUB-VIEW 2: TRIP EDITOR
// ==========================================

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

    const removeClient = (id: string) => {
        setClients(prev => prev.filter(c => c.id !== id));
    };

    const handleSave = () => {
        if (!name || !driverName) { alert("Complete Nombre y Conductor"); return; }
        onSave({
            id: initialData?.id || `trip-${Date.now()}`,
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
            <div className="flex items-center gap-4">
                <button onClick={onClose} className="p-2 rounded-full hover:bg-surfaceHighlight text-muted hover:text-text transition-colors"><ArrowLeft size={24} /></button>
                <h2 className="text-2xl font-black text-text">{initialData ? 'Editar Viaje' : 'Nuevo Viaje'}</h2>
                <button onClick={handleSave} className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 transition-all"><Save size={18} /> Guardar</button>
            </div>

            <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-sm">
                <div className="md:col-span-3 flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase text-muted">Nombre del Viaje</label>
                    <input className="bg-surface border border-surfaceHighlight rounded-xl p-3 text-lg font-bold outline-none focus:border-primary transition-all shadow-sm" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Zona Norte Lunes" />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase text-muted">Conductor</label>
                    <input className="bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm font-bold shadow-sm" value={driverName} onChange={e => setDriverName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase text-muted">Zona</label>
                    <select className="bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm font-bold appearance-none cursor-pointer shadow-sm" value={route} onChange={e => setRoute(e.target.value)}>
                        <option value="">-- Seleccionar --</option>
                        <option value="V. Mercedes">V. Mercedes</option>
                        <option value="San Luis">San Luis</option>
                        <option value="Norte">Norte</option>
                    </select>
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase text-muted">Fecha</label>
                    <input className="bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm font-bold shadow-sm" value={date} onChange={e => setDate(e.target.value)} />
                </div>
            </div>

            <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6 flex flex-col gap-6 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-surfaceHighlight pb-4">
                     <h3 className="text-lg font-bold text-text">Clientes ({clients.length})</h3>
                     <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={() => setIsImportOpen(true)} className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-blue-500/10 text-blue-500 font-bold text-xs border border-blue-500/20">Importar</button>
                        <button onClick={() => setIsManualAddOpen(true)} className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-surfaceHighlight text-text font-bold text-xs border border-surfaceHighlight">Manual</button>
                     </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[600px]">
                        <thead>
                            <tr className="text-xs text-muted uppercase border-b border-surfaceHighlight">
                                <th className="pb-3 pl-2">Cliente</th>
                                <th className="pb-3 text-right">Saldo Ant.</th>
                                <th className="pb-3 text-right">Factura</th>
                                <th className="pb-3 text-right">Total</th>
                                <th className="pb-3 text-center w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surfaceHighlight">
                            {clients.map(c => (
                                <tr key={c.id}>
                                    <td className="py-3 pl-2"><p className="font-bold text-sm text-text">{c.name}</p><p className="text-xs text-muted">{c.address}</p></td>
                                    <td className="py-3 text-right font-bold text-muted">$ {c.previousBalance.toLocaleString()}</td>
                                    <td className="py-3 text-right font-bold text-muted">$ {c.currentInvoiceAmount.toLocaleString()}</td>
                                    <td className="py-3 text-right font-black text-text">$ {(c.previousBalance + c.currentInvoiceAmount).toLocaleString()}</td>
                                    <td className="py-3 text-center"><button onClick={() => removeClient(c.id)} className="p-2 text-muted hover:text-red-500 transition-colors"><Trash2 size={16} /></button></td>
                                </tr>
                            ))}
                            {clients.length === 0 && (
                                <tr><td colSpan={5} className="py-10 text-center text-muted italic">No hay clientes agregados</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isManualAddOpen && <ManualClientModal onClose={() => setIsManualAddOpen(false)} onAdd={(data) => {
                setClients([...clients, { id: `tc-${Date.now()}`, name: data.name||'Nuevo', address: data.address||'', previousBalance: data.previousBalance||0, currentInvoiceAmount: data.currentInvoiceAmount||0, paymentCash: 0, paymentTransfer: 0, isTransferExpected: false, status: 'PENDING' }]);
                setIsManualAddOpen(false);
            }} />}
            {isImportOpen && <ImportOrdersModal orders={availableOrders} selectedRoute={route} onClose={() => setIsImportOpen(false)} onImport={(selected) => {
                setClients([...clients, ...selected.map(o => ({ id: `tc-${Date.now()}-${o.id}`, name: o.clientName, address: o.zone||'', previousBalance: 0, currentInvoiceAmount: o.total, paymentCash: 0, paymentTransfer: 0, isTransferExpected: false, status: 'PENDING' as PaymentStatus }))]);
                setIsImportOpen(false);
            }} />}
        </div>
    );
};

// ==========================================
// SUB-VIEW 3: TRIP DETAIL VIEW
// ==========================================

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

    const isVale = currentUser.role === 'vale';
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
        trip.clients.forEach(c => {
            const { totalDebt } = getClientTotals(c);
            expectedTotal += totalDebt;
            collectedCash += (c.paymentCash || 0);
            collectedTransfer += (c.paymentTransfer || 0);
        });
        const totalExpenses = trip.expenses.reduce((acc, e) => acc + e.amount, 0);
        return { expectedTotal, collectedCash, collectedTransfer, totalExpenses, cashToRender: collectedCash - totalExpenses };
    }, [trip]);

    const handleUpdatePayment = (clientId: string, cash: number, transfer: number, isTransferExpected: boolean, prevBalance?: number, currentInvoice?: number) => {
        const updatedClients = trip.clients.map(c => {
            if (c.id !== clientId) return c;
            
            // If vale, they can overwrite balances
            const bPrev = isVale && prevBalance !== undefined ? prevBalance : c.previousBalance;
            const bCurr = isVale && currentInvoice !== undefined ? currentInvoice : c.currentInvoiceAmount;
            
            const totalDebt = bPrev + bCurr;
            const totalPaid = cash + transfer;
            
            let status: PaymentStatus = 'PENDING';
            if (totalPaid >= totalDebt - 1) status = 'PAID'; 
            else if (totalPaid > 0) status = 'PARTIAL';

            return { 
                ...c, 
                previousBalance: bPrev,
                currentInvoiceAmount: bCurr,
                paymentCash: cash, 
                paymentTransfer: transfer, 
                isTransferExpected, 
                status 
            };
        });
        onUpdateTrip({ ...trip, clients: updatedClients });
        setSelectedClient(null);
    };

    const handleAddExpense = (expense: Omit<TripExpense, 'id' | 'timestamp'>) => {
        const newExpense: TripExpense = { ...expense, id: `exp-${Date.now()}`, timestamp: new Date() };
        onUpdateTrip({ ...trip, expenses: [...trip.expenses, newExpense] });
        setIsExpenseModalOpen(false);
    };

    const toggleStatus = () => {
        if (!isVale) return;
        onUpdateTrip({ ...trip, status: isClosed ? 'IN_PROGRESS' : 'CLOSED' });
    };

    return (
        <div className="flex flex-col gap-6 pb-20">
            {/* Header Mobile Optimized */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-surfaceHighlight text-muted hover:text-text transition-colors"><ArrowLeft size={24} /></button>
                    <div className="flex gap-2">
                        {isVale && (
                            <button onClick={toggleStatus} className={`p-2 rounded-lg border transition-all ${isClosed ? 'border-orange-500/50 text-orange-500' : 'border-green-500/50 text-green-500'}`} title={isClosed ? "Reabrir" : "Cerrar Viaje"}>
                                {isClosed ? <Unlock size={20}/> : <Lock size={20}/>}
                            </button>
                        )}
                        {isVale && !isClosed && (
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

            {/* Top Cards for Real-time Financials */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <SummaryCard label="Cobrar" value={tripTotals.expectedTotal} color="text-text" />
                <SummaryCard label="Cobrado" value={tripTotals.collectedCash + tripTotals.collectedTransfer} color="text-green-500" />
                <SummaryCard label="Gastos" value={tripTotals.totalExpenses} color="text-red-500" />
                <div className="col-span-2 lg:col-span-1 bg-blue-600 rounded-xl p-4 md:p-6 text-white shadow-lg shadow-blue-500/20">
                    <span className="text-[10px] font-bold uppercase opacity-80">Efectivo Neto</span>
                    <p className="text-2xl md:text-3xl font-black mt-1">$ {tripTotals.cashToRender.toLocaleString()}</p>
                </div>
            </div>

            {/* Quick Actions */}
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

            {/* Clients List - Card-based for Mobile, Table for Desktop */}
            <div className="space-y-3">
                <h3 className="text-lg font-bold text-text mb-2">Listado de Clientes</h3>
                
                {/* Desktop View Table */}
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
                            {trip.clients.map(c => {
                                const { totalDebt, totalPaid } = getClientTotals(c);
                                const isPaid = c.status === 'PAID';
                                return (
                                    <tr key={c.id} className="hover:bg-surfaceHighlight/30 transition-colors">
                                        <td className="p-4">
                                            <p className="font-bold text-sm text-text">{c.name}</p>
                                            <p className="text-[10px] text-muted uppercase font-bold">{c.address}</p>
                                        </td>
                                        <td className="p-4 text-right text-muted font-bold">$ {c.previousBalance.toLocaleString()}</td>
                                        <td className="p-4 text-right text-muted font-bold">$ {c.currentInvoiceAmount.toLocaleString()}</td>
                                        <td className="p-4 text-right font-black text-text">$ {totalDebt.toLocaleString()}</td>
                                        <td className="p-4 text-center">
                                            <StatusBadge status={c.status} />
                                        </td>
                                        <td className="p-4 text-right font-bold text-green-500">$ {totalPaid.toLocaleString()}</td>
                                        <td className="p-4 text-center">
                                            <button 
                                                onClick={() => setSelectedClient(c)} 
                                                className={`px-4 py-1.5 rounded-lg font-bold text-xs transition-colors ${isPaid ? 'text-primary hover:bg-primary/5' : 'bg-primary text-white hover:bg-primaryHover'}`}
                                            >
                                                {isVale ? (isPaid ? 'Editar' : 'Cobrar/Edit') : (isPaid ? 'Ver' : 'Cobrar')}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View Cards */}
                <div className="flex flex-col gap-3 md:hidden">
                    {trip.clients.map(c => {
                        const { totalDebt, totalPaid, remaining } = getClientTotals(c);
                        const isPaid = c.status === 'PAID';
                        return (
                            <div key={c.id} className="bg-surface border border-surfaceHighlight rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <p className="font-bold text-text leading-tight">{c.name}</p>
                                        <p className="text-[10px] text-muted font-bold uppercase mt-1">{c.address}</p>
                                    </div>
                                    <StatusBadge status={c.status} />
                                </div>
                                <div className="grid grid-cols-2 gap-4 border-y border-surfaceHighlight py-3 my-1">
                                    <div>
                                        <p className="text-[10px] text-muted uppercase font-bold">Total Deuda</p>
                                        <p className="text-lg font-black text-text">$ {totalDebt.toLocaleString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-muted uppercase font-bold">Saldo Pend.</p>
                                        <p className={`text-lg font-black ${remaining <= 0 ? 'text-green-500' : 'text-blue-500'}`}>$ {remaining.toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-muted font-bold">COBRADO: <span className="text-green-500 font-black">$ {totalPaid.toLocaleString()}</span></span>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedClient(c)} 
                                        className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-md ${isPaid ? 'bg-surfaceHighlight text-text border border-surfaceHighlight' : 'bg-primary text-white shadow-primary/20'}`}
                                    >
                                        <DollarSign size={16} />
                                        {isPaid ? 'Detalle' : 'Registrar Cobro'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modals */}
            {selectedClient && (
                <PaymentModal 
                    client={selectedClient} 
                    totals={getClientTotals(selectedClient)} 
                    onClose={() => setSelectedClient(null)} 
                    onSave={handleUpdatePayment} 
                    isVale={isVale}
                />
            )}
            {isExpenseModalOpen && (
                <ExpenseModal 
                    onClose={() => setIsExpenseModalOpen(false)} 
                    onSave={handleAddExpense} 
                />
            )}
            {isReportOpen && (
                <TripReportModal 
                    trip={trip} 
                    onClose={() => setIsReportOpen(false)} 
                />
            )}
        </div>
    );
};

// ==========================================
// SUB-COMPONENTS & HELPERS
// ==========================================

const StatusBadge: React.FC<{ status: PaymentStatus }> = ({ status }) => (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
        status === 'PAID' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
        status === 'PARTIAL' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 
        'bg-gray-500/10 text-muted border-gray-500/20'
    }`}>
        {status === 'PAID' ? 'PAGADO' : status === 'PARTIAL' ? 'PARCIAL' : 'PENDIENTE'}
    </span>
);

const SummaryCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
    <div className="bg-surface border border-surfaceHighlight rounded-xl p-4 md:p-6 shadow-sm flex flex-col justify-between">
        <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{label}</span>
        <p className={`text-xl md:text-2xl font-black mt-1 ${color}`}>$ {value.toLocaleString()}</p>
    </div>
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
                    <div>
                        <label className="text-[10px] font-bold uppercase text-muted ml-1">Nombre</label>
                        <input className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm font-bold text-text outline-none focus:border-primary shadow-sm" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase text-muted ml-1">Dirección/Zona</label>
                        <input className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm font-bold text-text outline-none focus:border-primary shadow-sm" value={address} onChange={e => setAddress(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold uppercase text-muted ml-1">Saldo Ant.</label>
                            <input className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm font-bold text-text outline-none focus:border-primary shadow-sm" type="number" value={prev} onChange={e => setPrev(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase text-muted ml-1">Factura</label>
                            <input className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm font-bold text-text outline-none focus:border-primary shadow-sm" type="number" value={inv} onChange={e => setInv(e.target.value)} />
                        </div>
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
                        <div key={o.id} onClick={() => toggle(o.id)} className={`p-4 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${selectedIds.has(o.id) ? 'bg-primary/5 border-primary shadow-sm' : 'bg-surface border-surfaceHighlight hover:border-primary/50'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedIds.has(o.id) ? 'bg-primary border-primary' : 'border-muted'}`}>{selectedIds.has(o.id) && <Check size={14} className="text-white"/>}</div>
                                <div><p className="font-bold text-sm text-text">{o.clientName}</p><p className="text-[10px] text-muted font-bold uppercase">{o.displayId}</p></div>
                            </div>
                            <p className="font-black text-text">$ {o.total.toLocaleString()}</p>
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
    
    // Vale only fields
    const [prevBal, setPrevBal] = useState(client.previousBalance.toString());
    const [currInv, setCurrInv] = useState(client.currentInvoiceAmount.toString());

    const handleConfirm = () => {
        onSave(
            client.id, 
            parseFloat(cash)||0, 
            parseFloat(transfer)||0, 
            isExpected, 
            isVale ? parseFloat(prevBal)||0 : undefined,
            isVale ? parseFloat(currInv)||0 : undefined
        );
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
            <div className="bg-background w-full max-w-sm rounded-2xl border border-surfaceHighlight p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-lg text-text">Registro de Cobro</h3>
                    <button onClick={onClose}><X size={24} className="text-muted"/></button>
                </div>
                
                <div className="p-4 bg-surfaceHighlight/20 rounded-xl border border-surfaceHighlight">
                    <p className="text-[10px] font-bold text-muted uppercase">Cliente</p>
                    <p className="font-black text-text text-lg leading-tight mt-1">{client.name}</p>
                </div>

                {isVale && (
                    <div className="p-4 bg-orange-500/5 rounded-xl border border-orange-500/20 space-y-4">
                        <div className="flex items-center gap-2 text-orange-500 mb-2">
                            <Edit3 size={16} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Edición de Saldos (Admin)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold uppercase text-muted ml-1">Saldo Ant.</label>
                                <input className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm font-bold text-text outline-none focus:border-primary shadow-sm" type="number" value={prevBal} onChange={e => setPrevBal(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase text-muted ml-1">Factura</label>
                                <input className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm font-bold text-text outline-none focus:border-primary shadow-sm" type="number" value={currInv} onChange={e => setCurrInv(e.target.value)} />
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    {!isVale && (
                        <div className="bg-surfaceHighlight/20 p-4 rounded-xl">
                            <span className="text-[10px] font-bold uppercase text-muted">Deuda Total</span>
                            <p className="text-2xl font-black text-text">$ {totals.totalDebt.toLocaleString()}</p>
                        </div>
                    )}
                    
                    <div className="flex flex-col gap-4">
                        <div>
                            <label className="text-[10px] font-bold uppercase text-muted ml-1 flex items-center gap-1"><DollarSign size={12}/> Efectivo Recibido</label>
                            <input type="number" value={cash} onChange={e => setCash(e.target.value)} className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-xl font-black text-green-500 shadow-inner" placeholder="0" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase text-muted ml-1 flex items-center gap-1"><CreditCard size={12}/> Transf. Confirmada</label>
                            <input type="number" value={transfer} onChange={e => setTransfer(e.target.value)} className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-xl font-black text-blue-500 shadow-inner" placeholder="0" />
                        </div>
                        <label className="flex items-center gap-3 p-4 bg-surfaceHighlight/30 rounded-xl cursor-pointer border border-surfaceHighlight transition-all hover:bg-surfaceHighlight/50">
                            <input type="checkbox" checked={isExpected} onChange={e => setIsExpected(e.target.checked)} className="w-6 h-6 accent-primary rounded-md" />
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-text">Cliente promete transferir</span>
                                <span className="text-[10px] text-muted font-medium">Marcar si no se confirmó el pago aún</span>
                            </div>
                        </label>
                    </div>

                    <button 
                        onClick={handleConfirm} 
                        className="w-full py-4 rounded-xl bg-green-600 text-white font-black shadow-lg shadow-green-600/20 mt-4 active:scale-[0.98] transition-all"
                    >
                        Confirmar Registro
                    </button>
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
                    <div>
                        <label className="text-[10px] font-bold uppercase text-muted ml-1">Monto gastado</label>
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-xl font-black text-red-500 shadow-inner" placeholder="$ 0" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase text-muted ml-1">Nota / Observación</label>
                        <input value={note} onChange={e => setNote(e.target.value)} className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm text-text outline-none focus:border-primary shadow-sm" placeholder="Ej: Ticket Nro 1234" />
                    </div>
                    <button onClick={() => onSave({ type, amount: parseFloat(amount)||0, note })} className="w-full py-4 rounded-xl bg-red-600 text-white font-black shadow-lg shadow-red-600/20 mt-4 active:scale-[0.98] transition-all">Guardar Gasto</button>
                    <button onClick={onClose} className="w-full py-2 text-muted font-bold text-sm">Cancelar</button>
                </div>
             </div>
        </div>
    );
};

const TripReportModal: React.FC<{ trip: Trip; onClose: () => void }> = ({ trip, onClose }) => {
    const cash = trip.clients.reduce((acc, c) => acc + (c.paymentCash || 0), 0);
    const trans = trip.clients.reduce((acc, c) => acc + (c.paymentTransfer || 0), 0);
    const exp = trip.expenses.reduce((acc, e) => acc + e.amount, 0);
    const net = cash - exp;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
            <div className="bg-background w-full max-w-2xl rounded-2xl border border-surfaceHighlight shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-surfaceHighlight flex justify-between items-center bg-surface rounded-t-2xl">
                    <h3 className="font-bold text-xl text-text">Rendición de Viaje</h3>
                    <button onClick={onClose}><X size={24} className="text-muted"/></button>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-surface p-4 rounded-xl border border-surfaceHighlight text-center shadow-sm">
                            <span className="text-[10px] font-bold text-muted uppercase">Efectivo</span>
                            <p className="text-xl font-black text-text mt-1">$ {cash.toLocaleString()}</p>
                        </div>
                        <div className="bg-surface p-4 rounded-xl border border-surfaceHighlight text-center shadow-sm">
                            <span className="text-[10px] font-bold text-muted uppercase">Transf.</span>
                            <p className="text-xl font-black text-blue-500 mt-1">$ {trans.toLocaleString()}</p>
                        </div>
                        <div className="bg-surface p-4 rounded-xl border border-surfaceHighlight text-center shadow-sm">
                            <span className="text-[10px] font-bold text-muted uppercase">Gastos</span>
                            <p className="text-xl font-black text-red-500 mt-1">$ {exp.toLocaleString()}</p>
                        </div>
                    </div>
                    
                    <div className="bg-blue-600 p-8 rounded-2xl text-white text-center shadow-xl shadow-blue-500/20">
                        <span className="text-xs font-bold uppercase tracking-widest opacity-80">Saldo Neto a Entregar (Efectivo)</span>
                        <p className="text-5xl font-black mt-2 leading-none">$ {net.toLocaleString()}</p>
                        <div className="h-px bg-white/20 my-6"></div>
                        <p className="text-xs font-medium opacity-80">Efectivo total menos gastos realizados en el camino.</p>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase text-muted tracking-wider flex items-center gap-2">
                            <Fuel size={14} /> Detalle de Gastos Realizados
                        </h4>
                        {trip.expenses.length === 0 ? (
                            <p className="text-sm text-muted italic p-4 text-center border border-dashed border-surfaceHighlight rounded-xl">No hay gastos registrados en este viaje.</p>
                        ) : (
                            trip.expenses.map(e => (
                                <div key={e.id} className="flex justify-between items-center p-4 bg-surface border border-surfaceHighlight rounded-xl shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-red-500/10 text-red-500 rounded-lg"><Fuel size={16}/></div>
                                        <div><p className="font-bold text-sm text-text capitalize">{e.type}</p><p className="text-[10px] text-muted font-bold">{e.note || 'Sin observación'}</p></div>
                                    </div>
                                    <p className="font-black text-red-500">$ {e.amount.toLocaleString()}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                <div className="p-4 border-t border-surfaceHighlight bg-surface rounded-b-2xl">
                    <button onClick={onClose} className="w-full py-4 rounded-xl bg-surfaceHighlight font-black text-text transition-all hover:bg-surfaceHighlight/80">Cerrar Rendición</button>
                </div>
            </div>
        </div>
    );
};
