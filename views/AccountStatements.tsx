
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Search, 
    FileText, 
    FileSpreadsheet, 
    X, 
    Loader2, 
    User as UserIcon, 
    Check, 
    BookOpen,
    Ban,
    Trash2,
    Plus,
    FilePlus,
    FileMinus,
    Save,
    Warehouse,
    History,
    Clock,
    CheckCircle2,
    Eye,
    Activity,
    LogOut
} from 'lucide-react';
import { supabase } from '../supabase';
import { ClientMaster, AccountMovement, MasterProduct, User } from '../types';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

export const AccountStatements: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    // --- ESTADOS DE BÚSQUEDA ---
    const [clientSearch, setClientSearch] = useState('');
    const [searchResults, setSearchResults] = useState<ClientMaster[]>([]);
    const [selectedClient, setSelectedClient] = useState<ClientMaster | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // --- ESTADOS DE DATOS ---
    const [movements, setMovements] = useState<AccountMovement[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{ id: string, type: 'delete' | 'annul' } | null>(null);

    // --- ESTADO MODAL NUEVA OPERACIÓN ---
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    
    // --- ESTADO MODAL DETALLE ---
    const [detailMovement, setDetailMovement] = useState<AccountMovement | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearch = async (val: string) => {
        setClientSearch(val);
        const trimmed = val.trim();
        if (trimmed.length < 2) {
            setSearchResults([]);
            setShowDropdown(false);
            return;
        }

        setIsSearching(true);
        setShowDropdown(true);
        try {
            const words = trimmed.split(/\s+/).filter(w => w.length > 0);
            let query = supabase.from('clients_master').select('*');
            
            words.forEach(word => {
                query = query.or(`nombre.ilike.%${word}%,codigo.ilike.%${word}%`);
            });

            const { data, error } = await query.limit(6);

            if (error) throw error;
            setSearchResults(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearching(false);
        }
    };

    const fetchMovements = async (clientCode: string) => {
        setIsLoadingData(true);
        try {
            const { data, error } = await supabase
                .from('client_account_movements')
                .select('*')
                .eq('client_code', clientCode)
                .order('date', { ascending: true }) // Orden cronológico para calcular saldo
                .order('created_at', { ascending: true });

            if (error) throw error;

            if (data) {
                let runningBalance = 0;
                const calculatedMovements = data.map(m => {
                    const isAnnulled = m.is_annulled === true;
                    const debit = isAnnulled ? 0 : (Number(m.debit) || 0);
                    const credit = isAnnulled ? 0 : (Number(m.credit) || 0);
                    
                    runningBalance = runningBalance + debit - credit;
                    
                    return {
                        ...m,
                        balance: runningBalance 
                    };
                });
                setMovements(calculatedMovements.reverse());
            }
        } catch (err) {
            console.error("Error al cargar movimientos:", err);
        } finally {
            setIsLoadingData(false);
        }
    };

    const selectClient = (client: ClientMaster) => {
        setSelectedClient(client);
        setClientSearch(client.nombre);
        setShowDropdown(false);
        fetchMovements(client.codigo);
    };

    const handleAction = async () => {
        if (!confirmAction || !selectedClient) return;
        
        setIsLoadingData(true);
        try {
            if (confirmAction.type === 'delete') {
                const { error } = await supabase
                    .from('client_account_movements')
                    .delete()
                    .eq('id', confirmAction.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('client_account_movements')
                    .update({ is_annulled: true })
                    .eq('id', confirmAction.id);
                if (error) throw error;
            }
            
            await fetchMovements(selectedClient.codigo);
            setConfirmAction(null);
        } catch (e: any) {
            alert("Error al procesar la acción: " + e.message);
        } finally {
            setIsLoadingData(false);
        }
    };

    const totalBalance = useMemo(() => {
        if (movements.length === 0) return 0;
        return movements[0].balance; 
    }, [movements]);

    const handleExportExcel = () => {
        if (!selectedClient) return;
        const data = movements.map(m => ({
            'Fecha': m.date,
            'Concepto': m.is_annulled ? `(ANULADO) ${m.concept}` : m.concept,
            'Debe (Deuda)': m.is_annulled ? 0 : (m.debit || 0),
            'Haber (Pago)': m.is_annulled ? 0 : (m.credit || 0),
            'Saldo': m.balance,
            'Estado': m.is_annulled ? 'ANULADO' : 'ACTIVO'
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Estado de Cuenta");
        XLSX.writeFile(wb, `EstadoCuenta_${selectedClient.codigo}.xlsx`);
    };

    const handleGeneratePDF = () => {
        if (!selectedClient) return;
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.setTextColor(228, 124, 0);
        doc.text('Estado de Cuenta', 20, 20);
        doc.setFontSize(10);
        doc.setTextColor(50);
        doc.text(`Cliente: ${selectedClient.codigo} - ${selectedClient.nombre}`, 20, 30);
        doc.text(`Fecha Emisión: ${new Date().toLocaleDateString()}`, 20, 36);
        
        let y = 50;
        doc.setFont('helvetica', 'bold');
        doc.text('FECHA', 20, y);
        doc.text('CONCEPTO', 45, y);
        doc.text('DEBE', 130, y, { align: 'right' });
        doc.text('HABER', 160, y, { align: 'right' });
        doc.text('SALDO', 190, y, { align: 'right' });
        
        y += 5;
        doc.line(20, y, 190, y);
        y += 7;
        doc.setFont('helvetica', 'normal');
        
        movements.forEach(m => {
            if (m.is_annulled) {
                doc.setTextColor(150); 
            } else {
                doc.setTextColor(0);
            }
            
            doc.text(new Date(m.date).toLocaleDateString(), 20, y);
            const conceptText = m.is_annulled ? `(ANULADO) ${m.concept}` : m.concept;
            doc.text(conceptText.substring(0, 35), 45, y);
            
            const debitVal = m.is_annulled ? 0 : m.debit;
            const creditVal = m.is_annulled ? 0 : m.credit;

            doc.text(debitVal > 0 ? `$${debitVal.toLocaleString()}` : '-', 130, y, { align: 'right' });
            doc.text(creditVal > 0 ? `$${creditVal.toLocaleString()}` : '-', 160, y, { align: 'right' });
            doc.text(`$${m.balance.toLocaleString()}`, 190, y, { align: 'right' });
            
            if (m.is_annulled) {
                doc.setDrawColor(150);
                doc.line(20, y-1, 190, y-1); 
            }

            y += 7;
            if (y > 270) { doc.addPage(); y = 20; }
        });
        
        doc.save(`EstadoCuenta_${selectedClient.codigo}.pdf`);
    };

    const handleTransactionSuccess = () => {
        setIsTransactionModalOpen(false);
        if (selectedClient) fetchMovements(selectedClient.codigo);
    };

    return (
        <div className="flex flex-col gap-6 pb-20 animate-in fade-in duration-500 max-w-7xl mx-auto w-full">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary rounded-2xl text-white shadow-lg shadow-primary/20">
                        <BookOpen size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-text tracking-tight uppercase italic leading-none">Estado de Cuenta</h2>
                        {selectedClient && (
                            <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-1">
                                <p className="text-sm font-black text-primary uppercase tracking-widest">{selectedClient.codigo} - {selectedClient.nombre}</p>
                                <p className="text-xs font-bold text-muted flex items-center gap-1"><Activity size={12}/> {selectedClient.localidad}</p>
                            </div>
                        )}
                    </div>
                </div>

                {selectedClient && (
                    <div className="flex items-center gap-4">
                        <div className="bg-surface border border-surfaceHighlight rounded-2xl p-4 flex items-center gap-6 shadow-sm animate-in zoom-in-95">
                            <div className="text-right">
                                <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Saldo Actual</p>
                                <p className={`text-3xl font-black tracking-tighter ${totalBalance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                    $ {totalBalance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                            <div className="h-10 w-px bg-surfaceHighlight"></div>
                            <button onClick={() => fetchMovements(selectedClient.codigo)} className="p-2 text-muted hover:text-primary transition-colors">
                                <CheckCircle2 size={24} />
                            </button>
                        </div>
                        <button 
                            onClick={() => setIsTransactionModalOpen(true)}
                            className="bg-primary hover:bg-primaryHover text-white px-6 py-4 rounded-2xl font-black text-xs uppercase shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center gap-2"
                        >
                            <Plus size={18} /> Nueva Operación
                        </button>
                    </div>
                )}
            </div>

            {!selectedClient ? (
                <div className="bg-surface border border-surfaceHighlight rounded-3xl p-10 shadow-sm flex flex-col items-center justify-center gap-6 text-center animate-in fade-in">
                    <div className="p-5 bg-background rounded-full text-muted mb-2">
                        <UserIcon size={48} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-text uppercase">Seleccionar Cliente</h3>
                        <p className="text-muted text-sm mt-1">Busque el cliente por nombre o código para ver sus movimientos.</p>
                    </div>
                    <div className="w-full max-w-lg relative" ref={dropdownRef}>
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
                        <input 
                            type="text" 
                            placeholder="Nombre o Código..." 
                            value={clientSearch}
                            onChange={(e) => handleSearch(e.target.value)}
                            onFocus={() => clientSearch.length >= 2 && setShowDropdown(true)}
                            className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:border-primary transition-all shadow-inner uppercase"
                        />
                        {isSearching && <div className="absolute right-4 top-1/2 -translate-y-1/2"><Loader2 size={18} className="animate-spin text-primary"/></div>}
                        
                        {showDropdown && (
                            <div className="absolute top-full left-0 w-full bg-surface border border-primary/30 rounded-2xl shadow-2xl mt-2 z-50 overflow-hidden animate-in slide-in-from-top-2">
                                {searchResults.length > 0 ? (
                                    <div className="flex flex-col">
                                        {searchResults.map((c) => (
                                            <button 
                                                key={c.codigo} 
                                                onClick={() => selectClient(c)}
                                                className="w-full p-4 hover:bg-primary/5 text-left border-b border-surfaceHighlight last:border-none flex justify-between items-center group transition-colors"
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-text group-hover:text-primary transition-colors">{c.nombre}</span>
                                                    <span className="text-[9px] font-mono text-muted bg-surfaceHighlight px-1.5 rounded w-fit mt-0.5">#{c.codigo}</span>
                                                </div>
                                                <Check size={16} className="text-primary opacity-0 group-hover:opacity-100" />
                                            </button>
                                        ))}
                                    </div>
                                ) : <div className="p-6 text-center text-[10px] font-bold text-muted uppercase tracking-widest">Sin coincidencias</div>}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-surface rounded-[2rem] border border-surfaceHighlight shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-700">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#e47c00] text-white">
                                        <th className="p-4 text-xs font-black uppercase tracking-widest pl-8">Fecha</th>
                                        <th className="p-4 text-xs font-black uppercase tracking-widest">Concepto</th>
                                        <th className="p-4 text-xs font-black uppercase tracking-widest text-right">Debe</th>
                                        <th className="p-4 text-xs font-black uppercase tracking-widest text-right">Haber</th>
                                        <th className="p-4 text-xs font-black uppercase tracking-widest text-right">Saldo</th>
                                        <th className="p-4 text-xs font-black uppercase tracking-widest text-center pr-8 w-32">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surfaceHighlight">
                                    {isLoadingData ? (
                                        <tr><td colSpan={6} className="p-20 text-center"><Loader2 size={48} className="animate-spin text-primary mx-auto" /></td></tr>
                                    ) : movements.length === 0 ? (
                                        <tr><td colSpan={6} className="p-20 text-center text-muted italic font-bold">No hay movimientos registrados.</td></tr>
                                    ) : movements.map((m) => (
                                        <tr key={m.id} className={`hover:bg-background/40 transition-colors group ${m.is_annulled ? 'opacity-50 grayscale bg-background/20' : ''}`}>
                                            <td className={`p-4 pl-8 text-xs font-bold ${m.is_annulled ? 'text-muted line-through' : 'text-muted group-hover:text-text'}`}>
                                                {new Date(m.date).toLocaleDateString()}
                                            </td>
                                            <td className={`p-4 text-sm font-bold ${m.is_annulled ? 'text-muted line-through italic' : 'text-text uppercase'}`}>
                                                {m.concept} {m.is_annulled && "(ANULADO)"}
                                            </td>
                                            <td className={`p-4 text-right text-sm font-black ${m.is_annulled ? 'text-muted line-through' : 'text-red-500/80'}`}>
                                                {m.debit > 0 ? `$ ${m.debit.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}
                                            </td>
                                            <td className={`p-4 text-right text-sm font-black ${m.is_annulled ? 'text-muted line-through' : 'text-green-600'}`}>
                                                {m.credit > 0 ? `$ ${m.credit.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}
                                            </td>
                                            <td className="p-4 text-right text-sm font-black text-text">
                                                $ {m.balance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-4 pr-8 text-center">
                                                <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {m.order_id && (
                                                        <button 
                                                            onClick={() => setDetailMovement(m)}
                                                            className="p-1.5 text-blue-500 bg-blue-500/10 hover:bg-blue-500 hover:text-white rounded-lg transition-all"
                                                            title="Ver Detalle de Productos"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                    )}
                                                    {!m.is_annulled && (
                                                        <button 
                                                            onClick={() => setConfirmAction({ id: m.id, type: 'annul' })}
                                                            className="p-1.5 text-orange-500 bg-orange-500/10 hover:bg-orange-500 hover:text-white rounded-lg transition-all"
                                                            title="Anular (Queda registro en 0)"
                                                        >
                                                            <Ban size={14} />
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => setConfirmAction({ id: m.id, type: 'delete' })}
                                                        className="p-1.5 text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                                                        title="Eliminar definitivamente"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <button 
                                onClick={handleGeneratePDF}
                                className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-primary hover:bg-primaryHover text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95"
                            >
                                <FileText size={18} /> Emitir Resumen PDF
                            </button>
                            <button 
                                onClick={handleExportExcel}
                                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                            >
                                <FileSpreadsheet size={18} /> Excel
                            </button>
                        </div>

                        <div className="flex items-center gap-6">
                            <button 
                                onClick={() => { setSelectedClient(null); setMovements([]); }}
                                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-slate-900 text-white hover:bg-black font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95"
                            >
                                Cerrar Cliente <LogOut size={18} className="rotate-180" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRMATION MODAL */}
            {confirmAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-surface w-full max-w-sm rounded-3xl border border-red-500/30 shadow-2xl p-8 flex flex-col items-center text-center gap-6">
                        <div className={`p-4 rounded-full ${confirmAction.type === 'delete' ? 'bg-red-500/10 text-red-500' : 'bg-orange-500/10 text-orange-500'}`}>
                            {confirmAction.type === 'delete' ? <Trash2 size={48} /> : <Ban size={48} />}
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-text uppercase italic tracking-tight">
                                {confirmAction.type === 'delete' ? '¿Eliminar Registro?' : '¿Anular Registro?'}
                            </h3>
                            <p className="text-sm text-muted mt-2 font-medium">
                                {confirmAction.type === 'delete' 
                                    ? "Esta acción borrará permanentemente el movimiento de la base de datos." 
                                    : "El movimiento quedará visible pero tachado, y su valor será $0 en el saldo."}
                            </p>
                        </div>
                        <div className="flex flex-col w-full gap-3">
                            <button 
                                onClick={handleAction}
                                className={`w-full py-4 text-white font-black rounded-2xl shadow-lg transition-all active:scale-95 uppercase text-xs tracking-widest flex items-center justify-center gap-2 ${confirmAction.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-500 hover:bg-orange-600'}`}
                            >
                                {confirmAction.type === 'delete' ? 'Sí, Eliminar' : 'Sí, Anular'}
                            </button>
                            <button 
                                onClick={() => setConfirmAction(null)}
                                className="w-full py-4 bg-surfaceHighlight text-text font-black rounded-2xl transition-all hover:bg-surfaceHighlight/80 uppercase text-xs tracking-widest"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TRANSACTION MODAL (New Invoice / Credit Note) */}
            {isTransactionModalOpen && selectedClient && (
                <TransactionModal 
                    client={selectedClient} 
                    onClose={() => setIsTransactionModalOpen(false)}
                    onSuccess={handleTransactionSuccess}
                    currentUser={currentUser}
                />
            )}

            {/* MOVEMENT DETAIL MODAL */}
            {detailMovement && (
                <TransactionDetailModal 
                    movement={detailMovement} 
                    onClose={() => setDetailMovement(null)} 
                />
            )}
        </div>
    );
};

// --- TRANSACTION MODAL COMPONENT ---
interface TransactionModalProps {
    client: ClientMaster;
    onClose: () => void;
    onSuccess: () => void;
    currentUser: User;
}

interface TransactionItem {
    id: string;
    codart: string;
    description: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
}

const TransactionModal: React.FC<TransactionModalProps> = ({ client, onClose, onSuccess, currentUser }) => {
    const [type, setType] = useState<'invoice' | 'credit_note'>('invoice');
    const [warehouse, setWarehouse] = useState<'LLERENA' | 'BETBEDER'>('LLERENA');
    const [listPrice, setListPrice] = useState<number>(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<MasterProduct[]>([]);
    const [items, setItems] = useState<TransactionItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [products, setProducts] = useState<MasterProduct[]>([]); 

    // Estados para el historial de precios
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [historyItems, setHistoryItems] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [targetItemId, setTargetItemId] = useState<string | null>(null);

    // Cargar productos al abrir
    useEffect(() => {
        const loadProducts = async () => {
            const { data } = await supabase.from('master_products').select('*').order('desart');
            if (data) setProducts(data);
        };
        loadProducts();
    }, []);

    const handleSearch = (val: string) => {
        setSearchTerm(val);
        if (val.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        const keywords = val.toLowerCase().split(' ').filter(k => k.length > 0);
        const results = products.filter(p => {
            const text = `${p.desart} ${p.codart}`.toLowerCase();
            return keywords.every(k => text.includes(k));
        }).slice(0, 10);
        setSearchResults(results);
    };

    const getPrice = (p: MasterProduct) => {
        switch (listPrice) {
            case 1: return p.pventa_1;
            case 2: return p.pventa_2;
            case 3: return p.pventa_3;
            case 4: return p.pventa_4;
            default: return p.pventa_1;
        }
    };

    const addItem = (p: MasterProduct) => {
        const price = getPrice(p);
        const newItem: TransactionItem = {
            id: Math.random().toString(36).substr(2, 9),
            codart: p.codart,
            description: p.desart,
            quantity: 1,
            unitPrice: price,
            subtotal: price
        };
        setItems([...items, newItem]);
        setSearchTerm('');
        setSearchResults([]);
    };

    const updateItem = (id: string, qty: number) => {
        if (qty < 1) return;
        setItems(items.map(i => i.id === id ? { ...i, quantity: qty, subtotal: qty * i.unitPrice } : i));
    };

    const removeItem = (id: string) => {
        setItems(items.filter(i => i.id !== id));
    };

    const handlePriceDoubleClick = async (item: TransactionItem) => {
        try {
            const { data: orders } = await supabase
                .from('orders')
                .select(`
                    created_at,
                    order_items!inner (
                        unit_price,
                        code
                    )
                `)
                .eq('client_name', client.nombre) 
                .eq('order_items.code', item.codart)
                .order('created_at', { ascending: false })
                .limit(1);

            if (orders && orders.length > 0 && orders[0].order_items && orders[0].order_items.length > 0) {
                const lastPrice = orders[0].order_items[0].unit_price;
                setItems(prev => prev.map(i => {
                    if (i.id === item.id) {
                        return { ...i, unitPrice: lastPrice, subtotal: i.quantity * lastPrice };
                    }
                    return i;
                }));
            } else {
                handleOpenHistory(item);
            }
        } catch (e) {
            handleOpenHistory(item);
        }
    };

    const handleOpenHistory = async (item: TransactionItem) => {
        setTargetItemId(item.id);
        setHistoryModalOpen(true);
        setHistoryLoading(true);
        try {
            const { data, error } = await supabase
                .from('order_items')
                .select(`
                    unit_price, 
                    quantity,
                    created_at,
                    orders!inner (
                        display_id, 
                        created_at,
                        client_name
                    )
                `)
                .eq('code', item.codart)
                .ilike('orders.client_name', `%${client.nombre.trim()}%`)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;
            setHistoryItems(data || []);
        } catch (e) {
            console.error("Error buscando historial:", e);
        } finally {
            setHistoryLoading(false);
        }
    };

    const applyHistoryPrice = (price: number) => {
        if (targetItemId) {
            setItems(prev => prev.map(i => {
                if (i.id === targetItemId) {
                    return { ...i, unitPrice: price, subtotal: i.quantity * price };
                }
                return i;
            }));
            setHistoryModalOpen(false);
            setTargetItemId(null);
        }
    };

    const totalAmount = items.reduce((acc, i) => acc + i.subtotal, 0);

    const handleSave = async () => {
        if (items.length === 0) return alert("Agregue productos a la operación.");
        
        setIsSaving(true);
        try {
            const displayId = `${type === 'invoice' ? 'FAC' : 'NC'}-${Date.now().toString().slice(-6)}`;
            
            const { data: order, error: orderErr } = await supabase.from('orders').insert({
                display_id: displayId,
                client_name: client.nombre,
                status: 'entregado', 
                total: totalAmount,
                observations: `GENERADO DESDE CTA CTE: ${type === 'invoice' ? 'FACTURA MANUAL' : 'NOTA DE CRÉDITO'} - LISTA ${listPrice} - SUC: ${warehouse}`,
                payment_method: 'Cta Cte',
                history: [{
                    timestamp: new Date().toISOString(),
                    action: 'MANUAL_ENTRY',
                    details: `Creación directa en Cuenta Corriente (${type}) desde ${warehouse}`
                }]
            }).select().single();

            if (orderErr) throw orderErr;

            const orderItems = items.map(i => ({
                order_id: order.id,
                code: i.codart,
                name: i.description,
                original_quantity: i.quantity,
                quantity: i.quantity,
                shipped_quantity: i.quantity,
                unit_price: i.unitPrice,
                subtotal: i.subtotal
            }));

            const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
            if (itemsErr) throw itemsErr;

            const movementData = {
                client_code: client.codigo,
                date: new Date().toISOString().split('T')[0],
                concept: `${type === 'invoice' ? 'Factura' : 'Nota de Crédito'} ${displayId}`,
                debit: type === 'invoice' ? totalAmount : 0,
                credit: type === 'credit_note' ? totalAmount : 0,
                order_id: order.id,
                created_by: currentUser.id
            };

            const { error: moveErr } = await supabase.from('client_account_movements').insert(movementData);
            if (moveErr) throw moveErr;

            for (const item of items) {
                const { data: currentProd } = await supabase.from('master_products').select('stock_llerena, stock_betbeder').eq('codart', item.codart).single();
                
                if (currentProd) {
                    const currentStock = warehouse === 'LLERENA' ? (currentProd.stock_llerena || 0) : (currentProd.stock_betbeder || 0);
                    let newStock = currentStock;

                    if (type === 'invoice') {
                        newStock = currentStock - item.quantity;
                    } else {
                        newStock = currentStock + item.quantity;
                    }

                    const updatePayload = warehouse === 'LLERENA' 
                        ? { stock_llerena: newStock } 
                        : { stock_betbeder: newStock };

                    await supabase.from('master_products').update(updatePayload).eq('codart', item.codart);
                }
            }

            onSuccess();
        } catch (e: any) {
            alert("Error al guardar: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        if (items.length > 0 && products.length > 0) {
            const updatedItems = items.map(item => {
                const prod = products.find(p => p.codart === item.codart);
                if (prod) {
                    const newPrice = getPrice(prod);
                    return { ...item, unitPrice: newPrice, subtotal: item.quantity * newPrice };
                }
                return item;
            });
            setItems(updatedItems);
        }
    }, [listPrice]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-background w-full max-w-4xl h-[90vh] rounded-3xl border border-surfaceHighlight shadow-2xl flex flex-col overflow-hidden relative">
                <div className="p-6 border-b border-surfaceHighlight bg-surface flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-xl font-black text-text uppercase italic tracking-tight flex items-center gap-2">
                            {type === 'invoice' ? <FilePlus size={24} className="text-red-500"/> : <FileMinus size={24} className="text-green-500"/>}
                            {type === 'invoice' ? 'Nueva Factura' : 'Nueva Nota de Crédito'}
                        </h3>
                        <p className="text-xs font-bold text-muted uppercase mt-1">{client.nombre} — {client.codigo}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-surfaceHighlight rounded-full text-muted transition-colors"><X size={24}/></button>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-6 bg-background border-b border-surfaceHighlight flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                            <div className="flex bg-surface p-1 rounded-xl border border-surfaceHighlight">
                                <button onClick={() => setType('invoice')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-2 ${type === 'invoice' ? 'bg-red-500 text-white shadow-md' : 'text-muted hover:text-text'}`}>
                                    <FilePlus size={14}/> Factura (Resta Stock)
                                </button>
                                <button onClick={() => setType('credit_note')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-2 ${type === 'credit_note' ? 'bg-green-600 text-white shadow-md' : 'text-muted hover:text-text'}`}>
                                    <FileMinus size={14}/> Nota Crédito (Suma Stock)
                                </button>
                            </div>
                            
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2 bg-surface p-1 rounded-xl border border-surfaceHighlight">
                                    <span className="text-[10px] font-black uppercase text-muted px-3 flex items-center gap-1"><Warehouse size={12}/> Sucursal:</span>
                                    <select 
                                        value={warehouse} 
                                        onChange={(e) => setWarehouse(e.target.value as any)} 
                                        className="bg-transparent text-xs font-black text-text outline-none cursor-pointer pr-2 uppercase"
                                    >
                                        <option value="LLERENA">Llerena</option>
                                        <option value="BETBEDER">Betbeder</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-2 bg-surface p-1 rounded-xl border border-surfaceHighlight">
                                    <span className="text-[10px] font-black uppercase text-muted px-3">Lista:</span>
                                    {[1, 2, 3, 4].map(n => (
                                        <button key={n} onClick={() => setListPrice(n)} className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${listPrice === n ? 'bg-primary text-white' : 'text-muted hover:bg-surfaceHighlight'}`}>
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="relative z-20">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                            <input 
                                autoFocus
                                type="text" 
                                placeholder="Buscar productos para agregar..." 
                                value={searchTerm}
                                onChange={e => handleSearch(e.target.value)}
                                className="w-full bg-surface border border-surfaceHighlight rounded-xl py-3 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase"
                            />
                            {searchResults.length > 0 && (
                                <div className="absolute top-full left-0 w-full mt-2 bg-surface border border-primary/30 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                                    {searchResults.map(p => {
                                        const stock = warehouse === 'LLERENA' ? p.stock_llerena : p.stock_betbeder;
                                        return (
                                            <button key={p.codart} onClick={() => addItem(p)} className="w-full p-3 text-left hover:bg-primary/5 border-b border-surfaceHighlight last:border-none flex justify-between items-center group">
                                                <div>
                                                    <p className="text-xs font-black text-text uppercase group-hover:text-primary">{p.desart}</p>
                                                    <p className="text-[9px] font-mono text-muted">#{p.codart} | Stock {warehouse}: {stock}</p>
                                                </div>
                                                <span className="text-xs font-bold text-primary">$ {getPrice(p).toLocaleString()}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-2 bg-background/50">
                        {items.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-30">
                                <FileText size={48} className="mb-2 text-muted"/>
                                <p className="font-black uppercase tracking-widest text-xs text-muted">Sin productos agregados</p>
                            </div>
                        ) : items.map(item => (
                            <div key={item.id} className="bg-surface border border-surfaceHighlight p-3 rounded-xl flex items-center justify-between shadow-sm group">
                                <div className="flex-1 min-w-0 pr-4">
                                    <p className="text-xs font-black text-text uppercase truncate">{item.description}</p>
                                    <div className="flex items-center gap-3 mt-1">
                                        <div 
                                            className="flex items-center gap-2 cursor-pointer hover:bg-surfaceHighlight/50 rounded p-1 transition-colors w-fit group/price"
                                            title="Doble clic: Cargar último precio de venta"
                                            onDoubleClick={() => handlePriceDoubleClick(item)}
                                        >
                                            <p className="text-[10px] text-muted font-mono">#{item.codart}</p>
                                            <span className="text-xs font-black text-primary group-hover/price:text-blue-500 group-hover/price:underline decoration-dotted">$ {item.unitPrice.toLocaleString()}</span>
                                        </div>
                                        <button 
                                            onClick={() => handleOpenHistory(item)}
                                            className="p-1 rounded-full text-muted hover:text-primary hover:bg-surfaceHighlight transition-colors"
                                            title="Ver historial de precios"
                                        >
                                            <History size={12} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center bg-background rounded-lg border border-surfaceHighlight overflow-hidden">
                                        <input 
                                            type="number" 
                                            min="1" 
                                            value={item.quantity} 
                                            onChange={(e) => updateItem(item.id, parseInt(e.target.value) || 1)}
                                            className="w-12 text-center bg-transparent text-xs font-black py-2 outline-none"
                                        />
                                    </div>
                                    <div className="text-right w-24">
                                        <span className="text-sm font-black text-text">$ {item.subtotal.toLocaleString()}</span>
                                    </div>
                                    <button onClick={() => removeItem(item.id)} className="p-2 text-muted hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors">
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-6 bg-surface border-t border-surfaceHighlight flex items-center justify-between shrink-0">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-muted uppercase tracking-widest">Total Operación</span>
                        <span className={`text-3xl font-black tracking-tighter ${type === 'invoice' ? 'text-red-500' : 'text-green-600'}`}>
                            $ {totalAmount.toLocaleString('es-AR')}
                        </span>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-4 rounded-2xl font-black text-xs uppercase text-muted hover:bg-surfaceHighlight transition-all">Cancelar</button>
                        <button onClick={handleSave} disabled={isSaving || items.length === 0} className="px-8 py-4 rounded-2xl bg-primary hover:bg-primaryHover text-white font-black text-xs uppercase shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50">
                            {isSaving ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>}
                            Confirmar
                        </button>
                    </div>
                </div>

                {historyModalOpen && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                        <div className="bg-surface w-full max-w-md rounded-2xl border border-surfaceHighlight shadow-2xl overflow-hidden flex flex-col max-h-[400px]">
                            <div className="p-4 border-b border-surfaceHighlight flex justify-between items-center bg-background/50">
                                <h4 className="text-sm font-black uppercase text-text flex items-center gap-2">
                                    <History size={16} className="text-primary"/> Historial de Precios
                                </h4>
                                <button onClick={() => setHistoryModalOpen(false)} className="p-1 hover:bg-surfaceHighlight rounded-full"><X size={18}/></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2">
                                {historyLoading ? (
                                    <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-primary" size={24}/></div>
                                ) : historyItems.length === 0 ? (
                                    <div className="py-10 text-center text-[10px] font-bold text-muted uppercase">No hay historial previo para este producto.</div>
                                ) : (
                                    <div className="flex flex-col gap-1">
                                        {historyItems.map((h, idx) => (
                                            <button 
                                                key={idx} 
                                                onClick={() => applyHistoryPrice(h.unit_price)}
                                                className="flex items-center justify-between p-3 hover:bg-primary/5 rounded-xl border border-transparent hover:border-primary/20 transition-all group text-left"
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-muted uppercase flex items-center gap-1">
                                                        <Clock size={10}/> {new Date(h.created_at || h.orders?.created_at).toLocaleDateString()}
                                                    </span>
                                                    <span className="text-xs font-bold text-text">Ref: {h.orders?.display_id || 'S/D'}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-sm font-black text-green-600 group-hover:scale-110 transition-transform block">
                                                        $ {h.unit_price.toLocaleString('es-AR')}
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const TransactionDetailModal: React.FC<{ movement: AccountMovement, onClose: () => void }> = ({ movement, onClose }) => {
    const [items, setItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchItems = async () => {
            if (!movement.order_id) return;
            try {
                const { data } = await supabase
                    .from('order_items')
                    .select('*')
                    .eq('order_id', movement.order_id);
                
                if (data) setItems(data);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchItems();
    }, [movement.order_id]);

    const isCreditNote = movement.credit > 0;
    const amount = isCreditNote ? movement.credit : movement.debit;
    const colorClass = isCreditNote ? 'text-green-600' : 'text-red-500';
    const bgClass = isCreditNote ? 'bg-green-500/10' : 'bg-red-500/10';

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-background w-full max-w-2xl rounded-3xl border border-surfaceHighlight shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
                <div className="p-6 border-b border-surfaceHighlight bg-surface flex justify-between items-center">
                    <div>
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase mb-1 ${bgClass} ${colorClass}`}>
                            {isCreditNote ? <FileMinus size={12}/> : <FilePlus size={12}/>}
                            {isCreditNote ? 'Nota de Crédito' : 'Factura'}
                        </div>
                        <h3 className="text-xl font-black text-text uppercase italic tracking-tight">Detalle de Operación</h3>
                        <p className="text-[10px] text-muted font-bold uppercase">{new Date(movement.date).toLocaleDateString()} — REF: {movement.concept}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-surfaceHighlight rounded-full text-muted transition-colors"><X size={24}/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-0">
                    <table className="w-full text-left">
                        <thead className="bg-background/50 text-[10px] text-muted uppercase font-black tracking-widest border-b border-surfaceHighlight sticky top-0 backdrop-blur-md">
                            <tr>
                                <th className="p-4 pl-6">Artículo</th>
                                <th className="p-4 text-center">Cant.</th>
                                <th className="p-4 text-right">P. Unit</th>
                                <th className="p-4 text-right pr-6">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surfaceHighlight">
                            {isLoading ? (
                                <tr><td colSpan={4} className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-primary"/></td></tr>
                            ) : items.length === 0 ? (
                                <tr><td colSpan={4} className="p-10 text-center text-muted font-bold italic uppercase">Sin items registrados</td></tr>
                            ) : items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-background/50 transition-colors">
                                    <td className="p-4 pl-6">
                                        <p className="text-xs font-black text-text uppercase">{item.name}</p>
                                        <p className="text-[9px] font-mono text-muted">#{item.code}</p>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="text-xs font-bold text-text">{item.quantity}</span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className="text-xs text-muted">$ {item.unit_price.toLocaleString('es-AR')}</span>
                                    </td>
                                    <td className="p-4 text-right pr-6">
                                        <span className="text-xs font-black text-text">$ {item.subtotal.toLocaleString('es-AR')}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-6 bg-surface border-t border-surfaceHighlight flex justify-between items-center">
                    <span className="text-xs font-black text-muted uppercase tracking-widest">Total Operación</span>
                    <span className={`text-2xl font-black tracking-tighter ${colorClass}`}>$ {amount.toLocaleString('es-AR')}</span>
                </div>
            </div>
        </div>
    );
};
