
import React, { useState, useEffect, useRef } from 'react';
import { 
    X, 
    Check, 
    Edit2, 
    AlertTriangle, 
    Box, 
    Clock, 
    MessageSquare, 
    Save, 
    ShieldCheck, 
    UserCheck, 
    Plus, 
    Trash2, 
    DollarSign, 
    XCircle, 
    FileText, 
    Loader2, 
    ClipboardCheck, 
    Truck, 
    RotateCcw, 
    MapPin, 
    Receipt, 
    Printer, 
    Lock, 
    Undo2, 
    CheckCircle2, 
    Activity, 
    LogOut, 
    MessageCircle, 
    Share2, 
    ArrowDownLeft, 
    Search, 
    Package, 
    History, 
    ChevronRight, 
    Send, 
    User, 
    FilePlus 
} from 'lucide-react';
import { Order, Product, User as UserType, OrderStatus, PaymentMethod, MasterProduct, HistoryEntry } from '../types';
import { updatePaymentMethod } from '../logic';
import { jsPDF } from 'jspdf';
import { supabase } from '../supabase';

interface OrderAssemblyModalProps {
    order: Order;
    currentUser: UserType;
    onClose: () => void;
    onSave: (updatedOrder: Order, shouldAdvance: boolean, notes?: string) => void;
    onUpdateProduct: (productCode: string, quantity: number) => void;
    onToggleCheck: (productCode: string) => void;
    onUpdateObservations: (text: string) => void;
    onAddProduct?: (product: Product) => void;
    onUpdatePrice?: (productCode: string, newPrice: number) => void;
    onRemoveProduct?: (productCode: string) => void;
    onDeleteOrder?: (orderId: string) => void;
}

