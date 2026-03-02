
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Login } from './views/Login';
import { Dashboard } from './views/Dashboard';
import { Annotations } from './views/Annotations';
import { OrderList } from './views/OrderList';
import { CreateBudget } from './views/CreateBudget';
import { OrderSheet } from './views/OrderSheet';
import { PaymentsOverview } from './views/PaymentsOverview';
import { PaymentsProviders } from './views/PaymentsProviders';
import { PaymentsHistory } from './views/PaymentsHistory';
import { ProviderStatements } from './views/ProviderStatements';
import { ClientsMaster } from './views/ClientsMaster';
import { ClientCollections } from './views/ClientCollections';
import { AccountStatements } from './views/AccountStatements';
import { Catalog } from './views/Catalog';
import { SuppliersMaster } from './views/SuppliersMaster';
import { Presupuestador } from './views/Presupuestador';
import { Etiquetador } from './views/Etiquetador';
import { PriceManagement } from './views/PriceManagement';
import { Settings } from './views/Settings';
import { StockControl } from './views/StockControl';
import { Attendance } from './views/Attendance';
import { InventoryInbounds } from './views/InventoryInbounds';
import { InventoryAdjustments } from './views/InventoryAdjustments';
import { InventoryTransfers } from './views/InventoryTransfers';
import { InventoryHistory } from './views/InventoryHistory';
import { SupplierOrders } from './views/SupplierOrders';
import { ListaChina } from './views/ListaChina';
import { Expirations } from './views/Expirations';
import { CashCount } from './views/CashCount';
import { CashConcepts } from './views/CashConcepts';
import { CashMovements } from './views/CashMovements';
import { DailyCashSheet } from './views/DailyCashSheet';
import { BankMovements } from './views/BankMovements';
import { OrderAssemblyModal } from './components/OrderAssemblyModal';
import { 
    View, User, DetailedOrder, OrderStatus, Trip, Provider, Transfer, 
    AppNotification, ProductExpiration, Product, HistoryEntry 
} from './types';
import { 
    hasPermission, 
    applyQuantityChange, 
    toggleProductCheck, 
    updateObservations, 
    advanceOrderStatus, 
    addProductToOrder, 
    updateProductPrice, 
    removeProductFromOrder, 
    updatePaymentMethod
} from './logic';

// Helper local si no existe en logic.ts
const isActiveStatus = (status: OrderStatus) => {
    return [
        OrderStatus.EN_ARMADO,
        OrderStatus.ARMADO,
        OrderStatus.ARMADO_CONTROLADO,
        OrderStatus.FACTURADO,
        OrderStatus.FACTURA_CONTROLADA,
        OrderStatus.EN_TRANSITO
    ].includes(status);
};

const VIEW_STORAGE_KEY = 'alfonsa_last_view';

