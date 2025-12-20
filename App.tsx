
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './views/Dashboard';
import { OrderList } from './views/OrderList';
import { OrderSheet } from './views/OrderSheet';
import { CreateBudget } from './views/CreateBudget';
import { SqlEditor } from './views/SqlEditor';
import { PaymentsOverview } from './views/PaymentsOverview';
import { PaymentsHistory } from './views/PaymentsHistory';
import { PaymentsProviders } from './views/PaymentsProviders'; 
import { Login } from './views/Login';
import { OrderAssemblyModal } from './components/OrderAssemblyModal';
import { View, DetailedOrder, User, Trip, Provider, Transfer, OrderStatus, UserRole, ProviderAccount } from './types';
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
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  // --- ESTADOS DE DATOS ---
  const [orders, setOrders] = useState<DetailedOrder[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [selectedOrderForAssembly, setSelectedOrderForAssembly] = useState<DetailedOrder | null>(null);

  // --- ESCUCHAR AUTENTICACIÓN ---
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
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (data) {
        setCurrentUser({ id: data.id, name: data.name, role: data.role as UserRole });
      }
    } catch (err) {
      console.error("Error cargando perfil:", err);
    } finally {
      setIsAuthChecking(false);
    }
  };

  // --- SINCRONIZACIÓN DE DATOS ---
  const fetchAllData = async () => {
    if (!currentUser) return;
    try {
        setIsDataLoading(true);

        const { data: dbOrders } = await supabase.from('orders').select('*, order_items(*)');
        if (dbOrders) {
            const mappedOrders: DetailedOrder[] = dbOrders.map(o => ({
                id: o.id,
                displayId: o.display_id,
                clientName: o.client_name,
                zone: o.zone,
                status: o.status as OrderStatus,
                createdDate: new Date(o.created_at).toLocaleDateString('es-AR'),
                total: parseFloat(o.total),
                observations: o.observations,
                paymentMethod: o.payment_method,
                productCount: o.order_items?.length || 0,
                products: (o.order_items || []).map((item: any) => ({
                    code: item.code,
                    name: item.name,
                    originalQuantity: item.original_quantity,
                    quantity: item.quantity,
                    shippedQuantity: item.shipped_quantity,
                    unitPrice: parseFloat(item.unit_price),
                    subtotal: parseFloat(item.subtotal),
                    isChecked: item.is_checked
                })),
                history: []
            }));
            setOrders(mappedOrders.sort((a, b) => b.id.localeCompare(a.id)));
        }

        const { data: dbProviders } = await supabase.from('providers').select('*, provider_accounts(*)');
        if (dbProviders) {
            const mappedProviders: Provider[] = dbProviders.map(p => ({
                id: p.id,
                name: p.name,
                goalAmount: parseFloat(p.goal_amount),
                priority: p.priority,
                status: p.status,
                accounts: (p.provider_accounts || []).map((a: any) => ({
                    id: a.id,
                    providerId: a.provider_id,
                    condition: a.condition,
                    holder: a.holder,
                    identifierAlias: a.identifier_alias,
                    identifierCBU: a.identifier_cbu,
                    metaAmount: parseFloat(a.meta_amount),
                    currentAmount: parseFloat(a.current_amount),
                    pendingAmount: parseFloat(a.pending_amount),
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
                amount: parseFloat(t.amount),
                date: t.date_text,
                providerId: t.provider_id,
                accountId: t.account_id,
                notes: t.notes,
                status: t.status,
                isLoadedInSystem: t.is_loaded_in_system
            }));
            setTransfers(mappedTransfers.sort((a, b) => b.id.localeCompare(a.id)));
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

  // --- MANEJADORES DE PERSISTENCIA: PAGOS Y PROVEEDORES ---
  
  const handleSaveProvider = async (provider: Provider) => {
    try {
        const isNewProvider = !provider.id || provider.id.toString().startsWith('p-');
        const pPayload: any = {
            name: provider.name,
            goal_amount: provider.goalAmount,
            priority: provider.priority,
            status: provider.status
        };
        if (!isNewProvider) pPayload.id = provider.id;

        const { data: pData, error: pError } = await supabase.from('providers').upsert(pPayload).select().single();
        if (pError) throw pError;

        const providerId = pData.id;
        
        if (!isNewProvider) {
            const { data: existingAccounts } = await supabase.from('provider_accounts').select('id').eq('provider_id', providerId);
            const dbIds = (existingAccounts || []).map(a => a.id);
            const uiIds = provider.accounts.filter(a => !a.id.startsWith('acc-')).map(a => a.id);
            const idsToDelete = dbIds.filter(id => !uiIds.includes(id));
            if (idsToDelete.length > 0) {
                await supabase.from('provider_accounts').delete().in('id', idsToDelete);
            }
        }

        if (provider.accounts && provider.accounts.length > 0) {
            const accountsToSave = provider.accounts.map(acc => {
                const accPayload: any = {
                    provider_id: providerId,
                    condition: acc.condition,
                    holder: acc.holder,
                    identifier_alias: acc.identifierAlias,
                    identifier_cbu: acc.identifierCBU,
                    meta_amount: acc.metaAmount,
                    current_amount: acc.currentAmount,
                    pending_amount: acc.pendingAmount,
                    status: acc.status
                };
                if (!acc.id.startsWith('acc-')) accPayload.id = acc.id;
                return accPayload;
            });
            await supabase.from('provider_accounts').upsert(accountsToSave);
        }
        await fetchAllData();
    } catch (err) {
        console.error("Error guardando proveedor:", err);
    }
  };

  const handleDeleteProvider = async (providerId: string) => {
    try {
        // Si el ID es temporal (comienza con p-), solo refrescamos la UI localmente
        if (providerId.startsWith('p-')) {
            await fetchAllData();
            return;
        }
        const { error } = await supabase.from('providers').delete().eq('id', providerId);
        if (error) {
            // Manejo legible de errores de Supabase
            const msg = error.message || "Error desconocido";
            const detail = error.details || "";
            alert(`No se pudo eliminar: ${msg}. ${detail}`);
            return;
        }
        await fetchAllData();
    } catch (err: any) {
        console.error("Error eliminando proveedor:", err);
        alert("Ocurrió un error inesperado al intentar eliminar el proveedor.");
    }
  };

  const handleSaveTransfer = async (transfer: Transfer) => {
    try {
        const isNewId = transfer.id.toString().startsWith('t-');
        const payload: any = {
            client_name: transfer.clientName,
            amount: transfer.amount,
            date_text: transfer.date,
            provider_id: transfer.providerId,
            account_id: transfer.accountId,
            notes: transfer.notes,
            status: transfer.status,
            is_loaded_in_system: transfer.isLoadedInSystem
        };

        // Si NO es un ID temporal, incluimos el ID para que UPSERT actualice en lugar de insertar
        if (!isNewId) {
            payload.id = transfer.id;
        }

        const { error: tError } = await supabase.from('transfers').upsert([payload]);
        if (tError) throw tError;

        // Solo actualizar balances si es una creación nueva real (ID temporal)
        if (isNewId) {
            const account = providers.flatMap(p => p.accounts).find(a => a.id === transfer.accountId);
            if (account) {
                const update: any = {};
                if (transfer.status === 'Realizado') update.current_amount = account.currentAmount + transfer.amount;
                else update.pending_amount = account.pendingAmount + transfer.amount;
                await supabase.from('provider_accounts').update(update).eq('id', transfer.accountId);
            }
        }
        
        await fetchAllData();
    } catch (err) {
        console.error("Error operando sobre transferencia:", err);
    }
  };

  const handleDeleteTransfer = async (transferId: string) => {
    try {
        if (transferId.startsWith('t-')) {
            await fetchAllData();
            return;
        }
        const { error } = await supabase.from('transfers').delete().eq('id', transferId);
        if (error) throw error;
        await fetchAllData();
    } catch (err) {
        console.error("Error eliminando transferencia:", err);
    }
  };

  const handleClearHistory = async () => {
    try {
        // Borramos todos los registros. Usamos un filtro dummy que siempre se cumpla.
        const { error } = await supabase.from('transfers').delete().not('id', 'is', null);
        if (error) throw error;
        await fetchAllData();
    } catch (err) {
        console.error("Error limpiando historial:", err);
    }
  };

  const handleUpdateTransferStatus = async (transferId: string, newStatus: 'Pendiente' | 'Realizado') => {
    try {
        if (transferId.startsWith('t-')) return;

        const transfer = transfers.find(t => t.id === transferId);
        if (!transfer || transfer.status === newStatus) return;

        const { error: tError } = await supabase.from('transfers').update({ status: newStatus }).eq('id', transferId);
        if (tError) throw tError;

        const account = providers.flatMap(p => p.accounts).find(a => a.id === transfer.accountId);
        if (account) {
            const update: any = {};
            if (newStatus === 'Realizado') {
                update.pending_amount = Math.max(0, account.pendingAmount - transfer.amount);
                update.current_amount = account.currentAmount + transfer.amount;
            } else {
                update.current_amount = Math.max(0, account.currentAmount - transfer.amount);
                update.pending_amount = account.pendingAmount + transfer.amount;
            }
            await supabase.from('provider_accounts').update(update).eq('id', transfer.accountId);
        }
        await fetchAllData();
    } catch (err) {
        console.error("Error actualizando estado de transferencia:", err);
    }
  };

  // --- MANEJADORES DE EVENTOS: PEDIDOS ---

  const handleCreateOrder = async (newOrder: DetailedOrder) => {
    if (!currentUser) return;
    try {
        const { data: dbOrder } = await supabase
            .from('orders')
            .insert([{
                display_id: newOrder.displayId,
                client_name: newOrder.clientName,
                zone: newOrder.zone,
                status: newOrder.status,
                total: newOrder.total,
                observations: newOrder.observations,
                payment_method: newOrder.paymentMethod || 'Pendiente'
            }])
            .select().single();

        if (dbOrder && newOrder.products.length > 0) {
            const items = newOrder.products.map(p => ({
                order_id: dbOrder.id,
                code: p.code,
                name: p.name,
                original_quantity: p.originalQuantity,
                quantity: p.quantity,
                unit_price: p.unitPrice,
                subtotal: p.subtotal,
                is_checked: p.isChecked
            }));
            await supabase.from('order_items').insert(items);
        }
        fetchAllData();
    } catch (e) {
        console.error("Error creando pedido:", e);
    }
  };

  const handleInvoiceOrder = async (order: DetailedOrder) => {
    if (!currentUser) return;
    const updatedOrder = advanceOrderStatus(order, currentUser) as DetailedOrder;
    const updatePayload: any = { status: updatedOrder.status };
    const { error } = await supabase.from('orders').update(updatePayload).eq('id', updatedOrder.id);
    
    if (!error) {
        if (updatedOrder.status === OrderStatus.EN_TRANSITO) {
            const itemUpdates = updatedOrder.products.map(p => 
                supabase.from('order_items').update({ shipped_quantity: p.shippedQuantity }).eq('order_id', updatedOrder.id).eq('code', p.code)
            );
            await Promise.all(itemUpdates);
        }
        fetchAllData();
        if (selectedOrderForAssembly?.id === updatedOrder.id) setSelectedOrderForAssembly(updatedOrder);
    }
  };

  const handlePrintOrder = (order: DetailedOrder) => {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      const html = `<html><head><title>Comprobante</title><style>body{font-family:sans-serif;padding:40px;color:#333}table{width:100%;border-collapse:collapse;margin-top:20px}th{text-align:left;background:#f9f9f9;padding:10px;border-bottom:2px solid #eee}td{padding:10px;border-bottom:1px solid #eee}.total{text-align:right;font-size:20px;font-weight:bold;margin-top:30px}</style></head><body><h1>ALFONSA DISTRIBUIDORA</h1><p>${order.clientName} | ${order.displayId}</p><table><thead><tr><th>Cód.</th><th>Artículo</th><th>Cant.</th><th>Sub.</th></tr></thead><tbody>${order.products.map(p => `<tr><td>${p.code}</td><td>${p.name}</td><td>${p.quantity}</td><td>$${p.subtotal.toLocaleString()}</td></tr>`).join('')}</tbody></table><div class="total">TOTAL: $${order.total.toLocaleString()}</div></body></html>`;
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  const toggleTheme = () => setIsDarkMode(!isDarkMode);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  if (isAuthChecking) return <div className="h-screen w-full flex flex-col items-center justify-center bg-background gap-4"><div className="h-16 w-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div><p className="text-muted font-bold text-xs uppercase animate-pulse">Cargando...</p></div>;
  if (!currentUser) return <Login isDarkMode={isDarkMode} onToggleTheme={toggleTheme} />;
  if (isDataLoading) return <div className="h-screen w-full flex flex-col items-center justify-center bg-background gap-4"><div className="h-16 w-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div><p className="text-muted font-bold text-xs uppercase animate-pulse">Sincronizando...</p></div>;

  return (
    <div className="flex h-screen w-full flex-row overflow-hidden bg-background text-text transition-colors duration-300">
      <Sidebar currentView={currentView} onNavigate={v => { setCurrentView(v); setMobileMenuOpen(false); }} />
      
      <main className="flex flex-1 flex-col h-full relative overflow-hidden bg-background">
        <Header onMenuClick={() => setMobileMenuOpen(true)} title={currentView === View.DASHBOARD ? "Panel de Control" : currentView} subtitle="Software de Gestión Alfonsa" isDarkMode={isDarkMode} onToggleTheme={toggleTheme} currentUser={currentUser} onLogout={handleLogout} />
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="mx-auto max-w-7xl animate-in fade-in duration-500">
                {currentView === View.DASHBOARD && <Dashboard />}
                {currentView === View.ORDERS && (
                    <OrderList onNavigate={setCurrentView} orders={orders} currentUser={currentUser} onOpenAssembly={setSelectedOrderForAssembly} onDeleteOrder={id => supabase.from('orders').delete().eq('id', id).then(() => fetchAllData())} onInvoiceOrder={handleInvoiceOrder} />
                )}
                {currentView === View.ORDER_SHEET && (
                    <OrderSheet currentUser={currentUser} orders={orders} trips={trips} onSaveTrip={t => setTrips(prev => {
                        const exists = prev.find(item => item.id === t.id);
                        if (exists) return prev.map(item => item.id === t.id ? t : item);
                        return [t, ...prev];
                    })} onDeleteTrip={id => setTrips(prev => prev.filter(t => t.id !== id))} />
                )}
                {currentView === View.PAYMENTS_OVERVIEW && (
                    <PaymentsOverview providers={providers} onDeleteProvider={handleDeleteProvider} onUpdateProviders={handleSaveProvider} transfers={transfers} onUpdateTransfers={handleSaveTransfer} onConfirmTransfer={handleUpdateTransferStatus} />
                )}
                {currentView === View.PAYMENTS_HISTORY && (
                    <PaymentsHistory transfers={transfers} onDeleteTransfer={handleDeleteTransfer} onClearHistory={handleClearHistory} onUpdateTransfers={handleSaveTransfer} onUpdateStatus={handleUpdateTransferStatus} providers={providers} />
                )}
                {currentView === View.PAYMENTS_PROVIDERS && (
                    <PaymentsProviders providers={providers} onUpdateProviders={handleSaveProvider} onDeleteProvider={handleDeleteProvider} />
                )}
                {currentView === View.CREATE_BUDGET && <CreateBudget onNavigate={setCurrentView} onCreateOrder={handleCreateOrder} currentUser={currentUser} />}
                {currentView === View.SQL_EDITOR && <SqlEditor currentUser={currentUser} />}
            </div>
        </div>
      </main>

      {selectedOrderForAssembly && (
          <OrderAssemblyModal order={selectedOrderForAssembly} currentUser={currentUser} onClose={() => setSelectedOrderForAssembly(null)} 
            onSave={async (order, advance) => {
                if (advance) await handleInvoiceOrder(order as DetailedOrder);
                else {
                    await supabase.from('orders').update({ observations: order.observations, payment_method: order.paymentMethod, total: order.total }).eq('id', order.id);
                    const itemUpdates = order.products.map(p => supabase.from('order_items').update({ quantity: p.quantity, is_checked: p.isChecked, unit_price: p.unitPrice, subtotal: p.subtotal }).eq('order_id', order.id).eq('code', p.code));
                    await Promise.all(itemUpdates);
                    fetchAllData();
                }
                setSelectedOrderForAssembly(null);
            }}
            onUpdateProduct={(code, qty) => setSelectedOrderForAssembly(applyQuantityChange(selectedOrderForAssembly, code, qty) as DetailedOrder)}
            onToggleCheck={code => setSelectedOrderForAssembly(toggleProductCheck(selectedOrderForAssembly, code) as DetailedOrder)}
            onUpdateObservations={text => setSelectedOrderForAssembly(updateObservations(selectedOrderForAssembly, text) as DetailedOrder)}
            onAddProduct={p => setSelectedOrderForAssembly(addProductToOrder(selectedOrderForAssembly, p) as DetailedOrder)}
            onUpdatePrice={(code, price) => setSelectedOrderForAssembly(updateProductPrice(selectedOrderForAssembly, code, price) as DetailedOrder)}
            onRemoveProduct={code => setSelectedOrderForAssembly(removeProductFromOrder(selectedOrderForAssembly, code) as DetailedOrder)}
            onDeleteOrder={id => supabase.from('orders').delete().eq('id', id).then(() => fetchAllData())} onInvoice={handleInvoiceOrder} onReprint={() => handlePrintOrder(selectedOrderForAssembly)}
          />
      )}
      {mobileMenuOpen && <Sidebar currentView={currentView} onNavigate={v => { setCurrentView(v); setMobileMenuOpen(false); }} isMobile onClose={() => setMobileMenuOpen(false)} />}
    </div>
  );
}
