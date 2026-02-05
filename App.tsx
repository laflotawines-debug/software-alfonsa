
import React, { useState, useEffect } from 'react';
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
import { ClientsMaster } from './views/ClientsMaster';
import { ClientCollections } from './views/ClientCollections';
import { AccountStatements } from './views/AccountStatements'; // Added Import
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
import { Expirations } from './views/Expirations'; // Added Import
import { OrderAssemblyModal } from './components/OrderAssemblyModal';
import { View, User, DetailedOrder, Trip, ProductExpiration, Provider, Transfer, OrderStatus, Product } from './types';
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
    
    // Inicializar tema basado en lo que ya configuró el script de index.html
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return document.documentElement.classList.contains('dark');
        }
        return false;
    });
    
    // Data states
    const [orders, setOrders] = useState<DetailedOrder[]>([]);
    const [trips, setTrips] = useState<Trip[]>([]);
    const [providers, setProviders] = useState<Provider[]>([]); 
    const [transfers, setTransfers] = useState<Transfer[]>([]); 
    const [expirations, setExpirations] = useState<ProductExpiration[]>([]);
    
    // Modal states
    const [activeOrder, setActiveOrder] = useState<DetailedOrder | null>(null);
    const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

    // Auth & Init
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
            
            // Si el perfil tiene preferencia de tema guardada, usarla
            if (data.theme_preference) {
                const dbThemeIsDark = data.theme_preference === 'dark';
                if (dbThemeIsDark !== isDarkMode) {
                    toggleTheme(dbThemeIsDark);
                }
            }
            
            setCurrentUser({ ...data, permissions });
            fetchOrders();
        }
    };

    const fetchOrders = async () => {
        const { data, error } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .order('created_at', { ascending: false });
        
        if (data) {
            const mappedOrders: DetailedOrder[] = data.map((o: any) => ({
                id: o.id,
                displayId: o.display_id,
                clientName: o.client_name,
                zone: o.zone,
                status: o.status,
                createdDate: new Date(o.created_at).toLocaleDateString('es-AR'),
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
            setOrders(mappedOrders);
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

    const handleDeleteOrder = async (orderId: string) => {
        const { error } = await supabase.from('orders').delete().eq('id', orderId);
        if (!error) fetchOrders();
        else alert("Error al eliminar pedido: " + error.message);
    };

    const handleDeleteOrders = async (orderIds: string[]) => {
        const { error } = await supabase.from('orders').delete().in('id', orderIds);
        if (!error) fetchOrders();
        else alert("Error al eliminar lote: " + error.message);
    };

    const handleAdvanceOrder = async (order: DetailedOrder) => {
        const nextOrder = advanceOrderStatus(order);
        const { error } = await supabase.from('orders').update({ 
            status: nextOrder.status,
            history: [...(order.history || []), {
                timestamp: new Date().toISOString(),
                userId: currentUser?.id,
                userName: currentUser?.name,
                action: 'ADVANCE_STATUS',
                previousState: order.status,
                newState: nextOrder.status
            }]
        }).eq('id', order.id);
        
        if (!error) fetchOrders();
    };

    const handleSaveAssembly = async (updatedOrder: any, shouldAdvance: boolean) => {
        try {
            // 1. Obtener lista actual de items en la base para saber cuáles existen
            const { data: existingDbItems } = await supabase
                .from('order_items')
                .select('code')
                .eq('order_id', updatedOrder.id);
            
            const existingCodes = new Set(existingDbItems?.map((i: any) => i.code));

            // 2. Iterar sobre el estado actual del pedido (incluye los nuevos agregados manualmente)
            for (const p of updatedOrder.products) {
                 const payload = {
                     order_id: updatedOrder.id,
                     code: p.code,
                     name: p.name,
                     quantity: p.quantity,
                     original_quantity: p.originalQuantity || p.quantity, // Asegurar original para nuevos
                     shipped_quantity: p.shippedQuantity || p.quantity,
                     unit_price: p.unitPrice,
                     subtotal: p.subtotal,
                     is_checked: p.isChecked
                 };

                 if (existingCodes.has(p.code)) {
                     // Si ya existe en DB, actualizamos
                     await supabase.from('order_items')
                        .update(payload)
                        .eq('order_id', updatedOrder.id)
                        .eq('code', p.code);
                 } else {
                     // Si NO existe en DB, insertamos (Producto Manual Nuevo)
                     await supabase.from('order_items').insert(payload);
                 }
            }

            let nextStatus = updatedOrder.status;
            if (shouldAdvance) {
                 const advanced = advanceOrderStatus(updatedOrder);
                 nextStatus = advanced.status;
            }

            // Update Order fields
            await supabase.from('orders').update({
                status: nextStatus,
                payment_method: updatedOrder.paymentMethod,
                observations: updatedOrder.observations,
                total: updatedOrder.total,
                history: updatedOrder.history
            }).eq('id', updatedOrder.id);

            setActiveOrder(null);
            fetchOrders();
        } catch (err: any) {
            console.error("Error guardando pedido:", err);
            alert("Error al guardar cambios: " + err.message);
        }
    };

    // --- Mocks para funciones aún no conectadas completamente a DB ---
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
                    onLogout={() => supabase.auth.signOut()}
                />

                <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
                    {currentView === View.DASHBOARD && <Dashboard orders={orders} expirations={expirations} onNavigate={setCurrentView} />}
                    {currentView === View.ORDERS && (
                        <OrderList 
                            onNavigate={setCurrentView} 
                            orders={orders} 
                            currentUser={currentUser}
                            onOpenAssembly={setActiveOrder}
                            onDeleteOrder={handleDeleteOrder}
                            onDeleteOrders={handleDeleteOrders}
                            onAdvanceOrder={handleAdvanceOrder}
                            onRefresh={fetchOrders}
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
                                        // created_by: currentUser.id, // ELIMINADO: No existe en tabla orders
                                        zone: order.zone,
                                        history: order.history
                                    }).select().single();
                                    
                                    if (error) throw error;

                                    if (data) {
                                        const items = order.products.map(p => ({
                                            order_id: data.id,
                                            code: p.code,
                                            name: p.name,
                                            quantity: p.quantity,
                                            original_quantity: p.originalQuantity,
                                            unit_price: p.unitPrice,
                                            subtotal: p.subtotal,
                                            is_checked: false
                                        }));
                                        
                                        const { error: itemsError } = await supabase.from('order_items').insert(items);
                                        if (itemsError) throw itemsError;

                                        await fetchOrders();
                                        setCurrentView(View.ORDERS);
                                    }
                                } catch (e: any) {
                                    console.error("Error creating order:", e);
                                    alert("Error al crear el pedido: " + (e.message || "Error desconocido"));
                                    throw e;
                                }
                            }}
                        />
                    )}
                    {currentView === View.ORDER_SHEET && (
                        <OrderSheet 
                            currentUser={currentUser} 
                            orders={orders} 
                            trips={trips} 
                            onSaveTrip={handleSaveTrip} 
                            onDeleteTrip={handleDeleteTrip} 
                            selectedTripId={selectedTripId} 
                            onSelectTrip={setSelectedTripId} 
                        />
                    )}
                    {currentView === View.PAYMENTS_OVERVIEW && (
                        <PaymentsOverview 
                            providers={providers} 
                            onDeleteProvider={handleDeleteProvider} 
                            onUpdateProviders={handleUpdateProvider} 
                            transfers={transfers} 
                            onUpdateTransfers={handleUpdateTransfer} 
                            onConfirmTransfer={handleConfirmTransfer} 
                            onDeleteTransfer={handleDeleteTransfer} 
                        />
                    )}
                    {currentView === View.PAYMENTS_PROVIDERS && (
                        <PaymentsProviders 
                            providers={providers} 
                            onUpdateProviders={handleUpdateProvider} 
                            onDeleteProvider={handleDeleteProvider} 
                        />
                    )}
                    {currentView === View.PAYMENTS_HISTORY && (
                        <PaymentsHistory 
                            transfers={transfers} 
                            onDeleteTransfer={handleDeleteTransfer} 
                            onClearHistory={handleClearHistory} 
                            onUpdateTransfers={handleUpdateTransfer} 
                            onUpdateStatus={handleUpdateTransferStatus} 
                            providers={providers} 
                        />
                    )}
                    {currentView === View.CLIENTS_MASTER && <ClientsMaster currentUser={currentUser} />}
                    {currentView === View.CLIENT_COLLECTIONS && <ClientCollections currentUser={currentUser} />}
                    {currentView === View.CLIENT_STATEMENTS && <AccountStatements currentUser={currentUser} />}
                    {currentView === View.CATALOG && <Catalog currentUser={currentUser} />}
                    {currentView === View.SUPPLIERS_MASTER && <SuppliersMaster currentUser={currentUser} />}
                    {currentView === View.PRESUPUESTADOR && <Presupuestador />}
                    {currentView === View.ETIQUETADOR && <Etiquetador />}
                    {currentView === View.PRICE_MANAGEMENT && <PriceManagement currentUser={currentUser} />}
                    {currentView === View.SETTINGS && <Settings currentUser={currentUser} onUpdateProfile={async (n, a, b) => { await supabase.from('profiles').update({ name: n, avatar_url: a, preferred_branch: b }).eq('id', currentUser.id); await fetchProfile(currentUser.id); }} isDarkMode={isDarkMode} onToggleTheme={() => toggleTheme()} />}
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
                        onClose={() => setActiveOrder(null)}
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
