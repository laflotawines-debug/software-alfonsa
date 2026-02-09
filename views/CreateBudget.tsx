
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
  Check, 
  Zap, 
  RotateCcw, 
  CheckCircle2, 
  Package,
  Phone,
  MessageCircle
} from 'lucide-react';
import { View, Product, OrderStatus, DetailedOrder, User, OrderZone, ClientMaster, SavedBudget, MasterProduct, DeliveryZone } from '../types';
import { parseOrderText } from '../logic';
import { supabase } from '../supabase';

interface CreateBudgetProps {
  onNavigate: (view: View) => void;
  onCreateOrder: (newOrder: DetailedOrder) => Promise<void>;
  currentUser: User;
}

export const CreateBudget: React.FC<CreateBudgetProps> = ({ onNavigate, onCreateOrder, currentUser }) => {
  const [clientName, setClientName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [availableZones, setAvailableZones] = useState<DeliveryZone[]>([]);
  const [rawText, setRawText] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Estados para búsqueda de clientes
  const [clientSearchResults, setClientSearchResults] = useState<ClientMaster[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientMaster | null>(null);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  
  // Estados para búsqueda de productos manual
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productSearchResults, setProductSearchResults] = useState<MasterProduct[]>([]);
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Presupuestos guardados
  const [savedBudgets, setSavedBudgets] = useState<SavedBudget[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  // Cargar zonas disponibles
  useEffect(() => {
      const fetchZones = async () => {
          const { data } = await supabase.from('delivery_zones').select('*').eq('active', true).order('name');
          if (data && data.length > 0) {
              setAvailableZones(data);
              // Set default if exists, preferably 'V. Mercedes' or first one
              const defaultZone = data.find(z => z.name === 'V. Mercedes') || data[0];
              setSelectedZone(defaultZone.name);
          } else {
              // Fallback if no data or offline
              setSelectedZone('V. Mercedes');
          }
      };
      fetchZones();
  }, []);

  // Manejar clics fuera del dropdown para cerrarlo
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowClientDropdown(false);
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSavedBudgets = async (clientCode: string) => {
      const { data, error } = await supabase
        .from('saved_budgets')
        .select('*, saved_budget_items(*)')
        .eq('client_code', clientCode)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
          const mappedBudgets: SavedBudget[] = data.map((b: any) => ({
              ...b,
              items: b.saved_budget_items || []
          }));
          setSavedBudgets(mappedBudgets);
      }
  };

  const handleSearchClient = async (val: string) => {
    setClientName(val);
    const trimmed = val.trim();
    if (trimmed.length < 2) {
      setClientSearchResults([]);
      setShowClientDropdown(false);
      return;
    }

    setIsSearchingClient(true);
    setShowClientDropdown(true);

    try {
      const words = trimmed.split(/\s+/).filter(w => w.length > 0);
      let query = supabase.from('clients_master').select('*');
      
      words.forEach(word => {
        query = query.ilike('nombre', `%${word}%`);
      });

      const { data, error } = await query.limit(6);

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
    setSelectedClient(client);
    
    // Auto-completar datos extra si existen
    if (client.domicilio) setAddress(client.domicilio);
    if (client.celular) setPhone(client.celular);

    setShowClientDropdown(false);
    fetchSavedBudgets(client.codigo);
    
    // Auto-select zone based on location string match if possible
    const loc = (client.localidad || '').toLowerCase();
    const matchedZone = availableZones.find(z => loc.includes(z.name.toLowerCase()));
    if (matchedZone) {
        setSelectedZone(matchedZone.name);
    } else {
        // Fallback checks
        if (loc.includes('mercedes')) setSelectedZone('V. Mercedes');
        else if (loc.includes('san luis')) setSelectedZone('San Luis');
        else if (loc.includes('norte')) setSelectedZone('Norte');
    }
  };

  const handleSearchProduct = async (val: string) => {
    setProductSearchTerm(val);
    const trimmed = val.trim();
    if (trimmed.length < 2) {
        setProductSearchResults([]);
        setShowProductDropdown(false);
        return;
    }

    setIsSearchingProduct(true);
    setShowProductDropdown(true);

    try {
        const words = trimmed.split(/\s+/).filter(w => w.length > 0);
        let query = supabase.from('master_products').select('*');
        words.forEach(word => {
            query = query.ilike('desart', `%${word}%`);
        });
        const { data, error } = await query.limit(10);
        if (error) throw error;
        setProductSearchResults(data || []);
    } catch (err) {
        console.error("Error buscando productos:", err);
    } finally {
        setIsSearchingProduct(false);
    }
  };

  const addManualProduct = (masterProd: MasterProduct) => {
      const newProduct: Product = {
          code: masterProd.codart,
          name: masterProd.desart,
          originalQuantity: 1,
          quantity: 1,
          unitPrice: masterProd.pventa_1 || 0,
          subtotal: (masterProd.pventa_1 || 0),
          isChecked: false
      };

      // Verificar si ya existe para sumar cantidad o agregar nuevo
      setProducts(prev => {
          const exists = prev.find(p => p.code === newProduct.code);
          if (exists) {
              return prev.map(p => p.code === newProduct.code ? { 
                  ...p, 
                  quantity: p.quantity + 1,
                  originalQuantity: p.originalQuantity + 1, 
                  subtotal: (p.quantity + 1) * p.unitPrice 
              } : p);
          }
          return [...prev, newProduct];
      });

      setProductSearchTerm('');
      setShowProductDropdown(false);
  };

  const useSavedBudget = (budget: SavedBudget) => {
      if (!budget.items || budget.items.length === 0) {
          alert("El presupuesto seleccionado no contiene artículos.");
          return;
      }
      
      const budgetProducts: Product[] = budget.items.map(item => ({
          code: item.codart,
          name: item.name,
          originalQuantity: item.quantity,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          subtotal: item.unit_price * item.quantity,
          isChecked: false
      }));

      setProducts(budgetProducts);
      setSelectedBudgetId(budget.id);

      let generatedText = "";
      budget.items.forEach(item => {
          const unitPriceStr = item.unit_price.toLocaleString('es-AR', { minimumFractionDigits: 2 });
          const subtotalStr = (item.unit_price * item.quantity).toLocaleString('es-AR', { minimumFractionDigits: 2 });
          generatedText += `${item.quantity} (x1) ${item.codart} ${item.name} - $ ${unitPriceStr} $ ${subtotalStr}\n`;
      });
      setRawText(generatedText);
      
      alert(`Se han cargado ${budgetProducts.length} artículos del presupuesto guardado.`);
  };

  const updateRowQuantity = (idx: number, newVal: number) => {
      if (newVal < 1) return;
      setProducts(prev => prev.map((p, i) => {
          if (i === idx) {
              return { 
                  ...p, 
                  quantity: newVal, 
                  originalQuantity: newVal, // Al crear, la original también cambia si editamos
                  subtotal: newVal * p.unitPrice 
              };
          }
          return p;
      }));
  };

  const updateRowPrice = (idx: number, newVal: number) => {
      setProducts(prev => prev.map((p, i) => {
          if (i === idx) {
              return { 
                  ...p, 
                  unitPrice: newVal, 
                  subtotal: p.quantity * newVal 
              };
          }
          return p;
      }));
  };

  const totalAmount = products.reduce((sum, p) => sum + p.subtotal, 0);

  const handleProcessText = () => {
    if (!rawText.trim()) return;
    setIsProcessing(true);
    setTimeout(() => {
        try {
            const parsedProducts = parseOrderText(rawText);
            if (parsedProducts.length === 0) {
                alert("No se detectaron productos. Verifique que el texto tenga el formato correcto.");
            } else {
                // Combinar con productos existentes si los hay
                setProducts(prev => [...prev, ...parsedProducts]);
                setRawText(''); // Limpiar texto tras procesar
            }
        } catch (err: any) {
            console.error("Error parsing text:", err);
            alert("Error al procesar el texto: " + (err.message || "Formato desconocido"));
        } finally {
            setIsProcessing(false);
        }
    }, 600);
  };

  const handleClear = () => {
    setRawText('');
    setProducts([]);
    setSelectedBudgetId(null);
  };

  const handleSaveOrder = async () => {
    if (!clientName) return alert("Por favor ingrese el nombre del cliente");
    if (products.length === 0) return alert("El pedido debe tener al menos un producto");

    setIsSaving(true);
    try {
        const displayId = `PED-${Date.now()}`;
        
        // Construir observaciones con los datos extra
        let obsParts = [];
        if (address.trim()) obsParts.push(`DIRECCIÓN: ${address.trim()}`);
        if (phone.trim()) obsParts.push(`TEL: ${phone.trim()}`);
        
        const finalObservations = obsParts.length > 0 ? obsParts.join('\n') : undefined;

        const newOrder: DetailedOrder = {
            id: '', 
            displayId: displayId,
            clientName: clientName,
            zone: selectedZone,
            status: OrderStatus.EN_ARMADO, 
            productCount: products.length,
            total: totalAmount,
            createdDate: new Date().toLocaleDateString('es-AR'),
            products: products,
            observations: finalObservations,
            history: [{
                timestamp: new Date().toISOString(),
                userId: currentUser.id, 
                userName: currentUser.name,
                action: 'CREATE_ORDER',
                details: selectedBudgetId ? 'Pedido creado desde presupuesto transitorio' : 'Pedido creado manualmente'
            }]
        };

        await onCreateOrder(newOrder);

        if (selectedBudgetId) {
            await supabase.from('saved_budgets').delete().eq('id', selectedBudgetId);
        }
        
    } catch (err: any) {
        console.error("Error saving order:", err);
        // Detección específica del error de ENUM para zonas nuevas
        if (err.code === '22P02' && err.message?.includes('order_zone')) {
            alert("ERROR DE SISTEMA: La base de datos no reconoce la nueva zona. \n\nPor favor, ejecuta el script de corrección en el Editor SQL para permitir zonas personalizadas.");
        } else {
            alert("Error al guardar el pedido: " + (err.message || "Error de servidor"));
        }
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-10 max-w-5xl mx-auto">
      
      <div className="flex items-center gap-4">
        <button onClick={() => onNavigate(View.ORDERS)} className="p-2 rounded-full hover:bg-surfaceHighlight text-muted hover:text-text transition-colors"><ArrowLeft size={24} /></button>
        <div>
           <h2 className="text-text text-3xl font-black tracking-tight">Nuevo Pedido</h2>
           <p className="text-muted text-sm">Complete la información para generar un nuevo pedido.</p>
        </div>
        <div className="ml-auto flex gap-3">
             <button onClick={handleSaveOrder} disabled={isSaving} className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary hover:bg-primaryHover text-white font-black text-sm shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-wait active:scale-95">
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {isSaving ? 'Guardando...' : 'Crear Pedido'}
             </button>
        </div>
      </div>

      <section className="bg-surface rounded-2xl p-6 border border-surfaceHighlight shadow-sm">
        <h3 className="text-text text-lg font-bold mb-6 flex items-center gap-2">Datos del Cliente</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* NOMBRE DEL CLIENTE */}
            <div className="flex flex-col gap-2 relative" ref={dropdownRef}>
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Nombre del Cliente *</label>
                <div className="relative">
                    <UserIcon className={`absolute left-3 top-1/2 -translate-y-1/2 ${isSearchingClient ? 'text-primary animate-pulse' : 'text-muted'}`} size={18} />
                    <input type="text" value={clientName} onChange={(e) => handleSearchClient(e.target.value)} onFocus={() => clientName.length >= 2 && setShowClientDropdown(true)} placeholder="Buscar por nombre o código..." className="w-full bg-surface border border-surfaceHighlight rounded-xl py-3.5 pl-10 pr-4 text-sm text-text focus:border-primary outline-none transition-colors shadow-sm font-bold uppercase" autoComplete="off" />
                    {isSearchingClient && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 className="animate-spin text-primary" size={16} /></div>}
                </div>
                {showClientDropdown && (
                  <div className="absolute top-full left-0 w-full bg-surface border border-primary/30 rounded-2xl shadow-2xl mt-2 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                    {clientSearchResults.length > 0 ? (
                      <div className="flex flex-col">
                        <div className="px-4 py-2 bg-primary/5 border-b border-primary/10 text-[9px] font-black text-primary uppercase tracking-widest">Maestro</div>
                        {clientSearchResults.map((client) => (
                          <button key={client.codigo} onClick={() => selectClient(client)} className="w-full p-4 hover:bg-primary/5 text-left border-b border-surfaceHighlight last:border-none flex justify-between items-center group transition-all">
                            <div className="flex flex-col"><span className="text-xs font-black text-text group-hover:text-primary">{client.nombre}</span><div className="flex items-center gap-2 mt-0.5"><span className="text-[9px] font-mono text-muted bg-surfaceHighlight px-1.5 rounded">#{client.codigo}</span></div></div>
                            <Check size={16} className="text-primary opacity-0 group-hover:opacity-100" />
                          </button>
                        ))}
                      </div>
                    ) : <div className="p-6 text-center text-[10px] font-bold text-muted uppercase">No se encontraron coincidencias</div>}
                  </div>
                )}
            </div>
            
            {/* ZONA DE ENTREGA */}
            <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Zona de Entrega</label>
                <div className="relative">
                    <Compass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
                    <select value={selectedZone} onChange={(e) => setSelectedZone(e.target.value)} className="w-full bg-surface border border-surfaceHighlight rounded-xl py-3.5 pl-10 pr-4 text-sm text-text focus:border-primary outline-none transition-colors appearance-none cursor-pointer shadow-sm font-bold uppercase">
                        {availableZones.map(z => (
                            <option key={z.id} value={z.name}>{z.name}</option>
                        ))}
                        {availableZones.length === 0 && <option value="V. Mercedes">V. Mercedes (Default)</option>}
                    </select>
                </div>
            </div>

            {/* DIRECCIÓN */}
            <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Dirección de Entrega (Opcional)</label>
                <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
                    <input 
                        type="text" 
                        value={address} 
                        onChange={(e) => setAddress(e.target.value)} 
                        placeholder="Calle y Número..." 
                        className="w-full bg-surface border border-surfaceHighlight rounded-xl py-3.5 pl-10 pr-4 text-sm text-text focus:border-primary outline-none transition-colors shadow-sm font-bold uppercase" 
                        autoComplete="off" 
                    />
                </div>
            </div>

            {/* CELULAR / WHATSAPP */}
            <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Celular / WhatsApp (Opcional)</label>
                <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
                    <input 
                        type="text" 
                        value={phone} 
                        onChange={(e) => setPhone(e.target.value)} 
                        placeholder="2657..." 
                        className="w-full bg-surface border border-surfaceHighlight rounded-xl py-3.5 pl-10 pr-4 text-sm text-text focus:border-primary outline-none transition-colors shadow-sm font-bold" 
                        autoComplete="off" 
                    />
                </div>
            </div>
        </div>

        {savedBudgets.length > 0 && (
            <div className="mt-8 p-6 bg-primary/5 border border-primary/20 rounded-2xl animate-in zoom-in-95">
                <div className="flex items-center gap-2 mb-4 text-primary">
                    <Zap size={20} className="fill-primary" />
                    <h4 className="text-xs font-black uppercase tracking-widest">Presupuestos Guardados Detectados</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {savedBudgets.map(b => (
                        <button 
                            key={b.id} 
                            onClick={() => useSavedBudget(b)}
                            className="bg-surface border border-primary/20 p-4 rounded-xl flex items-center justify-between hover:border-primary transition-all group shadow-sm text-left"
                        >
                            <div>
                                <p className="text-[10px] font-black text-muted uppercase">Creado: {new Date(b.created_at).toLocaleString()}</p>
                                <p className="text-lg font-black text-text group-hover:text-primary transition-colors">$ {b.total.toLocaleString('es-AR')}</p>
                            </div>
                            <div className="bg-primary text-white p-2 rounded-lg group-hover:scale-110 transition-transform">
                                <Plus size={16} />
                            </div>
                        </button>
                    ))}
                </div>
                <p className="text-[9px] text-muted font-bold uppercase mt-4 italic">Al crear el pedido, el presupuesto utilizado se eliminará automáticamente.</p>
            </div>
        )}
      </section>

      <section className="bg-surface rounded-2xl p-6 border border-surfaceHighlight shadow-sm">
         <h3 className="text-text text-lg font-bold flex items-center gap-3">Agregar Productos</h3>
         <p className="text-muted text-sm mb-4">Puede buscar manualmente en el catálogo o pegar texto desde un PDF.</p>
         
         <div className="flex flex-col gap-4">
             {/* BÚSQUEDA MANUAL */}
             <div className="relative z-20" ref={productDropdownRef}>
                 <div className="relative">
                    <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={18} />
                    <input 
                        type="text" 
                        value={productSearchTerm} 
                        onChange={(e) => handleSearchProduct(e.target.value)}
                        placeholder="Buscar producto por nombre para agregar..." 
                        className="w-full bg-surface border border-surfaceHighlight rounded-xl py-3.5 pl-12 pr-4 text-sm text-text focus:border-primary outline-none transition-colors shadow-sm font-bold uppercase" 
                    />
                    {isSearchingProduct && <div className="absolute right-4 top-1/2 -translate-y-1/2"><Loader2 className="animate-spin text-primary" size={16} /></div>}
                 </div>
                 {showProductDropdown && productSearchResults.length > 0 && (
                     <div className="absolute top-full left-0 w-full mt-2 bg-surface border border-primary/30 rounded-2xl shadow-2xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                         {productSearchResults.map(p => (
                             <button 
                                key={p.codart} 
                                onClick={() => addManualProduct(p)}
                                className="w-full p-3 text-left border-b border-surfaceHighlight last:border-none hover:bg-primary/5 flex justify-between items-center group"
                             >
                                 <div>
                                     <p className="text-xs font-black text-text uppercase group-hover:text-primary">{p.desart}</p>
                                     <p className="text-[10px] font-mono text-muted">#{p.codart} | $ {p.pventa_1}</p>
                                 </div>
                                 <Plus size={16} className="text-primary opacity-0 group-hover:opacity-100" />
                             </button>
                         ))}
                     </div>
                 )}
             </div>

             <div className="flex items-center gap-4 py-2">
                 <div className="h-px bg-surfaceHighlight flex-1"></div>
                 <span className="text-[10px] font-black text-muted uppercase tracking-widest">O Pegar Texto</span>
                 <div className="h-px bg-surfaceHighlight flex-1"></div>
             </div>

             {/* PEGADO DE TEXTO */}
             <div className="relative">
                 <textarea value={rawText} onChange={(e) => { setRawText(e.target.value); setSelectedBudgetId(null); }} placeholder="Ej: 1 (x12) 49 FERNET BRANCA - $ 8.800,00 $ 105.600,00" className="w-full bg-surface border border-surfaceHighlight rounded-xl p-4 text-sm text-text focus:border-primary outline-none transition-colors min-h-[100px] resize-y font-mono leading-relaxed shadow-sm uppercase" />
             </div>
             
             <div className="flex gap-3">
                 <button onClick={handleProcessText} disabled={isProcessing || !rawText} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surfaceHighlight hover:bg-surfaceHighlight/80 text-text text-sm font-bold transition-colors disabled:opacity-50">{isProcessing ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} {isProcessing ? 'Procesando...' : 'Procesar Texto'}</button>
                 <button onClick={handleClear} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surfaceHighlight hover:bg-background text-muted hover:text-text text-sm font-bold transition-colors"><Eraser size={16} /> Limpiar</button>
             </div>
         </div>
      </section>

      <section className="bg-surface rounded-2xl border border-surfaceHighlight shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
         <div className="p-6 border-b border-surfaceHighlight flex items-center justify-between bg-surface">
            <h3 className="text-text text-lg font-bold">Productos en el pedido ({products.length})</h3>
            {selectedBudgetId && (
                <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
                    <CheckCircle2 size={14}/> Usando Presupuesto Guardado
                </div>
            )}
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
                        <tr><td colSpan={currentUser.role === 'vale' ? 6 : 4} className="py-10 text-center text-muted text-sm italic">No hay productos cargados.</td></tr>
                    ) : products.map((product, index) => (
                        <tr key={`${product.code}-${index}`} className="hover:bg-background/20 transition-colors">
                            <td className="py-4 px-6"><div className="px-3 py-1.5 rounded bg-surface border border-surfaceHighlight text-text text-sm font-mono text-center">{product.code}</div></td>
                            <td className="py-4 px-6"><span className="text-sm text-text font-bold uppercase">{product.name}</span></td>
                            <td className="py-4 px-6 text-center">
                                <input 
                                    type="number" 
                                    min="1"
                                    value={product.quantity} 
                                    onChange={(e) => updateRowQuantity(index, parseInt(e.target.value) || 1)}
                                    className="w-20 bg-surface border border-surfaceHighlight rounded-lg p-2 text-center text-sm font-black outline-none focus:border-primary shadow-inner"
                                />
                            </td>
                            {currentUser.role === 'vale' && (
                                <>
                                    <td className="py-4 px-6 text-right">
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted text-xs">$</span>
                                            <input 
                                                type="number" 
                                                value={product.unitPrice} 
                                                onChange={(e) => updateRowPrice(index, parseFloat(e.target.value) || 0)}
                                                className="w-28 bg-surface border border-surfaceHighlight rounded-lg p-2 pl-5 text-right text-sm font-bold outline-none focus:border-primary shadow-inner"
                                            />
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 text-right"><span className="text-green-600 font-black">$ {product.subtotal.toLocaleString('es-AR')}</span></td>
                                </>
                            )}
                            <td className="py-4 px-6 text-center">
                                <button onClick={() => setProducts(products.filter((_, i) => i !== index))} className="p-2 rounded hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
             </table>
         </div>
         
         {currentUser.role === 'vale' && products.length > 0 && (
             <div className="p-6 bg-green-500/10 border-t border-surfaceHighlight flex justify-between items-center">
                <span className="text-green-600 dark:text-green-400 font-bold text-lg uppercase">Total del Pedido:</span>
                <span className="text-green-600 dark:text-green-400 font-black text-3xl tracking-tighter">$ {totalAmount.toLocaleString('es-AR')}</span>
             </div>
         )}
      </section>
    </div>
  );
};
