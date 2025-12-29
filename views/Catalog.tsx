
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, 
    Filter, 
    RefreshCw, 
    Loader2, 
    Boxes, 
    ChevronRight, 
    AlertCircle,
    Info,
    ArrowUpDown,
    Hash,
    DollarSign,
    Package
} from 'lucide-react';
import { supabase } from '../supabase';
import { MasterProduct, User, UserRole } from '../types';
import { ProductDetailModal } from '../components/ProductDetailModal';

interface CatalogProps {
    currentUser: User;
}

export const Catalog: React.FC<CatalogProps> = ({ currentUser }) => {
    const [products, setProducts] = useState<MasterProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<MasterProduct | null>(null);
    const [familyFilter, setFamilyFilter] = useState<string>('TODAS');
    const [providerFilter, setProviderFilter] = useState<string>('TODOS');

    const isVale = currentUser.role === 'vale';

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const PAGE_SIZE = 1000;
            let allProducts: MasterProduct[] = [];
            let from = 0;
            let hasMore = true;

            // Bucle recursivo para traer la base completa sin límites de API
            while (hasMore) {
                const { data, error } = await supabase
                    .from('master_products')
                    .select('*')
                    .order('desart', { ascending: true })
                    .range(from, from + PAGE_SIZE - 1);

                if (error) throw error;
                
                if (data && data.length > 0) {
                    allProducts = [...allProducts, ...data];
                    if (data.length < PAGE_SIZE) {
                        hasMore = false;
                    } else {
                        from += PAGE_SIZE;
                    }
                } else {
                    hasMore = false;
                }
            }
            
            setProducts(allProducts);
        } catch (err) {
            console.error("Error crítico cargando maestro:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const families = useMemo(() => {
        const unique = Array.from(new Set(products.map(p => p.familia).filter(Boolean)));
        return ['TODAS', ...unique.sort()];
    }, [products]);

    const providers = useMemo(() => {
        const unique = Array.from(new Set(products.map(p => p.nomprov).filter(Boolean)));
        return ['TODOS', ...unique.sort()];
    }, [products]);

    const filteredProducts = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase();
        return products.filter(p => {
            const matchesSearch = p.desart.toLowerCase().includes(lowerSearch) || 
                                 p.codart.toLowerCase().includes(lowerSearch);
            const matchesFamily = familyFilter === 'TODAS' || p.familia === familyFilter;
            const matchesProvider = providerFilter === 'TODOS' || p.nomprov === providerFilter;
            return matchesSearch && matchesFamily && matchesProvider;
        });
    }, [products, searchTerm, familyFilter, providerFilter]);

    return (
        <div className="flex flex-col gap-6 pb-10 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight flex items-center gap-3 uppercase italic">
                        <Boxes className="text-primary" size={32} />
                        Maestro de Artículos
                    </h2>
                    <p className="text-muted text-sm mt-1 font-medium italic">Gestión de stock global, costos y listas oficiales.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={fetchData} 
                        disabled={isLoading}
                        className="p-3 rounded-xl bg-surface border border-surfaceHighlight text-muted hover:text-primary transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <div className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-primary/20">
                        {isLoading ? 'Sincronizando...' : `${products.length} Registros Totales`}
                    </div>
                </div>
            </div>

            {/* Filtros Avanzados */}
            <div className="bg-surface border border-surfaceHighlight rounded-2xl p-5 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-6 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar por descripción o código de artículo..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary transition-all shadow-inner"
                        />
                    </div>
                    <div className="md:col-span-3">
                        <select 
                            value={familyFilter} 
                            onChange={(e) => setFamilyFilter(e.target.value)}
                            className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-sm font-black text-muted outline-none focus:border-primary cursor-pointer appearance-none"
                        >
                            {families.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-3">
                        <select 
                            value={providerFilter} 
                            onChange={(e) => setProviderFilter(e.target.value)}
                            className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-sm font-black text-muted outline-none focus:border-primary cursor-pointer appearance-none"
                        >
                            {providers.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Tabla de Resultados */}
            <div className="bg-surface border border-surfaceHighlight rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-background/50 text-[10px] text-muted uppercase font-black tracking-widest border-b border-surfaceHighlight">
                            <tr>
                                <th className="p-4">Artículo / Clasificación</th>
                                <th className="p-4 text-center">Existencias</th>
                                <th className="p-4 text-right">Listas 1 y 2</th>
                                <th className="p-4 text-right">Listas 3 y 4</th>
                                <th className="p-4 text-center w-12">Ficha</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surfaceHighlight">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="p-24 text-center">
                                        <Loader2 size={48} className="animate-spin text-primary mx-auto mb-4" />
                                        <p className="text-xs font-black uppercase text-muted tracking-widest animate-pulse">Obteniendo Base Maestra Completa...</p>
                                    </td>
                                </tr>
                            ) : filteredProducts.length > 0 ? (
                                filteredProducts.map((p) => (
                                    <tr 
                                        key={p.codart} 
                                        onClick={() => setSelectedProduct(p)}
                                        className="group hover:bg-primary/5 transition-colors cursor-pointer"
                                    >
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">#{p.codart}</span>
                                                    <span className="text-sm font-black text-text uppercase line-clamp-1 group-hover:text-primary transition-colors">{p.desart}</span>
                                                </div>
                                                
                                                {/* Costo visible solo para Rol VALE */}
                                                {isVale && (
                                                    <div className="flex items-center">
                                                        <span className="text-[10px] font-black text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-lg border border-orange-500/20 uppercase tracking-tighter italic">
                                                            Costo: $ {(p.costo || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    <span className="text-[8px] font-black text-muted uppercase px-1.5 py-0.5 rounded bg-surface border border-surfaceHighlight">{p.familia || 'S/FAMILIA'}</span>
                                                    <span className="text-[8px] font-black text-blue-500 uppercase px-1.5 py-0.5 rounded bg-blue-500/5 border border-blue-500/10">{p.nomprov || 'S/PROVEEDOR'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col items-center gap-1.5">
                                                <div className="flex gap-4">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[8px] font-black text-muted uppercase">Betbeder</span>
                                                        <span className={`text-sm font-black ${p.stock_betbeder && p.stock_betbeder > 0 ? 'text-green-500' : 'text-red-500 opacity-30'}`}>
                                                            {p.stock_betbeder || 0}
                                                        </span>
                                                    </div>
                                                    <div className="w-px h-8 bg-surfaceHighlight"></div>
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[8px] font-black text-muted uppercase">Llerena</span>
                                                        <span className={`text-sm font-black ${p.stock_llerena && p.stock_llerena > 0 ? 'text-blue-500' : 'text-red-500 opacity-30'}`}>
                                                            {p.stock_llerena || 0}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-black text-text bg-surfaceHighlight px-3 py-0.5 rounded-full uppercase tracking-tighter">
                                                    Stock Total: {p.stock_total || 0}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col items-end gap-1.5">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[8px] font-black text-muted uppercase">P-Venta 1</span>
                                                    <span className="text-sm font-black text-text">$ {(p.pventa_1 || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[8px] font-black text-muted uppercase opacity-50">P-Venta 2</span>
                                                    <span className="text-xs font-bold text-muted">$ {(p.pventa_2 || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col items-end gap-1.5">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[8px] font-black text-muted uppercase">P-Venta 3</span>
                                                    <span className="text-xs font-bold text-text">$ {(p.pventa_3 || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[8px] font-black text-primary uppercase">P-Venta 4 (China)</span>
                                                    <span className="text-sm font-black text-primary">$ {(p.pventa_4 || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="h-10 w-10 rounded-xl bg-surfaceHighlight flex items-center justify-center text-muted group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                                                <ChevronRight size={20} />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="p-24 text-center text-muted italic font-bold">
                                        No se encontraron artículos con los criterios actuales.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedProduct && (
                <ProductDetailModal 
                    product={selectedProduct} 
                    onClose={() => setSelectedProduct(null)} 
                    currentUser={currentUser}
                />
            )}
        </div>
    );
};
