
import React, { useState } from 'react';
import { 
    Loader2
} from 'lucide-react';
import { supabase } from '../supabase';

interface LoginProps {
    isDarkMode: boolean;
    onToggleTheme: () => void;
}

export const Login: React.FC<LoginProps> = ({ isDarkMode, onToggleTheme }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        const { error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            setError(authError.message === 'Invalid login credentials' ? 'Credenciales incorrectas.' : authError.message);
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#f8fafc] dark:bg-[#0f172a] p-4 md:p-8 transition-colors duration-300 overflow-hidden relative font-sans">
            {/* Background Blur Orbs - Orange Gradients */}
            <div className="absolute top-[-10%] left-[-10%] w-[70vw] h-[70vw] max-w-[800px] max-h-[800px] bg-gradient-to-br from-orange-400/40 to-orange-600/20 dark:from-orange-500/30 dark:to-orange-800/20 blur-[100px] md:blur-[150px] rounded-full pointer-events-none animate-pulse" style={{ animationDuration: '8s' }}></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] bg-gradient-to-tl from-amber-400/30 to-orange-500/20 dark:from-amber-600/20 dark:to-orange-700/20 blur-[80px] md:blur-[120px] rounded-full pointer-events-none animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }}></div>

            <div className="w-full max-w-[440px] z-10 flex flex-col items-center">
                {/* Header Section */}
                <div className="text-center mb-8 animate-in fade-in slide-in-from-top-8 duration-1000 flex flex-col items-center">
                    <div className="flex items-center justify-center h-24 w-24 rounded-3xl bg-gradient-to-br from-orange-400 to-orange-600 mb-6 shadow-2xl shadow-orange-500/30 overflow-hidden p-5 transform hover:scale-105 transition-transform duration-500 border border-white/20 backdrop-blur-sm">
                        <img src="icon.png" alt="Alfonsa Logo" className="w-full h-full object-contain brightness-0 invert drop-shadow-md" />
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2 drop-shadow-sm">Alfonsa <span className="text-orange-500">4.0</span></h1>
                    <p className="text-slate-600 dark:text-slate-400 text-sm font-medium tracking-wide uppercase">Gestión comercial inteligente</p>
                </div>

                {/* Login Card - Glassmorphism */}
                <div className="w-full bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-10 shadow-[0_8px_32px_rgba(249,115,22,0.15)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-in zoom-in-95 duration-700 relative border border-white/50 dark:border-slate-700/50">
                    <div className="text-center mb-10">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Bienvenido de nuevo</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Ingresa tus credenciales para continuar</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-4 bg-red-50/80 dark:bg-red-900/30 backdrop-blur-md border border-red-200 dark:border-red-800/50 rounded-2xl text-red-600 dark:text-red-400 text-sm font-medium animate-in shake duration-300 text-center shadow-inner">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider ml-1">Correo Electrónico</label>
                            <input 
                                type="email" 
                                placeholder="ejemplo@alfonsa.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-5 text-sm text-slate-900 dark:text-white outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-inner"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between ml-1">
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Contraseña</label>
                                <a href="#" className="text-xs font-bold text-orange-500 hover:text-orange-600 dark:hover:text-orange-400 transition-colors">¿Olvidaste tu contraseña?</a>
                            </div>
                            <input 
                                type="password" 
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-5 text-sm text-slate-900 dark:text-white outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-inner"
                                required
                            />
                        </div>

                        <div className="pt-6">
                            <button 
                                type="submit" 
                                disabled={isLoading}
                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold transition-all active:scale-[0.98] text-base flex items-center justify-center gap-3 disabled:opacity-70 shadow-lg shadow-orange-500/30 hover:shadow-orange-500/40 border border-orange-400/20"
                            >
                                {isLoading ? <Loader2 size={20} className="animate-spin" /> : null}
                                {isLoading ? 'Iniciando sesión...' : 'Ingresar al sistema'}
                            </button>
                        </div>
                    </form>

                    <div className="mt-10 pt-8 border-t border-slate-200/50 dark:border-slate-700/50 text-center">
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            ¿No tienes acceso? <span className="text-orange-500 cursor-pointer hover:text-orange-600 dark:hover:text-orange-400 transition-colors font-bold">Contacta a tu administrador.</span>
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        &copy; 2026 Alfonsa. Todos los derechos reservados.
                    </p>
                    <p className="text-[10px] font-black text-orange-500 mt-2 opacity-80 tracking-[0.2em] uppercase">
                        Versión 4.0
                    </p>
                </div>
            </div>
            
            {/* Theme Toggle Button */}
            <div className="absolute top-6 right-6 z-20">
                <button onClick={onToggleTheme} className="p-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-md hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all shadow-lg shadow-black/5 border border-white/50 dark:border-slate-700/50 group">
                    {isDarkMode ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:text-orange-400 transition-colors"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:text-slate-900 transition-colors"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                    )}
                </button>
            </div>
        </div>
    );
};
