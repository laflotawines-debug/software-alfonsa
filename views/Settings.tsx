
import React, { useState } from 'react';
import { 
    User as UserIcon, 
    ShieldCheck, 
    Save, 
    Loader2, 
    CheckCircle2,
    Database,
    Lock,
    Bell,
    Smartphone
} from 'lucide-react';
import { User } from '../types';

interface SettingsProps {
    currentUser: User;
    onUpdateProfile: (newName: string) => Promise<void>;
}

export const Settings: React.FC<SettingsProps> = ({ currentUser, onUpdateProfile }) => {
    const [name, setName] = useState(currentUser.name);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) return;
        setIsSaving(true);
        try {
            await onUpdateProfile(name);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (err) {
            console.error(err);
            alert("Error al actualizar el perfil.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-8 pb-10 max-w-4xl mx-auto">
            <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-black text-text tracking-tight">Configuración</h2>
                <p className="text-muted text-sm">Administra tu perfil y preferencias de la aplicación.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Sidebar Menu - Optional inside settings */}
                <div className="md:col-span-1 space-y-2">
                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary font-bold text-sm text-left border border-primary/20 transition-all">
                        <UserIcon size={18} /> Mi Perfil
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted hover:bg-surfaceHighlight hover:text-text font-bold text-sm text-left transition-all opacity-50 cursor-not-allowed">
                        <Bell size={18} /> Notificaciones
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted hover:bg-surfaceHighlight hover:text-text font-bold text-sm text-left transition-all opacity-50 cursor-not-allowed">
                        <Smartphone size={18} /> Dispositivos
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted hover:bg-surfaceHighlight hover:text-text font-bold text-sm text-left transition-all opacity-50 cursor-not-allowed">
                        <Lock size={18} /> Seguridad
                    </button>
                </div>

                {/* Main Settings Panel */}
                <div className="md:col-span-2 space-y-6">
                    <section className="bg-surface border border-surfaceHighlight rounded-2xl p-6 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                        <h3 className="text-lg font-bold text-text mb-6 flex items-center gap-2">
                            <UserIcon size={20} className="text-primary" />
                            Información Personal
                        </h3>

                        <div className="space-y-6">
                            <div className="flex items-center gap-6 pb-6 border-b border-surfaceHighlight">
                                <div className="h-20 w-20 rounded-2xl bg-surfaceHighlight border-4 border-surfaceHighlight overflow-hidden relative group">
                                    <img 
                                        src={`https://picsum.photos/seed/${currentUser.id}/200`} 
                                        alt="Avatar" 
                                        className="h-full w-full object-cover opacity-80"
                                    />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                        <Save size={16} className="text-white" />
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-muted mb-1">Rol de Usuario</p>
                                    <div className="flex items-center gap-2 text-text font-bold">
                                        <ShieldCheck size={16} className="text-primary" />
                                        <span className="capitalize">{currentUser.role}</span>
                                    </div>
                                    <p className="text-xs text-muted mt-1 leading-tight max-w-[200px]">
                                        Tus permisos están definidos por el administrador del sistema.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Nombre Completo</label>
                                    <input 
                                        type="text" 
                                        value={name} 
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-sm font-bold text-text outline-none focus:border-primary transition-all shadow-inner mt-1" 
                                    />
                                </div>
                                
                                <div>
                                    <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Identificador de Usuario (ID)</label>
                                    <div className="w-full bg-background/50 border border-surfaceHighlight rounded-xl py-3 px-4 text-xs font-mono text-muted mt-1 flex items-center gap-2">
                                        <Database size={12} />
                                        {currentUser.id}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex items-center justify-between">
                                <div className="flex-1">
                                    {showSuccess && (
                                        <div className="flex items-center gap-2 text-green-500 text-xs font-bold animate-in slide-in-from-left-2">
                                            <CheckCircle2 size={16} /> Perfil actualizado correctamente
                                        </div>
                                    )}
                                </div>
                                <button 
                                    onClick={handleSave}
                                    disabled={isSaving || name === currentUser.name}
                                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-lg
                                        ${isSaving || name === currentUser.name 
                                            ? 'bg-muted/10 text-muted cursor-not-allowed' 
                                            : 'bg-primary text-white hover:bg-primaryHover shadow-primary/20 active:scale-95'}
                                    `}
                                >
                                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                    {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </div>
                    </section>

                    <section className="bg-surface border border-surfaceHighlight rounded-2xl p-6 shadow-sm opacity-60">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-bold text-text flex items-center gap-2">
                                <Bell size={20} className="text-muted" />
                                Preferencias de Aplicación
                            </h3>
                            <span className="text-[10px] font-black bg-surfaceHighlight text-muted px-2 py-0.5 rounded tracking-widest">PRÓXIMAMENTE</span>
                        </div>
                        <p className="text-xs text-muted mb-6">Configura cómo recibes notificaciones y alertas críticas.</p>
                        
                        <div className="space-y-4">
                            <div className="flex items-center justify-between py-2">
                                <div>
                                    <p className="text-sm font-bold text-text">Notificaciones por Correo</p>
                                    <p className="text-[10px] text-muted">Recibe resúmenes diarios de cobros.</p>
                                </div>
                                <div className="h-6 w-11 bg-surfaceHighlight rounded-full relative">
                                    <div className="absolute left-1 top-1 h-4 w-4 bg-muted rounded-full"></div>
                                </div>
                            </div>
                            <div className="h-px bg-surfaceHighlight"></div>
                            <div className="flex items-center justify-between py-2">
                                <div>
                                    <p className="text-sm font-bold text-text">Alertas de Vencimiento</p>
                                    <p className="text-[10px] text-muted">Notificar facturas a vencer en 24hs.</p>
                                </div>
                                <div className="h-6 w-11 bg-surfaceHighlight rounded-full relative">
                                    <div className="absolute left-1 top-1 h-4 w-4 bg-muted rounded-full"></div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};
