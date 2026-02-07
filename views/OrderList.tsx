
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  ChevronDown, 
  Package, 
  RefreshCw, 
  Trash2, 
  CheckCircle, 
  ShieldCheck, 
  Box, 
  AlertTriangle, 
  Play, 
  Lock, 
  Unlock,
  Eye, 
  XCircle, 
  Loader2, 
  ClipboardCheck, 
  Truck, 
  Compass, 
  Receipt, 
  History, 
  Activity, 
  ArrowDownLeft, 
  CalendarDays, 
  X,
  Filter,
  Clock,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Send,
  Users
} from 'lucide-react';
import { DetailedOrder, View, OrderStatus, User, DeliveryZone } from '../types';
import { 
    ORDER_WORKFLOW, 
    getStatusColor, 
    getZoneStyles, 
    getMissingProducts, 
    hasPermission, 
    getOrderRefundTotal,
    advanceOrderStatus
} from '../logic';
import { supabase } from '../supabase';

interface OrderListProps {
  onNavigate: (view: View) => void;
  orders: DetailedOrder[];
  currentUser: User;
  onOpenAssembly: (order: DetailedOrder) => void;
  onClaimOrder: (order: DetailedOrder) => void;
  onDeleteOrder: (orderId: string) => void; 
  onDeleteOrders: (orderIds: string[]) => void;
  onAdvanceOrder: (order: DetailedOrder, notes?: string) => void;
  onToggleLock: (order: DetailedOrder) => void;
  onRefresh: () => Promise<void>;
  
  // NEW PROPS FOR OPTIMIZED HISTORY FETCHING
  onFetchHistory?: (month: number, year: number, search?: string) => Promise<void>;
  historyFilter?: { month: number, year: number, search: string };
}

type TabType = 'active' | 'delivered';