export default function App() {
    const [session, setSession] = useState<any>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    
    // Inicializar vista desde LocalStorage si existe, para persistencia entre refrescos
    const [currentView, setCurrentView] = useState<View>(() => {
        return (localStorage.getItem(VIEW_STORAGE_KEY) as View) || View.DASHBOARD;
    });

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);
    
    // Data States
    const [orders, setOrders] = useState<DetailedOrder[]>([]);
    const [activeOrder, setActiveOrder] = useState<DetailedOrder | null>(null);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [expirations, setExpirations] = useState<ProductExpiration[]>([]);
    const [trips, setTrips] = useState<Trip[]>([]);
    const [providers, setProviders] = useState<Provider[]>([]);
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

    // History Filters
    const [historyFilter, setHistoryFilter] = useState({ month: new Date().getMonth(), year: new Date().getFullYear(), search: '' });
    const [hasMoreHistory, setHasMoreHistory] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) fetchProfile(session.user.id);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) fetchProfile(session.user.id);
            else setCurrentUser(null);
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (currentUser) {
            fetchActiveOrders();
            fetchNotifications();
            fetchProviders();
            fetchTransfers();
            fetchTrips();
        }
    }, [currentUser]);

    // Persistir vista actual cuando cambia (solo si hay usuario logueado)
    useEffect(() => {
        if (currentUser) {
            localStorage.setItem(VIEW_STORAGE_KEY, currentView);
        }
    }, [currentView, currentUser]);

    const fetchProfile = async (userId: string) => {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (data) {
            // Fetch permissions
            const { data: perms } = await supabase.from('user_permissions').select('permission_key').eq('user_id', userId);
            const permissions = perms?.map(p => p.permission_key) || [];
            
            const user: User = { 
                ...data, 
                role: data.role as 'vale' | 'armador',
                permissions 
            };
            setCurrentUser(user);

            // REDIRECCIÓN AUTOMÁTICA SEGÚN ROL SOLO SI NO HAY HISTORIAL
            // Si el usuario refresca la página, respetamos la vista guardada.
            // Si es un login limpio (sin historial), aplicamos el default.
            const hasPersistedView = localStorage.getItem(VIEW_STORAGE_KEY);
            
            if (!hasPersistedView) {
                if (user.role === 'armador') {
                    setCurrentView(View.ORDERS);
                } else {
                    // Vale u otros roles administrativos
                    setCurrentView(View.DASHBOARD);
                }
            }

            if (user.theme_preference === 'dark') {
                document.documentElement.classList.add('dark');
                setIsDarkMode(true);
            } else {
                document.documentElement.classList.remove('dark');
                setIsDarkMode(false);
            }
        }
    };

    const fetchActiveOrders = async () => {
        const { data, error } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .not('status', 'in', '("entregado","pagado")')
            .order('created_at', { ascending: false });
            
        if (data) {
            const mapped = mapOrders(data);
            setOrders(mapped);
        }
    };

    const mapOrders = (rawOrders: any[]): DetailedOrder[] => {
        return rawOrders.map((o: any) => ({
            id: o.id,
            displayId: o.display_id,
            clientName: o.client_name,
            zone: o.zone,
            status: o.status,
            createdDate: new Date(o.created_at).toLocaleDateString('es-AR'),
            lastUpdated: o.updated_at || o.created_at,
            paymentMethod: o.payment_method,
            assemblerId: o.assembler_id,
            assemblerName: o.assembler_name,
            controllerId: o.controller_id,
            controllerName: o.controller_name,
            invoicerName: o.invoicer_name,
            total: o.total,
            observations: o.observations,
            isReservation: o.is_reservation,
            scheduledDate: o.scheduled_date,
            history: typeof o.history === 'string' ? JSON.parse(o.history) : o.history || [],
            productCount: (o.order_items || []).length,
            products: (o.order_items || []).map((i: any) => ({
                code: i.code,
                name: i.name,
                quantity: i.quantity,
                originalQuantity: i.original_quantity,
                shippedQuantity: i.shipped_quantity,
                unitPrice: i.unit_price,
                subtotal: i.subtotal,
                isChecked: i.is_checked
            }))
        }));
    };

    const fetchHistoryOrders = async (month: number, year: number, search: string, page: number) => {
        // Implementation for history fetching
        // This would append to orders or set a separate history state in a real app with pagination
    };

    const loadMoreHistory = () => {
        // Pagination logic
    };

    const fetchNotifications = async () => {
        if (!currentUser) return;
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('is_read', false)
            .order('created_at', { ascending: false });
        if (data) setNotifications(data);
    };

    // --- FETCHERS FOR MODULES ---
    const fetchProviders = async () => {
        const { data } = await supabase.from('providers').select(`*, provider_accounts(*)`).order('priority');
        if (data) {
            setProviders(data.map((p: any) => ({
                ...p,
                goalAmount: p.goal_amount,
                accounts: p.provider_accounts?.map((a: any) => ({ ...a, providerId: a.provider_id, identifierAlias: a.identifier_alias, identifierCBU: a.identifier_cbu, metaAmount: a.meta_amount, currentAmount: a.current_amount, pendingAmount: a.pending_amount })) || []
            })));
        }
    };

    const fetchTransfers = async () => {
        // Fetch ALL pending transfers to ensure they never disappear
        const { data: pendingData } = await supabase
            .from('transfers')
            .select('*')
            .eq('status', 'Pendiente')
            .order('created_at', { ascending: false });

        // Fetch recent history (non-pending) - limit to 500 to avoid performance issues
        const { data: historyData } = await supabase
            .from('transfers')
            .select('*')
            .neq('status', 'Pendiente')
            .order('created_at', { ascending: false })
            .limit(500);

        const allTransfers = [...(pendingData || []), ...(historyData || [])];
        
        // Sort combined list by date descending
        allTransfers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        if (allTransfers) {
            setTransfers(allTransfers.map((t: any) => ({
                ...t, clientName: t.client_name, date: t.date_text, providerId: t.provider_id, accountId: t.account_id, isLoadedInSystem: t.is_loaded_in_system
            })));
        }
    };

    const fetchTrips = async () => {
        const { data } = await supabase.from('trips').select(`*, trip_clients(*), trip_expenses(*)`).order('created_at', { ascending: false });
        if (data) {
            setTrips(data.map((t: any) => ({
                id: t.id, displayId: t.display_id, name: t.name, status: t.status, driverName: t.driver_name, date: t.date_text, route: t.route,
                clients: t.trip_clients.map((c: any) => ({ ...c, previousBalance: c.previous_balance, currentInvoiceAmount: c.current_invoice_amount, paymentCash: c.payment_cash, paymentTransfer: c.payment_transfer, isTransferExpected: c.is_transfer_expected })),
                expenses: t.trip_expenses
            })));
        }
    };

    const toggleTheme = () => {
        setIsDarkMode(!isDarkMode);
        document.documentElement.classList.toggle('dark');
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        localStorage.removeItem(VIEW_STORAGE_KEY); // Limpiar historial de vista al cerrar sesión
        setCurrentUser(null);
        setSession(null);
        setCurrentView(View.DASHBOARD); // Reset a default
    };

    // --- HANDLERS LOGIC ---
    const markAllNotificationsRead = async () => { 
        if(!currentUser) return;
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', currentUser.id);
        setNotifications([]); 
    };
    const clearNotifications = async () => { 
        if(!currentUser) return;
        await supabase.from('notifications').delete().eq('user_id', currentUser.id);
        setNotifications([]); 
    };
    const handleNotificationClick = (n: AppNotification) => { console.log(n); };
    
    const handleClaimOrder = async (o: DetailedOrder) => {
        if (!currentUser) return;
        const updates: any = { updated_by: currentUser.id };
        if (o.status === OrderStatus.EN_ARMADO) { updates.assembler_id = currentUser.id; updates.assembler_name = currentUser.name; }
        else if (o.status === OrderStatus.ARMADO) { updates.controller_id = currentUser.id; updates.controller_name = currentUser.name; }
        await supabase.from('orders').update(updates).eq('id', o.id);
        fetchActiveOrders();
    };

    const handleDeleteOrder = async (id: string) => {
        const { error } = await supabase.from('orders').delete().eq('id', id);
        if (error) {
            alert("Error al eliminar el pedido: " + error.message);
        } else {
            fetchActiveOrders();
        }
    };

    const handleDeleteOrders = async (ids: string[]) => {
        const { error } = await supabase.from('orders').delete().in('id', ids);
        if (error) {
            alert("Error al eliminar los pedidos: " + error.message);
        } else {
            fetchActiveOrders();
        }
    };

    const handleAdvanceOrder = async (o: DetailedOrder) => {
        const next = advanceOrderStatus(o);
        await supabase.from('orders').update({ status: next.status }).eq('id', o.id);
        fetchActiveOrders();
    };

    const handleToggleLock = async (o: DetailedOrder) => {
        // Logic to toggle assembler/controller lock
        let updates: any = {};
        if (o.status === OrderStatus.EN_ARMADO) {
            updates.assembler_id = o.assemblerId ? null : currentUser?.id;
            updates.assembler_name = o.assemblerId ? null : currentUser?.name;
        } else if (o.status === OrderStatus.ARMADO) {
            updates.controller_id = o.controllerId ? null : currentUser?.id;
            updates.controller_name = o.controllerId ? null : currentUser?.name;
        }
        await supabase.from('orders').update(updates).eq('id', o.id);
        fetchActiveOrders();
    };
    
    // --- TRIPS HANDLERS ---
    const handleSaveTrip = async (trip: Trip) => {
        const isNew = !trip.id || trip.id.startsWith('trip-');
        const payload = { display_id: trip.displayId, name: trip.name, status: trip.status, driver_name: trip.driverName, date_text: trip.date, route: trip.route };
        let tripId = trip.id;
        
        if (isNew) {
            const { data } = await supabase.from('trips').insert([payload]).select().single();
            if(data) tripId = data.id;
        } else {
            await supabase.from('trips').update(payload).eq('id', tripId);
        }

        // Sync Clients
        await supabase.from('trip_clients').delete().eq('trip_id', tripId);
        if (trip.clients.length > 0) {
            const clients = trip.clients.map(c => ({
                trip_id: tripId, name: c.name, address: c.address, previous_balance: c.previousBalance, current_invoice_amount: c.currentInvoiceAmount,
                payment_cash: c.paymentCash, payment_transfer: c.paymentTransfer, is_transfer_expected: c.isTransferExpected, status: c.status
            }));
            await supabase.from('trip_clients').insert(clients);
        }

        // Sync Expenses
        await supabase.from('trip_expenses').delete().eq('trip_id', tripId);
        if (trip.expenses.length > 0) {
            const expenses = trip.expenses.map(e => ({ trip_id: tripId, type: e.type, amount: e.amount, note: e.note }));
            await supabase.from('trip_expenses').insert(expenses);
        }
        fetchTrips();
    };

    const handleDeleteTrip = async (id: string) => {
        await supabase.from('trip_expenses').delete().eq('trip_id', id);
        await supabase.from('trip_clients').delete().eq('trip_id', id);
        await supabase.from('trips').delete().eq('id', id);
        fetchTrips();
    };
    
    // --- PROVIDERS HANDLERS ---
    const handleUpdateProvider = async (p: Provider) => {
        const isNew = p.id.startsWith('p-');
        let providerId = p.id;
        const payload = { name: p.name, goal_amount: p.goalAmount, priority: p.priority, status: p.status };
        
        if (isNew) {
            const { data } = await supabase.from('providers').insert([payload]).select().single();
            if (data) providerId = data.id;
        } else {
            await supabase.from('providers').update(payload).eq('id', providerId);
        }

        await supabase.from('provider_accounts').delete().eq('provider_id', providerId);
        if (p.accounts.length > 0) {
            const accounts = p.accounts.map(a => ({
                provider_id: providerId, condition: a.condition, holder: a.holder, identifier_alias: a.identifierAlias, identifier_cbu: a.identifierCBU,
                meta_amount: a.metaAmount, current_amount: a.currentAmount, pending_amount: a.pendingAmount, status: a.status
            }));
            await supabase.from('provider_accounts').insert(accounts);
        }
        fetchProviders();
        return true;
    };

    const handleDeleteProvider = async (id: string) => {
        await supabase.from('provider_accounts').delete().eq('provider_id', id);
        await supabase.from('providers').delete().eq('id', id);
        fetchProviders();
    };

    const handleResetProvider = async (id: string) => {
        await supabase.from('transfers').delete().eq('provider_id', id);
        fetchTransfers();
    };
    
    // --- PAYMENTS HANDLERS ---
    const handleUpdateTransfer = async (t: Transfer) => {
        const payload = { client_name: t.clientName, amount: t.amount, date_text: t.date, provider_id: t.providerId, account_id: t.accountId, notes: t.notes, status: t.status, is_loaded_in_system: t.isLoadedInSystem };
        if (t.id.startsWith('t-')) {
            await supabase.from('transfers').insert([payload]);
        } else {
            await supabase.from('transfers').update(payload).eq('id', t.id);
        }
        fetchTransfers();
    };

    const handleConfirmTransfer = async (id: string, status: any) => {
        await supabase.from('transfers').update({ status }).eq('id', id);
        fetchTransfers();
    };

    const handleDeleteTransfer = async (id: string) => {
        await supabase.from('transfers').delete().eq('id', id);
        fetchTransfers();
    };

    const handleClearHistory = async () => {
        // DANGER: Clears all transfers!
        // await supabase.from('transfers').delete().neq('id', '0'); 
        // fetchTransfers();
    };

    const handleUpdateTransferStatus = async (id: string, status: any) => {
        await supabase.from('transfers').update({ status }).eq('id', id);
        fetchTransfers();
    };

    const handleReleaseOrder = (order: DetailedOrder) => {
        setActiveOrder(null);
    };

    const handleUpdateProductQuantity = (code: string, newQty: number) => {
        if (!activeOrder) return;
        const historyEntry: HistoryEntry = {
            timestamp: new Date().toISOString(),
            userId: currentUser?.id || 'unknown',
            userName: currentUser?.name || 'Usuario',
            action: 'QUANTITY_UPDATE',
            details: `Actualizó cantidad de ${code} a ${newQty}`,
            previousState: activeOrder.status,
            newState: activeOrder.status
        };

        let updatedOrder = applyQuantityChange(activeOrder, code, newQty);
        updatedOrder = { ...updatedOrder, history: [...(updatedOrder.history || []), historyEntry] };
        setActiveOrder(updatedOrder as DetailedOrder);
    };

    const handleSaveAssembly = async (updatedOrder: any, shouldAdvance: boolean, notes?: string) => {
        try {
            const { data: existingDbItems } = await supabase
                .from('order_items')
                .select('code')
                .eq('order_id', updatedOrder.id);
            
            const existingCodes = new Set(existingDbItems?.map((i: any) => i.code));
            const isPostShippingStatus = [OrderStatus.EN_TRANSITO, OrderStatus.ENTREGADO, OrderStatus.PAGADO].includes(updatedOrder.status);

            for (const p of updatedOrder.products) {
                 let finalShippedQuantity = p.shippedQuantity;
                 if (!isPostShippingStatus) { finalShippedQuantity = p.quantity; } 
                 else { finalShippedQuantity = p.shippedQuantity ?? p.quantity; }

                 const payload = {
                     order_id: updatedOrder.id, code: p.code, name: p.name, quantity: p.quantity, original_quantity: p.originalQuantity,
                     shipped_quantity: finalShippedQuantity, unit_price: p.unit_price || p.unitPrice, subtotal: p.subtotal, is_checked: shouldAdvance ? false : p.isChecked
                 };

                 if (existingCodes.has(p.code)) { await supabase.from('order_items').update(payload).eq('order_id', updatedOrder.id).eq('code', p.code); } 
                 else { await supabase.from('order_items').insert(payload); }
            }

            let nextStatus = updatedOrder.status;
            let history = updatedOrder.history || [];
            
            if (shouldAdvance) {
                 const advanced = advanceOrderStatus(updatedOrder);
                 nextStatus = advanced.status;
                 history = [...history, { timestamp: new Date().toISOString(), userId: currentUser?.id, userName: currentUser?.name, action: 'ADVANCE_STATUS', previousState: updatedOrder.status, newState: nextStatus, details: notes || 'Avance desde modal' }];
            }

            const orderUpdates: any = {
                status: nextStatus, payment_method: updatedOrder.paymentMethod, observations: updatedOrder.observations,
                total: updatedOrder.total, history: history, updated_by: currentUser?.id 
            };

            if (shouldAdvance) {
                if (updatedOrder.status === OrderStatus.EN_ARMADO && !updatedOrder.assemblerId) { orderUpdates.assembler_id = currentUser?.id; orderUpdates.assembler_name = currentUser?.name; } 
                else if (updatedOrder.status === OrderStatus.ARMADO && !updatedOrder.controllerId) { orderUpdates.controller_id = currentUser?.id; orderUpdates.controller_name = currentUser?.name; }
            }

            await supabase.from('orders').update(orderUpdates).eq('id', updatedOrder.id);
            setActiveOrder(null); 
            fetchActiveOrders(); 
        } catch (err: any) { alert("Error al guardar cambios: " + err.message); }
    };

    if (!session || !currentUser) {
        return <Login isDarkMode={isDarkMode} onToggleTheme={() => toggleTheme()} />;
    }

    return (
        <div className={`flex h-screen bg-background text-text transition-colors duration-300 ${isDarkMode ? 'dark' : ''}`}>
            <Sidebar 
                currentView={currentView} 
                onNavigate={(v) => { setCurrentView(v); setIsSidebarOpen(false); }} 
                currentUser={currentUser}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />
            
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header 
                    onMenuClick={() => setIsSidebarOpen(true)}
                    title="Alfonsa Management"
                    subtitle="Panel de Control"
                    isDarkMode={isDarkMode}
                    onToggleTheme={() => toggleTheme()}
                    currentUser={currentUser}
                    onLogout={handleLogout}
                    notifications={notifications}
                    onMarkAllRead={markAllNotificationsRead}
                    onClearNotifications={clearNotifications}
                    onNotificationClick={handleNotificationClick}
                />

                <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
                    {currentView === View.DASHBOARD && <Dashboard orders={orders} expirations={expirations} onNavigate={setCurrentView} />}
                    {currentView === View.ANOTACIONES && <Annotations currentUser={currentUser} />}
                    {currentView === View.ORDERS && (
                        <OrderList 
                            onNavigate={setCurrentView} 
                            orders={orders} 
                            onFetchHistory={(m, y, s) => fetchHistoryOrders(m, y, s, 0)}
                            onLoadMoreHistory={loadMoreHistory}
                            hasMoreHistory={hasMoreHistory}
                            historyFilter={historyFilter}
                            currentUser={currentUser}
                            onOpenAssembly={setActiveOrder}
                            onClaimOrder={handleClaimOrder}
                            onDeleteOrder={handleDeleteOrder}
                            onDeleteOrders={handleDeleteOrders}
                            onAdvanceOrder={handleAdvanceOrder}
                            onToggleLock={handleToggleLock}
                            onRefresh={fetchActiveOrders}
                        />
                    )}
                    {currentView === View.CREATE_BUDGET && (
                        <CreateBudget 
                            onNavigate={setCurrentView} 
                            currentUser={currentUser}
                            onCreateOrder={async (order) => {
                                try {
                                    const { data, error } = await supabase.from('orders').insert({
                                        display_id: order.displayId, client_name: order.clientName, total: order.total, status: order.status,
                                        zone: order.zone, observations: order.observations, history: order.history, is_reservation: order.isReservation,
                                        scheduled_date: order.scheduledDate, created_by: currentUser.id 
                                    }).select().single();
                                    if (error) throw error;
                                    if (data) {
                                        const items = order.products.map(p => ({
                                            order_id: data.id, code: p.code, name: p.name, quantity: p.quantity, original_quantity: p.originalQuantity, unit_price: p.unitPrice, subtotal: p.subtotal, is_checked: false
                                        }));
                                        await supabase.from('order_items').insert(items);
                                        await fetchActiveOrders();
                                        setCurrentView(View.ORDERS);
                                    }
                                } catch (e: any) { alert("Error al crear: " + e.message); }
                            }}
                        />
                    )}
                    {currentView === View.ORDER_SHEET && <OrderSheet currentUser={currentUser} orders={orders} trips={trips} onSaveTrip={handleSaveTrip} onDeleteTrip={handleDeleteTrip} selectedTripId={selectedTripId} onSelectTrip={setSelectedTripId} />}
                    {currentView === View.PAYMENTS_OVERVIEW && <PaymentsOverview providers={providers} onDeleteProvider={handleDeleteProvider} onUpdateProviders={handleUpdateProvider} transfers={transfers} onUpdateTransfers={handleUpdateTransfer} onConfirmTransfer={handleConfirmTransfer} onDeleteTransfer={handleDeleteTransfer} />}
                    {currentView === View.PAYMENTS_PROVIDERS && <PaymentsProviders providers={providers} onUpdateProviders={handleUpdateProvider} onDeleteProvider={handleDeleteProvider} onResetProvider={handleResetProvider} />}
                    {currentView === View.PAYMENTS_HISTORY && <PaymentsHistory transfers={transfers} onDeleteTransfer={handleDeleteTransfer} onClearHistory={handleClearHistory} onUpdateTransfers={handleUpdateTransfer} onUpdateStatus={handleUpdateTransferStatus} providers={providers} />}
                    {currentView === View.PROVIDER_STATEMENTS && <ProviderStatements currentUser={currentUser} />}
                    {currentView === View.CLIENTS_MASTER && <ClientsMaster currentUser={currentUser} />}
                    {currentView === View.CLIENT_COLLECTIONS && <ClientCollections currentUser={currentUser} />}
                    {currentView === View.CLIENT_STATEMENTS && <AccountStatements currentUser={currentUser} />}
                    {currentView === View.CATALOG && <Catalog currentUser={currentUser} />}
                    {currentView === View.SUPPLIERS_MASTER && <SuppliersMaster currentUser={currentUser} />}
                    {currentView === View.PRESUPUESTADOR && <Presupuestador />}
                    {currentView === View.ETIQUETADOR && <Etiquetador />}
                    {currentView === View.PRICE_MANAGEMENT && <PriceManagement currentUser={currentUser} />}
                    {currentView === View.SETTINGS && <Settings 
                        currentUser={currentUser} 
                        onUpdateProfile={async (n, a, b, t) => { 
                            await supabase.from('profiles').update({ name: n, avatar_url: a, preferred_branch: b, theme_preference: t }).eq('id', currentUser.id); 
                            await fetchProfile(currentUser.id); 
                        }} 
                        isDarkMode={isDarkMode} 
                        onToggleTheme={() => toggleTheme()} 
                        onLogout={handleLogout}
                    />}
                    {currentView === View.STOCK_CONTROL && <StockControl currentUser={currentUser} />}
                    {currentView === View.ATTENDANCE && <Attendance currentUser={currentUser} />}
                    {currentView === View.INV_INBOUNDS && <InventoryInbounds currentUser={currentUser} />}
                    {currentView === View.INV_ADJUSTMENTS && <InventoryAdjustments currentUser={currentUser} />}
                    {currentView === View.INV_TRANSFERS && <InventoryTransfers currentUser={currentUser} />}
                    {currentView === View.INV_HISTORY && <InventoryHistory currentUser={currentUser} />}
                    {currentView === View.INV_SUPPLIER_ORDERS && <SupplierOrders currentUser={currentUser} />}
                    {currentView === View.LISTA_CHINA && <ListaChina />}
                    {currentView === View.EXPIRATIONS && <Expirations />}
                    {currentView === View.CASH_COUNT && <CashCount currentUser={currentUser} />}
                    {currentView === View.DAILY_CASH_SHEET && <DailyCashSheet currentUser={currentUser} onNavigate={setCurrentView} />}
                    {currentView === View.CASH_MOVEMENTS && <CashMovements currentUser={currentUser} />}
                    {currentView === View.BANK_MOVEMENTS && <BankMovements currentUser={currentUser} />}
                    {currentView === View.CASH_CONCEPTS && <CashConcepts />}
                    
                    {/* HIDDEN / ADMIN TOOLS */}
                </main>

                {activeOrder && (
                    <OrderAssemblyModal 
                        order={activeOrder} 
                        currentUser={currentUser} 
                        onClose={() => handleReleaseOrder(activeOrder)}
                        onSave={handleSaveAssembly}
                        onUpdateProduct={handleUpdateProductQuantity}
                        onToggleCheck={(code) => setActiveOrder(toggleProductCheck(activeOrder, code) as DetailedOrder)}
                        onUpdateObservations={(text) => setActiveOrder(updateObservations(activeOrder, text) as DetailedOrder)}
                        onAddProduct={(prod) => {
                            const updatedOrder = addProductToOrder(activeOrder, prod);
                            updatedOrder.history = [...(updatedOrder.history || []), {
                                timestamp: new Date().toISOString(),
                                userId: currentUser.id,
                                userName: currentUser.name,
                                action: 'ITEM_ADDED_NEW',
                                details: `Agregó nuevo ítem: ${prod.name} (${prod.quantity} un.)`,
                                previousState: activeOrder.status,
                                newState: activeOrder.status
                            }];
                            const detailed = { ...updatedOrder, productCount: updatedOrder.products.length } as DetailedOrder;
                            setActiveOrder(detailed);
                        }}
                        onUpdatePrice={(code, price) => setActiveOrder(updateProductPrice(activeOrder, code, price) as DetailedOrder)}
                        onRemoveProduct={(code) => {
                            const updatedOrder = removeProductFromOrder(activeOrder, code);
                            const detailed = { ...updatedOrder, productCount: updatedOrder.products.length } as DetailedOrder;
                            setActiveOrder(detailed);
                        }}
                        onDeleteOrder={handleDeleteOrder}
                    />
                )}
            </div>
        </div>
    );
}
