
import React, { useState, useEffect, useCallback } from 'react';
import { 
    Copy, 
    Check, 
    RefreshCw, 
    Loader2, 
    MessageSquareQuote,
    Save,
    AlertCircle,
    Zap,
    CalendarCheck,
    CheckCircle2,
    XCircle,
    HelpCircle,
    Info,
    Sparkles,
    Eye,
    MessageCircle,
    History
} from 'lucide-react';
import { supabase } from '../supabase';
import { MasterProduct } from '../types';

// ==========================================
// 1. DICCIONARIO DE TRADUCCIÓN Y EMOJIS (nsubf)
// ==========================================
const SUB_CONFIG: Record<string, { label: string, emoji: string }> = {
    // ALMACEN
    'ARROZ': { label: 'ARROZ', emoji: '🍚' },
    'CONDIMENTOS': { label: 'CONDIMENTOS', emoji: '🧂' },
    'FIDEOS': { label: 'FIDEOS', emoji: '🍜' },
    'GOLOSINAS Y ENDULZANTES': { label: 'GOLOSINAS Y ENDULZANTES', emoji: '🍭' },
    'LIMPIEZA E HIGIENE': { label: 'LIMPIEZA E HIGIENE', emoji: '🧽' },
    'REPELENTES': { label: 'REPELENTES', emoji: '🦟' },
    'SNACKS': { label: 'SNACKS', emoji: '🥨' },
    'YERBAS E INFUSIONES': { label: 'YERBAS E INFUSIONES', emoji: '🌿' },
    
    // BEBIDAS (Subcategorías específicas según nsubf)
    'CERVEZA': { label: 'CERVEZAS', emoji: '🍻' },
    'CERVEZAS': { label: 'CERVEZAS', emoji: '🍻' },
    'CHAMPAGNE': { label: 'CHAMPAGNE & ESPUMANTES', emoji: '🍾' },
    'ESPUMANTE': { label: 'CHAMPAGNE & ESPUMANTES', emoji: '🍾' },
    'GIN': { label: 'GIN Y GINEBRAS', emoji: '🍸' },
    'GINEBRA': { label: 'GIN Y GINEBRAS', emoji: '🍸' },
    'VODKA': { label: 'VODKAS', emoji: '🧊' },
    'RON': { label: 'RON', emoji: '🏴‍☠️' },
    'TEQUILA': { label: 'TEQUILAS', emoji: '🥃' },
    'WHISKY': { label: 'WHISKY', emoji: '🥃' },
    'LICOR': { label: 'LICORES', emoji: '🥃' },
    'APERITIVOS': { label: 'LICORES', emoji: '🥃' }, // Mapeo preventivo o mantener como subcat
    'VERMOUTH': { label: 'LICORES', emoji: '🥃' },
    'GRAPPA': { label: 'GRAPAS', emoji: '🍇' },
    'GRAPAS': { label: 'GRAPAS', emoji: '🍇' },
    'GASEOSA': { label: 'SIN ALCOHOL Y ENERGIZANTES', emoji: '🥤' },
    'JUGO': { label: 'SIN ALCOHOL Y ENERGIZANTES', emoji: '🥤' },
    'AGUA': { label: 'SIN ALCOHOL Y ENERGIZANTES', emoji: '🥤' },
    'ENERGIZANTE': { label: 'SIN ALCOHOL Y ENERGIZANTES', emoji: '🥤' },

    // OTROS (Separación solicitada)
    'PULPA': { label: 'PULPAS', emoji: '🐙' },
    'PULPAS': { label: 'PULPAS', emoji: '🐙' },
    'CRISTALERIA': { label: 'CRISTALERIA Y MAS', emoji: '🫗' },
    'CRISTALERIA Y MAS': { label: 'CRISTALERIA Y MAS', emoji: '🫗' },
    'COPAS': { label: 'CRISTALERIA Y MAS', emoji: '🫗' },
    'VASOS': { label: 'CRISTALERIA Y MAS', emoji: '🫗' },
    'ESTERILLA': { label: 'ESTERILLAS', emoji: '🩶' },
    'ESTERILLAS': { label: 'ESTERILLAS', emoji: '🩶' },
    'ESTUCHERIA': { label: 'ESTUCHERIA Y GIFTPACK', emoji: '📦' },
    'ESTUCHE': { label: 'ESTUCHERIA Y GIFTPACK', emoji: '📦' },
    'GIFTPACK': { label: 'ESTUCHERIA Y GIFTPACK', emoji: '📦' }
};