interface GroupedOrderData {
    label: string;
    orders: DetailedOrder[];
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const YEARS = [2023, 2024, 2025, 2026];

export const OrderList: React.FC<OrderListProps> = ({ 
    onNavigate, 
    orders, 
    currentUser, 
    onOpenAssembly,
    onClaimOrder,
    onDeleteOrder, 
    onDeleteOrders,
    onAdvanceOrder,
    onToggleLock,
    onRefresh,
    onFetchHistory,
    historyFilter
}) => {
  const [currentTab, setCurrentTab] = useState<TabType>('active');
  const [localSearchTerm, setLocalSearchTerm] = useState(''); // Only filters what's loaded
  const [zoneFilter, setZoneFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>(''); 
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmingBatchDelete, setConfirmingBatchDelete] = useState<string | null>(null);
  const [zones, setZones] = useState<DeliveryZone[]>([]);

  // Transition Modal State
  const [transitionOrder, setTransitionOrder] = useState<DetailedOrder | null>(null);

  // Server-side search state
  const [serverSearchTerm, setServerSearchTerm] = useState(historyFilter?.search || '');

  useEffect(() => {
      const fetchZones = async () => {
          const { data } = await supabase.from('delivery_zones').select('*').eq('active', true).order('name');
          if (data) setZones(data);
      };
      fetchZones();
  }, []);

  useEffect(() => {
      setStatusFilter('');
  }, [currentTab]);

  const activeOrders = orders.filter(o => o.status !== OrderStatus.ENTREGADO && o.status !== OrderStatus.PAGADO);
  const deliveredOrders = orders.filter(o => o.status === OrderStatus.ENTREGADO || o.status === OrderStatus.PAGADO);

  let currentList = currentTab === 'active' ? activeOrders : deliveredOrders;

  const filteredOrders = currentList.filter(order => {
      // Local filtering
      const keywords = localSearchTerm.toLowerCase().split(/\s+/).filter(k => k.length > 0);
      const textToSearch = `${order.clientName} ${order.displayId}`.toLowerCase();
      const keywordsMatch = keywords.every(k => textToSearch.includes(k));
      const matchesZone = zoneFilter ? order.zone === zoneFilter : true;
      const matchesStatus = statusFilter ? order.status === statusFilter : true; 
      return keywordsMatch && matchesZone && matchesStatus;
  });

  const groupedDeliveredOrders = useMemo<Record<string, GroupedOrderData>>(() => {
      if (currentTab !== 'delivered') return {} as Record<string, GroupedOrderData>;
      
      const groups: Record<string, GroupedOrderData> = {};
      
      filteredOrders.forEach(order => {
          const parts = order.createdDate.split('/');
          if (parts.length === 3) {
              const month = parseInt(parts[1], 10);
              const year = parts[2];
              const monthName = new Date(parseInt(year), month - 1, 1).toLocaleString('es-AR', { month: 'long' });
              const key = `${year}-${month.toString().padStart(2, '0')}`;
              const label = `${monthName} ${year}`;
              
              if (!groups[key]) {
                  groups[key] = { label: label.charAt(0).toUpperCase() + label.slice(1), orders: [] };
              }
              groups[key].orders.push(order);
          } else {
              const key = 'otros';
              if (!groups[key]) groups[key] = { label: 'Otros / Sin Fecha', orders: [] };
              groups[key].orders.push(order);
          }
      });
      
      const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
      
      const sortedGroups: Record<string, GroupedOrderData> = {};
      sortedKeys.forEach(key => {
          sortedGroups[key] = groups[key];
      });
      
      return sortedGroups;
  }, [filteredOrders, currentTab]);

  const handleManualRefresh = async () => {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
  };

  const handleBatchDelete = (key: string, orderIds: string[]) => {
      onDeleteOrders(orderIds);
      setConfirmingBatchDelete(null);
  };

  // --- HISTORY FILTER HANDLERS ---
  const changeHistoryMonth = (delta: number) => {
      if (!onFetchHistory || !historyFilter) return;
      let newMonth = historyFilter.month + delta;
      let newYear = historyFilter.year;
      if (newMonth > 11) { newMonth = 0; newYear++; }
      if (newMonth < 0) { newMonth = 11; newYear--; }
      onFetchHistory(newMonth, newYear, ''); // Clear search when changing month
      setServerSearchTerm('');
  };

  const executeServerSearch = () => {
      if (!onFetchHistory || !historyFilter) return;
      onFetchHistory(historyFilter.month, historyFilter.year, serverSearchTerm);
  };

  const availableStatusOptions = useMemo(() => {
      const allStatuses = Object.keys(ORDER_WORKFLOW) as OrderStatus[];
      if (currentTab === 'active') {
          return allStatuses.filter(s => s !== OrderStatus.ENTREGADO && s !== OrderStatus.PAGADO);
      } else {
          return [OrderStatus.ENTREGADO, OrderStatus.PAGADO];
      }
  }, [currentTab]);

  const requestAdvanceOrder = (order: DetailedOrder) => {
      setTransitionOrder(order);
  };

  const confirmTransition = (notes: string) => {
      if (transitionOrder) {
          onAdvanceOrder(transitionOrder, notes);
          setTransitionOrder(null);
      }
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* ... Header y controles igual que antes ... */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h2 className="text-text text-3xl md:text-4xl font-black tracking-tight">Gestión de Pedidos</h2>
          <p className="text-muted text-sm mt-1 flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${currentTab === 'active' ? 'bg-green-500' : 'bg-blue-500'}`}></span>
            {currentTab === 'active' ? 'Control de proceso operativo' : 'Historial y control de cobros'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => onNavigate(View.STOCK_CONTROL)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-surface text-text border border-surfaceHighlight hover:border-primary/50 transition-all text-sm font-bold shadow-sm"
          >
            <Box size={18} /> Control de Stock
          </button>
          <button 
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-surface text-text border border-surfaceHighlight hover:border-primary/50 transition-all text-sm font-bold shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin text-primary' : ''} /> 
            {isRefreshing ? 'Actualizando...' : 'Actualizar'}
          </button>
          
          {hasPermission(currentUser, 'orders.create') && (
              <button onClick={() => onNavigate(View.CREATE_BUDGET)} className="flex items-center gap-2 bg-primary hover:bg-primaryHover text-white px-6 py-3 rounded-full text-sm font-black transition-all shadow-lg shadow-primary/20 active:scale-95">
                <Plus size={18} /> Nuevo Pedido
              </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="p-1 rounded-xl bg-surface w-full sm:w-fit flex gap-1 border border-surfaceHighlight shadow-sm">
          {[
            { id: 'active', label: 'Activos' },
            { id: 'delivered', label: 'Historial' }
          ].map((tab) => (
            <button 
                key={tab.id} 
                onClick={() => setCurrentTab(tab.id as TabType)} 
                className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-black transition-all whitespace-nowrap ${currentTab === tab.id ? 'bg-surfaceHighlight text-text shadow-sm' : 'text-muted hover:text-text hover:bg-surfaceHighlight/50'}`}
            >
              {tab.label} ({tab.id === 'active' ? activeOrders.length : deliveredOrders.length})
            </button>
          ))}
        </div>

        {/* CONTROLES DE FILTRO */}
        {currentTab === 'active' ? (
            <div className="flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
                    <input type="text" placeholder="Buscar por cliente o ID de pedido" value={localSearchTerm} onChange={(e) => setLocalSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-surface border border-surfaceHighlight focus:border-primary focus:ring-1 focus:ring-primary text-text placeholder-muted text-sm outline-none transition-all shadow-sm" />
                </div>
                
                <div className="relative min-w-[200px]">
                    <Compass className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                    <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} className="w-full appearance-none pl-11 pr-10 py-3.5 rounded-xl bg-surface border border-surfaceHighlight focus:border-primary text-text text-sm cursor-pointer outline-none shadow-sm font-bold uppercase">
                        <option value="">Todas las Zonas</option>
                        {zones.map(z => (
                            <option key={z.id} value={z.name}>{z.name}</option>
                        ))}
                        {zones.length === 0 && <option value="V. Mercedes">V. Mercedes (Default)</option>}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" size={18} />
                </div>

                <div className="relative min-w-[220px]">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full appearance-none pl-11 pr-10 py-3.5 rounded-xl bg-surface border border-surfaceHighlight focus:border-primary text-text text-sm cursor-pointer outline-none shadow-sm font-bold uppercase">
                        <option value="">Todos los Estados</option>
                        {availableStatusOptions.map(status => (
                            <option key={status} value={status}>
                                {ORDER_WORKFLOW[status]?.label || status}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" size={18} />
                </div>
            </div>
        ) : (
            // CONTROLES DE HISTORIAL
            <div className="bg-surface border border-surfaceHighlight p-4 rounded-2xl shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-2">
                    <button onClick={() => changeHistoryMonth(-1)} className="p-2 rounded-full hover:bg-surfaceHighlight text-muted hover:text-primary transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <div className="flex items-center gap-2 px-4 py-2 bg-background border border-surfaceHighlight rounded-xl min-w-[180px] justify-center">
                        <CalendarDays size={16} className="text-primary"/>
                        <span className="text-sm font-black uppercase text-text">
                            {historyFilter ? `${MONTHS[historyFilter.month]} ${historyFilter.year}` : 'Cargando...'}
                        </span>
                    </div>
                    <button onClick={() => changeHistoryMonth(1)} className="p-2 rounded-full hover:bg-surfaceHighlight text-muted hover:text-primary transition-colors">
                        <ChevronRight size={20} />
                    </button>
                </div>

                <div className="w-full lg:w-px h-px lg:h-10 bg-surfaceHighlight mx-2"></div>

                <div className="flex-1 w-full flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar en historial completo (Servidor)..." 
                            value={serverSearchTerm} 
                            onChange={(e) => setServerSearchTerm(e.target.value)} 
                            onKeyDown={(e) => e.key === 'Enter' && executeServerSearch()}
                            className="w-full pl-11 pr-4 py-3 rounded-xl bg-background border border-surfaceHighlight focus:border-primary text-text text-sm outline-none transition-all shadow-inner uppercase" 
                        />
                    </div>
                    <button onClick={executeServerSearch} className="px-6 py-3 rounded-xl bg-primary text-white font-black text-xs uppercase shadow-lg active:scale-95 transition-all">
                        Buscar
                    </button>
                </div>
            </div>
        )}
      </div>

      {currentTab === 'active' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-500">
              {filteredOrders.map((order) => (
                  <DetailedOrderCard 
                      key={order.id} 
                      order={order} 
                      currentUser={currentUser} 
                      onOpenAssembly={onOpenAssembly} 
                      onClaimOrder={onClaimOrder}
                      onDeleteOrder={onDeleteOrder} 
                      onAdvanceOrder={requestAdvanceOrder} 
                      onToggleLock={onToggleLock}
                  />
              ))}
              {filteredOrders.length === 0 && (
                  <div className="col-span-full py-24 text-center text-muted border-2 border-dashed border-surfaceHighlight rounded-3xl bg-surface/30 shadow-inner">
                      <Package size={56} className="mx-auto mb-4 opacity-20" />
                      <p className="font-bold text-xl">Sin pedidos activos con este filtro</p>
                  </div>
              )}
          </div>
      ) : (
          <div className="space-y-12 animate-in fade-in duration-500">
              {filteredOrders.length === 0 && (
                  <div className="py-24 text-center text-muted border-2 border-dashed border-surfaceHighlight rounded-3xl bg-surface/30 shadow-inner">
                      <Package size={56} className="mx-auto mb-4 opacity-20" />
                      <p className="font-bold text-xl">Sin historial en {historyFilter ? `${MONTHS[historyFilter.month]} ${historyFilter.year}` : 'este período'}</p>
                      <p className="text-sm mt-2 font-medium">Intenta cambiar el mes o usar el buscador global.</p>
                  </div>
              )}
              {Object.entries(groupedDeliveredOrders).map(([key, group]: [string, GroupedOrderData]) => (
                  <div key={key} className="space-y-6">
                      <div className="flex items-center justify-between border-b border-surfaceHighlight pb-2">
                          <div className="flex items-center gap-3">
                              <CalendarDays className="text-primary" size={24} />
                              <h3 className="text-xl font-black text-text uppercase italic tracking-tight">{group.label}</h3>
                              <span className="bg-surfaceHighlight text-muted px-2 py-0.5 rounded text-xs font-bold">{group.orders.length}</span>
                          </div>
                          {currentUser.role === 'vale' && (
                              confirmingBatchDelete === key ? (
                                  <div className="flex items-center gap-2 animate-in zoom-in-95">
                                      <button onClick={() => handleBatchDelete(key, group.orders.map(o => o.id))} className="px-4 py-2 bg-red-600 text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-red-500/20 active:scale-95 transition-all">¿Confirmar Eliminar Lote?</button>
                                      <button onClick={() => setConfirmingBatchDelete(null)} className="p-2 bg-surfaceHighlight text-text rounded-xl hover:bg-surfaceHighlight/80"><X size={16} /></button>
                                  </div>
                              ) : (
                                  <button onClick={() => setConfirmingBatchDelete(key)} className="flex items-center gap-2 px-4 py-2 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all text-xs font-black uppercase"><Trash2 size={16} /> Eliminar Mes</button>
                              )
                          )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                          {group.orders.map((order) => (
                              <DetailedOrderCard 
                                  key={order.id} 
                                  order={order} 
                                  currentUser={currentUser} 
                                  onOpenAssembly={onOpenAssembly} 
                                  onClaimOrder={onClaimOrder}
                                  onDeleteOrder={onDeleteOrder} 
                                  onAdvanceOrder={requestAdvanceOrder} 
                                  onToggleLock={onToggleLock}
                              />
                          ))}
                      </div>
                  </div>
              ))}
          </div>
      )}

      {/* TRANSITION CONFIRMATION MODAL */}
      {transitionOrder && <TransitionModal order={transitionOrder} onClose={() => setTransitionOrder(null)} onConfirm={confirmTransition} />}
    </div>
  );
};

const TransitionModal: React.FC<{ order: DetailedOrder, onClose: () => void, onConfirm: (notes: string) => void }> = ({ order, onClose, onConfirm }) => {
    const [notes, setNotes] = useState('');
    const nextState = advanceOrderStatus(order).status;
    const nextLabel = ORDER_WORKFLOW[nextState]?.label || nextState;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-surface w-full max-w-md rounded-3xl border border-surfaceHighlight shadow-2xl p-6 flex flex-col gap-6">
                <div className="text-center">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary animate-bounce">
                        <CheckCircle size={32} />
                    </div>
                    <h3 className="text-xl font-black text-text uppercase italic tracking-tight">Confirmar Avance</h3>
                    <p className="text-sm text-muted mt-2 font-medium">El pedido pasará al estado: <span className="text-primary font-bold">{nextLabel}</span></p>
                </div>
                
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 flex items-center gap-2">
                        <MessageSquare size={12}/> Comentario / Observación (Opcional)
                    </label>
                    <textarea 
                        value={notes} 
                        onChange={(e) => setNotes(e.target.value)} 
                        className="w-full bg-background border border-surfaceHighlight rounded-2xl p-4 text-sm font-medium text-text outline-none focus:border-primary shadow-inner h-24 resize-none" 
                        placeholder="Ej: Faltantes notificados al cliente..."
                        autoFocus
                    />
                </div>

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-4 text-text font-black text-xs hover:bg-surfaceHighlight rounded-2xl border border-surfaceHighlight uppercase transition-all">Cancelar</button>
                    <button onClick={() => onConfirm(notes)} className="flex-1 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:bg-primaryHover uppercase text-xs flex items-center justify-center gap-2 transition-all active:scale-95">
                        <Send size={16} /> Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
};

const getTimeAgo = (dateStr?: string) => {
    if (!dateStr) return '';
    const diff = (new Date().getTime() - new Date(dateStr).getTime()) / 60000;
    if (diff < 1) return 'Ahora';
    return `${Math.floor(diff)} min`;
};

const DetailedOrderCard: React.FC<{ 
    order: DetailedOrder; 
    currentUser: User; 
    onOpenAssembly: any; 
    onClaimOrder: any; 
    onDeleteOrder: any; 
    onAdvanceOrder: any;
    onToggleLock: any; 
}> = ({ order, currentUser, onOpenAssembly, onClaimOrder, onDeleteOrder, onAdvanceOrder, onToggleLock }) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const badgeStyle = getStatusColor(order.status);
  const zoneStyles = getZoneStyles(order.zone);
  
  const isFinished = order.status === OrderStatus.ENTREGADO || order.status === OrderStatus.PAGADO;
  const isVale = currentUser.role === 'vale';

  // LOGIC FOR LOCKING VISUALS
  let lockedByMe = false;
  let lockedByOther = false;
  let occupantName = '';

  if (order.status === OrderStatus.EN_ARMADO) {
      if (order.assemblerId === currentUser.id) lockedByMe = true;
      else if (order.assemblerId) { lockedByOther = true; occupantName = order.assemblerName || ''; }
  } else if (order.status === OrderStatus.ARMADO) {
      if (order.controllerId === currentUser.id) lockedByMe = true;
      else if (order.controllerId) { lockedByOther = true; occupantName = order.controllerName || ''; }
  }

  // Si yo terminé el armado pero aún no tiene controlador, no debería mostrarse bloqueado para mí (Armador original).
  // La lógica de "Bloqueado" anterior era confusa. 
  // Ahora "Bloqueado por otro" es explícito si hay un ID activo en el paso actual.
  
  // Mensaje amigable para el dueño anterior si el pedido está en espera
  const waitingForNextStep = (order.status === OrderStatus.ARMADO && !order.controllerId && order.assemblerId === currentUser.id);

  const timeAgo = (lockedByOther || lockedByMe) ? getTimeAgo(order.lastUpdated) : '';

  const getValeActions = () => {
    const secondaryBtn = (
        <button 
            onClick={() => onOpenAssembly(order)}
            className="flex-1 py-2.5 rounded-xl border border-surfaceHighlight text-text hover:bg-surfaceHighlight font-bold text-[11px] flex items-center justify-center gap-2 transition-all shadow-sm"
        >
            {isFinished ? <History size={14} /> : <Eye size={14} />}
            {isFinished ? 'Historial' : 'Editar'}
        </button>
    );

    const deleteBtn = (
        <button 
            onClick={() => { 
                if(isConfirmingDelete) onDeleteOrder(order.id); 
                else { setIsConfirmingDelete(true); setTimeout(() => setIsConfirmingDelete(false), 3000); } 
            }} 
            className={`w-full py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 mt-1 ${isConfirmingDelete ? 'bg-red-600 text-white shadow-lg' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'}`}
        >
            {isConfirmingDelete ? <XCircle size={14}/> : <Trash2 size={14} />}
            {isConfirmingDelete ? 'Confirmar' : 'Eliminar'}
        </button>
    );

    let primaryAction = null;
    if (order.status === OrderStatus.ARMADO_CONTROLADO) {
        primaryAction = (
            <button onClick={() => onAdvanceOrder(order)} className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black uppercase text-[11px] shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2">
                <Receipt size={14} /> Facturar
            </button>
        );
    } else if (order.status === OrderStatus.FACTURA_CONTROLADA) {
        primaryAction = (
            <button onClick={() => onAdvanceOrder(order)} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[11px] shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2">
                <Truck size={14} /> Reparto
            </button>
        );
    } else if (order.status === OrderStatus.EN_TRANSITO) {
        primaryAction = (
            <button onClick={() => onAdvanceOrder(order)} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[11px] shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
                <CheckCircle size={14} /> Entregado
            </button>
        );
    } else if (isFinished) {
        primaryAction = (
            <button onClick={() => onOpenAssembly(order)} className="flex-1 py-2.5 rounded-xl bg-surfaceHighlight text-text hover:bg-surfaceHighlight/80 font-black uppercase text-[11px] flex items-center justify-center gap-2">
                <Eye size={14} /> Ver
            </button>
        );
    } else {
        primaryAction = (
            <button disabled className="flex-1 py-2.5 rounded-xl bg-surfaceHighlight text-muted font-black uppercase text-[11px] flex items-center justify-center gap-2 opacity-50">
                <Loader2 size={14} className="animate-spin" /> Espera
            </button>
        );
    }

    return (
        <div className="flex flex-col gap-2 w-full mt-auto">
            <div className="flex gap-2 w-full">
                {secondaryBtn}
                {primaryAction}
            </div>
            {deleteBtn}
        </div>
    );
  };

  const getArmadorActions = () => {
    if (order.status === OrderStatus.FACTURA_CONTROLADA) {
        return (
            <button onClick={() => onAdvanceOrder(order)} className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[11px] shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Truck size={14} /> Salir a Reparto
            </button>
        );
    }

    if (order.status === OrderStatus.EN_TRANSITO) {
        return (
            <button onClick={() => onOpenAssembly(order)} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[11px] shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all">
                <CheckCircle size={14} /> Gestionar Entrega / Devolución
            </button>
        );
    }

    // Default Action: VIEW
    let label = "Ver Detalle";
    let icon = <Eye size={14} />;
    let className = "bg-surfaceHighlight text-text hover:bg-surfaceHighlight/80";
    let action = () => onOpenAssembly(order);

    if (lockedByMe) {
        // If locked by me -> "Continuar"
        label = "Continuar";
        icon = <Play size={14} />;
        className = "bg-primary text-white hover:bg-primaryHover shadow-lg shadow-primary/20";
        action = () => onOpenAssembly(order);
    } else if (lockedByOther) {
        // If locked by other -> "Ver / Colaborar" (As per previous request)
        label = "Ver / Colaborar";
        icon = <Users size={14} />;
        className = "bg-surfaceHighlight text-muted hover:text-text border border-surfaceHighlight";
        action = () => onOpenAssembly(order);
    } else {
        // If free (Padlock Open) -> Can enter but user usually clicks padlock first to lock. 
        // We provide "Armar" as a quick entry that also locks if we wanted, 
        // but to keep it Explicit, we let them click the Padlock OR enter freely.
        // Let's make the main button "Ver Detalle" and they lock inside or via the card icon.
        if (order.status === OrderStatus.EN_ARMADO) {
            label = "Abrir Pedido";
            icon = <Box size={14} />;
        } else if (order.status === OrderStatus.ARMADO) {
            label = "Controlar";
            icon = <ShieldCheck size={14} />;
            className = "bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-500/20";
        } else if (order.status === OrderStatus.FACTURADO) {
            label = "Controlar Factura";
            icon = <ClipboardCheck size={14} />;
            className = "bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/20";
        }
    }

    return (
        <button 
            onClick={action}
            className={`w-full py-3 rounded-xl font-black uppercase text-[11px] transition-all flex items-center justify-center gap-2 active:scale-95 ${className}`}
        >
            {icon} {label}
        </button>
    );
  };

  const missingProducts = getMissingProducts(order);
  const refundAmount = getOrderRefundTotal(order);

  return (
    <div className={`bg-surface rounded-xl p-5 flex flex-col gap-3 border transition-all group relative overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 ${zoneStyles.borderColor} border-opacity-40`}>
        <div className="flex justify-between items-start gap-3 mb-0.5">
            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${zoneStyles.badgeBg} ${zoneStyles.badgeText} ${zoneStyles.borderColor}`}>
                {order.zone || 'SIN ZONA'}
            </span>
            <div className="flex items-center gap-2">
                {/* PADLOCK TOGGLE */}
                {!isFinished && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onToggleLock(order); }}
                        className={`p-1.5 rounded-lg transition-all active:scale-90 ${
                            lockedByMe ? 'bg-green-500 text-white shadow-md' : 
                            lockedByOther ? 'bg-red-500/10 text-red-500 cursor-not-allowed opacity-50' : 
                            'bg-surfaceHighlight text-muted hover:text-text'
                        }`}
                        title={lockedByMe ? "Liberar pedido" : lockedByOther ? `Bloqueado por ${occupantName}` : "Tomar pedido"}
                        disabled={lockedByOther}
                    >
                        {lockedByMe ? <Lock size={14} /> : lockedByOther ? <Lock size={14} /> : <Unlock size={14} />}
                    </button>
                )}

                <div className="flex flex-col items-end gap-1">
                    {lockedByOther && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-red-500/10 text-red-600 border border-red-500/20 shadow-sm animate-pulse">
                            <Activity size={8} /> {occupantName}
                        </span>
                    )}
                    {waitingForNextStep && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-orange-500/10 text-orange-600 border border-orange-500/20 shadow-sm">
                            <Clock size={8} /> Esperando Control
                        </span>
                    )}
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${badgeStyle}`}>
                        <Box size={8} /> {ORDER_WORKFLOW[order.status]?.label || order.status}
                    </span>
                </div>
            </div>
        </div>

        <div>
            <h3 className="text-text text-xl font-black uppercase leading-tight tracking-tight truncate">{order.clientName}</h3>
            <p className="text-muted text-[9px] font-mono mt-0.5 opacity-60 truncate">{order.displayId}</p>
        </div>

        <div className="h-px bg-surfaceHighlight w-full my-0.5 opacity-40"></div>

        <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
                <span className="text-[11px] text-muted font-bold">Productos:</span>
                <span className="text-xs text-text font-black">{order.productCount}</span>
            </div>
            
            {hasPermission(currentUser, 'orders.view_financials') || isVale ? (
                <div className="flex justify-between items-center">
                    <span className="text-[11px] text-muted font-bold">Total Neto:</span>
                    <div className="flex flex-col items-end">
                        <span className="text-lg text-green-600 dark:text-green-400 font-black tracking-tighter leading-none">$ {(order.total || 0).toLocaleString('es-AR')}</span>
                        {refundAmount > 0 && <span className="text-[8px] font-black text-red-500 uppercase tracking-tighter">NC: -$ {refundAmount.toLocaleString('es-AR')}</span>}
                    </div>
                </div>
            ) : null}
            
            <div className="flex justify-between items-center">
                <span className="text-[11px] text-muted font-bold">Creado:</span>
                <span className="text-[11px] text-text font-bold">{order.createdDate}</span>
            </div>
            
            <div className="flex flex-col gap-1 mt-1">
                {missingProducts.length > 0 && (
                    <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center gap-2">
                        <AlertTriangle size={12} className="text-orange-500" />
                        <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400">{missingProducts.length} producto(s) con faltantes</span>
                    </div>
                )}
                {refundAmount > 0 && (
                    <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 animate-pulse">
                        <ArrowDownLeft size={12} className="text-red-500" />
                        <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-tighter">Devolución (NC): $ {refundAmount.toLocaleString('es-AR')}</span>
                    </div>
                )}
            </div>
        </div>

        <div className="mt-auto pt-3 flex flex-col gap-2">
            {isVale ? getValeActions() : getArmadorActions()}
        </div>

        <div className={`absolute bottom-0 left-0 w-full h-1 ${zoneStyles.borderColor} bg-current opacity-10`}></div>
    </div>
  );
};
