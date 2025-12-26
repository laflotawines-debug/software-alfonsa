
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
import { Login } from './views/Login';
import { OrderAssemblyModal } from './components/OrderAssemblyModal';
import { 
    View, 
    DetailedOrder, 
    User, 
    Trip, 
    Provider, 
    Transfer, 
    OrderStatus, 
    UserRole, 
    ProviderAccount, 
    TripClient, 
    TripExpense, 
    ProductExpiration, 
    ExpirationStatus, 
    PaymentStatus 
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
    if (currentUser && currentUser.role === 'armador' && currentView === View.DASHBOARD) {
        setCurrentView(View.ORDERS);
    }
  }, [currentUser, currentView]);

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
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      
      if (data) {
        const profile = { id: data.id, name: data.name, role: data.role as UserRole };
        setCurrentUser(profile);
      } else {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
              const baseName = user.email?.split('@')[0] || 'Usuario';
              const initialRole = user.email === 'fernandoist98@gmail.com' ? 'vale' : 'armador';
              
              const { data: newProfile, error: insError } = await supabase
                .from('profiles')
                .insert({ id: userId, name: baseName, role: initialRole })
                .select()
                .single();
                
              if (newProfile) {
                const profile = { id: newProfile.id, name: newProfile.name, role: newProfile.role as UserRole };
                setCurrentUser(profile);
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
                paymentMethod: o.payment_method,
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
                    isTransferExpected: !!c.is_transfer_expected,
                    status: c.status as PaymentStatus
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
        .update({ assembler_id: null, assembler_name: null, controller_id: null, controller_name: null })
        .eq('id', orderId)
        .or(`assembler_id.eq.${currentUser.id},controller_id.eq.${currentUser.id}`);
    if (!error) fetchAllData();
  }, [currentUser]);

  const handleOpenOrder = async (order: DetailedOrder) => {
    if (!currentUser) return;
    if (order.status === OrderStatus.EN_ARMADO && !order.assemblerId) {
        const { error } = await supabase.from('orders').update({ assembler_id: currentUser.id, assembler_name: currentUser.name }).eq('id', order.id);
        if (!error) {
            setSelectedOrderForAssembly({ ...order, assemblerId: currentUser.id, assemblerName: currentUser.name });
            fetchAllData();
            return;
        }
    } else if (order.status === OrderStatus.ARMADO) {
        if (!order.controllerId) {
            const { error } = await supabase.from('orders').update({ controller_id: currentUser.id, controller_name: currentUser.name }).eq('id', order.id);
            if (!error) {
                setSelectedOrderForAssembly({ ...order, controllerId: currentUser.id, controllerName: currentUser.name });
                fetchAllData();
                return;
            }
        }
    }
    setSelectedOrderForAssembly(order);
  };

  const handleSaveTransfer = async (transfer: Transfer) => {
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
    if (!tError) fetchAllData();
  };

  const handleLogout = async () => { await supabase.auth.signOut(); setCurrentUser(null); };

  if (isAuthChecking) return <div className="h-screen w-full flex flex-col items-center justify-center bg-background gap-4"><div className="h-16 w-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div><p className="text-muted font-bold text-xs uppercase animate-pulse">Cargando...</p></div>;
  if (!currentUser) return <Login isDarkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(!isDarkMode)} />;
  if (isDataLoading) return <div className="h-screen w-full flex flex-col items-center justify-center bg-background gap-4"><div className="h-16 w-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div><p className="text-muted font-bold text-xs uppercase animate-pulse">Sincronizando...</p></div>;

  return (
    <div className="flex h-screen w-full flex-row overflow-hidden bg-background text-text transition-colors duration-300">
      <Sidebar currentUser={currentUser} currentView={currentView} onNavigate={v => { setCurrentView(v); setMobileMenuOpen(false); }} />
      <main className="flex flex-1 flex-col h-full relative overflow-hidden bg-background">
        <Header onMenuClick={() => setMobileMenuOpen(true)} title={currentView === View.DASHBOARD ? "Panel de Control" : currentView} subtitle="Software de Gestión Alfonsa" isDarkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(!isDarkMode)} currentUser={currentUser} onLogout={handleLogout} />
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="mx-auto max-w-7xl animate-in fade-in duration-500">
                {currentView === View.DASHBOARD && currentUser.role === 'vale' && (
                    <Dashboard orders={orders} expirations={expirations} onNavigate={setCurrentView} />
                )}
                {currentView === View.ORDERS && (
                    <OrderList onNavigate={setCurrentView} orders={orders} currentUser={currentUser} onOpenAssembly={handleOpenOrder} onDeleteOrder={id => supabase.from('orders').delete().eq('id', id).then(() => fetchAllData())} onInvoiceOrder={() => {}} />
                )}
                {currentView === View.ORDER_SHEET && (
                    <OrderSheet currentUser={currentUser} orders={orders} trips={trips} onSaveTrip={() => {}} onDeleteTrip={() => {}} />
                )}
                {currentView === View.PAYMENTS_OVERVIEW && (
                    <PaymentsOverview providers={providers} onDeleteProvider={() => {}} onUpdateProviders={() => {}} transfers={transfers} onUpdateTransfers={handleSaveTransfer} onConfirmTransfer={() => {}} />
                )}
                {currentView === View.PAYMENTS_HISTORY && (
                    <PaymentsHistory transfers={transfers} onDeleteTransfer={() => {}} onClearHistory={() => {}} onUpdateTransfers={handleSaveTransfer} onUpdateStatus={() => {}} providers={providers} />
                )}
                {currentView === View.PAYMENTS_PROVIDERS && (
                    <PaymentsProviders providers={providers} onUpdateProviders={() => {}} onDeleteProvider={() => {}} />
                )}
                {currentView === View.EXPIRATIONS && <Expirations />}
                {currentView === View.ETIQUETADOR && <Etiquetador />}
                {currentView === View.PRESUPUESTADOR && <Presupuestador />}
                {currentView === View.LISTA_CHINA && <ListaChina />}
                {currentView === View.CREATE_BUDGET && <CreateBudget onNavigate={setCurrentView} onCreateOrder={() => {}} currentUser={currentUser} />}
                {currentView === View.SQL_EDITOR && currentUser.role === 'vale' && <SqlEditor currentUser={currentUser} />}
                {currentView === View.SETTINGS && <Settings currentUser={currentUser} onUpdateProfile={handleUpdateProfile} />}
            </div>
        </div>
      </main>
      {selectedOrderForAssembly && (
          <OrderAssemblyModal 
            order={selectedOrderForAssembly} 
            currentUser={currentUser} 
            onClose={() => { releaseOccupancy(selectedOrderForAssembly.id); setSelectedOrderForAssembly(null); }} 
            onSave={() => {}}
            onUpdateProduct={(code, qty) => setSelectedOrderForAssembly(applyQuantityChange(selectedOrderForAssembly, code, qty) as DetailedOrder)}
            onToggleCheck={code => setSelectedOrderForAssembly(toggleProductCheck(selectedOrderForAssembly, code) as DetailedOrder)}
            onUpdateObservations={text => setSelectedOrderForAssembly(updateObservations(selectedOrderForAssembly, text) as DetailedOrder)}
          />
      )}
      {mobileMenuOpen && <Sidebar currentUser={currentUser} currentView={currentView} onNavigate={v => { setCurrentView(v); setMobileMenuOpen(false); }} isMobile onClose={() => setMobileMenuOpen(false)} />}
    </div>
  );
}
