
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Search, 
    RefreshCw, 
    Loader2, 
    Contact2, 
    ChevronRight, 
    AlertCircle,
    Phone,
    Mail,
    MapPin,
    UserPlus,
    Building2,
    Hash,
    UploadCloud,
    FileSpreadsheet,
    X,
    Save,
    CheckCircle2,
    Plus,
    Edit2,
    Trash2,
    AlertTriangle
} from 'lucide-react';
import { supabase } from '../supabase';
import { ClientMaster, User } from '../types';
import * as XLSX from 'xlsx';

interface ClientsMasterProps {
    currentUser: User;
}

export const ClientsMaster: React.FC<ClientsMasterProps> = ({ currentUser }) => {
    const [clients, setClients] = useState<ClientMaster[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modales y Estados
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<ClientMaster | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [importLog, setImportLog] = useState<string[]>([]);
    const [importSuccess, setImportSuccess] = useState(false);
    
    // Estado para Eliminación
    const [clientToDelete, setClientToDelete] = useState<ClientMaster | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('clients_master')
                .select('*')
                .order('nombre', { ascending: true });

            if (error) throw error;
            setClients(data || []);
        } catch (err: any) {
            console.error("Error cargando clientes:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // --- LÓGICA DE ELIMINACIÓN ---
    const executeDelete = async () => {
        if (!clientToDelete) return;
        
        setIsProcessing(true);
        try {
            const { error } = await supabase
                .from('clients_master')
                .delete()
                .eq('codigo', clientToDelete.codigo);

            if (error) {
                if (error.code === '42501') {
                    throw new Error("Permiso de eliminación denegado por la base de datos (RLS). Ejecuta el script SQL de actualización.");
                }
                throw error;
            }
            
            setClientToDelete(null);
            fetchData();
        } catch (err: any) {
            alert("Error al eliminar: " + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    // --- LÓGICA DE IMPORTACIÓN ---
    const normalizeHeader = (s: any): string => {
        if (s === undefined || s === null) return "";
        return String(s).trim().toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9_]/g, "");
    };

    const processExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setImportLog(["Leyendo archivo Excel..."]);
        setImportSuccess(false);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const dataArr = new Uint8Array(evt.target?.result as ArrayBuffer);
                const workbook = XLSX.read(dataArr, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

                if (jsonData.length < 2) throw new Error("El archivo no tiene suficientes datos.");

                const headers = jsonData[0].map(h => normalizeHeader(h));
                const rows = jsonData.slice(1);

                const colIdx = {
                    codigo: headers.indexOf('codigo'),
                    nombre: headers.indexOf('nombre'),
                    domicilio: headers.indexOf('domicilio'),
                    localidad: headers.indexOf('localidad'),
                    provincia: headers.indexOf('provincia'),
                    celular: headers.findIndex(h => h === 'celular' || h === 'telefono'),
                    email: headers.findIndex(h => h === 'email' || h === 'e_mail')
                };

                if (colIdx.codigo === -1) throw new Error("No se encontró la columna obligatoria 'codigo'.");

                const clientsToUpsert = rows.map(row => {
                    const getVal = (idx: number) => {
                        const val = row[idx];
                        if (val === null || val === undefined || String(val).trim() === "") return null;
                        return String(val).trim();
                    };

                    return {
                        codigo: getVal(colIdx.codigo),
                        nombre: getVal(colIdx.nombre),
                        domicilio: getVal(colIdx.domicilio),
                        localidad: getVal(colIdx.localidad),
                        provincia: getVal(colIdx.provincia),
                        celular: getVal(colIdx.celular),
                        email: getVal(colIdx.email)
                    };
                }).filter(c => c.codigo !== null);

                setImportLog(prev => [...prev, `Se detectaron ${clientsToUpsert.length} clientes válidos.`, "Iniciando carga a base de datos..."]);

                const chunkSize = 100;
                for (let i = 0; i < clientsToUpsert.length; i += chunkSize) {
                    const chunk = clientsToUpsert.slice(i, i + chunkSize);
                    const { error } = await supabase.from('clients_master').upsert(chunk, { onConflict: 'codigo' });
                    
                    if (error) {
                        if (error.code === '42501') throw new Error("Permiso denegado (RLS). Revise políticas SQL.");
                        throw error;
                    }
                    
                    const progress = Math.min(100, Math.round(((i + chunk.length) / clientsToUpsert.length) * 100));
                    setImportLog(prev => [...prev, `Progreso: ${progress}%`]);
                }

                setImportSuccess(true);
                setImportLog(prev => [...prev, "✅ IMPORTACIÓN FINALIZADA CON ÉXITO."]);
                fetchData();
            } catch (err: any) {
                console.error("Error en importación:", err);
                setImportLog(prev => [...prev, `❌ ERROR: ${err.message}`]);
            } finally {
                setIsProcessing(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const filteredClients = useMemo(() => {
        const keywords = searchTerm.toLowerCase().split(/\s+/).filter(k => k.length > 0);
        return clients.filter(c => {
            const textToSearch = `${c.nombre} ${c.codigo} ${c.localidad || ''} ${c.domicilio || ''}`.toLowerCase();
            return keywords.every(k => textToSearch.includes(k));
        });
    }, [clients, searchTerm]);

    if (currentUser.role !== 'vale') {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-muted">
                <AlertCircle size={48} className="mb-4 opacity-20" />
                <p className="font-black uppercase tracking-widest italic text-xl">Acceso Restringido</p>
                <p className="text-sm font-medium mt-2">Solo administradores pueden gestionar el maestro de clientes.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 pb-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight flex items-center gap-3 uppercase italic">
                        <Contact2 className="text-primary" size={32} />
                        Maestro de Clientes
                    </h2>
                    <p className="text-muted text-sm mt-1 font-medium italic">Gestión centralizada de la cartera de clientes.</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button 
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-4 rounded-2xl bg-surface border border-surfaceHighlight text-muted hover:text-primary transition-all font-black text-[10px] uppercase shadow-sm"
                    >
                        <FileSpreadsheet size={18} /> Importar Excel
                    </button>
                    <button 
                        onClick={() => { setEditingClient(null); setIsModalOpen(true); }}
                        className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-primary hover:bg-primaryHover text-white px-8 py-4 rounded-2xl font-black text-sm uppercase transition-all shadow-xl shadow-primary/20 active:scale-95"
                    >
                        <UserPlus size={20} /> Nuevo Cliente
                    </button>
                </div>
            </div>

            {/* Barra de Búsqueda */}
            <div className="bg-surface border border-surfaceHighlight rounded-3xl p-5 shadow-sm flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                    <input 
                        type="text" 
                        placeholder="Búsqueda inteligente: Ej 'fer satti'..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary transition-all shadow-inner uppercase"
                    />
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <button onClick={fetchData} disabled={isLoading} className="p-3.5 rounded-xl bg-background border border-surfaceHighlight text-muted hover:text-primary transition-all shadow-sm">
                        <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <div className="bg-primary/10 text-primary px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-primary/20">
                        {isLoading ? '...' : `${clients.length} Registros`}
                    </div>
                </div>
            </div>

            {/* Tabla */}
            <div className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-background/50 text-[10px] text-muted uppercase font-black tracking-widest border-b border-surfaceHighlight">
                            <tr>
                                <th className="p-4 w-24 pl-6">Código</th>
                                <th className="p-4">Cliente / Razón Social</th>
                                <th className="p-4">Ubicación</th>
                                <th className="p-4">Contacto</th>
                                <th className="p-4 text-right pr-6">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surfaceHighlight">
                            {isLoading ? (
                                <tr><td colSpan={5} className="p-24 text-center"><Loader2 size={48} className="animate-spin text-primary mx-auto" /></td></tr>
                            ) : filteredClients.length === 0 ? (
                                <tr><td colSpan={5} className="p-20 text-center text-muted font-bold italic uppercase opacity-50">Sin registros</td></tr>
                            ) : filteredClients.map((c) => (
                                <tr key={c.codigo} className="group hover:bg-primary/5 transition-colors">
                                    <td className="p-4 pl-6">
                                        <span className="font-mono font-black text-primary bg-primary/10 px-2 py-1 rounded text-[11px] border border-primary/20">
                                            #{c.codigo}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-text uppercase leading-tight truncate max-w-[300px]">
                                                {c.nombre || 'SIN NOMBRE'}
                                            </span>
                                            <span className="text-[10px] font-bold text-muted mt-0.5 flex items-center gap-1">
                                                <MapPin size={10} className="text-primary" /> {c.domicilio || 'SIN DOMICILIO'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-text uppercase">
                                                {c.localidad || '-'}
                                            </span>
                                            <span className="text-[9px] font-bold text-muted uppercase tracking-wider">
                                                {c.provincia || '-'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1">
                                            <div className={`flex items-center gap-1.5 text-xs font-bold ${c.celular ? 'text-text' : 'text-muted opacity-30'}`}>
                                                <Phone size={12} className="text-primary" /> {c.celular || '-'}
                                            </div>
                                            <div className={`flex items-center gap-1.5 text-[10px] font-medium ${c.email ? 'text-text' : 'text-muted opacity-30'}`}>
                                                <Mail size={12} className="text-blue-500" /> {c.email || '-'}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 pr-6 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                            <button 
                                                onClick={() => { setEditingClient(c); setIsModalOpen(true); }}
                                                className="p-2 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all"
                                                title="Editar Ficha"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button 
                                                onClick={() => setClientToDelete(c)}
                                                className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                                                title="Eliminar Cliente"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL DE IMPORTACIÓN */}
            {isImportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-surface w-full max-w-lg rounded-3xl border border-surfaceHighlight shadow-2xl overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-surfaceHighlight flex justify-between items-center bg-background/30">
                            <div className="flex items-center gap-3">
                                <UploadCloud className="text-primary" size={24} />
                                <h3 className="text-xl font-black text-text uppercase italic">Importar desde Excel</h3>
                            </div>
                            <button onClick={() => { setIsImportModalOpen(false); setImportLog([]); setImportSuccess(false); }} className="p-2 hover:bg-surfaceHighlight rounded-full text-muted transition-all">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="p-8 space-y-6">
                            {!importSuccess && (
                                <div className="space-y-4">
                                    <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 flex gap-4">
                                        <AlertCircle className="text-primary shrink-0" size={20} />
                                        <div className="text-[10px] text-muted font-bold leading-relaxed uppercase">
                                            <p>Asegúrese de que el Excel tenga los encabezados:</p>
                                            <p className="text-primary mt-1">codigo, nombre, domicilio, localidad, provincia, telefono, e_mail</p>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isProcessing}
                                        className={`w-full h-40 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-4 transition-all ${isProcessing ? 'border-primary bg-primary/5 animate-pulse' : 'border-surfaceHighlight hover:border-primary/50 bg-background'}`}
                                    >
                                        {isProcessing ? <Loader2 size={40} className="text-primary animate-spin" /> : <FileSpreadsheet size={40} className="text-muted" />}
                                        <div className="text-center">
                                            <p className="text-xs font-black uppercase text-text">{isProcessing ? 'Procesando Datos...' : 'Haga clic para seleccionar archivo'}</p>
                                        </div>
                                    </button>
                                    <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={processExcel} />
                                </div>
                            )}

                            {importLog.length > 0 && (
                                <div className="bg-background rounded-2xl p-4 border border-surfaceHighlight max-h-48 overflow-y-auto font-mono text-[10px] text-muted space-y-1 shadow-inner">
                                    {importLog.map((log, i) => (
                                        <div key={i} className="flex gap-2 border-b border-surfaceHighlight/30 pb-1 mb-1 last:border-none">
                                            <span className="text-primary">→</span> {log}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {importSuccess && (
                                <div className="flex flex-col items-center justify-center py-6 gap-4 text-green-500 animate-in zoom-in-95">
                                    <CheckCircle2 size={64} />
                                    <p className="font-black text-center uppercase">Base de Clientes Actualizada</p>
                                    <button 
                                        onClick={() => { setIsImportModalOpen(false); setImportLog([]); setImportSuccess(false); }}
                                        className="w-full py-4 bg-green-600 text-white font-black rounded-2xl uppercase text-xs"
                                    >
                                        Entendido
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE FICHA (NUEVO / EDITAR) */}
            {isModalOpen && (
                <ClientModal 
                    initialData={editingClient} 
                    onClose={() => { setIsModalOpen(false); setEditingClient(null); }} 
                    onSuccess={() => { setIsModalOpen(false); setEditingClient(null); fetchData(); }} 
                />
            )}

            {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
            {clientToDelete && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-surface w-full max-w-sm rounded-3xl border border-red-500/30 shadow-2xl p-8 flex flex-col items-center text-center gap-6">
                        <div className="p-4 bg-red-500/10 rounded-full text-red-500">
                            <AlertTriangle size={48} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-text uppercase italic tracking-tight">¿Eliminar Cliente?</h3>
                            <p className="text-sm text-muted mt-2 font-medium">Estás a punto de borrar a <br/><span className="text-text font-black uppercase">"{clientToDelete.nombre}"</span> de la base de datos.</p>
                            <p className="text-[10px] text-red-500 font-bold uppercase mt-2">Esta acción no se puede deshacer.</p>
                        </div>
                        <div className="flex flex-col w-full gap-3">
                            <button 
                                onClick={executeDelete}
                                disabled={isProcessing}
                                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-lg transition-all active:scale-95 uppercase text-xs tracking-widest flex items-center justify-center gap-2"
                            >
                                {isProcessing ? <Loader2 className="animate-spin" size={18}/> : <Trash2 size={18}/>}
                                Sí, Eliminar de la Base
                            </button>
                            <button 
                                onClick={() => setClientToDelete(null)}
                                disabled={isProcessing}
                                className="w-full py-4 bg-surfaceHighlight text-text font-black rounded-2xl transition-all hover:bg-surfaceHighlight/80 uppercase text-xs tracking-widest"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- SUB-COMPONENTE: MODAL CLIENTE ---
const ClientModal: React.FC<{ initialData: ClientMaster | null, onClose: () => void, onSuccess: () => void }> = ({ initialData, onClose, onSuccess }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        codigo: initialData?.codigo || '',
        nombre: initialData?.nombre || '',
        domicilio: initialData?.domicilio || '',
        localidad: initialData?.localidad || '',
        provincia: initialData?.provincia || '',
        celular: initialData?.celular || '',
        email: initialData?.email || ''
    });

    const isEdit = !!initialData;

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.codigo || !formData.nombre) return setError("Código y Nombre son obligatorios.");
        
        setIsSaving(true);
        setError(null);
        try {
            const payload = {
                codigo: formData.codigo.trim().toUpperCase(),
                nombre: formData.nombre.trim().toUpperCase(),
                domicilio: formData.domicilio?.trim().toUpperCase() || null,
                localidad: formData.localidad?.trim().toUpperCase() || null,
                provincia: formData.provincia?.trim().toUpperCase() || null,
                celular: formData.celular?.trim() || null,
                email: formData.email?.trim().toLowerCase() || null
            };

            if (isEdit) {
                const { error: updError } = await supabase
                    .from('clients_master')
                    .update(payload)
                    .eq('codigo', initialData.codigo);
                if (updError) throw updError;
            } else {
                const { error: insError } = await supabase.from('clients_master').insert([payload]);
                if (insError) {
                    if (insError.code === '23505') throw new Error("El código de cliente ya existe.");
                    throw insError;
                }
            }
            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-surface w-full max-w-2xl rounded-3xl border border-surfaceHighlight shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-surfaceHighlight flex justify-between items-center bg-background/30">
                    <h3 className="text-xl font-black text-text uppercase italic">
                        {isEdit ? `Editando: ${initialData.nombre}` : 'Ficha de Nuevo Cliente'}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-surfaceHighlight rounded-full text-muted transition-colors"><X size={24}/></button>
                </div>
                
                <form onSubmit={handleSave} className="p-8 space-y-6">
                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-600 text-xs font-bold flex items-center gap-3 animate-in shake">
                            <AlertCircle size={18} /> {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        <div className="md:col-span-4 space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Código Único *</label>
                            <div className="relative">
                                <Hash className={`absolute left-4 top-1/2 -translate-y-1/2 ${isEdit ? 'text-muted/30' : 'text-muted'}`} size={16} />
                                <input 
                                    required 
                                    type="text" 
                                    disabled={isEdit}
                                    value={formData.codigo} 
                                    onChange={e => setFormData({...formData, codigo: e.target.value})} 
                                    className={`w-full bg-background border border-surfaceHighlight rounded-2xl py-3.5 pl-11 text-sm font-black text-text outline-none focus:border-primary shadow-inner uppercase ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                    placeholder="0000" 
                                />
                            </div>
                            {isEdit && <p className="text-[8px] font-bold text-muted uppercase ml-1">El código no puede cambiarse en edición.</p>}
                        </div>
                        <div className="md:col-span-8 space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Nombre / Razón Social *</label>
                            <div className="relative">
                                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                                <input required type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full bg-background border border-surfaceHighlight rounded-2xl py-3.5 pl-11 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase" placeholder="NOMBRE COMPLETO" />
                            </div>
                        </div>

                        <div className="md:col-span-12 space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Dirección de Entrega</label>
                            <div className="relative">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                                <input type="text" value={formData.domicilio} onChange={e => setFormData({...formData, domicilio: e.target.value})} className="w-full bg-background border border-surfaceHighlight rounded-2xl py-3.5 pl-11 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase" placeholder="CALLE Y NÚMERO" />
                            </div>
                        </div>

                        <div className="md:col-span-6 space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Localidad</label>
                            <input type="text" value={formData.localidad} onChange={e => setFormData({...formData, localidad: e.target.value})} className="w-full bg-background border border-surfaceHighlight rounded-2xl py-3.5 px-5 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase" placeholder="V. MERCEDES" />
                        </div>
                        <div className="md:col-span-6 space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Provincia</label>
                            <input type="text" value={formData.provincia} onChange={e => setFormData({...formData, provincia: e.target.value})} className="w-full bg-background border border-surfaceHighlight rounded-2xl py-3.5 px-5 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase" placeholder="SAN LUIS" />
                        </div>

                        <div className="md:col-span-6 space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Celular / WhatsApp</label>
                            <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                                <input type="text" value={formData.celular} onChange={e => setFormData({...formData, celular: e.target.value})} className="w-full bg-background border border-surfaceHighlight rounded-2xl py-3.5 pl-11 text-sm font-bold text-text outline-none focus:border-primary shadow-inner" placeholder="2657 000000" />
                            </div>
                        </div>
                        <div className="md:col-span-6 space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Correo Electrónico</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-background border border-surfaceHighlight rounded-2xl py-3.5 pl-11 text-sm font-bold text-text outline-none focus:border-primary shadow-inner" placeholder="ejemplo@email.com" />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-6">
                        <button type="button" onClick={onClose} className="flex-1 py-4 text-text font-black text-xs hover:bg-surfaceHighlight rounded-2xl border border-surfaceHighlight uppercase transition-all">Cancelar</button>
                        <button 
                            type="submit" 
                            disabled={isSaving}
                            className="flex-1 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:bg-primaryHover uppercase text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70"
                        >
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {isEdit ? 'Actualizar Ficha' : 'Guardar Cliente'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
