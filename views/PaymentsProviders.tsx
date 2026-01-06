
import React, { useState, useEffect } from 'react';
import { 
    Plus, 
    Edit2, 
    X,
    Trash2,
    PauseCircle,
    Eye,
    EyeOff,
    XCircle,
    RefreshCw,
    AlertTriangle,
    Save,
    CheckCircle2,
    History,
    Eraser,
    Sparkles,
    Building2,
    Loader2
} from 'lucide-react';
import { Provider, ProviderAccount, ProviderStatus, SupplierMaster } from '../types';
import { supabase } from '../supabase';

const formatCurrencyInput = (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (!clean) return '';
    return Number(clean).toLocaleString('es-AR');
};

const parseCurrencyInput = (val: string) => {
    return val.replace(/\./g, '');
};

interface PaymentsProvidersProps {
    providers: Provider[];
    onUpdateProviders: (p: Provider) => void;
    onDeleteProvider: (id: string) => void;
    onResetProvider?: (id: string) => void;
}

export const PaymentsProviders: React.FC<PaymentsProvidersProps> = ({ providers, onUpdateProviders, onDeleteProvider, onResetProvider }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProvider, setEditingProvider] = useState<Provider | null>(null);

    const handleOpenModal = (provider?: Provider) => {
        setEditingProvider(provider || null);
        setIsModalOpen(true);
    };

    const handleSave = (providerData: Provider) => {
        onUpdateProviders(providerData);
        setIsModalOpen(false);
        setEditingProvider(null);
    };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.confirm("¿ELIMINAR PROVEEDOR? Se borrará el proveedor y todo su historial de la base de datos.")) {
            onDeleteProvider(id);
        }
    };

    const handleReset = (id: string) => {
        if (window.confirm("¡ATENCIÓN! Esto preparará al proveedor para una NUEVA TARJETA de cobro. Se eliminarán todas las transferencias activas para volver el contador a $0. Las cuentas bancarias se mantendrán intactas para que no tengas que volver a cargarlas. ¿Deseas iniciar un nuevo ciclo?")) {
            if (onResetProvider) onResetProvider(id);
            setIsModalOpen(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 pb-20 animate-in fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight uppercase italic">Gestión de Proveedores</h2>
                    <p className="text-muted text-sm font-medium mt-1">Vincule proveedores del maestro y gestione sus metas y cuentas de cobro.</p>
                </div>
                <button type="button" onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-primary hover:bg-primaryHover text-white px-6 py-3 rounded-2xl text-sm font-black uppercase transition-all shadow-xl shadow-primary/20 active:scale-95 cursor-pointer">
                    <Plus size={18} /> Vincular Nuevo
                </button>
            </div>

            <div className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-background/50 border-b border-surfaceHighlight text-[10px] text-muted uppercase font-black tracking-widest">
                            <th className="p-4 pl-6">Proveedor Vinculado</th>
                            <th className="p-4 text-center">Prioridad</th>
                            <th className="p-4 text-center">Cuentas Activas</th>
                            <th className="p-4 text-center">Estado</th>
                            <th className="p-4 pr-6 text-right">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-surfaceHighlight">
                        {providers.map(p => (
                            <tr key={p.id} className="hover:bg-primary/5 transition-colors group">
                                <td className="p-4 pl-6">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs uppercase">{p.name.substring(0,2)}</div>
                                        <span className="font-bold text-sm text-text uppercase">{p.name}</span>
                                        {p.status === 'Frenado' && <PauseCircle size={14} className="text-red-500 animate-pulse" />}
                                    </div>
                                </td>
                                <td className="p-4 text-center"><span className="text-xs font-black text-muted bg-background px-3 py-1 rounded-full border border-surfaceHighlight">#{p.priority}</span></td>
                                <td className="p-4 text-center"><span className="text-xs text-text font-black">{p.accounts.filter(a => a.status === 'Activa').length}</span></td>
                                <td className="p-4 text-center">
                                    <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${p.status === 'Activado' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : p.status === 'Frenado' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-muted/10 text-muted border-muted/20'}`}>
                                        {p.status}
                                    </span>
                                </td>
                                <td className="p-4 pr-6 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button type="button" onClick={() => handleOpenModal(p)} className="p-3 text-muted hover:text-primary rounded-xl hover:bg-primary/10 transition-all cursor-pointer" title="Editar">
                                            <Edit2 size={18} />
                                        </button>
                                        <button type="button" onClick={(e) => handleDelete(e, p.id)} className="p-3 text-muted hover:text-red-500 rounded-xl hover:bg-red-500/10 transition-all cursor-pointer" title="Eliminar">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {providers.length === 0 && (
                            <tr><td colSpan={5} className="p-20 text-center text-muted italic font-bold">No hay proveedores configurados para pagos.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <NewProviderModal 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={handleSave} 
                    initialData={editingProvider} 
                    existingProviderNames={providers.map(p => p.name)}
                    onReset={editingProvider ? () => handleReset(editingProvider.id) : undefined}
                />
            )}
        </div>
    );
};

const NewProviderModal: React.FC<{ 
    onClose: () => void; 
    onSave: (data: Provider) => void; 
    initialData: Provider | null; 
    existingProviderNames: string[];
    onReset?: () => void 
}> = ({ onClose, onSave, initialData, existingProviderNames, onReset }) => {
    const [masterSuppliers, setMasterSuppliers] = useState<SupplierMaster[]>([]);
    const [isMasterLoading, setIsMasterLoading] = useState(false);
    
    const [name, setName] = useState(initialData?.name || '');
    const [goalAmountDisplay, setGoalAmountDisplay] = useState(initialData?.goalAmount ? formatCurrencyInput(initialData.goalAmount.toString()) : '0');
    const [priority, setPriority] = useState(initialData?.priority?.toString() || '3');
    const [status, setStatus] = useState<ProviderStatus>(initialData?.status || 'Activado');
    const [accounts, setAccounts] = useState<ProviderAccount[]>(initialData?.accounts || []);

    // Cargar proveedores del maestro al abrir el modal (solo si es nuevo)
    useEffect(() => {
        if (!initialData) {
            const fetchMaster = async () => {
                setIsMasterLoading(true);
                try {
                    const { data, error } = await supabase
                        .from('providers_master')
                        .select('*')
                        .eq('activo', true)
                        .order('razon_social');
                    if (data) setMasterSuppliers(data);
                } catch (e) {
                    console.error("Error cargando maestro:", e);
                } finally {
                    setIsMasterLoading(false);
                }
            };
            fetchMaster();
        }
    }, [initialData]);

    const handleAddAccount = () => {
        const newAcc: ProviderAccount = { id: `acc-${Date.now()}`, providerId: initialData?.id || '', condition: '', holder: '', identifierAlias: '', identifierCBU: '', metaAmount: 0, currentAmount: 0, pendingAmount: 0, status: 'Activa' };
        setAccounts([...accounts, newAcc]);
    };

    const submit = () => {
        if (!name) return alert("Seleccione un proveedor del maestro.");
        const finalId = (initialData && initialData.id) ? initialData.id : `p-${Date.now()}`;
        onSave({ id: finalId, name, goalAmount: parseFloat(parseCurrencyInput(goalAmountDisplay)) || 0, priority: parseInt(priority) || 1, status, accounts });
    };

    // Filtrar proveedores del maestro que ya están configurados como perfiles de pago
    const availableSuppliers = masterSuppliers.filter(s => !existingProviderNames.includes(s.razon_social));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface w-full max-w-2xl rounded-3xl border border-surfaceHighlight shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-6 md:p-8 border-b border-surfaceHighlight bg-surface flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-2xl font-black text-text uppercase tracking-tight italic">
                            {initialData ? 'Configurar Perfil' : 'Vincular del Maestro'}
                        </h3>
                        <p className="text-muted text-xs font-bold mt-1">Configura identidades de pago y metas financieras.</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-surfaceHighlight rounded-full text-muted transition-all cursor-pointer"><X size={28} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
                    {initialData && (
                        <div className="p-6 bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6 shadow-inner animate-in zoom-in-95">
                            <div className="flex items-start gap-4 flex-1">
                                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                                    <Sparkles size={24} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-text uppercase tracking-tight">Actualizar Nueva Tarjeta</h4>
                                    <p className="text-[10px] text-muted font-bold leading-tight mt-1 uppercase">Ideal para iniciar un nuevo ciclo de cobro. <br/>Borra los pagos anteriores pero mantiene tus cuentas bancarias guardadas.</p>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                onClick={onReset} 
                                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-xl text-xs font-black uppercase transition-all shadow-lg active:scale-95 cursor-pointer whitespace-nowrap"
                            >
                                <RefreshCw size={18} /> Iniciar Nuevo Ciclo
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1 flex items-center gap-1">
                                <Building2 size={12} className="text-primary"/> Proveedor (Identidad Maestra)
                            </label>
                            {initialData ? (
                                <div className="w-full bg-background/50 border border-surfaceHighlight rounded-2xl py-4 px-5 text-sm font-black text-text shadow-inner uppercase opacity-80">
                                    {name}
                                </div>
                            ) : (
                                <div className="relative">
                                    <select 
                                        value={name} 
                                        onChange={e => setName(e.target.value)} 
                                        disabled={isMasterLoading}
                                        className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 px-5 text-sm font-black text-text outline-none focus:border-primary transition-all shadow-inner appearance-none uppercase cursor-pointer"
                                    >
                                        <option value="">{isMasterLoading ? "Cargando..." : "-- Seleccionar del Maestro --"}</option>
                                        {availableSuppliers.map(s => (
                                            <option key={s.codigo} value={s.razon_social}>
                                                {s.codigo} — {s.razon_social}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                                        {isMasterLoading ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16}/>}
                                    </div>
                                </div>
                            )}
                            {!initialData && availableSuppliers.length === 0 && !isMasterLoading && (
                                <p className="text-[9px] text-orange-500 font-bold uppercase ml-1">⚠️ Todos los proveedores activos ya tienen perfiles de pago configurados.</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Meta Global de Cobro ($)</label>
                            <input type="text" value={goalAmountDisplay} onChange={e => setGoalAmountDisplay(formatCurrencyInput(e.target.value))} placeholder="0" className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 px-5 font-black text-text text-xl outline-none focus:border-primary transition-all shadow-inner" />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Prioridad / Orden</label>
                            <input type="number" value={priority} onChange={e => setPriority(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 px-5 font-black text-text outline-none focus:border-primary shadow-inner" placeholder="3" />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Estado Operativo</label>
                            <select value={status} onChange={e => setStatus(e.target.value as ProviderStatus)} className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 px-5 font-bold text-text outline-none focus:border-primary appearance-none cursor-pointer">
                                <option value="Activado">✅ Activado (Visible en Tablero)</option>
                                <option value="Frenado">🛑 Frenado (Alerta Visual)</option>
                                <option value="Desactivado">❌ Desactivado (Oculto)</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-surfaceHighlight pb-3">
                            <h4 className="text-sm font-black text-text uppercase tracking-widest flex items-center gap-2">Cuentas Bancarias / Aliases</h4>
                            <button type="button" onClick={handleAddAccount} className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg text-[10px] font-black tracking-wider uppercase transition-all">+ AGREGAR CUENTA</button>
                        </div>
                        <div className="flex flex-col gap-4">
                            {accounts.map(acc => (
                                <div key={acc.id} className={`bg-background border border-surfaceHighlight rounded-3xl p-6 relative space-y-4 animate-in slide-in-from-top-2 shadow-sm transition-opacity ${acc.status === 'Inactiva' ? 'opacity-50 grayscale' : ''}`}>
                                    <div className="absolute top-4 right-4 flex gap-2">
                                        <button type="button" onClick={() => setAccounts(p => p.map(a => a.id === acc.id ? { ...a, status: a.status === 'Activa' ? 'Inactiva' : 'Activa' } : a))} className={`p-2 rounded-xl transition-all cursor-pointer ${acc.status === 'Activa' ? 'text-green-500 bg-green-500/5' : 'text-muted bg-surfaceHighlight'}`}>
                                            {acc.status === 'Activa' ? <Eye size={20}/> : <EyeOff size={20}/>}
                                        </button>
                                        <button type="button" onClick={() => setAccounts(p => p.filter(a => a.id !== acc.id))} className="p-2 text-red-500 bg-red-500/5 hover:bg-red-500 hover:text-white rounded-xl transition-all cursor-pointer"><XCircle size={20}/></button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                        <div className="md:col-span-8 space-y-1">
                                            <label className="text-[9px] font-black text-muted uppercase">Condición de Pago / Nombre Cuenta</label>
                                            <input placeholder="Ej: Contado / Transferencia Banco" value={acc.condition} onChange={e => setAccounts(p => p.map(a => a.id === acc.id ? { ...a, condition: e.target.value } : a))} className="w-full bg-surface border border-surfaceHighlight rounded-xl px-4 py-3 text-xs font-bold text-text outline-none focus:border-primary" />
                                        </div>
                                        <div className="md:col-span-4 space-y-1">
                                            <label className="text-[9px] font-black text-muted uppercase">Meta Sub-Objetivo</label>
                                            <input placeholder="0" value={(acc.metaAmount || 0) === 0 ? '' : formatCurrencyInput(acc.metaAmount.toString())} onChange={e => setAccounts(p => p.map(a => a.id === acc.id ? { ...a, metaAmount: parseFloat(parseCurrencyInput(e.target.value)) || 0 } : a))} className="w-full bg-surface border border-surfaceHighlight rounded-xl px-4 py-3 text-xs font-black text-right text-text outline-none focus:border-primary" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-muted uppercase">Titular / Razón Social de Cuenta</label>
                                        <input placeholder="Nombre completo del titular" value={acc.holder} onChange={e => setAccounts(p => p.map(a => a.id === acc.id ? { ...a, holder: e.target.value } : a))} className="w-full bg-surface border border-surfaceHighlight rounded-xl px-4 py-3 text-xs text-text outline-none focus:border-primary uppercase" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-muted uppercase">Alias</label>
                                            <input placeholder="ALIAS.CUENTA.BANCO" value={acc.identifierAlias} onChange={e => setAccounts(p => p.map(a => a.id === acc.id ? { ...a, identifierAlias: e.target.value } : a))} className="w-full bg-surface border border-surfaceHighlight rounded-xl px-4 py-3 text-[10px] font-mono text-text outline-none focus:border-primary uppercase" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-muted uppercase">CBU / CVU</label>
                                            <input placeholder="0000000000000000000000" value={acc.identifierCBU} onChange={e => setAccounts(p => p.map(a => a.id === acc.id ? { ...a, identifierCBU: e.target.value } : a))} className="w-full bg-surface border border-surfaceHighlight rounded-xl px-4 py-3 text-[10px] font-mono text-text outline-none focus:border-primary" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 md:p-8 border-t border-surfaceHighlight bg-surface shrink-0 flex flex-col sm:flex-row gap-4">
                    <button type="button" onClick={onClose} className="flex-1 py-4 text-text font-black text-xs hover:bg-surfaceHighlight rounded-2xl transition-all uppercase tracking-widest cursor-pointer border border-surfaceHighlight">Cancelar</button>
                    <button type="button" onClick={submit} className="flex-1 py-4 bg-primary hover:bg-primaryHover text-white font-black rounded-2xl shadow-xl shadow-primary/30 transition-all text-xs uppercase tracking-widest cursor-pointer flex items-center justify-center gap-2">
                        <CheckCircle2 size={18} /> Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    );
};
