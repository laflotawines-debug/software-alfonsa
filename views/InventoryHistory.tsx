
import React, { useState, useEffect, useMemo } from 'react';
import { 
    ClipboardList, Search, RefreshCw, Loader2, Info,
    Building2, ChevronDown, ChevronRight, User, Calendar,
    Warehouse, Filter, ArrowRightLeft, Calculator, Truck,
    History, Package, Hash, FileText, X, Eye, CalendarDays,
    ArrowUpRight, UserCheck
} from 'lucide-react';
import { supabase } from '../supabase';
import { StockMovement, StockInbound, User as UserType } from '../types';

// Interfaces para tipado fuerte fuera del componente
interface MovementExtended extends StockMovement {
    desart?: string;
    user_name?: string;
    warehouse_name?: string;
    inbound_info?: StockInbound & { supplier_name?: string };
}

interface ProviderGroupData {
    name: string;
    events: Record<string, MovementExtended[]>;
}

type GroupEntry = [string, ProviderGroupData];

export const InventoryHistory: React.FC<{ currentUser: UserType }> = ({ currentUser }) => {
    const [movements, setMovements] = useState<MovementExtended[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [warehouseFilter, setWarehouseFilter] = useState<string>('TODOS');
    const [typeFilter, setTypeFilter] = useState<string>('TODOS');
    
    // Filtros de fecha
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30); 
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    // Control de grupos y modales
    const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // 1. Cargar Movimientos
            let query = supabase
                .from('stock_movements')
                .select(`
                    *,
                    master_products(desart),
                    profiles:created_by(name),
                    warehouses(name)
                `)
                .gte('created_at', `${startDate}T00:00:00`)
                .lte('created_at', `${endDate}T23:59:59`)
                .order('created_at', { ascending: false });
            
            const { data: movs, error: movErr } = await query;
            if (movErr) throw movErr;

            // Evitar tipo 'unknown' de Supabase
            const movementsRaw = (movs as any[]) || [];

            // 2. Obtener IDs únicos de ingresos
            const inboundIds = Array.from(new Set(
                movementsRaw
                    .filter(m => m.type === 'ingreso' && m.reference_id)
                    .map(m => m.reference_id)
            ));
            
            let inboundsMap: Record<string, any> = {};
            if (inboundIds.length > 0) {
                const { data: inbs, error: inbErr } = await supabase
                    .from('stock_inbounds')
                    .select('*, providers_master(razon_social)')
                    .in('id', inboundIds);
                
                if (inbErr) throw inbErr;
                
                const inboundsRaw = (inbs as any[]) || [];
                inboundsRaw.forEach(i => {
                    inboundsMap[i.id] = {
                        ...i,
                        supplier_name: i.providers_master?.razon_social || i.supplier_code || 'S/D'
                    };
                });
            }

            const mapped: MovementExtended[] = movementsRaw.map((m: any) => ({
                ...m,
                desart: m.master_products?.desart,
                user_name: m.profiles?.name || 'Sistema',
                warehouse_name: m.warehouses?.name || 'N/A',
                inbound_info: m.type === 'ingreso' ? inboundsMap[m.reference_id] : undefined
            }));
            
            setMovements(mapped);
        } catch (err: any) {
            console.error("Error historial:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [startDate, endDate]);

    const toggleProvider = (name: string) => {
        const next = new Set(expandedProviders);
        if (next.has(name)) next.delete(name); else next.add(name);
        setExpandedProviders(next);
    };

    // Filtro principal por palabras clave
    const filteredMovements = useMemo<MovementExtended[]>(() => {
        const keywords = searchTerm.toLowerCase().split(/\s+/).filter(k => k.length > 0);
        return movements.filter(m => {
            const textToSearch = `${m.desart} ${m.codart} ${m.inbound_info?.supplier_name || ''} ${m.inbound_info?.observations || ''}`.toLowerCase();
            const matchesSearch = keywords.every(k => textToSearch.includes(k));
            
            const matchesWarehouse = warehouseFilter === 'TODOS' || m.warehouse_name === warehouseFilter;
            const matchesType = typeFilter === 'TODOS' || m.type === typeFilter;

            return matchesSearch && matchesWarehouse && matchesType;
        });
    }, [movements, searchTerm, warehouseFilter, typeFilter]);

    // Agrupación compleja con tipado GroupEntry
    const providerGroups = useMemo<GroupEntry[]>(() => {
        const groups: Record<string, ProviderGroupData> = {};
        
        filteredMovements.filter(m => m.type === 'ingreso').forEach(m => {
            const pName = m.inbound_info?.supplier_name || 'OTROS / MANUALES';
            const refId = m.reference_id || 'SIN_REF';

            if (!groups[pName]) groups[pName] = { name: pName, events: {} };
            if (!groups[pName].events[refId]) groups[pName].events[refId] = [];
            
            groups[pName].events[refId].push(m);
        });

        return (Object.entries(groups) as GroupEntry[]).sort((a,b) => a[1].name.localeCompare(b[1].name));
    }, [filteredMovements]);

    const otherMovements = useMemo<MovementExtended[]>(() => 
        filteredMovements.filter(m => m.type !== 'ingreso'), 
    [filteredMovements]);

    return (
        <div className="flex flex-col gap-6 pb-20 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight flex items-center gap-3 uppercase italic">
                        <ClipboardList className="text-primary" size={32} />
                        Seguimiento de Stock
                    </h2>
                    <p className="text-muted text-sm mt-1 font-medium italic">Auditoría jerárquica de movimientos realizados.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="flex bg-surface border border-surfaceHighlight rounded-xl overflow-hidden shadow-sm">
                        <div className="flex items-center px-3 text-muted"><CalendarDays size={16}/></div>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent py-2 text-[11px] font-black text-text outline-none" />
                        <div className="flex items-center px-2 text-muted">al</div>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent py-2 pr-3 text-[11px] font-black text-text outline-none" />
                    </div>
                    <button onClick={fetchData} className="p-3 rounded-xl bg-surface border border-surfaceHighlight text-muted hover:text-primary transition-all shadow-sm">
                        <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-6 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                    <input type="text" placeholder="Buscar por artículo, proveedor o comprobante..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary shadow-inner" />
                </div>
                <div className="md:col-span-3">
                    <select value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-sm font-bold text-text outline-none cursor-pointer uppercase">
                        <option value="TODOS">Todos los Depósitos</option>
                        <option value="LLERENA">Llerena</option>
                        <option value="BETBEDER">Betbeder</option>
                    </select>
                </div>
                <div className="md:col-span-3">
                    <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-sm font-bold text-text outline-none cursor-pointer uppercase">
                        <option value="TODOS">Todos los Tipos</option>
                        <option value="ingreso">Solo Ingresos</option>
                        <option value="ajuste">Solo Ajustes</option>
                        <option value="transferencia">Solo Transf.</option>
                    </select>
                </div>
            </div>

            <div className="space-y-4">
                {isLoading && movements.length === 0 ? (
                    <div className="py-20 flex justify-center"><Loader2 size={48} className="animate-spin text-primary" /></div>
                ) : filteredMovements.length === 0 ? (
                    <div className="py-20 text-center text-muted font-bold italic border-2 border-dashed border-surfaceHighlight rounded-3xl">No se registran movimientos para el rango seleccionado.</div>
                ) : (
                    <>
                        {/* SECCIÓN 1: INGRESOS AGRUPADOS */}
                        {providerGroups.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 ml-2 mb-4">
                                    <Truck size={18} className="text-primary"/>
                                    <h3 className="text-xs font-black text-muted uppercase tracking-widest">Ingresos por Proveedor</h3>
                                </div>
                                {providerGroups.map(([pCode, group]: GroupEntry) => {
                                    const isExpanded = expandedProviders.has(pCode);
                                    const totalEvents = Object.keys(group.events).length;

                                    return (
                                        <div key={pCode} className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm transition-all">
                                            <button 
                                                onClick={() => toggleProvider(pCode)}
                                                className="w-full p-5 flex items-center justify-between hover:bg-primary/5 transition-colors text-left group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-xl bg-background border border-surfaceHighlight flex items-center justify-center text-primary group-hover:border-primary/30 shadow-inner">
                                                        <Building2 size={20}/>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-base font-black text-text uppercase italic leading-tight">{group.name}</h4>
                                                        <p className="text-[10px] font-bold text-muted uppercase tracking-tighter mt-0.5">{totalEvents} Entregas realizadas</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    {isExpanded ? <ChevronDown className="text-muted" /> : <ChevronRight className="text-muted" />}
                                                </div>
                                            </button>

                                            {isExpanded && (
                                                <div className="border-t border-surfaceHighlight bg-background/20 animate-in slide-in-from-top-2 duration-300">
                                                    <div className="divide-y divide-surfaceHighlight/50">
                                                        {(Object.entries(group.events) as [string, MovementExtended[]][]).map(([evId, movs]: [string, MovementExtended[]]) => {
                                                            const first = movs[0];
                                                            const date = new Date(first.created_at).toLocaleDateString();
                                                            const displayId = first.inbound_info?.display_number ? `#${first.inbound_info.display_number}` : 'S/N';
                                                            const ref = first.inbound_info?.observations || 'S/REF';

                                                            return (
                                                                <div key={evId} className="p-4 pl-12 flex items-center justify-between hover:bg-surface transition-colors">
                                                                    <div className="flex items-center gap-6">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[10px] font-black text-primary uppercase">Ingreso {displayId}</span>
                                                                            <span className="text-[10px] font-bold text-muted">{date}</span>
                                                                        </div>
                                                                        <div className="flex flex-col">
                                                                            <span className="text-xs font-bold text-text uppercase italic">{ref}</span>
                                                                            <span className="text-[9px] text-muted font-bold uppercase">{movs.length} Artículos procesados</span>
                                                                        </div>
                                                                    </div>
                                                                    <button 
                                                                        onClick={() => setSelectedEventId(evId)}
                                                                        className="flex items-center gap-2 px-4 py-2 bg-surfaceHighlight text-text hover:bg-primary/10 hover:text-primary rounded-xl transition-all text-[10px] font-black uppercase"
                                                                    >
                                                                        <Eye size={14}/> Detalle
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* SECCIÓN 2: OTROS MOVIMIENTOS */}
                        {otherMovements.length > 0 && (
                            <div className="space-y-3 pt-6">
                                <div className="flex items-center gap-3 ml-2 mb-4">
                                    <History size={18} className="text-primary"/>
                                    <h3 className="text-xs font-black text-muted uppercase tracking-widest">Ajustes e Internos</h3>
                                </div>
                                <div className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left">
                                        <thead className="bg-background/50 text-[10px] text-muted uppercase font-black border-b border-surfaceHighlight">
                                            <tr>
                                                <th className="p-4 pl-6">Fecha / Tipo</th>
                                                <th className="p-4">Artículo</th>
                                                <th className="p-4 text-center">Cant.</th>
                                                <th className="p-4 text-center">Depósito</th>
                                                <th className="p-4 text-right pr-6">Responsable</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-surfaceHighlight">
                                            {otherMovements.map((m: MovementExtended) => (
                                                <tr key={m.id} className="hover:bg-primary/5 transition-colors">
                                                    <td className="p-4 pl-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black text-text">{new Date(m.created_at).toLocaleDateString()}</span>
                                                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border self-start mt-1 ${
                                                                m.type === 'ajuste' ? 'bg-orange-500/10 text-orange-600 border-orange-200' : 'bg-blue-500/10 text-blue-600 border-blue-200'
                                                            }`}>{m.type}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex flex-col"><span className="text-xs font-bold text-text uppercase truncate max-w-[200px]">{m.desart}</span><span className="text-[9px] font-mono text-muted">#{m.codart}</span></div>
                                                    </td>
                                                    <td className="p-4 text-center font-black text-sm">
                                                        <span className={m.quantity < 0 ? 'text-red-500' : 'text-green-600'}>{m.quantity > 0 ? '+' : ''}{m.quantity}</span>
                                                    </td>
                                                    <td className="p-4 text-center"><span className="px-2 py-0.5 rounded text-[8px] font-black border text-muted uppercase">{m.warehouse_name}</span></td>
                                                    <td className="p-4 text-right pr-6"><span className="text-[10px] font-bold text-muted uppercase">{m.user_name}</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {selectedEventId && (
                <HistoryDetailModal 
                    eventId={selectedEventId}
                    movements={movements.filter(m => m.reference_id === selectedEventId)}
                    onClose={() => setSelectedEventId(null)}
                />
            )}
        </div>
    );
};

// --- MODAL DE DETALLE DE EVENTO ---
const HistoryDetailModal: React.FC<{ 
    eventId: string, 
    movements: MovementExtended[], 
    onClose: () => void 
}> = ({ eventId, movements, onClose }) => {
    const first = movements[0];
    const isInbound = first?.type === 'ingreso';
    const inboundInfo = first?.inbound_info;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background w-full max-w-2xl rounded-3xl border border-surfaceHighlight shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
                <div className="p-6 border-b border-surfaceHighlight bg-surface flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-text uppercase italic tracking-tight">Detalle de Operación</h3>
                        <p className="text-[10px] text-muted font-bold uppercase">
                            {isInbound ? `Ingreso #${inboundInfo?.display_number || '-'} | ${inboundInfo?.supplier_name}` : `Movimiento ID: ${eventId.substring(0,8)}`}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-surfaceHighlight transition-all"><X size={24}/></button>
                </div>

                <div className="p-6 grid grid-cols-2 gap-4 bg-background/50 border-b border-surfaceHighlight">
                    <div className="flex items-center gap-3">
                        <Calendar size={18} className="text-primary"/>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-muted uppercase">Fecha / Hora</span>
                            <span className="text-xs font-bold text-text">{new Date(first.created_at).toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <UserCheck size={18} className="text-primary"/>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-muted uppercase">Operador</span>
                            <span className="text-xs font-black uppercase text-text">{first.user_name}</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="border border-surfaceHighlight rounded-2xl overflow-hidden bg-surface shadow-sm">
                        <table className="w-full text-left">
                            <thead className="bg-background/50 text-[9px] text-muted uppercase font-black border-b border-surfaceHighlight tracking-widest">
                                <tr>
                                    <th className="p-4">Artículo</th>
                                    <th className="p-4 text-center">Depósito</th>
                                    <th className="p-4 text-center">Cantidad</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surfaceHighlight">
                                {movements.map((m: MovementExtended) => (
                                    <tr key={m.id} className="hover:bg-background/20 transition-colors">
                                        <td className="p-4">
                                            <p className="text-xs font-black uppercase text-text">{m.desart}</p>
                                            <p className="text-[9px] font-mono text-muted">#{m.codart}</p>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="text-[10px] font-bold text-muted uppercase">{m.warehouse_name}</span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <span className={`text-xs font-black ${m.quantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                    {m.quantity > 0 ? '+' : ''}{m.quantity}
                                                </span>
                                                <ArrowUpRight size={12} className={m.quantity > 0 ? 'text-green-500 rotate-0' : 'text-red-500 rotate-90'} />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="p-6 bg-surface border-t border-surfaceHighlight">
                    <button onClick={onClose} className="w-full py-4 font-black uppercase text-xs text-text hover:bg-surfaceHighlight rounded-2xl border border-surfaceHighlight transition-all">Cerrar Auditoría</button>
                </div>
            </div>
        </div>
    );
};
