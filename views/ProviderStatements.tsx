
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Search, 
    FileText, 
    FileSpreadsheet, 
    X, 
    Loader2, 
    Truck, 
    Check, 
    BookOpen,
    Ban,
    Trash2,
    Plus,
    FilePlus,
    FileMinus,
    Save,
    History,
    CheckCircle2,
    Activity,
    LogOut,
    Building2,
    ArrowDownRight,
    ArrowUpRight
} from 'lucide-react';
import { supabase } from '../supabase';
import { SupplierMaster, ProviderAccountMovement, User } from '../types';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

export const ProviderStatements: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    // --- ESTADOS DE BÚSQUEDA ---
    const [providerSearch, setProviderSearch] = useState('');
    const [searchResults, setSearchResults] = useState<SupplierMaster[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<SupplierMaster | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // --- ESTADOS DE DATOS ---
    const [movements, setMovements] = useState<ProviderAccountMovement[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{ id: string, type: 'delete' | 'annul' } | null>(null);

    // --- ESTADO MODAL NUEVA OPERACIÓN ---
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

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
        setProviderSearch(val);
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
            let query = supabase.from('providers_master').select('*');
            
            words.forEach(word => {
                query = query.or(`razon_social.ilike.%${word}%,codigo.ilike.%${word}%`);
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

    const fetchMovements = async (providerCode: string) => {
        setIsLoadingData(true);
        try {
            const { data, error } = await supabase
                .from('provider_account_movements')
                .select('*')
                .eq('provider_code', providerCode)
                .order('date', { ascending: true }) // Orden cronológico
                .order('created_at', { ascending: true });

            if (error) throw error;

            if (data) {
                let runningBalance = 0;
                const calculatedMovements = data.map(m => {
                    const isAnnulled = m.is_annulled === true;
                    // Lógica Proveedor:
                    // Debit = Deuda que generamos (Factura de compra) -> Suma al saldo (Debemos más)
                    // Credit = Pago que hacemos -> Resta al saldo (Debemos menos)
                    const debit = isAnnulled ? 0 : (Number(m.debit) || 0);
                    const credit = isAnnulled ? 0 : (Number(m.credit) || 0);
                    
                    runningBalance = runningBalance + debit - credit;
                    
                    return {
                        ...m,
                        balance: runningBalance 
                    };
                });
                // Mostrar más reciente primero visualmente
                setMovements(calculatedMovements.reverse());
            }
        } catch (err) {
            console.error("Error al cargar movimientos:", err);
        } finally {
            setIsLoadingData(false);
        }
    };

    const selectProvider = (provider: SupplierMaster) => {
        setSelectedProvider(provider);
        setProviderSearch(provider.razon_social);
        setShowDropdown(false);
        fetchMovements(provider.codigo);
    };

    const handleAction = async () => {
        if (!confirmAction || !selectedProvider) return;
        
        setIsLoadingData(true);
        try {
            if (confirmAction.type === 'delete') {
                const { error } = await supabase
                    .from('provider_account_movements')
                    .delete()
                    .eq('id', confirmAction.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('provider_account_movements')
                    .update({ is_annulled: true })
                    .eq('id', confirmAction.id);
                if (error) throw error;
            }
            
            await fetchMovements(selectedProvider.codigo);
            setConfirmAction(null);
        } catch (e: any) {
            alert("Error al procesar la acción: " + e.message);
        } finally {
            setIsLoadingData(false);
        }
    };

    const totalBalance = useMemo(() => {
        if (movements.length === 0) return 0;
        return movements[0].balance; // El primer elemento (invertido) tiene el saldo acumulado final
    }, [movements]);

    const handleExportExcel = () => {
        if (!selectedProvider) return;
        const data = movements.map(m => ({
            'Fecha': m.date,
            'Concepto': m.is_annulled ? `(ANULADO) ${m.concept}` : m.concept,
            'Factura (Debe)': m.is_annulled ? 0 : (m.debit || 0),
            'Pago (Haber)': m.is_annulled ? 0 : (m.credit || 0),
            'Saldo': m.balance,
            'Estado': m.is_annulled ? 'ANULADO' : 'ACTIVO'
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Cuenta Proveedor");
        XLSX.writeFile(wb, `EstadoProv_${selectedProvider.codigo}.xlsx`);
    };

    const handleGeneratePDF = () => {
        if (!selectedProvider) return;
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.setTextColor(228, 124, 0);
        doc.text('Estado de Cuenta Proveedor', 20, 20);
        doc.setFontSize(10);
        doc.setTextColor(50);
        doc.text(`Proveedor: ${selectedProvider.codigo} - ${selectedProvider.razon_social}`, 20, 30);
        doc.text(`Fecha Emisión: ${new Date().toLocaleDateString()}`, 20, 36);
        
        let y = 50;
        doc.setFont('helvetica', 'bold');
        doc.text('FECHA', 20, y);
        doc.text('CONCEPTO', 45, y);
        doc.text('COMPRA', 130, y, { align: 'right' });
        doc.text('PAGO', 160, y, { align: 'right' });
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
        
        doc.save(`EstadoProv_${selectedProvider.codigo}.pdf`);
    };

    const handleTransactionSuccess = () => {
        setIsTransactionModalOpen(false);
        if (selectedProvider) fetchMovements(selectedProvider.codigo);
    };

    return (
        <div className="flex flex-col gap-6 pb-20 animate-in fade-in duration-500 max-w-7xl mx-auto w-full">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary rounded-2xl text-white shadow-lg shadow-primary/20">
                        <Building2 size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-text tracking-tight uppercase italic leading-none">Cuentas Proveedores</h2>
                        {selectedProvider && (
                            <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-1">
                                <p className="text-sm font-black text-primary uppercase tracking-widest">{selectedProvider.codigo} - {selectedProvider.razon_social}</p>
                                {selectedProvider.activo ? 
                                    <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">ACTIVO</span> : 
                                    <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">INACTIVO</span>
                                }
                            </div>
                        )}
                    </div>
                </div>

                {selectedProvider && (
                    <div className="flex items-center gap-4">
                        <div className="bg-surface border border-surfaceHighlight rounded-2xl p-4 flex items-center gap-6 shadow-sm animate-in zoom-in-95">
                            <div className="text-right">
                                <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Deuda Actual</p>
                                <p className={`text-3xl font-black tracking-tighter ${totalBalance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                    $ {totalBalance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                            <div className="h-10 w-px bg-surfaceHighlight"></div>
                            <button onClick={() => fetchMovements(selectedProvider.codigo)} className="p-2 text-muted hover:text-primary transition-colors">
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

            {!selectedProvider ? (
                <div className="bg-surface border border-surfaceHighlight rounded-3xl p-10 shadow-sm flex flex-col items-center justify-center gap-6 text-center animate-in fade-in">
                    <div className="p-5 bg-background rounded-full text-muted mb-2">
                        <Truck size={48} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-text uppercase">Seleccionar Proveedor</h3>
                        <p className="text-muted text-sm mt-1">Busque el proveedor por razón social o código.</p>
                    </div>
                    <div className="w-full max-w-lg relative" ref={dropdownRef}>
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
                        <input 
                            type="text" 
                            placeholder="Razón Social o Código..." 
                            value={providerSearch}
                            onChange={(e) => handleSearch(e.target.value)}
                            onFocus={() => providerSearch.length >= 2 && setShowDropdown(true)}
                            className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:border-primary transition-all shadow-inner uppercase"
                        />
                        {isSearching && <div className="absolute right-4 top-1/2 -translate-y-1/2"><Loader2 size={18} className="animate-spin text-primary"/></div>}
                        
                        {showDropdown && (
                            <div className="absolute top-full left-0 w-full bg-surface border border-primary/30 rounded-2xl shadow-2xl mt-2 z-50 overflow-hidden animate-in slide-in-from-top-2">
                                {searchResults.length > 0 ? (
                                    <div className="flex flex-col">
                                        {searchResults.map((p) => (
                                            <button 
                                                key={p.codigo} 
                                                onClick={() => selectProvider(p)}
                                                className="w-full p-4 hover:bg-primary/5 text-left border-b border-surfaceHighlight last:border-none flex justify-between items-center group transition-colors"
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-text group-hover:text-primary transition-colors uppercase">{p.razon_social}</span>
                                                    <span className="text-[9px] font-mono text-muted bg-surfaceHighlight px-1.5 rounded w-fit mt-0.5">#{p.codigo}</span>
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
                                    <tr className="bg-slate-900 text-white">
                                        <th className="p-4 text-xs font-black uppercase tracking-widest pl-8">Fecha</th>
                                        <th className="p-4 text-xs font-black uppercase tracking-widest">Concepto</th>
                                        <th className="p-4 text-xs font-black uppercase tracking-widest text-right">Compra (Debe)</th>
                                        <th className="p-4 text-xs font-black uppercase tracking-widest text-right">Pago (Haber)</th>
                                        <th className="p-4 text-xs font-black uppercase tracking-widest text-right">Saldo</th>
                                        <th className="p-4 text-xs font-black uppercase tracking-widest text-center pr-8 w-24">Acción</th>
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
                                onClick={() => { setSelectedProvider(null); setMovements([]); }}
                                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-slate-900 text-white hover:bg-black font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95"
                            >
                                Cerrar Proveedor <LogOut size={18} className="rotate-180" />
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

            {/* TRANSACTION MODAL */}
            {isTransactionModalOpen && selectedProvider && (
                <TransactionModal 
                    provider={selectedProvider} 
                    onClose={() => setIsTransactionModalOpen(false)}
                    onSuccess={handleTransactionSuccess}
                    currentUser={currentUser}
                />
            )}
        </div>
    );
};

// --- TRANSACTION MODAL COMPONENT (Provider) ---
interface TransactionModalProps {
    provider: SupplierMaster;
    onClose: () => void;
    onSuccess: () => void;
    currentUser: User;
}

const TransactionModal: React.FC<TransactionModalProps> = ({ provider, onClose, onSuccess, currentUser }) => {
    const [type, setType] = useState<'invoice' | 'payment'>('invoice'); // invoice = Compra (Deuda), payment = Pago (Salida)
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [concept, setConcept] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        const val = parseFloat(amount);
        if (!val || val <= 0) return alert("Ingrese un monto válido");
        if (!concept) return alert("Ingrese un concepto o referencia");

        setIsSaving(true);
        try {
            const movementData = {
                provider_code: provider.codigo,
                date: date,
                concept: concept.toUpperCase(),
                debit: type === 'invoice' ? val : 0, // Compra aumenta deuda
                credit: type === 'payment' ? val : 0, // Pago disminuye deuda
                created_by: currentUser.id
            };

            const { error } = await supabase.from('provider_account_movements').insert(movementData);
            if (error) throw error;

            onSuccess();
        } catch (e: any) {
            alert("Error al guardar: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-background w-full max-w-lg rounded-3xl border border-surfaceHighlight shadow-2xl flex flex-col overflow-hidden relative">
                <div className="p-6 border-b border-surfaceHighlight bg-surface flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-xl font-black text-text uppercase italic tracking-tight flex items-center gap-2">
                            {type === 'invoice' ? <ArrowDownRight size={24} className="text-red-500"/> : <ArrowUpRight size={24} className="text-green-500"/>}
                            {type === 'invoice' ? 'Nueva Compra / Factura' : 'Nuevo Pago / Salida'}
                        </h3>
                        <p className="text-xs font-bold text-muted uppercase mt-1">{provider.razon_social}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-surfaceHighlight rounded-full text-muted transition-colors"><X size={24}/></button>
                </div>

                <div className="p-8 space-y-6">
                    <div className="flex bg-surface p-1 rounded-xl border border-surfaceHighlight">
                        <button onClick={() => setType('invoice')} className={`flex-1 py-3 rounded-lg text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${type === 'invoice' ? 'bg-red-500 text-white shadow-md' : 'text-muted hover:text-text'}`}>
                            <ArrowDownRight size={14}/> Compra (Genera Deuda)
                        </button>
                        <button onClick={() => setType('payment')} className={`flex-1 py-3 rounded-lg text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${type === 'payment' ? 'bg-green-600 text-white shadow-md' : 'text-muted hover:text-text'}`}>
                            <ArrowUpRight size={14}/> Pago (Baja Deuda)
                        </button>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Fecha</label>
                        <input 
                            type="date" 
                            value={date} 
                            onChange={e => setDate(e.target.value)} 
                            className="w-full bg-surface border border-surfaceHighlight rounded-xl p-4 font-bold text-sm text-text outline-none focus:border-primary shadow-inner" 
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Concepto / Referencia</label>
                        <input 
                            type="text" 
                            placeholder="Ej: FAC-A 0001-2345 o PAGO EFECTIVO" 
                            value={concept} 
                            onChange={e => setConcept(e.target.value)} 
                            className="w-full bg-surface border border-surfaceHighlight rounded-xl p-4 font-bold text-sm text-text outline-none focus:border-primary shadow-inner uppercase" 
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Monto ($)</label>
                        <input 
                            type="number" 
                            value={amount} 
                            onChange={e => setAmount(e.target.value)} 
                            className={`w-full bg-surface border border-surfaceHighlight rounded-xl p-4 text-3xl font-black outline-none focus:border-primary shadow-inner text-center ${type === 'invoice' ? 'text-red-500' : 'text-green-600'}`} 
                            placeholder="0.00" 
                        />
                    </div>
                </div>

                <div className="p-6 bg-surface border-t border-surfaceHighlight flex gap-4">
                    <button onClick={onClose} className="flex-1 py-4 font-black uppercase text-xs text-muted hover:bg-surfaceHighlight rounded-2xl border border-surfaceHighlight transition-all">Cancelar</button>
                    <button onClick={handleSave} disabled={isSaving || !amount} className={`flex-[2] py-4 rounded-2xl font-black uppercase text-xs shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 ${isSaving || !amount ? 'bg-surfaceHighlight text-muted cursor-not-allowed' : 'bg-primary text-white hover:bg-primaryHover'}`}>
                        {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Confirmar Operación
                    </button>
                </div>
            </div>
        </div>
    );
};
