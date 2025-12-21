
import React, { useMemo, useState } from 'react';
import { 
  ShoppingBag, 
  TrendingUp, 
  CircleDollarSign, 
  AlertOctagon, 
  ChevronRight, 
  Filter,
  Download,
  MoreVertical,
  CalendarDays
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Order, DetailedOrder, OrderStatus, View, ExpirationItem, ProductExpiration } from '../types';

interface DashboardProps {
  orders: DetailedOrder[];
  expirations: ProductExpiration[];
  onNavigate: (view: View) => void;
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const YEARS = [2023, 2024, 2025];

export const Dashboard: React.FC<DashboardProps> = ({ orders, expirations, onNavigate }) => {
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  // --- DINAMISMO DE DATOS FILTRADOS ---
  
  const filteredOrders = useMemo(() => {
    return (orders || []).filter(order => {
      const parts = order.createdDate.split('/');
      if (parts.length !== 3) return false;
      const m = parseInt(parts[1]) - 1; 
      const y = parseInt(parts[2]);
      return m === filterMonth && y === filterYear;
    });
  }, [orders, filterMonth, filterYear]);

  // Cálculo de datos para el gráfico de tendencia (Pedidos por semana)
  const dynamicChartData = useMemo(() => {
    const counts = [0, 0, 0, 0]; // Semanas 1, 2, 3, 4+
    
    filteredOrders.forEach(order => {
      const parts = order.createdDate.split('/');
      const day = parseInt(parts[0]);
      
      if (day <= 7) counts[0]++;
      else if (day <= 14) counts[1]++;
      else if (day <= 21) counts[2]++;
      else counts[3]++;
    });

    return [
      { name: 'Sem 1', value: counts[0] },
      { name: 'Sem 2', value: counts[1] },
      { name: 'Sem 3', value: counts[2] },
      { name: 'Sem 4', value: counts[3] },
    ];
  }, [filteredOrders]);

  // 1. Pedidos del Periodo
  const totalOrdersCount = filteredOrders.length;

  // 2. Ingresos del Periodo
  const monthlyIncome = useMemo(() => {
    return filteredOrders
      .filter(o => o.status === OrderStatus.ENTREGADO || o.status === OrderStatus.PAGADO)
      .reduce((acc, current) => acc + (current.total || 0), 0);
  }, [filteredOrders]);

  // 3. Pagos Pendientes del Periodo
  const pendingPaymentsCount = useMemo(() => {
    return filteredOrders.filter(o => o.status === OrderStatus.ENTREGADO).length;
  }, [filteredOrders]);

  // 4. Vencimientos Críticos
  const criticalExpirationsCount = useMemo(() => {
    return (expirations || []).filter(e => e.status === 'CRÍTICO').length;
  }, [expirations]);

  // 5. Mapeo para la lista de vencimientos del Dashboard (Críticos y Próximos)
  const dashboardExpirationsList: ExpirationItem[] = useMemo(() => {
    return (expirations || [])
      .filter(e => e.status === 'CRÍTICO' || e.status === 'PRÓXIMO')
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 5)
      .map(e => ({
        id: e.id,
        title: e.productName,
        subtitle: e.daysRemaining < 0 ? 'Vencido' : `${e.daysRemaining} días restantes`,
        dateDay: e.expiryDate.getDate().toString().padStart(2, '0'),
        dateMonth: e.expiryDate.toLocaleString('es-AR', { month: 'short' }).toUpperCase().replace('.', ''),
        isUrgent: e.status === 'CRÍTICO'
      }));
  }, [expirations]);

  // 6. Últimas Órdenes del Periodo para la tabla
  const recentOrdersReal = useMemo(() => {
    return [...filteredOrders].slice(0, 5);
  }, [filteredOrders]);

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Heading Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-text text-3xl md:text-4xl font-black tracking-tight">Tablero Principal</h2>
          <p className="text-muted text-sm mt-1">Análisis de rendimiento por periodo.</p>
        </div>
        
