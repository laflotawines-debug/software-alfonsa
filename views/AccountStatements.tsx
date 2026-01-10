
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Search, 
    FileText, 
    FileSpreadsheet, 
    Mail, 
    X, 
    Loader2, 
    User as UserIcon, 
    Check, 
    CreditCard,
    ArrowDownToLine,
    LogOut,
    CheckCircle2,
    Eye,
    ChevronDown,
    Activity,
    BookOpen
} from 'lucide-react';
import { supabase } from '../supabase';
import { ClientMaster, AccountMovement } from '../types';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

export const AccountStatements: React.FC = () => {
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
    const [sendByEmail, setSendByEmail] = useState(true);

    // MOCK DATA: Simulación de movimientos para la UI
    const mockMovements: AccountMovement[] = [
        { id: '1', date: '--/--/----', concept: 'Saldo Anterior', debit: 0, credit: 0, balance: 0, observations: 'Arranque de período' },
        { id: '2', date: '24/12/2020', concept: 'Factura <C> 0004-00000095', debit: 1120.00, credit: 0, balance: 1120.00, observations: 'Contado (Pendiente: no cobrado)' },
        { id: '3', date: '31/12/2020', concept: 'Factura <C> 0003-0001691', debit: 1490.00, credit: 0, balance: 2610.00, observations: 'Contado (Pendiente: no cobrado)' },
        { id: '4', date: '21/01/2021', concept: 'Recibo <X> 0001-00002056 (Anticipo)', debit: 0, credit: 3500.00, balance: 2650.00, observations: 'Pago a cuenta' },
        { id: '5', date: '02/02/2021', concept: 'Factura <C> 0001-00019003', debit: 680.00, credit: 0, balance: 4300.00, observations: 'Contado (Pendiente: no cobrado)' },
        { id: '6', date: '03/03/2021', concept: 'Factura <C> 0001-00019640', debit: 520.00, credit: 0, balance: 2360.00, observations: 'Contado (Pendiente: no cobrado)' },
    ];

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
            // Lógica de búsqueda tipo Google
            const words = trimmed.split(/\s+/).filter(w => w.length > 0);
            let query = supabase.from('clients_master').select('*');
            
            words.forEach(word => {
                query = query.ilike('nombre', `%${word}%`);
            });

            const { data } = await query.limit(6);
            setSearchResults(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearching(false);
        }
    };

    const selectClient = (client: ClientMaster) => {
        setSelectedClient(client);
        setClientSearch(client.nombre);
        setShowDropdown(false);
        // Simulamos carga de datos
        setIsLoadingData(true);
        setTimeout(() => {
            setMovements(mockMovements);
            setIsLoadingData(false);
        }, 600);
    };

    const totalBalance = useMemo(() => {
        if (movements.length === 0) return 0;
        return movements[movements.length - 1].balance;
    }, [movements]);

    const handleExportExcel = () => {
        if (!selectedClient) return;
        const data = movements.map(m => ({
            'Fecha': m.date,
            'Concepto': m.concept,
            'Debe': m.debit || '-',
            'Haber': m.credit || '-',
            'Saldo': m.balance,
            'Observaciones': m.observations
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
        doc.text(`Teléfono: ${selectedClient.celular || 'S/D'}`, 20, 36);
        
        let y = 50;
        doc.setFont('helvetica', 'bold');
        doc.text('FECHA', 20, y);
        doc.text('CONCEPTO', 45, y);
        doc.text('SALDO', 180, y, { align: 'right' });
        
        y += 5;
        doc.line(20, y, 190, y);
        y += 7;
        doc.setFont('helvetica', 'normal');
        
        movements.forEach(m => {
            doc.text(m.date, 20, y);
            doc.text(m.concept.substring(0, 40), 45, y);
            doc.text(m.balance.toLocaleString('es-AR', { minimumFractionDigits: 2 }), 180, y, { align: 'right' });
            y += 7;
            if (y > 270) { doc.addPage(); y = 20; }
        });
        
        doc.save(`EstadoCuenta_${selectedClient.codigo}.pdf`);
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
                                <p className="text-xs font-bold text-muted flex items-center gap-1"><Activity size={12}/> {selectedClient.celular || '+54 11 4567-8901'}</p>
                            </div>
                        )}
                    </div>
                </div>

                {selectedClient && (
                    <div className="bg-surface border border-surfaceHighlight rounded-2xl p-4 flex items-center gap-6 shadow-sm animate-in zoom-in-95">
                        <div className="text-right">
                            <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Saldo Total</p>
                            <p className="text-3xl font-black text-primary tracking-tighter">
                                $ {totalBalance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div className="h-10 w-px bg-surfaceHighlight"></div>
                        <button className="p-2 text-muted hover:text-primary transition-colors">
                            <CheckCircle2 size={24} />
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
                            placeholder="Ej: Alfa Suarez..." 
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
                                        <th className="p-4 text-xs font-black uppercase tracking-widest pr-8">Observaciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surfaceHighlight">
                                    {isLoadingData ? (
                                        <tr><td colSpan={6} className="p-20 text-center"><Loader2 size={48} className="animate-spin text-primary mx-auto" /></td></tr>
                                    ) : movements.map((m, idx) => (
                                        <tr key={m.id} className="hover:bg-background/40 transition-colors group">
                                            <td className="p-4 pl-8 text-xs font-bold text-muted group-hover:text-text">{m.date}</td>
                                            <td className="p-4 text-sm font-bold text-text uppercase">{m.concept}</td>
                                            <td className="p-4 text-right text-sm font-black text-red-500/80">
                                                {m.debit > 0 ? m.debit.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '-'}
                                            </td>
                                            <td className="p-4 text-right text-sm font-black text-green-600">
                                                {m.credit > 0 ? m.credit.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '-'}
                                            </td>
                                            <td className="p-4 text-right text-sm font-black text-text">
                                                {m.balance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-4 pr-8 text-[11px] font-medium text-muted uppercase italic">{m.observations}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 bg-background/50 border-t border-surfaceHighlight flex justify-between items-center px-8">
                             <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Montos expresados en Pesos Argentinos (ARS)</p>
                             <p className="text-[10px] font-bold text-muted flex items-center gap-2">
                                <CheckCircle2 size={14} className="text-primary" /> Clic derecho sobre factura para ver recibos asociados
                             </p>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <button 
                                onClick={handleGeneratePDF}
                                className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-primary hover:bg-primaryHover text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95"
                            >
                                <FileText size={18} /> Emitir Resumen Completo
                            </button>
                            <button className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-surface border border-surfaceHighlight text-text hover:bg-surfaceHighlight font-black text-xs uppercase transition-all">
                                <ArrowDownToLine size={18} /> Última Hoja
                            </button>
                            <button 
                                onClick={handleExportExcel}
                                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                            >
                                <FileSpreadsheet size={18} /> Excel
                            </button>
                        </div>

                        <div className="flex items-center gap-6">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div 
                                    onClick={() => setSendByEmail(!sendByEmail)}
                                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${sendByEmail ? 'bg-primary border-primary' : 'border-surfaceHighlight bg-surface'}`}
                                >
                                    {sendByEmail && <Check size={16} className="text-white" />}
                                </div>
                                <span className="text-xs font-black text-text uppercase tracking-widest group-hover:text-primary transition-colors">Enviar resumen por mail al cliente</span>
                            </label>
                            <div className="h-8 w-px bg-surfaceHighlight hidden md:block"></div>
                            <button 
                                onClick={() => { setSelectedClient(null); setMovements([]); }}
                                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-slate-900 text-white hover:bg-black font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95"
                            >
                                Terminar <LogOut size={18} className="rotate-180" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
