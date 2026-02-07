
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
import { SqlEditor } from './views/SqlEditor';
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
            if (session?.user) fetchProfile(session.user.id);
            else setCurrentUser(null);
        });

        return () => subscription.unsubscribe();
    }, []);

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
                fetchHistoryOrders(new Date().getMonth(), new Date().getFullYear()),
                fetchNotifications(userId)
            ]);
            
            fetchExpirations();
            setupRealtimeSubscription(userWithRole); 
        }
    };

    // --- NOTIFICACIONES: Fetch desde DB ---
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

    // --- NOTIFICACIONES: Acciones ---
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
                setActiveOrder(order);
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

    // 2. CARGAR HISTORIAL
    const fetchHistoryOrders = async (month: number, year: number, search?: string) => {
        let query = supabase
            .from('orders')
            .select('*, order_items(*)')
            .in('status', ['entregado', 'pagado'])
            .order('created_at', { ascending: false });

        if (search && search.trim().length > 0) {
            query = query.or(`client_name.ilike.%${search}%,display_id.ilike.%${search}%`);
            query = query.limit(50); 
        } else {
            const startDate = new Date(year, month, 1).toISOString();
            const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
            query = query.gte('created_at', startDate).lte('created_at', endDate);
        }

        const { data } = await query;
        if (data) {
            setHistoryOrders(mapOrders(data));
            setHistoryFilter(prev => ({ ...prev, month, year, search: search || '' }));
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
                    if (fullOrderData) {
                        if (isActiveStatus(newOrder.status)) {
                            setActiveOrders(prev => [fullOrderData, ...prev]);
                        } else if (isInCurrentHistoryView(newOrder.created_at)) {
                            setHistoryOrders(prev => [fullOrderData, ...prev]);
                        }
                    }
                } else if (eventType === 'UPDATE') {
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
                } else if (eventType === 'DELETE') {
                    setActiveOrders(prev => prev.filter(o => o.id !== oldOrder.id));
                    setHistoryOrders(prev => prev.filter(o => o.id !== oldOrder.id));
                }
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
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
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

    // --- ADVANCE ORDER LOGIC WITH NOTES ---
    const handleAdvanceOrder = async (order: DetailedOrder, notes?: string) => {
        const nextOrder = advanceOrderStatus(order);
        
        // Optimistic UI update
        if (isActiveStatus(nextOrder.status)) {
             setActiveOrders(prev => prev.map(o => o.id === order.id ? {...o, status: nextOrder.status} : o));
        } else {
             setActiveOrders(prev => prev.filter(o => o.id !== order.id));
             if (isInCurrentHistoryView(new Date().toISOString())) {
                 setHistoryOrders(prev => [{...order, status: nextOrder.status}, ...prev]);
             }
        }

        // Prepare DB Update
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

        // Logic to assign assembler/controller if null when advancing
        if (order.status === OrderStatus.EN_ARMADO && !order.assemblerId) {
            updates.assembler_id = currentUser?.id;
            updates.assembler_name = currentUser?.name;
        } else if (order.status === OrderStatus.ARMADO && !order.controllerId) {
            updates.controller_id = currentUser?.id;
            updates.controller_name = currentUser?.name;
        } else if (order.status === OrderStatus.FACTURADO && !order.invoicerName && currentUser?.role === 'vale') {
            // Optional: Track who invoiced if we had a column for it
        }

        // If advancing to EN_TRANSITO, we should also lock in shipped quantities if not already set (fallback)
        // Note: Ideally handleSaveAssembly handles this, but direct status advances via list also trigger this.
        if (nextOrder.status === OrderStatus.EN_TRANSITO) {
             // We can't easily update all items here without iterating.
             // Usually advance happens via modal save, but for list actions:
             // It is assumed the order is ready.
             // If we wanted to be strict, we would execute an RPC or multiple updates here.
             // For now, assume quantity matches if advancing directly without edit.
        }

        const { error } = await supabase.from('orders').update(updates).eq('id', order.id);
        
        if (error) {
            // Revert on error
            fetchActiveOrders();
            alert("Error al avanzar estado: " + error.message);
        }
    };

    const handleClaimOrder = async (order: DetailedOrder) => {
        if (!currentUser) return;

        const updates: any = { updated_by: currentUser.id }; // ACTOR TRACKING
        
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

        const { error } = await supabase.from('orders').update(updates).eq('id', order.id);
        
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
            // Desbloquear (Solo si yo tengo el lock)
            if (order.status === OrderStatus.EN_ARMADO) {
                updates.assembler_id = null;
                updates.assembler_name = null;
            } else if (order.status === OrderStatus.ARMADO) {
                updates.controller_id = null;
                updates.controller_name = null;
            }
        } else {
            // Bloquear (Tomar)
            if (order.status === OrderStatus.EN_ARMADO) {
                updates.assembler_id = currentUser.id;
                updates.assembler_name = currentUser.name;
            } else if (order.status === OrderStatus.ARMADO) {
                updates.controller_id = currentUser.id;
                updates.controller_name = currentUser.name;
            }
        }

        // Si hay cambios, ejecutar update
        if (Object.keys(updates).length > 0) {
            const { error } = await supabase.from('orders').update(updates).eq('id', order.id);
            if (error) {
                alert("Error al actualizar candado: " + error.message);
                return;
            }
            await fetchActiveOrders(); // Refrescar lista para reflejar cambio de ícono
        }
    };

    const handleReleaseOrder = async (order: DetailedOrder) => {
        // En lugar de liberar automáticamente al cerrar el modal,
        // ahora solo limpiamos el estado 'activeOrder' local.
        // El bloqueo persiste hasta que el usuario toque el candado explícitamente o finalice la etapa.
        setActiveOrder(null);
    };

    const handleSaveAssembly = async (updatedOrder: any, shouldAdvance: boolean, notes?: string) => {
        try {
            const { data: existingDbItems } = await supabase
                .from('order_items')
                .select('code')
                .eq('order_id', updatedOrder.id);
            
            const existingCodes = new Set(existingDbItems?.map((i: any) => i.code));

            // CRITICAL LOGIC FOR SHIPPING QUANTITY FREEZING
            const isPostShippingStatus = [OrderStatus.EN_TRANSITO, OrderStatus.ENTREGADO, OrderStatus.PAGADO].includes(updatedOrder.status);

            for (const p of updatedOrder.products) {
                 // If the order has already been shipped (Status is Transit or later),
                 // we DO NOT update the shipped_quantity (it is frozen).
                 // If it hasn't been shipped (Assembly, Control, Billing), we sync shipped_quantity with current quantity
                 // so that if we transition to shipping now, the snapshot is correct.
                 let finalShippedQuantity = p.shippedQuantity;
                 
                 if (!isPostShippingStatus) {
                     // Still in warehouse: What we verify now IS what we are preparing to ship.
                     finalShippedQuantity = p.quantity;
                 } else {
                     // Already shipped: Keep the recorded shipped quantity.
                     // Fallback to p.quantity only if data is missing, but verify logic.
                     finalShippedQuantity = p.shippedQuantity ?? p.quantity; 
                 }

                 const payload = {
                     order_id: updatedOrder.id,
                     code: p.code,
                     name: p.name,
                     quantity: p.quantity,
                     original_quantity: p.originalQuantity || p.quantity,
                     shipped_quantity: finalShippedQuantity,
                     unit_price: p.unitPrice,
                     subtotal: p.subtotal,
                     is_checked: p.isChecked
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

            // Logic to assign if completing the step (Assign current user as the "completer" if not already)
            // But if advancing, we effectively "release" the lock for the NEXT stage (unless we auto-claim next stage, which we don't usually)
            // The record of who did THIS stage is kept in assembler_id/controller_id if we don't clear it.
            // Requirement: "al finalizar el armado se desbloquea solo".
            // If we move EN_ARMADO -> ARMADO, the 'assembler_id' remains set (record of who assembled).
            // But the lock logic for 'ARMADO' checks 'controller_id'. So it IS implicitly unlocked for the controller.
            
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
                fetchHistoryOrders(historyFilter.month, historyFilter.year, historyFilter.search);
            }
        } catch (err: any) {
            console.error("Error guardando pedido:", err);
            alert("Error al guardar cambios: " + err.message);
        }
    };

    const handleSaveTrip = (trip: Trip) => {
        if (trip.id && trips.find(t => t.id === trip.id)) {
            setTrips(trips.map(t => t.id === trip.id ? trip : t));
        } else {
            setTrips([...trips, { ...trip, id: trip.id || `trip-${Date.now()}` }]);
        }
    };
    const handleDeleteTrip = (id: string) => {
        setTrips(trips.filter(t => t.id !== id));
    };
    const handleUpdateProvider = (p: Provider) => {
        if (providers.find(pr => pr.id === p.id)) {
            setProviders(providers.map(pr => pr.id === p.id ? p : pr));
        } else {
            setProviders([...providers, p]);
        }
    };
    const handleDeleteProvider = (id: string) => setProviders(providers.filter(p => p.id !== id));
    const handleUpdateTransfer = (t: Transfer) => {
        if (transfers.find(tr => tr.id === t.id)) {
            setTransfers(transfers.map(tr => tr.id === t.id ? t : tr));
        } else {
            setTransfers([...transfers, t]);
        }
    };
    const handleDeleteTransfer = (id: string) => setTransfers(transfers.filter(t => t.id !== id));
    const handleConfirmTransfer = (id: string, status: 'Pendiente' | 'Realizado') => {
        setTransfers(transfers.map(t => t.id === id ? { ...t, status } : t));
    };
    const handleClearHistory = () => setTransfers(transfers.filter(t => t.status !== 'Archivado'));
    const handleUpdateTransferStatus = (id: string, status: any) => {
        setTransfers(transfers.map(t => t.id === id ? { ...t, status } : t));
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
                            onFetchHistory={fetchHistoryOrders}
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
                                await fetchHistoryOrders(historyFilter.month, historyFilter.year, historyFilter.search);
                            }}
                        />
                    )}
                    {/* ... Resto de vistas ... */}
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
                    {currentView === View.PAYMENTS_PROVIDERS && <PaymentsProviders providers={providers} onUpdateProviders={handleUpdateProvider} onDeleteProvider={handleDeleteProvider} />}
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
                    />}
                    {currentView === View.SQL_EDITOR && <SqlEditor currentUser={currentUser} />}
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
                        onUpdateProduct={(code, qty) => setActiveOrder(applyQuantityChange(activeOrder, code, qty))}
                        onToggleCheck={(code) => setActiveOrder(toggleProductCheck(activeOrder, code))}
                        onUpdateObservations={(text) => setActiveOrder(updateObservations(activeOrder, text))}
                        onAddProduct={(prod) => setActiveOrder(addProductToOrder(activeOrder, prod))}
                        onUpdatePrice={(code, price) => setActiveOrder(updateProductPrice(activeOrder, code, price))}
                        onRemoveProduct={(code) => setActiveOrder(removeProductFromOrder(activeOrder, code))}
                        onDeleteOrder={handleDeleteOrder}
                    />
                )}
            </div>
        </div>
    );
}
