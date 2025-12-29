
import React, { useState } from 'react';
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
    FileDown
} from 'lucide-react';
import { User, MasterProduct } from '../types';
import { supabase } from '../supabase';
import * as XLSX from 'xlsx';

interface SettingsProps {
    currentUser: User;
    onUpdateProfile: (newName: string) => Promise<void>;
}

type Tab = 'profile' | 'catalog_prices' | 'catalog_stock';

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

    const isVale = currentUser.role === 'vale';

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

    const normalizeString = (s: any): string => {
        if (s === undefined || s === null) return "";
        return String(s)
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
            .replace(/[^a-z0-9_]/g, ""); // Quitar todo lo que no sea letra, número o guión bajo
    };

    const normalizeNumber = (val: any): number => {
        if (val === undefined || val === null || val === '') return 0;
        if (typeof val === 'number') return val;
        const cleaned = String(val).trim().replace(/\./g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    };

    // --- LÓGICA DE EXPORTACIÓN ---
    const handleExportExcel = async (type: 'prices' | 'stock') => {
        setIsExporting(true);
        setSyncLog([`Generando archivo de ${type === 'prices' ? 'Precio Maestro' : 'Stock Maestro'}...`]);
        
        try {
            const PAGE_SIZE = 1000;
            let allData: any[] = [];
            let from = 0;
            let hasMore = true;

            // Bucle para traer la base completa paginada
            while (hasMore) {
                const { data, error } = await supabase
                    .from('master_products')
                    .select('*')
                    .order('desart', { ascending: true })
                    .range(from, from + PAGE_SIZE - 1);

                if (error) throw error;
                
                if (data && data.length > 0) {
                    allData = [...allData, ...data];
                    setSyncLog(prev => [...prev, `Progreso descarga: ${allData.length} artículos...`]);
                    if (data.length < PAGE_SIZE) hasMore = false;
                    else from += PAGE_SIZE;
                } else {
                    hasMore = false;
                }
            }

            // Preparar datos según el tipo y orden solicitado
            let excelData: any[] = [];
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
                    'unicomp': '', // Campo vacío solicitado
                    'unidad': p.unidad || '',
                    'coeficient': 1 // Valor fijo solicitado
                }));
            } else {
                excelData = allData.map(p => ({
                    'codart': p.codart,
                    'desart': p.desart,
                    'stock_betbeder': p.stock_betbeder || 0,
                    'stock_llerena': p.stock_llerena || 0,
                    'stock_total': p.stock_total || 0,
                    'familia': p.familia || '',
                    'nomprov': p.nomprov || ''
                }));
            }

            // Generar Excel
            const worksheet = XLSX.utils.json_to_sheet(excelData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Maestro");
            
            const fileName = `${type === 'prices' ? 'articulo' : 'stock'}_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(workbook, fileName);
            
            setSyncLog(prev => [...prev, `¡Exportación exitosa! ${allData.length} registros.`]);
            setSyncSuccess(true);
            setTimeout(() => setSyncSuccess(false), 3000);

        } catch (err: any) {
            console.error("Error Export:", err);
            setSyncError("Error al exportar datos: " + err.message);
        } finally {
            setIsExporting(false);
        }
    };

    const processExcel = async (file: File) => {
        setIsSyncing(true);
        setSyncError(null);
        setSyncSuccess(false);
        setSyncLog([`Iniciando importación: ${file.name}...`]);
        setInconsistencies([]);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                let workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

                if (rows.length < 1) throw new Error("El archivo está vacío.");

                let headerRowIndex = -1;
                let foundHeaders: string[] = [];

                for (let i = 0; i < Math.min(rows.length, 20); i++) {
                    const rowNormalized = rows[i].map(c => normalizeString(c));
                    if (rowNormalized.some(h => h === 'codart' || h === 'codigo')) {
                        headerRowIndex = i;
                        foundHeaders = rowNormalized;
                        break;
                    }
                }

                if (headerRowIndex === -1) throw new Error("No se encontró la columna 'codart' o 'codigo'.");

                const findIdx = (aliases: string[]) => {
                    const normAliases = aliases.map(a => normalizeString(a));
                    return foundHeaders.findIndex(h => normAliases.some(alias => h === alias || h.includes(alias)));
                };

                const dataToUpsert: any[] = [];
                const dataRows = rows.slice(headerRowIndex + 1);

                if (activeTab === 'catalog_prices') {
                    const idx = {
                        codart: findIdx(['codart', 'codigo', 'cod']),
                        codprove: findIdx(['codprove']),
                        cbarra: findIdx(['cbarra', 'barras']),
                        desart: findIdx(['desart', 'denominacion', 'articulo', 'desc']),
                        familia: findIdx(['familia', 'fam']),
                        nsubf: findIdx(['nsubf', 'subfamilia', 'subf']),
                        en_dolares: findIdx(['en_dolares', 'dolares']),
                        tasa: findIdx(['tasa', 'iva']),
                        nomprov: findIdx(['nomprov', 'proveedor', 'noprov']),
                        costo: findIdx(['costo']),
                        p1: findIdx(['pventa_1', 'pventa1', 'precio1']),
                        p2: findIdx(['pventa_2', 'pventa2', 'precio2']),
                        p3: findIdx(['pventa_3', 'pventa3', 'precio3']),
                        p4: findIdx(['pventa_4', 'pventa4', 'precio4']),
                        unidad: findIdx(['unidad'])
                    };

                    dataRows.forEach((row) => {
                        const code = String(row[idx.codart] || '').trim();
                        if (!code) return;

                        dataToUpsert.push({
                            codart: code,
                            codprove: idx.codprove !== -1 ? String(row[idx.codprove] || '').trim() : undefined,
                            cbarra: idx.cbarra !== -1 ? String(row[idx.cbarra] || '').trim() : undefined,
                            desart: String(row[idx.desart] || 'SIN NOMBRE').trim(),
                            costo: normalizeNumber(row[idx.costo]),
                            familia: idx.familia !== -1 ? String(row[idx.familia] || '').trim() : null,
                            nsubf: idx.nsubf !== -1 ? String(row[idx.nsubf] || '').trim() : null,
                            en_dolares: idx.en_dolares !== -1 ? String(row[idx.en_dolares] || 'FALSO').trim() : 'FALSO',
                            tasa: idx.tasa !== -1 ? String(row[idx.tasa] || '21').trim() : '21',
                            nomprov: idx.nomprov !== -1 ? String(row[idx.nomprov] || '').trim() : null,
                            pventa_1: normalizeNumber(row[idx.p1]),
                            pventa_2: normalizeNumber(row[idx.p2]),
                            pventa_3: normalizeNumber(row[idx.p3]),
                            pventa_4: normalizeNumber(row[idx.p4]),
                            unidad: idx.unidad !== -1 ? String(row[idx.unidad] || '').trim() : null,
                            updated_at: new Date().toISOString()
                        });
                    });
                } else {
                    const idx = {
                        codart: findIdx(['codart', 'codigo', 'cod']),
                        betbeder: findIdx(['betbeder', 'stock_betbeder']),
                        llerena: findIdx(['llerena', 'stock_llerena'])
                    };

                    const { data: existingCodes } = await supabase.from('master_products').select('codart');
                    const codeSet = new Set(existingCodes?.map(c => c.codart) || []);
                    const localInconsistencies: string[] = [];

                    dataRows.forEach((row) => {
                        const code = String(row[idx.codart] || '').trim();
                        if (!code) return;

                        if (!codeSet.has(code)) localInconsistencies.push(code);

                        const b = normalizeNumber(row[idx.betbeder]);
                        const l = normalizeNumber(row[idx.llerena]);

                        dataToUpsert.push({
                            codart: code,
                            stock_betbeder: b,
                            stock_llerena: l,
                            stock_total: b + l,
                            updated_at: new Date().toISOString()
                        });
                    });
                    
                    if (localInconsistencies.length > 0) setInconsistencies(localInconsistencies);
                }

                if (dataToUpsert.length === 0) throw new Error("No se detectaron filas válidas.");

                setSyncLog(prev => [...prev, `Sincronizando ${dataToUpsert.length} artículos...`]);

                const chunkSize = 150;
                for (let i = 0; i < dataToUpsert.length; i += chunkSize) {
                    const chunk = dataToUpsert.slice(i, i + chunkSize);
                    const { error } = await supabase.from('master_products').upsert(chunk, { onConflict: 'codart' });
                    if (error) throw error;
                    setSyncLog(prev => [...prev, `Progreso: ${Math.round(((i + chunk.length) / dataToUpsert.length) * 100)}%`]);
                }

                setSyncSuccess(true);
                setSyncLog(prev => [...prev, "¡IMPORTACIÓN COMPLETADA CON ÉXITO!"]);
            } catch (err: any) {
                console.error("Error Excel:", err);
                setSyncError(err.message || "Error procesando el archivo.");
            } finally {
                setIsSyncing(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processExcel(file);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) processExcel(file);
    };

    return (
        <div className="flex flex-col gap-8 pb-10 max-w-5xl mx-auto">
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
                            <button onClick={() => { setActiveTab('catalog_prices'); setSyncError(null); setSyncSuccess(false); setSyncLog([]); }} className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest text-left transition-all border ${activeTab === 'catalog_prices' ? 'bg-primary text-white border-primary shadow-lg' : 'text-muted border-surfaceHighlight bg-surface hover:bg-surfaceHighlight'}`}>
                                <FileSpreadsheet size={16} /> Precio Maestro
                            </button>
                            <button onClick={() => { setActiveTab('catalog_stock'); setSyncError(null); setSyncSuccess(false); setSyncLog([]); }} className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest text-left transition-all border ${activeTab === 'catalog_stock' ? 'bg-primary text-white border-primary shadow-lg' : 'text-muted border-surfaceHighlight bg-surface hover:bg-surfaceHighlight'}`}>
                                <Boxes size={16} /> Stock Maestro
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

                    {(activeTab === 'catalog_prices' || activeTab === 'catalog_stock') && isVale && (
                        <section className="bg-surface border border-surfaceHighlight rounded-3xl p-8 shadow-sm animate-in fade-in">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-xl font-black text-text flex items-center gap-3 uppercase tracking-tight italic">
                                        {activeTab === 'catalog_prices' ? <Layers size={24} className="text-primary" /> : <Boxes size={24} className="text-primary" />}
                                        {activeTab === 'catalog_prices' ? 'Artículos y Precios' : 'Maestro de Stock'}
                                    </h3>
                                    <p className="text-xs text-muted font-medium mt-1">
                                        {activeTab === 'catalog_prices' 
                                            ? 'Importa/Exporta el archivo de 17 columnas compatible con la web.' 
                                            : 'Gestiona existencias de Betbeder y Llerena.'}
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
                                    onDrop={onDrop}
                                    className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${isSyncing ? 'bg-background/50 border-primary animate-pulse pointer-events-none' : 'bg-background border-surfaceHighlight hover:border-primary/50 hover:bg-primary/5'}`}
                                >
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        {isSyncing ? (
                                            <Loader2 size={48} className="text-primary animate-spin mb-4" />
                                        ) : (
                                            <UploadCloud size={48} className="text-muted mb-4" />
                                        )}
                                        <p className="mb-2 text-sm text-text font-black uppercase tracking-tight text-center px-4">
                                            {isSyncing ? 'Procesando archivo...' : 'Seleccionar o arrastrar Excel para IMPORTAR'}
                                        </p>
                                        <p className="text-xs text-muted font-medium">Formato compatible de 17 columnas</p>
                                    </div>
                                    <input type="file" className="hidden" accept=".xlsx, .xls" onChange={onFileChange} disabled={isSyncing} />
                                </label>

                                {syncError && (
                                    <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 flex items-start gap-3 animate-in shake">
                                        <AlertCircle size={20} className="shrink-0 mt-0.5" />
                                        <span className="text-xs font-bold leading-relaxed">{syncError}</span>
                                    </div>
                                )}

                                {inconsistencies.length > 0 && (
                                    <div className="p-5 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-orange-700 space-y-2">
                                        <div className="flex items-center gap-2 font-black text-[10px] uppercase">
                                            <FileWarning size={16} /> 
                                            {inconsistencies.length} Códigos de stock no detectados previamente (se crearán).
                                        </div>
                                    </div>
                                )}

                                {syncSuccess && !isExporting && (
                                    <div className="p-5 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-600 flex items-center justify-center gap-3 animate-in zoom-in-95">
                                        <CheckCircle2 size={24} />
                                        <span className="text-sm font-black uppercase tracking-widest">¡Sincronización Exitosa!</span>
                                    </div>
                                )}

                                <div className="bg-background rounded-2xl p-4 border border-surfaceHighlight max-h-60 overflow-y-auto font-mono text-[10px] text-muted shadow-inner space-y-1">
                                    {syncLog.map((log, i) => (
                                        <div key={i} className="flex items-start gap-2 py-0.5 border-b border-surfaceHighlight/30 last:border-none">
                                            <span className="text-primary font-black shrink-0">→</span> {log}
                                        </div>
                                    ))}
                                    {syncLog.length === 0 && <p className="text-center italic opacity-50 py-4">Sin actividad reciente.</p>}
                                </div>
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
};