        {/* Filtro de Fechas */}
        <div className="flex items-center gap-2 bg-surface p-1.5 rounded-2xl border border-surfaceHighlight shadow-sm w-full sm:w-auto">
          <div className="flex items-center gap-2 px-3 text-muted">
            <CalendarDays size={18} />
          </div>
          <select 
            value={filterMonth} 
            onChange={(e) => setFilterMonth(parseInt(e.target.value))}
            className="bg-transparent text-sm font-bold text-text outline-none cursor-pointer py-1.5 pr-2 focus:ring-0"
          >
            {MONTHS.map((name, i) => (
              <option key={name} value={i} className="bg-surface text-text">{name}</option>
            ))}
          </select>
          <div className="h-4 w-px bg-surfaceHighlight mx-1"></div>
          <select 
            value={filterYear} 
            onChange={(e) => setFilterYear(parseInt(e.target.value))}
            className="bg-transparent text-sm font-bold text-text outline-none cursor-pointer py-1.5 pr-4 focus:ring-0"
          >
            {YEARS.map(y => (
              <option key={y} value={y} className="bg-surface text-text">{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          icon={<ShoppingBag size={24} />}
          label={`Pedidos ${MONTHS[filterMonth]}`}
          value={(totalOrdersCount || 0).toLocaleString()}
          pill="Del Mes"
          pillColor="text-primary"
          pillBg="bg-primary/10"
        />
        <KPICard 
          icon={<CircleDollarSign size={24} />}
          label="Pagos Pendientes"
          value={(pendingPaymentsCount || 0).toLocaleString()}
          pill="Sin Cobrar"
          pillColor="text-orange-400"
          pillBg="bg-orange-400/10"
        />
        <KPICard 
          icon={<TrendingUp size={24} />}
          label={`Ingresos ${MONTHS[filterMonth]}`}
          value={`$ ${(monthlyIncome || 0).toLocaleString('es-AR')}`}
          trend="Real"
          trendColor="text-green-500"
          trendBg="bg-green-500/10"
        />
        <KPICard 
          icon={<AlertOctagon size={24} />}
          label="Vencimientos Críticos"
          value={criticalExpirationsCount.toString()}
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
              <p className="text-muted text-sm">Cantidad de pedidos por semana ({MONTHS[filterMonth]} {filterYear})</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-primary"></span>
              <span className="text-sm text-text font-medium">Volumen Semanal</span>
            </div>
          </div>
          
          <div className="h-64 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dynamicChartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="name" 
                  hide={false} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 10, fontWeight: 'bold', fill: 'var(--muted)'}} 
                />
                <YAxis hide={true} />
                <Tooltip 
                  cursor={{stroke: 'var(--surface-highlight)', strokeWidth: 2}}
                  contentStyle={{ 
                    backgroundColor: 'var(--surface)', 
                    borderColor: 'var(--surface-highlight)', 
                    borderRadius: '12px', 
                    color: 'var(--text)',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                  }}
                  itemStyle={{ color: 'var(--primary)' }}
                  formatter={(value) => [`${value} pedidos`, 'Cantidad']}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="var(--primary)" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between text-muted text-[10px] font-black uppercase tracking-widest mt-2 px-2">
            <span>Días 1-7</span>
            <span>Días 8-14</span>
            <span>Días 15-21</span>
            <span>Días 22+</span>
          </div>
        </div>

        {/* Expirations List */}
        <div className="flex flex-col gap-4 bg-surface p-6 rounded-2xl border border-surfaceHighlight shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-text text-lg font-bold">Vencimientos</h3>
            <button onClick={() => onNavigate(View.EXPIRATIONS)} className="text-primary text-sm font-bold hover:underline">Ver todo</button>
          </div>
          <div className="flex flex-col gap-3 mt-2">
            {dashboardExpirationsList.map((item) => (
              <ExpirationRow key={item.id} item={item} onClick={() => onNavigate(View.EXPIRATIONS)} />
            ))}
            {dashboardExpirationsList.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 opacity-40">
                <AlertOctagon size={32} className="text-muted mb-2" />
                <p className="text-xs text-muted font-bold italic text-center">Sin alertas de vencimiento próximas.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="flex flex-col gap-4 bg-surface p-6 rounded-2xl border border-surfaceHighlight shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-text text-lg font-bold">Pedidos de {MONTHS[filterMonth]}</h3>
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
                <th className="p-4 font-medium text-center">Estado</th>
                <th className="p-4 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surfaceHighlight text-sm">
              {recentOrdersReal.map((order) => (
                <OrderRow key={order.id} order={order} onNavigate={() => onNavigate(View.ORDERS)} />
              ))}
              {recentOrdersReal.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-muted italic">No hay pedidos registrados en {MONTHS[filterMonth]} {filterYear}.</td>
                </tr>
              )}
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
        <span className={`flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded-full ${trendColor} ${trendBg}`}>
          {trend}
        </span>
      )}
      {pill && (
        <span className={`flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded-full ${pillColor} ${pillBg}`}>
          <AlertOctagon size={12} />
          {pill}
        </span>
      )}
    </div>
    <div>
      <p className="text-muted text-xs font-bold uppercase tracking-widest">{label}</p>
      <p className="text-text text-3xl font-black mt-1 tracking-tighter">{value}</p>
    </div>
  </div>
);

