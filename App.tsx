
import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './views/Dashboard';
import { OrderList } from './views/OrderList';
import { OrderSheet } from './views/OrderSheet';
import { CreateBudget } from './views/CreateBudget';
import { SqlEditor } from './views/SqlEditor';
import { Settings } from './views/Settings';
import { PaymentsOverview } from './views/PaymentsOverview';
import { PaymentsHistory } from './views/PaymentsHistory';
import { PaymentsProviders } from './views/PaymentsProviders'; 
import { Expirations } from './views/Expirations';
import { Etiquetador } from './views/Etiquetador';
import { Presupuestador } from './views/Presupuestador';
import { ListaChina } from './views/ListaChina';
import { SuppliersMaster } from './views/SuppliersMaster';
import { ClientsMaster } from './views/ClientsMaster'; 
import { Login } from './views/Login';
import { Catalog } from './views/Catalog';
import { StockControl } from './views/StockControl';
// INVENTORY VIEWS
import { InventoryInbounds } from './views/InventoryInbounds';
import { InventoryAdjustments } from './views/InventoryAdjustments';
import { InventoryTransfers } from './views/InventoryTransfers';
import { InventoryHistory } from './views/InventoryHistory';
import { SupplierOrders } from './views/SupplierOrders';

import { OrderAssemblyModal } from './components/OrderAssemblyModal';
import { Loader2 } from 'lucide-react';
import { 
    View, 
    DetailedOrder, 
    User, 
    Trip, 
    Provider, 
    Transfer, 
    OrderStatus, 
    UserRole, 
    ProductExpiration, 
    ExpirationStatus, 
    PaymentStatus,
    Order,
    Product
} from './types';
import { supabase } from './supabase';
import { 
    applyQuantityChange, 
    toggleProductCheck, 
    updateObservations, 
    advanceOrderStatus,
    addProductToOrder,
    updateProductPrice,
    removeProductFromOrder
} from './logic';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Inicialización inteligente del tema desde localStorage o preferencia del sistema
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // PWA Installation State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const [orders, setOrders] = useState<DetailedOrder[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [expirations, setExpirations] = useState<ProductExpiration[]>([]);
  const [selectedOrderForAssembly, setSelectedOrderForAssembly] = useState<DetailedOrder | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  // Sincronizar el DOM y localStorage cada vez que cambie isDarkMode
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    // Escuchar el evento de instalación de PWA
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevenir que el navegador muestre su banner por defecto
      e.preventDefault();
      // Guardar el evento para dispararlo luego
      setDeferredPrompt(e);
    });

    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      console.log('Alfonsa PWA instalada exitosamente');
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) fetchProfile(session.user.id);
      else setIsAuthChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) fetchProfile(session.user.id);
      else { setCurrentUser(null); setIsAuthChecking(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    
    // Mostrar el prompt nativo
    deferredPrompt.prompt();
    
    // Esperar la respuesta del usuario
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`Usuario respondió a la instalación: ${outcome}`);
    
    // Limpiar el prompt ya usado
    setDeferredPrompt(null);
  };

  // Lógica de redirección inicial por permisos
  useEffect(() => {
      if (currentUser && currentUser.role !== 'vale' && currentView === View.DASHBOARD) {
          const perms = currentUser.permissions || [];
          if (!perms.includes('dashboard.view')) {
              if (perms.includes('orders.view')) setCurrentView(View.ORDERS);
              else if (perms.includes('orders.sheet')) setCurrentView(View.ORDER_SHEET);
              else if (perms.includes('inventory.inbounds')) setCurrentView(View.INV_INBOUNDS);
              else setCurrentView(View.SETTINGS);
          }
      }
  }, [currentUser, currentView]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (profile) {
        const { data: perms } = await supabase.from('user_permissions').select('permission_key').eq('user_id', userId);
        const permissionKeys = perms?.map(p => p.permission_key) || [];
        
        setCurrentUser({ 
            id: profile.id, 
            name: profile.name, 
            role: profile.role as UserRole,
            permissions: permissionKeys,
            avatar_url: profile.avatar_url
        });
      }
    } catch (err) { console.error(err); } finally { setIsAuthChecking(false); }
  };

  const fetchAllData = async () => {
    if (!currentUser) return;
    try {
        const { data: dbOrders } = await supabase.from('orders').select('*, order_items(*)');
        if (dbOrders) {
            const mappedOrders: DetailedOrder[] = dbOrders.map(o => ({
                id: o.id, displayId: o.display_id, clientName: o.client_name, zone: o.zone, 
                status: o.status as OrderStatus, createdDate: new Date(o.created_at).toLocaleDateString('es-AR'), 
                total: Number(o.total || 0), observations: o.observations, paymentMethod: o.payment_method, 
                assemblerId: o.assembler_id, assemblerName: o.assembler_name, controllerId: o.controller_id, 
                controllerName: o.controller_name, invoicerName: o.invoicer_name, history: o.history || [], 
                productCount: o.order_items?.length || 0,
                products: (o.order_items || []).map((item: any) => ({
                    code: item.code, name: item.name, originalQuantity: item.original_quantity, 
                    quantity: item.quantity, shipped_quantity: item.shipped_quantity, 
                    unitPrice: Number(item.unit_price || 0), subtotal: Number(item.subtotal || 0), isChecked: item.is_checked
                }))
            }));
            setOrders(mappedOrders.sort((a, b) => b.id.localeCompare(a.id)));
        }

        const { data: dbProviders } = await supabase.from('providers').select('*, provider_accounts(*)');
        if (dbProviders) {
            const mappedProviders: Provider[] = dbProviders.map(p => ({
                id: p.id, name: p.name, goalAmount: Number(p.goal_amount || 0), priority: p.priority, 
                status: p.status as any,
                accounts: (p.provider_accounts || []).map((a: any) => ({
                    id: a.id, providerId: a.provider_id, condition: a.condition, holder: a.holder,
                    identifier_alias: a.identifier_alias, 
                    identifier_cbu: a.identifier_cbu, 
                    meta_amount: a.meta_amount, 
                    current_amount: Number(a.current_amount || 0), 
                    pending_amount: Number(a.pending_amount || 0), 
                    status: a.status
                }))
            }));
            setProviders(mappedProviders);
        }

        const { data: dbTransfers } = await supabase.from('transfers').select('*');
        if (dbTransfers) {
            const mappedTransfers: Transfer[] = dbTransfers.map(t => ({
                id: t.id, clientName: t.client_name, amount: Number(t.amount || 0), date: t.date_text,
                providerId: t.provider_id, accountId: t.account_id, notes: t.notes, 
                status: t.status as any, isLoadedInSystem: t.is_loaded_in_system
            }));
            setTransfers(mappedTransfers.sort((a, b) => b.id.localeCompare(a.id)));
        }

        const { data: dbTrips } = await supabase.from('trips').select('*, trip_clients(*), trip_expenses(*)');
        if (dbTrips) {
            const mappedTrips: Trip[] = dbTrips.map(t => ({
                id: t.id, displayId: t.display_id, name: t.name, status: t.status as any,
                driverName: t.driver_name, date: t.date_text, route: t.route,
                clients: (t.trip_clients || []).map((c: any) => ({
                    id: c.id, name: c.name, address: c.address, previous_balance: Number(c.previous_balance || 0),
                    currentInvoiceAmount: Number(c.current_invoice_amount || 0), payment_cash: Number(c.payment_cash || 0),
                    payment_transfer: Number(c.payment_transfer || 0), is_transfer_expected: !!c.is_transfer_expected,
                    status: c.status as any
                })),
                expenses: (t.trip_expenses || []).map((e: any) => ({
                    id: e.id, type: e.type, amount: Number(e.amount || 0), note: e.note, timestamp: new Date(e.timestamp)
                }))
            }));
            setTrips(mappedTrips.sort((a, b) => b.id.localeCompare(a.id)));
        }

        const { data: dbExpirations } = await supabase.from('product_expirations').select('*');
        if (dbExpirations) {
            const mappedExpirations: ProductExpiration[] = dbExpirations.map(item => {
                const expiryDate = new Date(item.expiry_date + 'T12:00:00');
                const today = new Date();
                today.setHours(0,0,0,0);
                const diffTime = expiryDate.getTime() - today.getTime();
                const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                let status: ExpirationStatus = 'NORMAL';
                if (daysRemaining < 30) status = 'CRÍTICO';
                else if (daysRemaining < 90) status = 'PRÓXIMO';
                else if (daysRemaining < 180) status = 'MODERADO';
                return { id: item.id, productName: item.product_name, quantity: `${item.total_quantity} unidades`, expiryDate, daysRemaining, status };
            });
            setExpirations(mappedExpirations);
        }
    } catch (err) { console.error(err); } finally { setIsDataLoading(false); }
  };

  useEffect(() => { if (currentUser) fetchAllData(); }, [currentUser]);

  const handleDeleteTransfer = async (id: string) => {
    setIsDataLoading(true);
    await supabase.from('transfers').delete().eq('id', id);
    await fetchAllData();
  };

  const handleClearHistory = async () => {
    setIsDataLoading(true);
    await supabase.from('transfers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await fetchAllData();
  };

  const handleDeleteProvider = async (id: string) => {
    if (id.startsWith('p-')) return;
    setIsDataLoading(true);
    try {
        const { data, error } = await supabase.from('providers').delete().eq('id', id).select();
        if (error || !data || data.length === 0) {
            await supabase.from('providers').update({ status: 'Desactivado' }).eq('id', id);
        }
        await fetchAllData();
    } catch (err: any) { 
        alert("Error al eliminar: " + err.message);
    } finally {
        setIsDataLoading(false);
    }
  };

  const handleResetProvider = async (providerId: string) => {
    setIsDataLoading(true);
    try {
        const { error: updateError } = await supabase
            .from('transfers')
            .update({ status: 'Archivado' })
            .eq('provider_id', providerId)
            .in('status', ['Realizado', 'Pendiente']);

        if (updateError) throw updateError;
        await fetchAllData();
        alert("¡Nuevo ciclo iniciado!");
    } catch (err: any) { 
        alert("Error al reiniciar ciclo: " + err.message); 
    } finally { 
        setIsDataLoading(false); 
    }
  };

  const handleUpdateProvider = async (provider: Provider) => {
    setIsDataLoading(true);
    const isNew = provider.id.startsWith('p-');
    const payload = { name: provider.name, goal_amount: provider.goalAmount, priority: provider.priority, status: provider.status };
    let pId = provider.id;
    try {
        if (isNew) {
            const { data, error } = await supabase.from('providers').insert([payload]).select().single();
            if (error) throw error;
            pId = data.id;
        } else {
            const { error = null } = await supabase.from('providers').update(payload).eq('id', provider.id);
            if (error) throw error;
        }
        for (const acc of provider.accounts) {
            const isNewAcc = acc.id.startsWith('acc-');
            const accPayload = { 
                provider_id: pId, condition: acc.condition, holder: acc.holder, 
                identifier_alias: acc.identifierAlias, 
                identifier_cbu: acc.identifierCBU, 
                meta_amount: acc.metaAmount, 
                status: acc.status 
            };
            if (isNewAcc) await supabase.from('provider_accounts').insert([accPayload]);
            else await supabase.from('provider_accounts').update(accPayload).eq('id', acc.id);
        }
        await fetchAllData();
    } catch (e: any) { alert("Error: " + e.message); setIsDataLoading(false); }
  };

  const handleSaveTransfer = async (transfer: Transfer) => {
    setIsDataLoading(true);
    const isNew = transfer.id.toString().startsWith('t-');
    const payload = { 
        client_name: transfer.clientName, amount: Number(transfer.amount), date_text: transfer.date, 
        provider_id: transfer.providerId, account_id: transfer.accountId, notes: transfer.notes, 
        status: transfer.status, is_loaded_in_system: transfer.isLoadedInSystem 
    };
    if (isNew) await supabase.from('transfers').insert([payload]);
    else await supabase.from('transfers').update(payload).eq('id', transfer.id);
    await fetchAllData();
  };

  const handleUpdateTransferStatus = async (id: string, status: any) => {
    setIsDataLoading(true);
    await supabase.from('transfers').update({ status }).eq('id', id);
    await fetchAllData();
  };

  const handleSaveTrip = async (trip: Trip) => {
    setIsDataLoading(true);
    try {
        const isNew = trip.id.startsWith('trip-') && !trips.find(t => t.id === trip.id);
        const tripPayload = { display_id: trip.displayId, name: trip.name, status: trip.status, driver_name: trip.driverName, date_text: trip.date, route: trip.route };
        let tId = trip.id;
        if (isNew) {
            const { data, error = null } = await supabase.from('trips').insert([tripPayload]).select().single();
            if (error) throw error;
            tId = data.id;
        } else {
            await supabase.from('trips').update(tripPayload).eq('id', trip.id);
        }
        for (const client of trip.clients) {
            const isNewClient = client.id.startsWith('tc-');
            const clientPayload = { 
                trip_id: tId, name: client.name, address: client.address, previous_balance: client.previousBalance, 
                current_invoice_amount: client.currentInvoiceAmount, payment_cash: client.paymentCash, 
                payment_transfer: client.paymentTransfer, is_transfer_expected: client.isTransferExpected, status: client.status 
            };
            if (isNewClient) await supabase.from('trip_clients').insert([clientPayload]);
            else await supabase.from('trip_clients').update(clientPayload).eq('id', client.id);
        }
        for (const exp of trip.expenses) {
            const isNewExp = exp.id.startsWith('exp-') || exp.id.startsWith('e-');
            const expPayload = { trip_id: tId, type: exp.type, amount: exp.amount, note: exp.note, timestamp: exp.timestamp.toISOString() };
            if (isNewExp) await supabase.from('trip_expenses').insert([expPayload]);
            else await supabase.from('trip_expenses').update(expPayload).eq('id', exp.id);
        }
        await fetchAllData();
    } catch (err) { console.error(err); setIsDataLoading(false); }
  };

  const handleDeleteTrip = async (tripId: string) => {
    setIsDataLoading(true);
    await supabase.from('trips').delete().eq('id', tripId);
    await fetchAllData();
  };

  const handleCreateOrder = async (newOrder: DetailedOrder) => {
    setIsDataLoading(true);
    try {
        const { data: orderData, error: orderError } = await supabase.from('orders').insert([{
            display_id: newOrder.displayId, 
            client_name: newOrder.clientName,
            zone: newOrder.zone, 
            status: newOrder.status, 
            total: newOrder.total, 
            observations: newOrder.observations || '', 
            history: newOrder.history
        }]).select().single();
        if (orderError) throw orderError;
        const itemsToInsert = newOrder.products.map(p => ({ 
            order_id: orderData.id, code: p.code, name: p.name, original_quantity: p.originalQuantity, 
            quantity: p.quantity, unit_price: p.unitPrice, subtotal: p.subtotal, is_checked: p.isChecked 
        }));
        await supabase.from('order_items').insert(itemsToInsert);
        await fetchAllData();
        setCurrentView(View.ORDERS);
    } catch (err) { console.error(err); setIsDataLoading(false); }
  };

  const handleSaveAssembly = async (updatedOrder: Order, shouldAdvance: boolean) => {
    if (!currentUser) return;
    setIsDataLoading(true);
    let finalOrder = updatedOrder;
    if (shouldAdvance) finalOrder = advanceOrderStatus(updatedOrder, currentUser);
    try {
        // 1. Actualizar metadatos del pedido
        const { error: orderUpdateErr } = await supabase.from('orders').update({
            total: finalOrder.total, observations: finalOrder.observations, status: finalOrder.status, 
            payment_method: finalOrder.paymentMethod, assembler_id: finalOrder.assemblerId, 
            assembler_name: finalOrder.assemblerName, controller_id: finalOrder.controllerId, 
            controller_name: finalOrder.controllerName, history: finalOrder.history
        }).eq('id', finalOrder.id);
        
        if (orderUpdateErr) throw orderUpdateErr;

        // 2. Sincronizar items: Borrar y Re-insertar para manejar agregados manuales y eliminaciones
        const itemsToInsert = finalOrder.products.map(p => ({ 
            order_id: finalOrder.id, 
            code: p.code, 
            name: p.name, 
            original_quantity: p.originalQuantity, 
            quantity: p.quantity, 
            shipped_quantity: p.shippedQuantity,
            unit_price: p.unitPrice, 
            subtotal: p.subtotal, 
            is_checked: p.isChecked 
        }));

        // Eliminamos los items actuales
        const { error: deleteErr } = await supabase.from('order_items').delete().eq('order_id', finalOrder.id);
        if (deleteErr) throw deleteErr;

        // Insertamos la nueva lista completa (incluye agregados manuales)
        const { error: insertErr } = await supabase.from('order_items').insert(itemsToInsert);
        if (insertErr) throw insertErr;

        setSelectedOrderForAssembly(null);
        await fetchAllData();
    } catch (err) { 
        console.error("Error al guardar pedido:", err); 
        alert("Error al sincronizar con el servidor. Intente nuevamente.");
    } finally { 
        setIsDataLoading(false); 
    }
  };

  const handleAdvanceOrder = async (order: DetailedOrder) => {
    if (!currentUser) return;
    setIsDataLoading(true);
    const updated = advanceOrderStatus(order, currentUser);
    try {
        await supabase.from('orders').update({
            status: updated.status,
            history: updated.history,
            invoicer_name: updated.invoicerName,
            controller_id: updated.controllerId,
            controller_name: updated.controllerName
        }).eq('id', updated.id);
        if (updated.status === OrderStatus.EN_TRANSITO) {
            for (const p of updated.products) {
                await supabase.from('order_items').update({ 
                    shipped_quantity: p.quantity 
                }).eq('order_id', updated.id).eq('code', p.code);
            }
        }
        await fetchAllData();
    } catch (err) { console.error(err); } finally { setIsDataLoading(false); }
  };

  const handleUpdateProfile = async (newName: string, avatarUrl?: string) => {
      if (!currentUser) return;
      const payload: any = { name: newName };
      if (avatarUrl) payload.avatar_url = avatarUrl;

      await supabase.from('profiles').update(payload).eq('id', currentUser.id);
      await fetchProfile(currentUser.id);
  };

  if (isAuthChecking) return <div className="h-screen w-full flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" size={48} /></div>;
  if (!currentUser) return <Login isDarkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(!isDarkMode)} />;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-text">
      {isDataLoading && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm">
           <div className="bg-surface p-8 rounded-3xl border border-surfaceHighlight shadow-2xl flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-primary" size={48} />
              <p className="font-black text-xs uppercase tracking-[0.2em] text-muted">Sincronizando con Servidor</p>
           </div>
        </div>
      )}

      {/* Sidebar Desktop y Móvil */}
      <Sidebar 
        currentUser={currentUser} 
        currentView={currentView} 
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onNavigate={v => { setCurrentView(v); setMobileMenuOpen(false); }} 
      />

      <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-background">
        <Header 
            onMenuClick={() => setMobileMenuOpen(true)} 
            title={currentView === View.DASHBOARD ? "Tablero" : currentView === View.ORDERS ? "Gestión de Pedidos" : currentView === View.ORDER_SHEET ? "Planilla" : currentView} 
            subtitle="Gestión Alfonsa" 
            isDarkMode={isDarkMode} 
            onToggleTheme={() => setIsDarkMode(!isDarkMode)} 
            currentUser={currentUser} 
            onLogout={() => supabase.auth.signOut()} 
            showInstallBtn={!!deferredPrompt}
            onInstallApp={handleInstallApp}
        />
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="mx-auto max-w-7xl">
                {currentView === View.DASHBOARD && <Dashboard orders={orders} expirations={expirations} onNavigate={setCurrentView} />}
                {currentView === View.ORDERS && (
                    <OrderList 
                      onNavigate={setCurrentView} orders={orders} currentUser={currentUser} 
                      onOpenAssembly={o => setSelectedOrderForAssembly(o)} 
                      onDeleteOrder={id => supabase.from('orders').delete().eq('id', id).then(() => fetchAllData())} 
                      onAdvanceOrder={handleAdvanceOrder} 
                    />
                )}
                {currentView === View.ORDER_SHEET && (
                    <OrderSheet currentUser={currentUser} orders={orders} trips={trips} onSaveTrip={handleSaveTrip} onDeleteTrip={handleDeleteTrip} selectedTripId={selectedTripId} onSelectTrip={setSelectedTripId} />
                )}
                {currentView === View.CREATE_BUDGET && <CreateBudget onNavigate={setCurrentView} onCreateOrder={handleCreateOrder} currentUser={currentUser} />}
                {currentView === View.PAYMENTS_OVERVIEW && (
                    <PaymentsOverview 
                      providers={providers} onDeleteProvider={handleDeleteProvider} onUpdateProviders={handleUpdateProvider} 
                      transfers={transfers} onUpdateTransfers={handleSaveTransfer} onConfirmTransfer={handleUpdateTransferStatus} 
                    />
                )}
                {currentView === View.PAYMENTS_HISTORY && (
                    <PaymentsHistory 
                      transfers={transfers} onDeleteTransfer={handleDeleteTransfer} onClearHistory={handleClearHistory} 
                      onUpdateTransfers={handleSaveTransfer} onUpdateStatus={handleUpdateTransferStatus} providers={providers} 
                    />
                )}
                {currentView === View.PAYMENTS_PROVIDERS && (
                    <PaymentsProviders 
                      providers={providers} onUpdateProviders={handleUpdateProvider} onDeleteProvider={handleDeleteProvider} onResetProvider={handleResetProvider} 
                    />
                )}
                {currentView === View.INV_INBOUNDS && <InventoryInbounds currentUser={currentUser} />}
                {currentView === View.INV_SUPPLIER_ORDERS && <SupplierOrders currentUser={currentUser} />}
                {currentView === View.INV_ADJUSTMENTS && <InventoryAdjustments currentUser={currentUser} />}
                {currentView === View.INV_TRANSFERS && <InventoryTransfers currentUser={currentUser} />}
                {currentView === View.INV_HISTORY && <InventoryHistory currentUser={currentUser} />}
                
                {currentView === View.CATALOG && <Catalog currentUser={currentUser} />}
                {currentView === View.CLIENTS_MASTER && <ClientsMaster currentUser={currentUser} />}
                {currentView === View.SUPPLIERS_MASTER && <SuppliersMaster currentUser={currentUser} />}
                {currentView === View.EXPIRATIONS && <Expirations />}
                {currentView === View.ETIQUETADOR && <Etiquetador />}
                {currentView === View.PRESUPUESTADOR && <Presupuestador />}
                {currentView === View.LISTA_CHINA && <ListaChina />}
                {currentView === View.STOCK_CONTROL && <StockControl currentUser={currentUser} />}
                {currentView === View.SQL_EDITOR && <SqlEditor currentUser={currentUser} />}
                {currentView === View.SETTINGS && <Settings currentUser={currentUser} onUpdateProfile={handleUpdateProfile} />}
            </div>
        </div>
      </main>
      {selectedOrderForAssembly && (
          <OrderAssemblyModal 
              order={selectedOrderForAssembly} currentUser={currentUser} onClose={() => setSelectedOrderForAssembly(null)} onSave={handleSaveAssembly}
              onUpdateProduct={(code, qty) => setSelectedOrderForAssembly(prev => prev ? { ...applyQuantityChange(prev, code, qty) } as any : null)}
              onToggleCheck={(code) => setSelectedOrderForAssembly(prev => prev ? { ...toggleProductCheck(prev, code) } as any : null)}
              onAddProduct={(p: Product) => setSelectedOrderForAssembly(prev => prev ? { ...addProductToOrder(prev, p) } as any : null)}
              onUpdatePrice={(code, price) => setSelectedOrderForAssembly(prev => prev ? { ...updateProductPrice(prev, code, price) } as any : null)}
              onUpdateObservations={(text) => setSelectedOrderForAssembly(prev => prev ? { ...updateObservations(prev, text) } as any : null)}
              onRemoveProduct={(code) => setSelectedOrderForAssembly(prev => prev ? { ...removeProductFromOrder(prev, code) } as any : null)}
              onDeleteOrder={async (id) => { await supabase.from('orders').delete().eq('id', id); setSelectedOrderForAssembly(null); fetchAllData(); }}
          />
      )}
    </div>
  );
}
