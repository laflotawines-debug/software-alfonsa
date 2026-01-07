
import { 
    Order, 
    Product, 
    OrderStatus, 
    User, 
    OrderZone,
    PaymentMethod,
    HistoryEntry,
    View
} from './types';

// ==========================================
// 1. NAVIGATION STRUCTURE (Moved for sync)
// ==========================================

export const SYSTEM_NAV_STRUCTURE = [
  { 
    id: View.DASHBOARD, 
    label: 'Tablero', 
    permission: 'dashboard.view',
    module: 'General'
  },
  { 
    id: View.ORDERS, 
    label: 'Pedidos', 
    module: 'Pedidos',
    subItems: [
        { id: View.ORDERS, label: 'Gestión de pedidos', permission: 'orders.view' },
        { id: View.ORDER_SHEET, label: 'Planilla de Viajes', permission: 'orders.sheet' },
    ]
  },
  { 
    id: View.PAYMENTS_OVERVIEW, 
    label: 'Gestión de pagos', 
    module: 'Pagos',
    subItems: [
        { id: View.PAYMENTS_OVERVIEW, label: 'Vista general', permission: 'payments.view' },
        { id: View.PAYMENTS_PROVIDERS, label: 'Proveedores Pagos', permission: 'payments.providers' },
        { id: View.PAYMENTS_HISTORY, label: 'Historial', permission: 'payments.history' },
    ]
  },
  {
    id: View.INV_INBOUNDS,
    label: 'Inventario',
    module: 'Inventario',
    subItems: [
        { id: View.INV_INBOUNDS, label: 'Ingresos', permission: 'inventory.inbounds' },
        { id: View.INV_SUPPLIER_ORDERS, label: 'Pedidos Proveedores', permission: 'inventory.supplier_orders' },
        { id: View.INV_ADJUSTMENTS, label: 'Ajustes', permission: 'inventory.adjustments' },
        { id: View.INV_TRANSFERS, label: 'Transferencias', permission: 'inventory.transfers' },
        { id: View.INV_HISTORY, label: 'Seguimiento', permission: 'inventory.history' },
    ]
  },
  { 
    id: View.CATALOG, 
    label: 'Maestros', 
    module: 'Maestros',
    subItems: [
        { id: View.CATALOG, label: 'Artículos', permission: 'catalog.products' },
        { id: View.CLIENTS_MASTER, label: 'Clientes', permission: 'catalog.clients' },
        { id: View.SUPPLIERS_MASTER, label: 'Proveedores', permission: 'catalog.suppliers' },
    ]
  },
  { 
    id: View.PRESUPUESTADOR,
    label: 'Herramientas', 
    module: 'Herramientas',
    subItems: [
        { id: View.STOCK_CONTROL, label: 'Control de Stock', permission: 'tools.stock_control' },
        { id: View.PRESUPUESTADOR, label: 'Presupuestador', permission: 'tools.presupuestador' },
        { id: View.ETIQUETADOR, label: 'Etiquetador', permission: 'tools.etiquetador' },
        { id: View.EXPIRATIONS, label: 'Vencimientos', permission: 'tools.expirations' },
        { id: View.LISTA_CHINA, label: 'Lista china', permission: 'tools.lista_china' },
        { id: View.SQL_EDITOR, label: 'Editor SQL', permission: 'tools.sql_editor' },
    ]
  },
  { id: View.HISTORY, label: 'Historial', permission: 'history.view', module: 'General' },
];

// ==========================================
// 2. PAYMENT UTILITIES
// ==========================================

export const getProviderProgress = (providerId: string, transfers: any[]) => {
    const providerTransfers = transfers.filter(t => t.providerId === providerId);
    const realized = providerTransfers
        .filter(t => t.status === 'Realizado')
        .reduce((sum, t) => sum + t.amount, 0);
    const pending = providerTransfers
        .filter(t => t.status === 'Pendiente')
        .reduce((sum, t) => sum + t.amount, 0);
    
    return { realized, pending };
};

export const reorder = <T>(list: T[], startIndex: number, endIndex: number): T[] => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
};

// ==========================================
// 3. ORDER LOGIC
// ==========================================

