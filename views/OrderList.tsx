
import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  ChevronDown, 
  Package, 
  RefreshCw, 
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
  ChevronRight,
  ArrowRight,
  Receipt,
  Send,
  Undo2,
  History,
  Activity
} from 'lucide-react';
import { DetailedOrder, View, OrderStatus, User, OrderZone } from '../types';
import { ORDER_WORKFLOW, getStatusColor, getZoneStyles, getMissingProducts, getReturnedProducts } from '../logic';

interface OrderListProps {
  onNavigate: (view: View) => void;
  orders: DetailedOrder[];
  currentUser: User;
  onOpenAssembly: (order: DetailedOrder) => void;
  onDeleteOrder: (orderId: string) => void; 
  onAdvanceOrder: (order: DetailedOrder) => void;
}

type TabType = 'active' | 'unpaid' | 'delivered';

export const OrderList: React.FC<OrderListProps> = ({ 
    onNavigate, 
    orders, 
    currentUser, 
    onOpenAssembly, 
    onDeleteOrder,
    onAdvanceOrder 
}) => {
  const [currentTab, setCurrentTab] = useState<TabType>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [zoneFilter, setZoneFilter] = useState<string>('');

  const activeOrders = orders.filter(o => o.status !== OrderStatus.ENTREGADO && o.status !== OrderStatus.PAGADO);
  const deliveredOrders = orders.filter(o => o.status === OrderStatus.ENTREGADO || o.status === OrderStatus.PAGADO);
  const unpaidOrders = orders.filter(o => o.status === OrderStatus.ENTREGADO);

  let currentList = currentTab === 'active' ? activeOrders : currentTab === 'delivered' ? deliveredOrders : unpaidOrders;

  const filteredOrders = currentList.filter(order => {
      const matchesSearch = order.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || order.displayId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesZone = zoneFilter ? order.zone === zoneFilter : true;
      return matchesSearch && matchesZone;
  });

  return (
    <div className="flex flex-col gap-6 pb-10">
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
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-surface text-text border border-surfaceHighlight hover:border-primary/50 transition-all text-sm font-bold shadow-sm">
            <RefreshCw size={18} /> Actualizar
          </button>
          {currentUser.role === 'vale' && (
              <button onClick={() => onNavigate(View.CREATE_BUDGET)} className="flex items-center gap-2 bg-primary hover:bg-primaryHover text-white px-6 py-3 rounded-full text-sm font-black transition-all shadow-lg shadow-primary/20 active:scale-95">
                <Plus size={18} /> Nuevo Presupuesto
              </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="p-1 rounded-xl bg-surface w-full sm:w-fit flex gap-1 border border-surfaceHighlight shadow-sm">
          {[
            { id: 'active', label: 'Activos' },
            { id: 'unpaid', label: 'Sin pagar' },
            { id: 'delivered', label: 'Entregados' }
          ].map((tab) => (
            <button 
                key={tab.id} 
                onClick={() => setCurrentTab(tab.id as TabType)} 
                className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-black transition-all whitespace-nowrap ${currentTab === tab.id ? 'bg-surfaceHighlight text-text shadow-sm' : 'text-muted hover:text-text hover:bg-surfaceHighlight/50'}`}
            >
              {tab.label} ({tab.id === 'active' ? activeOrders.length : tab.id === 'unpaid' ? unpaidOrders.length : deliveredOrders.length})
            </button>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
            <input type="text" placeholder="Buscar por cliente o ID de pedido" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-surface border border-surfaceHighlight focus:border-primary focus:ring-1 focus:ring-primary text-text placeholder-muted text-sm outline-none transition-all shadow-sm" />
          </div>
          <div className="relative min-w-[220px]">
             <Compass className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
             <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} className="w-full appearance-none pl-11 pr-10 py-3.5 rounded-xl bg-surface border border-surfaceHighlight focus:border-primary text-text text-sm cursor-pointer outline-none shadow-sm font-bold">
                <option value="">Todas las Zonas</option>
                <option value="V. Mercedes">V. Mercedes</option>
                <option value="San Luis">San Luis</option>
                <option value="Norte">Norte</option>
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" size={18} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-500">
          {filteredOrders.map((order) => (
              <DetailedOrderCard 
                  key={order.id} 
                  order={order} 
                  currentUser={currentUser} 
                  onOpenAssembly={onOpenAssembly} 
                  onDeleteOrder={onDeleteOrder} 
                  onAdvanceOrder={onAdvanceOrder} 
              />
          ))}
          {filteredOrders.length === 0 && (
              <div className="col-span-full py-24 text-center text-muted border-2 border-dashed border-surfaceHighlight rounded-3xl bg-surface/30 shadow-inner">
                  <Package size={56} className="mx-auto mb-4 opacity-20" />
                  <p className="font-bold text-xl">Sin pedidos para mostrar</p>
              </div>
          )}
      </div>
    </div>
  );
};

const DetailedOrderCard: React.FC<{ order: DetailedOrder; currentUser: User; onOpenAssembly: any; onDeleteOrder: any; onAdvanceOrder: any }> = ({ order, currentUser, onOpenAssembly, onDeleteOrder, onAdvanceOrder }) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const badgeStyle = getStatusColor(order.status);
  const zoneStyles = getZoneStyles(order.zone);
  
  const isFinished = order.status === OrderStatus.ENTREGADO || order.status === OrderStatus.PAGADO;
  const isVale = currentUser.role === 'vale';

  const occupiedByOther = (
    (order.status === OrderStatus.EN_ARMADO && order.assemblerId && order.assemblerId !== currentUser.id) ||
    (order.status === OrderStatus.ARMADO && order.controllerId && order.controllerId !== currentUser.id)
  );
  
  const occupantName = order.status === OrderStatus.EN_ARMADO ? order.assemblerName : order.controllerName;

  const getValeActions = () => {
    const isPostBilling = order.status === OrderStatus.EN_TRANSITO || isFinished;
    
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
                <Loader2 size={14} className="animate-spin" /> {occupiedByOther ? 'Ocupado' : 'Espera'}
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
    let label = "Ver Detalle";
    let icon = <Eye size={14} />;
    let className = "bg-surfaceHighlight text-text hover:bg-surfaceHighlight/80";

    if (order.status === OrderStatus.EN_ARMADO) {
        if (occupiedByOther) {
            label = `Uso: ${occupantName}`;
            icon = <Lock size={14} />;
            className = "bg-red-500/10 text-red-500 cursor-not-allowed";
        } else {
            label = "Armar Pedido";
            icon = <Play size={14} />;
            className = "bg-primary text-white hover:bg-primaryHover";
        }
    } else if (order.status === OrderStatus.ARMADO) {
        if (occupiedByOther) {
            label = `Controlando: ${occupantName}`;
            icon = <Lock size={14} />;
            className = "bg-red-500/10 text-red-500 cursor-not-allowed";
        } else if (order.assemblerId === currentUser.id) {
            label = "Bloqueado (Tuyo)";
            icon = <Lock size={14} />;
            className = "bg-red-500/10 text-red-500 cursor-not-allowed";
        } else {
            label = "Controlar";
            icon = <ShieldCheck size={14} />;
            className = "bg-orange-500 text-white hover:bg-orange-600";
        }
    } else if (order.status === OrderStatus.FACTURADO) {
        label = "Control Factura";
        icon = <ClipboardCheck size={14} />;
        className = "bg-indigo-600 text-white hover:bg-indigo-700";
    }

    return (
        <button 
            disabled={occupiedByOther || (order.status === OrderStatus.ARMADO && order.assemblerId === currentUser.id)}
            onClick={() => onOpenAssembly(order)}
            className={`w-full py-3 rounded-xl font-black uppercase text-[11px] transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 ${className}`}
        >
            {icon} {label}
        </button>
    );
  };

  const missingProducts = getMissingProducts(order);

  return (
    <div className={`bg-surface rounded-xl p-5 flex flex-col gap-3 border transition-all group relative overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 ${zoneStyles.borderColor} border-opacity-40`}>
        <div className="flex justify-between items-start gap-3 mb-0.5">
            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${zoneStyles.badgeBg} ${zoneStyles.badgeText} ${zoneStyles.borderColor}`}>
                {order.zone || 'SIN ZONA'}
            </span>
            <div className="flex flex-col items-end gap-1">
                {occupiedByOther && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-red-500 text-white animate-pulse">
                        <Activity size={8} /> {occupantName}
                    </span>
                )}
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${badgeStyle}`}>
                    <Box size={8} /> {ORDER_WORKFLOW[order.status]?.label || order.status}
                </span>
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
            
            {isVale && (
                <div className="flex justify-between items-center">
                    <span className="text-[11px] text-muted font-bold">Total:</span>
                    <span className="text-lg text-green-600 dark:text-green-400 font-black tracking-tighter">$ {(order.total || 0).toLocaleString('es-AR')}</span>
                </div>
            )}
            
            <div className="flex justify-between items-center">
                <span className="text-[11px] text-muted font-bold">Creado:</span>
                <span className="text-[11px] text-text font-bold">{order.createdDate}</span>
            </div>
            
            {missingProducts.length > 0 && (
                <div className="mt-1 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center gap-2">
                    <AlertTriangle size={12} className="text-orange-500" />
                    <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400">{missingProducts.length} producto(s) con faltantes</span>
                </div>
            )}
        </div>

        <div className="mt-auto pt-3 flex flex-col gap-2">
            {isVale ? getValeActions() : getArmadorActions()}
        </div>

        <div className={`absolute bottom-0 left-0 w-full h-1 ${zoneStyles.borderColor} bg-current opacity-10`}></div>
    </div>
  );
};