const ExpirationRow: React.FC<{ item: ExpirationItem; onClick?: () => void }> = ({ item, onClick }) => (
  <div onClick={onClick} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-surfaceHighlight hover:border-primary/30 transition-colors cursor-pointer group">
    <div className={`flex flex-col items-center justify-center h-10 w-10 rounded bg-surface border text-text shrink-0 group-hover:border-primary/30 transition-colors ${item.isUrgent ? 'border-red-500/50' : 'border-surfaceHighlight'}`}>
      <span className="text-[10px] font-bold uppercase text-muted">{item.dateMonth}</span>
      <span className={`text-lg font-bold leading-none ${item.isUrgent ? 'text-red-500' : 'text-text'}`}>{item.dateDay}</span>
    </div>
    <div className="flex flex-col flex-1 min-w-0">
      <p className="text-text text-sm font-bold truncate uppercase tracking-tight">{item.title}</p>
      <p className={`text-[10px] font-black uppercase tracking-widest ${item.isUrgent ? 'text-red-500' : 'text-muted'}`}>
        {item.subtitle}
      </p>
    </div>
    <ChevronRight size={18} className="text-muted group-hover:text-primary transition-colors" />
  </div>
);

const OrderRow: React.FC<{ order: Order; onNavigate: () => void }> = ({ order, onNavigate }) => {
  const initials = order.customerInitials || order.clientName.substring(0, 2).toUpperCase();
  const colorClass = order.customerColor || "bg-primary/10 text-primary";

  return (
    <tr className="group hover:bg-surfaceHighlight/50 transition-colors cursor-pointer" onClick={onNavigate}>
      <td className="p-4 text-text font-medium text-xs font-mono">{order.displayId}</td>
      <td className="p-4 text-text flex items-center gap-2">
        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${colorClass}`}>
          {initials}
        </div>
        <span className="font-bold text-xs uppercase">{order.clientName}</span>
      </td>
      <td className="p-4 text-muted text-xs font-mono">{order.createdDate}</td>
      <td className="p-4 text-text font-black text-xs">$ {(order.total || 0).toLocaleString('es-AR')}</td>
      <td className="p-4 text-center">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border
          ${order.status === OrderStatus.PAGADO ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
            order.status === OrderStatus.ENTREGADO ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
            'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
          }`}>
          {order.status.replace('_', ' ')}
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
