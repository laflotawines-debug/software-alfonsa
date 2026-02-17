
import React, { useState } from 'react';
import { 
    Lock, 
    User as UserIcon, 
    LogIn, 
    Sun, 
    Moon,
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
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-4 md:p-8 transition-colors duration-300 overflow-hidden relative">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-primary/5 blur-[100px] rounded-full pointer-events-none"></div>

            <div className="w-full max-w-md z-10">
                <div className="text-center mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="inline-flex items-center justify-center h-28 w-28 rounded-[2rem] bg-white mb-6 shadow-2xl overflow-hidden p-3 transform hover:scale-105 transition-transform duration-500">
                        <img src="icon.png" alt="Alfonsa Logo" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-4xl font-black text-text tracking-tighter mb-2 uppercase italic">Alfonsa</h1>
                    <p className="text-muted font-black uppercase tracking-[0.3em] text-[10px]">Panel Administrativo</p>
                </div>

                <div className="bg-surface border border-surfaceHighlight rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-500 relative">
                    <div className="absolute top-4 right-4">
                        <button onClick={onToggleTheme} className="p-2 rounded-full hover:bg-surfaceHighlight text-muted transition-colors">
                            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold animate-in shake duration-300">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Correo Electrónico</label>
                            <div className="relative">
                                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                                <input 
                                    type="email" 
                                    placeholder="ejemplo@alfonsa.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 pl-12 pr-4 text-sm text-text outline-none focus:border-primary transition-all shadow-inner"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                                <input 
                                    type="password" 
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 pl-12 pr-4 text-sm text-text outline-none focus:border-primary transition-all shadow-inner"
                                    required
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full py-4 rounded-2xl bg-primary hover:bg-primaryHover text-white font-black shadow-xl shadow-primary/20 transition-all active:scale-[0.98] uppercase tracking-widest text-sm flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} />}
                            {isLoading ? 'Iniciando sesión...' : 'Ingresar'}
                        </button>
                    </form>
                </div>

                <div className="mt-8 text-center text-muted">
                    <p className="text-[9px] font-black uppercase tracking-[0.3em]">Alfonsa Distribuidora &copy; 2025</p>
                    <p className="text-[8px] font-bold uppercase tracking-widest mt-1 opacity-60">Versión 3.1.2</p>
                </div>
            </div>
        </div>
    );
};
