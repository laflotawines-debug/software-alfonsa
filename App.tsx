
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Login } from './views/Login';
import { Dashboard } from './views/Dashboard';
import { MetricsReplenishment } from './views/MetricsReplenishment';
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
import { StockQueryModal } from './components/StockQueryModal';
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
    updatePaymentMethod,
    toggleAllProductsCheck
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
    
    // Dialog state for custom alerts/confirms
    const [dialogState, setDialogState] = useState<{ isOpen: boolean, title: string, message: string | React.ReactNode, type: 'alert' | 'confirm', onConfirm?: () => void }>({ isOpen: false, title: '', message: '', type: 'alert' });
    const showDialog = (title: string, message: string | React.ReactNode, type: 'alert' | 'confirm' = 'alert', onConfirm?: () => void) => {
        setDialogState({ isOpen: true, title, message, type, onConfirm });
    };
    
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

    const [isStockQueryOpen, setIsStockQueryOpen] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (error) {
                console.warn('Auth session error:', error.message);
                setSession(null);
                setCurrentUser(null);
            } else {
                setSession(session);
                if (session) fetchProfile(session.user.id);
            }
        }).catch(err => {
            console.warn('Auth session catch error:', err);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                setSession(null);
                setCurrentUser(null);
            } else {
                setSession(session);
                if (session) fetchProfile(session.user.id);
                else setCurrentUser(null);
            }
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

    // F12 key listener for Stock Query
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F12') {
                if (currentUser && hasPermission(currentUser, 'global.stock_queries')) {
                    e.preventDefault();
                    setIsStockQueryOpen(prev => !prev);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentUser]);

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
            isInterdeposito: o.is_interdeposito,
            interdepositoOrigin: o.interdeposito_origin,
            interdepositoDestination: o.interdeposito_destination,
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

    // Audio Context Management
    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
    const [isAudioEnabled, setIsAudioEnabled] = useState(false);
    const [isMuted, setIsMuted] = useState(() => {
        return localStorage.getItem('alfonsa_is_muted') === 'true';
    });

    const toggleMute = () => {
        const newState = !isMuted;
        setIsMuted(newState);
        localStorage.setItem('alfonsa_is_muted', String(newState));
    };

    const requestNotificationPermission = () => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    };

    const initAudio = useCallback(() => {
        requestNotificationPermission();
        if (!audioContext) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                const ctx = new AudioContextClass();
                setAudioContext(ctx);
                setIsAudioEnabled(true);
            }
        } else if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => setIsAudioEnabled(true));
        } else {
            setIsAudioEnabled(true);
        }
    }, [audioContext]);

    useEffect(() => {
        document.addEventListener('click', initAudio);
        document.addEventListener('touchstart', initAudio); // Add touch support for mobile
        return () => {
            document.removeEventListener('click', initAudio);
            document.removeEventListener('touchstart', initAudio);
        };
    }, [initAudio]);

    const playNotificationSound = useCallback((currentNotifications?: AppNotification[], force = false) => {
        if (!audioContext || isMuted) return;
        
        const targetNotifications = currentNotifications || notifications;
        const unread = targetNotifications.filter(n => !n.is_read);
        
        if (unread.length === 0 && !force) return;

        // Logic to limit plays (Max 2 times per notification batch)
        if (!force) {
            const latestId = unread[0]?.id || 'unknown';
            const storedId = localStorage.getItem('last_sound_notification_id');
            const storedCount = parseInt(localStorage.getItem('last_sound_notification_count') || '0');

            if (storedId === latestId) {
                if (storedCount >= 2) return; // Max 2 times
                localStorage.setItem('last_sound_notification_count', (storedCount + 1).toString());
            } else {
                localStorage.setItem('last_sound_notification_id', latestId);
                localStorage.setItem('last_sound_notification_count', '1');
            }
        }

        try {
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }

            const now = audioContext.currentTime;
            
            // Single subtle beep
            const osc1 = audioContext.createOscillator();
            const gain1 = audioContext.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(880, now);
            osc1.frequency.exponentialRampToValueAtTime(440, now + 0.15);
            gain1.gain.setValueAtTime(0.1, now); // Lower volume for subtlety
            gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc1.connect(gain1);
            gain1.connect(audioContext.destination);
            osc1.start(now);
            osc1.stop(now + 0.15);

        } catch (e) {
            console.error("Audio play failed", e);
        }
    }, [audioContext, notifications, isMuted]);

    const fetchNotifications = async () => {
        if (!currentUser) return;
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (data) {
            setNotifications(data);
            // Check for unread notifications and play sound if any exist
            const hasUnread = data.some(n => !n.is_read);
            if (hasUnread) {
                playNotificationSound(data);
            }
        }
    };

    // Play sound on first user interaction if there are unread notifications
    useEffect(() => {
        if (isAudioEnabled && notifications.some(n => !n.is_read)) {
            // Use a small timeout to ensure context is fully ready
            setTimeout(() => {
                playNotificationSound(notifications);
            }, 100);
        }
    }, [isAudioEnabled]); // Removed notifications from dependency to avoid loop

    useEffect(() => {
        if (!currentUser) return;

        console.log("Subscribing to notifications for user:", currentUser.id);
        const channel = supabase
            .channel('public:notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${currentUser.id}`
                },
                (payload) => {
                    console.log("New notification received:", payload);
                    const newNotification = payload.new as AppNotification;
                    setNotifications(prev => {
                        const updated = [newNotification, ...prev];
                        playNotificationSound(updated);
                        return updated;
                    });
                    
                    // System Notification (Background)
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification('Alfonsa Management', {
                            body: newNotification.message,
                            icon: '/vite.svg' // Fallback icon
                        });
                    }
                }
            )
            .subscribe((status) => {
                console.log("Notification subscription status:", status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser, playNotificationSound]);

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
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    };
    const clearNotifications = async () => { 
        if(!currentUser) return;
        await supabase.from('notifications').delete().eq('user_id', currentUser.id);
        setNotifications([]); 
    };
    const handleNotificationClick = async (n: AppNotification) => { 
        // 1. Marcar como leída en la DB
        if (!n.is_read) {
            await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
            setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, is_read: true } : item));
        }

        const msg = n.message.toLowerCase();

        // 2. Navegación según contenido
        if (msg.includes('ingreso')) {
            setCurrentView(View.INV_INBOUNDS);
        } else if (msg.includes('comentario')) {
            setCurrentView(View.ANOTACIONES);
        } else if (msg.includes('pedido') || msg.includes('facturar') || msg.includes('controlado')) {
            setCurrentView(View.ORDERS);
            
            // Si tiene link_id, intentamos abrir ese pedido
            if (n.link_id) {
                // Buscamos el pedido en el estado actual
                const order = orders.find(o => o.id === n.link_id);
                if (order) {
                    setActiveOrder(order);
                } else {
                    // Si no está en el estado (quizás no es "activo"), 
                    // podríamos intentar buscarlo en la DB pero por ahora 
                    // al menos llevamos a la vista de pedidos.
                    console.log("Pedido no encontrado en estado local:", n.link_id);
                }
            }
        }
    };
    
    const sendNotificationToRole = async (role: 'vale' | 'armador', message: string, linkId?: string) => {
        try {
            const { data: users } = await supabase
                .from('profiles')
                .select('id')
                .eq('role', role);
            
            if (!users || users.length === 0) return;

            const notifications = users.map(u => ({
                user_id: u.id,
                message,
                type: 'info',
                link_id: linkId,
                is_read: false
            }));

            await supabase.from('notifications').insert(notifications);
        } catch (error) {
            console.error("Error sending notifications:", error);
        }
    };

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

    const handleAdvanceOrder = async (o: DetailedOrder, notes?: string) => {
        const next = advanceOrderStatus(o);
        
        if (next.status === OrderStatus.FACTURADO) {
            let clientCode = '';
            
            // Check if client exists - BYPASS for inter-depot movements
            if (!o.isInterdeposito) {
                const { data: clients, error: clientErr } = await supabase
                    .from('clients_master')
                    .select('*')
                    .eq('nombre', o.clientName);
                
                if (clientErr || !clients || clients.length === 0) {
                    showDialog("Error de Facturación", `El cliente '${o.clientName}' no existe en el maestro de clientes. No se puede facturar.`, 'alert');
                    return;
                }
                clientCode = clients[0].codigo;
            }
            
            // Check for negative stock
            const itemsJson = o.products.map(p => ({ codart: p.code, qty: p.shippedQuantity ?? p.quantity }));
            
            // SIEMPRE se descuenta de LLERENA, tanto para pedidos normales como para el origen de interdepósito
            const warehouseToCheck = 'LLERENA';

            const { data: products, error: prodErr } = await supabase
                .from('master_products')
                .select('codart, desart, stock_llerena, stock_betbeder')
                .in('codart', itemsJson.map(i => i.codart));
                
            if (prodErr) {
                showDialog("Error", "Error al verificar stock: " + prodErr.message, 'alert');
                return;
            }
            
            const negativeStockItems = [];
            for (const item of itemsJson) {
                const prod = products?.find(p => p.codart === item.codart);
                if (prod) {
                    const currentStock = warehouseToCheck === 'LLERENA' ? (prod.stock_llerena || 0) : (prod.stock_betbeder || 0);
                    if (currentStock - item.qty < 0) {
                        negativeStockItems.push(`• ${prod.desart} (Stock actual: ${currentStock}, A descontar: ${item.qty})`);
                    }
                }
            }
            
            const executeFacturacion = async () => {
                if (o.isInterdeposito) {
                    // For inter-depot movements, we call transferir_stock instead of facturar_pedido
                    const { error: transferErr } = await supabase.rpc('transferir_stock', {
                        p_origin: 'LLERENA',
                        p_destination: 'BETBEDER',
                        p_items: itemsJson,
                        p_reference_code: o.displayId,
                        p_user_id: currentUser?.id
                    });
                    
                    if (transferErr) {
                        showDialog("Error", "Error al transferir stock interdepósito: " + transferErr.message, 'alert');
                        return;
                    }
                    
                    showDialog("Éxito", "Movimiento interdepósito procesado correctamente.", 'alert');
                } else {
                    // Call facturar_pedido for regular orders
                    const { data: facturarData, error: facturarErr } = await supabase.rpc('facturar_pedido', {
                        p_order_id: o.id,
                        p_client_code: clientCode,
                        p_user_id: currentUser?.id,
                        p_warehouse_id: warehouseToCheck
                    });
                    
                    if (facturarErr) {
                        showDialog("Error", "Error en facturación transaccional: " + facturarErr.message, 'alert');
                        return;
                    }
                    
                    showDialog("Éxito", "Pedido facturado exitosamente. Comprobante: " + facturarData.invoice_number, 'alert');
                }
                
                // Manual status update since we are in a callback and the main function returned
                const historyEntry = {
                    timestamp: new Date().toISOString(),
                    userId: currentUser?.id,
                    userName: currentUser?.name,
                    action: 'ADVANCE_STATUS',
                    previousState: o.status,
                    newState: next.status,
                    details: notes || 'Facturación procesada'
                };
                const newHistory = [...(o.history || []), historyEntry];
                await supabase.from('orders').update({ status: next.status, history: newHistory }).eq('id', o.id);
                fetchActiveOrders();
            };

            if (negativeStockItems.length > 0) {
                const message = (
                    <div className="flex flex-col gap-2">
                        <p><strong>ADVERTENCIA:</strong> Los siguientes productos quedarán con stock negativo en {warehouseToCheck}:</p>
                        <ul className="text-sm text-red-500 font-mono bg-red-50 p-2 rounded-md max-h-40 overflow-y-auto">
                            {negativeStockItems.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                        <p>¿Desea continuar con la {o.isInterdeposito ? 'transferencia' : 'facturación'} de todas formas?</p>
                    </div>
                );
                showDialog("Advertencia de Stock", message, 'confirm', executeFacturacion);
                return;
            } else {
                showDialog(
                    o.isInterdeposito ? "Confirmar Transferencia" : "Confirmar Facturación", 
                    o.isInterdeposito 
                        ? `¿Desea procesar el movimiento interdepósito ${o.displayId} desde ${o.interdepositoOrigin} hacia ${o.interdepositoDestination}?`
                        : `¿Desea facturar el pedido de ${o.clientName} por un total de $${o.total}?`, 
                    'confirm', 
                    executeFacturacion
                );
                return;
            }
        }

        // Remove the transferir_stock call from ENTREGADO block as it's now handled in FACTURADO
        // if (next.status === OrderStatus.ENTREGADO && o.isInterdeposito) { ... }

        const historyEntry = {
            timestamp: new Date().toISOString(),
            userId: currentUser?.id,
            userName: currentUser?.name,
            action: 'ADVANCE_STATUS',
            previousState: o.status,
            newState: next.status,
            details: notes || 'Avance de estado'
        };
        const newHistory = [...(o.history || []), historyEntry];

        await supabase.from('orders').update({ status: next.status, history: newHistory }).eq('id', o.id);
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

        const { data: existingAccounts } = await supabase.from('provider_accounts').select('id').eq('provider_id', providerId);
        const existingIds = existingAccounts?.map(a => a.id) || [];
        
        const accountsToKeep = p.accounts.filter(a => !a.id.startsWith('acc-'));
        const accountIdsToKeep = accountsToKeep.map(a => a.id);
        
        const accountsToDelete = existingIds.filter(id => !accountIdsToKeep.includes(id));
        
        if (accountsToDelete.length > 0) {
            await supabase.from('provider_accounts').delete().in('id', accountsToDelete);
        }

        const newAccounts = p.accounts.filter(a => a.id.startsWith('acc-')).map(a => ({
            provider_id: providerId, condition: a.condition, holder: a.holder, identifier_alias: a.identifierAlias, identifier_cbu: a.identifierCBU,
            meta_amount: a.metaAmount, current_amount: a.currentAmount, pending_amount: a.pendingAmount, status: a.status
        }));

        if (newAccounts.length > 0) {
            await supabase.from('provider_accounts').insert(newAccounts);
        }

        for (const account of accountsToKeep) {
            await supabase.from('provider_accounts').update({
                condition: account.condition, holder: account.holder, identifier_alias: account.identifierAlias, identifier_cbu: account.identifierCBU,
                meta_amount: account.metaAmount, current_amount: account.currentAmount, pending_amount: account.pendingAmount, status: account.status
            }).eq('id', account.id);
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

    const handleUpdateOrderTotal = async (orderId: string, newTotal: number) => {
        if (!currentUser) return;
        
        try {
            const { data: orderData, error: fetchError } = await supabase
                .from('orders')
                .select('total, history, status')
                .eq('id', orderId)
                .single();
            
            if (fetchError) throw fetchError;

            const historyEntry: HistoryEntry = {
                timestamp: new Date().toISOString(),
                userId: currentUser.id,
                userName: currentUser.name,
                action: 'PRICE_UPDATE',
                details: `Modificó el total de $${orderData.total} a $${newTotal}`,
                previousState: orderData.status,
                newState: orderData.status
            };

            const updatedHistory = [...(orderData.history || []), historyEntry];

            const { error: updateError } = await supabase
                .from('orders')
                .update({ 
                    total: newTotal, 
                    history: updatedHistory,
                    updated_by: currentUser.id
                })
                .eq('id', orderId);

            if (updateError) throw updateError;
            
            fetchActiveOrders();
        } catch (err: any) {
            alert("Error al actualizar el precio: " + err.message);
        }
    };

    const handleReleaseOrder = (order: DetailedOrder) => {
        setActiveOrder(null);
    };

    const handleUpdateProductQuantity = (code: string, newQty: number, unitPrice?: number) => {
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

        let updatedOrder = applyQuantityChange(activeOrder, code, newQty, unitPrice);
        updatedOrder = { ...updatedOrder, history: [...(updatedOrder.history || []), historyEntry] };
        setActiveOrder(updatedOrder as DetailedOrder);
    };

    const handleSaveAssembly = async (updatedOrder: any, shouldAdvance: boolean, notes?: string) => {
        try {
            const { data: existingDbItems } = await supabase
                .from('order_items')
                .select('code, unit_price')
                .eq('order_id', updatedOrder.id);
            
            const existingKeys = new Set(existingDbItems?.map((i: any) => `${i.code}-${i.unit_price}`));
            const currentKeys = new Set(updatedOrder.products.map((p: any) => `${p.code}-${p.unit_price !== undefined ? p.unit_price : p.unitPrice}`));
            
            const isPostShippingStatus = [OrderStatus.FACTURADO, OrderStatus.FACTURA_CONTROLADA, OrderStatus.EN_TRANSITO, OrderStatus.ENTREGADO, OrderStatus.PAGADO].includes(updatedOrder.status);

            // Delete removed items or items whose price was changed
            if (existingDbItems) {
                for (const item of existingDbItems) {
                    if (!currentKeys.has(`${item.code}-${item.unit_price}`)) {
                        await supabase.from('order_items').delete().eq('order_id', updatedOrder.id).eq('code', item.code).eq('unit_price', item.unit_price);
                    }
                }
            }

            for (const p of updatedOrder.products) {
                 let finalShippedQuantity = p.shippedQuantity;
                 if (!isPostShippingStatus) { finalShippedQuantity = p.quantity; } 
                 else { finalShippedQuantity = p.shippedQuantity ?? p.quantity; }

                 const unitPrice = p.unit_price !== undefined ? p.unit_price : p.unitPrice;
                 const key = `${p.code}-${unitPrice}`;

                 const payload = {
                     order_id: updatedOrder.id, code: p.code, name: p.name, quantity: p.quantity, original_quantity: p.originalQuantity,
                     shipped_quantity: finalShippedQuantity, unit_price: unitPrice, subtotal: p.subtotal, is_checked: shouldAdvance ? false : p.isChecked
                 };

                 if (existingKeys.has(key)) { 
                     await supabase.from('order_items').update(payload).eq('order_id', updatedOrder.id).eq('code', p.code).eq('unit_price', unitPrice); 
                 } 
                 else { 
                     await supabase.from('order_items').insert(payload); 
                 }
            }

            let nextStatus = updatedOrder.status;
            let history = updatedOrder.history || [];
            let isAdvancingToFacturado = false;
            let isAdvancingToEntregadoInterdeposito = false;
            
            if (shouldAdvance) {
                 const advanced = advanceOrderStatus(updatedOrder);
                 if (advanced.status === OrderStatus.FACTURADO) {
                     isAdvancingToFacturado = true;
                 } else if (advanced.status === OrderStatus.ENTREGADO && updatedOrder.isInterdeposito) {
                     isAdvancingToEntregadoInterdeposito = true;
                 } else {
                     nextStatus = advanced.status;
                     history = [...history, { timestamp: new Date().toISOString(), userId: currentUser?.id, userName: currentUser?.name, action: 'ADVANCE_STATUS', previousState: updatedOrder.status, newState: nextStatus, details: notes || 'Avance desde modal' }];
                 }
            }

            const orderUpdates: any = {
                status: nextStatus, payment_method: updatedOrder.paymentMethod, observations: updatedOrder.observations,
                total: updatedOrder.total, history: history, updated_by: currentUser?.id 
            };

            if (shouldAdvance && !isAdvancingToFacturado && !isAdvancingToEntregadoInterdeposito) {
                if (updatedOrder.status === OrderStatus.EN_ARMADO && !updatedOrder.assemblerId) { orderUpdates.assembler_id = currentUser?.id; orderUpdates.assembler_name = currentUser?.name; } 
                else if (updatedOrder.status === OrderStatus.ARMADO && !updatedOrder.controllerId) { orderUpdates.controller_id = currentUser?.id; orderUpdates.controller_name = currentUser?.name; }
            }

            await supabase.from('orders').update(orderUpdates).eq('id', updatedOrder.id);
            
            // Notify Admin Vale when order is Controlled
            if (shouldAdvance && nextStatus === OrderStatus.ARMADO_CONTROLADO) {
                await sendNotificationToRole('vale', `Pedido ${updatedOrder.displayId} controlado y listo para facturar (${updatedOrder.clientName})`, updatedOrder.id);
            }

            setActiveOrder(null); 
            fetchActiveOrders(); 

            if (isAdvancingToFacturado || isAdvancingToEntregadoInterdeposito) {
                handleAdvanceOrder(updatedOrder, notes);
            }
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
                    isMuted={isMuted}
                    onToggleMute={toggleMute}
                    isAudioEnabled={isAudioEnabled}
                    onEnableSound={initAudio}
                />

                <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
                    {currentView === View.DASHBOARD && <Dashboard orders={orders} expirations={expirations} onNavigate={setCurrentView} />}
                    {currentView === View.METRICS_REPLENISHMENT && <MetricsReplenishment />}
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
                            onUpdateOrderTotal={handleUpdateOrderTotal}
                            onRefresh={async () => {
                                await fetchActiveOrders();
                                await fetchNotifications();
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
                                        display_id: order.displayId, client_name: order.clientName, total: order.total, status: order.status,
                                        zone: order.zone, observations: order.observations, history: order.history, is_reservation: order.isReservation,
                                        is_interdeposito: order.isInterdeposito,
                                        interdeposito_origin: order.interdepositoOrigin,
                                        interdeposito_destination: order.interdepositoDestination,
                                        scheduled_date: order.scheduledDate, created_by: currentUser.id 
                                    }).select().single();
                                    if (error) throw error;
                                    if (data) {
                                        const items = order.products.map(p => ({
                                            order_id: data.id, code: p.code, name: p.name, quantity: p.quantity, original_quantity: p.originalQuantity, unit_price: p.unitPrice, subtotal: p.subtotal, is_checked: false
                                        }));
                                        await supabase.from('order_items').insert(items);
                                        
                                        // Notify Armadores about new order
                                        await sendNotificationToRole('armador', `Nuevo pedido disponible: ${order.displayId} - ${order.clientName}`, data.id);
                                        
                                        await fetchActiveOrders();
                                        setCurrentView(View.ORDERS);
                                    }
                                } catch (e: any) { alert("Error al crear: " + e.message); }
                            }}
                        />
                    )}
                    {currentView === View.ORDER_SHEET && <OrderSheet currentUser={currentUser} orders={orders} trips={trips} onSaveTrip={handleSaveTrip} onDeleteTrip={handleDeleteTrip} selectedTripId={selectedTripId} onSelectTrip={setSelectedTripId} providers={providers} transfers={transfers} />}
                    {currentView === View.PAYMENTS_OVERVIEW && <PaymentsOverview providers={providers} onDeleteProvider={handleDeleteProvider} onUpdateProviders={handleUpdateProvider} transfers={transfers} onUpdateTransfers={handleUpdateTransfer} onConfirmTransfer={handleConfirmTransfer} onDeleteTransfer={handleDeleteTransfer} onRefresh={async () => { await fetchProviders(); await fetchTransfers(); }} />}
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
                        onToggleCheck={(code, unitPrice) => setActiveOrder(toggleProductCheck(activeOrder, code, unitPrice) as DetailedOrder)}
                        onToggleAllChecks={(check) => setActiveOrder(toggleAllProductsCheck(activeOrder, check) as DetailedOrder)}
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
                        onUpdatePrice={(code, price, oldUnitPrice) => setActiveOrder(updateProductPrice(activeOrder, code, price, oldUnitPrice) as DetailedOrder)}
                        onRemoveProduct={(code, unitPrice) => {
                            const updatedOrder = removeProductFromOrder(activeOrder, code, unitPrice);
                            const detailed = { ...updatedOrder, productCount: updatedOrder.products.length } as DetailedOrder;
                            setActiveOrder(detailed);
                        }}
                        onDeleteOrder={handleDeleteOrder}
                    />
                )}

                {/* Generic Dialog Modal */}
                {dialogState.isOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-surface rounded-2xl shadow-xl max-w-md w-full overflow-hidden flex flex-col">
                            <div className="p-6 border-b border-surfaceHighlight">
                                <h3 className="text-lg font-bold text-text">{dialogState.title}</h3>
                            </div>
                            <div className="p-6 text-text/80 text-sm">
                                {dialogState.message}
                            </div>
                            <div className="p-4 bg-surfaceHighlight/30 flex justify-end gap-3">
                                <button 
                                    onClick={() => setDialogState(prev => ({ ...prev, isOpen: false }))}
                                    className="px-4 py-2 text-sm font-bold text-text/70 hover:text-text transition-colors"
                                >
                                    {dialogState.type === 'confirm' ? 'Cancelar' : 'Cerrar'}
                                </button>
                                {dialogState.type === 'confirm' && (
                                    <button 
                                        onClick={() => {
                                            if (dialogState.onConfirm) dialogState.onConfirm();
                                            setDialogState(prev => ({ ...prev, isOpen: false }));
                                        }}
                                        className="px-4 py-2 text-sm font-bold bg-primary text-white rounded-xl hover:bg-primaryHover transition-colors shadow-sm"
                                    >
                                        Confirmar
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Stock Query Modal */}
                <StockQueryModal 
                    isOpen={isStockQueryOpen} 
                    onClose={() => setIsStockQueryOpen(false)} 
                />

                {/* Floating Stock Button */}
                {currentUser && hasPermission(currentUser, 'global.stock_queries') && (
                    <button
                        onClick={() => setIsStockQueryOpen(true)}
                        className="fixed bottom-6 right-6 z-40 bg-primary text-white p-3 rounded-full shadow-lg hover:bg-primaryHover hover:scale-105 transition-all flex items-center justify-center group"
                        title="Consultar Stock (F12)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                        <span className="absolute right-full mr-3 bg-surface text-text text-xs font-bold px-2 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            Stock (F12)
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
}
