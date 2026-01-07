
import React, { useState, useEffect, useRef } from 'react';
import { 
  User as UserIcon, 
  MapPin, 
  HelpCircle, 
  FileText, 
  Eraser, 
  Plus, 
  Trash2,
  ArrowLeft,
  Save,
  Loader2,
  Compass,
  Search,
  Check
} from 'lucide-react';
import { View, Product, OrderStatus, DetailedOrder, User, OrderZone, ClientMaster } from '../types';
import { parseOrderText } from '../logic';
import { supabase } from '../supabase';

interface CreateBudgetProps {
  onNavigate: (view: View) => void;
  onCreateOrder: (newOrder: DetailedOrder) => Promise<void>;
  currentUser: User;
}

export const CreateBudget: React.FC<CreateBudgetProps> = ({ onNavigate, onCreateOrder, currentUser }) => {
  const [clientName, setClientName] = useState('');
  const [selectedZone, setSelectedZone] = useState<OrderZone>('V. Mercedes');
  const [rawText, setRawText] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Estados para búsqueda de clientes
  const [clientSearchResults, setClientSearchResults] = useState<ClientMaster[]>([]);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Manejar clics fuera del dropdown para cerrarlo
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchClient = async (val: string) => {
    setClientName(val);
    if (val.trim().length < 2) {
      setClientSearchResults([]);
      setShowClientDropdown(false);
      return;
    }

    setIsSearchingClient(true);
    setShowClientDropdown(true);

    try {
      const { data, error } = await supabase
        .from('clients_master')
        .select('*')
        .or(`nombre.ilike.%${val}%,codigo.ilike.%${val}%`)
        .limit(6);

      if (error) throw error;
      setClientSearchResults(data || []);
    } catch (err) {
      console.error("Error buscando clientes:", err);
    } finally {
      setIsSearchingClient(false);
    }
  };

  const selectClient = (client: ClientMaster) => {
    setClientName(client.nombre);
    setShowClientDropdown(false);
    
    // Intento de auto-selección de zona basado en localidad
    const loc = (client.localidad || '').toLowerCase();
    if (loc.includes('mercedes')) setSelectedZone('V. Mercedes');
    else if (loc.includes('san luis')) setSelectedZone('San Luis');
    else if (loc.includes('norte')) setSelectedZone('Norte');
  };

  // Computed total
  const totalAmount = products.reduce((sum, p) => sum + p.subtotal, 0);

  const handleProcessText = () => {
    if (!rawText.trim()) return;
    setIsProcessing(true);
    
    // Simulate slight delay for UX
    setTimeout(() => {
        const parsedProducts = parseOrderText(rawText);
        setProducts(parsedProducts);
        setIsProcessing(false);
    }, 600);
  };

  const handleClear = () => {
    setRawText('');
    setProducts([]);
  };

  const handleDeleteProduct = (index: number) => {
    const newProducts = [...products];
    newProducts.splice(index, 1);
    setProducts(newProducts);
  };

  const handleSaveOrder = async () => {
    if (!clientName) {
        alert("Por favor ingrese el nombre del cliente");
        return;
    }
    if (products.length === 0) {
        alert("El pedido debe tener al menos un producto");
        return;
    }

    setIsSaving(true);
    try {
        const newId = `PED-${Date.now()}`;
        const newOrder: DetailedOrder = {
            id: newId,
            displayId: `PED-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
            clientName: clientName,
            zone: selectedZone,
            status: OrderStatus.EN_ARMADO, // Initial State
            productCount: products.length,
            total: totalAmount,
            createdDate: new Date().toLocaleDateString('es-AR'),
            products: products,
            history: [{
                timestamp: new Date().toISOString(),
                userId: currentUser.id, 
                userName: currentUser.name,
                action: 'CREATE_ORDER',
                details: 'Pedido creado manualmente'
            }]
        };

        await onCreateOrder(newOrder);
    } catch (err) {
        console.error(err);
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-10 max-w-5xl mx-auto">
      
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => onNavigate(View.ORDERS)}
          className="p-2 rounded-full hover:bg-surfaceHighlight text-muted hover:text-text transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
           <h2 className="text-text text-3xl font-black tracking-tight">Nuevo Presupuesto</h2>
           <p className="text-muted text-sm">Complete la información para generar un nuevo pedido.</p>
        </div>
        <div className="ml-auto flex gap-3">
             <button className="hidden sm:block px-5 py-2.5 rounded-full border border-surfaceHighlight text-text font-bold text-sm hover:bg-surfaceHighlight transition-colors">
                Guardar Borrador
             </button>
             <button 
                onClick={handleSaveOrder}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary hover:bg-primaryHover text-white font-bold text-sm shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-wait"
             >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {isSaving ? 'Guardando...' : 'Crear Pedido'}
             </button>
        </div>
      </div>

      {/* 1. Client Data Section */}
      <section className="bg-surface rounded-2xl p-6 border border-surfaceHighlight shadow-sm">
        <h3 className="text-text text-lg font-bold mb-6 flex items-center gap-2">
            Datos del Cliente
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-2">
            <div className="flex flex-col gap-2 relative" ref={dropdownRef}>
                <label className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1">
                    Nombre del Cliente <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                    <UserIcon className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${isSearchingClient ? 'text-primary animate-pulse' : 'text-muted'}`} size={18} />
                    <input 
                        type="text" 
                        value={clientName}
                        onChange={(e) => handleSearchClient(e.target.value)}
                        onFocus={() => clientName.length >= 2 && setShowClientDropdown(true)}
                        placeholder="Buscar por nombre o código..."
                        className="w-full bg-surface border border-surfaceHighlight rounded-xl py-3.5 pl-10 pr-4 text-sm text-text focus:border-primary outline-none transition-colors shadow-sm font-bold uppercase"
                        autoComplete="off"
                    />
                    {isSearchingClient && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="animate-spin text-primary" size={16} />
                      </div>
                    )}
                </div>

                {/* Dropdown de Búsqueda de Clientes */}
                {showClientDropdown && (
                  <div className="absolute top-full left-0 w-full bg-surface border border-primary/30 rounded-2xl shadow-2xl mt-2 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                    {clientSearchResults.length > 0 ? (
                      <div className="flex flex-col">
                        <div className="px-4 py-2 bg-primary/5 border-b border-primary/10 text-[9px] font-black text-primary uppercase tracking-widest">Resultados del Maestro</div>
                        {clientSearchResults.map((client) => (
                          <button
                            key={client.codigo}
                            onClick={() => selectClient(client)}
                            className="w-full p-4 hover:bg-primary/5 text-left border-b border-surfaceHighlight last:border-none flex justify-between items-center group transition-all"
                          >
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-text group-hover:text-primary transition-colors">{client.nombre}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] font-mono text-muted bg-surfaceHighlight px-1.5 rounded">#{client.codigo}</span>
                                {client.localidad && <span className="text-[9px] font-bold text-muted uppercase italic">{client.localidad}</span>}
                              </div>
                            </div>
                            <Check className="text-primary opacity-0 group-hover:opacity-100 transition-opacity" size={16} />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center">
                        {!isSearchingClient && (
                          <>
                            <Search className="mx-auto text-muted/20 mb-2" size={24} />
                            <p className="text-[10px] font-bold text-muted uppercase">No se encontraron coincidencias</p>
                            <p className="text-[9px] text-primary font-black mt-1 uppercase">Se guardará como cliente nuevo</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
            </div>
            
            <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1">
                    Zona de Entrega
                </label>
                <div className="relative">
                    <Compass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
                    <select 
                        value={selectedZone}
                        onChange={(e) => setSelectedZone(e.target.value as OrderZone)}
                        className="w-full bg-surface border border-surfaceHighlight rounded-xl py-3.5 pl-10 pr-4 text-sm text-text focus:border-primary outline-none transition-colors appearance-none cursor-pointer shadow-sm font-bold"
                    >
                        <option value="V. Mercedes">V. Mercedes</option>
                        <option value="San Luis">San Luis</option>
                        <option value="Norte">Norte</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                         <span className={`block w-3 h-3 rounded-full ${
                             selectedZone === 'V. Mercedes' ? 'bg-cyan-500' :
                             selectedZone === 'San Luis' ? 'bg-fuchsia-500' : 'bg-amber-500'
                         }`}></span>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* 2. Text Processor Section */}
      <section className="bg-surface rounded-2xl p-6 border border-surfaceHighlight shadow-sm">
         <div className="flex items-center justify-between mb-4">
            <h3 className="text-text text-lg font-bold flex items-center gap-3">
                Cargar Productos desde Texto
                <span className="bg-surfaceHighlight text-muted px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide">Beta</span>
            </h3>
         </div>
         
         <p className="text-muted text-sm mb-4">
             Copie y pegue las líneas del PDF. El sistema detectará código, cantidad (incluyendo multiplicadores tipo x12), nombre y precio automáticamente.
         </p>

         <div className="relative mb-4">
             <textarea 
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Ej: 1 (x12) 49 FERNET BRANCA 450CC CHICO - $ 8.800,00 $ 105.600,00"
                className="w-full bg-surface border border-surfaceHighlight rounded-xl p-4 text-sm text-text focus:border-primary outline-none transition-colors min-h-[120px] resize-y font-mono leading-relaxed shadow-sm"
             />
             <HelpCircle className="absolute right-4 top-4 text-muted cursor-help" size={18} />
         </div>

         <div className="flex gap-3">
             <button 
                onClick={handleProcessText}
                disabled={isProcessing || !rawText}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surfaceHighlight hover:bg-surfaceHighlight/80 text-text text-sm font-bold transition-colors disabled:opacity-50"
             >
                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                {isProcessing ? 'Procesando...' : 'Procesar Texto'}
             </button>
             <button 
                onClick={handleClear}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surfaceHighlight hover:bg-background text-muted hover:text-text text-sm font-bold transition-colors"
             >
                <Eraser size={16} />
                Limpiar
             </button>
         </div>
      </section>

      {/* 3. Products Table Section */}
      <section className="bg-surface rounded-2xl border border-surfaceHighlight shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
         <div className="p-6 border-b border-surfaceHighlight flex items-center justify-between bg-surface">
            <h3 className="text-text text-lg font-bold">Productos ({products.length})</h3>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surfaceHighlight hover:bg-background text-text text-sm font-bold transition-colors">
                <Plus size={16} />
                Agregar Manual
            </button>
         </div>

         <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead>
                    <tr className="bg-background/30 border-b border-surfaceHighlight">
                        <th className="py-3 px-6 text-xs font-bold text-muted uppercase tracking-wider w-24">Código</th>
                        <th className="py-3 px-6 text-xs font-bold text-muted uppercase tracking-wider">Producto</th>
                        <th className="py-3 px-6 text-xs font-bold text-muted uppercase tracking-wider w-32 text-center">Cantidad</th>
                        {currentUser.role === 'vale' && (
                            <>
                                <th className="py-3 px-6 text-xs font-bold text-muted uppercase tracking-wider w-40 text-right">P. Unitario</th>
                                <th className="py-3 px-6 text-xs font-bold text-muted uppercase tracking-wider w-40 text-right">Subtotal</th>
                            </>
                        )}
                        <th className="py-3 px-6 text-xs font-bold text-muted uppercase tracking-wider w-16 text-center">Acción</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-surfaceHighlight">
                    {products.length === 0 ? (
                        <tr>
                            <td colSpan={currentUser.role === 'vale' ? 6 : 4} className="py-10 text-center text-muted text-sm italic">
                                No hay productos cargados. Use el procesador de texto arriba o agregue manualmente.
                            </td>
                        </tr>
                    ) : (
                        products.map((product, index) => (
                            <tr key={`${product.code}-${index}`} className="hover:bg-background/20 transition-colors">
                                <td className="py-4 px-6">
                                    <div className="px-3 py-1.5 rounded bg-surface border border-surfaceHighlight text-text text-sm font-mono text-center">
                                        {product.code}
                                    </div>
                                </td>
                                <td className="py-4 px-6">
                                    <input 
                                        type="text" 
                                        value={product.name} 
                                        readOnly
                                        className="w-full bg-transparent border-none py-2 text-sm text-text outline-none font-bold uppercase"
                                    />
                                </td>
                                <td className="py-4 px-6">
                                    <input 
                                        type="number" 
                                        value={product.quantity} 
                                        readOnly
                                        className="w-full bg-surface border border-surfaceHighlight rounded px-3 py-2 text-sm text-text text-center font-black outline-none focus:border-primary shadow-sm"
                                    />
                                </td>
                                
                                {currentUser.role === 'vale' && (
                                    <>
                                        <td className="py-4 px-6 text-right">
                                            <div className="inline-block w-full bg-green-500/10 border border-green-500/20 rounded px-3 py-2 text-green-600 dark:text-green-400 text-sm font-bold text-center">
                                                $ {product.unitPrice.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="inline-block w-full bg-green-500/10 border border-green-500/20 rounded px-3 py-2 text-green-600 dark:text-green-400 text-sm font-bold text-center">
                                                $ {product.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </div>
                                        </td>
                                    </>
                                )}
                                
                                <td className="py-4 px-6 text-center">
                                    <button 
                                        onClick={() => handleDeleteProduct(index)}
                                        className="p-2 rounded hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
             </table>
         </div>
         
         {/* Footer Total - Only for Vale */}
         {currentUser.role === 'vale' && products.length > 0 && (
             <div className="p-6 bg-green-500/10 border-t border-surfaceHighlight flex justify-between items-center">
                <span className="text-green-600 dark:text-green-400 font-bold text-lg">Total del Presupuesto:</span>
                <span className="text-green-600 dark:text-green-400 font-black text-2xl tracking-tight">
                    $ {totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
             </div>
         )}
      </section>
    </div>
  );
};
