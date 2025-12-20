
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
import { View, DetailedOrder, User, Trip, Provider, Transfer, OrderStatus, UserRole, ProviderAccount, TripClient, TripExpense } from './types';
import { supabase } from './supabase';
import { 
    applyQuantityChange, 
    toggleProductCheck, 
    updateObservations, 
    advanceOrderStatus,
    addProductToOrder,
    updateProductPrice,
    removeProductFromOrder,
    getMissingProducts,
    getReturnedProducts
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

        // 1. Pedidos
        const { data: dbOrders } = await supabase.from('orders').select('*, order_items(*)');
        if (dbOrders) {
            const mappedOrders: DetailedOrder[] = dbOrders.map(o => ({
                id: o.id,
                displayId: o.display_id,
                clientName: o.client_name,
                zone: o.zone,
                status: o.status as OrderStatus,
                createdDate: new Date(o.created_at).toLocaleDateString('es-AR'),
                total: parseFloat(o.total || 0),
                observations: o.observations,
                paymentMethod: o.payment_method,
                productCount: o.order_items?.length || 0,
                products: (o.order_items || []).map((item: any) => ({
                    code: item.code,
                    name: item.name,
                    originalQuantity: item.original_quantity,
                    quantity: item.quantity,
                    shippedQuantity: item.shipped_quantity,
                    unitPrice: parseFloat(item.unit_price || 0),
                    subtotal: parseFloat(item.subtotal || 0),
                    isChecked: item.is_checked
                })),
                history: []
            }));
            setOrders(mappedOrders.sort((a, b) => b.id.localeCompare(a.id)));
        }

        // 2. Proveedores
        const { data: dbProviders } = await supabase.from('providers').select('*, provider_accounts(*)');
        if (dbProviders) {
            const mappedProviders: Provider[] = dbProviders.map(p => ({
                id: p.id,
                name: p.name,
                goalAmount: parseFloat(p.goal_amount || 0),
                priority: p.priority,
                status: p.status,
                accounts: (p.provider_accounts || []).map((a: any) => ({
                    id: a.id,
                    providerId: a.provider_id,
                    condition: a.condition,
                    holder: a.holder,
                    identifierAlias: a.identifier_alias,
                    identifierCBU: a.identifier_cbu,
                    metaAmount: parseFloat(a.meta_amount || 0),
                    currentAmount: parseFloat(a.current_amount || 0),
                    pendingAmount: parseFloat(a.pending_amount || 0),
                    status: a.status
                }))
            }));
            setProviders(mappedProviders);
        }

        // 3. Transferencias
        const { data: dbTransfers } = await supabase.from('transfers').select('*');
        if (dbTransfers) {
            const mappedTransfers: Transfer[] = dbTransfers.map(t => ({
                id: t.id,
                clientName: t.client_name,
                amount: parseFloat(t.amount || 0),
                date: t.date_text,
                providerId: t.provider_id,
                accountId: t.account_id,
                notes: t.notes,
                status: t.status,
                isLoadedInSystem: t.is_loaded_in_system
            }));
            setTransfers(mappedTransfers.sort((a, b) => b.id.localeCompare(a.id)));
        }

        // 4. Viajes (Planillas)
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
                    previousBalance: parseFloat(c.previous_balance || 0),
                    currentInvoiceAmount: parseFloat(c.current_invoice_amount || 0),
                    paymentCash: parseFloat(c.payment_cash || 0),
                    paymentTransfer: parseFloat(c.payment_transfer || 0),
                    isTransferExpected: c.is_transfer_expected,
                    status: c.status
                })),
                expenses: (t.trip_expenses || []).map((e: any) => ({
                    id: e.id,
                    type: e.type,
                    amount: parseFloat(e.amount || 0),
                    note: e.note,
                    timestamp: new Date(e.timestamp)
                }))
            }));
            setTrips(mappedTrips.sort((a, b) => b.id.localeCompare(a.id)));
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

  // --- MANEJADORES DE PERSISTENCIA: VIAJES (PLANILLAS) ---

  const handleSaveTrip = async (trip: Trip) => {
    try {
        const isTemporaryId = !trip.id || trip.id.toString().startsWith('trip-');
        
        const tPayload: any = {
            display_id: trip.displayId,
            name: trip.name,
            status: trip.status,
            driver_name: trip.driverName,
            date_text: trip.date,
            route: trip.route
        };

        // Si ya tenemos un ID real (UUID), lo incluimos para que sea un UPDATE
        if (!isTemporaryId) {
            tPayload.id = trip.id;
        }

        // Usamos onConflict: 'display_id' por seguridad si el UUID no está sincronizado
        const { data: tData, error: tError } = await supabase
            .from('trips')
            .upsert(tPayload, { onConflict: 'display_id' })
            .select()
            .single();

        if (tError) throw tError;
        const tripId = tData.id;

        // Limpieza atómica de sub-tablas para evitar duplicados en actualizaciones
        await supabase.from('trip_clients').delete().eq('trip_id', tripId);
        await supabase.from('trip_expenses').delete().eq('trip_id', tripId);

        // Re-inserción de Clientes
        if (trip.clients && trip.clients.length > 0) {
            const cPayload = trip.clients.map(c => ({
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
            const { error: cError } = await supabase.from('trip_clients').insert(cPayload);
            if (cError) throw cError;
        }

        // Re-inserción de Gastos
        if (trip.expenses && trip.expenses.length > 0) {
            const ePayload = trip.expenses.map(e => ({
                trip_id: tripId,
                type: e.type,
                amount: e.amount,
                note: e.note,
                timestamp: e.timestamp.toISOString()
            }));
            const { error: eError } = await supabase.from('trip_expenses').insert(ePayload);
            if (eError) throw eError;
        }

        await fetchAllData();
    } catch (err) {
        console.error("Error guardando viaje online:", err);
        alert("No se pudo guardar la planilla online. Verifique su conexión o intente nuevamente.");
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    try {
        if (tripId.startsWith('trip-')) {
            setTrips(prev => prev.filter(t => t.id !== tripId));
            return;
        }
        const { error } = await supabase.from('trips').delete().eq('id', tripId);
        if (error) throw error;
        await fetchAllData();
    } catch (err) {
        console.error("Error eliminando viaje:", err);
    }
  };

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
        if (providerId.startsWith('p-')) {
            await fetchAllData();
            return;
        }
        const { error } = await supabase.from('providers').delete().eq('id', providerId);
        if (error) throw error;
        await fetchAllData();
    } catch (err: any) {
        console.error("Error eliminando proveedor:", err);
        alert("No se pudo eliminar el proveedor. Verifique si tiene pagos asociados.");
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

        if (!isNewId) {
            payload.id = transfer.id;
        }

        const { error: tError } = await supabase.from('transfers').upsert([payload]);
        if (tError) throw tError;

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
        if(!confirm("¿Desea vaciar todo el historial de transferencias?")) return;
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

      const missing = getMissingProducts(order);
      const returned = getReturnedProducts(order);

      const html = `
        <html>
            <head>
                <title>Factura - ${order.clientName}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
                    .header { border-bottom: 3px solid #e47c00; padding-bottom: 20px; margin-bottom: 30px; }
                    .header h1 { margin: 0; font-size: 28px; color: #e47c00; font-weight: 900; }
                    .info { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 20px; }
                    .info b { color: #64748b; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
                    th { text-align: left; background: #f8fafc; padding: 12px 10px; border-bottom: 2px solid #e2e8f0; color: #64748b; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; }
                    td { padding: 12px 10px; border-bottom: 1px solid #f1f5f9; }
                    .section-title { margin-top: 30px; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; display: flex; align-items: center; gap: 8px; }
                    .section-missing { color: #ef4444; border-bottom: 1px solid #fee2e2; padding-bottom: 5px; }
                    .section-returned { color: #3b82f6; border-bottom: 1px solid #dbeafe; padding-bottom: 5px; }
                    .total-box { margin-top: 40px; border-top: 2px solid #e2e8f0; padding-top: 20px; text-align: right; }
                    .total-row { display: flex; justify-content: flex-end; gap: 20px; align-items: center; margin-bottom: 5px; }
                    .total-label { font-weight: bold; color: #64748b; font-size: 14px; }
                    .total-value { font-size: 24px; font-weight: 900; color: #16a34a; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>ALFONSA DISTRIBUIDORA</h1>
                    <div class="info">
                        <div>
                            <p><b>Cliente:</b> ${order.clientName}</p>
                            <p><b>ID Pedido:</b> ${order.displayId}</p>
                        </div>
                        <div style="text-align: right;">
                            <p><b>Fecha:</b> ${order.createdDate}</p>
                            <p><b>Zona:</b> ${order.zone || 'N/A'}</p>
                        </div>
                    </div>
                </div>

                <div class="section-title">Productos Entregados</div>
                <table>
                    <thead>
                        <tr>
                            <th>Cód.</th>
                            <th>Artículo</th>
                            <th style="text-align: center;">Cant.</th>
                            <th style="text-align: right;">P. Unit</th>
                            <th style="text-align: right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${order.products.map(p => `
                            <tr>
                                <td>${p.code}</td>
                                <td>${p.name}</td>
                                <td style="text-align: center;">${p.quantity}</td>
                                <td style="text-align: right;">$${p.unitPrice.toLocaleString('es-AR')}</td>
                                <td style="text-align: right;">$${p.subtotal.toLocaleString('es-AR')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                ${missing.length > 0 ? `
                    <div class="section-title section-missing">⚠️ Faltantes de Stock (No enviados)</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Cód.</th>
                                <th>Artículo</th>
                                <th style="text-align: center;">Original</th>
                                <th style="text-align: center;">Faltó</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${missing.map(p => `
                                <tr>
                                    <td>${p.code}</td>
                                    <td>${p.name}</td>
                                    <td style="text-align: center;">${p.originalQuantity}</td>
                                    <td style="text-align: center; color: #ef4444; font-weight: bold;">${p.originalQuantity - (p.shippedQuantity ?? p.quantity)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : ''}

                ${returned.length > 0 ? `
                    <div class="section-title section-returned">🔄 Devoluciones Realizadas</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Cód.</th>
                                <th>Artículo</th>
                                <th style="text-align: center;">Enviado</th>
                                <th style="text-align: center;">Devuelto</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${returned.map(p => `
                                <tr>
                                    <td>${p.code}</td>
                                    <td>${p.name}</td>
                                    <td style="text-align: center;">${p.shippedQuantity}</td>
                                    <td style="text-align: center; color: #3b82f6; font-weight: bold;">${p.returnedAmount}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : ''}

                <div class="total-box">
                    <div class="total-row">
                        <span class="total-label">TOTAL FINAL A PAGAR:</span>
                        <span class="total-value">$${order.total.toLocaleString('es-AR')}</span>
                    </div>
                    <p style="font-size: 10px; color: #94a3b8; margin-top: 10px;">Comprobante de uso interno - Alfonsa Distribuidora</p>
                </div>
            </body>
        </html>`;
      
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
                    <OrderSheet currentUser={currentUser} orders={orders} trips={trips} onSaveTrip={handleSaveTrip} onDeleteTrip={handleDeleteTrip} />
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
          <OrderAssemblyModal 
            order={selectedOrderForAssembly} 
            currentUser={currentUser} 
            onClose={() => setSelectedOrderForAssembly(null)} 
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
            onDeleteOrder={id => supabase.from('orders').delete().eq('id', id).then(() => fetchAllData())} 
            onInvoice={handleInvoiceOrder} 
            onReprint={() => handlePrintOrder(selectedOrderForAssembly)}
          />
      )}
      {mobileMenuOpen && <Sidebar currentView={currentView} onNavigate={v => { setCurrentView(v); setMobileMenuOpen(false); }} isMobile onClose={() => setMobileMenuOpen(false)} />}
    </div>
  );
}