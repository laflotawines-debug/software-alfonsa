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
import { AccountStatements } from './views/AccountStatements';
import { Login } from './views/Login';
import { Catalog } from './views/Catalog';
import { StockControl } from './views/StockControl';
import { PriceManagement } from './views/PriceManagement';
import { InventoryInbounds } from './views/InventoryInbounds';
import { InventoryAdjustments } from './views/InventoryAdjustments';
import { InventoryTransfers } from './views/InventoryTransfers';
import { InventoryHistory } from './views/InventoryHistory';
import { SupplierOrders } from './views/SupplierOrders';
import { Attendance } from './views/Attendance';

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
    Order,
    Product,
    PaymentMethod
} from './types';
import { supabase } from './supabase';
import { 
    applyQuantityChange, 
    toggleProductCheck, 
    updateObservations, 
    advanceOrderStatus,
    addProductToOrder,
    updateProductPrice,
    removeProductFromOrder,
    ORDER_WORKFLOW
} from './logic';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [orders, setOrders] = useState<DetailedOrder[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [transfers, setSetTransfers] = useState<Transfer[]>([]);
  const [expirations, setExpirations] = useState<ProductExpiration[]>([]);
  const [selectedOrderForAssembly, setSelectedOrderForAssembly] = useState<DetailedOrder | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

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

  const handleToggleTheme = async () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    
    if (currentUser) {
        try {
            await supabase
                .from('profiles')
                .update({ theme_preference: nextMode ? 'dark' : 'light' })
                .eq('id', currentUser.id);
        } catch (e) {
            console.error("Error guardando preferencia de tema:", e);
        }
    }
  };

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
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
    deferredPrompt.prompt();
    setDeferredPrompt(null);
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (profile) {
        const { data: perms } = await supabase.from('user_permissions').select('permission_key').eq('user_id', userId);
        const permissionKeys = perms?.map(p => p.permission_key) || [];
        
        if (profile.theme_preference) {
            setIsDarkMode(profile.theme_preference === 'dark');
        }

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
                total: Number(o.total || 0), observations: o.observations, payment_method: o.payment_method, 
                assemblerId: o.assembler_id, assemblerName: o.assembler_name, controllerId: o.controller_id, 
                controllerName: o.controller_name, invoicerName: o.invoicer_name, history: o.history || [], 
                productCount: o.order_items?.length || 0,
                products: (o.order_items || []).map((item: any) => ({
                    code: item.code, name: item.name, originalQuantity: item.original_quantity, 
                    quantity: item.quantity, 
                    shippedQuantity: item.shipped_quantity, 
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
                    identifierAlias: a.identifier_alias, 
                    identifierCBU: a.identifier_cbu, 
                    metaAmount: a.meta_amount, 
                    currentAmount: Number(a.current_amount || 0), 
                    pendingAmount: Number(a.pending_amount || 0), 
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
            setSetTransfers(mappedTransfers.sort((a, b) => b.id.localeCompare(a.id)));
        }

        const { data: dbTrips } = await supabase.from('trips').select('*, trip_clients(*), trip_expenses(*)');
        if (dbTrips) {
            const mappedTrips: Trip[] = dbTrips.map(t => ({
                id: t.id, displayId: t.display_id, name: t.name, status: t.status as any,
                driverName: t.driver_name, date: t.date_text, route: t.route,
                clients: (t.trip_clients || []).map((c: any) => ({
                    id: c.id, name: c.name, address: c.address, 
                    previousBalance: Number(c.previous_balance || 0),
                    currentInvoiceAmount: Number(c.current_invoice_amount || 0), 
                    paymentCash: Number(c.payment_cash || 0),
                    paymentTransfer: Number(c.payment_transfer || 0), 
                    isTransferExpected: !!c.is_transfer_expected,
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

  const handleAdvanceOrder = async (order: DetailedOrder) => {
    const nextStatus = ORDER_WORKFLOW[order.status]?.next;
    if (!nextStatus) return;
    
    setIsDataLoading(true);
    try {
        const updates: any = { status: nextStatus };
        
        if (nextStatus === OrderStatus.EN_TRANSITO) {
            const { error: itemsErr } = await supabase
                .rpc('set_shipped_quantity_for_order', { p_order_id: order.id });
            
            if (itemsErr) {
                if (itemsErr.code === 'PGRST202') {
                    throw new Error("ERROR DE SISTEMA: La función de reparto no existe. Por favor, ve al 'Editor SQL', copia el script de reparación y ejecútalo en Supabase para activar esta función.");
                }
                throw itemsErr;
            }
        }

        const { error } = await supabase.from('orders').update(updates).eq('id', order.id);
        if (error) throw error;
        await fetchAllData();
    } catch (e: any) {
        console.error(e);
        alert(e.message);
    } finally {
        setIsDataLoading(false);
    }
  };

  const handleSaveAssembly = async (updatedOrder: Order, shouldAdvance: boolean) => {
    setIsDataLoading(true);
    try {
        const finalStatus = shouldAdvance ? (ORDER_WORKFLOW[updatedOrder.status]?.next || updatedOrder.status) : updatedOrder.status;
        
        const { error: ordErr } = await supabase.from('orders').update({
            status: finalStatus,
            total: updatedOrder.total,
            observations: updatedOrder.observations,
            payment_method: updatedOrder.paymentMethod
        }).eq('id', updatedOrder.id);
        
        if (ordErr) throw ordErr;

        const updateItemPromises = updatedOrder.products.map(p => {
            const itemUpdates: any = {
                quantity: p.quantity,
                subtotal: p.subtotal,
                is_checked: p.isChecked
            };
            
            if (shouldAdvance && finalStatus === OrderStatus.EN_TRANSITO) {
                itemUpdates.shipped_quantity = p.quantity;
            }

            return supabase
                .from('order_items')
                .update(itemUpdates)
                .eq('order_id', updatedOrder.id)
                .eq('code', p.code);
        });

        const itemResults = await Promise.all(updateItemPromises);
        const itemErrors = itemResults.filter(res => res.error);
        if (itemErrors.length > 0) {
            console.error("Errores al actualizar items:", itemErrors);
            alert("Algunos productos no pudieron actualizarse correctamente.");
        }
        
        setSelectedOrderForAssembly(null);
        await fetchAllData();
    } catch (e) {
        console.error(e);
        alert("Ocurrió un error al guardar los cambios.");
    } finally {
        setIsDataLoading(false);
    }
  };

  const handleCreateOrder = async (newOrder: DetailedOrder) => {
    setIsDataLoading(true);
    try {
        const { data, error } = await supabase.from('orders').insert({
            display_id: newOrder.displayId,
            client_name: newOrder.clientName,
            zone: newOrder.zone,
            status: newOrder.status,
            total: newOrder.total,
            history: newOrder.history
        }).select().single();

        if (error) throw error;

        const items = newOrder.products.map(p => ({
            order_id: data.id,
            code: p.code,
            name: p.name,
            original_quantity: p.originalQuantity,
            quantity: p.quantity,
            unit_price: p.unitPrice,
            subtotal: p.subtotal,
            is_checked: p.isChecked
        }));

        await supabase.from('order_items').insert(items);
        setCurrentView(View.ORDERS);
        await fetchAllData();
    } catch (e) {
        console.error(e);
    } finally {
        setIsDataLoading(false);
    }
  };

  const handleSaveTrip = async (trip: Trip) => {
    setIsDataLoading(true);
    try {
        let tripId = trip.id;
        const tripData = {
            display_id: trip.displayId,
            name: trip.name,
            status: trip.status,
            driver_name: trip.driverName,
            date_text: trip.date,
            route: trip.route
        };

        if (!trip.id || trip.id.includes('trip-')) {
            const { data, error } = await supabase.from('trips').insert(tripData).select().single();
            if (error) throw error;
            tripId = data.id;
        } else {
            const { error = null } = await supabase.from('trips').update(tripData).eq('id', trip.id);
            if (error) throw error;
        }

        await supabase.from('trip_clients').delete().eq('trip_id', tripId);
        if (trip.clients && trip.clients.length > 0) {
            const clientsToInsert = trip.clients.map(c => ({
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
            await supabase.from('trip_clients').insert(clientsToInsert);
        }

        await supabase.from('trip_expenses').delete().eq('trip_id', tripId);
        if (trip.expenses && trip.expenses.length > 0) {
            const expensesToInsert = trip.expenses.map(e => ({
                trip_id: tripId,
                type: e.type,
                amount: e.amount,
                note: e.note,
                timestamp: e.timestamp.toISOString()
            }));
            await supabase.from('trip_expenses').insert(expensesToInsert);
        }

        await fetchAllData();
    } catch (e: any) { 
        console.error("Error al guardar viaje:", e.message); 
        alert("Error al guardar viaje: " + e.message);
    } finally { 
        setIsDataLoading(false); 
    }
  };

  const handleDeleteTrip = async (id: string) => {
      setIsDataLoading(true);
      try {
          await supabase.from('trips').delete().eq('id', id);
          await fetchAllData();
      } catch (e) { console.error(e); } finally { setIsDataLoading(false); }
  };

  const handleDeleteProvider = async (id: string) => {
    setIsDataLoading(true);
    try {
        await supabase.from('providers').delete().eq('id', id);
        await fetchAllData();
    } catch (e) { console.error(e); } finally { setIsDataLoading(false); }
  };

  const handleUpdateProvider = async (provider: Provider) => {
    setIsDataLoading(true);
    try {
        const providerPayload: any = {
            name: provider.name,
            goal_amount: provider.goalAmount,
            priority: provider.priority,
            status: provider.status
        };

        const isNew = !provider.id || provider.id.startsWith('p-');
        if (!isNew) {
            providerPayload.id = provider.id;
        }

        const { data: savedProvider, error: pError } = await supabase
            .from('providers')
            .upsert(providerPayload)
            .select()
            .single();

        if (pError) throw pError;

        if (provider.accounts && provider.accounts.length > 0) {
            const accountsPayload = provider.accounts.map(acc => {
                const accData: any = {
                    provider_id: savedProvider.id,
                    condition: acc.condition,
                    holder: acc.holder,
                    identifier_alias: acc.identifierAlias,
                    identifier_cbu: acc.identifierCBU,
                    meta_amount: acc.metaAmount, 
                    status: acc.status
                };
                if (acc.id && !acc.id.startsWith('acc-')) {
                    accData.id = acc.id;
                }
                return accData;
            });

            const { error: accError } = await supabase
                .from('provider_accounts')
                .upsert(accountsPayload);
            
            if (accError) throw accError;
        }

        await fetchAllData();
    } catch (e: any) { 
        console.error("Error al actualizar proveedor:", e); 
        alert("Error al guardar proveedor: " + e.message);
    } finally { 
        setIsDataLoading(false); 
    }
  };

  const handleSaveTransfer = async (t: Transfer) => {
      setIsDataLoading(true);
      try {
          const payload: any = {
              client_name: t.clientName,
              amount: t.amount,
              date_text: t.date,
              provider_id: t.providerId,
              account_id: t.accountId,
              notes: t.notes,
              status: t.status,
              is_loaded_in_system: t.isLoadedInSystem
          };
          
          if (t.id && !t.id.startsWith('t-')) {
              payload.id = t.id;
          }

          const { error } = await supabase.from('transfers').upsert(payload);
          if (error) throw error;
          
          await fetchAllData();
      } catch (e: any) { 
          console.error("Error al guardar transferencia:", e); 
          alert("Error de guardado: " + e.message);
      } finally { 
          setIsDataLoading(false); 
      }
  };

  const handleUpdateTransferStatus = async (id: string, status: string) => {
    setIsDataLoading(true);
    try {
        await supabase.from('transfers').update({ status }).eq('id', id);
        await fetchAllData();
    } catch (e) { console.error(e); } finally { setIsDataLoading(false); }
  };

  const handleDeleteTransfer = async (id: string) => {
      setIsDataLoading(true);
      try {
          await supabase.from('transfers').delete().eq('id', id);
          await fetchAllData();
      } catch (e) { console.error(e); } finally { setIsDataLoading(false); }
  };

  const handleClearHistory = async () => {
    if (!confirm("¿Deseas limpiar todo el historial?")) return;
    setIsDataLoading(true);
    try {
        await supabase.from('transfers').delete().neq('id', '._.');
        await fetchAllData();
    } catch (e) { console.error(e); } finally { setIsDataLoading(false); }
  };

  const handleResetProvider = async (id: string) => {
      setIsDataLoading(true);
      try {
          await supabase.from('transfers').delete().eq('provider_id', id);
          await fetchAllData();
      } catch (e) { console.error(e); } finally { setIsDataLoading(false); }
  };

  const handleUpdateProfile = async (newName: string, avatarUrl?: string) => {
      if (!currentUser) return;
      setIsDataLoading(true);
      try {
          await supabase.from('profiles').update({ name: newName, avatar_url: avatarUrl }).eq('id', currentUser.id);
          await fetchProfile(currentUser.id);
      } catch (e) { console.error(e); } finally { setIsDataLoading(false); }
  };

  if (isAuthChecking) return <div className="h-screen w-full flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" size={48} /></div>;
  if (!currentUser) return <Login isDarkMode={isDarkMode} onToggleTheme={handleToggleTheme} />;

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

      <Sidebar currentUser={currentUser} currentView={currentView} isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} onNavigate={v => { setCurrentView(v); setMobileMenuOpen(false); }} />

      <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-background">
        <Header 
            onMenuClick={() => setMobileMenuOpen(true)} 
            title={currentView === View.DASHBOARD ? "Tablero" : currentView === View.ORDERS ? "Gestión de Pedidos" : currentView === View.ORDER_SHEET ? "Planilla" : currentView === View.ATTENDANCE ? "Asistencias" : currentView} 
            subtitle="Gestión Alfonsa" 
            isDarkMode={isDarkMode} 
            onToggleTheme={handleToggleTheme} 
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
                {currentView === View.ATTENDANCE && <Attendance />}
                {currentView === View.CREATE_BUDGET && <CreateBudget onNavigate={setCurrentView} onCreateOrder={handleCreateOrder} currentUser={currentUser} />}
                {currentView === View.PAYMENTS_OVERVIEW && (
                    <PaymentsOverview 
                        providers={providers} 
                        onDeleteProvider={handleDeleteProvider} 
                        onUpdateProviders={handleUpdateProvider} 
                        transfers={transfers} 
                        onUpdateTransfers={handleSaveTransfer} 
                        onConfirmTransfer={handleUpdateTransferStatus}
                        onDeleteTransfer={handleDeleteTransfer}
                    />
                )}
                {currentView === View.PAYMENTS_HISTORY && (
                    <PaymentsHistory transfers={transfers} onDeleteTransfer={handleDeleteTransfer} onClearHistory={handleClearHistory} onUpdateTransfers={handleSaveTransfer} onUpdateStatus={handleUpdateTransferStatus} providers={providers} />
                )}
                {currentView === View.PAYMENTS_PROVIDERS && (
                    <PaymentsProviders providers={providers} onUpdateProviders={handleUpdateProvider} onDeleteProvider={handleDeleteProvider} onResetProvider={handleResetProvider} />
                )}
                {currentView === View.INV_INBOUNDS && <InventoryInbounds currentUser={currentUser} />}
                {currentView === View.INV_SUPPLIER_ORDERS && <SupplierOrders currentUser={currentUser} />}
                {currentView === View.INV_ADJUSTMENTS && <InventoryAdjustments currentUser={currentUser} />}
                {currentView === View.INV_TRANSFERS && <InventoryTransfers currentUser={currentUser} />}
                {currentView === View.INV_HISTORY && <InventoryHistory currentUser={currentUser} />}
                {currentView === View.CATALOG && <Catalog currentUser={currentUser} />}
                {currentView === View.CLIENTS_MASTER && <ClientsMaster currentUser={currentUser} />}
                {currentView === View.CLIENT_STATEMENTS && <AccountStatements />}
                {currentView === View.SUPPLIERS_MASTER && <SuppliersMaster currentUser={currentUser} />}
                {currentView === View.EXPIRATIONS && <Expirations />}
                {currentView === View.ETIQUETADOR && <Etiquetador />}
                {currentView === View.PRESUPUESTADOR && <Presupuestador />}
                {currentView === View.LISTA_CHINA && <ListaChina />}
                {currentView === View.STOCK_CONTROL && <StockControl currentUser={currentUser} />}
                {currentView === View.PRICE_MANAGEMENT && <PriceManagement currentUser={currentUser} />}
                {currentView === View.SQL_EDITOR && <SqlEditor currentUser={currentUser} />}
                {currentView === View.SETTINGS && (
                  <Settings currentUser={currentUser} onUpdateProfile={handleUpdateProfile} isDarkMode={isDarkMode} onToggleTheme={handleToggleTheme} />
                )}
            </div>
        </div>
      </main>
      {selectedOrderForAssembly && (
          <OrderAssemblyModal 
              order={selectedOrderForAssembly} 
              currentUser={currentUser} 
              onClose={() => setSelectedOrderForAssembly(null)} 
              onSave={handleSaveAssembly}
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