export const ORDER_WORKFLOW: Record<OrderStatus, { label: string; next?: OrderStatus }> = {
    [OrderStatus.EN_ARMADO]: { label: 'En Armado', next: OrderStatus.ARMADO },
    [OrderStatus.ARMADO]: { label: 'Armado', next: OrderStatus.ARMADO_CONTROLADO },
    [OrderStatus.ARMADO_CONTROLADO]: { label: 'Controlado', next: OrderStatus.FACTURADO },
    [OrderStatus.FACTURADO]: { label: 'Facturado', next: OrderStatus.FACTURA_CONTROLADA },
    [OrderStatus.FACTURA_CONTROLADA]: { label: 'Factura Controlada', next: OrderStatus.EN_TRANSITO },
    [OrderStatus.EN_TRANSITO]: { label: 'En Reparto', next: OrderStatus.ENTREGADO },
    [OrderStatus.ENTREGADO]: { label: 'Entregado', next: OrderStatus.PAGADO },
    [OrderStatus.PAGADO]: { label: 'Pagado' }
};

export const getStatusColor = (status: OrderStatus): string => {
    switch (status) {
        case OrderStatus.PAGADO:
            return 'bg-green-500 text-white border-green-600 border'; 
        case OrderStatus.ENTREGADO:
            return 'bg-blue-500/10 text-blue-600 dark:text-blue-500 border-blue-500/20 border';
        case OrderStatus.EN_ARMADO:
        case OrderStatus.ARMADO:
            return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-200 border';
        case OrderStatus.ARMADO_CONTROLADO:
            return 'bg-orange-500/10 text-orange-600 dark:text-orange-500 border-orange-200 border';
        case OrderStatus.FACTURADO:
        case OrderStatus.FACTURA_CONTROLADA:
            return 'bg-purple-500/10 text-purple-600 dark:text-purple-600 border-purple-200 border';
        case OrderStatus.EN_TRANSITO:
            return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-500 border-indigo-200 border';
        default:
            return 'bg-gray-500/10 text-gray-500 border-gray-200 border';
    }
};

export const getZoneStyles = (zone?: OrderZone) => {
    switch (zone) {
        case 'V. Mercedes':
            return {
                borderColor: 'border-cyan-500',
                badgeBg: 'bg-cyan-500/10',
                badgeText: 'text-cyan-600 dark:text-cyan-400',
                gradient: 'from-cyan-500/20 to-transparent'
            };
        case 'San Luis':
            return {
                borderColor: 'border-fuchsia-500',
                badgeBg: 'bg-fuchsia-500/10',
                badgeText: 'text-fuchsia-600 dark:text-fuchsia-400',
                gradient: 'from-fuchsia-500/20 to-transparent'
            };
        case 'Norte':
            return {
                borderColor: 'border-amber-500',
                badgeBg: 'bg-amber-500/10',
                badgeText: 'text-amber-600 dark:text-amber-400',
                gradient: 'from-amber-500/20 to-transparent'
            };
        default:
            return {
                borderColor: 'border-surfaceHighlight',
                badgeBg: 'bg-surfaceHighlight',
                badgeText: 'text-muted',
                gradient: 'from-surfaceHighlight to-transparent'
            };
    }
};

export const getMissingProducts = (order: Order) => {
    return order.products.filter(p => {
        const baseline = p.shippedQuantity ?? p.quantity;
        return baseline < p.originalQuantity;
    });
};

export const getReturnedProducts = (order: Order) => {
    return order.products.map(p => ({
        ...p,
        returnedAmount: p.shippedQuantity ? Math.max(0, p.shippedQuantity - p.quantity) : 0
    })).filter(p => p.returnedAmount > 0);
};

export const applyQuantityChange = (order: Order, productCode: string, qty: number): Order => {
    const products = order.products.map(p => {
        if (p.code === productCode) {
            return { ...p, quantity: qty, subtotal: qty * p.unitPrice };
        }
        return p;
    });
    const total = products.reduce((sum, p) => sum + p.subtotal, 0);
    return { ...order, products, total };
};

export const toggleProductCheck = (order: Order, productCode: string): Order => {
    const products = order.products.map(p => {
        if (p.code === productCode) {
            return { ...p, isChecked: !p.isChecked };
        }
        return p;
    });
    return { ...order, products };
};