// ==========================================
// 2. ORDEN OBLIGATORIO DE BEBIDAS (REGLA 3)
// ==========================================
const BEBIDAS_ORDER = [
    'CERVEZAS',
    'CHAMPAGNE & ESPUMANTES',
    'GIN Y GINEBRAS',
    'VODKAS',
    'RON',
    'TEQUILAS',
    'WHISKY',
    'LICORES',
    'GRAPAS',
    'SIN ALCOHOL Y ENERGIZANTES'
];

export const ListaChina: React.FC = () => {
    const [products, setProducts] = useState<MasterProduct[]>([]);
    const [snapshotMap, setSnapshotMap] = useState<Record<string, number>>({});
    const [lastSnapshotDate, setLastSnapshotDate] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showOnlyNew, setShowOnlyNew] = useState(false);
    const [copied, setCopied] = useState(false);
    const [generatedText, setGeneratedText] = useState('');
    const [dbError, setDbError] = useState<string | null>(null);

    const fetchData = useCallback(async (isSilent = false) => {
        if (!isSilent) setIsLoading(true);
        setDbError(null);
        try {
            const PAGE_SIZE = 1000;
            let from = 0;
            let allProducts: MasterProduct[] = [];
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('master_products')
                    .select('codart, desart, pventa_4, familia, nsubf, stock_llerena')
                    .gt('stock_llerena', 0)
                    .order('desart', { ascending: true })
                    .range(from, from + PAGE_SIZE - 1);

                if (error) throw error;
                if (data && data.length > 0) {
                    allProducts = [...allProducts, ...data];
                    if (data.length < PAGE_SIZE) hasMore = false;
                    else from += PAGE_SIZE;
                } else {
                    hasMore = false;
                }
            }

            const { data: allSnapshots, error: snapError } = await supabase
                .from('whatsapp_list_snapshot')
                .select('codart, last_price, created_at');

            if (snapError) throw snapError;

            const map: Record<string, number> = {};
            let latestDate: string | null = null;
            if (allSnapshots && allSnapshots.length > 0) {
                allSnapshots.forEach(s => { map[s.codart] = s.last_price; });
                latestDate = allSnapshots[0].created_at;
            }

            setProducts(allProducts);
            setSnapshotMap(map);
            setLastSnapshotDate(latestDate ? new Date(latestDate).toLocaleString('es-AR') : null);
        } catch (err: any) {
            setDbError(err.message || "Error de conexión.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const generateListText = useCallback(() => {
        if (products.length === 0) return "";
        
        const baseExists = Object.keys(snapshotMap).length > 0;

        // Categorías Principales permitidas (Regla 2)
        const hierarchy: Record<string, Record<string, MasterProduct[]>> = {
            '📦 ALMACEN': {},
            '🥂 BEBIDAS': {},
            '🍷 VINOS': {},
            '📋 OTROS': {}
        };

        products.forEach(p => {
            const matchesSearch = p.desart.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 p.codart.toLowerCase().includes(searchTerm.toLowerCase());
            const isNew = baseExists && snapshotMap[p.codart] === undefined;
            if (!matchesSearch || (showOnlyNew && !isNew)) return;

            const rawSub = (p.nsubf || p.familia || 'OTROS').toUpperCase();
            const config = SUB_CONFIG[rawSub] || { label: rawSub, emoji: '📋' };
            const subLabel = `${config.emoji} ${config.label}`;
            
            // Mapeo a Categoría Principal
            let mainKey = '📋 OTROS';
            const fam = (p.familia || '').toUpperCase();
            
            if (fam.includes('ALMACEN') || ['ARROZ', 'FIDEOS', 'SNACKS', 'CONDIMENTOS'].includes(rawSub)) {
                mainKey = '📦 ALMACEN';
            } else if (fam.includes('VINOS')) {
                mainKey = '🍷 VINOS';
            } else if (fam.includes('BEBIDAS') || fam.includes('CERVEZA') || fam.includes('GIN') || fam.includes('WHISKY')) {
                mainKey = '🥂 BEBIDAS';
            } else if (['PULPAS', 'CRISTALERIA Y MAS', 'ESTERILLAS', 'ESTUCHERIA Y GIFTPACK'].includes(config.label)) {
                mainKey = '📋 OTROS';
            }

            if (!hierarchy[mainKey][subLabel]) hierarchy[mainKey][subLabel] = [];
            hierarchy[mainKey][subLabel].push(p);
        });

        let text = "";
        if (showOnlyNew) {
            text += "🔥 NOVEDADES DISPONIBLES 🔥\n";
            text += `📅 ${new Date().toLocaleDateString('es-AR')}\n\n`;
        }

        // Orden modificado: VINOS al último
        const mainOrder = ['📦 ALMACEN', '🥂 BEBIDAS', '📋 OTROS', '🍷 VINOS'];

        mainOrder.forEach((mainTitle) => {
            const subs = hierarchy[mainTitle];
            if (Object.keys(subs).length === 0) return;

            text += `${mainTitle}\n\n`;

            // Ordenar subcategorías
            let subKeys = Object.keys(subs);
            if (mainTitle === '🥂 BEBIDAS') {
                subKeys = subKeys.sort((a, b) => {
                    const labelA = a.split(' ').slice(1).join(' ');
                    const labelB = b.split(' ').slice(1).join(' ');
                    const idxA = BEBIDAS_ORDER.indexOf(labelA);
                    const idxB = BEBIDAS_ORDER.indexOf(labelB);
                    if (idxA === -1 && idxB === -1) return a.localeCompare(b);
                    if (idxA === -1) return 1;
                    if (idxB === -1) return -1;
                    return idxA - idxB;
                });
            } else {
                subKeys = subKeys.sort();
            }

            subKeys.forEach((subLabel) => {
                const items = subs[subLabel];
                text += `${subLabel}\n\n`;
                
                items.sort((a, b) => a.desart.localeCompare(b.desart)).forEach(p => {
                    const isNew = baseExists && snapshotMap[p.codart] === undefined;
                    text += `${p.desart.toUpperCase()} $${Math.round(p.pventa_4)}${isNew ? ' 🆕' : ''}\n`;
                });
                
                text += "\n";
            });

            text += "\n";
        });

        return text.trim();
    }, [products, snapshotMap, searchTerm, showOnlyNew]);

    useEffect(() => {
        if (!isLoading) setGeneratedText(generateListText());
    }, [products, snapshotMap, searchTerm, isLoading, showOnlyNew, generateListText]);

    const startSaveProcess = async () => {
        setIsSaving(true);
        setSaveSuccess(false);
        setShowConfirm(false);

        try {
            await supabase.from('whatsapp_list_snapshot').delete().neq('codart', '._._._.'); 
            const payload = products.map(p => ({ 
                codart: p.codart, 
                desart: p.desart,
                last_price: p.pventa_4 
            }));

            const CHUNK_SIZE = 150;
            for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
                const chunk = payload.slice(i, i + CHUNK_SIZE);
                const { error: insError } = await supabase.from('whatsapp_list_snapshot').upsert(chunk);
                if (insError) throw insError;
            }

            const newSnapshotMap: Record<string, number> = {};
            products.forEach(p => { newSnapshotMap[p.codart] = p.pventa_4; });
            
            setSnapshotMap(newSnapshotMap);
            setLastSnapshotDate(new Date().toLocaleString('es-AR'));
            setSaveSuccess(true);
            setShowOnlyNew(false);
            
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err: any) {
            alert(`Error al fijar base: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(generatedText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) { console.error(err); }
    };

    const handleWhatsAppShare = () => {
        if (!generatedText || isLoading) return;
        const cleanText = generatedText.normalize('NFC').trim();
        const encodedText = encodeURIComponent(cleanText);
        const url = `https://api.whatsapp.com/send?text=${encodedText}`;
        window.open(url, '_blank');
    };

    const newItemsCount = products.filter(p => snapshotMap[p.codart] === undefined && Object.keys(snapshotMap).length > 0).length;

    return (
        <div className="flex flex-col gap-6 pb-20 max-w-6xl mx-auto animate-in fade-in">
            {dbError && (
                <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex items-center gap-3 text-red-600 shadow-lg">
                    <AlertCircle size={20} />
                    <span className="text-xs font-black uppercase tracking-tight">Error de DB: {dbError}</span>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight uppercase italic flex items-center gap-3">
                        <MessageSquareQuote className="text-primary" size={36} />
                        Lista China
                    </h2>
                    <p className="text-muted text-sm mt-1 font-medium flex items-center gap-2">
                        <CalendarCheck size={14} className="text-primary" />
                        Base fijada el: <b className="text-text">{lastSnapshotDate || 'Nunca'}</b>
                    </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <button onClick={() => fetchData()} disabled={isLoading || isSaving} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-4 rounded-2xl bg-surface border border-surfaceHighlight text-muted hover:text-primary transition-all font-black text-[10px] uppercase shadow-sm">
                        <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                    </button>

                    {!showConfirm ? (
                        <button 
                            onClick={() => setShowConfirm(true)}
                            disabled={isSaving || isLoading || products.length === 0}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 rounded-2xl border transition-all font-black text-[10px] uppercase shadow-md active:scale-95 
                                ${saveSuccess ? 'bg-green-600 text-white' : 'bg-surface border border-surfaceHighlight text-muted hover:text-green-500'}`}
                        >
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : saveSuccess ? <CheckCircle2 size={18} /> : <Save size={18} />}
                            {isSaving ? 'Fijando...' : saveSuccess ? '¡Listo!' : 'Fijar Actual'}
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 animate-in zoom-in-95">
                             <button 
                                onClick={startSaveProcess}
                                className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-orange-500 text-white font-black text-[10px] uppercase shadow-lg animate-pulse"
                            >
                                <HelpCircle size={18} />
                                ¿Limpiar "🆕"?
                            </button>
                            <button 
                                onClick={() => setShowConfirm(false)}
                                className="p-4 rounded-2xl bg-surface border border-surfaceHighlight text-red-500 hover:bg-red-50"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>
                    )}

                    <div className="flex gap-2 flex-1 md:flex-none">
                        <button 
                            onClick={handleWhatsAppShare} 
                            disabled={!generatedText || isLoading} 
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-black text-sm uppercase transition-all shadow-xl active:scale-95 bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/20"
                            title="Enviar por WhatsApp"
                        >
                            <MessageCircle size={20} />
                            <span className="hidden sm:inline">WhatsApp</span>
                        </button>
                        
                        <button 
                            onClick={handleCopy} 
                            disabled={!generatedText || isLoading} 
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-black text-sm uppercase transition-all shadow-xl active:scale-95 ${copied ? 'bg-green-600 text-white shadow-green-500/20' : 'bg-primary text-white hover:bg-primaryHover shadow-primary/20'}`}
                        >
                            {copied ? <Check size={20} /> : <Copy size={20} />}
                            {copied ? 'Copiado' : 'Copiar'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-surface rounded-3xl border border-surfaceHighlight p-6 shadow-sm flex flex-col gap-4">
                        <h3 className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                            <Zap size={14} className="text-primary" /> Filtros Dinámicos
                        </h3>
                        <input type="text" placeholder="Buscar por nombre o código..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-2xl px-5 py-4 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase" />
                        
                        <div className="h-px bg-surfaceHighlight my-1"></div>

                        <button 
                            onClick={() => setShowOnlyNew(!showOnlyNew)}
                            disabled={Object.keys(snapshotMap).length === 0}
                            className={`w-full py-5 rounded-2xl flex flex-col items-center justify-center gap-1 font-black uppercase transition-all border shadow-lg relative group ${showOnlyNew ? 'bg-primary text-white border-primary shadow-primary/30' : 'bg-background border-surfaceHighlight text-muted hover:border-primary/50'}`}
                        >
                            <div className="flex items-center gap-2 text-xs">
                                <Sparkles size={18} className={newItemsCount > 0 && !showOnlyNew ? 'animate-bounce text-orange-400' : ''} />
                                <span>{showOnlyNew ? 'Viendo Solo Novedades' : 'Filtrar por Novedades'}</span>
                            </div>
                            <span className={`text-[10px] font-bold ${showOnlyNew ? 'text-white/80' : 'text-primary'}`}>
                                {newItemsCount} artículos nuevos detectados
                            </span>
                            {showOnlyNew && <div className="absolute top-2 right-2 w-2 h-2 bg-white rounded-full animate-ping"></div>}
                        </button>
                    </div>

                    <div className="bg-surface rounded-3xl border border-surfaceHighlight p-6 space-y-5 shadow-sm">
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border border-primary/10">
                            <span className="text-xs font-black text-primary uppercase">Stock Activo</span>
                            <span className="text-2xl font-black text-primary">{products.length}</span>
                        </div>
                        
                        <div className="p-4 bg-background/50 rounded-2xl border border-surfaceHighlight">
                            <div className="flex gap-3">
                                <Info size={16} className="text-primary shrink-0 mt-0.5" />
                                <p className="text-[10px] text-muted font-bold leading-tight uppercase">
                                    El filtro de novedades separa automáticamente Cristalería, Esterillas, Estuches y Pulpas dentro de la categoría OTROS.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-8">
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm flex flex-col h-[650px]">
                        <div className="p-5 border-b border-surfaceHighlight bg-surfaceHighlight/20 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Eye size={16} className="text-primary" />
                                <span className="text-[10px] font-black text-muted uppercase tracking-widest">Vista Previa para Copiar {showOnlyNew && "✨"}</span>
                            </div>
                            {showOnlyNew && <span className="px-2 py-0.5 bg-orange-500 text-white text-[8px] font-black rounded uppercase animate-pulse">Filtrado</span>}
                        </div>
                        <textarea 
                            value={generatedText} 
                            readOnly 
                            className="flex-1 w-full p-8 bg-slate-950 text-blue-100 font-mono text-[11px] leading-relaxed resize-none outline-none scrollbar-thin selection:bg-primary/30"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
