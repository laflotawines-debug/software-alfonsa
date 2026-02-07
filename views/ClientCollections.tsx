
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Search, 
    RefreshCw, 
    Loader2, 
    Wallet,
    X,
    Save,
    Plus,
    Trash2,
    History,
    CheckCircle2,
    AlertCircle,
    Building2,
    ArrowRight,
    Check
} from 'lucide-react';
import { supabase } from '../supabase';
import { ClientMaster, User, ClientCollection, SupplierMaster } from '../types';

interface ClientCollectionsProps {
    currentUser: User;
}

export const ClientCollections: React.FC<ClientCollectionsProps> = ({ currentUser }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<ClientMaster[]>([]);
    const [selectedClient, setSelectedClient] = useState<ClientMaster | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [history, setHistory] = useState<ClientCollection[]>([]);
    const [currentBalance, setCurrentBalance] = useState(0);
    
    // Estados para nuevo pago
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Estados para Pago a Proveedor (Triangulación)
    const [isDirectPayment, setIsDirectPayment] = useState(false);
    const [suppliers, setSuppliers] = useState<SupplierMaster[]>([]);
    const [targetSupplierCode, setTargetSupplierCode] = useState('');

    const dropdownRef = useRef<HTMLDivElement>(null);

    // Cerrar dropdown al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setSearchResults([]);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Cargar proveedores al iniciar
    useEffect(() => {
        const loadSuppliers = async () => {
            const { data } = await supabase.from('providers_master').select('*').eq('activo', true).order('razon_social');
            if (data) setSuppliers(data);
        };
        loadSuppliers();
    }, []);

    const handleSearch = async (val: string) => {
        setSearchTerm(val);
        const trimmed = val.trim();
        if (trimmed.length < 2) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const words = trimmed.split(/\s+/).filter(w => w.length > 0);
            let query = supabase.from('clients_master').select('*');
            
            // Búsqueda tipo Google: cada palabra debe coincidir en nombre o código
            words.forEach(word => {
                query = query.or(`nombre.ilike.%${word}%,codigo.ilike.%${word}%`);
            });

            const { data, error } = await query.limit(8);

            if (error) throw error;
            setSearchResults(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    };

    const fetchBalance = async (clientCode: string) => {
        try {
            const { data, error } = await supabase
                .from('client_account_movements')
                .select('debit, credit, is_annulled')
                .eq('client_code', clientCode);
            
            if (error) throw error;

            if (data) {
                const bal = data.reduce((acc, m) => {
                    if (m.is_annulled) return acc;
                    return acc + (Number(m.debit) || 0) - (Number(m.credit) || 0);
                }, 0);
                setCurrentBalance(bal);
            }
        } catch (e) {
            console.error("Error fetching balance:", e);
        }
    };

    const selectClient = async (client: ClientMaster) => {
        setSelectedClient(client);
        setSearchTerm(client.nombre); // Poner nombre en buscador
        setSearchResults([]); // Ocultar dropdown
        
        // Reset form
        setAmount('');
        setNotes('');
        setIsDirectPayment(false);
        setTargetSupplierCode('');
        setDate(new Date().toISOString().split('T')[0]);

        await fetchHistory(client.codigo);
        await fetchBalance(client.codigo);
    };

    const fetchHistory = async (clientCode: string) => {
        setIsLoadingData(true);
        try {
            const { data, error } = await supabase
                .from('client_collections')
                .select('*')
                .eq('client_code', clientCode)
                .order('date', { ascending: false });
            
            if (error) throw error;
            setHistory(data || []);
        } catch (err: any) {
            console.error("Error cargando historial:", err);
        } finally {
            setIsLoadingData(false);
        }
    };

    const handleSave = async () => {
        if (!selectedClient) return;
        const val = parseFloat(amount);
        if (!val || val <= 0) return alert("Ingrese un monto válido");
        
        // Validación extra si es pago a proveedor
        if (isDirectPayment && !targetSupplierCode) {
            return alert("Seleccione el proveedor al cual se destina el pago.");
        }
        
        setIsSaving(true);
        try {
            // Determinar notas finales
            const supplierName = suppliers.find(s => s.codigo === targetSupplierCode)?.razon_social;
            const finalNotes = isDirectPayment 
                ? `PAGO DIRECTO A PROVEEDOR: ${supplierName}. ${notes}` 
                : notes;

            // 1. Guardar Cobranza (Log) en Cliente
            const { data: collection, error } = await supabase.from('client_collections').insert({
                client_code: selectedClient.codigo,
                amount: val,
                date: date,
                notes: finalNotes,
                created_by: currentUser.id
            }).select().single();
            if (error) throw error;
            
            // 2. Insertar movimiento de CRÉDITO (Haber) en Cuenta Corriente Cliente
            await supabase.from('client_account_movements').insert({
                client_code: selectedClient.codigo,
                date: date,
                concept: isDirectPayment ? `Pago Directo a Prov. ${supplierName}` : `Cobranza / Entrega`,
                debit: 0,
                credit: val,
                collection_id: collection.id,
                created_by: currentUser.id
            });

            // 3. (OPCIONAL) Si es pago directo, impactar en la cuenta del proveedor también
            if (isDirectPayment && targetSupplierCode) {
                await supabase.from('provider_account_movements').insert({
                    provider_code: targetSupplierCode,
                    date: date,
                    concept: `PAGO DIRECTO DE CLIENTE: ${selectedClient.nombre}`,
                    debit: 0, 
                    credit: val, // Credit en proveedor = Pago que hacemos (baja deuda)
                    created_by: currentUser.id
                });
            }

            setAmount('');
            setNotes('');
            setIsDirectPayment(false);
            setTargetSupplierCode('');
            
            // Refrescar historial y saldo
            await fetchHistory(selectedClient.codigo);
            await fetchBalance(selectedClient.codigo);
        } catch (e: any) {
            alert("Error al guardar: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Anular este registro de cobranza? Nota: Si fue un pago a proveedor, deberá anular manualmente el movimiento en la cuenta del proveedor para mantener la consistencia.")) return;
        try {
            // Eliminar movimiento de cuenta asociado
            await supabase.from('client_account_movements').delete().eq('collection_id', id);
            // Eliminar cobranza
            const { error } = await supabase.from('client_collections').delete().eq('id', id);
            if (error) throw error;
            if (selectedClient) {
                await fetchHistory(selectedClient.codigo);
                await fetchBalance(selectedClient.codigo);
            }
        } catch (e: any) {
            alert("Error al anular: " + e.message);
        }
    };

    return (
        <div className="flex flex-col gap-6 pb-20 animate-in fade-in duration-500 max-w-5xl mx-auto w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight flex items-center gap-3 uppercase italic">
                        <Wallet className="text-primary" size={32} />
                        Cobranzas
                    </h2>
                    <p className="text-muted text-sm mt-1 font-medium italic">Registro de pagos y abonos de clientes.</p>
                </div>
            </div>

            {/* SECCIÓN DE BÚSQUEDA */}
            <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm relative z-20" ref={dropdownRef}>
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 mb-2 block">Buscar Cliente</label>
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
                    <input 
                        type="text" 
                        placeholder="Nombre o Código..." 
                        value={searchTerm}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary transition-all shadow-inner uppercase"
                    />
                    {isSearching && <div className="absolute right-4 top-1/2 -translate-y-1/2"><Loader2 size={20} className="animate-spin text-primary"/></div>}
                </div>

                {/* Resultados Dropdown */}
                {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-surface border border-primary/20 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
                        {searchResults.map(client => (
                            <button 
                                key={client.codigo}
                                onClick={() => selectClient(client)}
                                className="w-full text-left p-4 hover:bg-primary/5 border-b border-surfaceHighlight last:border-none transition-colors group"
                            >
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-sm font-black text-text uppercase group-hover:text-primary">{client.nombre}</p>
                                        <p className="text-[10px] font-mono text-muted bg-surfaceHighlight/50 px-1.5 rounded w-fit mt-1">#{client.codigo}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-muted uppercase">{client.localidad}</p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* PANEL PRINCIPAL (Solo si hay cliente seleccionado) */}
            {selectedClient && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                    
                    {/* COLUMNA IZQ: FORMULARIO */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm">
                            <div className="mb-6 pb-4 border-b border-surfaceHighlight flex flex-row justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-black text-text uppercase italic leading-tight">{selectedClient.nombre}</h3>
                                    <p className="text-xs font-bold text-muted uppercase mt-1 flex items-center gap-2">
                                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">#{selectedClient.codigo}</span>
                                        {selectedClient.localidad}
                                    </p>
                                </div>
                                <div className="text-right bg-background/50 p-2 rounded-xl border border-surfaceHighlight">
                                    <p className="text-[9px] font-black text-muted uppercase tracking-widest">Saldo Actual</p>
                                    <p className={`text-xl font-black tracking-tighter ${currentBalance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                        $ {currentBalance.toLocaleString('es-AR')}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2 mb-4">
                                    <Plus size={14}/> Nuevo Pago
                                </h4>
                                
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-muted uppercase ml-1">Monto ($)</label>
                                    <input 
                                        type="number" 
                                        value={amount} 
                                        onChange={e => setAmount(e.target.value)} 
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl p-4 text-2xl font-black text-text outline-none focus:border-primary shadow-inner text-center" 
                                        placeholder="0.00" 
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-muted uppercase ml-1">Fecha</label>
                                    <input 
                                        type="date" 
                                        value={date} 
                                        onChange={e => setDate(e.target.value)} 
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl p-3 font-bold text-sm text-text outline-none focus:border-primary shadow-inner" 
                                    />
                                </div>

                                {/* TOGGLE PAGO A PROVEEDOR */}
                                <div 
                                    onClick={() => setIsDirectPayment(!isDirectPayment)}
                                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${isDirectPayment ? 'bg-indigo-500/5 border-indigo-500' : 'bg-background border-surfaceHighlight hover:border-indigo-500/50'}`}
                                >
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isDirectPayment ? 'bg-indigo-500 border-indigo-500' : 'border-muted'}`}>
                                        {isDirectPayment && <Check size={12} className="text-white"/>}
                                    </div>
                                    <div className="flex-1">
                                        <p className={`text-xs font-black uppercase ${isDirectPayment ? 'text-indigo-600' : 'text-muted'}`}>Paga a Proveedor</p>
                                        <p className="text-[9px] font-bold text-muted uppercase leading-tight">Triangular: Cobro a cliente y pago a proveedor simultáneo.</p>
                                    </div>
                                </div>

                                {isDirectPayment && (
                                    <div className="space-y-1 animate-in slide-in-from-top-2">
                                        <label className="text-[9px] font-black text-indigo-600 uppercase ml-1 flex items-center gap-1"><Building2 size={10}/> Seleccionar Proveedor Destino</label>
                                        <select 
                                            value={targetSupplierCode} 
                                            onChange={(e) => setTargetSupplierCode(e.target.value)} 
                                            className="w-full bg-indigo-500/5 border border-indigo-500/30 rounded-xl p-3 text-sm font-bold text-text outline-none focus:border-indigo-500 uppercase cursor-pointer"
                                        >
                                            <option value="">-- SELECCIONAR --</option>
                                            {suppliers.map(s => (
                                                <option key={s.codigo} value={s.codigo}>{s.razon_social}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-muted uppercase ml-1">Observaciones</label>
                                    <textarea 
                                        value={notes} 
                                        onChange={e => setNotes(e.target.value)} 
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl p-3 text-sm font-medium text-text outline-none focus:border-primary shadow-inner h-24 resize-none" 
                                        placeholder="Opcional..." 
                                    />
                                </div>

                                <button 
                                    onClick={handleSave} 
                                    disabled={isSaving || !amount} 
                                    className={`w-full py-4 font-black rounded-2xl uppercase text-xs shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${isDirectPayment ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20' : 'bg-primary hover:bg-primaryHover text-white shadow-primary/20'}`}
                                >
                                    {isSaving ? <Loader2 size={18} className="animate-spin"/> : isDirectPayment ? <ArrowRight size={18}/> : <Save size={18}/>} 
                                    {isDirectPayment ? 'Confirmar Pago Directo' : 'Registrar Cobro'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* COLUMNA DER: HISTORIAL */}
                    <div className="lg:col-span-7">
                        <div className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm flex flex-col h-full min-h-[400px]">
                            <div className="p-6 border-b border-surfaceHighlight bg-background/30 flex justify-between items-center">
                                <h3 className="text-sm font-black text-text uppercase tracking-widest flex items-center gap-2">
                                    <History size={16} className="text-primary"/> Historial de Cobros
                                </h3>
                                <button onClick={() => fetchHistory(selectedClient.codigo)} className="p-2 hover:bg-surfaceHighlight rounded-full text-muted transition-colors">
                                    <RefreshCw size={16} className={isLoadingData ? 'animate-spin' : ''}/>
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background/50">
                                {isLoadingData ? (
                                    <div className="h-full flex items-center justify-center">
                                        <Loader2 className="animate-spin text-primary" size={32} />
                                    </div>
                                ) : history.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center opacity-40 text-center">
                                        <AlertCircle size={48} className="mb-4 text-muted" />
                                        <p className="text-xs font-bold text-muted uppercase">Sin registros</p>
                                    </div>
                                ) : (
                                    history.map(item => (
                                        <div key={item.id} className="bg-surface border border-surfaceHighlight p-4 rounded-2xl flex justify-between items-center group hover:border-primary/30 transition-all shadow-sm">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg font-black text-green-600">$ {item.amount.toLocaleString('es-AR')}</span>
                                                    <span className="text-[9px] font-bold text-muted bg-surfaceHighlight px-2 py-0.5 rounded uppercase">{new Date(item.date).toLocaleDateString()}</span>
                                                </div>
                                                {item.notes && <p className="text-[10px] text-muted italic flex items-center gap-1"><AlertCircle size={10}/> {item.notes}</p>}
                                            </div>
                                            <button 
                                                onClick={() => handleDelete(item.id)} 
                                                className="p-2 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-50 group-hover:opacity-100" 
                                                title="Anular Registro"
                                            >
                                                <Trash2 size={18}/>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};
