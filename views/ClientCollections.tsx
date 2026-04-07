
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
    CheckCircle2,
    AlertCircle,
    Building2,
    ArrowRight,
    ArrowLeft,
    Check,
    User as UserIcon,
    Receipt,
    Banknote,
    Landmark,
    Calendar
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
    const [showReceipt, setShowReceipt] = useState<ClientCollection | null>(null);
    
    // Efectivo
    const [cashArs, setCashArs] = useState('');
    const [cashUsd, setCashUsd] = useState('');
    const exchangeRate = 1376.00;

    // Pago a Proveedor
    const [supplierPayment, setSupplierPayment] = useState('');
    const [targetSupplierCode, setTargetSupplierCode] = useState('');
    const [suppliers, setSuppliers] = useState<SupplierMaster[]>([]);
    const [notes, setNotes] = useState('');
    const [supplierNotes, setSupplierNotes] = useState('');

    const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
    const [supplierSearchResults, setSupplierSearchResults] = useState<SupplierMaster[]>([]);
    const [selectedSupplier, setSelectedSupplier] = useState<SupplierMaster | null>(null);
    const [isSearchingSupplier, setIsSearchingSupplier] = useState(false);
    const supplierDropdownRef = useRef<HTMLDivElement>(null);

    // Depósito / Transferencia
    const [transferAmount, setTransferAmount] = useState('');
    const [bankAccount, setBankAccount] = useState('');
    const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);

    const [isSaving, setIsSaving] = useState(false);

    // Cálculos
    const totalEfectivo = (parseFloat(cashArs) || 0) + ((parseFloat(cashUsd) || 0) * exchangeRate);
    const totalProveedor = parseFloat(supplierPayment) || 0;
    const totalPagado = totalEfectivo + totalProveedor;

    const dropdownRef = useRef<HTMLDivElement>(null);

    // Cerrar dropdown al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setSearchResults([]);
            }
            if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target as Node)) {
                setSupplierSearchResults([]);
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

    const handleSearchSupplier = async (val: string) => {
        setSupplierSearchTerm(val);
        if (selectedSupplier && val !== selectedSupplier.razon_social) {
            setSelectedSupplier(null);
        }
        
        const trimmed = val.trim();
        if (trimmed.length < 2) {
            setSupplierSearchResults([]);
            return;
        }

        setIsSearchingSupplier(true);
        try {
            const words = trimmed.split(/\s+/).filter(w => w.length > 0);
            let query = supabase.from('providers_master').select('*');
            
            words.forEach(word => {
                query = query.or(`razon_social.ilike.%${word}%,codigo.ilike.%${word}%`);
            });

            const { data, error } = await query.limit(8);

            if (error) throw error;
            setSupplierSearchResults(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSearchingSupplier(false);
        }
    };

    const selectSupplier = (supplier: SupplierMaster) => {
        setSelectedSupplier(supplier);
        setSupplierSearchTerm(supplier.razon_social);
        setSupplierSearchResults([]);
    };

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
            let query = supabase.from('clients_master').select('*').neq('activo', false);
            
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
        setCashArs('');
        setCashUsd('');
        setSupplierPayment('');
        setTargetSupplierCode('');
        setSupplierSearchTerm('');
        setSelectedSupplier(null);
        setNotes('');
        setSupplierNotes('');
        setTransferAmount('');
        setBankAccount('');
        setTransferDate(new Date().toISOString().split('T')[0]);

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
        const val = totalPagado;
        if (!val || val <= 0) return alert("Ingrese un monto válido");
        
        if (totalProveedor > 0 && !selectedSupplier) {
            return alert("Debe seleccionar un proveedor para el pago directo.");
        }

        setIsSaving(true);
        try {
            const cashNotes = [];
            if (cashArs && parseFloat(cashArs) > 0) cashNotes.push(`EFECTIVO ARS: $${parseFloat(cashArs).toLocaleString('es-AR')}`);
            if (cashUsd && parseFloat(cashUsd) > 0) cashNotes.push(`EFECTIVO USD: u$s${parseFloat(cashUsd).toLocaleString('es-AR')} (TC: ${exchangeRate})`);
            if (totalProveedor > 0 && selectedSupplier) {
                cashNotes.push(`PAGO A PROVEEDOR: $${totalProveedor.toLocaleString('es-AR')} (${selectedSupplier.razon_social})`);
            }
            
            const finalNotes = [notes, supplierNotes, ...cashNotes].filter(Boolean).join(' | ');

            // 1. Guardar Cobranza (Log) en Cliente
            const { data: collection, error } = await supabase.from('client_collections').insert({
                client_code: selectedClient.codigo,
                amount: val,
                date: new Date().toISOString().split('T')[0],
                notes: finalNotes,
                created_by: currentUser.id
            }).select().single();
            if (error) throw error;
            
            // 2. Insertar movimiento de CRÉDITO (Haber) en Cuenta Corriente Cliente
            let concept = 'Cobranza';
            if (totalEfectivo > 0 && totalProveedor > 0) concept = 'Cobranza Mixta (Efectivo + Proveedor)';
            else if (totalEfectivo > 0) concept = 'Cobranza Efectivo';
            else if (totalProveedor > 0) concept = `Pago Directo a Proveedor (${selectedSupplier?.razon_social})`;

            await supabase.from('client_account_movements').insert({
                client_code: selectedClient.codigo,
                date: new Date().toISOString().split('T')[0],
                concept: concept,
                debit: 0,
                credit: val,
                collection_id: collection.id,
                created_by: currentUser.id
            });

            // 3. Registrar Movimiento de Caja (Solo si hay efectivo)
            if (totalEfectivo > 0) {
                // Intentamos buscar el concepto "COBRANZA DE CLIENTES"
                const { data: conceptData } = await supabase
                    .from('cash_concepts')
                    .select('id')
                    .eq('name', 'COBRANZA DE CLIENTES')
                    .maybeSingle();

                await supabase.from('cash_movements').insert({
                    date: new Date().toISOString().split('T')[0],
                    concept_id: conceptData?.id || null,
                    type: 'ingreso',
                    amount_ars: parseFloat(cashArs) || 0,
                    amount_usd: parseFloat(cashUsd) || 0,
                    comments: `COBRANZA CLIENTE: ${selectedClient.nombre} (${selectedClient.codigo}). ${notes}`,
                    branch: 'Llerena', // Default branch
                    created_by: currentUser.id
                });
            }

            // 4. Registrar Movimiento en Cuenta Corriente Proveedor (Si hay pago a proveedor)
            if (totalProveedor > 0 && selectedSupplier) {
                await supabase.from('provider_account_movements').insert({
                    provider_code: selectedSupplier.codigo,
                    date: new Date().toISOString().split('T')[0],
                    concept: `Pago Directo de Cliente: ${selectedClient.nombre} (${selectedClient.codigo})`,
                    debit: 0,
                    credit: totalProveedor, // Credit decreases provider balance (we owe them less)
                    created_by: currentUser.id
                });
            }

            setCashArs('');
            setCashUsd('');
            setNotes('');
            setSupplierPayment('');
            setSupplierSearchTerm('');
            setSelectedSupplier(null);
            setSupplierNotes('');
            
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
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                    {/* TOP HEADER CARD */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Cliente</p>
                                <div className="flex items-center gap-2">
                                    <UserIcon size={16} className="text-gray-400" />
                                    <span className="font-bold text-gray-800 uppercase">{selectedClient.nombre}</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Comprobante</p>
                                <div className="flex items-center gap-2">
                                    <Receipt size={16} className="text-gray-400" />
                                    <span className="font-bold text-gray-800">Recibo #001-00234</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 min-w-[200px]">
                            <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider mb-1">Saldo Actual</p>
                            <div className="flex items-center gap-2">
                                <Wallet size={16} className="text-orange-500" />
                                <span className="text-lg font-black text-orange-600">
                                    {currentBalance < 0 ? 'A FAVOR: ' : 'DEUDA: '}
                                    $ {Math.abs(currentBalance).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* LEFT COLUMN */}
                        <div className="lg:col-span-8 space-y-6">
                            {/* EFECTIVO */}
                            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-orange-50/30">
                                    <h3 className="font-bold text-orange-600 flex items-center gap-2 uppercase text-sm tracking-wider">
                                        <Banknote size={18} /> Cobranza en Efectivo
                                    </h3>
                                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-3 py-1 shadow-sm">
                                        <RefreshCw size={12} className="text-orange-500" />
                                        <span className="text-[10px] font-bold text-gray-600 uppercase">TC: <strong className="text-gray-800">{exchangeRate.toFixed(2)}</strong></span>
                                    </div>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Efectivo en Pesos ($)</label>
                                            <div className="relative group">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold group-focus-within:text-orange-500 transition-colors">$</span>
                                                <input 
                                                    type="number" 
                                                    value={cashArs} 
                                                    onChange={e => setCashArs(e.target.value)} 
                                                    className="w-full pl-10 pr-4 py-4 border-2 border-gray-100 rounded-2xl text-lg font-black focus:outline-none focus:border-orange-500 transition-all bg-gray-50/50 focus:bg-white" 
                                                    placeholder="0.00" 
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Efectivo en Dólares (US$)</label>
                                            <div className="relative group">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold group-focus-within:text-orange-500 transition-colors">US$</span>
                                                <input 
                                                    type="number" 
                                                    value={cashUsd} 
                                                    onChange={e => setCashUsd(e.target.value)} 
                                                    className="w-full pl-14 pr-4 py-4 border-2 border-gray-100 rounded-2xl text-lg font-black focus:outline-none focus:border-orange-500 transition-all bg-gray-50/50 focus:bg-white" 
                                                    placeholder="0.00" 
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Observaciones / Notas</label>
                                        <textarea 
                                            value={notes} 
                                            onChange={e => setNotes(e.target.value)} 
                                            className="w-full px-4 py-4 border-2 border-gray-100 rounded-2xl text-sm font-medium focus:outline-none focus:border-orange-500 transition-all min-h-[100px] resize-none bg-gray-50/50 focus:bg-white" 
                                            placeholder="Detalles adicionales del pago..." 
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* PAGO DIRECTO A PROVEEDOR */}
                            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-orange-50/30">
                                    <h3 className="font-bold text-orange-600 flex items-center gap-2 uppercase text-sm tracking-wider">
                                        <Building2 size={18} /> Pago Directo a Proveedor
                                    </h3>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2 relative" ref={supplierDropdownRef}>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Seleccionar Proveedor</label>
                                            <div className="relative group">
                                                <input 
                                                    type="text" 
                                                    placeholder="- Buscar o seleccionar proveedor -" 
                                                    value={supplierSearchTerm}
                                                    onChange={(e) => handleSearchSupplier(e.target.value)}
                                                    className={`w-full px-4 py-4 border-2 rounded-2xl text-sm font-bold focus:outline-none transition-all bg-gray-50/50 focus:bg-white uppercase ${selectedSupplier ? 'border-green-500 text-green-700' : 'border-gray-100 focus:border-orange-500'}`}
                                                />
                                                {isSearchingSupplier && <div className="absolute right-4 top-1/2 -translate-y-1/2"><Loader2 size={16} className="animate-spin text-orange-500"/></div>}
                                                {selectedSupplier && !isSearchingSupplier && <Check className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500" size={16} />}
                                            </div>
                                            
                                            {/* Resultados Dropdown Proveedores */}
                                            {supplierSearchResults.length > 0 && (
                                                <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
                                                    {supplierSearchResults.map(supplier => (
                                                        <button 
                                                            key={supplier.codigo}
                                                            onClick={() => selectSupplier(supplier)}
                                                            className="w-full text-left p-4 hover:bg-orange-50 border-b border-gray-100 last:border-none transition-colors group"
                                                        >
                                                            <div className="flex justify-between items-center">
                                                                <div>
                                                                    <p className="text-sm font-black text-gray-800 uppercase group-hover:text-orange-600">{supplier.razon_social}</p>
                                                                    <p className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 rounded w-fit mt-1">#{supplier.codigo}</p>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Importe Pagado a Proveedor</label>
                                            <div className="relative group">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold group-focus-within:text-orange-500 transition-colors">$</span>
                                                <input 
                                                    type="number" 
                                                    value={supplierPayment} 
                                                    onChange={e => setSupplierPayment(e.target.value)} 
                                                    className="w-full pl-10 pr-4 py-4 border-2 border-gray-100 rounded-2xl text-lg font-black focus:outline-none focus:border-orange-500 transition-all bg-gray-50/50 focus:bg-white" 
                                                    placeholder="0.00" 
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Método de Pago</label>
                                        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 w-fit">
                                            <CheckCircle2 size={16} className="text-orange-500" />
                                            <span className="text-sm font-bold text-gray-800">Efectivo</span>
                                            <span className="text-xs text-gray-400 font-medium">(Única opción disponible para este pago)</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Observaciones del Pago</label>
                                        <textarea 
                                            value={supplierNotes} 
                                            onChange={e => setSupplierNotes(e.target.value)} 
                                            className="w-full px-4 py-4 border-2 border-gray-100 rounded-2xl text-sm font-medium focus:outline-none focus:border-orange-500 transition-all min-h-[100px] resize-none bg-gray-50/50 focus:bg-white" 
                                            placeholder="Detalles adicionales sobre el pago cruzado..." 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN (SUMMARY) */}
                        <div className="lg:col-span-4">
                            <div className="bg-white border border-gray-200 rounded-3xl shadow-xl overflow-hidden sticky top-6">
                                <div className="bg-gradient-to-br from-[#E87C00] to-[#FF9500] p-8 text-center text-white">
                                    <p className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-80">TOTAL RECIBIDO</p>
                                    <div className="text-5xl font-black mb-2 flex items-center justify-center gap-2">
                                        <span className="text-2xl opacity-60">$</span>
                                        <span className="font-black tracking-tighter">{totalPagado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="inline-flex items-center gap-2 bg-black/10 px-3 py-1 rounded-full mt-2">
                                        <Calendar size={12} className="opacity-60" />
                                        <p className="text-[10px] font-bold uppercase tracking-wider">{new Date().toLocaleDateString('es-AR')}</p>
                                    </div>
                                </div>
                                
                                <div className="p-8 space-y-8">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Saldo Anterior</span>
                                            <span className="font-black text-gray-800">$ {currentBalance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Abono Hoy</span>
                                            <span className="font-black text-green-600">- $ {totalPagado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="pt-4 border-t border-gray-100">
                                            <div className="flex justify-between items-center">
                                                <span className="font-black text-gray-800 uppercase tracking-widest text-xs">Saldo Final</span>
                                                <span className={`text-xl font-black ${(currentBalance - totalPagado) < 0 ? 'text-green-600' : 'text-orange-600'}`}>
                                                    $ {(currentBalance - totalPagado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <button 
                                            onClick={handleSave}
                                            disabled={isSaving || totalPagado <= 0}
                                            className="w-full bg-[#E87C00] hover:bg-[#D67200] text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed uppercase text-sm tracking-widest active:scale-95"
                                        >
                                            {isSaving ? <Loader2 size={20} className="animate-spin" /> : 'Confirmar Cobranza'}
                                            {!isSaving && <CheckCircle2 size={20} />}
                                        </button>
                                        <button 
                                            onClick={() => setSelectedClient(null)}
                                            className="w-full bg-white border-2 border-gray-100 hover:bg-gray-50 text-gray-400 font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all uppercase text-[10px] tracking-widest"
                                        >
                                            <ArrowLeft size={16} /> Cambiar Cliente
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* HISTORIAL DE COBRANZAS */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mt-8">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2 uppercase text-sm tracking-wider">
                                <Receipt size={18} className="text-primary" /> Historial de Recibos
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                        <th className="px-6 py-3">Fecha</th>
                                        <th className="px-6 py-3">Monto</th>
                                        <th className="px-6 py-3">Notas</th>
                                        <th className="px-6 py-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {history.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-10 text-center text-gray-400 italic text-sm">No hay cobranzas registradas</td>
                                        </tr>
                                    ) : (
                                        history.map(item => (
                                            <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                                                <td className="px-6 py-4 text-sm font-medium text-gray-600">
                                                    {new Date(item.date).toLocaleDateString('es-AR')}
                                                </td>
                                                <td className="px-6 py-4 text-sm font-black text-gray-800">
                                                    $ {item.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-6 py-4 text-xs text-gray-500 max-w-xs truncate italic">
                                                    {item.notes || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button 
                                                            onClick={() => setShowReceipt(item)}
                                                            className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                            title="Ver Recibo"
                                                        >
                                                            <Receipt size={18} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(item.id)}
                                                            className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Anular"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE RECIBO */}
            {showReceipt && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-gray-100 relative">
                            <button 
                                onClick={() => setShowReceipt(null)}
                                className="absolute right-6 top-6 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X size={24} />
                            </button>
                            <div className="text-center space-y-2">
                                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Receipt size={32} className="text-primary" />
                                </div>
                                <h3 className="text-2xl font-black text-gray-800 uppercase italic tracking-tight">Recibo de Pago</h3>
                                <p className="text-xs font-bold text-gray-400 tracking-widest uppercase">Comprobante No Oficial</p>
                            </div>
                        </div>
                        
                        <div className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Fecha</p>
                                    <p className="text-sm font-bold text-gray-800">{new Date(showReceipt.date).toLocaleDateString('es-AR')}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Cliente</p>
                                    <p className="text-sm font-bold text-gray-800 uppercase">{selectedClient?.nombre}</p>
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-2xl p-6 text-center border border-gray-100">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Monto Total Recibido</p>
                                <p className="text-4xl font-black text-primary">$ {showReceipt.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                            </div>

                            {showReceipt.notes && (
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Observaciones</p>
                                    <p className="text-sm text-gray-600 italic bg-gray-50 p-4 rounded-xl border border-gray-100">{showReceipt.notes}</p>
                                </div>
                            )}

                            <div className="pt-6 border-t border-gray-100 flex gap-3">
                                <button 
                                    onClick={() => window.print()}
                                    className="flex-1 bg-gray-800 hover:bg-black text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-black/10 uppercase text-xs tracking-widest"
                                >
                                    <Receipt size={18} /> Imprimir
                                </button>
                                <button 
                                    onClick={() => setShowReceipt(null)}
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-4 rounded-2xl transition-all uppercase text-xs tracking-widest"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
