
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Login } from './views/Login';
import { Dashboard } from './views/Dashboard';
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
import { OrderAssemblyModal } from './components/OrderAssemblyModal';
import { View, User, DetailedOrder, Trip, ProductExpiration, Provider, Transfer, OrderStatus, Product, ExpirationStatus, AppNotification } from './types';
import { 
    advanceOrderStatus, 
    updatePaymentMethod, 
    updateObservations, 
    toggleProductCheck, 
    applyQuantityChange, 
    addProductToOrder,
    updateProductPrice,
    removeProductFromOrder
} from './logic';

export default function App() {
    const [session, setSession] = useState<any>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    
    const [hasInitialRedirect, setHasInitialRedirect] = useState(false);
    
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return document.documentElement.classList.contains('dark');
        }
        return false;
    });
    
    // --- ESTADO DE PEDIDOS OPTIMIZADO ---
    const [activeOrders, setActiveOrders] = useState<DetailedOrder[]>([]);
    const [historyOrders, setHistoryOrders] = useState<DetailedOrder[]>([]);
    const orders = [...activeOrders, ...historyOrders];

    // Paginación del historial
    const HISTORY_PAGE_SIZE = 20;
    const [historyPage, setHistoryPage] = useState(0);
    const [hasMoreHistory, setHasMoreHistory] = useState(true);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    const [historyFilter, setHistoryFilter] = useState({
        month: new Date().getMonth(),
        year: new Date().getFullYear(),
        search: ''
    });

    // --- NOTIFICACIONES (DB) ---
    const [notifications, setNotifications] = useState<AppNotification[]>([]);

    const [trips, setTrips] = useState<Trip[]>([]);
    const [providers, setProviders] = useState<Provider[]>([]); 
    const [transfers, setTransfers] = useState<Transfer[]>([]); 
    const [expirations, setExpirations] = useState<ProductExpiration[]>([]);
    
    const [activeOrder, setActiveOrder] = useState<DetailedOrder | null>(null);
    const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session?.user) fetchProfile(session.user.id);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
                setCurrentUser(null);
                setHasInitialRedirect(false); 
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (currentUser && !hasInitialRedirect) {
            if (currentUser.role === 'armador') {
                setCurrentView(View.ORDERS);
            } else {
                setCurrentView(View.DASHBOARD);
            }
            setHasInitialRedirect(true);
        }
    }, [currentUser, hasInitialRedirect]);

    const fetchProfile = async (userId: string) => {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (data) {
            const { data: perms } = await supabase.from('user_permissions').select('permission_key').eq('user_id', userId);
            const permissions = perms ? perms.map(p => p.permission_key) : [];
            
            if (data.theme_preference) {
                const dbThemeIsDark = data.theme_preference === 'dark';
                if (dbThemeIsDark !== isDarkMode) {
                    toggleTheme(dbThemeIsDark);
                }
            }
            
            const userWithRole = { ...data, permissions };
            setCurrentUser(userWithRole);
            
            // Carga inicial optimizada
            await Promise.all([
                fetchActiveOrders(),
                fetchHistoryOrders(new Date().getMonth(), new Date().getFullYear(), '', 0), 
                fetchNotifications(userId),
                fetchTrips(),
                fetchProviders(),
                fetchTransfers()
            ]);
            
            fetchExpirations();
            setupRealtimeSubscription(userWithRole); 
        }
    };

    const fetchNotifications = async (userId: string) => {
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20);
        
        if (data) {
            setNotifications(data as AppNotification[]);
        }
    };

    const markNotificationRead = async (notification: AppNotification) => {
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n));
        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notification.id);
    };

    const markAllNotificationsRead = async () => {
        if (!currentUser) return;
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', currentUser.id);
    };

    const clearNotifications = async () => {
        if (!currentUser) return;
        setNotifications([]);
        await supabase
            .from('notifications')
            .delete()
            .eq('user_id', currentUser.id);
    };

    const handleNotificationClick = async (n: AppNotification) => {
        await markNotificationRead(n);
        if (n.link_id) {
            const order = activeOrders.find(o => o.id === n.link_id) || historyOrders.find(o => o.id === n.link_id);
            if (order) {
                if (!order.products || order.products.length === 0) {
                     const fetched = await fetchSingleOrder(n.link_id);
                     if (fetched) setActiveOrder(fetched);
                } else {
                     setActiveOrder(order);
                }
                setCurrentView(View.ORDERS);
            } else {
                const fetched = await fetchSingleOrder(n.link_id);
                if (fetched) {
                    setActiveOrder(fetched);
                    setCurrentView(View.ORDERS);
                }
            }
        }
    };

    // --- LÓGICA DE VIAJES ---
    const fetchTrips = async () => {
        try {
            const { data, error } = await supabase
                .from('trips')
                .select(`*, trip_clients(*), trip_expenses(*)`)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                const mappedTrips: Trip[] = data.map((t: any) => ({
                    id: t.id,
                    displayId: t.display_id,
                    name: t.name,
                    status: t.status,
                    driverName: t.driver_name,
                    date: t.date_text,
                    route: t.route,
                    clients: (t.trip_clients || []).map((c: any) => ({
                        id: c.id,
                        name: c.name,
                        address: c.address,
                        previousBalance: c.previous_balance,
                        currentInvoiceAmount: c.current_invoice_amount,
                        paymentCash: c.payment_cash,
                        paymentTransfer: c.payment_transfer,
                        isTransferExpected: c.is_transfer_expected,
                        status: c.status
                    })),
                    expenses: (t.trip_expenses || []).map((e: any) => ({
                        id: e.id,
                        type: e.type,
                        amount: e.amount,
                        note: e.note,
                        timestamp: e.timestamp
                    }))
                }));
                setTrips(mappedTrips);
            }
        } catch (error) {
            console.error("Error fetching trips:", error);
        }
    };

    // --- LOGICA DE PAGOS Y PROVEEDORES (PERSISTENCIA DB) ---
    const fetchProviders = async () => {
        try {
            const { data, error } = await supabase
                .from('providers')
                .select(`*, provider_accounts(*)`)
                .order('priority', { ascending: true });
            
            if (error) throw error;

            if (data) {
                const mapped: Provider[] = data.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    goalAmount: p.goal_amount,
                    priority: p.priority,
                    status: p.status,
                    accounts: (p.provider_accounts || []).map((a: any) => ({
                        id: a.id,
                        providerId: a.provider_id,
                        condition: a.condition,
                        holder: a.holder,
                        identifierAlias: a.identifier_alias,
                        identifierCBU: a.identifier_cbu,
                        metaAmount: a.meta_amount,
                        currentAmount: a.current_amount,
                        pendingAmount: a.pending_amount,
                        status: a.status
                    }))
                }));
                setProviders(mapped);
            }
        } catch (error) {
            console.error("Error fetching providers:", error);
        }
    };

    const fetchTransfers = async () => {
        try {
            const { data, error } = await supabase
                .from('transfers')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;

            if (data) {
                const mapped: Transfer[] = data.map((t: any) => ({
                    id: t.id,
                    clientName: t.client_name,
                    amount: t.amount,
                    date: t.date_text,
                    providerId: t.provider_id,
                    accountId: t.account_id,
                    notes: t.notes,
                    status: t.status,
                    isLoadedInSystem: t.is_loaded_in_system
                }));
                setTransfers(mapped);
            }
        } catch (error) {
            console.error("Error fetching transfers:", error);
        }
    };

    // --- GESTIÓN DE PROVEEDORES (DB) ---
    const handleUpdateProvider = async (p: Provider): Promise<boolean> => {
        try {
            const isNew = p.id.startsWith('p-');
            let providerId = p.id;

            const providerPayload = {
                name: p.name,
                goal_amount: p.goalAmount,
                priority: p.priority,
                status: p.status
            };

            if (isNew) {
                const { data, error } = await supabase.from('providers').insert([providerPayload]).select().single();
                if (error) throw error;
                providerId = data.id;
            } else {
                const { error } = await supabase.from('providers').update(providerPayload).eq('id', providerId);
                if (error) throw error;
            }

            // Sync Accounts: Delete existing and re-insert (simple sync strategy)
            await supabase.from('provider_accounts').delete().eq('provider_id', providerId);
            
            if (p.accounts.length > 0) {
                const accountsPayload = p.accounts.map(a => ({
                    provider_id: providerId,
                    condition: a.condition,
                    holder: a.holder,
                    identifier_alias: a.identifierAlias,
                    identifier_cbu: a.identifierCBU,
                    meta_amount: a.metaAmount,
                    current_amount: a.currentAmount,
                    pending_amount: a.pendingAmount,
                    status: a.status
                }));
                await supabase.from('provider_accounts').insert(accountsPayload);
            }

            await fetchProviders();
            return true;
        } catch (e: any) {
            alert("Error al guardar proveedor: " + e.message);
            return false;
        }
    };

    const handleDeleteProvider = async (id: string) => {
        try {
            // Delete child accounts first due to FK constraints
            await supabase.from('provider_accounts').delete().eq('provider_id', id);
            // Then delete provider
            const { error } = await supabase.from('providers').delete().eq('id', id);
            if (error) throw error;
            
            // Cleanup transfers related to this provider to allow deletion or keep history? 
            // Usually we might want to keep transfers or set provider_id to null, but here we cascade logical delete
            // For now assuming clean delete of history too if provider is purged
            await supabase.from('transfers').delete().eq('provider_id', id);

            await fetchProviders();
            await fetchTransfers();
        } catch (e: any) {
            alert("Error al eliminar proveedor: " + e.message);
        }
    };

    const handleResetProvider = async (id: string) => {
        try {
            // Eliminar transferencias asociadas para reiniciar el contador
            await supabase.from('transfers').delete().eq('provider_id', id);
            await fetchTransfers();
            alert("Ciclo reiniciado correctamente.");
        } catch (e: any) {
            alert("Error al reiniciar ciclo: " + e.message);
        }
    };

    // --- GESTIÓN DE TRANSFERENCIAS (DB) ---
    const handleUpdateTransfer = async (t: Transfer) => {
        try {
            const isNew = t.id.startsWith('t-');
            const payload = {
                client_name: t.clientName,
                amount: t.amount,
                date_text: t.date,
                provider_id: t.providerId,
                account_id: t.accountId,
                notes: t.notes,
                status: t.status,
                is_loaded_in_system: t.isLoadedInSystem
            };

            if (isNew) {
                await supabase.from('transfers').insert([payload]);
            } else {
                await supabase.from('transfers').update(payload).eq('id', t.id);
            }
            await fetchTransfers();
        } catch (e: any) {
            alert("Error al guardar transferencia: " + e.message);
        }
    };

    const handleDeleteTransfer = async (id: string) => {
        try {
            const { error } = await supabase.from('transfers').delete().eq('id', id);
            if (error) throw error;
            await fetchTransfers();
        } catch (e: any) {
            alert("Error al eliminar transferencia: " + e.message);
        }
    };

    const handleConfirmTransfer = async (id: string, status: 'Pendiente' | 'Realizado') => {
        try {
            await supabase.from('transfers').update({ status }).eq('id', id);
            await fetchTransfers();
        } catch (e: any) {
            alert("Error al actualizar estado: " + e.message);
        }
    };

    const handleUpdateTransferStatus = async (id: string, status: any) => {
        try {
            await supabase.from('transfers').update({ status }).eq('id', id);
            await fetchTransfers();
        } catch (e: any) {
            alert("Error al actualizar estado: " + e.message);
        }
    };

    const handleClearHistory = async () => {
        try {
            const { error } = await supabase.from('transfers').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
            if (error) throw error;
            await fetchTransfers();
        } catch (e: any) {
            alert("Error al limpiar historial: " + e.message);
        }
    };

    const handleSaveTrip = async (trip: Trip) => {
        try {
            const tripPayload = {
                display_id: trip.displayId,
                name: trip.name,
                status: trip.status,
                driver_name: trip.driverName,
                date_text: trip.date,
                route: trip.route
            };

            let tripId = trip.id;
            const isNew = !trip.id || trip.id.startsWith('trip-');

            if (isNew) {
                const { data, error } = await supabase.from('trips').insert([tripPayload]).select().single();
                if (error) throw error;
                tripId = data.id;
            } else {
                const { error = null } = await supabase.from('trips').update(tripPayload).eq('id', tripId);
                if (error) throw error;
            }

            await supabase.from('trip_clients').delete().eq('trip_id', tripId);
            if (trip.clients.length > 0) {
                const clientsPayload = trip.clients.map(c => ({
                    trip_id: tripId,
                    name: c.name,
                    address: c.address,
                    previous_balance: c.previousBalance,
                    current_invoice_amount: c.currentInvoiceAmount,
                    payment_cash: c.paymentCash,
                    payment_transfer: c.paymentTransfer,
                    is_transfer_expected: c.isTransferExpected,
                    status: c.status
                }));
                const { error: cErr } = await supabase.from('trip_clients').insert(clientsPayload);
                if (cErr) throw cErr;
            }

            await supabase.from('trip_expenses').delete().eq('trip_id', tripId);
            if (trip.expenses.length > 0) {
                const expensesPayload = trip.expenses.map(e => ({
                    trip_id: tripId,
                    type: e.type,
                    amount: e.amount,
                    note: e.note,
                    timestamp: new Date().toISOString()
                }));
                const { error: eErr } = await supabase.from('trip_expenses').insert(expensesPayload);
                if (eErr) throw eErr;
            }

            await fetchTrips();

        } catch (e: any) {
            console.error("Error guardando viaje:", e);
            alert("Error al guardar viaje: " + e.message);
        }
    };

    const handleDeleteTrip = async (id: string) => {
        if (id && !id.startsWith('trip-')) {
            try {
                await supabase.from('trip_expenses').delete().eq('trip_id', id);
                await supabase.from('trip_clients').delete().eq('trip_id', id);
                const { error } = await supabase.from('trips').delete().eq('id', id);
                if (error) throw error;
            } catch (e: any) {
                alert("Error al eliminar viaje: " + e.message);
                return;
            }
        }
        setTrips(prev => prev.filter(t => t.id !== id));
    };

    // 1. CARGAR ACTIVOS
    const fetchActiveOrders = async () => {
        const { data, error } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .not('status', 'in', '("entregado","pagado")')
            .order('created_at', { ascending: false });
        
        if (data) {
            setActiveOrders(mapOrders(data));
        }
    };

    // 2. CARGAR HISTORIAL (Paginado)
    const fetchHistoryOrders = async (month: number, year: number, search: string = '', page: number = 0) => {
        setIsLoadingHistory(true);
        const from = page * HISTORY_PAGE_SIZE;
        const to = from + HISTORY_PAGE_SIZE - 1;

        let query = supabase
            .from('orders')
            .select('*, order_items(*)')
            .in('status', ['entregado', 'pagado'])
            .order('created_at', { ascending: false });

        if (search && search.trim().length > 0) {
            query = query.or(`client_name.ilike.%${search}%,display_id.ilike.%${search}%`);
        } else {
            const startDate = new Date(year, month, 1).toISOString();
            const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
            query = query.gte('created_at', startDate).lte('created_at', endDate);
        }

        query = query.range(from, to);

        const { data } = await query;
        
        if (data) {
            const mappedData = mapOrders(data);
            if (page === 0) {
                setHistoryOrders(mappedData);
            } else {
                setHistoryOrders(prev => [...prev, ...mappedData]);
            }
            setHasMoreHistory(data.length === HISTORY_PAGE_SIZE);
            setHistoryFilter(prev => ({ ...prev, month, year, search }));
            setHistoryPage(page);
        }
        setIsLoadingHistory(false);
    };

    const loadMoreHistory = async () => {
        if (!hasMoreHistory || isLoadingHistory) return;
        await fetchHistoryOrders(
            historyFilter.month, 
            historyFilter.year, 
            historyFilter.search, 
            historyPage + 1
        );
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
            history: o.history || [],
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

    // 3. REALTIME INTELIGENTE
    const setupRealtimeSubscription = (userProfile: User) => {
        const ordersChannel = supabase
            .channel('orders_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async (payload) => {
                const newOrder = payload.new as any;
                const oldOrder = payload.old as any;
                const eventType = payload.eventType;

                if (eventType === 'INSERT') {
                    const fullOrderData = await fetchSingleOrder(newOrder.id);
                    if (fullOrderData && isActiveStatus(newOrder.status)) {
                        setActiveOrders(prev => [fullOrderData, ...prev]);
                    }
                } else if (eventType === 'UPDATE') {
                    const isActiveInMemory = activeOrders.some(o => o.id === newOrder.id);
                    const isHistoryInMemory = historyOrders.some(o => o.id === newOrder.id);

                    if (isActiveInMemory || isHistoryInMemory) {
                        const fullOrderData = await fetchSingleOrder(newOrder.id);
                        if (!fullOrderData) return;

                        if (isActiveStatus(newOrder.status)) {
                            setActiveOrders(prev => {
                                const exists = prev.find(o => o.id === newOrder.id);
                                if (exists) return prev.map(o => o.id === newOrder.id ? fullOrderData : o);
                                return [fullOrderData, ...prev].sort((a,b) => b.displayId.localeCompare(a.displayId));
                            });
                            setHistoryOrders(prev => prev.filter(o => o.id !== newOrder.id));
                        } else {
                            setActiveOrders(prev => prev.filter(o => o.id !== newOrder.id));
                            if (isInCurrentHistoryView(newOrder.created_at)) {
                                setHistoryOrders(prev => {
                                    const exists = prev.find(o => o.id === newOrder.id);
                                    if (exists) return prev.map(o => o.id === newOrder.id ? fullOrderData : o);
                                    return [fullOrderData, ...prev].sort((a,b) => b.displayId.localeCompare(a.displayId));
                                });
                            }
                        }
                    }
                } else if (eventType === 'DELETE') {
                    setActiveOrders(prev => prev.filter(o => o.id !== oldOrder.id));
                    setHistoryOrders(prev => prev.filter(o => o.id !== oldOrder.id));
                }
            })
            .subscribe();

        const tripsChannel = supabase
            .channel('trips_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
                fetchTrips();
            })
            .subscribe();

        // Realtime para Pagos y Proveedores
        const paymentsChannel = supabase
            .channel('payments_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transfers' }, () => {
                fetchTransfers();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'providers' }, () => {
                fetchProviders();
            })
            .subscribe();

        const notifChannel = supabase
            .channel('notifications_realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userProfile.id}` }, (payload) => {
                const newNotif = payload.new as AppNotification;
                setNotifications(prev => [newNotif, ...prev]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(ordersChannel);
            supabase.removeChannel(tripsChannel);
            supabase.removeChannel(paymentsChannel);
            supabase.removeChannel(notifChannel);
        };
    };

    const fetchSingleOrder = async (id: string) => {
        const { data } = await supabase.from('orders').select('*, order_items(*)').eq('id', id).single();
        if (data) return mapOrders([data])[0];
        return null;
    };

    const isActiveStatus = (status: string) => {
        return !['entregado', 'pagado'].includes(status);
    };

    const isInCurrentHistoryView = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.getMonth() === historyFilter.month && d.getFullYear() === historyFilter.year;
    };

    const fetchExpirations = async () => {
        try {
            const [manualRes, systemRes] = await Promise.all([
                supabase.from('product_expirations').select('*'),
                supabase.from('stock_inbound_items')
                    .select('*, master_products(desart)')
                    .not('expiry_date', 'is', null)
            ]);

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            let allItems: ProductExpiration[] = [];

            if (manualRes.data) {
                const manual = manualRes.data.map((item: any) => {
                    const expiryDate = new Date(item.expiry_date + 'T12:00:00');
                    const diffTime = expiryDate.getTime() - today.getTime();
                    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    let status: ExpirationStatus = 'NORMAL';
                    if (daysRemaining < 30) status = 'CRÍTICO';
                    else if (daysRemaining < 90) status = 'PRÓXIMO';
                    else if (daysRemaining < 180) status = 'MODERADO';

                    return {
                        id: item.id,
                        productName: item.product_name,
                        quantity: String(item.total_quantity),
                        expiryDate,
                        daysRemaining,
                        status
                    };
                });
                allItems = [...allItems, ...manual];
            }

            if (systemRes.data) {
                const system = systemRes.data.map((item: any) => {
                    const expiryDate = new Date(item.expiry_date + 'T12:00:00');
                    const diffTime = expiryDate.getTime() - today.getTime();
                    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    let status: ExpirationStatus = 'NORMAL';
                    if (daysRemaining < 30) status = 'CRÍTICO';
                    else if (daysRemaining < 90) status = 'PRÓXIMO';
                    else if (daysRemaining < 180) status = 'MODERADO';

                    return {
                        id: item.id,
                        productName: item.master_products?.desart || 'Desconocido',
                        quantity: String(item.quantity),
                        expiryDate,
                        daysRemaining,
                        status
                    };
                });
                allItems = [...allItems, ...system];
            }

            allItems.sort((a, b) => a.daysRemaining - b.daysRemaining);
            setExpirations(allItems);
        } catch (error) {
            console.error('Error fetching expirations:', error);
        }
    };

    const toggleTheme = (forceDark?: boolean) => {
        const nextMode = forceDark !== undefined ? forceDark : !isDarkMode;
        setIsDarkMode(nextMode);
        if (nextMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setSession(null);
        setCurrentUser(null);
        setHasInitialRedirect(false);
    };

    const handleDeleteOrder = async (orderId: string) => {
        const { error } = await supabase.from('orders').delete().eq('id', orderId);
        if (!error) {
            setActiveOrders(prev => prev.filter(o => o.id !== orderId));
            setHistoryOrders(prev => prev.filter(o => o.id !== orderId));
        } else alert("Error al eliminar pedido: " + error.message);
    };

    const handleDeleteOrders = async (orderIds: string[]) => {
        const { error } = await supabase.from('orders').delete().in('id', orderIds);
        if (!error) {
             setActiveOrders(prev => prev.filter(o => !orderIds.includes(o.id)));
             setHistoryOrders(prev => prev.filter(o => !orderIds.includes(o.id)));
        } else alert("Error al eliminar lote: " + error.message);
    };

    const handleAdvanceOrder = async (order: DetailedOrder, notes?: string) => {
        const nextOrder = advanceOrderStatus(order);
        
        if (isActiveStatus(nextOrder.status)) {
             setActiveOrders(prev => prev.map(o => o.id === order.id ? {
                 ...o, 
                 status: nextOrder.status,
                 products: o.products.map(p => ({ ...p, isChecked: false })) 
             } : o));
        } else {
             setActiveOrders(prev => prev.filter(o => o.id !== order.id));
             if (isInCurrentHistoryView(new Date().toISOString())) {
                 setHistoryOrders(prev => [{
                     ...order, 
                     status: nextOrder.status,
                     products: order.products.map(p => ({ ...p, isChecked: false })) 
                 }, ...prev]);
             }
        }

        const updates: any = { 
            status: nextOrder.status,
            history: [...(order.history || []), {
                timestamp: new Date().toISOString(),
                userId: currentUser?.id,
                userName: currentUser?.name,
                action: 'ADVANCE_STATUS',
                previousState: order.status,
                newState: nextOrder.status,
                details: notes || 'Cambio de estado'
            }],
            updated_by: currentUser?.id
        };

        if (order.status === OrderStatus.EN_ARMADO && !order.assemblerId) {
            updates.assembler_id = currentUser?.id;
            updates.assembler_name = currentUser?.name;
        } else if (order.status === OrderStatus.ARMADO && !order.controllerId) {
            updates.controller_id = currentUser?.id;
            updates.controller_name = currentUser?.name;
        }

        const { error = null } = await supabase.from('orders').update(updates).eq('id', order.id);
        
        if (!error) {
            await supabase.from('order_items').update({ is_checked: false }).eq('order_id', order.id);
        } else {
            fetchActiveOrders();
            alert("Error al avanzar estado: " + error.message);
        }
    };

    const handleClaimOrder = async (order: DetailedOrder) => {
        if (!currentUser) return;

        const updates: any = { updated_by: currentUser.id }; 
        
        if (order.status === OrderStatus.EN_ARMADO) {
            updates.assembler_id = currentUser.id;
            updates.assembler_name = currentUser.name;
        } else if (order.status === OrderStatus.ARMADO) {
            updates.controller_id = currentUser.id;
            updates.controller_name = currentUser.name;
        } else {
            setActiveOrder(order);
            return;
        }

        const { error = null } = await supabase.from('orders').update(updates).eq('id', order.id);
        
        if (error) {
            alert("Error al asignar el pedido: " + error.message);
            return;
        }
        
        await fetchActiveOrders();
        
        const updatedOrder = { 
            ...order, 
            assemblerId: updates.assembler_id || order.assemblerId,
            assemblerName: updates.assembler_name || order.assemblerName,
            controllerId: updates.controller_id || order.controllerId,
            controllerName: updates.controller_name || order.controllerName
        };
        setActiveOrder(updatedOrder);
    };

    const handleToggleLock = async (order: DetailedOrder) => {
        if (!currentUser) return;
        
        let updates: any = {};
        const isLockedByMe = (order.status === OrderStatus.EN_ARMADO && order.assemblerId === currentUser.id) ||
                             (order.status === OrderStatus.ARMADO && order.controllerId === currentUser.id);
        
        if (isLockedByMe) {
            if (order.status === OrderStatus.EN_ARMADO) {
                updates.assembler_id = null;
                updates.assembler_name = null;
            } else if (order.status === OrderStatus.ARMADO) {
                updates.controller_id = null;
                updates.controller_name = null;
            }
        } else {
            if (order.status === OrderStatus.EN_ARMADO) {
                updates.assembler_id = currentUser.id;
                updates.assembler_name = currentUser.name;
            } else if (order.status === OrderStatus.ARMADO) {
                updates.controller_id = currentUser.id;
                updates.controller_name = currentUser.name;
            }
        }

        if (Object.keys(updates).length > 0) {
            const { error = null } = await supabase.from('orders').update(updates).eq('id', order.id);
            if (error) {
                alert("Error al actualizar candado: " + error.message);
                return;
            }
            await fetchActiveOrders();
        }
    };

    const handleReleaseOrder = async (order: DetailedOrder) => {
        setActiveOrder(null);
    };

    const handleUpdateProductQuantity = (code: string, newQty: number) => {
        if (!activeOrder || !currentUser) return;

        const product = activeOrder.products.find(p => p.code === code);
        if (!product) return;

        const oldQty = product.quantity;
        if (oldQty === newQty) return;

        const diff = newQty - oldQty;
        const isReduction = diff < 0;
        const absDiff = Math.abs(diff);
        
        const isPostShipping = [OrderStatus.EN_TRANSITO, OrderStatus.ENTREGADO].includes(activeOrder.status);

        let actionDescription = '';
        let actionType = 'UPDATE_QTY';

        if (!isReduction) {
            actionDescription = `Agregó ${absDiff} un. de ${product.name}. (Total: ${newQty})`;
            actionType = 'ITEM_ADDED';
        } else {
            if (isPostShipping) {
                actionDescription = `Devolución/NC: ${absDiff} un. de ${product.name}. (Aceptado: ${newQty})`;
                actionType = 'ITEM_RETURNED';
            } else {
                actionDescription = `Faltante/Quita: ${absDiff} un. de ${product.name}. (Quedan: ${newQty})`;
                actionType = 'ITEM_REMOVED';
            }
        }

        const historyEntry = {
            timestamp: new Date().toISOString(),
            userId: currentUser.id,
            userName: currentUser.name,
            action: actionType,
            details: actionDescription,
            previousState: activeOrder.status,
            newState: activeOrder.status
        };

        let updatedOrder = applyQuantityChange(activeOrder, code, newQty);
        
        updatedOrder = {
            ...updatedOrder,
            history: [...(updatedOrder.history || []), historyEntry]
        };

        setActiveOrder(updatedOrder);
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
                 
                 if (!isPostShippingStatus) {
                     finalShippedQuantity = p.quantity;
                 } else {
                     finalShippedQuantity = p.shippedQuantity ?? p.quantity; 
                 }

                 const payload = {
                     order_id: updatedOrder.id,
                     code: p.code,
                     name: p.name,
                     quantity: p.quantity,
                     original_quantity: p.originalQuantity, // Usar directamente el valor original (permite 0 para nuevos items)
                     shipped_quantity: finalShippedQuantity,
                     unit_price: p.unitPrice,
                     subtotal: p.subtotal,
                     is_checked: shouldAdvance ? false : p.isChecked
                 };

                 if (existingCodes.has(p.code)) {
                     await supabase.from('order_items').update(payload).eq('order_id', updatedOrder.id).eq('code', p.code);
                 } else {
                     await supabase.from('order_items').insert(payload);
                 }
            }

            let nextStatus = updatedOrder.status;
            let history = updatedOrder.history || [];
            
            if (shouldAdvance) {
                 const advanced = advanceOrderStatus(updatedOrder);
                 nextStatus = advanced.status;
                 history = [...history, {
                    timestamp: new Date().toISOString(),
                    userId: currentUser?.id,
                    userName: currentUser?.name,
                    action: 'ADVANCE_STATUS',
                    previousState: updatedOrder.status,
                    newState: nextStatus,
                    details: notes || 'Avance desde modal'
                 }];
            }

            const orderUpdates: any = {
                status: nextStatus,
                payment_method: updatedOrder.paymentMethod,
                observations: updatedOrder.observations,
                total: updatedOrder.total,
                history: history,
                updated_by: currentUser?.id 
            };

            if (shouldAdvance) {
                if (updatedOrder.status === OrderStatus.EN_ARMADO && !updatedOrder.assemblerId) {
                    orderUpdates.assembler_id = currentUser?.id;
                    orderUpdates.assembler_name = currentUser?.name;
                } else if (updatedOrder.status === OrderStatus.ARMADO && !updatedOrder.controllerId) {
                    orderUpdates.controller_id = currentUser?.id;
                    orderUpdates.controller_name = currentUser?.name;
                }
            }

            await supabase.from('orders').update(orderUpdates).eq('id', updatedOrder.id);

            setActiveOrder(null); 
            fetchActiveOrders(); 
            if (!isActiveStatus(nextStatus)) {
                fetchHistoryOrders(historyFilter.month, historyFilter.year, historyFilter.search, 0);
            }
        } catch (err: any) {
            console.error("Error guardando pedido:", err);
            alert("Error al guardar cambios: " + err.message);
        }
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
                            onRefresh={async () => {
                                await fetchActiveOrders();
                                await fetchHistoryOrders(historyFilter.month, historyFilter.year, historyFilter.search, 0);
                            }}
                        />
                    )}
                    {currentView === View.CREATE_BUDGET && (
                        <CreateBudget 
                            onNavigate={setCurrentView} 
                            currentUser={currentUser}
                            onCreateOrder={async (order) => {
                                try {
                                    const { data, error } = await supabase.from('orders').insert({
                                        display_id: order.displayId,
                                        client_name: order.clientName,
                                        total: order.total,
                                        status: order.status,
                                        zone: order.zone,
                                        observations: order.observations,
                                        history: order.history,
                                        created_by: currentUser.id 
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
                            await supabase.from('profiles').update({ 
                                name: n, 
                                avatar_url: a, 
                                preferred_branch: b,
                                theme_preference: t
                            }).eq('id', currentUser.id); 
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
                </main>

                {activeOrder && (
                    <OrderAssemblyModal 
                        order={activeOrder} 
                        currentUser={currentUser} 
                        onClose={() => handleReleaseOrder(activeOrder)}
                        onSave={handleSaveAssembly}
                        onUpdateProduct={handleUpdateProductQuantity}
                        onToggleCheck={(code) => setActiveOrder(toggleProductCheck(activeOrder, code))}
                        onUpdateObservations={(text) => setActiveOrder(updateObservations(activeOrder, text))}
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
                            setActiveOrder(updatedOrder);
                        }}
                        onUpdatePrice={(code, price) => setActiveOrder(updateProductPrice(activeOrder, code, price))}
                        onRemoveProduct={(code) => setActiveOrder(removeProductFromOrder(activeOrder, code))}
                        onDeleteOrder={handleDeleteOrder}
                    />
                )}
            </div>
        </div>
    );
}
