
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    User as UserIcon, 
    Save, 
    Loader2, 
    CheckCircle2,
    FileSpreadsheet,
    UploadCloud,
    AlertCircle,
    RefreshCw,
    Eraser,
    Boxes,
    FileWarning,
    Layers,
    FileDown,
    ShieldCheck,
    Users,
    ChevronRight,
    Search,
    CheckSquare,
    Square,
    Wrench,
    Lock,
    Eye,
    EyeOff,
    ClipboardCheck,
    Check as CheckIcon,
    ToggleRight,
    ToggleLeft,
    Info,
    LayoutGrid,
    Calculator,
    Tag,
    AlertTriangle,
    MessageSquareQuote,
    RefreshCcw,
    Camera
} from 'lucide-react';
import { User, MasterProduct, AppPermission, View } from '../types';
import { supabase } from '../supabase';
import { SYSTEM_NAV_STRUCTURE } from '../logic';
import * as XLSX from 'xlsx';

interface SettingsProps {
    currentUser: User;
    onUpdateProfile: (newName: string, avatarUrl?: string) => Promise<void>;
}

type Tab = 'profile' | 'catalog_prices' | 'catalog_stock' | 'permissions';

export const Settings: React.FC<SettingsProps> = ({ currentUser, onUpdateProfile }) => {
    const [name, setName] = useState(currentUser.name);
    const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar_url || '');
    const [activeTab, setActiveTab] = useState<Tab>('profile');
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const [isSyncing, setIsSyncing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [syncLog, setSyncLog] = useState<string[]>([]);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [syncSuccess, setSyncSuccess] = useState(false);
    const [inconsistencies, setInconsistencies] = useState<string[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- PERMISSIONS STATE ---
    const [allProfiles, setAllProfiles] = useState<User[]>([]);
    const [selectedUserForPerms, setSelectedUserForPerms] = useState<User | null>(null);
    const [permDict, setPermDict] = useState<AppPermission[]>([]);
    const [userPerms, setUserPerms] = useState<Set<string>>(new Set());
    const [selectedModule, setSelectedModule] = useState<string | null>(null);
    const [isPermsLoading, setIsPermsLoading] = useState(false);
    const [permSearch, setPermSearch] = useState('');

    const isVale = currentUser.role === 'vale';

    useEffect(() => {
        if (activeTab === 'permissions' && isVale) {
            fetchPermData();
        }
    }, [activeTab, isVale]);

    const fetchPermData = async () => {
        setIsPermsLoading(true);
        try {
            const [profRes, dictRes] = await Promise.all([
                supabase.from('profiles').select('*').order('name'),
                supabase.from('app_permissions').select('*').order('module')
            ]);
            
            if (profRes.data) setAllProfiles(profRes.data as any);
            if (dictRes.data) {
                setPermDict(dictRes.data);
                if (!selectedModule) {
                    const hasTools = dictRes.data.some(p => p.module.toLowerCase() === 'herramientas');
                    setSelectedModule(hasTools ? 'Herramientas' : dictRes.data[0]?.module || null);
                }
            }
        } catch (e) { 
            console.error(e); 
        } finally { 
            setIsPermsLoading(false); 
        }
    };

    const handleSyncPermissions = async () => {
        if (!confirm("¿Deseas sincronizar los permisos?")) return;
        
        setIsPermsLoading(true);
        try {
            const keysToSync: any[] = [];
            SYSTEM_NAV_STRUCTURE.forEach(item => {
                if (item.permission) keysToSync.push({ key: item.permission, module: item.module, label: item.label });
                if (item.subItems) {
                    item.subItems.forEach(sub => {
                        if (sub.permission) keysToSync.push({ key: sub.permission, module: item.module, label: sub.label });
                    });
                }
            });
            const { error } = await supabase.from('app_permissions').upsert(keysToSync, { onConflict: 'key' });
            if (error) throw error;
            await fetchPermData();
        } catch (e: any) {
            alert("Error sincronizando: " + e.message);
        } finally {
            setIsPermsLoading(false);
        }
    };

    const loadUserPermissions = async (userId: string) => {
        setIsPermsLoading(true);
        try {
            const { data } = await supabase.from('user_permissions').select('permission_key').eq('user_id', userId);
            setUserPerms(new Set(data?.map(p => p.permission_key) || []));
        } catch (e) {
            console.error(e);
        } finally {
            setIsPermsLoading(false);
        }
    };

    const togglePermission = async (key: string) => {
        if (!selectedUserForPerms) return;
        const next = new Set(userPerms);
        const isGranted = next.has(key);
        if (isGranted) next.delete(key); else next.add(key);
        setUserPerms(next);
        try {
            if (isGranted) await supabase.from('user_permissions').delete().eq('user_id', selectedUserForPerms.id).eq('permission_key', key);
            else await supabase.from('user_permissions').insert({ user_id: selectedUserForPerms.id, permission_key: key });
        } catch (e) { alert("Error sincronizando permiso"); }
    };

    const modules = useMemo(() => Array.from(new Set(permDict.map(p => p.module))), [permDict]);

    const handleSaveProfile = async () => {
        if (!name.trim()) return;
        setIsSaving(true);
        try {
            await onUpdateProfile(name, avatarUrl);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (err: any) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 50; canvas.height = 50;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, 50, 50);
                    setAvatarUrl(canvas.toDataURL('image/jpeg', 0.8));
                }
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const normalizeHeader = (s: any): string => {
        if (s === undefined || s === null) return "";
        return String(s).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, ""); 
    };

    const normalizeNumber = (val: any): number => {
        if (val === undefined || val === null || val === '') return 0;
        if (typeof val === 'number') return val;
        let s = String(val).trim().replace(/[^0-9.,-]/g, '');
        const lastComma = s.lastIndexOf(',');
        const lastDot = s.lastIndexOf('.');
        if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
        else if (lastDot > lastComma) s = s.replace(/,/g, '');
        else if (lastComma !== -1) s = s.replace(',', '.');
        const num = parseFloat(s);
        return isNaN(num) ? 0 : num;
    };

    const handleExportExcel = async (type: 'prices' | 'stock') => {
        setIsExporting(true);
        setSyncLog([`Generando archivo de ${type === 'prices' ? 'Artículos' : 'Stock'}...`]);
        
        // Helper para convertir 0 en celda vacía para el Excel
        const emptyIfZero = (val: any) => {
            const n = Number(val || 0);
            return n === 0 ? "" : n;
        };

        try {
            const PAGE_SIZE = 1000;
            let allData: any[] = [];
            let from = 0;
            let hasMore = true;
            while (hasMore) {
                const { data, error } = await supabase.from('master_products').select('*').order('desart', { ascending: true }).range(from, from + PAGE_SIZE - 1);
                if (error) throw error;
                if (data && data.length > 0) { allData = [...allData, ...data]; if (data.length < PAGE_SIZE) hasMore = false; else from += PAGE_SIZE; } else { hasMore = false; }
            }
            
            let excelData = [];
            if (type === 'prices') {
                excelData = allData.map(p => ({ 
                    'codart': p.codart, 
                    'codprove': p.codprove || '', 
                    'cbarra': p.cbarra || '', 
                    'desart': p.desart, 
                    'costo': p.costo || 0, 
                    'familia': p.familia || '', 
                    'nsubf': p.nsubf || '', 
                    'en_dolares': p.en_dolares || 'FALSO', 
                    'tasa': p.tasa || '21', 
                    'nomprov': p.nomprov || '', 
                    'pventa_1': p.pventa_1 || 0, 
                    'pventa_2': p.pventa_2 || 0, 
                    'pventa_3': p.pventa_3 || 0, 
                    'pventa_4': p.pventa_4 || 0, 
                    'unicom': p.unicom || '', 
                    'unidad': p.unidad || '', 
                    'coeficient': p.coeficient || 1 
                }));
            } else {
                excelData = allData.map(p => ({ 
                    'Código': p.codart, 
                    'Denominación': p.desart, 
                    'Familia': p.familia || '', 
                    'Proveedor': p.nomprov || '', 
                    'Costo': emptyIfZero(p.costo), 
                    'Stock': emptyIfZero(p.stock_total), 
                    'Unidad': p.unidad || '', 
                    'BETBEDER': emptyIfZero(p.stock_betbeder), 
                    'ISEAS': emptyIfZero(p.stock_iseas), 
                    'LLERENA': emptyIfZero(p.stock_llerena), 
                    'VENCIDO ISEAS': emptyIfZero(p.vencido_iseas), 
                    'VENCIDO LLERENA': emptyIfZero(p.vencidollerena), 
                    'DEFECTUOSO LLERENA': emptyIfZero(p.defectuosollerena) 
                }));
            }
            const ws = XLSX.utils.json_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Maestro");
            XLSX.writeFile(wb, `${type}_${new Date().toISOString().split('T')[0]}.xlsx`);
            setSyncLog(prev => [...prev, `¡Exportación exitosa!`]);
            setSyncSuccess(true);
            setTimeout(() => setSyncSuccess(false), 3000);
        } catch (err: any) { setSyncError("Error al exportar: " + err.message); } finally { setIsExporting(false); }
    };

    const processExcel = async (file: File) => {
        setIsSyncing(true); setSyncError(null); setSyncSuccess(false); setSyncLog([`Iniciando importación: ${file.name}...`]); setInconsistencies([]);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const dataArr = new Uint8Array(e.target?.result as ArrayBuffer);
                let workbook = XLSX.read(dataArr, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
                if (rows.length < 1) throw new Error("El archivo está vacío.");
                setSyncLog(prev => [...prev, "Analizando encabezados..."]);
                
                const { data: existingProductsData } = await supabase.from('master_products').select('codart');
                const existingProductCodes = new Set<string>((existingProductsData as any[])?.map(p => String(p.codart)) || []);
                
                let headerRowIndex = -1; let foundHeaders: string[] = [];
                for (let i = 0; i < Math.min(rows.length, 20); i++) {
                    const rowNormalized = rows[i].map(c => normalizeHeader(c));
                    if (rowNormalized.some(h => ['codart', 'codigo', 'cod'].includes(h))) { headerRowIndex = i; foundHeaders = rowNormalized; break; }
                }
                if (headerRowIndex === -1) throw new Error("No se detectó la columna 'codart'.");
                
                const findIdx = (aliases: string[]) => { const normalizedAliases = aliases.map(a => normalizeHeader(a)); return foundHeaders.findIndex(h => normalizedAliases.includes(h)); };
                const idx = { 
                    codart: findIdx(['codart', 'codigo', 'cod']), desart: findIdx(['desart', 'denominacion', 'articulo']), 
                    cbarra: findIdx(['cbarra', 'barras']), codprove: findIdx(['codprove', 'codigoproveedor']),
                    familia: findIdx(['familia']), nsubf: findIdx(['nsubf', 'subfamilia']), nomprov: findIdx(['nomprov', 'proveedor']),
                    costo: findIdx(['costo']), en_dolares: findIdx(['endolares', 'en_dolares']), tasa: findIdx(['tasa', 'iva']),
                    p1: findIdx(['pventa1', 'pventa_1']), p2: findIdx(['pventa2', 'pventa_2']), p3: findIdx(['pventa3', 'pventa_3']), p4: findIdx(['pventa4', 'pventa_4']),
                    betbeder: findIdx(['betbeder', 'stockbetbeder']), llerena: findIdx(['llerena', 'stockllerena']), iseas: findIdx(['iseas', 'stockiseas']), stock_total: findIdx(['stock', 'total'])
                };

                const dataToUpsert: any[] = []; const dataRows = rows.slice(headerRowIndex + 1);
                dataRows.forEach((row) => { 
                    const code = String(row[idx.codart] || '').trim(); if (!code) return;
                    if (!existingProductCodes.has(code)) inconsistencies.push(code); 
                    const payload: any = { codart: code, updated_at: new Date().toISOString() };
                    if (idx.desart !== -1) payload.desart = String(row[idx.desart] || '').trim().toUpperCase();
                    if (idx.costo !== -1) payload.costo = normalizeNumber(row[idx.costo]);
                    if (idx.p1 !== -1) payload.pventa_1 = normalizeNumber(row[idx.p1]);
                    if (idx.p2 !== -1) payload.pventa_2 = normalizeNumber(row[idx.p2]);
                    if (idx.p3 !== -1) payload.pventa_3 = normalizeNumber(row[idx.p3]);
                    if (idx.p4 !== -1) payload.pventa_4 = normalizeNumber(row[idx.p4]);
                    if (idx.betbeder !== -1) payload.stock_betbeder = normalizeNumber(row[idx.betbeder]);
                    if (idx.llerena !== -1) payload.stock_llerena = normalizeNumber(row[idx.llerena]);
                    if (idx.stock_total !== -1) payload.stock_total = normalizeNumber(row[idx.stock_total]);
                    dataToUpsert.push(payload); 
                });

                const chunkSize = 200; 
                for (let i = 0; i < dataToUpsert.length; i += chunkSize) { 
                    const chunk = dataToUpsert.slice(i, i + chunkSize); 
                    const { error } = await supabase.from('master_products').upsert(chunk, { onConflict: 'codart' }); 
                    if (error) throw error;
                }
                setSyncSuccess(true); setSyncLog(prev => [...prev, "¡IMPORTACIÓN COMPLETADA!"]);
            } catch (err: any) { setSyncError(err.message); } finally { setIsSyncing(false); }
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="flex flex-col gap-8 pb-10 max-w-6xl mx-auto">
            <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-black text-text tracking-tight uppercase italic">Configuración</h2>
                <p className="text-muted text-sm font-medium">Administración de base de datos y perfiles.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="md:col-span-1 space-y-2">
                    <button onClick={() => setActiveTab('profile')} className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest text-left transition-all border ${activeTab === 'profile' ? 'bg-primary text-white border-primary shadow-lg' : 'text-muted border-surfaceHighlight bg-surface hover:bg-surfaceHighlight'}`}>
                        <UserIcon size={16} /> Perfil
                    </button>
                    {isVale && (
                        <>
                            <button onClick={() => { setActiveTab('permissions'); setPermSearch(''); }} className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest text-left transition-all border ${activeTab === 'permissions' ? 'bg-primary text-white border-primary shadow-lg' : 'text-muted border-surfaceHighlight bg-surface hover:bg-surfaceHighlight'}`}>
                                <ShieldCheck size={16} /> Permisos (Global)
                            </button>
                            <button onClick={() => { setActiveTab('catalog_prices'); setSyncError(null); setSyncSuccess(false); setSyncLog([]); }} className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest text-left transition-all border ${activeTab === 'catalog_prices' ? 'bg-primary text-white border-primary shadow-lg' : 'text-muted border-surfaceHighlight bg-surface hover:bg-surfaceHighlight'}`}>
                                <FileSpreadsheet size={16} /> Maestro Artículos
                            </button>
                            <button onClick={() => { setActiveTab('catalog_stock'); setSyncError(null); setSyncSuccess(false); setSyncLog([]); }} className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest text-left transition-all border ${activeTab === 'catalog_stock' ? 'bg-primary text-white border-primary shadow-lg' : 'text-muted border-surfaceHighlight bg-surface hover:bg-surfaceHighlight'}`}>
                                <Boxes size={16} /> Maestro Stock
                            </button>
                        </>
                    )}
                </div>

                <div className="md:col-span-3">
                    {activeTab === 'profile' && (
                        <section className="bg-surface border border-surfaceHighlight rounded-3xl p-8 shadow-sm animate-in fade-in">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-black text-text flex items-center gap-3 uppercase tracking-tight italic">
                                    <UserIcon size={24} className="text-primary" /> Mi Perfil
                                </h3>
                            </div>
                            <div className="space-y-8">
                                <div className="flex flex-col items-center sm:flex-row gap-8">
                                    <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                        <div className="h-28 w-28 rounded-full border-4 border-surfaceHighlight overflow-hidden bg-background relative shadow-lg">
                                            {avatarUrl ? (
                                                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="h-full w-full flex items-center justify-center text-muted">
                                                    <UserIcon size={48} />
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                <Camera className="text-white" size={24} />
                                            </div>
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 p-2 bg-primary text-white rounded-full border-4 border-surface shadow-md">
                                            <Camera size={14} />
                                        </div>
                                        <input 
                                            ref={fileInputRef} 
                                            type="file" 
                                            accept="image/*" 
                                            className="hidden" 
                                            onChange={handleFileChange} 
                                        />
                                    </div>
                                    <div className="flex-1 space-y-4 w-full">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Nombre Visual</label>
                                            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 px-5 text-sm font-bold text-text outline-none focus:border-primary shadow-inner" />
                                        </div>
                                        <div className="p-4 bg-background/50 rounded-2xl border border-surfaceHighlight">
                                            <p className="text-[9px] font-black text-muted uppercase">Rol de Usuario</p>
                                            <p className="text-xs font-bold text-text mt-1 uppercase tracking-widest">{currentUser.role}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end items-center gap-4 pt-4 border-t border-surfaceHighlight">
                                    {showSuccess && <span className="text-xs font-bold text-green-500 uppercase flex items-center gap-1"><CheckCircle2 size={14}/> Perfil actualizado</span>}
                                    <button onClick={handleSaveProfile} disabled={isSaving} className="flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest bg-primary text-white shadow-xl hover:bg-primaryHover transition-all active:scale-95 disabled:opacity-50">
                                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                        Guardar Cambios
                                    </button>
                                </div>
                            </div>
                        </section>
                    )}

                    {activeTab === 'permissions' && isVale && (
                        <section className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm animate-in fade-in flex flex-col min-h-[600px]">
                            <div className="p-8 border-b border-surfaceHighlight bg-background/20 flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-black text-text flex items-center gap-3 uppercase tracking-tight italic">
                                        <ShieldCheck size={24} className="text-primary" /> Gestión de Permisos Globales
                                    </h3>
                                </div>
                                <button onClick={handleSyncPermissions} className="p-3 bg-surfaceHighlight rounded-2xl text-muted hover:text-primary transition-all">
                                    <RefreshCcw size={20} className={isPermsLoading ? 'animate-spin' : ''} />
                                </button>
                            </div>
                            {!selectedUserForPerms ? (
                                <div className="p-8 flex flex-col gap-6">
                                    <h4 className="text-sm font-black text-muted uppercase tracking-widest">1. Seleccione un usuario armador</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {allProfiles.filter(p => p.role === 'armador').map(user => (
                                            <button key={user.id} onClick={() => { setSelectedUserForPerms(user); loadUserPermissions(user.id); }} className="bg-background border border-surfaceHighlight p-5 rounded-2xl flex items-center justify-between hover:border-primary transition-all">
                                                <div className="flex items-center gap-4"><Users size={20}/><span className="font-black text-sm uppercase text-text">{user.name}</span></div>
                                                <ChevronRight className="text-muted" size={20}/>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col">
                                    <div className="bg-primary/5 px-8 py-4 border-b border-surfaceHighlight flex items-center justify-between">
                                        <button onClick={() => setSelectedUserForPerms(null)} className="text-primary hover:underline text-xs font-bold uppercase">← Volver</button>
                                        <span className="text-xs font-black uppercase text-text">Editando: <b className="text-primary">{selectedUserForPerms.name}</b></span>
                                    </div>
                                    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                                        <div className="w-full md:w-64 border-r border-surfaceHighlight bg-background/50 flex flex-col">
                                            {modules.map(mod => (
                                                <button key={mod} onClick={() => setSelectedModule(mod)} className={`px-6 py-4 text-left text-[11px] font-black uppercase border-b border-surfaceHighlight/30 transition-all ${selectedModule === mod ? 'bg-primary text-white' : 'text-muted hover:bg-surfaceHighlight'}`}>
                                                    {mod}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex-1 p-6 overflow-y-auto space-y-3">
                                            {permDict.filter(p => p.module === selectedModule).map(perm => (
                                                <button key={perm.key} onClick={() => togglePermission(perm.key)} className={`flex items-center justify-between p-4 rounded-xl border transition-all w-full ${userPerms.has(perm.key) ? 'border-primary bg-primary/5' : 'border-surfaceHighlight bg-background/50'}`}>
                                                    <span className="text-xs font-black uppercase">{perm.label}</span>
                                                    {userPerms.has(perm.key) ? <CheckSquare size={20} className="text-primary"/> : <Square size={20} className="text-muted/30"/>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    {(activeTab === 'catalog_prices' || activeTab === 'catalog_stock') && isVale && (
                        <section className="bg-surface border border-surfaceHighlight rounded-3xl p-8 shadow-sm animate-in fade-in">
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="text-xl font-black text-text flex items-center gap-3 uppercase tracking-tight italic">
                                    <FileSpreadsheet size={24} className="text-primary" /> Maestro de Datos
                                </h3>
                                <div className="flex gap-2">
                                    <button onClick={() => handleExportExcel(activeTab === 'catalog_prices' ? 'prices' : 'stock')} disabled={isExporting} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white text-[10px] font-black uppercase shadow-lg shadow-green-500/20 active:scale-95 disabled:opacity-50">
                                        {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />} Exportar
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <label className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${isSyncing ? 'bg-background/50 border-primary animate-pulse' : 'bg-background border-surfaceHighlight hover:border-primary/50'}`}>
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        {isSyncing ? <Loader2 size={48} className="text-primary animate-spin mb-4" /> : <UploadCloud size={48} className="text-muted mb-4" />}
                                        <p className="mb-2 text-sm text-text font-black uppercase tracking-tight text-center">Seleccionar Excel para ACTUALIZAR</p>
                                    </div>
                                    <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => { const f = e.target.files?.[0]; if (f) processExcel(f); }} disabled={isSyncing} />
                                </label>
                                {syncError && <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 flex items-start gap-3"><AlertCircle size={20}/><span className="text-[11px] font-bold">{syncError}</span></div>}
                                <div className="bg-background rounded-2xl p-4 border border-surfaceHighlight max-h-60 overflow-y-auto font-mono text-[10px] text-muted shadow-inner space-y-1">
                                    {syncLog.map((log, i) => <div key={i} className="flex items-start gap-2 py-0.5 border-b border-surfaceHighlight/30 last:border-none"><span className="text-primary font-black">→</span> {log}</div>)}
                                </div>
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
};
