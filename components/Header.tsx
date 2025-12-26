
import React from 'react';
import { Menu, LogOut, Sun, Moon, Users, DownloadCloud } from 'lucide-react';
import { User } from '../types';

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
    onInstallApp
}) => {
  return (
    <header className="flex w-full items-center justify-between border-b border-surfaceHighlight bg-background/95 backdrop-blur px-8 py-5 shrink-0 z-20 sticky top-0 transition-colors duration-300">
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

        {/* Theme Toggle */}
        <button 
            onClick={onToggleTheme}
            className="p-2 rounded-full text-muted hover:text-primary hover:bg-surfaceHighlight transition-all"
            title={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div className="h-6 w-px bg-surfaceHighlight mx-2"></div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-text text-sm font-bold leading-none capitalize">{currentUser.name}</p>
            <p className="text-muted text-xs font-normal mt-1 capitalize">{currentUser.role}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-surfaceHighlight border-2 border-surfaceHighlight overflow-hidden">
             <img 
               src="https://picsum.photos/100/100" 
               alt="User" 
               className="h-full w-full object-cover opacity-90"
             />
          </div>
        </div>

        <button 
          onClick={onLogout}
          className="flex items-center justify-center gap-2 rounded-full h-10 px-6 bg-surface hover:bg-surfaceHighlight text-text text-sm font-bold transition-all border border-surfaceHighlight hover:border-primary/30 shadow-sm"
        >
          <span className="truncate hidden sm:inline">Cerrar sesión</span>
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
};
