
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
    LogOut
} from 'lucide-react';
import { Order, Product, User, OrderStatus, PaymentMethod } from '../types';
import { updatePaymentMethod } from '../logic';
import { jsPDF } from 'jspdf';

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
    onInvoice?: (order: any) => void; 
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
    onDeleteOrder,
    onInvoice
}) => {
    const [editingProductCode, setEditingProductCode] = useState<string | null>(null);
    const [editingPriceCode, setEditingPriceCode] = useState<string | null>(null);
    const [tempValue, setTempValue] = useState<string>("");
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

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

    const canPrint = isInvoiceControlStep || isReadyForTransit || isTransitStep || isFinishedStep;

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

    const generateInvoicePDF = () => {
        const doc = new jsPDF();
        const primaryColor = [228, 124, 0]; // #e47c00 Alfonsa Orange
        const textColor = [17, 24, 39]; // Gray-900
        const mutedColor = [107, 114, 128]; // Gray-500

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
                doc.text(p.name.substring(0, 45), 35, currentY);
                doc.text(p.quantity.toString(), 130, currentY, { align: 'center' });
                doc.text(`$ ${p.unitPrice.toLocaleString('es-AR')}`, 160, currentY, { align: 'right' });
                doc.text(`$ ${p.subtotal.toLocaleString('es-AR')}`, 190, currentY, { align: 'right' });
                currentY += 7;
                if (currentY > 270) { doc.addPage(); currentY = 20; }
            });
            currentY += 5;
        }

        const shortages = order.products.filter(p => p.originalQuantity > (p.shippedQuantity ?? p.originalQuantity));
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
                const missing = p.originalQuantity - (p.shippedQuantity || p.quantity);
                doc.text(p.code, 20, currentY);
                doc.text(p.name.substring(0, 45), 35, currentY);
                doc.text(p.originalQuantity.toString(), 150, currentY, { align: 'center' });
                doc.setTextColor(239, 68, 68);
                doc.text(missing.toString(), 180, currentY, { align: 'center' });
                doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                currentY += 7;
                if (currentY > 270) { doc.addPage(); currentY = 20; }
            });
            currentY += 5;
        }

        const returns = order.products.filter(p => (p.shippedQuantity ?? p.quantity) > p.quantity);
        if (returns.length > 0) {
            currentY += 10;
            doc.setFontSize(11);
            doc.setTextColor(37, 99, 235);
            doc.text('DEVOLUCIONES REALIZADAS', 20, currentY);
            currentY += 8;

            doc.setFontSize(9);
            doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
            doc.text('CÓD.', 20, currentY);
            doc.text('ARTÍCULO', 35, currentY);
            doc.text('ENVIADO', 150, currentY, { align: 'center' });
            doc.text('DEVUELTO', 180, currentY, { align: 'center' });
            currentY += 3;
            doc.line(20, currentY, 190, currentY);
            currentY += 7;

            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            returns.forEach(p => {
                const returned = (p.shippedQuantity || p.quantity) - p.quantity;
                doc.text(p.code, 20, currentY);
                doc.text(p.name.substring(0, 45), 35, currentY);
                doc.text((p.shippedQuantity || p.quantity).toString(), 150, currentY, { align: 'center' });
                doc.setTextColor(37, 99, 235);
                doc.text(returned.toString(), 180, currentY, { align: 'center' });
                doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                currentY += 7;
                if (currentY > 270) { doc.addPage(); currentY = 20; }
            });
            currentY += 5;
        }

        currentY = Math.max(currentY + 20, 260);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text('TOTAL FINAL A PAGAR:', 130, currentY, { align: 'right' });
        doc.setFontSize(20);
        doc.setTextColor(22, 163, 74);
        doc.text(`$ ${order.total.toLocaleString('es-AR')}`, 190, currentY, { align: 'right' });

        doc.setFontSize(8);
        doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
        doc.text('Comprobante de uso interno - Alfonsa Distribuidora', 105, currentY + 12, { align: 'center' });

        doc.save(`factura-${order.clientName.replace(/\s+/g, '-').toLowerCase()}-${order.displayId}.pdf`);
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
        if (onInvoice) {
            setIsGeneratingInvoice(true);
            setTimeout(() => {
                onInvoice(order);
                onClose();
            }, 1000);
        }
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
                    <p className="text-[10px] text-muted font-bold leading-tight">Este pedido está siendo trabajado actualmente. Solo puedes visualizar.</p>
                 </div>
             )}

             {selfControlBlocked && (
                 <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex flex-col items-center gap-2 text-center">
                    <Lock size={20} className="text-red-500" />
                    <p className="text-xs font-black text-red-600 dark:text-red-400 uppercase">Control Bloqueado</p>
                    <p className="text-[10px] text-muted font-bold leading-tight">No puedes controlar un pedido que tú mismo armaste. Debe hacerlo otro armador.</p>
                 </div>
             )}

             {canEditProducts || isTransitStep || isReadyForTransit || isInvoiceControlStep ? (
                <>
                    {canPrint && isVale && (
                        <button 
                            onClick={generateInvoicePDF}
                            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 mb-2"
                        >
                            <Printer size={18} />
                            Imprimir Factura
                        </button>
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
                            className="w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 shadow-purple-500/20 disabled:opacity-70 disabled:cursor-wait"
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
                            className="py-3 rounded-xl bg-surfaceHighlight text-text font-black border border-surfaceHighlight hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all text-[10px] uppercase flex items-center justify-center gap-2 shadow-sm"
                        >
                            <LogOut size={14} />
                            Liberar Pedido
                        </button>
                    </div>
                    
                    {isVale && !isFinishedStep && onDeleteOrder && (
                        <button 
                            type="button"
                            onClick={handleDeleteOrderClick}
                            className={`mt-4 w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2
                                ${isConfirmingDelete 
                                    ? 'bg-red-600 text-white shadow-lg shadow-red-500/30' 
                                    : 'border border-red-500/30 text-red-500 hover:bg-red-500/10'
                                }`}
                        >
                            {isConfirmingDelete ? <XCircle size={16} /> : <Trash2 size={16} />}
                            {isConfirmingDelete ? "Confirmar Borrado" : "Eliminar Pedido"}
                        </button>
                    )}
                </>
             ) : (
                 <>
                    {isFinishedStep && isVale && (
                        <button 
                            onClick={generateInvoicePDF}
                            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                        >
                            <Printer size={16} />
                            Re-Imprimir Factura
                        </button>
                    )}

                    <button 
                        onClick={onClose}
                        className="w-full py-3 rounded-xl bg-surfaceHighlight hover:bg-surfaceHighlight/80 text-text font-bold transition-colors text-sm"
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
                         <span className="font-medium text-text">$ {originalInvoiceTotal.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                         <span className="text-red-500 font-bold flex items-center gap-1"><RotateCcw size={12}/> Ajustes / Devoluciones</span>
                         <span className="font-bold text-red-500">
                             - $ {refundTotal.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                         </span>
                     </div>
                     <div className="h-px bg-surfaceHighlight my-1"></div>
                     <div className="flex justify-between items-center">
                         <span className="font-bold text-green-600 text-sm">Total Neto Cobrado</span>
                         <span className="font-black text-green-600 text-lg">
                             $ {finalTotal.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                         </span>
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
                                    <span className="md:hidden">{selfControlBlocked || occupiedByOther ? 'Bloqueado' : (isFinishedStep ? 'Resumen' : (canEditProducts ? 'Editando' : 'Lectura'))}</span>
                                </span>
                            </div>
                            <p className="text-muted text-xs md:text-sm font-mono tracking-tight">PEDIDO: {order.displayId}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 md:gap-4">
                        {isVale && canPrint && (
                            <button 
                                onClick={generateInvoicePDF}
                                className="p-2.5 rounded-full bg-blue-500/10 text-blue-600 hover:bg-blue-600 hover:text-white transition-all border border-blue-500/20 shadow-sm"
                                title="Imprimir"
                            >
                                <Printer size={20} />
                            </button>
                        )}

                        {showFinancials && !isFinishedStep && (
                            <div className="hidden md:flex flex-col items-end mr-4">
                                <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Total Actual</span>
                                <span className="text-2xl font-black text-green-600 tracking-tight leading-none">
                                    $ {finalTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        )}
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-surfaceHighlight text-muted hover:text-text transition-colors" title="Liberar y Salir">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
                    <div className="flex-1 overflow-y-auto bg-background scroll-smooth">
                        <div className="p-4 md:p-6 flex flex-col gap-6">
                            <div className="lg:hidden">
                                <InfoBlock />
                                {isFinishedStep && <div className="mt-4"><FinishedFinancialSummary /></div>}
                                {showFinancials && !isFinishedStep && (
                                    <div className="mt-4 p-4 bg-surface rounded-xl border border-surfaceHighlight flex justify-between items-center">
                                        <span className="text-sm font-bold text-muted">Total</span>
                                        <span className="text-xl font-black text-green-600">
                                            $ {finalTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className={selfControlBlocked || occupiedByOther ? 'opacity-40 grayscale pointer-events-none' : ''}>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold text-text">Detalle de Productos</h3>
                                    {isVale && !isAddingProduct && !isFinishedStep && !isTransitStep && !isReadyForTransit && !isInvoiceControlStep && (
                                        <button 
                                            onClick={() => setIsAddingProduct(true)}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surfaceHighlight border border-surfaceHighlight hover:border-primary/50 text-text text-xs font-bold transition-all"
                                        >
                                            <Plus size={14} />
                                            Agregar Manual
                                        </button>
                                    )}
                                </div>

                                {isAddingProduct && (
                                    <div className="mb-4 p-4 rounded-xl bg-surface border border-primary/30 shadow-lg animate-in fade-in slide-in-from-top-2">
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="text-xs font-bold uppercase text-primary tracking-wider">Nuevo Producto al Pedido</h4>
                                            <button onClick={() => setIsAddingProduct(false)} className="text-muted hover:text-text"><X size={16}/></button>
                                        </div>
                                        <div className="grid grid-cols-12 gap-2">
                                            <input 
                                                className="col-span-3 p-2 rounded bg-surface border border-surfaceHighlight text-xs shadow-sm" 
                                                placeholder="Cód" 
                                                value={newProdCode}
                                                onChange={e => setNewProdCode(e.target.value)}
                                            />
                                            <input 
                                                className="col-span-5 p-2 rounded bg-surface border border-surfaceHighlight text-xs shadow-sm" 
                                                placeholder="Nombre Artículo" 
                                                value={newProdName}
                                                onChange={e => setNewProdName(e.target.value)}
                                            />
                                            <input 
                                                className="col-span-2 p-2 rounded bg-surface border border-surfaceHighlight text-xs text-center shadow-sm" 
                                                placeholder="Cant" 
                                                type="number"
                                                value={newProdQty}
                                                onChange={e => setNewProdQty(e.target.value)}
                                            />
                                            {showFinancials ? (
                                                <input 
                                                    className="col-span-2 p-2 rounded bg-surface border border-surfaceHighlight text-xs text-right shadow-sm" 
                                                    placeholder="Precio" 
                                                    type="number"
                                                    value={newProdPrice}
                                                    onChange={e => setNewProdPrice(e.target.value)}
                                                />
                                            ) : <div className="col-span-2"></div>}
                                            <button 
                                                onClick={handleSaveNewProduct}
                                                className="col-span-12 mt-2 py-2 bg-primary text-white font-bold rounded text-xs hover:bg-primaryHover transition-all"
                                            >
                                                Insertar Producto
                                            </button>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="hidden md:flex items-center gap-4 px-4 py-2 text-xs font-bold text-muted uppercase tracking-wider border-b border-surfaceHighlight mb-2">
                                     {!isBillingStep && !isTransitStep && !isFinishedStep && <div className="w-5"></div>}
                                     <div className="w-16 text-center">Código</div>
                                     <div className="flex-1">Artículo</div>
                                     <div className="w-20 text-center">Cant.</div>
                                     {showFinancials && (
                                        <>
                                            <div className="w-28 text-right">P. Unit</div>
                                            <div className="w-32 text-right">Subtotal</div>
                                        </>
                                     )}
                                     {!isBillingStep && !isTransitStep && !isFinishedStep && <div className="w-10 text-center">Acción</div>}
                                </div>

                                <div className="flex flex-col gap-3">
                                    {order.products.map((product) => {
                                        const isEditingQty = editingProductCode === product.code;
                                        const isEditingPrice = editingPriceCode === product.code;
                                        const baseline = product.shippedQuantity ?? product.quantity;
                                        const missingAmount = Math.max(0, product.originalQuantity - baseline);
                                        const isShortage = missingAmount > 0;
                                        const returnedAmount = product.shippedQuantity ? Math.max(0, product.shippedQuantity - product.quantity) : 0;
                                        const isReturned = returnedAmount > 0;
                                        const returnRefund = returnedAmount * product.unitPrice;

                                        return (
                                            <div 
                                                key={product.code} 
                                                className={`flex items-start md:items-center gap-3 md:gap-4 p-4 rounded-xl border transition-all ${
                                                    product.isChecked && !isBillingStep && !isTransitStep && !isFinishedStep
                                                        ? 'bg-green-500/5 border-green-500/20' 
                                                        : 'bg-surface border border-surfaceHighlight shadow-sm'
                                                }`}
                                            >
                                                {!isBillingStep && !isTransitStep && !isFinishedStep && (
                                                    <div className="pt-1 md:pt-0 w-5 flex-shrink-0">
                                                        <input 
                                                            type="checkbox"
                                                            checked={product.isChecked}
                                                            onChange={() => canEditProducts && onToggleCheck(product.code)}
                                                            disabled={!canEditProducts}
                                                            className="w-5 h-5 md:w-5 md:h-5 rounded border-surfaceHighlight text-primary focus:ring-primary cursor-pointer accent-primary disabled:opacity-50"
                                                        />
                                                    </div>
                                                )}
                                                
                                                <div className="hidden md:w-16 items-center justify-center text-sm font-mono text-muted flex-shrink-0">
                                                    <div className="px-2 py-1 rounded bg-background/50 border border-surfaceHighlight">
                                                        {product.code}
                                                    </div>
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 md:hidden">
                                                        <span className="text-[10px] font-mono text-muted bg-surfaceHighlight/50 px-1.5 rounded">{product.code}</span>
                                                    </div>
                                                    <p className={`font-bold text-sm leading-tight text-text`}>
                                                        {product.name}
                                                    </p>
                                                    
                                                    {isShortage && (
                                                        <div className="inline-flex items-center gap-1 mt-2 mr-2 px-2 py-1 rounded border bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20">
                                                            <AlertTriangle size={12} />
                                                            <span className="text-xs font-bold">Faltante: {missingAmount} unid.</span>
                                                        </div>
                                                    )}

                                                    {isReturned && (
                                                        <div className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded border bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                                                            <RotateCcw size={12} />
                                                            <div className="flex flex-col sm:flex-row sm:gap-1">
                                                                <span className="text-xs font-bold">Devolución: {returnedAmount} unid.</span>
                                                                {isFinishedStep && showFinancials && (
                                                                    <span className="text-xs font-black">(-${returnRefund.toLocaleString('es-AR')})</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {showFinancials && (
                                                        <div className="md:hidden mt-2 flex items-center gap-3 text-xs">
                                                             <span className="text-muted">${product.unitPrice.toLocaleString('es-AR')} un.</span>
                                                             <span className="font-bold text-green-600">${product.subtotal.toLocaleString('es-AR')}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="relative flex items-center gap-2 pl-2 border-l border-surfaceHighlight md:border-none md:pl-0 w-20 justify-center flex-shrink-0">
                                                    {isEditingQty ? (
                                                        <div className="flex items-center gap-1 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:static bg-surface shadow-xl md:shadow-none p-2 md:p-0 rounded-lg z-10 border md:border-none border-primary">
                                                            <input 
                                                                type="number"
                                                                value={tempValue}
                                                                onChange={(e) => setTempValue(e.target.value)}
                                                                onKeyDown={(e) => handleKeyDown(e, product, 'qty')}
                                                                className="w-16 px-2 py-1 rounded bg-surface border border-primary text-text text-center font-bold outline-none text-sm"
                                                                autoFocus
                                                            />
                                                            <button 
                                                                onClick={() => handleQtySave(product)}
                                                                className="p-1 rounded bg-green-500/10 text-green-500 hover:bg-green-500/20"
                                                            >
                                                                <Check size={16} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-lg md:text-base font-bold text-center ${isShortage || isReturned ? 'text-orange-500' : 'text-text'}`}>
                                                                    {product.quantity}
                                                                </span>
                                                                {canEditProducts && (
                                                                    <button 
                                                                        onClick={() => handleEditQtyClick(product)}
                                                                        className="p-1.5 text-muted hover:text-primary transition-colors rounded hover:bg-surfaceHighlight"
                                                                        title="Ajustar Cantidad"
                                                                    >
                                                                        <Edit2 size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                            {isShortage && <span className="text-[10px] text-muted font-mono whitespace-nowrap">de {product.originalQuantity}</span>}
                                                        </div>
                                                    )}
                                                </div>

                                                {showFinancials && (
                                                    <>
                                                        <div className="hidden md:block w-28 text-right text-sm text-muted font-medium flex-shrink-0 group/price relative">
                                                            {isEditingPrice ? (
                                                                <div className="flex items-center gap-1 justify-end absolute top-1/2 -translate-y-1/2 right-0 z-10 bg-surface shadow-lg p-1 rounded border border-primary">
                                                                    <span className="text-xs text-muted">$</span>
                                                                    <input 
                                                                        type="number"
                                                                        value={tempValue}
                                                                        onChange={(e) => setTempValue(e.target.value)}
                                                                        onKeyDown={(e) => handleKeyDown(e, product, 'price')}
                                                                        className="w-20 px-1 py-1 rounded bg-surface border-none text-text text-right font-bold outline-none text-xs"
                                                                        autoFocus
                                                                    />
                                                                    <button onClick={() => handlePriceSave(product)} className="text-green-500"><Check size={14}/></button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center justify-end gap-2">
                                                                     <span>$ {product.unitPrice.toLocaleString('es-AR')}</span>
                                                                     {isVale && canEditProducts && (
                                                                        <button 
                                                                            onClick={() => handleEditPriceClick(product)} 
                                                                            className="opacity-0 group-hover/price:opacity-100 p-1 hover:text-primary transition-all"
                                                                        >
                                                                            <Edit2 size={12} />
                                                                        </button>
                                                                     )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="hidden md:block w-32 text-right text-sm font-bold text-green-600 flex-shrink-0">
                                                            $ {product.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                        </div>
                                                    </>
                                                )}

                                                {!isBillingStep && !isTransitStep && !isFinishedStep && (
                                                    <div className="w-10 flex-shrink-0 flex items-center justify-center">
                                                        {isVale && onRemoveProduct && (
                                                            <button 
                                                                onClick={() => onRemoveProduct(product.code)}
                                                                className="p-2 text-muted hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                                                title="Quitar artículo"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="h-40 lg:hidden"></div> 
                        </div>
                    </div>

                    <div className="hidden lg:flex w-96 bg-surface border-l border-surfaceHighlight p-6 flex-col gap-6 overflow-y-auto shrink-0 shadow-[-5px_0_15px_-3px_rgba(0,0,0,0.03)] z-10">
                        <InfoBlock />
                        <FinishedFinancialSummary />
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-bold text-text flex items-center gap-2">
                                <DollarSign size={16} />
                                Método de Pago
                            </label>
                            <select 
                                value={order.paymentMethod || 'Pendiente'}
                                onChange={handlePaymentMethodChange}
                                disabled={!canEditMetadata}
                                className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm text-text focus:border-primary outline-none disabled:opacity-50 shadow-sm font-bold"
                            >
                                <option value="Pendiente">Pendiente</option>
                                <option value="Efectivo">Efectivo</option>
                                <option value="Transferencia">Transferencia</option>
                                <option value="Cheque">Cheque</option>
                                <option value="Cta Cte">Cta Cte</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-bold text-text flex items-center gap-2">
                                <MessageSquare size={16} />
                                Observaciones
                            </label>
                            <textarea 
                                className="w-full h-32 bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm text-text focus:border-primary outline-none resize-none h-20 shadow-inner"
                                placeholder={`Agregar notas internas del pedido...`}
                                value={order.observations || ''}
                                onChange={(e) => onUpdateObservations(e.target.value)}
                                disabled={!canEditMetadata}
                            />
                        </div>
                        <div className="mt-auto"><ActionsBlock /></div>
                        <div className="border-t border-surfaceHighlight pt-6">
                             <h4 className="text-sm font-black text-muted uppercase tracking-widest mb-5 flex items-center gap-2">
                                <Activity size={14} className="text-primary" /> Trazabilidad Completa
                             </h4>
                             <div className="flex flex-col gap-5 relative pl-2">
                                <div className="absolute left-[3px] top-2 bottom-2 w-0.5 bg-surfaceHighlight"></div>
                                {order.history.map((entry, idx) => (
                                    <div key={idx} className="relative pl-6 animate-in slide-in-from-left duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                                        <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-primary ring-4 ring-background"></div>
                                        <p className="text-xs text-text font-black leading-tight mb-0.5">{entry.details || entry.action}</p>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[10px] text-muted font-bold uppercase">{entry.userName}</span>
                                            <span className="text-[9px] text-muted font-mono bg-surfaceHighlight/50 px-1 rounded">
                                                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(entry.timestamp).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    </div>
                    <div className="lg:hidden absolute bottom-0 left-0 w-full bg-surface border-t border-surfaceHighlight p-4 z-30 shadow-[0_-5px_15px_-3px_rgba(0,0,0,0.1)]">
                         <ActionsBlock />
                    </div>
                </div>
            </div>
        </div>
    );
}