export const updateObservations = (order: Order, text: string): Order => {
    return { ...order, observations: text };
};

export const advanceOrderStatus = (order: Order, user: User): Order => {
    const currentStatus = order.status;
    const nextStatus = ORDER_WORKFLOW[currentStatus]?.next || currentStatus;
    
    let assemblerId = order.assemblerId;
    let assemblerName = order.assemblerName;
    let controllerId = order.controllerId;
    let controllerName = order.controllerName;
    let invoicerName = order.invoicerName;
    let products = order.products;

    if (nextStatus === OrderStatus.EN_TRANSITO) {
        products = products.map(p => ({
            ...p,
            shippedQuantity: p.quantity
        }));
    }

    // Registro de quién hace cada paso basado en el cambio de estado
    if (currentStatus === OrderStatus.EN_ARMADO && nextStatus === OrderStatus.ARMADO) {
        assemblerId = user.id;
        assemblerName = user.name;
    } else if (currentStatus === OrderStatus.ARMADO && nextStatus === OrderStatus.ARMADO_CONTROLADO) {
        controllerId = user.id;
        controllerName = user.name;
    } else if (currentStatus === OrderStatus.ARMADO_CONTROLADO && nextStatus === OrderStatus.FACTURADO) {
        invoicerName = user.name;
    }

    const historyEntry: HistoryEntry = {
        timestamp: new Date().toISOString(),
        userId: user.id,
        userName: user.name,
        action: 'STATUS_CHANGE',
        details: `Pedido avanzado a ${ORDER_WORKFLOW[nextStatus].label} por ${user.name}`,
        previousState: currentStatus,
        newState: nextStatus
    };

    return {
        ...order,
        status: nextStatus,
        products,
        assemblerId,
        assemblerName,
        controllerId,
        controllerName,
        invoicerName,
        history: [historyEntry, ...(order.history || [])]
    };
};

export const addProductToOrder = (order: Order, product: Product): Order => {
    const products = [...(order.products || []), product];
    const total = products.reduce((sum, p) => sum + p.subtotal, 0);
    return { ...order, products, total };
};

export const updateProductPrice = (order: Order, productCode: string, newPrice: number): Order => {
    const products = order.products.map(p => {
        if (p.code === productCode) {
            return { ...p, unitPrice: newPrice, subtotal: p.quantity * newPrice };
        }
        return p;
    });
    const total = products.reduce((sum, p) => sum + p.subtotal, 0);
    return { ...order, products, total };
};

export const removeProductFromOrder = (order: Order, productCode: string): Order => {
    const products = order.products.filter(p => p.code !== productCode);
    const total = products.reduce((sum, p) => sum + p.subtotal, 0);
    return { ...order, products, total };
};

export const updatePaymentMethod = (order: Order, method: PaymentMethod): Order => {
    return { ...order, paymentMethod: method };
};

export const parseOrderText = (text: string): Product[] => {
    const products: Product[] = [];
    const lines = text.split('\n');
    const regex = /(\d+)\s*(?:\(x(\d+)\))?\s*(?:(\d+)\s+)?(\d+)\s+(.*?)\s+\$\s*([\d.,]+)\s+\$\s*([\d.,]+)/i;

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const match = trimmed.match(regex);
        if (match) {
            const baseQty = parseInt(match[1]);
            const multiplier = match[2] ? parseInt(match[2]) : 1;
            const extraQty = match[3] ? parseInt(match[3]) : 0;
            const quantity = (baseQty * multiplier) + extraQty;
            const code = match[4];
            let rawName = match[5].trim();
            let name = rawName;
            if (rawName.includes(' - ')) name = rawName.split(' - ')[0].trim();
            else if (rawName.endsWith(' -')) name = rawName.slice(0, -2).trim();
            const unitPrice = parseFloat(match[6].replace(/\./g, '').replace(',', '.'));
            const subtotal = parseFloat(match[7].replace(/\./g, '').replace(',', '.'));
            products.push({ code, name, originalQuantity: quantity, quantity, unitPrice, subtotal, isChecked: false });
        }
    });
    return products;
};
