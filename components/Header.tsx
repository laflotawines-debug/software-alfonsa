
import React, { useState, useRef, useEffect } from 'react';
import { Menu, LogOut, Sun, Moon, Users, DownloadCloud, User as UserIcon, Bell, Check, Trash2, X } from 'lucide-react';
import { User, AppNotification } from '../types';

interface HeaderProps {
  onMenuClick?: () => void;
  title: string;
  subtitle: string;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  currentUser: User;
  onToggleRole?: () => void;
  onLogout?: () => void;
  showInstallBtn?: boolean;
  onInstallApp?: () => void;
  notifications?: AppNotification[];
  onMarkAllRead?: () => void;
  onClearNotifications?: () => void;
  onNotificationClick?: (notification: AppNotification) => void;
}

export const Header: React.FC<HeaderProps> = ({ 
    onMenuClick, 
    title, 
    subtitle, 
    isDarkMode, 
    onToggleTheme, 
    currentUser, 
    onToggleRole,
    onLogout,
    showInstallBtn,
    onInstallApp,
    notifications = [],
    onMarkAllRead,
    onClearNotifications,
    onNotificationClick
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
            setShowNotifications(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleNotifications = () => {
      setShowNotifications(!showNotifications);
  };

  const getNotificationIcon = (type: string) => {
      switch (type) {
          case 'success': return <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />;
          case 'warning': return <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5" />;
          default: return <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />;
      }
  };

  return (
    <header className="flex w-full items-center justify-between border-b border-surfaceHighlight bg-background/95 backdrop-blur px-4 md:px-8 py-5 shrink-0 z-20 sticky top-0 transition-colors duration-300">
      <div className="flex items-center gap-4 lg:hidden">
        <button onClick={onMenuClick} className="text-text">
          <Menu size={24} />
        </button>
      </div>

      <div className="hidden lg:flex flex-col">
        <h2 className="text-text text-xl font-bold leading-tight">{title}</h2>
        <p className="text-muted text-xs">{subtitle}</p>
      </div>

      <div className="flex items-center gap-4 ml-auto lg:ml-0">
        
        {/* PWA Install Button */}
        {showInstallBtn && (
            <button 
                onClick={onInstallApp}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primaryHover transition-all animate-bounce"
            >
                <DownloadCloud size={16} />
                <span className="hidden sm:inline">Instalar App</span>
            </button>
        )}

        {/* Role Toggle (For Testing) */}
        {onToggleRole && (
            <button 
                onClick={onToggleRole}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surfaceHighlight/50 border border-surfaceHighlight text-xs font-bold text-text hover:bg-surfaceHighlight transition-all"
                title="Cambiar Usuario (Demo)"
            >
                <Users size={14} className="text-primary" />
                <span>Usuario: {currentUser.name}</span>
            </button>
        )}

        {/* Notifications */}
        <div className="relative" ref={notificationRef}>
            <button 
                onClick={toggleNotifications}
                className="p-2 rounded-full text-muted hover:text-primary hover:bg-surfaceHighlight transition-all relative"
                title="Notificaciones"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-background rounded-full animate-pulse"></span>
                )}
            </button>

            {showNotifications && (
                <div className="fixed left-4 right-4 top-20 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 bg-surface border border-surfaceHighlight rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="p-4 border-b border-surfaceHighlight bg-background/50 flex justify-between items-center">
                        <h4 className="text-xs font-black uppercase text-muted tracking-widest">Notificaciones</h4>
                        <div className="flex gap-2">
                            {unreadCount > 0 && onMarkAllRead && (
                                <button onClick={onMarkAllRead} className="text-[10px] text-primary hover:text-primaryHover font-bold flex items-center gap-1 uppercase">
                                    <Check size={12}/> Leídas
                                </button>
                            )}
                            {notifications.length > 0 && onClearNotifications && (
                                <button onClick={onClearNotifications} className="text-[10px] text-red-500 hover:text-red-600 font-bold flex items-center gap-1 uppercase">
                                    <Trash2 size={12}/>
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-muted opacity-50">
                                <Bell size={32} className="mx-auto mb-2" />
                                <p className="text-xs font-bold uppercase">Sin novedades</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-surfaceHighlight">
                                {notifications.map(n => (
                                    <div 
                                        key={n.id} 
                                        onClick={() => onNotificationClick && onNotificationClick(n)}
                                        className={`p-4 flex gap-3 hover:bg-background/50 transition-colors cursor-pointer ${!n.is_read ? 'bg-primary/5' : ''}`}
                                    >
                                        {getNotificationIcon(n.type)}
                                        <div className="flex-1">
                                            <p className={`text-xs ${!n.is_read ? 'font-bold text-text' : 'font-medium text-muted'}`}>
                                                {n.message}
                                            </p>
                                            <p className="text-[9px] text-muted font-bold mt-1 uppercase">
                                                {new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* Theme Toggle */}
        <button 
            onClick={onToggleTheme}
            className="p-2 rounded-full text-muted hover:text-primary hover:bg-surfaceHighlight transition-all"
            title={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div className="h-6 w-px bg-surfaceHighlight mx-2 hidden sm:block"></div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-text text-sm font-bold leading-none capitalize">{currentUser.name}</p>
            <p className="text-muted text-xs font-normal mt-1 capitalize">{currentUser.role}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-surfaceHighlight border-2 border-surfaceHighlight overflow-hidden flex items-center justify-center shrink-0">
             {currentUser.avatar_url ? (
                <img 
                  src={currentUser.avatar_url} 
                  alt="User" 
                  className="h-full w-full object-cover"
                />
             ) : (
                <div className="h-full w-full bg-primary/10 flex items-center justify-center text-primary">
                    <UserIcon size={20} />
                </div>
             )}
          </div>
        </div>

        <button 
          onClick={onLogout}
          className="hidden sm:flex items-center justify-center gap-2 rounded-full h-10 px-6 bg-surface hover:bg-surfaceHighlight text-text text-sm font-bold transition-all border border-surfaceHighlight hover:border-primary/30 shadow-sm"
        >
          <span className="truncate">Cerrar sesión</span>
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
};
