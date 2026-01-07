
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
import { SYSTEM_NAV_STRUCTURE } from '../logic';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  currentUser: User; 
  isOpen?: boolean; 
  onClose?: () => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
    [View.DASHBOARD]: <LayoutDashboard size={20} />,
    [View.ORDERS]: <ShoppingBag size={20} />,
    [View.PAYMENTS_OVERVIEW]: <CreditCard size={20} />,
    [View.INV_INBOUNDS]: <Warehouse size={20} />,
    [View.CATALOG]: <Library size={20} />,
    [View.PRESUPUESTADOR]: <Wrench size={20} />,
    [View.HISTORY]: <History size={20} />,
    'list': <List size={16} />,
    'table': <Table size={16} />,
    'credit-card': <CreditCard size={16} />,
    'users': <Users size={16} />,
    'file-text': <FileText size={16} />,
    'truck': <Truck size={16} />,
    'calculator': <Calculator size={16} />,
    'arrow-right-left': <ArrowRightLeft size={16} />,
    'clipboard-list': <ClipboardList size={16} />,
    'boxes': <Boxes size={16} />,
    'contact-2': <Contact2 size={16} />,
    'clipboard-check': <ClipboardCheck size={16} />,
    'tag': <Tag size={16} />,
    'alert-triangle': <AlertTriangle size={16} />,
    'message-square-quote': <MessageSquareQuote size={16} />,
    'database': <Database size={16} />
};

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

  const filteredNav = SYSTEM_NAV_STRUCTURE.map(item => {
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
            <img src="icon.png" alt="Logo" className="h-8 w-8 object-contain" />
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

        <div className={`p-6 flex items-center ${isCollapsed ? 'lg:justify-center' : ''} h-28 shrink-0`}>
          {isCollapsed ? (
              <img src="icon.png" alt="Logo" className="h-10 w-10 object-contain" />
          ) : (
              <div className="flex items-center gap-4 animate-in fade-in duration-300">
                  <img src="icon.png" alt="Logo" className="h-14 w-14 object-contain drop-shadow-md" />
                  <div className="flex flex-col">
                      <h1 className="text-xl font-black text-text tracking-tighter uppercase italic leading-none">Alfonsa</h1>
                      <p className="text-primary text-[9px] font-black uppercase tracking-[0.2em] mt-1">Management</p>
                  </div>
              </div>
          )}
        </div>

        <nav className="flex flex-col gap-1 flex-1 px-3 overflow-y-auto overflow-x-hidden pt-2 scroll-smooth">
          {filteredNav.map((item) => {
            const hasSubItems = !!item.subItems && item.subItems.length > 0;
            const isParentOfActive = item.subItems?.some(sub => sub.id === currentView);
            const isExpanded = expandedMenu === item.label;
            const icon = ICON_MAP[item.id] || <Wrench size={20} />;
            
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
                          <span className={`${isParentOfActive ? 'text-primary' : 'text-muted group-hover:text-text'} transition-colors`}>{icon}</span>
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
                          {item.subItems!.map((sub) => {
                              let subIcon = <List size={14} />;
                              if (sub.id === View.ORDER_SHEET) subIcon = <Table size={14} />;
                              if (sub.id === View.PAYMENTS_PROVIDERS) subIcon = <Users size={14} />;
                              if (sub.id === View.PAYMENTS_HISTORY) subIcon = <FileText size={14} />;
                              if (sub.id === View.INV_INBOUNDS) subIcon = <Truck size={14} />;
                              if (sub.id === View.INV_ADJUSTMENTS) subIcon = <Calculator size={14} />;
                              if (sub.id === View.INV_TRANSFERS) subIcon = <ArrowRightLeft size={14} />;
                              if (sub.id === View.INV_HISTORY) subIcon = <ClipboardList size={14} />;
                              if (sub.id === View.CATALOG) subIcon = <Boxes size={14} />;
                              if (sub.id === View.CLIENTS_MASTER) subIcon = <Contact2 size={14} />;
                              if (sub.id === View.SUPPLIERS_MASTER) subIcon = <Truck size={14} />;
                              if (sub.id === View.STOCK_CONTROL) subIcon = <ClipboardCheck size={14} />;
                              if (sub.id === View.PRESUPUESTADOR) subIcon = <Calculator size={14} />;
                              if (sub.id === View.ETIQUETADOR) subIcon = <Tag size={14} />;
                              if (sub.id === View.EXPIRATIONS) subIcon = <AlertTriangle size={14} />;
                              if (sub.id === View.LISTA_CHINA) subIcon = <MessageSquareQuote size={14} />;
                              if (sub.id === View.SQL_EDITOR) subIcon = <Database size={14} />;

                              return (
                                <button key={sub.id} onClick={() => onNavigate(sub.id)} className={`text-left text-[11px] font-black uppercase py-2 px-3 rounded-lg transition-colors flex items-center gap-2 ${currentView === sub.id ? 'text-primary bg-primary/5' : 'text-muted hover:text-text hover:bg-surfaceHighlight/50'}`}>
                                    {subIcon} {sub.label}
                                </button>
                              );
                          })}
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
