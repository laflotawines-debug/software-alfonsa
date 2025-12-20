
import React, { useState } from 'react';
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
    FileCheck, 
    Truck, 
    RotateCcw, 
    MapPin, 
    Receipt, 
    Printer, 
    CreditCard,
    Lock
} from 'lucide-react';
import { Order, Product, User, OrderStatus, PaymentMethod } from '../types';
import { updatePaymentMethod } from '../logic';

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
    onReprint?: () => void; 
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
    onInvoice,
    onReprint
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

    const hasBeenInvoiced = isInvoiceControlStep || isReadyForTransit || isTransitStep || isFinishedStep;

    const isOriginalAssembler = order.assemblerId === currentUser.id;
    const isReadyForControl = order.status === OrderStatus.ARMADO;
    const selfControlBlocked = isOriginalAssembler && isReadyForControl && currentUser.role === 'armador';

    const canEditProducts = !isFinishedStep && !selfControlBlocked && (
        isVale || 
        (currentUser.role === 'armador' && order.status === OrderStatus.EN_ARMADO) ||
        (currentUser.role === 'armador' && isControlStep) ||
        (currentUser.role === 'armador' && isTransitStep) ||
        isInvoiceControlStep ||
        isReadyForTransit
    );

    const canEditMetadata = isVale;
    const showAdvanceButton = !isBillingStep && !isTransitStep && !isFinishedStep; 
    const assemblerName = order.history.find(h => h.newState === OrderStatus.ARMADO)?.userName || order.assemblerId || '-';
    const showFinancials = isVale;

    const originalInvoiceTotal = order.products.reduce((acc, p) => acc + (p.originalQuantity * p.unitPrice), 0);
    const finalTotal = order.total;
    const refundTotal = originalInvoiceTotal - finalTotal;

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

    const handlePaperControlClick = () => {
        onSave(order, true);
    };

    const handlePaymentMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newMethod = e.target.value as PaymentMethod;
        const updatedOrder = updatePaymentMethod(order, newMethod);
        // Persistimos inmediatamente el cambio de método de pago si es el vale
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
        buttonLabel = "Generar Factura";
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
        titleText = "En Tránsito / Devoluciones";
        buttonLabel = "Marcar Entregado";
        icon = <Truck size={16} />;
    } else if (isFinishedStep) {
        titleText = "Pedido Entregado";
        buttonLabel = "Cerrar";
        icon = <MapPin size={16} />;
    }

    const ActionsBlock = () => (
        <div className="flex flex-col gap-3 w-full">
             {selfControlBlocked && (
                 <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex flex-col items-center gap-2 text-center">
                    <Lock size={20} className="text-red-500" />
                    <p className="text-xs font-black text-red-600 dark:text-red-400 uppercase">Control Bloqueado</p>
                    <p className="text-[10px] text-muted font-bold leading-tight">No puedes controlar un pedido que tú mismo armaste. Debe hacerlo otro armador.</p>
                 </div>
             )}

             {canEditProducts || isTransitStep || isReadyForTransit || isInvoiceControlStep ? (
                <>
                    {hasBeenInvoiced && isVale && onReprint && (
                        <button 
                            onClick={onReprint}
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
                            {isGeneratingInvoice ? "Generando Factura..." : "Confirmar y Facturar"}
                        </button>
                    )}

                    {/* Botón de Guardar y Salir siempre disponible si hay capacidad de edición o estamos en reparto */}
                    <button 
                        onClick={() => onSave(order, false)}
                        className={`w-full py-3 rounded-xl border border-surfaceHighlight text-text font-bold hover:bg-surfaceHighlight transition-colors text-sm flex items-center justify-center gap-2 
                        ${(!showAdvanceButton && !isBillingStep) ? 'bg-primary text-white border-primary hover:bg-primaryHover' : ''}`}
                    >
                        <Save size={16} />
                        Guardar Cambios
                    </button>
                    
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
                            {isConfirmingDelete ? "¿Confirmar eliminación?" : "Eliminar Pedido"}
                        </button>
                    )}
                </>
             ) : (
                 <>
                    {isFinishedStep && isVale && onReprint && (
                        <button 
                            onClick={onReprint}
                            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                        >
                            <Printer size={16} />
                            Volver a Imprimir Factura
                        </button>
                    )}

                    {!selfControlBlocked && (
                        <button 
                            onClick={onClose}
                            className="w-full py-3 rounded-xl bg-surfaceHighlight hover:bg-surfaceHighlight/80 text-text font-bold transition-colors text-sm"
                        >
                            Cerrar Detalle
                        </button>
                    )}
                 </>
             )}
        </div>
    );

    const InfoBlock = () => (
        <div className="bg-surface rounded-xl p-5 border border-surfaceHighlight shadow-sm">
            <h4 className="text-sm font-bold text-muted uppercase tracking-wider mb-3">Información del Cliente</h4>
            <div className="space-y-3">
                <p className="text-sm flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                    <span className="text-muted">Nombre:</span> 
                    <span className="text-text font-bold text-base">{order.clientName}</span>
                </p>
                <p className="text-sm flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                    <span className="text-muted">Creado:</span> 
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
                    <span className="text-muted flex items-center gap-1"><UserCheck size={14}/> Armado por:</span> 
                    <span className="text-text font-bold">{assemblerName}</span>
                </p>
            </div>
        </div>
    );

    const FinishedFinancialSummary = () => {
        if (!isFinishedStep || !showFinancials) return null;
        return (
            <div className="bg-surface rounded-xl p-0 border border-surfaceHighlight shadow-sm overflow-hidden mb-4">
                 <div className="bg-surfaceHighlight/30 p-3 border-b border-surfaceHighlight">
                    <h4 className="text-sm font-bold text-text flex items-center gap-2">
                        <Receipt size={16} className="text-muted" />
                        Resumen de Cierre
                    </h4>
                 </div>
                 <div className="p-4 space-y-3">
                     <div className="flex justify-between items-center text-sm">
                         <span className="text-muted">Total Facturado (Original)</span>
                         <span className="font-medium text-text">$ {originalInvoiceTotal.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                         <span className="text-red-500 font-bold flex items-center gap-1"><RotateCcw size={12}/> Devoluciones (NC)</span>
                         <span className="font-bold text-red-500">
                             - $ {refundTotal.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                         </span>
                     </div>
                     <div className="h-px bg-surfaceHighlight my-1"></div>
                     <div className="flex justify-between items-center">
                         <span className="font-bold text-green-600 text-sm">Total Cobrado (Final)</span>
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
                                    ${selfControlBlocked ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                                      canEditProducts ? 'bg-primary/10 text-primary border-primary/20' : 'bg-gray-500/10 text-gray-500 border-gray-500/20'}
                                `}>
                                    {selfControlBlocked ? <Lock size={14}/> : icon}
                                    <span className="hidden md:inline">{selfControlBlocked ? 'Bloqueado' : titleText}</span>
                                    <span className="md:hidden">{selfControlBlocked ? 'Bloqueado' : (canEditProducts ? 'Editando' : 'Solo Lectura')}</span>
                                </span>
                            </div>
                            <p className="text-muted text-xs md:text-sm font-mono">ID: {order.displayId}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 md:gap-4">
                        {isVale && hasBeenInvoiced && onReprint && (
                            <button 
                                onClick={onReprint}
                                className="p-2.5 rounded-full bg-blue-500/10 text-blue-600 hover:bg-blue-600 hover:text-white transition-all border border-blue-500/20 shadow-sm"
                                title="Imprimir Factura (Acceso Rápido)"
                            >
                                <Printer size={20} />
                            </button>
                        )}

                        {showFinancials && !isFinishedStep && (
                            <div className="hidden md:flex flex-col items-end mr-4">
                                <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Total</span>
                                <span className="text-2xl font-black text-green-600 tracking-tight leading-none">
                                    $ {finalTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
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

                            <div className={selfControlBlocked ? 'opacity-40 grayscale pointer-events-none' : ''}>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold text-text">Productos</h3>
                                    {isVale && !isAddingProduct && !isBillingStep && !isInvoiceControlStep && !isReadyForTransit && !isTransitStep && !isFinishedStep && (
                                        <button 
                                            onClick={() => setIsAddingProduct(true)}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surfaceHighlight border border-surfaceHighlight hover:border-primary/50 text-text text-xs font-bold transition-all"
                                        >
                                            <Plus size={14} />
                                            Agregar Producto
                                        </button>
                                    )}
                                </div>

                                {isAddingProduct && (
                                    <div className="mb-4 p-4 rounded-xl bg-surface border border-primary/30 shadow-lg animate-in fade-in slide-in-from-top-2">
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="text-xs font-bold uppercase text-primary tracking-wider">Nuevo Producto</h4>
                                            <button onClick={() => setIsAddingProduct(false)} className="text-muted hover:text-text"><X size={16}/></button>
                                        </div>
                                        <div className="grid grid-cols-12 gap-2">
                                            <input 
                                                className="col-span-3 p-2 rounded bg-surface border border-surfaceHighlight text-xs shadow-sm" 
                                                placeholder="Código" 
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
                                                className="col-span-12 mt-2 py-2 bg-primary text-white font-bold rounded text-xs hover:bg-primaryHover"
                                            >
                                                Confirmar Agregado
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
                                                        : 'bg-surface border border-surfaceHighlight'
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
                                                                        title="Editar Cantidad"
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
                                                                title="Eliminar artículo"
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
                                <CreditCard size={16} />
                                Método de Pago
                            </label>
                            <select 
                                value={order.paymentMethod || 'Pendiente'}
                                onChange={handlePaymentMethodChange}
                                disabled={!canEditMetadata}
                                className="w-full bg-surface border border-surfaceHighlight rounded-xl p-3 text-sm text-text focus:border-primary outline-none disabled:opacity-50 shadow-sm"
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
                                placeholder={`Agregar observaciones...`}
                                value={order.observations || ''}
                                onChange={(e) => onUpdateObservations(e.target.value)}
                                disabled={!canEditMetadata}
                            />
                        </div>
                        <div className="mt-auto"><ActionsBlock /></div>
                        <div className="border-t border-surfaceHighlight pt-6">
                             <h4 className="text-sm font-bold text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Clock size={14} /> Historial Reciente
                             </h4>
                             <div className="flex flex-col gap-4 relative pl-2">
                                <div className="absolute left-[3px] top-2 bottom-2 w-0.5 bg-surfaceHighlight"></div>
                                {order.history.slice(0, 3).map((entry, idx) => (
                                    <div key={idx} className="relative pl-6">
                                        <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-primary ring-4 ring-background"></div>
                                        <p className="text-xs text-text font-medium leading-snug">{entry.details || entry.action}</p>
                                        <p className="text-[10px] text-muted mt-0.5">
                                            {new Date(entry.timestamp).toLocaleDateString()} por {entry.userName}
                                        </p>
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
