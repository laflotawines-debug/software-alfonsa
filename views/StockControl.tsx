
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    Plus, 
    Search, 
    Trash2, 
    Loader2, 
    CheckCircle2, 
    AlertCircle, 
    ChevronRight, 
    Package, 
    Filter, 
    User as UserIcon, 
    ClipboardCheck, 
    Warehouse,
    Save,
    RotateCcw,
    X,
    FileSpreadsheet,
    Check,
    Calendar,
    AlertTriangle,
    CheckSquare,
    Square,
    LayoutList,
    ArrowRightLeft,
    ChevronDown,
    ArrowRight,
    Edit3,
    ArrowUpRight,
    ArrowDownLeft,
    XCircle,
    Layers,
    BoxSelect,
    ArrowDown,
    Database,
    Globe
} from 'lucide-react';
import { supabase } from '../supabase';
import { User, StockControlSession, StockControlItem, MasterProduct } from '../types';
import * as XLSX from 'xlsx';

interface StockControlProps {
    currentUser: User;
}

export const StockControl: React.FC<StockControlProps> = ({ currentUser }) => {
    const [mode, setMode] = useState<'list' | 'create' | 'execution' | 'review'>('list');
    const [sessions, setSessions] = useState<any[]>([]);
    const [activeSession, setActiveSession] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
    
    // --- CREATE MODE STATES ---
    const [newName, setNewName] = useState('');
    const [warehouseId, setWarehouseId] = useState('');
    const [warehouses, setWarehouses] = useState<{id: string, name: string}[]>([]);
    
    // Productos y Filtros
    const [products, setProducts] = useState<MasterProduct[]>([]);
    const [isProductsLoading, setIsProductsLoading] = useState(false);
    const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
    const [filters, setFilters] = useState({ 
        family: 'TODAS', 
        subfamily: 'TODAS', 
        provider: 'TODOS', 
        search: '' 
    });
    const [showWithStock, setShowWithStock] = useState(true);
    const [showWithoutStock, setShowWithoutStock] = useState(true);
    const [showNegativeStock, setShowNegativeStock] = useState(true);

    // --- PAGINATION STATE ---
    const PAGE_SIZE = 100;
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    // --- METADATA FOR FILTERS ---
    const [metaFamilies, setMetaFamilies] = useState<string[]>([]);
    const [metaSubfamilies, setMetaSubfamilies] = useState<string[]>([]);
    const [metaProviders, setMetaProviders] = useState<string[]>([]);

    // --- EXECUTION / REVIEW STATES ---
    const [controlItems, setControlItems] = useState<any[]>([]);
    const [isSavingCount, setIsSavingCount] = useState(false);
    const [executionSearch, setExecutionSearch] = useState('');
    const [reviewSearch, setReviewSearch] = useState('');
    const [executionSort, setExecutionSort] = useState<'none' | 'diff' | 'pending'>('none');
    const [reviewSort, setReviewSort] = useState<'none' | 'diff' | 'pending'>('none');
    const [showGlobalDifferences, setShowGlobalDifferences] = useState(false);
    const [globalDifferences, setGlobalDifferences] = useState<any[]>([]);
    const [isGlobalLoading, setIsGlobalLoading] = useState(false);

    const isVale = currentUser.role === 'vale';

    const fetchSessions = async () => {
        setIsLoading(true);
        try {
            const { data: sessionsData } = await supabase
                .from('stock_control_sessions')
                .select(`*, warehouses(name)`)
                .order('created_at', { ascending: false });
            
            if (sessionsData) {
                const sessionIds = sessionsData.map(s => s.id);
                let allItems: any[] = [];
                
                if (sessionIds.length > 0) {
                    let keepFetching = true;
                    let from = 0;
                    const BATCH_SIZE = 1000;
                    while (keepFetching) {
                        const { data: itemsChunk, error } = await supabase
                            .from('stock_control_items')
                            .select('id, session_id, stock_control_counts(user_id)')
                            .in('session_id', sessionIds)
                            .range(from, from + BATCH_SIZE - 1);
                        
                        if (error) throw error;
                        if (itemsChunk && itemsChunk.length > 0) {
                            allItems = [...allItems, ...itemsChunk];
                            if (itemsChunk.length < BATCH_SIZE) keepFetching = false;
                            else from += BATCH_SIZE;
                        } else {
                            keepFetching = false;
                        }
                    }
                }

                const mapped = sessionsData.map(s => {
                    const items = allItems.filter(i => i.session_id === s.id);
                    const allUserIds = items.flatMap((i: any) => i.stock_control_counts.map((c: any) => c.user_id));
                    const uniqueUsers = Array.from(new Set(allUserIds));
                    return {
                        ...s, 
                        warehouse_name: s.warehouses?.name, 
                        item_count: items.length, 
                        assigned_users: uniqueUsers,
                        user_progress: uniqueUsers.map(uid => {
                            const countedByThisUser = items.filter((i: any) => i.stock_control_counts.some((c: any) => c.user_id === uid)).length;
                            return { userId: uid, count: countedByThisUser };
                        })
                    };
                });
                setSessions(mapped);
            }
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    // Cargar metadatos para los filtros (solo una vez)
    const fetchFilterMetadata = async () => {
        try {
            let page = 0;
            const f = new Set<string>();
            const s = new Set<string>();
            const p = new Set<string>();
            
            while (true) {
                const { data } = await supabase.from('master_products').select('familia, nsubf, nomprov').neq('familia', 'ELIMINADOS').range(page * 1000, (page + 1) * 1000 - 1);
                if (data) {
                    data.forEach((item: any) => {
                        if (item.familia) f.add(item.familia);
                        if (item.nsubf) s.add(item.nsubf);
                        if (item.nomprov) p.add(item.nomprov);
                    });
                }
                if (!data || data.length < 1000) break;
                page++;
            }
            
            setMetaFamilies(Array.from(f).sort());
            setMetaSubfamilies(Array.from(s).sort());
            setMetaProviders(Array.from(p).sort());
        } catch (e) { console.error("Error loading metadata", e); }
    };

    // Función de carga paginada con filtros en servidor
    const fetchProducts = useCallback(async (isLoadMore = false) => {
        setIsProductsLoading(true);
        try {
            const currentOffset = isLoadMore ? (page + 1) * PAGE_SIZE : 0;
            const rangeEnd = currentOffset + PAGE_SIZE - 1;

            let query = supabase.from('master_products').select('*').neq('familia', 'ELIMINADOS');

            // Filtros de Texto
            if (filters.search.trim()) {
                const term = filters.search.trim();
                query = query.or(`desart.ilike.%${term}%,codart.ilike.%${term}%`);
            }

            // Filtros de Categoría
            if (filters.family !== 'TODAS') query = query.eq('familia', filters.family);
            if (filters.subfamily !== 'TODAS') query = query.eq('nsubf', filters.subfamily);
            if (filters.provider !== 'TODOS') query = query.eq('nomprov', filters.provider);

            // Filtro de Stock (Depende del almacén seleccionado)
            if (warehouseId) {
                const selectedWh = warehouses.find(w => w.id === warehouseId);
                const stockField = (selectedWh?.name || '').toUpperCase() === 'LLERENA' ? 'stock_llerena' : 'stock_betbeder';
                
                const conditions = [];
                if (showWithStock) conditions.push(`${stockField}.gt.0`);
                if (showWithoutStock) conditions.push(`${stockField}.eq.0`);
                if (showNegativeStock) conditions.push(`${stockField}.lt.0`);

                if (conditions.length === 0) {
                    query = query.eq('codart', 'NONE_SELECTED');
                } else if (conditions.length < 3) {
                    query = query.or(conditions.join(','));
                }
            }

            // Orden y Paginación
            query = query.order('desart', { ascending: true }).range(currentOffset, rangeEnd);

            const { data, error } = await query;
            
            if (error) throw error;

            if (data) {
                if (isLoadMore) {
                    setProducts(prev => [...prev, ...data]);
                    setPage(prev => prev + 1);
                } else {
                    setProducts(data);
                    setPage(0);
                }
                // Si trajimos menos de una página completa, no hay más
                setHasMore(data.length === PAGE_SIZE);
            }
        } catch (e: any) {
            console.error("Error fetching products:", e);
            alert("Error: " + e.message);
        } finally {
            setIsProductsLoading(false);
        }
    }, [filters, showWithStock, showWithoutStock, warehouseId, warehouses, page]);

    // Función para cargar TODO el resultado de los filtros (Sin paginación visual, bucle interno)
    const handleLoadAll = async () => {
        setIsProductsLoading(true);
        try {
            const BATCH_SIZE = 1000;
            let from = 0;
            let allFetched: MasterProduct[] = [];
            let keepFetching = true;

            while (keepFetching) {
                let query = supabase.from('master_products').select('*').neq('familia', 'ELIMINADOS');

                // Aplicar mismos filtros
                if (filters.search.trim()) {
                    const term = filters.search.trim();
                    query = query.or(`desart.ilike.%${term}%,codart.ilike.%${term}%`);
                }
                if (filters.family !== 'TODAS') query = query.eq('familia', filters.family);
                if (filters.subfamily !== 'TODAS') query = query.eq('nsubf', filters.subfamily);
                if (filters.provider !== 'TODOS') query = query.eq('nomprov', filters.provider);

                if (warehouseId) {
                    const selectedWh = warehouses.find(w => w.id === warehouseId);
                    const stockField = (selectedWh?.name || '').toUpperCase() === 'LLERENA' ? 'stock_llerena' : 'stock_betbeder';
                    
                    const conditions = [];
                    if (showWithStock) conditions.push(`${stockField}.gt.0`);
                    if (showWithoutStock) conditions.push(`${stockField}.eq.0`);
                    if (showNegativeStock) conditions.push(`${stockField}.lt.0`);

                    if (conditions.length === 0) {
                        query = query.eq('codart', 'NONE_SELECTED');
                    } else if (conditions.length < 3) {
                        query = query.or(conditions.join(','));
                    }
                }

                query = query.order('desart', { ascending: true }).range(from, from + BATCH_SIZE - 1);
                
                const { data, error } = await query;
                if (error) throw error;

                if (data && data.length > 0) {
                    allFetched = [...allFetched, ...data];
                    if (data.length < BATCH_SIZE) keepFetching = false;
                    else from += BATCH_SIZE;
                } else {
                    keepFetching = false;
                }
            }

            setProducts(allFetched);
            setHasMore(false); // Ya trajimos todo
            setPage(0); // Reset page logic though it won't be used
        } catch (e: any) {
            alert("Error al cargar todo: " + e.message);
        } finally {
            setIsProductsLoading(false);
        }
    };

    // Efecto para recargar cuando cambian los filtros (reset)
    useEffect(() => {
        if (mode === 'create' && isVale) {
            // Debounce para la búsqueda de texto
            const timeoutId = setTimeout(() => {
                fetchProducts(false);
            }, 400);
            return () => clearTimeout(timeoutId);
        }
    }, [filters, showWithStock, showWithoutStock, showNegativeStock, warehouseId]);

    const fetchGlobalDifferences = async () => {
        setIsGlobalLoading(true);
        try {
            const { data, error } = await supabase
                .from('stock_control_items')
                .select('id, codart, system_qty, corrected_qty, session_id, master_products(desart), stock_control_sessions(name, warehouse_id, warehouses(name))')
                .not('corrected_qty', 'is', null);
            
            if (error) throw error;
            
            if (data) {
                const diffs = data.filter((item: any) => item.corrected_qty !== item.system_qty).map((item: any) => ({
                    id: item.id,
                    codart: item.codart,
                    desart: item.master_products?.desart,
                    system_qty: item.system_qty,
                    corrected_qty: item.corrected_qty,
                    session_id: item.session_id,
                    session_name: item.stock_control_sessions?.name,
                    warehouse_id: item.stock_control_sessions?.warehouse_id,
                    warehouse_name: item.stock_control_sessions?.warehouses?.name || 'S/D',
                    ajuste: item.corrected_qty - item.system_qty
                }));
                diffs.sort((a, b) => {
                    if (a.warehouse_name < b.warehouse_name) return -1;
                    if (a.warehouse_name > b.warehouse_name) return 1;
                    if (a.session_name < b.session_name) return -1;
                    if (a.session_name > b.session_name) return 1;
                    if (a.desart < b.desart) return -1;
                    if (a.desart > b.desart) return 1;
                    return 0;
                });
                setGlobalDifferences(diffs);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsGlobalLoading(false);
        }
    };

    const globalDiffsByWarehouse = useMemo(() => {
        const groups: Record<string, any[]> = {};
        globalDifferences.forEach(diff => {
            const wh = diff.warehouse_name;
            if (!groups[wh]) groups[wh] = [];
            groups[wh].push(diff);
        });
        return groups;
    }, [globalDifferences]);

    useEffect(() => {
        if (showGlobalDifferences) {
            fetchGlobalDifferences();
        }
    }, [showGlobalDifferences]);

    // Carga inicial
    useEffect(() => {
        fetchSessions();
        if (isVale) {
            supabase.from('warehouses').select('*').then(res => res.data && setWarehouses(res.data));
            fetchFilterMetadata();
        }
    }, [isVale]);

    const handleDeleteSession = async (id: string) => {
        try {
            const { error } = await supabase.from('stock_control_sessions').delete().eq('id', id);
            if (error) throw error;
            setSessions(prev => prev.filter(s => s.id !== id));
            setConfirmingDeleteId(null);
        } catch (e: any) { alert("Error: " + e.message); }
    };

    const handleCreateSession = async () => {
        if (!newName || !warehouseId || selectedProducts.size === 0) return alert("Faltan datos.");
        setIsLoading(true);
        try {
            const { data: session, error } = await supabase.from('stock_control_sessions').insert({
                name: newName, warehouse_id: warehouseId, status: 'active', created_by: currentUser.id
            }).select().single();
            if (error) throw error;
            const warehouseObj = warehouses.find(w => w.id === warehouseId);
            
            // We need to fetch stock for products that might not be in the current paginated view
            const missingProducts = Array.from(selectedProducts).filter(cod => !products.find(p => p.codart === cod));
            let additionalProducts: MasterProduct[] = [];
            
            if (missingProducts.length > 0) {
                // Fetch missing products in batches to avoid URL length limits
                const fetchBatchSize = 200;
                for (let i = 0; i < missingProducts.length; i += fetchBatchSize) {
                    const batch = missingProducts.slice(i, i + fetchBatchSize);
                    const { data, error: fetchError } = await supabase
                        .from('master_products')
                        .select('codart, stock_llerena, stock_betbeder')
                        .in('codart', batch);
                    
                    if (fetchError) throw fetchError;
                    if (data) additionalProducts = [...additionalProducts, ...data as MasterProduct[]];
                }
            }

            const allAvailableProducts = [...products, ...additionalProducts];

            const itemsToInsert = Array.from(selectedProducts).map(cod => {
                const p = allAvailableProducts.find(prod => prod.codart === cod);
                const stock = warehouseObj?.name === 'LLERENA' ? p?.stock_llerena : p?.stock_betbeder;
                return { session_id: session.id, codart: cod, system_qty: stock || 0 };
            });
            
            const chunkSize = 1000;
            for (let i = 0; i < itemsToInsert.length; i += chunkSize) {
                const chunk = itemsToInsert.slice(i, i + chunkSize);
                const { error: insertError } = await supabase.from('stock_control_items').insert(chunk);
                if (insertError) throw insertError;
            }
            
            setMode('list');
            fetchSessions();
            setSelectedProducts(new Set());
            setNewName('');
        } catch (e: any) { alert(e.message); } finally { setIsLoading(false); }
    };

    const startSessionExecution = async (session: any) => {
        setActiveSession(session);
        setExecutionSearch('');
        setReviewSearch('');
        setIsLoading(true);
        try {
            let allItems: any[] = [];
            let keepFetching = true;
            let from = 0;
            const BATCH_SIZE = 1000;

            while (keepFetching) {
                const { data, error } = await supabase
                    .from('stock_control_items')
                    .select('*, master_products(desart), stock_control_counts(user_id, qty, profiles(name))')
                    .eq('session_id', session.id)
                    .order('id')
                    .range(from, from + BATCH_SIZE - 1);
                
                if (error) throw error;
                
                if (data && data.length > 0) {
                    allItems = [...allItems, ...data];
                    if (data.length < BATCH_SIZE) keepFetching = false;
                    else from += BATCH_SIZE;
                } else {
                    keepFetching = false;
                }
            }

            if (allItems.length > 0) {
                setControlItems(allItems.map((item: any) => ({
                    id: item.id, session_id: item.session_id, codart: item.codart, desart: item.master_products?.desart, system_qty: item.system_qty, corrected_qty: item.corrected_qty,
                    counts: item.stock_control_counts.map((c: any) => ({ user_id: c.user_id, user_name: c.profiles?.name, qty: c.qty }))
                })));
                setMode(isVale ? 'review' : 'execution');
            }
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    const handleSavePhysicalCount = async (itemId: string, qty: number) => {
        if (isNaN(qty)) return;
        setIsSavingCount(true);
        try {
            await supabase.from('stock_control_counts').upsert({ item_id: itemId, user_id: currentUser.id, qty: qty }, { onConflict: 'item_id,user_id' });
            setControlItems(prev => prev.map(i => i.id === itemId ? { ...i, counts: [...i.counts.filter((c: any) => c.user_id !== currentUser.id), { user_id: currentUser.id, user_name: currentUser.name, qty: qty }] } : i));
        } catch (e: any) { alert(e.message); } finally { setIsSavingCount(false); }
    };

    const handleAdminCorrection = async (itemId: string, val: number | null) => {
        try {
            await supabase.from('stock_control_items').update({ corrected_qty: val }).eq('id', itemId);
            setControlItems(prev => prev.map(i => i.id === itemId ? { ...i, corrected_qty: val } : i));
        } catch (e) { alert("Error"); }
    };

    const handleCreateRecontrol = async (warehouseId: string, warehouseName: string, diffs: any[]) => {
        if (!warehouseId || diffs.length === 0) return;
        setIsLoading(true);
        try {
            const recontrolName = `RE-CONTROL ${warehouseName} ${new Date().toLocaleDateString()}`;
            const { data: session, error } = await supabase.from('stock_control_sessions').insert({
                name: recontrolName, warehouse_id: warehouseId, status: 'active', created_by: currentUser.id
            }).select().single();
            
            if (error) throw error;

            // Use corrected_qty as the new system_qty for the re-control
            const itemsToInsert = diffs.map(d => ({
                session_id: session.id,
                codart: d.codart,
                system_qty: d.corrected_qty // The "system" for re-control is what we corrected to
            }));

            const chunkSize = 1000;
            for (let i = 0; i < itemsToInsert.length; i += chunkSize) {
                const chunk = itemsToInsert.slice(i, i + chunkSize);
                const { error: insertError } = await supabase.from('stock_control_items').insert(chunk);
                if (insertError) throw insertError;
            }

            setShowGlobalDifferences(false);
            fetchSessions();
            alert(`Se ha creado el re-control: ${recontrolName}`);
        } catch (e: any) {
            alert("Error al crear re-control: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportGlobalDifferences = () => {
        if (globalDifferences.length === 0) return;

        const data = globalDifferences.map(item => ({
            'Auditoría': item.session_name,
            'Código': item.codart,
            'Producto': item.desart,
            'Stock Sistema': item.system_qty,
            'Stock Corregido': item.corrected_qty,
            'Diferencia (Ajuste)': item.ajuste
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Diferencias Globales");
        XLSX.writeFile(wb, `Diferencias_Globales_Stock_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleExportExcel = () => {
        if (!activeSession || controlItems.length === 0) return;

        const data = controlItems.map(item => {
            const c1 = item.counts[0];
            const c2 = item.counts[1];
            const finalVal = (item.corrected_qty !== null && item.corrected_qty !== undefined) ? item.corrected_qty : item.system_qty;
            const diff = finalVal - item.system_qty;

            return {
                'Código': item.codart,
                'Producto': item.desart,
                'Stock Sistema': item.system_qty,
                'Conteo Armador 1': c1 ? c1.qty : 'Pendiente',
                'Armador 1 Nombre': c1 ? c1.user_name : '-',
                'Conteo Armador 2': c2 ? c2.qty : 'Pendiente',
                'Armador 2 Nombre': c2 ? c2.user_name : '-',
                'Stock Corregido': item.corrected_qty ?? item.system_qty,
                'Diferencia (Ajuste)': diff
            };
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
        XLSX.writeFile(wb, `Auditoria_${activeSession.name}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const filteredExecutionItems = useMemo(() => {
        let items = [...controlItems];
        const keywords = executionSearch.toLowerCase().split(/\s+/).filter(k => k.length > 0);
        
        if (keywords.length > 0) {
            items = items.filter(item => {
                const textToSearch = `${item.desart} ${item.codart}`.toLowerCase();
                return keywords.every(k => textToSearch.includes(k));
            });
        }

        if (executionSort === 'diff') {
            items.sort((a, b) => {
                const aCount = a.counts.find((c: any) => c.user_id === currentUser.id);
                const bCount = b.counts.find((c: any) => c.user_id === currentUser.id);
                const aIsDiff = aCount && Math.round(aCount.qty) !== Math.round(a.system_qty);
                const bIsDiff = bCount && Math.round(bCount.qty) !== Math.round(b.system_qty);
                if (aIsDiff && !bIsDiff) return -1;
                if (!aIsDiff && bIsDiff) return 1;
                return 0;
            });
        } else if (executionSort === 'pending') {
            items.sort((a, b) => {
                const aPending = !a.counts.some((c: any) => c.user_id === currentUser.id);
                const bPending = !b.counts.some((c: any) => c.user_id === currentUser.id);
                if (aPending && !bPending) return -1;
                if (!aPending && bPending) return 1;
                return 0;
            });
        }

        return items;
    }, [controlItems, executionSearch, executionSort, currentUser.id]);

    const filteredReviewItems = useMemo(() => {
        let items = [...controlItems];
        const keywords = reviewSearch.toLowerCase().split(/\s+/).filter(k => k.length > 0);
        
        if (keywords.length > 0) {
            items = items.filter(item => {
                const textToSearch = `${item.desart} ${item.codart}`.toLowerCase();
                return keywords.every(k => textToSearch.includes(k));
            });
        }

        if (reviewSort === 'diff') {
            items.sort((a, b) => {
                const getDiffStatus = (item: any) => {
                    const c1 = item.counts[0];
                    const c2 = item.counts[1];
                    const finalVal = (item.corrected_qty !== null && item.corrected_qty !== undefined) ? item.corrected_qty : item.system_qty;
                    const diff = finalVal - item.system_qty;
                    const hasConflict = (c1 && c1.qty !== item.system_qty) || (c2 && c2.qty !== item.system_qty) || (c1 && c2 && c1.qty !== c2.qty);
                    const isAdminSet = item.corrected_qty !== null && item.corrected_qty !== undefined;
                    return (hasConflict && !isAdminSet) || diff !== 0;
                };
                const aIsDiff = getDiffStatus(a);
                const bIsDiff = getDiffStatus(b);
                if (aIsDiff && !bIsDiff) return -1;
                if (!aIsDiff && bIsDiff) return 1;
                return 0;
            });
        } else if (reviewSort === 'pending') {
            items.sort((a, b) => {
                const aPending = a.counts.length === 0;
                const bPending = b.counts.length === 0;
                if (aPending && !bPending) return -1;
                if (!aPending && bPending) return 1;
                return 0;
            });
        }

        return items;
    }, [controlItems, reviewSearch, reviewSort]);

    // Función para seleccionar/deseleccionar todo lo visible en la página actual
    const toggleSelectAllVisible = () => {
        const next = new Set(selectedProducts);
        const allVisibleSelected = products.every(p => selectedProducts.has(p.codart));
        
        if (allVisibleSelected) {
            products.forEach(p => next.delete(p.codart));
        } else {
            products.forEach(p => next.add(p.codart));
        }
        setSelectedProducts(next);
    };

    if (mode === 'create') {
        return (
            <div className="flex flex-col gap-6 pb-20 animate-in slide-in-from-right duration-300">
                <div className="flex items-center gap-4">
                    <button onClick={() => setMode('list')} className="p-2 rounded-full hover:bg-surfaceHighlight text-muted transition-colors"><ChevronRight className="rotate-180" size={24}/></button>
                    <h2 className="text-2xl font-black text-text uppercase italic">Crear Auditoría</h2>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm space-y-4 sticky top-24">
                            <h4 className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Configuración</h4>
                            
                            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre del Control..." className="w-full bg-background border border-surfaceHighlight rounded-xl p-3.5 text-sm font-bold outline-none focus:border-primary uppercase shadow-inner" />
                            
                            <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl p-3.5 text-sm font-bold outline-none cursor-pointer appearance-none uppercase">
                                <option value="">Depósito...</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>

                            <div className="flex flex-col gap-2">
                                <button 
                                    onClick={() => setShowWithStock(!showWithStock)}
                                    className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 border transition-all ${showWithStock ? 'bg-blue-500/10 border-blue-500 text-blue-600' : 'bg-background border-surfaceHighlight text-muted hover:bg-surfaceHighlight'}`}
                                >
                                    {showWithStock ? <CheckSquare size={16}/> : <Square size={16}/>}
                                    <span className="text-[10px] font-black uppercase">Artículos con Stock</span>
                                </button>

                                <button 
                                    onClick={() => setShowWithoutStock(!showWithoutStock)}
                                    className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 border transition-all ${showWithoutStock ? 'bg-blue-500/10 border-blue-500 text-blue-600' : 'bg-background border-surfaceHighlight text-muted hover:bg-surfaceHighlight'}`}
                                >
                                    {showWithoutStock ? <CheckSquare size={16}/> : <Square size={16}/>}
                                    <span className="text-[10px] font-black uppercase">Incluir Artículos sin Stock</span>
                                </button>

                                <button 
                                    onClick={() => setShowNegativeStock(!showNegativeStock)}
                                    className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 border transition-all ${showNegativeStock ? 'bg-red-500/10 border-red-500 text-red-600' : 'bg-background border-surfaceHighlight text-muted hover:bg-surfaceHighlight'}`}
                                >
                                    {showNegativeStock ? <CheckSquare size={16}/> : <Square size={16}/>}
                                    <span className="text-[10px] font-black uppercase">Artículos en Negativo</span>
                                </button>
                            </div>

                            <div className="pt-4 border-t border-surfaceHighlight">
                                <div className="flex justify-between items-center mb-4 px-1">
                                    <span className="text-[10px] font-black text-muted uppercase">Seleccionados</span>
                                    <span className="text-sm font-black text-primary bg-primary/10 px-3 py-1 rounded-full">{selectedProducts.size}</span>
                                </div>
                                <button onClick={handleCreateSession} disabled={selectedProducts.size === 0 || !newName || !warehouseId} className="w-full py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-primaryHover transition-all active:scale-95 disabled:opacity-30">Generar Auditoría</button>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-3 space-y-6">
                        <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm flex flex-col gap-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14}/>
                                    <input value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} placeholder="BUSCAR ARTÍCULO..." className="w-full bg-background border border-surfaceHighlight rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold outline-none focus:border-primary uppercase shadow-inner"/>
                                </div>
                                <div className="relative">
                                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14}/>
                                    <select value={filters.family} onChange={e => setFilters({...filters, family: e.target.value})} className="w-full bg-background border border-surfaceHighlight rounded-xl p-2.5 pl-10 text-xs font-bold uppercase outline-none appearance-none cursor-pointer">
                                        <option value="TODAS">FAMILIAS</option>
                                        {metaFamilies.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>
                                <div className="relative">
                                    <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14}/>
                                    <select value={filters.subfamily} onChange={e => setFilters({...filters, subfamily: e.target.value})} className="w-full bg-background border border-surfaceHighlight rounded-xl p-2.5 pl-10 text-xs font-bold uppercase outline-none appearance-none cursor-pointer">
                                        <option value="TODAS">SUBFAMILIAS</option>
                                        {metaSubfamilies.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>
                                <div className="relative">
                                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14}/>
                                    <select value={filters.provider} onChange={e => setFilters({...filters, provider: e.target.value})} className="w-full bg-background border border-surfaceHighlight rounded-xl p-2.5 pl-10 text-xs font-bold uppercase outline-none appearance-none cursor-pointer">
                                        <option value="TODOS">PROVEEDORES</option>
                                        {metaProviders.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm flex flex-col min-h-[400px]">
                            {/* TABLA DE PRODUCTOS PAGINADA */}
                            <div className="overflow-x-auto flex-1">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-background/50 border-b border-surfaceHighlight text-[10px] text-muted font-black uppercase tracking-widest sticky top-0 backdrop-blur-md z-10">
                                        <tr>
                                            <th className="p-4 w-12 text-center">
                                                <button onClick={toggleSelectAllVisible}>
                                                    {products.length > 0 && products.every(p => selectedProducts.has(p.codart)) ? <CheckSquare className="text-primary"/> : <Square/>}
                                                </button>
                                            </th>
                                            <th className="p-4">Artículo</th>
                                            <th className="p-4">Familia / Sub</th>
                                            <th className="p-4 text-center">Stock</th>
                                            <th className="p-4 text-right pr-6"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-surfaceHighlight">
                                        {products.length === 0 && !isProductsLoading ? (
                                            <tr>
                                                <td colSpan={5} className="p-10 text-center text-muted uppercase font-bold text-xs italic">
                                                    No se encontraron productos con los filtros actuales.
                                                </td>
                                            </tr>
                                        ) : (
                                            products.map(p => {
                                                const stockVal = warehouses.find(w => w.id === warehouseId)?.name === 'LLERENA' ? p.stock_llerena : p.stock_betbeder;
                                                return (
                                                    <tr 
                                                        key={p.codart} 
                                                        className={`hover:bg-primary/5 transition-colors cursor-pointer group ${selectedProducts.has(p.codart) ? 'bg-primary/5' : ''}`} 
                                                        onClick={() => { const next = new Set(selectedProducts); if (next.has(p.codart)) next.delete(p.codart); else next.add(p.codart); setSelectedProducts(next); }}
                                                    >
                                                        <td className="p-4 text-center">
                                                            {selectedProducts.has(p.codart) ? <CheckSquare className="text-primary" size={20}/> : <Square size={20} className="text-muted"/>}
                                                        </td>
                                                        <td className="p-4">
                                                            <p className="text-xs font-black text-text uppercase truncate max-w-[350px]">{p.desart}</p>
                                                            <p className="text-[10px] font-mono text-muted">#{p.codart}</p>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-[9px] font-bold text-muted uppercase bg-background px-2 py-0.5 rounded border border-surfaceHighlight w-fit">{p.familia || 'S/D'}</span>
                                                                {p.nsubf && <span className="text-[9px] font-bold text-primary uppercase bg-primary/5 px-2 py-0.5 rounded border border-primary/10 w-fit">{p.nsubf}</span>}
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <span className={`text-xs font-black ${!stockVal || stockVal <= 0 ? 'text-red-500' : 'text-text'}`}>
                                                                {stockVal || 0}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-right pr-6">
                                                            <ChevronRight className="ml-auto text-muted opacity-30" size={16}/>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* FOOTER CON BOTONES DE CARGA */}
                            <div className="p-4 border-t border-surfaceHighlight bg-background/30 flex flex-col gap-3">
                                <div className="flex gap-3">
                                    {hasMore && (
                                        <button 
                                            onClick={() => fetchProducts(true)} 
                                            disabled={isProductsLoading}
                                            className="flex-1 py-3 bg-surface border border-surfaceHighlight hover:bg-surfaceHighlight text-text rounded-xl font-black uppercase text-xs transition-all shadow-sm flex items-center justify-center gap-2"
                                        >
                                            {isProductsLoading ? <Loader2 className="animate-spin" size={16}/> : <ArrowDown size={16}/>}
                                            {isProductsLoading ? 'Cargando...' : 'Cargar más resultados'}
                                        </button>
                                    )}
                                    
                                    <button 
                                        onClick={handleLoadAll} 
                                        disabled={isProductsLoading}
                                        className="flex-1 py-3 bg-primary/10 border border-primary/20 hover:bg-primary hover:text-white text-primary rounded-xl font-black uppercase text-xs transition-all shadow-sm flex items-center justify-center gap-2"
                                        title="Cargar todos los resultados coincidentes sin paginación"
                                    >
                                        {isProductsLoading ? <Loader2 className="animate-spin" size={16}/> : <Database size={16}/>}
                                        {isProductsLoading ? 'Procesando...' : 'Cargar TODO'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'execution' && activeSession) {
        return (
            <div className="flex flex-col gap-6 pb-20 animate-in fade-in duration-300 max-w-4xl mx-auto">
                <div className="bg-orange-600 rounded-3xl p-8 text-white shadow-xl shadow-orange-600/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    <div className="flex items-center gap-4 mb-4 relative z-10">
                        <Package size={40}/> 
                        <h2 className="text-3xl font-black uppercase italic tracking-tight">{activeSession.name}</h2>
                    </div>
                    <p className="text-xs font-bold opacity-90 leading-relaxed uppercase tracking-widest max-w-lg mb-6">
                        Auditoría Ciega: Registra la cantidad física exacta.
                    </p>
                    
                    {/* BUSCADOR INTELIGENTE PARA ARMADOR */}
                    <div className="flex flex-col gap-4 relative z-10">
                        <div className="relative w-full max-w-md">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60" size={18} />
                            <input 
                                type="text" 
                                placeholder="Buscar en la lista (ande 1300 ch)..." 
                                value={executionSearch}
                                onChange={(e) => setExecutionSearch(e.target.value)}
                                className="w-full bg-white/10 border border-white/20 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold text-white placeholder-white/50 outline-none focus:bg-white/20 focus:border-white/40 transition-all shadow-lg backdrop-blur-md uppercase"
                            />
                            {executionSearch && (
                                <button onClick={() => setExecutionSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white">
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                            <button 
                                onClick={() => setExecutionSort(prev => prev === 'diff' ? 'none' : 'diff')}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border ${executionSort === 'diff' ? 'bg-white text-orange-600 border-white shadow-lg' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
                            >
                                <AlertTriangle size={14} /> Diferencias Primero
                            </button>
                            <button 
                                onClick={() => setExecutionSort(prev => prev === 'pending' ? 'none' : 'pending')}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border ${executionSort === 'pending' ? 'bg-white text-orange-600 border-white shadow-lg' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
                            >
                                <LayoutList size={14} /> No Realizados Primero
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-background/50 border-b border-surfaceHighlight text-[10px] text-muted font-black uppercase tracking-widest">
                                <tr>
                                    <th className="p-5 pl-8">Código</th>
                                    <th className="p-5">Producto</th>
                                    <th className="p-5 text-center w-36">Cantidad</th>
                                    <th className="p-5 text-center w-24">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surfaceHighlight">
                                {filteredExecutionItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-10 text-center text-muted italic font-bold uppercase opacity-40">
                                            No se encontraron resultados en esta auditoría.
                                        </td>
                                    </tr>
                                ) : filteredExecutionItems.map(item => { 
                                    const myCount = item.counts.find((c: any) => c.user_id === currentUser.id); 
                                    const isCorrect = myCount && Math.round(myCount.qty) === Math.round(item.system_qty); 
                                    return (
                                        <tr key={item.id} className="hover:bg-background/50 transition-colors">
                                            <td className="p-5 pl-8">
                                                <span className="font-mono text-[11px] font-black text-primary bg-primary/5 px-2 py-1 rounded border border-primary/20">#{item.codart}</span>
                                            </td>
                                            <td className="p-5">
                                                <p className="text-sm font-black text-text uppercase leading-tight">{item.desart}</p>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex items-center bg-background border border-surfaceHighlight rounded-xl overflow-hidden shadow-inner px-2 focus-within:border-primary transition-all">
                                                    <input 
                                                        type="number" 
                                                        defaultValue={myCount?.qty} 
                                                        placeholder="CARGAR" 
                                                        onBlur={(e) => handleSavePhysicalCount(item.id, parseFloat(e.target.value))} 
                                                        className="w-full bg-transparent border-none py-3 text-center text-sm font-black outline-none" 
                                                    />
                                                </div>
                                            </td>
                                            <td className="p-5 text-center">
                                                {myCount ? (
                                                    <div className="flex items-center justify-center animate-in zoom-in">
                                                        {isCorrect ? (
                                                            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-green-600 flex items-center justify-center">
                                                                <CheckCircle2 size={24} />
                                                            </div>
                                                        ) : (
                                                            <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-green-500/20 text-red-600 flex items-center justify-center animate-pulse">
                                                                <AlertTriangle size={24} />
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="h-8 w-8 rounded-full border-2 border-dashed border-muted/20 mx-auto" />
                                                )}
                                            </td>
                                        </tr>
                                    ); 
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
                <button onClick={() => setMode('list')} className="w-full py-4 bg-surface border border-surfaceHighlight text-text hover:bg-surfaceHighlight rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-sm">Finalizar Auditoría</button>
            </div>
        );
    }

    if (mode === 'review' && activeSession) {
        return (
            <div className="flex flex-col gap-6 pb-20 animate-in fade-in">
                <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl flex flex-col gap-6 border border-slate-700">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setMode('list')} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-all">
                                <ChevronRight className="rotate-180" size={24}/>
                            </button>
                            <div>
                                <h2 className="text-2xl font-black uppercase italic tracking-tight">{activeSession.name}</h2>
                                <p className="text-[10px] opacity-60 font-black uppercase tracking-[0.2em] mt-1">
                                    Conciliación: <span className="text-primary">{activeSession.warehouse_name}</span>
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 w-full md:w-auto">
                            <button onClick={handleExportExcel} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 px-6 py-4 rounded-2xl text-xs font-black uppercase shadow-lg shadow-green-900/40 transition-all active:scale-95">
                                <FileSpreadsheet size={18}/> Exportar
                            </button>
                            <button onClick={() => setMode('list')} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 px-6 py-4 rounded-2xl text-xs font-black uppercase transition-all">
                                Regresar
                            </button>
                        </div>
                    </div>

                    {/* BUSCADOR INTELIGENTE PARA ADMIN */}
                    <div className="flex flex-col gap-4">
                        <div className="relative w-full max-w-md">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                            <input 
                                type="text" 
                                placeholder="Filtrar conciliación (ande 1300 ch)..." 
                                value={reviewSearch}
                                onChange={(e) => setReviewSearch(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold text-white placeholder-white/30 outline-none focus:bg-white/10 focus:border-white/20 transition-all uppercase"
                            />
                            {reviewSearch && (
                                <button onClick={() => setReviewSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button 
                                onClick={() => setReviewSort(prev => prev === 'diff' ? 'none' : 'diff')}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border ${reviewSort === 'diff' ? 'bg-primary text-white border-primary shadow-lg' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white'}`}
                            >
                                <AlertTriangle size={14} /> Diferencias Primero
                            </button>
                            <button 
                                onClick={() => setReviewSort(prev => prev === 'pending' ? 'none' : 'pending')}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border ${reviewSort === 'pending' ? 'bg-primary text-white border-primary shadow-lg' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white'}`}
                            >
                                <LayoutList size={14} /> No Realizados Primero
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-background/50 border-b border-surfaceHighlight text-[10px] text-muted font-black uppercase tracking-widest">
                                <tr>
                                    <th className="p-4 w-12 text-center">Estado</th>
                                    <th className="p-4">Artículo</th>
                                    <th className="p-4 text-center">Sistema</th>
                                    <th className="p-4">Armador 1</th>
                                    <th className="p-4">Armador 2</th>
                                    <th className="p-4 text-center">Corregido</th>
                                    <th className="p-4 text-right pr-10">Ajuste</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surfaceHighlight">
                                {filteredReviewItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-20 text-center text-muted font-bold uppercase opacity-30 italic">
                                            Sin resultados para el filtro aplicado.
                                        </td>
                                    </tr>
                                ) : filteredReviewItems.map(item => { 
                                    const c1 = item.counts[0]; 
                                    const c2 = item.counts[1]; 
                                    const finalVal = (item.corrected_qty !== null && item.corrected_qty !== undefined) ? item.corrected_qty : item.system_qty; 
                                    const diff = finalVal - item.system_qty; 
                                    const hasConflict = (c1 && c1.qty !== item.system_qty) || (c2 && c2.qty !== item.system_qty) || (c1 && c2 && c1.qty !== c2.qty); 
                                    const isAdminSet = item.corrected_qty !== null && item.corrected_qty !== undefined; 
                                    return (
                                        <tr key={item.id} className={`hover:bg-primary/5 transition-colors group ${hasConflict && !isAdminSet ? 'bg-orange-500/[0.02]' : ''}`}>
                                            <td className="p-4 text-center">{diff === 0 ? (<div className="h-8 w-8 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center mx-auto"><CheckCircle2 size={16}/></div>) : (<div className="h-8 w-8 rounded-full bg-orange-500/10 text-orange-600 flex items-center justify-center mx-auto animate-pulse"><AlertTriangle size={16}/></div>)}</td>
                                            <td className="p-4">
                                                <p className="text-xs font-black text-text uppercase leading-tight truncate max-w-[280px]">{item.desart}</p>
                                                <p className="text-[9px] font-mono text-muted">#{item.codart}</p>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="text-xs font-black text-muted bg-background px-4 py-2 rounded-xl border border-surfaceHighlight shadow-inner">{item.system_qty}</span>
                                            </td>
                                            <td className="p-4">
                                                {c1 ? (<div className="flex flex-col"><span className="text-[8px] font-black text-muted uppercase truncate max-w-[80px]">{c1.user_name}</span><span className={`text-sm font-black ${c1.qty === item.system_qty ? 'text-green-600' : 'text-orange-600'}`}>{c1.qty}</span></div>) : <span className="text-[9px] text-muted italic">Pendiente</span>}
                                            </td>
                                            <td className="p-4">
                                                {c2 ? (<div className="flex flex-col"><span className="text-[8px] font-black text-muted uppercase truncate max-w-[80px]">{c2.user_name}</span><span className={`text-sm font-black ${c2.qty === item.system_qty ? 'text-green-600' : 'text-orange-600'}`}>{c2.qty}</span></div>) : <span className="text-[9px] text-muted italic">Pendiente</span>}
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="relative group/edit">
                                                    <input 
                                                        type="number" 
                                                        defaultValue={item.corrected_qty ?? ''} 
                                                        placeholder={item.system_qty.toString()} 
                                                        onBlur={e => handleAdminCorrection(item.id, e.target.value === '' ? null : parseFloat(e.target.value))} 
                                                        className={`w-24 bg-background border rounded-xl py-2 px-3 text-center text-sm font-black outline-none transition-all shadow-inner ${isAdminSet ? 'border-primary text-primary' : 'border-surfaceHighlight text-muted'}`} 
                                                    />
                                                    {hasConflict && !isAdminSet && <AlertTriangle size={10} className="absolute -right-1 -top-1 text-orange-500 animate-bounce" />}
                                                </div>
                                            </td>
                                            <td className="p-4 text-right pr-10">
                                                <div className={`text-lg font-black italic flex items-center justify-end gap-2 ${diff === 0 ? 'text-muted/20' : diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {diff > 0 && '+'} {diff}{diff > 0 ? <ArrowUpRight size={16}/> : diff < 0 ? <ArrowDownLeft size={16}/> : null}
                                                </div>
                                            </td>
                                        </tr>
                                    ); 
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 pb-10 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight uppercase italic flex items-center gap-3">
                        <ClipboardCheck className="text-primary" size={36} />
                        Auditorías de Control de Stock
                    </h2>
                    <p className="text-muted text-sm mt-1 font-medium">Controles físicos por depósito.</p>
                </div>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                    <label className="flex items-center gap-3 cursor-pointer group" title="Ver diferencias globales">
                        <div className="relative">
                            <input 
                                type="checkbox" 
                                className="sr-only" 
                                checked={showGlobalDifferences}
                                onChange={(e) => setShowGlobalDifferences(e.target.checked)}
                            />
                            <div className={`block w-14 h-8 rounded-full transition-colors ${showGlobalDifferences ? 'bg-primary' : 'bg-surfaceHighlight'}`}></div>
                            <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform flex items-center justify-center ${showGlobalDifferences ? 'transform translate-x-6' : ''}`}>
                                <Globe size={14} className={showGlobalDifferences ? 'text-primary' : 'text-muted'} />
                            </div>
                        </div>
                    </label>
                    {showGlobalDifferences && globalDifferences.length > 0 && (
                        <button 
                            onClick={handleExportGlobalDifferences}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-2xl font-black text-xs uppercase transition-all shadow-xl shadow-green-900/20 active:scale-95 flex items-center gap-2"
                        >
                            <FileSpreadsheet size={18} /> Exportar Diferencias
                        </button>
                    )}
                    {isVale && (
                        <button onClick={() => setMode('create')} className="bg-primary hover:bg-primaryHover text-white px-4 py-3 rounded-2xl font-black text-xs uppercase transition-all shadow-xl shadow-primary/20 active:scale-95 flex items-center gap-2">
                            <Plus size={18} /> Crear Nuevo Control
                        </button>
                    )}
                </div>
            </div>

            {showGlobalDifferences ? (
                <div className="space-y-8">
                    {isGlobalLoading ? (
                        <div className="py-20 flex justify-center bg-surface border border-surfaceHighlight rounded-3xl"><Loader2 className="animate-spin text-primary" size={48} /></div>
                    ) : globalDifferences.length === 0 ? (
                        <div className="py-24 text-center border-2 border-dashed border-surfaceHighlight rounded-3xl bg-surface/30 opacity-50">
                            <CheckCircle2 size={48} className="mx-auto mb-4 text-green-500" />
                            <p className="font-black uppercase tracking-widest text-muted italic">No hay diferencias globales registradas.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-8">
                            {(Object.entries(globalDiffsByWarehouse) as [string, any[]][]).map(([warehouse, diffs]) => (
                                <div key={warehouse} className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm flex flex-col">
                                    <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <Warehouse className="text-primary" size={24} />
                                            <div>
                                                <h3 className="text-xl font-black uppercase italic tracking-tight">{warehouse}</h3>
                                                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Diferencias de Stock Detectadas</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button 
                                                onClick={() => handleCreateRecontrol(diffs[0].warehouse_id, warehouse, diffs)}
                                                className="bg-primary hover:bg-primaryHover text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg flex items-center gap-2 active:scale-95"
                                            >
                                                <Plus size={14} /> Crear Re-Control
                                            </button>
                                            <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/10">
                                                <span className="text-xs font-black uppercase">{diffs.length} Artículos</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-background/50 border-b border-surfaceHighlight text-[10px] text-muted font-black uppercase tracking-widest">
                                                <tr>
                                                    <th className="p-4">Auditoría</th>
                                                    <th className="p-4">Artículo</th>
                                                    <th className="p-4 text-center">Sistema</th>
                                                    <th className="p-4 text-center">Corregido</th>
                                                    <th className="p-4 text-right pr-10">Ajuste</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-surfaceHighlight">
                                                {diffs.map(item => (
                                                    <tr key={item.id} className="hover:bg-primary/5 transition-colors group">
                                                        <td className="p-4">
                                                            <span className="text-xs font-black text-text uppercase">{item.session_name}</span>
                                                        </td>
                                                        <td className="p-4">
                                                            <p className="text-xs font-black text-text uppercase leading-tight truncate max-w-[280px]">{item.desart}</p>
                                                            <p className="text-[9px] font-mono text-muted">#{item.codart}</p>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <span className="text-xs font-black text-muted bg-background px-4 py-2 rounded-xl border border-surfaceHighlight shadow-inner">{item.system_qty}</span>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <span className="text-xs font-black text-primary bg-primary/10 px-4 py-2 rounded-xl border border-primary/20">{item.corrected_qty}</span>
                                                        </td>
                                                        <td className="p-4 text-right pr-10">
                                                            <div className={`text-lg font-black italic flex items-center justify-end gap-2 ${item.ajuste > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {item.ajuste > 0 && '+'} {item.ajuste}{item.ajuste > 0 ? <ArrowUpRight size={16}/> : <ArrowDownLeft size={16}/>}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {isLoading ? (
                        <div className="col-span-full py-20 flex justify-center"><Loader2 className="animate-spin text-primary" size={48} /></div>
                    ) : sessions.length === 0 ? (
                        <div className="col-span-full py-24 text-center border-2 border-dashed border-surfaceHighlight rounded-3xl bg-surface/30 opacity-50">
                            <Package size={48} className="mx-auto mb-4 text-muted" />
                            <p className="font-black uppercase tracking-widest text-muted italic">No hay controles activos.</p>
                        </div>
                    ) : sessions.map(session => { 
                        const uniqueUsers = session.assigned_users || []; 
                        const alreadyIn = uniqueUsers.includes(currentUser.id); 
                        const isFull = uniqueUsers.length >= 2; 
                        const isConfirming = confirmingDeleteId === session.id; 
                        return (
                            <div key={session.id} className="bg-surface border border-surfaceHighlight rounded-3xl p-7 shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col gap-6 relative overflow-hidden">
                                <div className={`absolute top-0 left-0 w-2 h-full ${session.status === 'active' ? 'bg-primary' : 'bg-green-500'}`}></div>
                                <div className="flex justify-between items-start">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-xl font-black text-text uppercase italic leading-tight group-hover:text-primary transition-colors truncate pr-2">{session.name}</h3>
                                        <div className="flex flex-col gap-1.5 mt-3">
                                            <p className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5"><Warehouse size={12} className="text-primary"/> Depósito: {session.warehouse_name}</p>
                                            <p className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5"><LayoutList size={12} className="text-primary"/> {session.item_count} Artículos</p>
                                            <p className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5"><Calendar size={12} className="text-primary"/> {new Date(session.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                        {isConfirming ? (
                                            <div className="flex items-center gap-1 animate-in slide-in-from-right-4 duration-300">
                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }} className="px-3 py-2 bg-red-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-red-500/20 active:scale-90 transition-all">Confirmar</button>
                                                <button onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(null); }} className="p-2 bg-surfaceHighlight text-text rounded-xl"><X size={14}/></button>
                                            </div>
                                        ) : (
                                            <button onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(session.id); setTimeout(() => setConfirmingDeleteId(null), 4000); }} className="p-2 text-muted hover:text-red-500 transition-colors bg-background rounded-xl border border-surfaceHighlight shadow-sm"><Trash2 size={18}/></button>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="text-[9px] font-black text-muted uppercase tracking-[0.2em] border-b border-surfaceHighlight pb-2 mb-3">Progreso</h4>
                                    <div className="space-y-4">
                                        {(session.user_progress || []).map((prog: any, idx: number) => { 
                                            const percentage = (prog.count / session.item_count) * 100; 
                                            return (
                                                <div key={idx} className="space-y-2">
                                                    <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                                        <span className="text-text flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Armador {idx + 1}</span>
                                                        <span className="text-primary bg-primary/10 px-2 py-0.5 rounded">{prog.count} / {session.item_count}</span>
                                                    </div>
                                                    <div className="h-2.5 w-full bg-background border border-surfaceHighlight rounded-full overflow-hidden shadow-inner">
                                                        <div className="h-full bg-primary transition-all duration-700 ease-out" style={{ width: `${percentage}%` }} />
                                                    </div>
                                                </div>
                                            ); 
                                        })}
                                        {uniqueUsers.length < 2 && (
                                            <div className="flex items-center gap-3 p-4 bg-background border border-dashed border-surfaceHighlight rounded-2xl opacity-40">
                                                <UserIcon size={16} className="text-muted" />
                                                <span className="text-[10px] font-black text-muted uppercase tracking-widest">Esperando segundo...</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-2 pt-4 border-t border-surfaceHighlight/50">
                                    {isVale ? (
                                        <button onClick={() => startSessionExecution(session)} className="w-full py-4 bg-slate-900 text-white hover:bg-slate-800 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-3 active:scale-95"><ArrowRightLeft size={18}/> Conciliar</button>
                                    ) : (
                                        <button disabled={isFull && !alreadyIn} onClick={() => startSessionExecution(session)} className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95 ${alreadyIn ? 'bg-green-600 text-white shadow-green-600/20' : isFull ? 'bg-surfaceHighlight text-muted opacity-50' : 'bg-primary text-white shadow-primary/20'}`}>
                                            {alreadyIn ? <RotateCcw size={18}/> : <ClipboardCheck size={18}/>}
                                            {alreadyIn ? 'Continuar' : isFull ? 'Completa' : 'Comenzar'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ); 
                    })}
                </div>
            )}
        </div>
    );
};
