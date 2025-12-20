import React from 'react';
import { 
  ShoppingBag, 
  TrendingUp, 
  CircleDollarSign, 
  AlertOctagon, 
  Plus, 
  ChevronRight, 
  Filter,
  Download,
  MoreVertical
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { CHART_DATA, EXPIRATIONS, RECENT_ORDERS } from '../constants';
import { Order, ExpirationItem, OrderStatus } from '../types';

export const Dashboard: React.FC = () => {
  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Heading Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-text text-3xl md:text-4xl font-black tracking-tight">Tablero Principal</h2>
        <button className="flex items-center gap-2 bg-primary hover:bg-primaryHover text-white px-5 py-2.5 rounded-full text-sm font-bold transition-colors shadow-lg shadow-primary/20">
          <Plus size={20} />
          Nuevo Pedido
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          icon={<ShoppingBag size={24} />}
          label="Pedidos Totales"
          value="1,245"
          trend="+12%"
          trendColor="text-primary"
          trendBg="bg-primary/10"
        />
        <KPICard 
          icon={<CircleDollarSign size={24} />}
          label="Pagos Pendientes"
          value="23"
          pill="Pendiente"
          pillColor="text-orange-400"
          pillBg="bg-orange-400/10"
        />
        <KPICard 
          icon={<TrendingUp size={24} />}
          label="Ingresos Mensuales"
          value="$45,200"
          trend="+8%"
          trendColor="text-green-500"
          trendBg="bg-green-500/10"
        />
        <KPICard 
          icon={<AlertOctagon size={24} />}
          label="Vencimientos Próximos"
          value="5"
          pill="Urgente"
          pillColor="text-red-500"
          pillBg="bg-red-500/10"
        />
      </div>

      {/* Main Grid: Chart & Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart Section */}
        <div className="lg:col-span-2 flex flex-col gap-4 bg-surface p-6 rounded-2xl border border-surfaceHighlight shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-text text-lg font-bold">Tendencia de Pedidos</h3>
              <p className="text-muted text-sm">Últimos 30 días</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-primary"></span>
              <span className="text-sm text-text font-medium">Completados</span>
            </div>
          </div>
          
          <div className="h-64 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={CHART_DATA}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--surface)', 
                    borderColor: 'var(--surface-highlight)', 
                    borderRadius: '8px', 
                    color: 'var(--text)',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' 
                  }}
                  itemStyle={{ color: 'var(--text)' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="var(--primary)" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between text-muted text-xs font-bold mt-2 px-2">
            <span>Sem 1</span>
            <span>Sem 2</span>
            <span>Sem 3</span>
            <span>Sem 4</span>
          </div>
        </div>

        {/* Expirations List */}
        <div className="flex flex-col gap-4 bg-surface p-6 rounded-2xl border border-surfaceHighlight shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-text text-lg font-bold">Vencimientos</h3>
            <button className="text-primary text-sm font-bold hover:underline">Ver todo</button>
          </div>
          <div className="flex flex-col gap-3 mt-2">
            {EXPIRATIONS.map((item) => (
              <ExpirationRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="flex flex-col gap-4 bg-surface p-6 rounded-2xl border border-surfaceHighlight shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-text text-lg font-bold">Pedidos Recientes</h3>
          <div className="flex gap-2">
            <button className="p-2 rounded-full bg-background text-muted hover:text-text transition-colors border border-surfaceHighlight">
              <Filter size={18} />
            </button>
            <button className="p-2 rounded-full bg-background text-muted hover:text-text transition-colors border border-surfaceHighlight">
              <Download size={18} />
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto rounded-lg border border-surfaceHighlight">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background/50 text-muted text-xs uppercase tracking-wider border-b border-surfaceHighlight">
                <th className="p-4 font-medium">ID Pedido</th>
                <th className="p-4 font-medium">Cliente</th>
                <th className="p-4 font-medium">Fecha</th>
                <th className="p-4 font-medium">Monto</th>
                <th className="p-4 font-medium">Estado</th>
                <th className="p-4 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surfaceHighlight text-sm">
              {RECENT_ORDERS.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- Sub Components ---

const KPICard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: string;
  trendColor?: string;
  trendBg?: string;
  pill?: string;
  pillColor?: string;
  pillBg?: string;
}> = ({ icon, label, value, trend, trendColor, trendBg, pill, pillColor, pillBg }) => (
  <div className="flex flex-col justify-between gap-4 rounded-xl p-6 bg-surface hover:bg-surfaceHighlight transition-colors border border-surfaceHighlight hover:border-primary/20 group shadow-sm">
    <div className="flex justify-between items-start">
      <div className="p-2 bg-background rounded-full text-text group-hover:text-primary transition-colors">
        {icon}
      </div>
      {trend && (
        <span className={`flex items-center gap-1 text-sm font-bold px-2 py-1 rounded-full ${trendColor} ${trendBg}`}>
          <TrendingUp size={14} />
          {trend}
        </span>
      )}
      {pill && (
        <span className={`flex items-center gap-1 text-sm font-bold px-2 py-1 rounded-full ${pillColor} ${pillBg}`}>
          <AlertOctagon size={14} />
          {pill}
        </span>
      )}
    </div>
    <div>
      <p className="text-muted text-sm font-medium">{label}</p>
      <p className="text-text text-3xl font-bold mt-1">{value}</p>
    </div>
  </div>
);

const ExpirationRow: React.FC<{ item: ExpirationItem }> = ({ item }) => (
  <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-surfaceHighlight hover:border-primary/30 transition-colors cursor-pointer group">
    <div className="flex flex-col items-center justify-center h-10 w-10 rounded bg-surface border border-surfaceHighlight text-text shrink-0 group-hover:border-primary/30 transition-colors">
      <span className="text-[10px] font-bold uppercase text-muted">{item.dateMonth}</span>
      <span className="text-lg font-bold leading-none">{item.dateDay}</span>
    </div>
    <div className="flex flex-col flex-1 min-w-0">
      <p className="text-text text-sm font-medium truncate">{item.title}</p>
      <p className={`text-xs font-medium ${item.isUrgent ? 'text-red-500' : 'text-muted'}`}>
        {item.subtitle}
      </p>
    </div>
    <ChevronRight size={18} className="text-muted group-hover:text-primary transition-colors" />
  </div>
);

const OrderRow: React.FC<{ order: Order }> = ({ order }) => {
  const initials = order.customerInitials || order.clientName.substring(0, 2).toUpperCase();
  const colorClass = order.customerColor || "bg-primary/10 text-primary";

  return (
    <tr className="group hover:bg-surfaceHighlight/50 transition-colors">
      <td className="p-4 text-text font-medium">{order.id}</td>
      <td className="p-4 text-text flex items-center gap-2">
        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${colorClass}`}>
          {initials}
        </div>
        {order.clientName}
      </td>
      <td className="p-4 text-muted">{order.createdDate}</td>
      <td className="p-4 text-text font-bold">${order.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      <td className="p-4">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
          ${order.status === OrderStatus.PAGADO ? 'bg-primary/10 text-primary' : 
            order.status === OrderStatus.EN_ARMADO ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500' : 'bg-gray-500/10 text-gray-500'
          }`}>
          {order.status}
        </span>
      </td>
      <td className="p-4 text-right">
        <button className="text-muted hover:text-text">
          <MoreVertical size={18} />
        </button>
      </td>
    </tr>
  );
};