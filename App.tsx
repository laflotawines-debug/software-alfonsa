
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
import { Login } from './views/Login';
import { OrderAssemblyModal } from './components/OrderAssemblyModal';
import { View, DetailedOrder, User, Trip, Provider, Transfer, OrderStatus, UserRole, ProviderAccount, TripClient, TripExpense, ProductExpiration, ExpirationStatus } from './types';
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
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });
  
  const [orders, setOrders] = useState<DetailedOrder[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [expirations, setExpirations] = useState<ProductExpiration[]>([]);
  const [selectedOrderForAssembly, setSelectedOrderForAssembly] = useState<DetailedOrder | null>(null);

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) fetchProfile(session.user.id);
      else setIsAuthChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) fetchProfile(session.user.id);
      else {
        setCurrentUser(null);
        setIsAuthChecking(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      // Intentar obtener el perfil existente
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      
      if (data) {
        setCurrentUser({ id: data.id, name: data.name, role: data.role as UserRole });
      } else {
          // Si no existe, crearlo con el rol correspondiente
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
              const baseName = user.email?.split('@')[0] || 'Usuario';
              // Fernando siempre es 'vale'
              const initialRole = user.email === 'fernandoist98@gmail.com' ? 'vale' : 'armador';
              
              const { data: newProfile, error: insError } = await supabase
                .from('profiles')
                .insert({ id: userId, name: baseName, role: initialRole })
                .select()
                .single();
                
              if (newProfile) {
                setCurrentUser({ id: newProfile.id, name: newProfile.name, role: newProfile.role as UserRole });
              }
          }
      }
    } catch (err) {
      console.error("Error cargando perfil:", err);
    } finally {
      setIsAuthChecking(false);
    }
  };

  const handleUpdateProfile = async (newName: string) => {
      if (!currentUser) return;
      const { error } = await supabase.from('profiles').update({ name: newName }).eq('id', currentUser.id);
      if (!error) {
          setCurrentUser({ ...currentUser, name: newName });
      } else {
          throw error;
      }
  };

  const fetchAllData = async () => {
    if (!currentUser) return;
    try {
        const { data: dbOrders } = await supabase.from('orders').select('*, order_items(*)');
        if (dbOrders) {
            const mappedOrders: DetailedOrder[] = dbOrders.map(o => ({
                id: o.id,
                displayId: o.display_id,
                clientName: o.client_name,
                zone: o.zone,
                status: o.status as OrderStatus,
                createdDate: new Date(o.created_at).toLocaleDateString('es-AR'),
                total: Number(o.total || 0),
                observations: o.observations,
                payment_method: o.payment_method,
                assemblerId: o.assembler_id,
                assemblerName: o.assembler_name,
                controllerId: o.controller_id,
                controllerName: o.controller_name,
                invoicerName: o.invoicer_name,
                history: o.history || [],
                productCount: o.order_items?.length || 0,
                products: (o.order_items || []).map((item: any) => ({
                    code: item.code,
                    name: item.name,
                    originalQuantity: item.original_quantity,
                    quantity: item.quantity,
                    shippedQuantity: item.shipped_quantity,
                    unitPrice: Number(item.unit_price || 0),
                    subtotal: Number(item.subtotal || 0),
                    isChecked: item.is_checked
                }))
            }));
            setOrders(mappedOrders.sort((a, b) => b.id.localeCompare(a.id)));
        }

        const { data: dbProviders } = await supabase.from('providers').select('*, provider_accounts(*)');
        if (dbProviders) {
            const mappedProviders: Provider[] = dbProviders.map(p => ({
                id: p.id,
                name: p.name,
                goalAmount: Number(p.goal_amount || 0),
                priority: p.priority,
                status: p.status,
                accounts: (p.provider_accounts || []).map((a: any) => ({
                    id: a.id,
                    providerId: a.provider_id,
                    condition: a.condition,
                    holder: a.holder,
                    identifierAlias: a.identifier_alias,
                    identifierCBU: a.identifier_cbu,
                    metaAmount: Number(a.meta_amount || 0),
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
                id: t.id,
                clientName: t.client_name,
                amount: Number(t.amount || 0),
                date: t.date_text,
                providerId: t.provider_id,
                accountId: t.account_id,
                notes: t.notes,
                status: t.status as 'Pendiente' | 'Realizado',
                isLoadedInSystem: t.is_loaded_in_system
            }));
            setTransfers(mappedTransfers.sort((a, b) => b.id.localeCompare(a.id)));
        }

        const { data: dbTrips } = await supabase.from('trips').select('*, trip_clients(*), trip_expenses(*)');
        if (dbTrips) {
            const mappedTrips: Trip[] = dbTrips.map(t => ({
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
                    previousBalance: Number(c.previous_balance || 0),
                    currentInvoiceAmount: Number(c.current_invoice_amount || 0),
                    paymentCash: Number(c.payment_cash || 0),
                    paymentTransfer: Number(c.payment_transfer || 0),
                    isTransferExpected: c.is_transfer_expected,
                    status: c.status
                })),
                expenses: (t.trip_expenses || []).map((e: any) => ({
                    id: e.id,
                    type: e.type,
                    amount: Number(e.amount || 0),
                    note: e.note,
                    timestamp: new Date(e.timestamp)
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
                return {
                    id: item.id,
                    productName: item.product_name,
                    quantity: `${item.total_quantity} unidades`,
                    expiryDate,
                    daysRemaining,
                    status
                };
            });
            setExpirations(mappedExpirations);
        }
    } catch (err) {
        console.error("Error sincronizando datos:", err);
    } finally {
        setIsDataLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) fetchAllData();
  }, [currentUser]);

  const releaseOccupancy = useCallback(async (orderId: string) => {
    if (!currentUser) return;
    
    const { error } = await supabase
        .from('orders')
        .update({ 
            assembler_id: null, 
            assembler_name: null,
            controller_id: null,
            controller_name: null
        })
        .eq('id', orderId)
        .or(`assembler_id.eq.${currentUser.id},controller_id.eq.${currentUser.id}`);

    if (!error) {
        await fetchAllData();
    }
  }, [currentUser]);

  useEffect(() => {
    const handleBeforeUnload = () => {
        if (selectedOrderForAssembly) {
            releaseOccupancy(selectedOrderForAssembly.id);
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [selectedOrderForAssembly, releaseOccupancy]);

  const handleOpenOrder = async (order: DetailedOrder) => {
    if (!currentUser) return;

    if (order.status === OrderStatus.EN_ARMADO && !order.assemblerId) {
        const { error } = await supabase.from('orders').update({ assembler_id: currentUser.id, assembler_name: currentUser.name }).eq('id', order.id);
        if (!error) {
            const updated = { ...order, assemblerId: currentUser.id, assemblerName: currentUser.name };
            setSelectedOrderForAssembly(updated);
            fetchAllData();
            return;
        }
    } else if (order.status === OrderStatus.ARMADO && !order.controllerId && order.assemblerId !== currentUser.id) {
        const { error } = await supabase.from('orders').update({ controller_id: currentUser.id, controller_name: currentUser.name }).eq('id', order.id);
        if (!error) {
            const updated = { ...order, controllerId: currentUser.id, controllerName: currentUser.name };
            setSelectedOrderForAssembly(updated);
            fetchAllData();
            return;
        }
    }
    setSelectedOrderForAssembly(order);
  };

  const handleSaveTransfer = async (transfer: Transfer) => {
    try {
        const isNew = transfer.id.toString().startsWith('t-');
        const payload: any = { 
            client_name: transfer.clientName, 
            amount: Number(transfer.amount), 
            date_text: transfer.date, 
            provider_id: transfer.providerId, 
            account_id: transfer.accountId, 
            notes: transfer.notes, 
            status: transfer.status, 
            is_loaded_in_system: transfer.isLoadedInSystem 
        };
        
        let tError;
        if (isNew) {
            const { error } = await supabase.from('transfers').insert([payload]);
            tError = error;
        } else {
            const { error } = await supabase.from('transfers').update(payload).eq('id', transfer.id);
            tError = error;
        }

        if (tError) throw tError;

        if (isNew) {
            const account = providers.flatMap(p => p.accounts).find(a => a.id === transfer.accountId);
            if (account) {
                const update: any = {};
                const amt = Number(transfer.amount);
                if (transfer.status === 'Realizado') {
                    update.current_amount = (Number(account.currentAmount) || 0) + amt;
                } else {
                    update.pending_amount = (Number(account.pendingAmount) || 0) + amt;
                }
                const { error: accError } = await supabase.from('provider_accounts').update(update).eq('id', transfer.accountId);
                if (accError) throw accError;
            }
        }
        await fetchAllData();
    } catch (err: any) { 
        const msg = err.message || err.details || (typeof err === 'object' ? JSON.stringify(err) : String(err));
        console.error("Error guardando transferencia:", msg);
        alert("No se pudo guardar la transferencia.\n\nDetalle: " + msg);
    }
  };

  const handleUpdateTransferStatus = async (transferId: string, newStatus: 'Pendiente' | 'Realizado') => {
    try {
        const transfer = transfers.find(t => t.id === transferId);
        if (!transfer || transfer.status === newStatus) return;
        
        const { error } = await supabase.from('transfers').update({ status: newStatus }).eq('id', transferId);
        if (error) throw error;
        
        const account = providers.flatMap(p => p.accounts).find(a => a.id === transfer.accountId);
        if (account) {
            const update: any = {};
            const amt = Number(transfer.amount);
            if (newStatus === 'Realizado') { 
                update.pending_amount = Math.max(0, (Number(account.pendingAmount) || 0) - amt); 
                update.current_amount = (Number(account.currentAmount) || 0) + amt; 
            } else { 
                update.current_amount = Math.max(0, (Number(account.currentAmount) || 0) - amt); 
                update.pending_amount = (Number(account.pendingAmount) || 0) + amt; 
            }
            const { error: accError } = await supabase.from('provider_accounts').update(update).eq('id', transfer.accountId);
            if (accError) throw accError;
        }
        await fetchAllData();
    } catch (err: any) { 
        console.error("Error actualizando estado pago:", err.message || err);
    }
  };

  const handleCreateOrder = async (newOrder: DetailedOrder) => {
    if (!currentUser) return;
    try {
        const { data: dbOrder, error: oError } = await supabase.from('orders').insert([{
            display_id: newOrder.displayId,
            client_name: newOrder.clientName,
            zone: newOrder.zone,
            status: newOrder.status,
            total: Number(newOrder.total),
            observations: newOrder.observations,
            payment_method: newOrder.paymentMethod || 'Pendiente',
            history: newOrder.history
        }]).select().single();

        if (oError) throw oError;

        if (dbOrder && newOrder.products?.length > 0) {
            const items = newOrder.products.map(p => ({ 
                order_id: dbOrder.id, 
                code: p.code, 
                name: p.name, 
                original_quantity: Number(p.originalQuantity), 
                quantity: Number(p.quantity), 
                unit_price: Number(p.unitPrice), 
                subtotal: Number(p.subtotal), 
                is_checked: p.isChecked 
            }));
            const { error: iError } = await supabase.from('order_items').insert(items);
            if (iError) throw iError;
        }
        fetchAllData();
    } catch (e: any) { console.error("Error creando pedido:", e); }
  };

  const handleInvoiceOrder = async (order: DetailedOrder) => {
    if (!currentUser) return;
    const updatedOrder = advanceOrderStatus(order, currentUser) as DetailedOrder;
    const updatePayload: any = { 
        status: updatedOrder.status,
        assembler_id: updatedOrder.assemblerId,
        assembler_name: updatedOrder.assemblerName,
        controller_id: updatedOrder.controllerId,
        controller_name: updatedOrder.controllerName,
        invoicer_name: updatedOrder.invoicerName,
        history: updatedOrder.history
    };
    const { error } = await supabase.from('orders').update(updatePayload).eq('id', updatedOrder.id);
    if (!error) {
        if (updatedOrder.status === OrderStatus.EN_TRANSITO) {
            const itemUpdates = updatedOrder.products.map(p => supabase.from('order_items').update({ shipped_quantity: Number(p.shippedQuantity) }).eq('order_id', updatedOrder.id).eq('code', p.code));
            await Promise.all(itemUpdates);
        }
        fetchAllData();
        if (selectedOrderForAssembly?.id === updatedOrder.id) setSelectedOrderForAssembly(updatedOrder);
    }
  };

  const handleSaveTrip = async (trip: Trip) => {
    try {
      const isNew = trip.id.startsWith('trip-');
      const payload: any = {
        display_id: trip.displayId,
        name: trip.name,
        status: trip.status,
        driver_name: trip.driverName,
        date_text: trip.date,
        route: trip.route
      };

      let tripId = trip.id;
      if (isNew) {
        const { data, error } = await supabase.from('trips').insert([payload]).select().single();
        if (error) throw error;
        tripId = data.id;
      } else {
        const { error } = await supabase.from('trips').update(payload).eq('id', trip.id);
        if (error) throw error;
      }

      await supabase.from('trip_clients').delete().eq('trip_id', tripId);
      if (trip.clients.length > 0) {
        const clients = trip.clients.map(c => ({
          trip_id: tripId,
          name: c.name,
          address: c.address,
          previous_balance: Number(c.previousBalance || 0),
          current_invoice_amount: Number(c.currentInvoiceAmount || 0),
          payment_cash: Number(c.paymentCash || 0), 
          payment_transfer: Number(c.paymentTransfer || 0), 
          is_transfer_expected: !!c.isTransferExpected,
          status: c.status
        }));
        const { error: cError } = await supabase.from('trip_clients').insert(clients);
        if (cError) throw cError;
      }

      await supabase.from('trip_expenses').delete().eq('trip_id', tripId);
      if (trip.expenses.length > 0) {
        const expenses = trip.expenses.map(e => ({
          trip_id: tripId,
          type: e.type,
          amount: Number(e.amount),
          note: e.note,
          timestamp: e.timestamp.toISOString()
        }));
        const { error: eError } = await supabase.from('trip_expenses').insert(expenses);
        if (eError) throw eError;
      }

      await fetchAllData();
    } catch (err: any) {
      console.error("Error guardando viaje:", err.message || err);
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    try {
      await supabase.from('trips').delete().eq('id', tripId);
      await fetchAllData();
    } catch (err) {
      console.error("Error eliminando viaje:", err);
    }
  };

  const handleSaveProvider = async (provider: Provider) => {
    try {
      const isNew = provider.id.startsWith('p-');
      const payload: any = {
        name: provider.name,
        goal_amount: Number(provider.goalAmount),
        priority: Number(provider.priority),
        status: provider.status
      };

      let providerId = provider.id;
      if (isNew) {
        const { data, error } = await supabase.from('providers').insert([payload]).select().single();
        if (error) throw error;
        providerId = data.id;
      } else {
        const { error } = await supabase.from('providers').update(payload).eq('id', provider.id);
        if (error) throw error;
      }

      for (const acc of provider.accounts) {
        const isAccNew = acc.id.startsWith('acc-');
        const accPayload: any = {
          provider_id: providerId,
          condition: acc.condition,
          holder: acc.holder,
          identifier_alias: acc.identifierAlias,
          identifier_cbu: acc.identifierCBU,
          meta_amount: Number(acc.metaAmount),
          current_amount: Number(acc.currentAmount),
          pending_amount: Number(acc.pendingAmount),
          status: acc.status
        };
        if (isAccNew) {
            await supabase.from('provider_accounts').insert([accPayload]);
        } else {
            await supabase.from('provider_accounts').update(accPayload).eq('id', acc.id);
        }
      }
      await fetchAllData();
    } catch (err: any) {
      console.error("Error guardando proveedor:", err.message || err);
    }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); setCurrentUser(null); };

  if (isAuthChecking) return <div className="h-screen w-full flex flex-col items-center justify-center bg-background gap-4"><div className="h-16 w-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div><p className="text-muted font-bold text-xs uppercase animate-pulse">Cargando...</p></div>;
  if (!currentUser) return <Login isDarkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(!isDarkMode)} />;
  if (isDataLoading) return <div className="h-screen w-full flex flex-col items-center justify-center bg-background gap-4"><div className="h-16 w-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div><p className="text-muted font-bold text-xs uppercase animate-pulse">Sincronizando...</p></div>;

  return (
    <div className="flex h-screen w-full flex-row overflow-hidden bg-background text-text transition-colors duration-300">
      <Sidebar currentView={currentView} onNavigate={v => { setCurrentView(v); setMobileMenuOpen(false); }} />
      <main className="flex flex-1 flex-col h-full relative overflow-hidden bg-background">
        <Header onMenuClick={() => setMobileMenuOpen(true)} title={currentView === View.DASHBOARD ? "Panel de Control" : currentView} subtitle="Software de Gestión Alfonsa" isDarkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(!isDarkMode)} currentUser={currentUser} onLogout={handleLogout} />
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="mx-auto max-w-7xl animate-in fade-in duration-500">
                {currentView === View.DASHBOARD && <Dashboard orders={orders} expirations={expirations} onNavigate={setCurrentView} />}
                {currentView === View.ORDERS && (
                    <OrderList onNavigate={setCurrentView} orders={orders} currentUser={currentUser} onOpenAssembly={handleOpenOrder} onDeleteOrder={id => supabase.from('orders').delete().eq('id', id).then(() => fetchAllData())} onInvoiceOrder={handleInvoiceOrder} />
                )}
                {currentView === View.ORDER_SHEET && (
                    <OrderSheet currentUser={currentUser} orders={orders} trips={trips} onSaveTrip={handleSaveTrip} onDeleteTrip={handleDeleteTrip} />
                )}
                {currentView === View.PAYMENTS_OVERVIEW && (
                    <PaymentsOverview providers={providers} onDeleteProvider={id => supabase.from('providers').delete().eq('id', id).then(() => fetchAllData())} onUpdateProviders={handleSaveProvider} transfers={transfers} onUpdateTransfers={handleSaveTransfer} onConfirmTransfer={handleUpdateTransferStatus} />
                )}
                {currentView === View.PAYMENTS_HISTORY && (
                    <PaymentsHistory transfers={transfers} onDeleteTransfer={id => supabase.from('transfers').delete().eq('id', id).then(() => fetchAllData())} onClearHistory={() => supabase.from('transfers').delete().neq('id', '0').then(() => fetchAllData())} onUpdateTransfers={handleSaveTransfer} onUpdateStatus={handleUpdateTransferStatus} providers={providers} />
                )}
                {currentView === View.PAYMENTS_PROVIDERS && (
                    <PaymentsProviders providers={providers} onUpdateProviders={handleSaveProvider} onDeleteProvider={id => supabase.from('providers').delete().eq('id', id).then(() => fetchAllData())} />
                )}
                {currentView === View.EXPIRATIONS && <Expirations />}
                {currentView === View.CREATE_BUDGET && <CreateBudget onNavigate={setCurrentView} onCreateOrder={handleCreateOrder} currentUser={currentUser} />}
                {currentView === View.SQL_EDITOR && <SqlEditor currentUser={currentUser} />}
                {currentView === View.SETTINGS && <Settings currentUser={currentUser} onUpdateProfile={handleUpdateProfile} />}
            </div>
        </div>
      </main>

      {selectedOrderForAssembly && (
          <OrderAssemblyModal 
            order={selectedOrderForAssembly} 
            currentUser={currentUser} 
            onClose={async () => {
                const orderId = selectedOrderForAssembly.id;
                await releaseOccupancy(orderId);
                setSelectedOrderForAssembly(null);
            }} 
            onSave={async (order, advance) => {
                const orderId = order.id;
                if (advance) {
                    await handleInvoiceOrder(order as DetailedOrder);
                    await releaseOccupancy(orderId);
                    setSelectedOrderForAssembly(null);
                } else {
                    await supabase.from('orders').update({ 
                        observations: order.observations, 
                        payment_method: order.paymentMethod, 
                        total: Number(order.total), 
                        history: order.history 
                    }).eq('id', order.id);
                    
                    const itemUpdates = order.products.map(p => 
                        supabase.from('order_items')
                            .update({ 
                                quantity: Number(p.quantity), 
                                is_checked: p.isChecked, 
                                unit_price: Number(p.unitPrice), 
                                subtotal: Number(p.subtotal) 
                            })
                            .eq('order_id', order.id)
                            .eq('code', p.code)
                    );
                    await Promise.all(itemUpdates);
                    
                    await releaseOccupancy(orderId);
                    setSelectedOrderForAssembly(null);
                }
            }}
            onUpdateProduct={(code, qty) => setSelectedOrderForAssembly(applyQuantityChange(selectedOrderForAssembly, code, qty) as DetailedOrder)}
            onToggleCheck={code => setSelectedOrderForAssembly(toggleProductCheck(selectedOrderForAssembly, code) as DetailedOrder)}
            onUpdateObservations={text => setSelectedOrderForAssembly(updateObservations(selectedOrderForAssembly, text) as DetailedOrder)}
            onAddProduct={p => setSelectedOrderForAssembly(addProductToOrder(selectedOrderForAssembly, p) as DetailedOrder)}
            onUpdatePrice={(code, price) => setSelectedOrderForAssembly(updateProductPrice(selectedOrderForAssembly, code, price) as DetailedOrder)}
            onRemoveProduct={code => setSelectedOrderForAssembly(removeProductFromOrder(selectedOrderForAssembly, code) as DetailedOrder)}
            onDeleteOrder={id => supabase.from('orders').delete().eq('id', id).then(() => fetchAllData())} 
            onInvoice={handleInvoiceOrder} 
          />
      )}
      {mobileMenuOpen && <Sidebar currentView={currentView} onNavigate={v => { setCurrentView(v); setMobileMenuOpen(false); }} isMobile onClose={() => setMobileMenuOpen(false)} />}
    </div>
  );
}
