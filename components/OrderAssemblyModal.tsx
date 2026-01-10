
import React, { useState, useEffect } from 'react';
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
    Share2
} from 'lucide-react';
import { Order, Product, User, OrderStatus, PaymentMethod } from '../types';
import { updatePaymentMethod } from '../logic';
import { jsPDF } from 'jspdf';
import { supabase } from '../supabase';

interface OrderAssemblyModalProps {
    order: Order;
    currentUser: User;
    onClose: () => void;
    onSave: (updatedOrder: Order, shouldAdvance: boolean) => void;
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
    const [editingProductCode, setEditingProductCode] = useState<string | null>(null);
    const [editingPriceCode, setEditingPriceCode] = useState<string | null>(null);
    const [tempValue, setTempValue] = useState<string>("");
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [clientPhone, setClientPhone] = useState<string | null>(null);

    const [isAddingProduct, setIsAddingProduct] = useState(false);
    const [newProdCode, setNewProdCode] = useState('');
    const [newProdName, setNewProdName] = useState('');
    const [newProdQty, setNewProdQty] = useState('1');
    const [newProdPrice, setNewProdPrice] = useState('0');

    const isVale = currentUser.role === 'vale';
    const isControlStep = order.status === OrderStatus.ARMADO;
    const isBillingStep = order.status === OrderStatus.ARMADO_CONTROLADO && isVale; 
    const isInvoiceControlStep = order.status === OrderStatus.FACTURADO;
    const isReadyForTransit = order.status === OrderStatus.FACTURA_CONTROLADA;
    const isTransitStep = order.status === OrderStatus.EN_TRANSITO; 
    const isFinishedStep = order.status === OrderStatus.ENTREGADO || order.status === OrderStatus.PAGADO;

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

    const isOriginalAssembler = order.assemblerId === currentUser.id;
    const isReadyForControl = order.status === OrderStatus.ARMADO;
    const selfControlBlocked = isOriginalAssembler && isReadyForControl && currentUser.role === 'armador';

    const occupiedByOther = (
        (order.status === OrderStatus.EN_ARMADO && order.assemblerId && order.assemblerId !== currentUser.id) ||
        (order.status === OrderStatus.ARMADO && order.controllerId && order.controllerId !== currentUser.id)
    );

    const canEditProducts = !isFinishedStep && !selfControlBlocked && !occupiedByOther && (
        isVale || 
        (currentUser.role === 'armador' && order.status === OrderStatus.EN_ARMADO) ||
        (currentUser.role === 'armador' && isControlStep) ||
        (currentUser.role === 'armador' && isTransitStep) ||
        isInvoiceControlStep ||
        isReadyForTransit
    );

    const canEditMetadata = isVale && !occupiedByOther;
    const showAdvanceButton = !isBillingStep && !isTransitStep && !isFinishedStep && !occupiedByOther; 
    const assemblerName = order.history.find(h => h.newState === OrderStatus.ARMADO || h.details?.includes('Armado'))?.userName || order.assemblerName || '-';
    const showFinancials = isVale;

    const originalInvoiceTotal = order.products.reduce((acc, p) => acc + (p.originalQuantity * p.unitPrice), 0);
    const finalTotal = order.total;
    const refundTotal = originalInvoiceTotal - finalTotal;

    const buildInvoicePDF = () => {
        const doc = new jsPDF();
        const primaryColor = [228, 124, 0]; 
        const textColor = [17, 24, 39]; 
        const mutedColor = [107, 114, 128]; 

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('ALFONSA DISTRIBUIDORA', 20, 25);

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

        const shortages = order.products.filter(p => p.originalQuantity > (p.shippedQuantity ?? p.quantity));
        if (shortages.length > 0) {
            currentY += 10;
            doc.setFontSize(11);
            doc.setTextColor(239, 68, 68);
            doc.text('! FALTANTES DE STOCK (NO ENVIADOS)', 20, currentY);
            currentY += 8;
            doc.setFontSize(9);
            doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
            doc.text('CÓD.', 20, currentY);
            doc.text('ARTÍCULO', 35, currentY);
            doc.text('ORIGINAL', 150, currentY, { align: 'center' });
            doc.text('FALTÓ', 180, currentY, { align: 'center' });
            currentY += 3;
            doc.line(20, currentY, 190, currentY);
            currentY += 7;
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            shortages.forEach(p => {
                const actualDelivered = p.shippedQuantity ?? p.quantity;
                const missing = p.originalQuantity - actualDelivered;
                doc.text(p.code, 20, currentY);
                doc.text(p.name.substring(0, 45).toUpperCase(), 35, currentY);
                doc.text(p.originalQuantity.toString(), 150, currentY, { align: 'center' });
                doc.setTextColor(239, 68, 68);
                doc.text(missing.toString(), 180, currentY, { align: 'center' });
                doc.setTextColor(textColor[0], textColor[1], textColor[2]);
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

            // DETECCION DE MOVIL (iOS o Android)
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

            // Solo usamos navigator.share en MOVILES (donde sí funciona WhatsApp bien)
            if (isMobile && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Factura Alfonsa',
                    text: message,
                });
            } else {
                // EN COMPUTADORAS: Forzamos descarga y abrimos WhatsApp Web directamente para evitar el cartel de Windows
                doc.save(fileName);
                const encodedMsg = encodeURIComponent(message);
                const whatsappUrl = `https://api.whatsapp.com/send?phone=${clientPhone}&text=${encodedMsg}`;
                window.open(whatsappUrl, '_blank');
                // Un pequeño aviso solo para PC
                if (!isMobile) {
                    alert("PC DETECTADA: La factura se descargó. Se abrió el chat del cliente; por favor arrastra el PDF al chat para enviarlo.");
                }
            }
        } catch (err) {
            console.error("Error compartiendo factura:", err);
        } finally {
            setIsSharing(false);
        }
    };

