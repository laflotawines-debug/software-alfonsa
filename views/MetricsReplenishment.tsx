import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { Loader2, Package, AlertTriangle, XCircle, ShoppingCart, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

interface ReplenishmentItem {
    codart: string;
    desart: string;
    stock_llerena: number;
    stock_minimo: number;
    stock_ideal: number;
    nomprov: string;
}

export const MetricsReplenishment: React.FC = () => {
    const [items, setItems] = useState<ReplenishmentItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [providerFilter, setProviderFilter] = useState<string>('all');
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 100;

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('master_products')
                .select('codart, desart, stock_llerena, stock_minimo, stock_ideal, nomprov');

            if (error) throw error;
            setItems(data || []);
        } catch (error: any) {
            console.error("Error fetching replenishment data:", error);
            alert("Error al cargar datos de reposición.");
        } finally {
            setIsLoading(false);
        }
    };

    const processedItems = useMemo(() => {
        const processed = items.map(item => {
            const current = item.stock_llerena || 0;
            const min = item.stock_minimo || 0;
            const ideal = item.stock_ideal || 0;

            let status: 'normal' | 'reponer' | 'sin_stock' = 'normal';
            if (current === 0) {
                status = 'sin_stock';
            } else if (current <= min) {
                status = 'reponer';
            }

            let suggested = ideal - current;
            if (suggested < 0) suggested = 0;

            return {
                ...item,
                current,
                min,
                ideal,
                status,
                suggested
            };
        });

        // Ordenar: Sin stock primero, luego reponer, luego normal.
        // Dentro de cada grupo, ordenar por cantidad sugerida (mayor a menor).
        return processed.sort((a, b) => {
            const statusWeight = { sin_stock: 1, reponer: 2, normal: 3 };
            if (statusWeight[a.status] !== statusWeight[b.status]) {
                return statusWeight[a.status] - statusWeight[b.status];
            }
            if (b.suggested !== a.suggested) {
                return b.suggested - a.suggested;
            }
            return a.desart.localeCompare(b.desart);
        });
    }, [items]);

    const uniqueProviders = useMemo(() => {
        const providers = new Set(processedItems.map(item => item.nomprov).filter(Boolean));
        return Array.from(providers).sort();
    }, [processedItems]);

    const filteredItems = useMemo(() => {
        return processedItems.filter(item => {
            const matchesSearch = !searchTerm || 
                item.desart.toLowerCase().includes(searchTerm.toLowerCase()) || 
                item.codart.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
            
            const matchesProvider = providerFilter === 'all' || item.nomprov === providerFilter;

            return matchesSearch && matchesStatus && matchesProvider;
        });
    }, [processedItems, searchTerm, statusFilter, providerFilter]);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, providerFilter]);

    const stats = useMemo(() => {
        let normal = 0;
        let reponer = 0;
        let sinStock = 0;
        let totalSuggested = 0;

        filteredItems.forEach(item => {
            if (item.status === 'normal') normal++;
            else if (item.status === 'reponer') reponer++;
            else if (item.status === 'sin_stock') sinStock++;

            totalSuggested += item.suggested;
        });

        return { normal, reponer, sinStock, totalSuggested };
    }, [filteredItems]);

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
    const paginatedItems = filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <div className="flex flex-col gap-6 pb-20 animate-in fade-in duration-500 max-w-7xl mx-auto w-full">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-primary rounded-2xl text-white shadow-lg shadow-primary/20">
                    <ShoppingCart size={32} />
                </div>
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight uppercase italic">Reposición</h2>
                    <p className="text-muted font-medium">Control de stock y sugerencias de compra</p>
                </div>
            </div>

            {/* STATS CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm flex flex-col gap-2">
                    <div className="flex items-center gap-3 text-green-500">
                        <Package size={24} />
                        <span className="font-bold uppercase tracking-wider text-xs">Normal</span>
                    </div>
                    <span className="text-4xl font-black text-text">{stats.normal}</span>
                </div>
                <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm flex flex-col gap-2">
                    <div className="flex items-center gap-3 text-yellow-500">
                        <AlertTriangle size={24} />
                        <span className="font-bold uppercase tracking-wider text-xs">Reponer</span>
                    </div>
                    <span className="text-4xl font-black text-text">{stats.reponer}</span>
                </div>
                <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm flex flex-col gap-2">
                    <div className="flex items-center gap-3 text-red-500">
                        <XCircle size={24} />
                        <span className="font-bold uppercase tracking-wider text-xs">Sin Stock</span>
                    </div>
                    <span className="text-4xl font-black text-text">{stats.sinStock}</span>
                </div>
                <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm flex flex-col gap-2">
                    <div className="flex items-center gap-3 text-primary">
                        <ShoppingCart size={24} />
                        <span className="font-bold uppercase tracking-wider text-xs">Total Sugerido</span>
                    </div>
                    <span className="text-4xl font-black text-text">{stats.totalSuggested}</span>
                </div>
            </div>

            <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm flex flex-col gap-6">
                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar artículo..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary transition-all shadow-inner uppercase"
                        />
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative min-w-[180px]">
                            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-12 pr-10 text-sm font-bold text-text outline-none focus:border-primary transition-all shadow-inner appearance-none cursor-pointer"
                            >
                                <option value="all">Todos los estados</option>
                                <option value="sin_stock">Sin Stock</option>
                                <option value="reponer">A Reponer</option>
                                <option value="normal">Normal</option>
                            </select>
                        </div>

                        <div className="relative min-w-[220px]">
                            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                            <select
                                value={providerFilter}
                                onChange={(e) => setProviderFilter(e.target.value)}
                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-12 pr-10 text-sm font-bold text-text outline-none focus:border-primary transition-all shadow-inner appearance-none cursor-pointer"
                            >
                                <option value="all">Todos los proveedores</option>
                                {uniqueProviders.map(prov => (
                                    <option key={prov} value={prov}>{prov}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-background/50 text-[10px] text-muted uppercase font-black tracking-widest border-b border-surfaceHighlight">
                            <tr>
                                <th className="p-4 pl-6">Artículo</th>
                                <th className="p-4">Proveedor</th>
                                <th className="p-4 text-center">Stock Actual</th>
                                <th className="p-4 text-center">Stock Mínimo</th>
                                <th className="p-4 text-center">Stock Ideal</th>
                                <th className="p-4 text-center">Sugerido</th>
                                <th className="p-4 pr-6 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surfaceHighlight">
                            {isLoading ? (
                                <tr><td colSpan={7} className="p-12 text-center"><Loader2 size={32} className="animate-spin text-primary mx-auto" /></td></tr>
                            ) : paginatedItems.length === 0 ? (
                                <tr><td colSpan={7} className="p-12 text-center text-muted font-medium">No se encontraron artículos.</td></tr>
                            ) : (
                                paginatedItems.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-background/50 transition-colors">
                                        <td className="p-4 pl-6">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm text-text uppercase">{item.desart}</span>
                                                <span className="text-xs text-muted">{item.codart}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-left text-xs text-muted font-medium uppercase">{item.nomprov || '-'}</td>
                                        <td className="p-4 text-center font-mono text-sm font-bold text-text">{item.current}</td>
                                        <td className="p-4 text-center font-mono text-sm text-muted">{item.min}</td>
                                        <td className="p-4 text-center font-mono text-sm text-muted">{item.ideal}</td>
                                        <td className="p-4 text-center font-mono text-sm font-black text-primary">{item.suggested}</td>
                                        <td className="p-4 pr-6 text-center">
                                            {item.status === 'normal' && (
                                                <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 font-bold text-[10px] uppercase border border-green-500/20">
                                                    Normal
                                                </span>
                                            )}
                                            {item.status === 'reponer' && (
                                                <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-600 font-bold text-[10px] uppercase border border-yellow-500/20">
                                                    Reponer
                                                </span>
                                            )}
                                            {item.status === 'sin_stock' && (
                                                <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 font-bold text-[10px] uppercase border border-red-500/20">
                                                    Sin Stock
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PAGINATION */}
                {!isLoading && totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-surfaceHighlight bg-background/30 rounded-b-3xl">
                        <span className="text-sm font-medium text-muted">
                            Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)} de {filteredItems.length} artículos
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg hover:bg-surfaceHighlight disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <span className="text-sm font-bold text-text px-4">
                                Página {currentPage} de {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-lg hover:bg-surfaceHighlight disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
