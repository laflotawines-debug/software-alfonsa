
import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  CreditCard, 
  Wallet, 
  AlertTriangle, 
  History, 
  List, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Calculator,
  ChevronDown,
  Users,
  FileText,
  X,
  Wrench,
  Table,
  Database,
  Tag,
  MessageSquareQuote,
  Boxes,
  Truck,
  Warehouse,
  ArrowRightLeft,
  ClipboardList,
  Contact2,
  Library,
  ClipboardCheck
} from 'lucide-react';
import { NavItem, View, User } from '../types';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  currentUser: User; 
  isOpen?: boolean; 
  onClose?: () => void;
}

const NAV_STRUCTURE: NavItem[] = [
  { 
    id: View.DASHBOARD, 
    label: 'Tablero', 
    icon: <LayoutDashboard size={20} />,
    permission: 'dashboard.view'
  },
  { 
    id: View.ORDERS, 
    label: 'Pedidos', 
    icon: <ShoppingBag size={20} />,
    subItems: [
        { id: View.ORDERS, label: 'Gestión de pedidos', icon: <List size={16} />, permission: 'orders.view' },
        { id: View.ORDER_SHEET, label: 'Planilla de Viajes', icon: <Table size={16} />, permission: 'orders.sheet' },
    ]
  },
  { 
    id: View.PAYMENTS_OVERVIEW, 
    label: 'Gestión de pagos', 
    icon: <CreditCard size={20} />,
    subItems: [
        { id: View.PAYMENTS_OVERVIEW, label: 'Vista general', icon: <CreditCard size={16} />, permission: 'payments.view' },
        { id: View.PAYMENTS_PROVIDERS, label: 'Proveedores Pagos', icon: <Users size={16} />, permission: 'payments.providers' },
        { id: View.PAYMENTS_HISTORY, label: 'Historial', icon: <FileText size={16} />, permission: 'payments.history' },
    ]
  },
  {
    id: View.INV_INBOUNDS,
    label: 'Inventario',
    icon: <Warehouse size={20} />,
    subItems: [
        { id: View.INV_INBOUNDS, label: 'Ingresos', icon: <Truck size={16} />, permission: 'inventory.inbounds' },
        { id: View.INV_ADJUSTMENTS, label: 'Ajustes', icon: <Calculator size={16} />, permission: 'inventory.adjustments' },
        { id: View.INV_TRANSFERS, label: 'Transferencias', icon: <ArrowRightLeft size={16} />, permission: 'inventory.transfers' },
        { id: View.INV_HISTORY, label: 'Seguimiento', icon: <ClipboardList size={16} />, permission: 'inventory.history' },
    ]
  },
  { 
    id: View.CATALOG, 
    label: 'Maestros', 
    icon: <Library size={20} />,
    subItems: [
        { id: View.CATALOG, label: 'Artículos', icon: <Boxes size={16} />, permission: 'catalog.products' },
        { id: View.CLIENTS_MASTER, label: 'Clientes', icon: <Contact2 size={16} />, permission: 'catalog.clients' },
        { id: View.SUPPLIERS_MASTER, label: 'Proveedores', icon: <Truck size={16} />, permission: 'catalog.suppliers' },
    ]
  },
  { 
    id: View.PRESUPUESTADOR,
    label: 'Herramientas', 
    icon: <Wrench size={20} />,
    subItems: [
        { id: View.PRESUPUESTADOR, label: 'Presupuestador', icon: <Calculator size={16} />, permission: 'tools.presupuestador' },
        { id: View.ETIQUETADOR, label: 'Etiquetador', icon: <Tag size={16} />, permission: 'tools.etiquetador' },
        { id: View.EXPIRATIONS, label: 'Vencimientos', icon: <AlertTriangle size={16} />, permission: 'tools.expirations' },
        { id: View.LISTA_CHINA, label: 'Lista china', icon: <MessageSquareQuote size={16} />, permission: 'tools.lista_china' },
        { id: View.SQL_EDITOR, label: 'Editor SQL', icon: <Database size={16} />, permission: 'tools.sql_editor' },
    ]
  },
  { id: View.HISTORY, label: 'Historial', icon: <History size={20} />, permission: 'history.view' },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, currentUser, isOpen = false, onClose }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    if (!isCollapsed) setExpandedMenu(null); 
  };

  const hasPermission = (permissionKey?: string) => {
      if (currentUser.role === 'vale') return true;
      if (!permissionKey) return true;
      return (currentUser.permissions || []).includes(permissionKey);
  };

  const filteredNav = NAV_STRUCTURE.map(item => {
    const allowedSubItems = item.subItems ? item.subItems.filter(sub => hasPermission(sub.permission)) : undefined;
    return { ...item, subItems: allowedSubItems };
  }).filter(item => {
    if (item.subItems) return item.subItems.length > 0;
    return hasPermission(item.permission);
  });

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-surface border-r border-surfaceHighlight transition-transform duration-300 ease-in-out flex flex-col
        lg:translate-x-0 lg:static shrink-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isCollapsed && !isOpen ? 'lg:w-20' : 'lg:w-72'}
      `}>
        
        <div className="lg:hidden flex items-center justify-between p-6 border-b border-surfaceHighlight bg-surface shrink-0">
            <span className="font-black text-lg text-text uppercase italic tracking-widest">Menú</span>
            <button onClick={onClose} className="p-2 text-muted rounded-xl hover:bg-surfaceHighlight transition-colors">
                <X size={24} />
            </button>
        </div>

        <button 
            onClick={toggleCollapse}
            className="hidden lg:flex absolute -right-3 top-9 z-10 bg-surface border border-surfaceHighlight rounded-full p-1.5 text-muted hover:text-primary transition-colors shadow-sm"
        >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className={`p-6 flex items-center ${isCollapsed ? 'lg:justify-center' : ''} h-24 shrink-0`}>
          {isCollapsed ? (
              <div className="h-10 w-10 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-bold text-xl">A</div>
          ) : (
              <div className="animate-in fade-in duration-200">
                  <h1 className="text-2xl font-black text-text tracking-tight italic uppercase">Alfonsa</h1>
                  <p className="text-muted text-[10px] font-black uppercase tracking-widest mt-1">Panel Administrativo</p>
              </div>
          )}
        </div>

        <nav className="flex flex-col gap-2 flex-1 px-3 overflow-y-auto overflow-x-hidden pt-4 scroll-smooth">
          {filteredNav.map((item) => {
            const hasSubItems = !!item.subItems && item.subItems.length > 0;
            const isParentOfActive = item.subItems?.some(sub => sub.id === currentView);
            const isExpanded = expandedMenu === item.label;
            
            return (
              <div key={item.id} className="relative group shrink-0">
                <div className={`flex items-center rounded-xl transition-all duration-200 w-full select-none ${isParentOfActive && !isExpanded ? 'bg-primary/10 text-primary font-bold' : 'text-text hover:bg-surfaceHighlight'}`}>
                    <button
                      onClick={() => {
                          if (hasSubItems) {
                              setExpandedMenu(isExpanded ? null : item.label);
                              if (isCollapsed) setIsCollapsed(false);
                          } else {
                              onNavigate(item.id);
                          }
                      }}
                      className={`flex items-center gap-3 px-3 py-3 flex-1 text-left outline-none ${isCollapsed ? 'lg:justify-center' : ''}`}
                    >
                          <span className={`${isParentOfActive ? 'text-primary' : 'text-muted group-hover:text-text'} transition-colors`}>{item.icon}</span>
                          {(!isCollapsed || isOpen) && <span className="whitespace-nowrap font-bold text-xs uppercase tracking-wide">{item.label}</span>}
                    </button>
                    {(!isCollapsed || isOpen) && hasSubItems && (
                       <button onClick={(e) => { e.stopPropagation(); setExpandedMenu(isExpanded ? null : item.label); if (isCollapsed) setIsCollapsed(false); }} className="p-3 text-muted hover:text-text transition-transform outline-none">
                          <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                       </button>
                    )}
                </div>

                {(!isCollapsed || isOpen) && hasSubItems && (
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-80 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                        <div className="flex flex-col gap-1 pl-10 pr-2 pb-2">
                          {item.subItems!.map((sub) => (
                              <button key={sub.id} onClick={() => onNavigate(sub.id)} className={`text-left text-[11px] font-black uppercase py-2 px-3 rounded-lg transition-colors flex items-center gap-2 ${currentView === sub.id ? 'text-primary bg-primary/5' : 'text-muted hover:text-text hover:bg-surfaceHighlight/50'}`}>
                                  {sub.icon} {sub.label}
                              </button>
                          ))}
                        </div>
                    </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-surfaceHighlight p-3 shrink-0 bg-surface z-10">
          <button onClick={() => onNavigate(View.SETTINGS)} className={`flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-200 w-full text-left group relative ${currentView === View.SETTINGS ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-surfaceHighlight hover:text-text'} ${isCollapsed ? 'lg:justify-center' : ''}`}>
            <Settings size={20} />
            {(!isCollapsed || isOpen) && <span>Configuración</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