    const handleEditQtyClick = (product: Product) => {
        if (!canEditProducts) return;
        setEditingProductCode(product.code);
        setTempValue(product.quantity.toString());
        setEditingPriceCode(null);
    };

    const handleQtySave = (product: Product) => {
        const qty = parseInt(tempValue);
        if (!isNaN(qty) && qty >= 0) {
            onUpdateProduct(product.code, qty);
        }
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
        if (!isNaN(price) && price >= 0 && onUpdatePrice) {
            onUpdatePrice(product.code, price);
        }
        setEditingPriceCode(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent, product: Product, type: 'qty' | 'price') => {
        if (e.key === 'Enter') {
            if (type === 'qty') handleQtySave(product);
            else handlePriceSave(product);
        }
    };

    const handleSaveNewProduct = () => {
        if (!newProdCode || !newProdName || !onAddProduct) return;
        const qty = parseInt(newProdQty) || 1;
        const price = parseFloat(newProdPrice) || 0;
        onAddProduct({
            code: newProdCode,
            name: newProdName,
            originalQuantity: qty,
            quantity: qty,
            unitPrice: price,
            subtotal: qty * price,
            isChecked: false
        });
        setIsAddingProduct(false);
        setNewProdCode('');
        setNewProdName('');
        setNewProdQty('1');
        setNewProdPrice('0');
    };

    const handleDeleteOrderClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (isConfirmingDelete) {
            if (onDeleteOrder) {
                onDeleteOrder(order.id);
                onClose();
            }
        } else {
            setIsConfirmingDelete(true);
            setTimeout(() => setIsConfirmingDelete(false), 4000);
        }
    };

    const handleInvoiceClick = () => {
        setIsGeneratingInvoice(true);
        setTimeout(() => {
            onSave(order, true);
        }, 1000);
    };

