
import React, { useState, useEffect, useMemo } from 'react';
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
    Square
} from 'lucide-react';
import { User, MasterProduct, AppPermission } from '../types';
import { supabase } from '../supabase';
import * as XLSX from 'xlsx';

interface SettingsProps {
    currentUser: User;
    onUpdateProfile: (newName: string) => Promise<void>;
}

type Tab = 'profile' | 'catalog_prices' | 'catalog_stock' | 'permissions';

export const Settings: React.FC<SettingsProps> = ({ currentUser, onUpdateProfile }) => {
    const [name, setName] = useState(currentUser.name);
    const [activeTab, setActiveTab] = useState<Tab>('profile');
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const [isSyncing, setIsSyncing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [syncLog, setSyncLog] = useState<string[]>([]);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [syncSuccess, setSyncSuccess] = useState(false);
    const [inconsistencies, setInconsistencies] = useState<string[]>([]);

    // --- PERMISSIONS STATE ---
    const [allProfiles, setAllProfiles] = useState<User[]>([]);
    const [selectedUserForPerms, setSelectedUserForPerms] = useState<User | null>(null);
    const [permDict, setPermDict] = useState<AppPermission[]>([]);
    const [userPerms, setUserPerms] = useState<Set<string>>(new Set());
    const [selectedModule, setSelectedModule] = useState<string | null>(null);
    const [isPermsLoading, setIsPermsLoading] = useState(false);

    const isVale = currentUser.role === 'vale';

    // Cargar perfiles y diccionario cuando se entra en pestaña permisos
    useEffect(() => {
        if (activeTab === 'permissions' && isVale) {
            fetchPermData();
        }
    }, [activeTab]);

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
                setSelectedModule(dictRes.data[0]?.module || null);
            }
        } catch (e) {
            console.error(e);
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
        
        if (isGranted) next.delete(key);
        else next.add(key);
        
        setUserPerms(next);

        // Guardado inmediato en DB para UX fluida
        try {
            if (isGranted) {
                await supabase.from('user_permissions').delete().eq('user_id', selectedUserForPerms.id).eq('permission_key', key);
            } else {
                await supabase.from('user_permissions').insert({ user_id: selectedUserForPerms.id, permission_key: key });
            }
        } catch (e) {
            alert("Error sincronizando permiso");
        }
    };

    const modules = useMemo(() => Array.from(new Set(permDict.map(p => p.module))), [permDict]);

    const handleSaveProfile = async () => {
        if (!name.trim()) return;
        setIsSaving(true);
        try {
            await onUpdateProfile(name);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (err: any) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const normalizeHeader = (s: any): string => {
        if (s === undefined || s === null) return "";
        return String(s)
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") 
            .replace(/[^a-z0-9]/g, ""); 
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
        setSyncLog([`Generando archivo de ${type === 'prices' ? 'Maestro Artículos' : 'Maestro Stock'}...`]);
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
            let excelData: any[] = [];
            if (type === 'prices') {
                excelData = allData.map(p => ({ 'codart': p.codart, 'codprove': p.codprove || '', 'cbarra': p.cbarra || '', 'desart': p.desart, 'costo': p.costo || 0, 'familia': p.familia || '', 'nsubf': p.nsubf || '', 'en_dolares': p.en_dolares || 'FALSO', 'tasa': p.tasa || '21', 'nomprov': p.nomprov || '', 'pventa_1': p.pventa_1 || 0, 'pventa_2': p.pventa_2 || 0, 'pventa_3': p.pventa_3 || 0, 'pventa_4': p.pventa_4 || 0, 'unicom': p.unicom || '', 'unidad': p.unidad || '', 'coeficient': p.coeficient || 1 }));
            } else {
                excelData = allData.map(p => ({ 'Código': p.codart, 'Denominación': p.desart, 'Familia': p.familia || '', 'Proveedor': p.nomprov || '', 'Costo': p.costo || 0, 'Stock': p.stock_total || 0, 'Unidad': p.unidad || '', 'BETBEDER': p.stock_betbeder || 0, 'ISEAS': p.stock_iseas || 0, 'LLERENA': p.stock_llerena || 0, 'VENCIDO ISEAS': p.vencido_iseas || 0, 'VENCIDO LLERENA': p.vencido_llerena || 0, 'DEFECTUOSO LLERENA': p.defectuoso_llerena || 0 }));
            }
            const worksheet = XLSX.utils.json_to_sheet(excelData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Maestro");
            const fileName = `${type === 'prices' ? 'articulos' : 'stock'}_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(workbook, fileName);
            setSyncLog(prev => [...prev, `¡Exportación exitosa! ${allData.length} registros.`]);
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
                if (headerRowIndex === -1) throw new Error("No se detectó la columna 'codart' o 'Código'. Verifique el archivo.");
                const findIdx = (aliases: string[]) => { const normalizedAliases = aliases.map(a => normalizeHeader(a)); return foundHeaders.findIndex(h => normalizedAliases.includes(h)); };
                const idx = { codart: findIdx(['codart', 'codigo', 'cod']), codprove: findIdx(['codprove', 'codigoproveedor']), cbarra: findIdx(['cbarra', 'barras', 'codigobarra']), desart: findIdx(['desart', 'denominacion', 'articulo']), costo: findIdx(['costo']), familia: findIdx(['familia', 'fam']), nsubf: findIdx(['nsubf', 'subfamilia']), en_dolares: findIdx(['endolares', 'en_dolares']), tasa: findIdx(['tasa', 'iva']), nomprov: findIdx(['nomprov', 'proveedor']), p1: findIdx(['pventa1', 'pventa_1', 'precio1']), p2: findIdx(['pventa2', 'pventa_2', 'precio2']), p3: findIdx(['pventa3', 'pventa_3', 'precio3']), p4: findIdx(['pventa4', 'pventa_4', 'precio4']), unicom: findIdx(['unicom', 'unicomp']), unidad: findIdx(['unidad', 'unid']), coeficient: findIdx(['coeficient', 'coeficiente']), stock_total: findIdx(['stock', 'existencia', 'total']), betbeder: findIdx(['betbeder', 'stockbetbeder']), iseas: findIdx(['iseas', 'stockiseas']), llerena: findIdx(['llerena', 'stockllerena']), v_iseas: findIdx(['vencidoiseas', 'vencido_iseas']), v_llerena: findIdx(['vencidollerena', 'vencido_llerena']), d_llerena: findIdx(['defectuosollerena', 'defectuoso_llerena']) };
                const dataToUpsert: any[] = []; const dataRows = rows.slice(headerRowIndex + 1); const localInconsistencies: string[] = [];
                dataRows.forEach((row, rIdx) => { const code = String(row[idx.codart] || '').trim(); if (!code) return; if (!existingProductCodes.has(code)) localInconsistencies.push(code); const payload: any = { codart: code, updated_at: new Date().toISOString() }; if (idx.desart !== -1) payload.desart = String(row[idx.desart] || '').trim().toUpperCase(); if (idx.cbarra !== -1) payload.cbarra = String(row[idx.cbarra] || '').trim(); if (idx.codprove !== -1) payload.codprove = String(row[idx.codprove] || '').trim() || null; if (idx.familia !== -1) payload.familia = String(row[idx.familia] || '').trim().toUpperCase(); if (idx.nsubf !== -1) payload.nsubf = String(row[idx.nsubf] || '').trim().toUpperCase(); if (idx.nomprov !== -1) payload.nomprov = String(row[idx.nomprov] || '').trim().toUpperCase(); if (idx.costo !== -1) payload.costo = normalizeNumber(row[idx.costo]); if (idx.en_dolares !== -1) payload.en_dolares = String(row[idx.en_dolares] || 'FALSO').trim().toUpperCase(); if (idx.tasa !== -1) payload.tasa = String(row[idx.tasa] || '21').trim(); if (idx.unicom !== -1) payload.unicom = String(row[idx.unicom] || '').trim(); if (idx.unidad !== -1) payload.unidad = String(row[idx.unidad] || '').trim(); if (idx.coeficient !== -1) payload.coeficient = normalizeNumber(row[idx.coeficient]); if (idx.p1 !== -1) payload.pventa_1 = normalizeNumber(row[idx.p1]); if (idx.p2 !== -1) payload.pventa_2 = normalizeNumber(row[idx.p2]); if (idx.p3 !== -1) payload.pventa_3 = normalizeNumber(row[idx.p3]); if (idx.p4 !== -1) payload.pventa_4 = normalizeNumber(row[idx.p4]); if (idx.betbeder !== -1) payload.stock_betbeder = normalizeNumber(row[idx.betbeder]); if (idx.llerena !== -1) payload.stock_llerena = normalizeNumber(row[idx.llerena]); if (idx.iseas !== -1) payload.stock_iseas = normalizeNumber(row[idx.iseas]); if (idx.stock_total !== -1) payload.stock_total = normalizeNumber(row[idx.stock_total]); else if (idx.betbeder !== -1 || idx.llerena !== -1) payload.stock_total = (payload.stock_betbeder || 0) + (payload.stock_llerena || 0); if (idx.v_iseas !== -1) payload.vencido_iseas = normalizeNumber(row[idx.v_iseas]); if (idx.v_llerena !== -1) payload.vencido_llerena = normalizeNumber(row[idx.v_llerena]); if (idx.d_llerena !== -1) payload.defectuoso_llerena = normalizeNumber(row[idx.d_llerena]); dataToUpsert.push(payload); });
                if (localInconsistencies.length > 0) setInconsistencies(localInconsistencies); if (dataToUpsert.length === 0) throw new Error("No se procesaron filas válidas.");
                setSyncLog(prev => [...prev, `Sincronizando ${dataToUpsert.length} artículos...`]); const chunkSize = 200; for (let i = 0; i < dataToUpsert.length; i += chunkSize) { const chunk = dataToUpsert.slice(i, i + chunkSize); const { error } = await supabase.from('master_products').upsert(chunk, { onConflict: 'codart' }); if (error) throw new Error(`Error en bloque ${i}: ${error.message}`); setSyncLog(prev => [...prev, `Progreso: ${Math.min(100, Math.round(((i + chunk.length) / dataToUpsert.length) * 100))}%`]); }
                setSyncSuccess(true); setSyncLog(prev => [...prev, "¡IMPORTACIÓN COMPLETADA CON ÉXITO!"]);
            } catch (err: any) { setSyncError(err.message || "Error desconocido."); setSyncLog(prev => [...prev, `❌ ERROR: ${err.message}`]); } finally { setIsSyncing(false); }
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
                            <button onClick={() => setActiveTab('permissions')} className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest text-left transition-all border ${activeTab === 'permissions' ? 'bg-primary text-white border-primary shadow-lg' : 'text-muted border-surfaceHighlight bg-surface hover:bg-surfaceHighlight'}`}>
                                <ShieldCheck size={16} /> Permisos Armadores
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
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Nombre Visual</label>
                                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 px-5 text-sm font-bold text-text outline-none focus:border-primary shadow-inner" />
                                </div>
                                <div className="flex justify-end items-center gap-4">
                                    {showSuccess && <span className="text-xs font-bold text-green-500 uppercase">Actualizado</span>}
                                    <button onClick={handleSaveProfile} disabled={isSaving} className="flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest bg-primary text-white shadow-xl hover:bg-primaryHover transition-all">
                                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                        Guardar
                                    </button>
                                </div>
                            </div>
                        </section>
                    )}

                    {activeTab === 'permissions' && isVale && (
                        <section className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm animate-in fade-in flex flex-col min-h-[600px]">
                            <div className="p-8 border-b border-surfaceHighlight">
                                <h3 className="text-xl font-black text-text flex items-center gap-3 uppercase tracking-tight italic">
                                    <ShieldCheck size={24} className="text-primary" /> Gestión de Permisos Dinámicos
                                </h3>
                                <p className="text-xs text-muted font-bold mt-1 uppercase">Define exactamente qué puede ver cada usuario con rol 'armador'.</p>
                            </div>

                            {!selectedUserForPerms ? (
                                <div className="p-8 flex flex-col gap-6">
                                    <h4 className="text-sm font-black text-muted uppercase tracking-widest">1. Seleccione un usuario armador</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {allProfiles.filter(p => p.role === 'armador').map(user => (
                                            <button 
                                                key={user.id} 
                                                onClick={() => { setSelectedUserForPerms(user); loadUserPermissions(user.id); }}
                                                className="bg-background border border-surfaceHighlight p-5 rounded-2xl flex items-center justify-between hover:border-primary group transition-all"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="p-2 bg-primary/10 text-primary rounded-lg"><Users size={20}/></div>
                                                    <span className="font-black text-sm uppercase text-text">{user.name}</span>
                                                </div>
                                                <ChevronRight className="text-muted group-hover:text-primary" size={20}/>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col">
                                    <div className="bg-primary/5 px-8 py-4 border-b border-surfaceHighlight flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <button onClick={() => setSelectedUserForPerms(null)} className="text-primary hover:underline text-xs font-bold uppercase">← Volver</button>
                                            <span className="text-xs font-black uppercase text-text">Editando Accesos de: <b className="text-primary">{selectedUserForPerms.name}</b></span>
                                        </div>
                                        {isPermsLoading && <Loader2 size={16} className="animate-spin text-primary" />}
                                    </div>

                                    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                                        {/* Columna Izquierda: Módulos */}
                                        <div className="w-full md:w-64 border-r border-surfaceHighlight bg-background/50 flex flex-col">
                                            {modules.map(mod => (
                                                <button 
                                                    key={mod} 
                                                    onClick={() => setSelectedModule(mod)}
                                                    className={`px-6 py-4 text-left text-xs font-black uppercase tracking-widest border-b border-surfaceHighlight/30 transition-all ${selectedModule === mod ? 'bg-primary text-white' : 'text-muted hover:bg-surfaceHighlight'}`}
                                                >
                                                    {mod}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Columna Derecha: Permisos del Módulo */}
                                        <div className="flex-1 p-8 overflow-y-auto space-y-4">
                                            <h4 className="text-[10px] font-black text-primary uppercase tracking-widest mb-6">Permisos de {selectedModule}</h4>
                                            <div className="grid grid-cols-1 gap-3">
                                                {permDict.filter(p => p.module === selectedModule).map(perm => {
                                                    const isGranted = userPerms.has(perm.key);
                                                    return (
                                                        <button 
                                                            key={perm.key} 
                                                            onClick={() => togglePermission(perm.key)}
                                                            className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isGranted ? 'border-primary bg-primary/5 shadow-sm' : 'border-surfaceHighlight bg-background opacity-60'}`}
                                                        >
                                                            <div className="flex flex-col text-left">
                                                                <span className={`text-xs font-black uppercase ${isGranted ? 'text-text' : 'text-muted'}`}>{perm.label}</span>
                                                                <span className="text-[8px] font-mono text-muted mt-1">{perm.key}</span>
                                                            </div>
                                                            {isGranted ? <CheckSquare size={20} className="text-primary"/> : <Square size={20} className="text-muted"/>}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    {(activeTab === 'catalog_prices' || activeTab === 'catalog_stock') && isVale && (
                        <section className="bg-surface border border-surfaceHighlight rounded-3xl p-8 shadow-sm animate-in fade-in">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-xl font-black text-text flex items-center gap-3 uppercase tracking-tight italic">
                                        {activeTab === 'catalog_prices' ? <Layers size={24} className="text-primary" /> : <Boxes size={24} className="text-primary" />}
                                        {activeTab === 'catalog_prices' ? 'Actualizar Artículos y Precios' : 'Actualizar Existencias (Stock)'}
                                    </h3>
                                    <p className="text-xs text-muted font-medium mt-1">
                                        {activeTab === 'catalog_prices' 
                                            ? 'Importa el archivo para actualizar precios de venta y datos maestros.' 
                                            : 'Importa el archivo para actualizar stock de depósitos.'}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleExportExcel(activeTab === 'catalog_prices' ? 'prices' : 'stock')}
                                        disabled={isExporting}
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-500/20 transition-all active:scale-95 disabled:opacity-50"
                                        title="Descargar base actual en formato compatible"
                                    >
                                        {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                                        Exportar
                                    </button>
                                    <button onClick={() => { setSyncLog([]); setSyncError(null); setSyncSuccess(false); setInconsistencies([]); }} className="p-2.5 rounded-xl bg-background border border-surfaceHighlight text-muted hover:text-red-500 transition-colors">
                                        <Eraser size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <label 
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) processExcel(f); }}
                                    className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${isSyncing ? 'bg-background/50 border-primary animate-pulse pointer-events-none' : 'bg-background border-surfaceHighlight hover:border-primary/50 hover:bg-primary/5'}`}
                                >
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        {isSyncing ? (
                                            <Loader2 size={48} className="text-primary animate-spin mb-4" />
                                        ) : (
                                            <UploadCloud size={48} className="text-muted mb-4" />
                                        )}
                                        <p className="mb-2 text-sm text-text font-black uppercase tracking-tight text-center px-4">
                                            {isSyncing ? 'Procesando archivo...' : 'Seleccionar o arrastrar Excel para ACTUALIZAR'}
                                        </p>
                                        <p className="text-xs text-muted font-medium italic">Se cruzarán datos por Código. Si no existe, se creará el registro.</p>
                                    </div>
                                    <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => { const f = e.target.files?.[0]; if (f) processExcel(f); }} disabled={isSyncing} />
                                </label>

                                {syncError && (
                                    <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 flex items-start gap-3 animate-in shake">
                                        <AlertCircle size={20} className="shrink-0 mt-0.5" />
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-black uppercase">Fallo en la sincronización</span>
                                            <span className="text-[11px] font-bold leading-relaxed">{syncError}</span>
                                        </div>
                                    </div>
                                )}

                                {inconsistencies.length > 0 && (
                                    <div className="p-5 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-orange-700 space-y-2">
                                        <div className="flex items-center gap-2 font-black text-[10px] uppercase">
                                            <FileWarning size={16} /> 
                                            {inconsistencies.length} Códigos nuevos detectados (se añadirán al sistema).
                                        </div>
                                    </div>
                                )}

                                {syncSuccess && !isExporting && (
                                    <div className="p-5 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-600 flex items-center justify-center gap-3 animate-in zoom-in-95">
                                        <CheckCircle2 size={24} />
                                        <span className="text-sm font-black uppercase tracking-widest">¡Tablas Actualizadas Exitosamente!</span>
                                    </div>
                                )}

                                <div className="bg-background rounded-2xl p-4 border border-surfaceHighlight max-h-60 overflow-y-auto font-mono text-[10px] text-muted shadow-inner space-y-1">
                                    {syncLog.map((log, i) => (
                                        <div key={i} className="flex items-start gap-2 py-0.5 border-b border-surfaceHighlight/30 last:border-none">
                                            <span className="text-primary font-black shrink-0">→</span> {log}
                                        </div>
                                    ))}
                                    {syncLog.length === 0 && <p className="text-center italic opacity-50 py-4">Esperando archivo...</p>}
                                </div>
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
};
