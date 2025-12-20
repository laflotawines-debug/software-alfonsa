
import React, { useState } from 'react';
import { 
    Lock, 
    User as UserIcon, 
    LogIn, 
    ShieldCheck, 
    Users, 
    Sun, 
    Moon,
    ArrowRight,
    Loader2
} from 'lucide-react';
import { UserRole } from '../types';
import { supabase } from '../supabase';

interface LoginProps {
    isDarkMode: boolean;
    onToggleTheme: () => void;
}

const MOCK_ACCOUNTS = [
    { email: 'vale@alfonsa.com', name: 'Vale', role: 'vale' as UserRole },
    { email: 'armador1@alfonsa.com', name: 'Juan (Armador)', role: 'armador' as UserRole },
    { email: 'armador2@alfonsa.com', name: 'Pedro (Armador)', role: 'armador' as UserRole },
];

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
        // No es necesario llamar a onLogin, el listener en App.tsx lo detectará.
    };

    const handleQuickLogin = (acc: typeof MOCK_ACCOUNTS[0]) => {
        setEmail(acc.email);
        setPassword('admin123'); // Password por defecto para la demo
    };

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-4 md:p-8 transition-colors duration-300 overflow-hidden relative">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-primary/5 blur-[100px] rounded-full pointer-events-none"></div>

            <div className="w-full max-w-md z-10">
                <div className="text-center mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="inline-flex items-center justify-center h-20 w-20 rounded-3xl bg-primary text-white mb-6 shadow-2xl shadow-primary/30 transform hover:rotate-6 transition-transform">
                        <Lock size={36} fill="white" />
                    </div>
                    <h1 className="text-4xl font-black text-text tracking-tight mb-2">Alfonsa Software</h1>
                    <p className="text-muted font-medium uppercase tracking-widest text-xs">Acceso al Panel Administrativo</p>
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

                    <div className="mt-10 border-t border-surfaceHighlight pt-8">
                        <p className="text-[10px] font-black uppercase text-muted text-center tracking-widest mb-6">Acceso Rápido (Demo)</p>
                        <div className="grid grid-cols-1 gap-3">
                            {MOCK_ACCOUNTS.map(acc => (
                                <button 
                                    key={acc.email}
                                    onClick={() => handleQuickLogin(acc)}
                                    className={`flex items-center justify-between p-4 rounded-2xl border border-surfaceHighlight hover:border-primary/50 hover:bg-primary/5 transition-all group ${email === acc.email ? 'border-primary bg-primary/10' : ''}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl ${acc.role === 'vale' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                            {acc.role === 'vale' ? <ShieldCheck size={20} /> : <Users size={20} />}
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-black text-text leading-tight">{acc.name}</p>
                                            <p className="text-[10px] text-muted font-bold uppercase">{acc.role === 'vale' ? 'Administrador' : 'Operativo'}</p>
                                        </div>
                                    </div>
                                    <ArrowRight size={16} className="text-muted group-hover:text-primary transition-transform group-hover:translate-x-1" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-8 text-center text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                    Alfonsa Distribuidora v2.6.0
                </div>
            </div>
        </div>
    );
};
