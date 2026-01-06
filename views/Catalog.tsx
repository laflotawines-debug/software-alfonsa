
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, 
    Filter, 
    RefreshCw, 
    Loader2, 
    Boxes, 
    ChevronRight, 
    AlertCircle,
    Plus,
    ShieldCheck,
    Truck,
    Layers,
    Building2
} from 'lucide-react';
import { supabase } from '../supabase';
import { MasterProduct, User, SupplierMaster } from '../types';
import { ProductDetailModal } from '../components/ProductDetailModal';

interface CatalogProps {
    currentUser: User;
}

export const Catalog: React.FC<CatalogProps> = ({ currentUser }) => {
    const [products, setProducts] = useState<MasterProduct[]>([]);
    const [masterSuppliers, setMasterSuppliers] = useState<SupplierMaster[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<MasterProduct | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    
    const [familyFilter, setFamilyFilter] = useState<string>('TODAS');
    const [subfamilyFilter, setSubfamilyFilter] = useState<string>('TODAS');
    const [providerFilter, setProviderFilter] = useState<string>('TODOS');

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: suppData } = await supabase
                .from('providers_master')
                .select('*')
                .eq('activo', true)
                .order('razon_social', { ascending: true });
            
            if (suppData) setMasterSuppliers(suppData);

            const PAGE_SIZE = 1000;
            let allProducts: MasterProduct[] = [];
            let from = 0;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('master_products')
                    .select('*')
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
            setProducts(allProducts);

        } catch (err: any) {
            console.error("Error crítico cargando maestro:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const suppliersMap = useMemo(() => {
        const map = new Map<string, string>();
        masterSuppliers.forEach(s => map.set(s.codigo, s.razon_social));
        return map;
    }, [masterSuppliers]);

    const families = useMemo(() => {
        const unique = Array.from(new Set(products.map(p => p.familia).filter(Boolean)));
        return unique.sort() as string[];
    }, [products]);

    const subfamilies = useMemo(() => {
        const unique = Array.from(new Set(products.map(p => p.nsubf).filter(Boolean)));
        return unique.sort() as string[];
    }, [products]);

    const providersOptions = useMemo(() => {
        const unique = Array.from(new Set(products.map(p => p.nomprov).filter(Boolean)));
        return ['TODOS', ...unique.sort()];
    }, [products]);

    const filteredProducts = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase();
        return products.filter(p => {
            const matchesSearch = p.desart.toLowerCase().includes(lowerSearch) || 
                                 p.codart.toLowerCase().includes(lowerSearch);
            const matchesFamily = familyFilter === 'TODAS' || p.familia === familyFilter;
            const matchesSubfamily = subfamilyFilter === 'TODAS' || p.nsubf === subfamilyFilter;
            const matchesProvider = providerFilter === 'TODOS' || p.nomprov === providerFilter;
            return matchesSearch && matchesFamily && matchesSubfamily && matchesProvider;
        });
    }, [products, searchTerm, familyFilter, subfamilyFilter, providerFilter]);

    return (
        <div className="flex flex-col gap-6 pb-10 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight flex items-center gap-3 uppercase italic">
                        <Boxes className="text-primary" size={32} />
                        Maestro de Artículos
                    </h2>
                    <p className="text-muted text-sm mt-1 font-medium italic">Base de datos de productos y proveedores vinculados.</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button 
                        onClick={fetchData} 
                        disabled={isLoading}
                        className="p-4 rounded-2xl bg-surface border border-surfaceHighlight text-muted hover:text-primary transition-all disabled:opacity-50 shadow-sm"
                    >
                        <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    {currentUser.role === 'vale' && (
                        <button 
                            onClick={() => setIsCreating(true)}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-primaryHover text-white px-8 py-4 rounded-2xl font-black text-sm uppercase transition-all shadow-xl shadow-primary/20 active:scale-95"
                        >
                            <Plus size={20} /> Nuevo Artículo
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-surface border border-surfaceHighlight rounded-2xl p-5 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-12 lg:col-span-4 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar por descripción o código..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary transition-all shadow-inner uppercase"
                        />
                    </div>
                    <div className="md:col-span-4 lg:col-span-2">
                        <select 
                            value={familyFilter} 
                            onChange={(e) => { setFamilyFilter(e.target.value); setSubfamilyFilter('TODAS'); }}
                            className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 px-4 text-sm font-black text-muted outline-none focus:border-primary cursor-pointer appearance-none uppercase"
                        >
                            <option value="TODAS">TODAS LAS FAMILIAS</option>
                            {families.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-4 lg:col-span-3">
                        <select 
                            value={subfamilyFilter} 
                            onChange={(e) => setSubfamilyFilter(e.target.value)}
                            className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 px-4 text-sm font-black text-muted outline-none focus:border-primary cursor-pointer appearance-none uppercase"
                        >
                            <option value="TODAS">TODAS LAS SUBFAMILIAS</option>
                            {subfamilies.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-4 lg:col-span-3">
                        <select 
                            value={providerFilter} 
                            onChange={(e) => setProviderFilter(e.target.value)}
                            className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 px-4 text-sm font-black text-muted outline-none focus:border-primary cursor-pointer appearance-none uppercase"
                        >
                            <option value="TODOS">TODOS LOS PROVEEDORES</option>
                            {providersOptions.filter(p => p !== 'TODOS').map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-surface border border-surfaceHighlight rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-background/50 text-[10px] text-muted uppercase font-black tracking-widest border-b border-surfaceHighlight">
                            <tr>
                                <th className="p-4">Artículo / Clasificación</th>
                                <th className="p-4 text-center">Betbeder</th>
                                <th className="p-4 text-center">Llerena</th>
                                <th className="p-4 text-right">Lista 1</th>
                                <th className="p-4 text-right">Lista 4 (China)</th>
                                <th className="p-4 text-center w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surfaceHighlight">
                            {isLoading ? (
                                <tr><td colSpan={6} className="p-24 text-center"><Loader2 size={48} className="animate-spin text-primary mx-auto" /></td></tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr><td colSpan={6} className="p-20 text-center text-muted font-bold italic uppercase">No se encontraron artículos con los filtros aplicados.</td></tr>
                            ) : filteredProducts.map((p) => {
                                const officialName = p.codprove ? suppliersMap.get(p.codprove) : null;
                                
                                return (
                                    <tr 
                                        key={p.codart} 
                                        onClick={() => setSelectedProduct(p)}
                                        className="group hover:bg-primary/5 transition-colors cursor-pointer"
                                    >
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded">#{p.codart}</span>
                                                    <span className="text-sm font-black text-text uppercase truncate max-w-[250px]">{p.desart}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    <span className="text-[8px] font-black text-muted uppercase px-1.5 py-0.5 rounded border border-surfaceHighlight">{p.familia || 'S/FAM'}</span>
                                                    {p.nsubf && (
                                                        <span className="text-[8px] font-black text-primary uppercase px-1.5 py-0.5 rounded border border-primary/20 bg-primary/5 flex items-center gap-1">
                                                            <Layers size={10} />
                                                            {p.nsubf}
                                                        </span>
                                                    )}
                                                    
                                                    {officialName ? (
                                                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-green-500/20 bg-green-500/5 text-green-600 flex items-center gap-1 shadow-sm" title="Vínculo con Maestro Oficial">
                                                            <ShieldCheck size={10} />
                                                            {officialName}
                                                        </span>
                                                    ) : p.nomprov ? (
                                                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-blue-500/20 bg-blue-500/5 text-blue-600 flex items-center gap-1" title="Nombre de Proveedor (Referencia Excel)">
                                                            <Building2 size={10} />
                                                            {p.nomprov}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-red-500/20 bg-red-500/5 text-red-500 flex items-center gap-1">
                                                            <AlertCircle size={10} />
                                                            SIN PROVEEDOR
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`text-sm font-black ${p.stock_betbeder && p.stock_betbeder > 0 ? 'text-orange-500' : 'text-muted opacity-30'}`}>
                                                    {p.stock_betbeder || 0}
                                                </span>
                                                <span className="text-[7px] font-black text-muted uppercase">BBD</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`text-sm font-black ${p.stock_llerena && p.stock_llerena > 0 ? 'text-blue-500' : 'text-muted opacity-30'}`}>
                                                    {p.stock_llerena || 0}
                                                </span>
                                                <span className="text-[7px] font-black text-muted uppercase">LLE</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className="text-sm font-black text-text">$ {(p.pventa_1 || 0).toLocaleString('es-AR')}</span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className="text-sm font-black text-primary">$ {(p.pventa_4 || 0).toLocaleString('es-AR')}</span>
                                        </td>
                                        <td className="p-4">
                                            <ChevronRight size={18} className="text-muted group-hover:text-primary transition-all" />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {(selectedProduct || isCreating) && (
                <ProductDetailModal 
                    product={selectedProduct} 
                    existingFamilies={families}
                    existingSubfamilies={subfamilies}
                    onClose={(updated) => { 
                        setSelectedProduct(null); 
                        setIsCreating(false);
                        if (updated) fetchData(); 
                    }} 
                    currentUser={currentUser}
                    masterSuppliers={masterSuppliers}
                />
            )}
        </div>
    );
};