    const handlePaymentMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newMethod = e.target.value as PaymentMethod;
        const updatedOrder = updatePaymentMethod(order, newMethod);
        if (isVale) onSave(updatedOrder, false);
    };

    const uncheckedCount = order.products.filter(p => !p.isChecked).length;
    const isReady = uncheckedCount === 0;

    let titleText = "Armado de Pedido";
    let buttonLabel = "Finalizar Armado";
    let icon = <Box size={16} />;

    if (isControlStep) {
        titleText = "Control de Calidad";
        buttonLabel = "Finalizar Control";
        icon = <ShieldCheck size={16} />;
    } else if (isBillingStep) {
        titleText = "Facturación";
        buttonLabel = "Confirmar Facturación";
        icon = <FileText size={16} />;
    } else if (isInvoiceControlStep) {
        titleText = "Control de Factura";
        buttonLabel = "Factura Controlada";
        icon = <ClipboardCheck size={16} />;
    } else if (isReadyForTransit) {
        titleText = "Listo para Despacho";
        buttonLabel = "Enviar a Reparto";
        icon = <Truck size={16} />;
    } else if (isTransitStep) {
        titleText = "En Reparto / Devoluciones";
        buttonLabel = "Marcar Entregado";
        icon = <Truck size={16} />;
    } else if (isFinishedStep) {
        titleText = "Pedido Finalizado";
        buttonLabel = "Cerrar";
        icon = <CheckCircle2 size={16} />;
    }

    const ActionsBlock = () => (
        <div className="flex flex-col gap-3 w-full">
             {occupiedByOther && (
                 <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex flex-col items-center gap-2 text-center animate-pulse">
                    <Activity size={20} className="text-red-500" />
                    <p className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-widest">Pedido en uso</p>
                    <p className="text-[10px] text-muted font-bold leading-tight">Este pedido está siendo trabajado actualmente.</p>
                 </div>
             )}

             {selfControlBlocked && (
                 <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex flex-col items-center gap-2 text-center">
                    <Lock size={20} className="text-red-500" />
                    <p className="text-xs font-black text-red-600 dark:text-red-400 uppercase">Control Bloqueado</p>
                    <p className="text-[10px] text-muted font-bold leading-tight">Debe controlarlo otro armador.</p>
                 </div>
             )}

             {!isFinishedStep && !occupiedByOther ? (
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

                    {showAdvanceButton && !selfControlBlocked && (
                        <button 
                            onClick={() => onSave(order, true)}
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
                                    ${selfControlBlocked || occupiedByOther ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                                      isFinishedStep ? 'bg-green-500/10 text-green-600 border-green-500/20' :
                                      canEditProducts ? 'bg-primary/10 text-primary border-primary/20' : 'bg-gray-500/10 text-gray-500 border-gray-500/20'}
                                `}>
                                    {selfControlBlocked || occupiedByOther ? <Lock size={14}/> : icon}
                                    <span className="hidden md:inline">{selfControlBlocked || occupiedByOther ? 'Bloqueado' : titleText}</span>
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
                    <div className="flex-1 overflow-y-auto bg-background scroll-smooth">
                        <div className="p-4 md:p-6 flex flex-col gap-6">
                            <div className="lg:hidden"><InfoBlock /></div>

                            <div className={selfControlBlocked || occupiedByOther ? 'opacity-40 grayscale pointer-events-none' : ''}>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold text-text">Detalle de Productos</h3>
                                    {isVale && !isAddingProduct && !isFinishedStep && (
                                        <button 
                                            onClick={() => setIsAddingProduct(true)}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surfaceHighlight border border-surfaceHighlight text-text text-xs font-bold transition-all"
                                        >
                                            <Plus size={14} /> Agregar Manual
                                        </button>
                                    )}
                                </div>

                                {isAddingProduct && (
                                    <div className="mb-4 p-4 rounded-xl bg-surface border border-primary/30 shadow-lg animate-in fade-in">
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="text-xs font-bold uppercase text-primary">Nuevo Producto</h4>
                                            <button onClick={() => setIsAddingProduct(false)}><X size={16}/></button>
                                        </div>
                                        <div className="grid grid-cols-12 gap-2">
                                            <input className="col-span-3 p-2 rounded bg-surface border border-surfaceHighlight text-xs" placeholder="Cód" value={newProdCode} onChange={e => setNewProdCode(e.target.value)}/>
                                            <input className="col-span-5 p-2 rounded bg-surface border border-surfaceHighlight text-xs" placeholder="Nombre" value={newProdName} onChange={e => setNewProdName(e.target.value)}/>
                                            <input className="col-span-2 p-2 rounded bg-surface border border-surfaceHighlight text-xs text-center" placeholder="Cant" type="number" value={newProdQty} onChange={e => setNewProdQty(e.target.value)}/>
                                            {showFinancials && <input className="col-span-2 p-2 rounded bg-surface border border-surfaceHighlight text-xs text-right" placeholder="Precio" type="number" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)}/>}
                                            <button onClick={handleSaveNewProduct} className="col-span-12 mt-2 py-2 bg-primary text-white font-bold rounded text-xs">Insertar</button>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="flex flex-col gap-3">
                                    {order.products.map((product) => {
                                        const isEditingQty = editingProductCode === product.code;
                                        const isEditingPrice = editingPriceCode === product.code;
                                        const baseline = product.shippedQuantity ?? product.quantity;
                                        const missingAmount = Math.max(0, product.originalQuantity - baseline);
                                        const isShortage = missingAmount > 0;
                                        const returnedAmount = product.shippedQuantity ? Math.max(0, product.shippedQuantity - product.quantity) : 0;
                                        const isReturned = returnedAmount > 0;

                                        return (
                                            <div key={product.code} className={`flex items-start md:items-center gap-3 p-4 rounded-xl border transition-all ${product.isChecked && !isFinishedStep ? 'bg-green-500/5 border-green-500/20' : 'bg-surface border-surfaceHighlight shadow-sm'}`}>
                                                {!isFinishedStep && (
                                                    <input 
                                                        type="checkbox"
                                                        checked={product.isChecked}
                                                        onChange={() => canEditProducts && onToggleCheck(product.code)}
                                                        disabled={!canEditProducts}
                                                        className="w-5 h-5 rounded border-surfaceHighlight text-primary focus:ring-primary cursor-pointer accent-primary"
                                                    />
                                                )}
                                                
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm leading-tight text-text uppercase">{product.name}</p>
                                                    <div className="flex gap-2 mt-1">
                                                        <span className="text-[10px] font-mono text-muted bg-surfaceHighlight/50 px-1.5 rounded">#{product.code}</span>
                                                        {isShortage && <span className="text-[10px] font-bold text-orange-600 bg-orange-500/10 px-1.5 rounded italic">Faltante: {missingAmount}</span>}
                                                        {isReturned && <span className="text-[10px] font-bold text-red-600 bg-red-500/10 px-1.5 rounded italic">Devolución: {returnedAmount}</span>}
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
                                                            {isShortage && <span className="text-[9px] text-muted font-bold">de {product.originalQuantity}</span>}
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
        </div>
    );
}
