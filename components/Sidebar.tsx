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
  Database
} from 'lucide-react';
import { NavItem, View } from '../types';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  isMobile?: boolean;
  onClose?: () => void;
}

const NAV_STRUCTURE: NavItem[] = [
  { id: View.DASHBOARD, label: 'Tablero', icon: <LayoutDashboard size={20} /> },
  { 
    id: View.ORDERS, 
    label: 'Gestión de pedidos', 
    icon: <ShoppingBag size={20} />,
    subItems: [
        { id: View.ORDER_SHEET, label: 'Planilla', icon: <Table size={16} /> },
    ]
  },
  { 
    id: View.PAYMENTS_OVERVIEW, 
    label: 'Gestión de pagos', 
    icon: <CreditCard size={20} />,
    subItems: [
        { id: View.PAYMENTS_OVERVIEW, label: 'Vista general', icon: <CreditCard size={16} /> },
        { id: View.PAYMENTS_PROVIDERS, label: 'Proveedores', icon: <Users size={16} /> },
        { id: View.PAYMENTS_HISTORY, label: 'Historial', icon: <FileText size={16} /> },
    ]
  },
  { id: View.ACCOUNTS, label: 'Cuentas y mov.', icon: <Wallet size={20} /> },
  { 
    id: View.TOOLS, 
    label: 'Herramientas', 
    icon: <Wrench size={20} />,
    subItems: [
        { id: View.PRESUPUESTADOR, label: 'Presupuestador', icon: <Calculator size={16} /> },
        { id: View.EXPIRATIONS, label: 'Vencimientos', icon: <AlertTriangle size={16} /> },
        { id: View.LISTS, label: 'Listas', icon: <List size={16} /> },
        { id: View.SQL_EDITOR, label: 'Editor SQL', icon: <Database size={16} /> },
    ]
  },
  { id: View.HISTORY, label: 'Historial', icon: <History size={20} /> },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, isMobile = false, onClose }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<View | null>(null);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    if (!isCollapsed) setExpandedMenu(null); 
  };

  const containerClasses = isMobile 
    ? "fixed inset-0 z-50 w-full flex flex-col h-full bg-surface animate-in slide-in-from-left duration-200"
    : `hidden md:flex flex-col h-full bg-surface border-r border-surfaceHighlight transition-all duration-300 ease-in-out shrink-0 relative ${isCollapsed ? 'w-20' : 'w-72'}`;

  const showCollapse = !isMobile;

  return (
    <aside className={containerClasses}>
      
      {/* Mobile Header with Close */}
      {isMobile && (
          <div className="flex items-center justify-between p-4 border-b border-surfaceHighlight bg-surface shrink-0">
              <span className="font-bold text-lg text-text">Menú</span>
              <button onClick={onClose} className="p-2 text-muted hover:text-text rounded-lg hover:bg-surfaceHighlight transition-colors">
                  <X size={24} />
              </button>
          </div>
      )}

      {/* Collapse Toggle (Desktop) */}
      {showCollapse && (
        <button 
            onClick={toggleCollapse}
            className="absolute -right-3 top-9 z-10 bg-surface border border-surfaceHighlight rounded-full p-1.5 text-muted hover:text-primary transition-colors shadow-sm"
        >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      )}

      {/* Desktop Header */}
      {!isMobile && (
          <div className={`p-6 flex items-center ${isCollapsed ? 'justify-center' : ''} h-24 shrink-0`}>
            {isCollapsed ? (
                <div className="h-10 w-10 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-bold text-xl">
                    A
                </div>
            ) : (
                <div className="animate-in fade-in duration-200">
                    <h1 className="text-2xl font-bold text-text tracking-tight whitespace-nowrap overflow-hidden">Alfonsa Software</h1>
                    <p className="text-muted text-sm mt-1 whitespace-nowrap overflow-hidden">Panel Administrativo</p>
                </div>
            )}
          </div>
      )}

      {/* Navigation - Scrollable Area */}
      <nav className="flex flex-col gap-2 flex-1 px-3 overflow-y-auto overflow-x-hidden pt-4 scroll-smooth">
        {NAV_STRUCTURE.map((item) => {
          const hasSubItems = !!item.subItems;
          const isParentActive = item.id === currentView || item.subItems?.some(sub => sub.id === currentView);
          const isOpen = expandedMenu === item.id;
          const isTools = item.id === View.TOOLS;
          
          return (
            <div key={item.id} className="relative group shrink-0">
              
              <div 
                  className={`flex items-center rounded-xl transition-all duration-200 w-full select-none
                  ${isParentActive && !hasSubItems
                    ? 'bg-primary/10 text-primary font-bold' 
                    : 'text-text hover:bg-surfaceHighlight'
                  }
                `}
              >
                  <button
                    onClick={() => {
                        if (isCollapsed && !isMobile) {
                             if (hasSubItems) {
                                 setIsCollapsed(false);
                                 setExpandedMenu(item.id);
                             } else {
                                 onNavigate(item.id);
                             }
                        } else {
                             if (isTools) {
                                 setExpandedMenu(expandedMenu === item.id ? null : item.id);
                             } else {
                                 onNavigate(item.id);
                             }
                        }
                    }}
                    className={`flex items-center gap-3 px-3 py-3 flex-1 text-left outline-none ${isCollapsed && !isMobile ? 'justify-center' : ''}`}
                  >
                        <span className={`${isParentActive ? 'text-primary' : 'text-muted group-hover:text-text'} transition-colors`}>
                            {item.icon}
                        </span>
                        {(!isCollapsed || isMobile) && (
                            <span className="whitespace-nowrap font-medium text-sm">{item.label}</span>
                        )}
                  </button>
                  
                  {(!isCollapsed || isMobile) && hasSubItems && (
                     <button
                        onClick={(e) => {
                             e.stopPropagation();
                             setExpandedMenu(expandedMenu === item.id ? null : item.id);
                        }}
                        className="p-3 text-muted hover:text-text transition-transform outline-none"
                     >
                        <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                     </button>
                  )}
              </div>

              {isCollapsed && !isMobile && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-text text-background text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    {item.label}
                </div>
              )}

              {(!isCollapsed || isMobile) && hasSubItems && (
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-60 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                      <div className="flex flex-col gap-1 pl-10 pr-2 pb-2">
                        {item.subItems!.map((sub) => (
                            <button
                                key={sub.id}
                                onClick={(e) => {
                                    e.stopPropagation(); 
                                    onNavigate(sub.id);
                                }}
                                className={`text-left text-sm py-2 px-3 rounded-lg transition-colors flex items-center gap-2
                                    ${currentView === sub.id ? 'text-primary font-bold bg-primary/5' : 'text-muted hover:text-text hover:bg-surfaceHighlight/50'}
                                `}
                            >
                                {sub.icon}
                                {sub.label}
                            </button>
                        ))}
                      </div>
                  </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer Settings */}
      <div className="mt-auto pt-4 border-t border-surfaceHighlight p-3 shrink-0 bg-surface z-10">
        <button 
           onClick={() => onNavigate(View.SETTINGS)}
           className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 w-full text-left group relative
             ${currentView === View.SETTINGS ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-surfaceHighlight hover:text-text'}
             ${isCollapsed && !isMobile ? 'justify-center' : ''}
           `}
        >
          <Settings size={20} />
          {(!isCollapsed || isMobile) && <span>Configuración</span>}
          
          {isCollapsed && !isMobile && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-text text-background text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                Configuración
            </div>
          )}
        </button>
      </div>
    </aside>
  );
};