export const OrderAssemblyModal: React.FC<OrderAssemblyModalProps> = ({
    order,
    currentUser,
    onClose,
    onSave,
    onUpdateProduct,
    onToggleCheck,
    onUpdateObservations,
    onAddProduct,
    onUpdatePrice,
    onRemoveProduct,
    onDeleteOrder
}) => {
    const [activeTab, setActiveTab] = useState<'products' | 'history'>('products');
    const [editingProductCode, setEditingProductCode] = useState<string | null>(null);
    const [editingPriceCode, setEditingPriceCode] = useState<string | null>(null);
    const [tempValue, setTempValue] = useState<string>("");
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [clientPhone, setClientPhone] = useState<string | null>(null);

    // Estados para agregar producto manual con búsqueda
    const [isAddingProduct, setIsAddingProduct] = useState(false);
    const [searchProdTerm, setSearchProdTerm] = useState('');
    const [prodSearchResults, setProdSearchResults] = useState<MasterProduct[]>([]);
    const [isSearchingProd, setIsSearchingProd] = useState(false);
    
    const [newProdCode, setNewProdCode] = useState('');
    const [newProdName, setNewProdName] = useState('');
    const [newProdQty, setNewProdQty] = useState('1');
    const [newProdPrice, setNewProdPrice] = useState('0');

    // Estado para modal de transición
    const [showTransitionModal, setShowTransitionModal] = useState(false);

    const isVale = currentUser.role === 'vale';
    const isControlStep = order.status === OrderStatus.ARMADO;
    const isBillingStep = order.status === OrderStatus.ARMADO_CONTROLADO && isVale; 
    const isInvoiceControlStep = order.status === OrderStatus.FACTURADO;
    const isReadyForTransit = order.status === OrderStatus.FACTURA_CONTROLADA;
    const isTransitStep = order.status === OrderStatus.EN_TRANSITO; 
    const isFinishedStep = order.status === OrderStatus.ENTREGADO || order.status === OrderStatus.PAGADO;

    // --- LÓGICA DE UX: PASOS DE REPARTO Y ENTREGA AUTOMÁTICOS ---
    // Si estamos en "Factura Controlada" (listo para salir a reparto) o "En Tránsito" (listo para entregar),
    // o el pedido ya finalizó, los checks se consideran completos visual y lógicamente.
    const isAutoCheckStep = isReadyForTransit || isTransitStep || isFinishedStep;

    const canPrint = isBillingStep || isInvoiceControlStep || isReadyForTransit || isTransitStep || isFinishedStep;

    useEffect(() => {
        const fetchClientPhone = async () => {
            try {
                const { data, error } = await supabase
                    .from('clients_master')
                    .select('celular')
                    .eq('nombre', order.clientName)
                    .maybeSingle();
                
                if (data?.celular) {
                    const cleaned = data.celular.replace(/\D/g, '');
                    if (cleaned.length >= 10) setClientPhone(cleaned);
                }
            } catch (err) {
                console.error("Error buscando teléfono del cliente:", err);
            }
        };
        fetchClientPhone();
    }, [order.clientName]);

    const handleSearchProduct = async (val: string) => {
        setSearchProdTerm(val);
        const trimmed = val.trim();
        if (trimmed.length < 2) {
            setProdSearchResults([]);
            return;
        }
        setIsSearchingProd(true);
        try {
            const words = trimmed.split(/\s+/).filter(w => w.length > 0);
            let query = supabase.from('master_products').select('*');
            words.forEach(word => {
                query = query.ilike('desart', `%${word}%`);
            });
            const { data } = await query.limit(5);
            setProdSearchResults(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSearchingProd(false);
        }
    };

    const selectNewProduct = (p: MasterProduct) => {
        setNewProdCode(p.codart);
        setNewProdName(p.desart);
        setNewProdPrice(String(p.pventa_1 || 0));
        setProdSearchResults([]);
        setSearchProdTerm('');
    };

    const occupiedByOther = (
        (order.status === OrderStatus.EN_ARMADO && order.assemblerId && order.assemblerId !== currentUser.id) ||
        (order.status === OrderStatus.ARMADO && order.controllerId && order.controllerId !== currentUser.id)
    );

    const canEditProducts = !isFinishedStep && (
        isVale || 
        (currentUser.role === 'armador' && order.status === OrderStatus.EN_ARMADO) ||
        (currentUser.role === 'armador' && isControlStep) ||
        (currentUser.role === 'armador' && isTransitStep) || 
        isInvoiceControlStep ||
        isReadyForTransit
    );

    const canEditMetadata = isVale; 
    
    const showAdvanceButton = !isBillingStep && !isFinishedStep; 
    
    const assemblerName = order.history.find(h => h.newState === OrderStatus.ARMADO || h.details?.includes('Armado'))?.userName || order.assemblerName || '-';
    const showFinancials = isVale;

    const originalInvoiceTotal = order.products.reduce((acc, p) => acc + (p.originalQuantity * p.unitPrice), 0);
    const finalTotal = order.total;
    const refundTotal = originalInvoiceTotal - finalTotal;

    const getHistoryVisuals = (entry: HistoryEntry) => {
        const timestamp = new Date(entry.timestamp);
        const timeStr = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = timestamp.toLocaleDateString();

        let label = "Acción registrada";
        let icon = <Activity size={16} />;
        let colorClass = "bg-gray-500/10 text-gray-500 border-gray-200";
        let actorLabel = "Por:";

        if (entry.action === 'CREATE_ORDER') {
            label = "Pedido Creado";
            icon = <FilePlus size={16} />;
            colorClass = "bg-blue-500/10 text-blue-500 border-blue-200";
        } else if (entry.newState === OrderStatus.ARMADO) {
            label = "Armado Finalizado";
            actorLabel = "Armado por:";
            icon = <Box size={16} />;
            colorClass = "bg-orange-500/10 text-orange-600 border-orange-200";
        } else if (entry.newState === OrderStatus.ARMADO_CONTROLADO) {
            label = "Control de Calidad OK";
            actorLabel = "Controlado por:";
            icon = <ShieldCheck size={16} />;
            colorClass = "bg-purple-500/10 text-purple-600 border-purple-200";
        } else if (entry.newState === OrderStatus.FACTURADO) {
            label = "Facturación Realizada";
            actorLabel = "Facturado por:";
            icon = <Receipt size={16} />;
            colorClass = "bg-indigo-500/10 text-indigo-600 border-indigo-200";
        } else if (entry.newState === OrderStatus.FACTURA_CONTROLADA) {
            label = "Factura Verificada";
            actorLabel = "Verificado por:";
            icon = <ClipboardCheck size={16} />;
            colorClass = "bg-cyan-500/10 text-cyan-600 border-cyan-200";
        } else if (entry.newState === OrderStatus.EN_TRANSITO) {
            label = "Despachado / En Ruta";
            actorLabel = "Despachado por:";
            icon = <Truck size={16} />;
            colorClass = "bg-blue-600/10 text-blue-700 border-blue-300";
        } else if (entry.newState === OrderStatus.ENTREGADO) {
            label = "Entrega Confirmada";
            actorLabel = "Confirmado por:";
            icon = <CheckCircle2 size={16} />;
            colorClass = "bg-green-500/10 text-green-600 border-green-200";
        }

        return { label, icon, colorClass, dateStr, timeStr, actorLabel };
    };

    const buildInvoicePDF = () => {
        // ... (Logic for PDF remains same)
        const doc = new jsPDF();
        const primaryColor = [228, 124, 0]; 
        const textColor = [17, 24, 39]; 
        const mutedColor = [107, 114, 128]; 
        const redColor = [220, 38, 38];
        const orangeColor = [234, 88, 12];

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('DISTRIBUIDORA DE BEBIDAS', 20, 25);

        doc.setFontSize(10);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(`Cliente: ${order.clientName}`, 20, 35);
        doc.text(`ID Pedido: ${order.displayId}`, 20, 42);
        doc.text(`Fecha: ${order.createdDate}`, 150, 35);
        doc.text(`Zona: ${order.zone || 'N/A'}`, 150, 42);

        doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setLineWidth(1);
        doc.line(20, 50, 190, 50);

        let currentY = 60;
        
        const delivered = order.products.filter(p => p.quantity > 0);
        if (delivered.length > 0) {
            doc.setFontSize(11);
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            doc.text('PRODUCTOS ENTREGADOS', 20, currentY);
            currentY += 8;
            doc.setFontSize(9);
            doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
            doc.text('CÓD.', 20, currentY);
            doc.text('ARTÍCULO', 35, currentY);
            doc.text('CANT.', 130, currentY, { align: 'center' });
            doc.text('P. UNIT', 160, currentY, { align: 'right' });
            doc.text('SUBTOTAL', 190, currentY, { align: 'right' });
            currentY += 3;
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.1);
            doc.line(20, currentY, 190, currentY);
            currentY += 7;
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            delivered.forEach(p => {
                doc.text(p.code, 20, currentY);
                doc.text(p.name.substring(0, 45).toUpperCase(), 35, currentY);
                doc.text(p.quantity.toString(), 130, currentY, { align: 'center' });
                doc.text(`$ ${p.unitPrice.toLocaleString('es-AR')}`, 160, currentY, { align: 'right' });
                doc.text(`$ ${p.subtotal.toLocaleString('es-AR')}`, 190, currentY, { align: 'right' });
                currentY += 7;
                if (currentY > 270) { doc.addPage(); currentY = 20; }
            });
            currentY += 5;
        }

        const isPostShipping = [OrderStatus.EN_TRANSITO, OrderStatus.ENTREGADO, OrderStatus.PAGADO].includes(order.status);

        const shortages = order.products.map(p => {
             const sentOrCurrent = isPostShipping ? (p.shippedQuantity ?? p.quantity) : p.quantity;
             const missing = Math.max(0, p.originalQuantity - sentOrCurrent);
             return { ...p, missing };
        }).filter(p => p.missing > 0);

        if (shortages.length > 0) {
             currentY += 10;
             if (currentY > 260) { doc.addPage(); currentY = 20; }
             
             doc.setFontSize(11);
             doc.setTextColor(redColor[0], redColor[1], redColor[2]);
             doc.text('! FALTANTES DE STOCK (NO ENVIADOS)', 20, currentY);
             currentY += 8;
             
             doc.setFontSize(9);
             doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
             doc.text('CÓD.', 20, currentY);
             doc.text('ARTÍCULO', 35, currentY);
             doc.text('ORIGINAL', 160, currentY, { align: 'right' });
             doc.text('FALTÓ', 190, currentY, { align: 'right' });
             
             currentY += 3;
             doc.setDrawColor(229, 231, 235);
             doc.setLineWidth(0.1);
             doc.line(20, currentY, 190, currentY);
             currentY += 7;
             
             doc.setTextColor(textColor[0], textColor[1], textColor[2]);
             shortages.forEach(p => {
                 doc.text(p.code, 20, currentY);
                 doc.text(p.name.substring(0, 45).toUpperCase(), 35, currentY);
                 doc.text(p.originalQuantity.toString(), 160, currentY, { align: 'right' });
                 
                 doc.setTextColor(redColor[0], redColor[1], redColor[2]);
                 doc.text(p.missing.toString(), 190, currentY, { align: 'right' });
                 doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                 
                 currentY += 7;
                 if (currentY > 270) { doc.addPage(); currentY = 20; }
             });
        }

        const returns = order.products.map(p => {
             if (!isPostShipping) return { ...p, returned: 0 };
             const shipped = p.shippedQuantity ?? p.quantity;
             const returned = Math.max(0, shipped - p.quantity);
             return { ...p, returned };
        }).filter(p => p.returned > 0);

        if (returns.length > 0) {
             currentY += 10;
             if (currentY > 260) { doc.addPage(); currentY = 20; }
             
             doc.setFontSize(11);
             doc.setTextColor(orangeColor[0], orangeColor[1], orangeColor[2]);
             doc.text('NOTA DE CRÉDITO / DEVOLUCIONES EN REPARTO', 20, currentY);
             currentY += 8;
             
             doc.setFontSize(9);
             doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
             doc.text('CÓD.', 20, currentY);
             doc.text('ARTÍCULO', 35, currentY);
             doc.text('RECHAZADO', 160, currentY, { align: 'right' });
             doc.text('MONTO DESC.', 190, currentY, { align: 'right' });
             
             currentY += 3;
             doc.setDrawColor(orangeColor[0], orangeColor[1], orangeColor[2]);
             doc.setLineWidth(0.5);
             doc.line(20, currentY, 190, currentY);
             currentY += 7;
             
             doc.setTextColor(textColor[0], textColor[1], textColor[2]);
             returns.forEach(p => {
                 doc.text(p.code, 20, currentY);
                 doc.text(p.name.substring(0, 45).toUpperCase(), 35, currentY);
                 doc.text(p.returned.toString(), 160, currentY, { align: 'right' });
                 
                 const refundAmount = p.returned * p.unitPrice;
                 doc.text(`- $ ${refundAmount.toLocaleString('es-AR')}`, 190, currentY, { align: 'right' });
                 
                 currentY += 7;
                 if (currentY > 270) { doc.addPage(); currentY = 20; }
             });
        }

        currentY = Math.max(currentY + 20, 260);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text('TOTAL FINAL A PAGAR:', 130, currentY, { align: 'right' });
        doc.setFontSize(20);
        doc.setTextColor(22, 163, 74);
        doc.text(`$ ${order.total.toLocaleString('es-AR')}`, 190, currentY, { align: 'right' });

        return doc;
    };

    const handlePrint = () => {
        const doc = buildInvoicePDF();
        doc.save(`factura-${order.clientName.replace(/\s+/g, '-').toLowerCase()}-${order.displayId}.pdf`);
    };

    const handleShareInvoice = async () => {
        if (!clientPhone) return;
        setIsSharing(true);
        try {
            const doc = buildInvoicePDF();
            const pdfBlob = doc.output('blob');
            const fileName = `Factura-${order.clientName.replace(/\s+/g, '-')}-${order.displayId}.pdf`;
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
            const message = `Hola ${order.clientName}, adjuntamos el detalle de tu pedido #${order.displayId}. Total: $${order.total.toLocaleString('es-AR')}. ¡Muchas gracias!`;
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (isMobile && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: 'Factura Distribuidora', text: message });
            } else {
                doc.save(fileName);
                const encodedMsg = encodeURIComponent(message);
                const whatsappUrl = `https://api.whatsapp.com/send?phone=${clientPhone}&text=${encodedMsg}`;
                window.open(whatsappUrl, '_blank');
                if (!isMobile) { alert("PC DETECTADA: La factura se descargó. Se abrió el chat del cliente; por favor arrastra el PDF al chat para enviarlo."); }
            }
        } catch (err) { console.error(err); } finally { setIsSharing(false); }
    };

    const handleEditQtyClick = (product: Product) => {
        if (!canEditProducts) return;
        setEditingProductCode(product.code);
        setTempValue(product.quantity.toString());
        setEditingPriceCode(null);
    };

    const handleQtySave = (product: Product) => {
        const qty = parseInt(tempValue);
        if (!isNaN(qty) && qty >= 0) { onUpdateProduct(product.code, qty); }
        setEditingProductCode(null);
    };

    const handleEditPriceClick = (product: Product) => {
        if (!canEditProducts || !isVale) return;
        setEditingPriceCode(product.code);
        setTempValue(product.unitPrice.toString());
        setEditingProductCode(null);
    };

    const handlePriceSave = (product: Product) => {
        const price = parseFloat(tempValue);
        if (!isNaN(price) && price >= 0 && onUpdatePrice) { onUpdatePrice(product.code, price); }
        setEditingPriceCode(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent, product: Product, type: 'qty' | 'price') => {
        if (e.key === 'Enter') { if (type === 'qty') handleQtySave(product); else handlePriceSave(product); }
    };

    const handleSaveNewProduct = () => {
        if (!newProdCode || !newProdName || !onAddProduct) return;
        const qty = parseInt(newProdQty) || 1;
        const price = parseFloat(newProdPrice) || 0;
        onAddProduct({ code: newProdCode, name: newProdName, originalQuantity: qty, quantity: qty, unitPrice: price, subtotal: qty * price, isChecked: false });
        setIsAddingProduct(false); setNewProdCode(''); setNewProdName(''); setNewProdQty('1'); setNewProdPrice('0'); setSearchProdTerm('');
    };

    const handleInvoiceClick = () => {
        setIsGeneratingInvoice(true);
        setTimeout(() => { onSave(order, true); }, 1000);
    };

    const handlePaymentMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newMethod = e.target.value as PaymentMethod;
        const updatedOrder = updatePaymentMethod(order, newMethod);
        if (isVale) onSave(updatedOrder, false);
    };

    const handleAdvanceClick = () => { setShowTransitionModal(true); };
    const handleConfirmTransition = (notes: string) => { onSave(order, true, notes); setShowTransitionModal(false); };

    const uncheckedCount = order.products.filter(p => !p.isChecked).length;
    
    // --- CAMBIO LÓGICO: Si es un paso automático (Reparto/Entregado), se considera listo siempre ---
    const isReady = isAutoCheckStep ? true : uncheckedCount === 0;

    let titleText = "Armado de Pedido";
    let buttonLabel = "Finalizar Armado";
    let icon = <Box size={16} />;

    if (isControlStep) { titleText = "Control de Calidad"; buttonLabel = "Finalizar Control"; icon = <ShieldCheck size={16} />; } 
    else if (isBillingStep) { titleText = "Facturación"; buttonLabel = "Confirmar Facturación"; icon = <FileText size={16} />; } 
    else if (isInvoiceControlStep) { titleText = "Control de Factura"; buttonLabel = "Factura Controlada"; icon = <ClipboardCheck size={16} />; } 
    else if (isReadyForTransit) { titleText = "Listo para Despacho"; buttonLabel = "Enviar a Reparto"; icon = <Truck size={16} />; } 
    else if (isTransitStep) { titleText = "En Reparto / Devoluciones"; buttonLabel = "Marcar Entregado"; icon = <Truck size={16} />; } 
    else if (isFinishedStep) { titleText = "Pedido Finalizado"; buttonLabel = "Cerrar"; icon = <CheckCircle2 size={16} />; }

    const ActionsBlock = () => (
        <div className="flex flex-col gap-3 w-full">
             {occupiedByOther && (
                 <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl flex flex-col items-center gap-2 text-center animate-pulse">
                    <Activity size={20} className="text-yellow-600" />
                    <p className="text-xs font-black text-yellow-700 dark:text-yellow-400 uppercase tracking-widest">Pedido en uso</p>
                    <p className="text-[10px] text-muted font-bold leading-tight">Otro usuario está trabajando aquí, pero puedes colaborar.</p>
                 </div>
             )}

             {!isFinishedStep ? (
                <>
                    {canPrint && isVale && (
                        <div className="flex gap-2 mb-2">
                            {clientPhone && (
                                <button 
                                    onClick={handleShareInvoice}
                                    disabled={isSharing}
                                    className="p-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                                    title="Enviar PDF por WhatsApp"
                                >
                                    {isSharing ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />}
                                </button>
                            )}
                            <button 
                                onClick={handlePrint}
                                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                            >
                                <Printer size={18} />
                                Imprimir Factura
                            </button>
                        </div>
                    )}

                    {showAdvanceButton && (
                        <button 
                            onClick={handleAdvanceClick}
                            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2
                                ${isReady 
                                    ? 'bg-primary hover:bg-primaryHover shadow-primary/20' 
                                    : 'bg-muted/50 cursor-not-allowed text-muted-foreground'
                                }`}
                            disabled={!isReady}
                        >
                            {isReady ? (
                                <>
                                    <Check size={20} />
                                    {buttonLabel}
                                </>
                            ) : (
                                `Faltan verificar ${uncheckedCount} productos`
                            )}
                        </button>
                    )}

                    {isBillingStep && (
                        <button 
                            onClick={handleInvoiceClick}
                            disabled={isGeneratingInvoice}
                            className="w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 shadow-purple-500/20 disabled:opacity-70"
                        >
                            {isGeneratingInvoice ? <Loader2 size={20} className="animate-spin" /> : <FileText size={20} />}
                            {isGeneratingInvoice ? "Facturando..." : "Confirmar Facturación"}
                        </button>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={() => onSave(order, false)}
                            className="py-3 rounded-xl bg-primary/10 text-primary font-black border border-primary/20 hover:bg-primary hover:text-white transition-all text-[10px] uppercase flex items-center justify-center gap-2 shadow-sm"
                        >
                            <Save size={14} />
                            Guardar y Salir
                        </button>
                        <button 
                            onClick={onClose}
                            className="py-3 rounded-xl bg-surfaceHighlight text-text font-black border border-surfaceHighlight hover:bg-red-500/10 hover:text-red-500 transition-all text-[10px] uppercase flex items-center justify-center gap-2"
                        >
                            <LogOut size={14} />
                            Liberar Pedido
                        </button>
                    </div>
                </>
             ) : (
                 <>
                    {isFinishedStep && isVale && (
                        <div className="flex gap-2">
                            {clientPhone && (
                                <button 
                                    onClick={handleShareInvoice}
                                    disabled={isSharing}
                                    className="p-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                                    title="Re-Enviar PDF por WhatsApp"
                                >
                                    {isSharing ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />}
                                </button>
                            )}
                            <button 
                                onClick={handlePrint}
                                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                            >
                                <Printer size={16} />
                                Re-Imprimir Factura
                            </button>
                        </div>
                    )}

                    <button 
                        onClick={onClose}
                        className="w-full py-3 rounded-xl bg-surfaceHighlight hover:bg-surfaceHighlight/80 text-text font-bold transition-colors text-sm mt-3"
                    >
                        Cerrar Resumen
                    </button>
                 </>
             )}
        </div>
    );

    const InfoBlock = () => (
        <div className="bg-surface rounded-xl p-5 border border-surfaceHighlight shadow-sm">
            <h4 className="text-sm font-bold text-muted uppercase tracking-wider mb-3">Datos del Cliente</h4>
            <div className="space-y-3">
                <p className="text-sm flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                    <span className="text-muted">Nombre:</span> 
                    <span className="text-text font-bold text-base">{order.clientName}</span>
                </p>
                <p className="text-sm flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                    <span className="text-muted">Fecha Creado:</span> 
                    <span className="text-text font-medium">{order.createdDate}</span>
                </p>
                {order.zone && (
                    <p className="text-sm flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                        <span className="text-muted">Zona:</span> 
                        <span className="text-text font-bold">{order.zone}</span>
                    </p>
                )}
                <div className="h-px bg-surfaceHighlight my-2"></div>
                <p className="text-sm flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                    <span className="text-muted flex items-center gap-1"><UserCheck size={14}/> Responsable Armado:</span> 
                    <span className="text-text font-bold">{assemblerName}</span>
                </p>
            </div>
        </div>
    );

    const FinishedFinancialSummary = () => {
        if (!isFinishedStep || !showFinancials) return null;
        return (
            <div className="bg-surface rounded-xl p-0 border border-surfaceHighlight shadow-sm overflow-hidden mb-4 animate-in fade-in">
                 <div className="bg-surfaceHighlight/30 p-3 border-b border-surfaceHighlight">
                    <h4 className="text-sm font-bold text-text flex items-center gap-2">
                        <Receipt size={16} className="text-muted" />
                        Balance Final de Cobro
                    </h4>
                 </div>
                 <div className="p-4 space-y-3">
                     <div className="flex justify-between items-center text-sm">
                         <span className="text-muted">Presupuesto Original</span>
                         <span className="font-medium text-text">$ {originalInvoiceTotal.toLocaleString('es-AR')}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                         <span className="text-red-500 font-bold flex items-center gap-1"><RotateCcw size={12}/> Ajustes / Devoluciones</span>
                         <span className="font-bold text-red-500">- $ {refundTotal.toLocaleString('es-AR')}</span>
                     </div>
                     <div className="h-px bg-surfaceHighlight my-1"></div>
                     <div className="flex justify-between items-center">
                         <span className="font-bold text-green-600 text-sm">Total Neto Cobrado</span>
                         <span className="font-black text-green-600 text-lg">$ {finalTotal.toLocaleString('es-AR')}</span>
                     </div>
                 </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background w-full md:max-w-7xl h-full md:h-[90vh] md:rounded-2xl shadow-2xl flex flex-col overflow-hidden border-none md:border border-surfaceHighlight">
                
                <div className="flex items-center justify-between p-4 md:p-6 border-b border-surfaceHighlight bg-surface shrink-0 z-20">
                    <div className="flex items-center gap-6">
                         <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-lg md:text-2xl font-black text-text uppercase tracking-tight truncate max-w-[200px] md:max-w-md">{order.clientName}</h2>
                                <span className={`px-2 md:px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border
                                    ${occupiedByOther ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' :
                                      isFinishedStep ? 'bg-green-500/10 text-green-600 border-green-500/20' :
                                      canEditProducts ? 'bg-primary/10 text-primary border-primary/20' : 'bg-gray-500/10 text-gray-500 border-gray-500/20'}
                                `}>
                                    {occupiedByOther ? <Activity size={14}/> : icon}
                                    <span className="hidden md:inline">{occupiedByOther ? 'En Uso' : titleText}</span>
                                </span>
                            </div>
                            <p className="text-muted text-xs md:text-sm font-mono tracking-tight">PEDIDO: {order.displayId}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 md:gap-4">
                        {isVale && canPrint && (
                            <div className="flex gap-2">
                                {clientPhone && (
                                    <button 
                                        onClick={handleShareInvoice}
                                        disabled={isSharing}
                                        className="p-2.5 rounded-full bg-emerald-500/10 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all border border-emerald-500/20 shadow-sm disabled:opacity-50"
                                        title="Enviar PDF por WhatsApp"
                                    >
                                        {isSharing ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={20} />}
                                    </button>
                                )}
                                <button 
                                    onClick={handlePrint}
                                    className="p-2.5 rounded-full bg-blue-500/10 text-blue-600 hover:bg-blue-600 hover:text-white transition-all border border-blue-500/20 shadow-sm"
                                    title="Imprimir"
                                >
                                    <Printer size={20} />
                                </button>
                            </div>
                        )}
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-surfaceHighlight text-muted hover:text-text transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
                    {/* Contenedor de Scroll Principal */}
                    <div className="flex-1 overflow-y-auto bg-background scroll-smooth overscroll-contain flex flex-col">
                        
                        {/* TABS HEADER */}
                        <div className="p-4 border-b border-surfaceHighlight bg-surface flex gap-2 shrink-0 sticky top-0 z-30">
                            <button 
                                onClick={() => setActiveTab('products')} 
                                className={`flex-1 py-3 rounded-xl font-black uppercase text-xs transition-all ${activeTab === 'products' ? 'bg-surfaceHighlight text-text shadow-inner' : 'text-muted hover:text-text'}`}
                            >
                                Productos
                            </button>
                            <button 
                                onClick={() => setActiveTab('history')} 
                                className={`flex-1 py-3 rounded-xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-surfaceHighlight text-text shadow-inner' : 'text-muted hover:text-text'}`}
                            >
                                <History size={14} /> Historial
                            </button>
                        </div>

                        {/* CONTENT */}
                        {activeTab === 'products' ? (
                            <div className="p-4 md:p-6 pb-48 lg:pb-10 flex flex-col gap-6">
                                <div className="lg:hidden"><InfoBlock /></div>

                                <div>
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-lg font-bold text-text">Detalle de Productos</h3>
                                        {canEditProducts && !isAddingProduct && !isFinishedStep && (
                                            <button 
                                                onClick={() => setIsAddingProduct(true)}
                                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 text-xs font-black uppercase transition-all hover:bg-primary hover:text-white shadow-sm"
                                            >
                                                <Plus size={16} /> Agregar Producto
                                            </button>
                                        )}
                                    </div>

                                    {isAddingProduct && (
                                        <div className="mb-4 p-4 rounded-xl bg-surface border border-primary/30 shadow-lg animate-in fade-in">
                                            <div className="flex justify-between items-center mb-3">
                                                <h4 className="text-xs font-bold uppercase text-primary">Nuevo Producto</h4>
                                                <button onClick={() => setIsAddingProduct(false)}><X size={16}/></button>
                                            </div>
                                            <div className="space-y-3">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14}/>
                                                    <input 
                                                        autoFocus
                                                        type="text" 
                                                        value={searchProdTerm} 
                                                        onChange={(e) => handleSearchProduct(e.target.value)} 
                                                        placeholder="Buscar en maestro..." 
                                                        className="w-full bg-background border border-surfaceHighlight rounded-lg py-2 pl-9 pr-4 text-xs font-bold uppercase outline-none focus:border-primary"
                                                    />
                                                    {isSearchingProd && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 size={14} className="animate-spin text-primary"/></div>}
                                                    {prodSearchResults.length > 0 && (
                                                        <div className="absolute top-full left-0 w-full bg-surface border border-primary/30 rounded-xl shadow-xl mt-1 z-50 max-h-40 overflow-y-auto">
                                                            {prodSearchResults.map(p => (
                                                                <button 
                                                                    key={p.codart} 
                                                                    onClick={() => selectNewProduct(p)}
                                                                    className="w-full p-2 text-left text-[10px] font-bold uppercase hover:bg-primary/5 border-b border-surfaceHighlight last:border-none flex justify-between"
                                                                >
                                                                    <span>{p.desart}</span>
                                                                    <span className="text-muted">#{p.codart}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-12 gap-2">
                                                    <input className="col-span-3 p-2 rounded bg-surface border border-surfaceHighlight text-xs" placeholder="Cód" value={newProdCode} onChange={e => setNewProdCode(e.target.value)} />
                                                    <input className="col-span-5 p-2 rounded bg-surface border border-surfaceHighlight text-xs" placeholder="Nombre" value={newProdName} onChange={e => setNewProdName(e.target.value)}/>
                                                    <input className="col-span-2 p-2 rounded bg-surface border border-surfaceHighlight text-xs text-center" placeholder="Cant" type="number" value={newProdQty} onChange={e => setNewProdQty(e.target.value)}/>
                                                    {showFinancials && <input className="col-span-2 p-2 rounded bg-surface border border-surfaceHighlight text-xs text-right" placeholder="Precio" type="number" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)}/>}
                                                    <button onClick={handleSaveNewProduct} className="col-span-12 mt-2 py-2 bg-primary text-white font-bold rounded text-xs hover:bg-primaryHover transition-colors">Insertar</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="flex flex-col gap-3">
                                        {order.products.map((product) => {
                                            const isEditingQty = editingProductCode === product.code;
                                            const isEditingPrice = editingPriceCode === product.code;
                                            
                                            // --- LÓGICA CORREGIDA DE FALTANTES VS DEVOLUCIONES ---
                                            const isPostShipping = [OrderStatus.EN_TRANSITO, OrderStatus.ENTREGADO, OrderStatus.PAGADO].includes(order.status);

                                            // Faltante: Diferencia entre lo Original y lo que se logró armar/enviar.
                                            // Si estamos en armado: Original - Cantidad Actual.
                                            // Si ya salió: Original - Cantidad Despachada.
                                            const missingAmount = isPostShipping
                                                ? Math.max(0, product.originalQuantity - (product.shippedQuantity ?? product.quantity))
                                                : Math.max(0, product.originalQuantity - product.quantity);

                                            // Devolución (Nota de Crédito): SOLO si ya salió a reparto.
                                            // Diferencia entre lo Despachado y lo que el cliente aceptó (Cantidad Actual).
                                            const returnedAmount = isPostShipping && product.shippedQuantity 
                                                ? Math.max(0, product.shippedQuantity - product.quantity) 
                                                : 0;

                                            const isShortage = missingAmount > 0;
                                            const isReturned = returnedAmount > 0;
                                            // -----------------------------------------------------

                                            // Visualmente marcamos como checkeado si estamos en etapas donde la verificación es automática
                                            const displayChecked = isAutoCheckStep ? true : product.isChecked;

                                            return (
                                                <div key={product.code} className={`flex items-start md:items-center gap-3 p-4 rounded-xl border transition-all ${displayChecked && !isFinishedStep ? 'bg-green-500/5 border-green-500/20' : 'bg-surface border-surfaceHighlight shadow-sm'}`}>
                                                    {!isFinishedStep && (
                                                        <input 
                                                            type="checkbox"
                                                            checked={displayChecked}
                                                            onChange={() => {
                                                                // Permite checkear solo si se pueden editar productos Y NO estamos en una etapa de auto-check
                                                                if (canEditProducts && !isAutoCheckStep) onToggleCheck(product.code);
                                                            }}
                                                            disabled={!canEditProducts || isAutoCheckStep}
                                                            className={`w-5 h-5 rounded border-surfaceHighlight text-primary focus:ring-primary cursor-pointer accent-primary ${isAutoCheckStep ? 'opacity-50' : ''}`}
                                                        />
                                                    )}
                                                    
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-sm leading-tight text-text uppercase">{product.name}</p>
                                                        <div className="flex flex-wrap gap-2 mt-1">
                                                            <span className="text-[10px] font-mono text-muted bg-surfaceHighlight/50 px-1.5 rounded">#{product.code}</span>
                                                            
                                                            {isShortage && (
                                                                <span className="text-[10px] font-bold text-orange-600 bg-orange-500/10 px-1.5 rounded italic flex items-center gap-1">
                                                                    <AlertTriangle size={10} /> Faltante: {missingAmount}
                                                                </span>
                                                            )}
                                                            
                                                            {isReturned && (
                                                                <span className="text-[10px] font-black text-red-600 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 uppercase tracking-tighter flex items-center gap-1 animate-pulse">
                                                                    <ArrowDownLeft size={8}/> Nota de Crédito: {returnedAmount}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="w-24 text-center">
                                                        {isEditingQty ? (
                                                            <div className="flex items-center gap-1">
                                                                <input type="number" value={tempValue} onChange={e => setTempValue(e.target.value)} onKeyDown={e => handleKeyDown(e, product, 'qty')} className="w-16 px-2 py-1 rounded bg-background border border-primary text-sm font-bold text-center" autoFocus />
                                                                <button onClick={() => handleQtySave(product)} className="text-green-500"><Check size={16}/></button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-lg font-black text-text">{product.quantity}</span>
                                                                    {canEditProducts && <button onClick={() => handleEditQtyClick(product)} className="p-1 text-muted hover:text-primary"><Edit2 size={14} /></button>}
                                                                </div>
                                                                {isShortage && !isPostShipping && (
                                                                    <span className="text-[9px] text-muted font-bold">de {product.originalQuantity}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {showFinancials && (
                                                        <div className="hidden md:block w-32 text-right">
                                                            <p className="text-xs font-bold text-green-600">$ {product.subtotal.toLocaleString('es-AR')}</p>
                                                            <p className="text-[9px] text-muted italic">$ {product.unitPrice.toLocaleString('es-AR')} un.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 md:p-8 space-y-6">
                                <h3 className="text-lg font-black text-text uppercase italic tracking-tight">Historial de Actividad</h3>
                                <div className="space-y-0 relative border-l-2 border-surfaceHighlight ml-3">
                                    {order.history && order.history.length > 0 ? (
                                        order.history.map((h, idx) => {
                                            const { label, icon, colorClass, dateStr, timeStr, actorLabel } = getHistoryVisuals(h);
                                            return (
                                                <div key={idx} className="relative pl-8 pb-8 last:pb-0">
                                                    <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-background ${h.action.includes('ADVANCE') ? 'bg-green-500' : 'bg-surfaceHighlight'}`}></div>
                                                    <div className="bg-surface border border-surfaceHighlight p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-2 rounded-lg ${colorClass}`}>
                                                                    {icon}
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-sm font-black text-text uppercase leading-tight">{label}</h4>
                                                                    <p className="text-[10px] font-bold text-muted uppercase mt-0.5">{dateStr} • {timeStr}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-2 bg-background/50 p-2 rounded-lg border border-surfaceHighlight/50 mb-2">
                                                            <span className="text-[9px] font-black text-muted uppercase tracking-widest">{actorLabel}</span>
                                                            <div className="flex items-center gap-1.5">
                                                                <User size={12} className="text-primary"/>
                                                                <span className="text-xs font-black text-text uppercase">{h.userName || 'Sistema'}</span>
                                                            </div>
                                                        </div>

                                                        {h.details && (
                                                            <div className="bg-surfaceHighlight/30 p-2.5 rounded-lg border-l-2 border-surfaceHighlight">
                                                                <p className="text-[10px] font-medium text-text italic leading-relaxed">"{h.details}"</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="p-8 text-center border-2 border-dashed border-surfaceHighlight rounded-2xl">
                                            <History size={24} className="mx-auto text-muted mb-2 opacity-50"/>
                                            <p className="text-muted font-bold text-xs uppercase">Sin registros de historia.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="hidden lg:flex w-96 bg-surface border-l border-surfaceHighlight p-6 flex-col gap-6 overflow-y-auto shrink-0 shadow-xl z-10">
                        <InfoBlock />
                        <FinishedFinancialSummary />
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-bold text-text flex items-center gap-2"><DollarSign size={16}/> Método de Pago</label>
                            <select value={order.paymentMethod || 'Pendiente'} onChange={handlePaymentMethodChange} disabled={!canEditMetadata} className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm font-bold">
                                <option value="Pendiente">Pendiente</option>
                                <option value="Efectivo">Efectivo</option>
                                <option value="Transferencia">Transferencia</option>
                                <option value="Cheque">Cheque</option>
                                <option value="Cta Cte">Cta Cte</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-bold text-text flex items-center gap-2"><MessageSquare size={16}/> Observaciones</label>
                            <textarea className="w-full h-32 bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm resize-none" placeholder="Notas internas..." value={order.observations || ''} onChange={e => onUpdateObservations(e.target.value)} disabled={!canEditMetadata} />
                        </div>
                        <div className="mt-auto"><ActionsBlock /></div>
                    </div>
                    
                    <div className="lg:hidden fixed bottom-0 left-0 w-full bg-surface border-t border-surfaceHighlight p-4 z-30 shadow-2xl">
                         <ActionsBlock />
                    </div>
                </div>
            </div>

            {showTransitionModal && (
                <TransitionModal 
                    order={order} 
                    onClose={() => setShowTransitionModal(false)} 
                    onConfirm={(notes) => { onSave(order, true, notes); setShowTransitionModal(false); }}
                />
            )}
        </div>
    );
};

const TransitionModal: React.FC<{ order: Order, onClose: () => void, onConfirm: (notes: string) => void }> = ({ order, onClose, onConfirm }) => {
    const [notes, setNotes] = useState('');
    const nextLabel = "Siguiente Estado"; 

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-surface w-full max-w-md rounded-3xl border border-surfaceHighlight shadow-2xl p-6 flex flex-col gap-6">
                <div className="text-center">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary animate-bounce">
                        <CheckCircle2 size={32} />
                    </div>
                    <h3 className="text-xl font-black text-text uppercase italic tracking-tight">Confirmar Avance</h3>
                    <p className="text-sm text-muted mt-2 font-medium">El pedido avanzará al siguiente paso del flujo.</p>
                </div>
                
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 flex items-center gap-2">
                        <MessageSquare size={12}/> Comentario / Observación (Opcional)
                    </label>
                    <textarea 
                        value={notes} 
                        onChange={(e) => setNotes(e.target.value)} 
                        className="w-full bg-background border border-surfaceHighlight rounded-2xl p-4 text-sm font-medium text-text outline-none focus:border-primary shadow-inner h-24 resize-none" 
                        placeholder="Ej: Faltantes notificados al cliente..."
                        autoFocus
                    />
                </div>

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-4 text-text font-black text-xs hover:bg-surfaceHighlight rounded-2xl border border-surfaceHighlight uppercase transition-all">Cancelar</button>
                    <button onClick={() => onConfirm(notes)} className="flex-1 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:bg-primaryHover uppercase text-xs flex items-center justify-center gap-2 transition-all active:scale-95">
                        <Send size={16} /> Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
};
