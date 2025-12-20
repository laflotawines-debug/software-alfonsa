import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  ChevronDown, 
  Package, 
  RefreshCw, 
  Receipt,
  Edit2,
  Trash2,
  CheckCircle,
  ShieldCheck,
  Box,
  AlertTriangle,
  Play,
  UserCheck,
  Lock,
  Eye,
  XCircle,
  FileText,
  Loader2,
  ClipboardCheck,
  Truck,
  MapPin,
  RotateCcw,
  Compass,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { DetailedOrder, View, OrderStatus, User, OrderZone } from '../types';
import { ORDER_WORKFLOW, getStatusColor, getMissingProducts, getReturnedProducts, getZoneStyles } from '../logic';

interface OrderListProps {
  onNavigate: (view: View) => void;
  orders: DetailedOrder[];
  currentUser: User;
  onOpenAssembly: (order: DetailedOrder) => void;
  onDeleteOrder: (orderId: string) => void; 
  onInvoiceOrder: (order: DetailedOrder) => void;
}

type TabType = 'active' | 'unpaid' | 'delivered';

export const OrderList: React.FC<OrderListProps> = ({ 
    onNavigate, 
    orders, 
    currentUser, 
    onOpenAssembly, 
    onDeleteOrder,
    onInvoiceOrder 
}) => {
  const [currentTab, setCurrentTab] = useState<TabType>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [zoneFilter, setZoneFilter] = useState<string>('');
  
  // State for collapsible date groups
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const toggleDateGroup = (date: string) => {
      setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }));
  };

  // --- FILTERING LOGIC ---

  // 1. Separate by Workflow Stage
  const activeOrders = orders.filter(o => 
      o.status !== OrderStatus.ENTREGADO && o.status !== OrderStatus.PAGADO
  );

  const deliveredOrders = orders.filter(o => 
      o.status === OrderStatus.ENTREGADO || o.status === OrderStatus.PAGADO
  );

  const unpaidOrders = orders.filter(o => 
      o.status === OrderStatus.ENTREGADO
  );

  // 2. Select List based on Tab
  let currentList = currentTab === 'active' ? activeOrders : 
                    currentTab === 'delivered' ? deliveredOrders : 
                    unpaidOrders;

  // 3. Apply Local Search, Status & Zone Filters
  const filteredOrders = currentList.filter(order => {
      const matchesSearch = 
        order.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        order.displayId.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter ? order.status === statusFilter : true;
      
      const matchesZone = zoneFilter ? order.zone === zoneFilter : true;

      return matchesSearch && matchesStatus && matchesZone;
  });

  // 4. Grouping Logic for Delivered Tab
  const groupedDeliveredOrders = React.useMemo(() => {
    if (currentTab !== 'delivered') return null;
    
    const groups: Record<string, DetailedOrder[]> = {};
    filteredOrders.forEach(order => {
        const date = order.createdDate; // Group by Creation Date string
        if (!groups[date]) groups[date] = [];
        groups[date].push(order);
    });

    // Sort orders inside groups by Zone to satisfy "divididas por zonas" requirement within the date pack
    Object.keys(groups).forEach(date => {
        groups[date].sort((a, b) => {
            const zoneA = a.zone || 'ZZZ'; // Push undefined zones to end
            const zoneB = b.zone || 'ZZZ';
            return zoneA.localeCompare(zoneB);
        });
    });

    return groups;
  }, [filteredOrders, currentTab]);


  return (
    <div className="flex flex-col gap-8 pb-10">
      
      {/* Header Area */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h2 className="text-text text-3xl md:text-4xl font-black tracking-tight">Gestión de Pedidos</h2>
          <p className="text-muted text-sm mt-1 flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${currentTab === 'active' ? 'bg-green-500' : 'bg-blue-500'}`}></span>
            {currentTab === 'active' ? 'Control de proceso operativo' : 'Historial y control de cobros'}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <ActionButton icon={<Box size={18} />} label="Control de Stock" />
          <ActionButton icon={<RefreshCw size={18} />} label="Actualizar" />
          <div className="relative group">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-surface text-text border border-surfaceHighlight hover:border-primary/50 transition-all text-sm font-bold shadow-sm cursor-default">
              <span>Vista: {currentUser.name}</span>
            </button>
          </div>
          {currentUser.role === 'vale' && (
              <button 
                onClick={() => onNavigate(View.CREATE_BUDGET)}
                className="flex items-center gap-2 bg-primary hover:bg-primaryHover text-white px-5 py-2.5 rounded-full text-sm font-bold transition-colors shadow-lg shadow-primary/20"
              >
                <Plus size={18} />
                Nuevo Presupuesto
              </button>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-6">
        {/* Tabs */}
        <div className="p-1 rounded-xl bg-surface w-full sm:w-fit flex gap-1 border border-surfaceHighlight overflow-x-auto">
          <button 
            onClick={() => setCurrentTab('active')}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap
                ${currentTab === 'active' 
                    ? 'bg-background text-text shadow-sm border border-surfaceHighlight' 
                    : 'text-muted hover:text-text hover:bg-surfaceHighlight'
                }`}
          >
            Activos ({activeOrders.length})
          </button>
          <button 
            onClick={() => setCurrentTab('unpaid')}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap
                ${currentTab === 'unpaid' 
                    ? 'bg-background text-text shadow-sm border border-surfaceHighlight' 
                    : 'text-muted hover:text-text hover:bg-surfaceHighlight'
                }`}
          >
            Sin pagar ({unpaidOrders.length})
          </button>
          <button 
            onClick={() => setCurrentTab('delivered')}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap
                ${currentTab === 'delivered' 
                    ? 'bg-background text-text shadow-sm border border-surfaceHighlight' 
                    : 'text-muted hover:text-text hover:bg-surfaceHighlight'
                }`}
          >
            Entregados ({deliveredOrders.length})
          </button>
        </div>

        {/* Search Bar & Filters */}
        <div className="flex flex-col lg:flex-row gap-4">
          
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por cliente o ID de pedido"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-surface border border-surfaceHighlight focus:border-primary focus:ring-1 focus:ring-primary text-text placeholder-muted text-sm outline-none transition-all shadow-sm"
            />
          </div>

          {/* Zone Filter */}
          <div className="relative min-w-[200px]">
             <Compass className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
             <select 
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                className="w-full appearance-none pl-11 pr-10 py-3 rounded-xl bg-surface border border-surfaceHighlight focus:border-primary focus:ring-1 focus:ring-primary text-text text-sm cursor-pointer outline-none shadow-sm"
            >
                <option value="">Todas las Zonas</option>
                <option value="V. Mercedes">V. Mercedes</option>
                <option value="San Luis">San Luis</option>
                <option value="Norte">Norte</option>
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" size={18} />
          </div>

          {/* Status Filter */}
          <div className="relative min-w-[220px]">
            <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full appearance-none pl-4 pr-10 py-3 rounded-xl bg-surface border border-surfaceHighlight focus:border-primary focus:ring-1 focus:ring-primary text-text text-sm cursor-pointer outline-none shadow-sm"
            >
              <option value="">Todos los estados</option>
              {Object.values(OrderStatus).map((status) => (
                  <option key={status} value={status}>{ORDER_WORKFLOW[status].label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" size={18} />
          </div>
        </div>
      </div>

      {/* VIEW RENDERER */}
      
      {currentTab === 'delivered' && groupedDeliveredOrders ? (
          // --- GROUPED VIEW FOR DELIVERED ---
          <div className="flex flex-col gap-6 animate-in fade-in duration-500">
             {Object.keys(groupedDeliveredOrders).length === 0 && (
                 <EmptyState message="No se encontraron pedidos entregados." />
             )}

             {Object.entries(groupedDeliveredOrders).map(([date, groupOrdersUntyped]) => {
                 const groupOrders = groupOrdersUntyped as DetailedOrder[];
                 // Set default open state for today's date if not set, or use state
                 // For now, default all to expanded for better visibility, user can collapse
                 const isExpanded = expandedDates[date] !== undefined ? expandedDates[date] : true;
                 const groupTotal = groupOrders.reduce((sum, o) => sum + o.total, 0);

                 return (
                     <div key={date} className="bg-surface/50 border border-surfaceHighlight rounded-2xl overflow-hidden shadow-sm">
                         {/* Group Header - Clickable */}
                         <button 
                            onClick={() => toggleDateGroup(date)}
                            className="w-full flex items-center justify-between p-4 bg-surface hover:bg-surfaceHighlight/50 transition-colors border-b border-surfaceHighlight"
                         >
                             <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-full bg-surfaceHighlight text-muted transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}>
                                    <ChevronRight size={20} />
                                </div>
                                <div className="text-left">
                                    <h3 className="text-lg font-bold text-text flex items-center gap-2">
                                        <Calendar size={18} className="text-primary" />
                                        {date}
                                    </h3>
                                    <p className="text-sm text-muted">
                                        {groupOrders.length} pedido{groupOrders.length !== 1 ? 's' : ''} entregado{groupOrders.length !== 1 ? 's' : ''}
                                    </p>
                                </div>
                             </div>
                             <div className="text-right hidden sm:block">
                                 <span className="text-xs text-muted uppercase font-bold tracking-wider">Total Fecha</span>
                                 <p className="text-lg font-black text-green-600 dark:text-green-400">
                                     $ {groupTotal.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                 </p>
                             </div>
                         </button>

                         {/* Collapsible Content */}
                         <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                             <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {groupOrders.map(order => (
                                    <DetailedOrderCard 
                                        key={order.id} 
                                        order={order} 
                                        currentUser={currentUser} 
                                        onOpenAssembly={onOpenAssembly}
                                        onDeleteOrder={onDeleteOrder}
                                        onInvoiceOrder={onInvoiceOrder}
                                    />
                                ))}
                             </div>
                         </div>
                     </div>
                 );
             })}
          </div>
      ) : (
        // --- STANDARD GRID VIEW FOR ACTIVE / UNPAID ---
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            {filteredOrders.map((order) => (
            <DetailedOrderCard 
                key={order.id} 
                order={order} 
                currentUser={currentUser} 
                onOpenAssembly={onOpenAssembly}
                onDeleteOrder={onDeleteOrder}
                onInvoiceOrder={onInvoiceOrder}
            />
            ))}
            {filteredOrders.length === 0 && (
                <div className="col-span-full">
                    <EmptyState message="No se encontraron pedidos" subMessage="Intenta ajustar los filtros de búsqueda, zona o estado." />
                </div>
            )}
        </div>
      )}

    </div>
  );
};

const ActionButton: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <button className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-surface text-text border border-surfaceHighlight hover:border-primary/50 transition-all text-sm font-bold shadow-sm">
    {icon}
    {label}
  </button>
);

const EmptyState: React.FC<{ message: string; subMessage?: string }> = ({ message, subMessage }) => (
    <div className="py-16 text-center flex flex-col items-center justify-center text-muted border-2 border-dashed border-surfaceHighlight rounded-2xl bg-surface/30">
        <Package size={48} className="mb-4 opacity-50" />
        <p className="font-bold text-lg">{message}</p>
        {subMessage && (
            <p className="text-sm opacity-70">
                {subMessage}
            </p>
        )}
    </div>
);

interface DetailedOrderCardProps {
    order: DetailedOrder;
    currentUser: User;
    onOpenAssembly: (order: DetailedOrder) => void;
    onDeleteOrder: (orderId: string) => void; 
    onInvoiceOrder: (order: DetailedOrder) => void;
}

const DetailedOrderCard: React.FC<DetailedOrderCardProps> = ({ order, currentUser, onOpenAssembly, onDeleteOrder, onInvoiceOrder }) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  
  const badgeStyle = getStatusColor(order.status);
  const zoneStyles = getZoneStyles(order.zone);
  
  // LOGIC
  const isFinished = order.status === OrderStatus.ENTREGADO || order.status === OrderStatus.PAGADO;
  
  // Shortages (Pre-Invoice)
  const missingProducts = getMissingProducts(order);
  const hasShortages = missingProducts.length > 0;

  // Returns (Post-Invoice) - Only relevant if Delivered/Paid
  const returnedProducts = getReturnedProducts(order);
  const hasReturns = returnedProducts.length > 0;
  const returnedCount = returnedProducts.reduce((acc, p) => acc + p.returnedAmount, 0);

  // Assembler Name
  const assemblerName = order.history.find(h => h.newState === OrderStatus.ARMADO)?.userName || order.assemblerId || 'Desconocido';

  // Badge Icons
  let badgeIcon = <Package size={14} />;
  if (order.status === OrderStatus.ARMADO || order.status === OrderStatus.ARMADO_CONTROLADO) {
      badgeIcon = <CheckCircle size={14} />;
  } else if (order.status === OrderStatus.FACTURADO || order.status === OrderStatus.FACTURA_CONTROLADA) {
      badgeIcon = <ShieldCheck size={14} />;
  } else if (order.status === OrderStatus.EN_TRANSITO) {
      badgeIcon = <Truck size={14} />;
  } else if (isFinished) {
      badgeIcon = <DollarSignIcon size={14} />; 
  }

  // --- BUSINESS LOGIC CONSTANTS ---
  const isArmador = currentUser.role === 'armador';
  const canAssemble = isArmador && order.status === OrderStatus.EN_ARMADO;
  const isOriginalAssembler = order.assemblerId === currentUser.id;
  const isReadyForControl = order.status === OrderStatus.ARMADO;
  const canControl = isArmador && isReadyForControl && !isOriginalAssembler;
  const blockedFromControl = isArmador && isReadyForControl && isOriginalAssembler;
  const canInvoice = currentUser.role === 'vale' && order.status === OrderStatus.ARMADO_CONTROLADO;
  const canControlInvoice = isArmador && order.status === OrderStatus.FACTURADO;
  const canSendToTransit = order.status === OrderStatus.FACTURA_CONTROLADA;
  const canDeliver = order.status === OrderStatus.EN_TRANSITO;
  const showFinancials = currentUser.role === 'vale';
  const totalColor = "text-green-600 dark:text-green-400";

  // --- HANDLERS ---
  const handleDeleteClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault(); 
      if (isConfirmingDelete) onDeleteOrder(order.id);
      else { setIsConfirmingDelete(true); setTimeout(() => setIsConfirmingDelete(false), 4000); }
  };

  const handleInvoiceClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsGeneratingInvoice(true);
      setTimeout(() => { onInvoiceOrder(order); }, 1000);
  };

  const handleQuickAdvance = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      try { onInvoiceOrder(order); } catch (e) { alert("Error avanzando estado"); }
  };

  // --- LAYOUT VARIANT: ENTREGADO / PAGADO (Match Image Structure) ---
  if (isFinished) {
      return (
        <div className={`bg-surface rounded-2xl p-6 flex flex-col gap-4 border-l-4 hover:border-l-primary transition-all group relative overflow-hidden shadow-sm hover:shadow-md ${zoneStyles.borderColor} border-t border-r border-b`}>
            {/* Header: Name + Badge */}
            <div className="flex justify-between items-start gap-4">
                <div className="flex flex-col gap-1">
                    {order.zone && (
                         <span className={`text-[10px] font-bold uppercase tracking-wide self-start px-2 py-0.5 rounded-full ${zoneStyles.badgeBg} ${zoneStyles.badgeText}`}>
                             {order.zone}
                         </span>
                    )}
                    <h3 className="text-text text-lg font-black uppercase leading-tight">{order.clientName}</h3>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${badgeStyle}`}>
                        {order.status === OrderStatus.PAGADO ? '$ Pagado' : 'Entregado'}
                    </span>
                    {currentUser.role === 'vale' && (
                        <button 
                            onClick={handleDeleteClick}
                            className={`p-1.5 rounded-full transition-all ${
                                isConfirmingDelete 
                                ? 'bg-red-500 text-white shadow-red-500/50 shadow-md' 
                                : 'bg-surfaceHighlight text-muted hover:text-red-500 hover:bg-red-500/10'
                            }`}
                            title="Eliminar del historial"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Sub: ID */}
            <p className="text-muted text-xs font-mono tracking-wide opacity-70 -mt-2">{order.displayId}</p>

            {/* Grid Layout for details */}
            <div className="grid grid-cols-[100px_1fr] gap-y-2 text-sm mt-2">
                
                {/* Productos */}
                <div className="text-muted">Productos:</div>
                <div className="text-text font-bold text-right md:text-left">{order.productCount}</div>

                {/* Devueltos (Conditional) */}
                {hasReturns && (
                    <>
                        <div className="text-blue-500 font-bold flex items-center gap-1">
                            <RotateCcw size={12}/> Devueltos:
                        </div>
                        <div className="text-blue-500 font-bold text-right md:text-left">{returnedCount}</div>
                    </>
                )}

                 {/* Faltantes (Conditional) */}
                 {hasShortages && (
                    <>
                        <div className="text-red-500 font-bold flex items-center gap-1">
                            <AlertTriangle size={12}/> Faltantes:
                        </div>
                        <div className="text-red-500 font-bold text-right md:text-left">{missingProducts.length}</div>
                    </>
                )}

                {/* Creado */}
                <div className="text-muted">Creado:</div>
                <div className="text-text font-medium text-right md:text-left">{order.createdDate}</div>

                {/* Armado por */}
                <div className="text-muted">Armado por:</div>
                <div className="text-text font-medium text-right md:text-left">{assemblerName}</div>

                {/* Método de Pago */}
                <div className="text-muted">Método de pago:</div>
                <div className="text-right md:text-left">
                    <span className="inline-block px-3 py-0.5 rounded-full border border-surfaceHighlight bg-surfaceHighlight/30 text-xs font-bold text-text">
                        {order.paymentMethod || 'Pendiente'}
                    </span>
                </div>
            </div>

            {/* Footer Button: Light Green, Full Width */}
            <div className="mt-4">
                <button 
                    onClick={() => onOpenAssembly(order)}
                    className="w-full py-3 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 text-sm font-bold transition-colors flex items-center justify-center gap-2"
                >
                    Haz clic para ver el resumen completo
                </button>
            </div>
        </div>
      );
  }

  // --- LAYOUT VARIANT: ACTIVE ORDERS (Standard Card) ---
  return (
    <div className={`bg-surface rounded-2xl p-6 flex flex-col gap-5 border-t-4 transition-all group relative overflow-hidden shadow-sm hover:shadow-md ${zoneStyles.borderColor} border-l border-r border-b`}>
        {/* Visual Zone Indicator (Gradient Top) */}
        <div className={`absolute top-0 left-0 w-full h-12 bg-gradient-to-b ${zoneStyles.gradient} opacity-50 pointer-events-none`}></div>

      <div className="flex justify-between items-start gap-4 relative z-10">
        <div className="flex flex-col gap-1">
             {order.zone && (
                 <div className={`text-[10px] font-bold uppercase tracking-wide self-start px-2 py-0.5 rounded-full flex items-center gap-1 ${zoneStyles.badgeBg} ${zoneStyles.badgeText}`}>
                     <Compass size={10} />
                     {order.zone}
                 </div>
             )}
            <h3 className="text-text text-lg font-black uppercase leading-tight">{order.clientName}</h3>
            <p className="text-muted text-xs font-mono tracking-wide opacity-70">{order.displayId}</p>
        </div>
        <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${badgeStyle}`}>
          {badgeIcon}
          {ORDER_WORKFLOW[order.status]?.label || order.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-y-3 text-sm border-y border-surfaceHighlight py-4 relative z-10">
        <div className="text-muted">Productos:</div>
        <div className="text-text font-bold text-right">{order.productCount}</div>
        
        {showFinancials && (
            <>
                <div className="text-muted">Total:</div>
                <div className={`${totalColor} font-black text-right text-lg`}>
                    $ {order.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
            </>
        )}
        {!showFinancials && (
             <>
                <div className="text-muted">Total:</div>
                <div className="text-muted text-right italic">Oculto</div>
            </>
        )}
        
        <div className="text-muted">Creado:</div>
        <div className="text-text text-right">{order.createdDate}</div>
        
        {/* Show who assembled it if in later stages */}
        {(order.status === OrderStatus.ARMADO || order.status === OrderStatus.ARMADO_CONTROLADO) && (
            <>
                <div className="text-muted">Armado por:</div>
                <div className="text-text text-right font-medium text-xs flex items-center justify-end gap-1">
                    <UserCheck size={12} />
                    {assemblerName}
                </div>
            </>
        )}
      </div>
      
      {/* Shortage Alert */}
      {currentUser.role === 'vale' && hasShortages && (
          <div className="px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center gap-2 text-xs font-bold text-orange-600 dark:text-orange-400 relative z-10">
              <AlertTriangle size={14} />
              <span>{missingProducts.length} producto(s) con faltantes</span>
          </div>
      )}

      {/* Buttons Container */}
      <div className="flex flex-col gap-3 mt-auto relative z-20">
        
        {canInvoice && (
            <button 
                type="button"
                onClick={handleInvoiceClick}
                disabled={isGeneratingInvoice}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold transition-all shadow-lg shadow-purple-500/20 disabled:opacity-70 disabled:cursor-wait"
            >
                {isGeneratingInvoice ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                {isGeneratingInvoice ? "Generando Factura..." : "Facturar Pedido"}
            </button>
        )}

        {canControlInvoice && (
             <button 
                type="button"
                onClick={() => onOpenAssembly(order)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold transition-all shadow-lg shadow-teal-500/20"
            >
                <ClipboardCheck size={16} />
                Controlar Factura
            </button>
        )}
        
        {canSendToTransit && (
            <div className="flex gap-2">
                <button 
                    type="button"
                    onClick={() => onOpenAssembly(order)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border border-surfaceHighlight hover:bg-surfaceHighlight text-text text-sm font-bold transition-colors"
                >
                    <Eye size={16} />
                    Ver/Editar
                </button>
                <button 
                    type="button"
                    onClick={handleQuickAdvance}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-500/20"
                >
                    <Truck size={16} />
                    Reparto
                </button>
            </div>
        )}

        {canDeliver && (
            <div className="flex gap-2">
                <button 
                    type="button"
                    onClick={() => onOpenAssembly(order)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border border-surfaceHighlight hover:bg-surfaceHighlight text-text text-sm font-bold transition-colors"
                >
                    <Eye size={16} />
                    Ver/Devolver
                </button>
                <button 
                    type="button"
                    onClick={handleQuickAdvance}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-all shadow-lg shadow-blue-500/20"
                >
                    <MapPin size={16} />
                    Entregado
                </button>
            </div>
        )}

        {canAssemble && (
            <button 
                type="button"
                onClick={() => onOpenAssembly(order)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-primary hover:bg-primaryHover text-white text-sm font-bold transition-colors shadow-lg shadow-primary/20"
            >
                <Play size={16} fill="currentColor" />
                Armar Pedido
            </button>
        )}

        {canControl && (
            <button 
                type="button"
                onClick={() => onOpenAssembly(order)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors shadow-lg shadow-orange-500/20"
            >
                <ShieldCheck size={16} />
                Controlar Armado
            </button>
        )}

        {blockedFromControl && (
             <div className="w-full py-3 px-2 rounded-lg bg-surfaceHighlight/50 border border-surfaceHighlight text-muted text-xs font-medium text-center flex flex-col items-center gap-1">
                 <div className="flex items-center gap-1 text-orange-500 font-bold">
                    <Lock size={12} />
                    Esperando Control
                 </div>
                 <span>No puedes controlar tu propio armado.</span>
             </div>
        )}

        {!canAssemble && !canControl && !blockedFromControl && !canControlInvoice && !canSendToTransit && !canDeliver && (
            <button 
                type="button"
                onClick={() => onOpenAssembly(order)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-surfaceHighlight hover:bg-surfaceHighlight text-text text-sm font-bold transition-colors cursor-pointer"
            >
                {order.status === OrderStatus.EN_ARMADO ? <Edit2 size={16} /> : <Eye size={16} />}
                {order.status === OrderStatus.EN_ARMADO ? "Editar Presupuesto" : "Ver Detalle"}
            </button>
        )}
        
        {currentUser.role === 'vale' && (
            <button 
                type="button"
                onClick={handleDeleteClick}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer select-none
                    ${isConfirmingDelete 
                        ? 'bg-red-600 text-white shadow-lg shadow-red-500/30' 
                        : 'bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-600'
                    }`}
            >
                {isConfirmingDelete ? <XCircle size={16} /> : <Trash2 size={16} />}
                {isConfirmingDelete ? "¿Confirmar eliminación?" : "Eliminar Pedido"}
            </button>
        )}
      </div>
    </div>
  );
};

const DollarSignIcon = ({ size }: { size: number }) => (
    <span style={{ fontSize: size, fontWeight: 'bold' }}>$</span>
);