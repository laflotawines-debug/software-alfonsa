
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
// 0. PERMISSION HELPER
// ==========================================
export const hasPermission = (user: User, permissionKey: string): boolean => {
    if (user.role === 'vale') return true;
    
    // Restricción explícita: El dashboard es solo para administradores
    if (user.role === 'armador' && permissionKey === 'dashboard.view') return false;

    return (user.permissions || []).includes(permissionKey);
};

// ==========================================
// 1. NAVIGATION STRUCTURE
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
        { id: View.CREATE_BUDGET, label: 'Crear nuevo pedido', permission: 'orders.create' },
        { id: View.ORDER_SHEET, label: 'Planilla de Viajes', permission: 'orders.sheet' },
    ]
  },
  { 
    id: View.PAYMENTS_OVERVIEW, 
    label: 'Gestión de pagos', 
    module: 'Pagos',
    subItems: [
        { id: View.PAYMENTS_OVERVIEW, label: 'Tablero de Pagos', permission: 'payments.view' },
        { id: View.PAYMENTS_PROVIDERS, label: 'Proveedores Pagos', permission: 'payments.providers' },
        { id: View.PAYMENTS_HISTORY, label: 'Historial', permission: 'payments.history' },
    ]
  },
  {
    id: View.PROVIDERS,
    label: 'Proveedores',
    module: 'Proveedores',
    subItems: [
        { id: View.SUPPLIERS_MASTER, label: 'Gestión de Proveedores', permission: 'catalog.suppliers' },
        { id: View.PROVIDER_STATEMENTS, label: 'Estados de Cuenta', permission: 'payments.statements' }
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
    id: View.CLIENTS_MASTER, 
    label: 'Clientes', 
    module: 'Clientes',
    subItems: [
        { id: View.CLIENTS_MASTER, label: 'Gestión de clientes', permission: 'catalog.clients' },
        { id: View.CLIENT_COLLECTIONS, label: 'Cobranzas', permission: 'catalog.collections' },
        { id: View.CLIENT_STATEMENTS, label: 'Estados de Cuenta', permission: 'catalog.statements' },
    ]
  },
  { 
    id: View.CATALOG, 
    label: 'Maestros', 
    module: 'Maestros',
    subItems: [
        { id: View.CATALOG, label: 'Artículos', permission: 'catalog.products' },
    ]
  },
  { 
    id: View.PRESUPUESTADOR,
    label: 'Herramientas', 
    module: 'Herramientas',
    subItems: [
        { id: View.ATTENDANCE, label: 'Asistencias', permission: 'tools.attendance' },
        { id: View.PRICE_MANAGEMENT, label: 'Gestión de Precios', permission: 'tools.price_management' },
        { id: View.STOCK_CONTROL, label: 'Control de Stock', permission: 'tools.stock_control' },
        { id: View.PRESUPUESTADOR, label: 'Presupuestador', permission: 'tools.presupuestador' },
        { id: View.ETIQUETADOR, label: 'Etiquetador', permission: 'tools.etiquetador' },
        { id: View.EXPIRATIONS, label: 'Vencimientos', permission: 'tools.expirations' },
        { id: View.LISTA_CHINA, label: 'Lista china', permission: 'tools.lista_china' },
    ]
  }
];

export const EXTRA_PERMISSIONS = [
    { key: 'orders.sheet_manage', label: 'Gestionar/Borrar Viajes', module: 'Pedidos' },
    { key: 'orders.print_and_price', label: 'Imprimir y Ver Precios (Armador)', module: 'Pedidos' },
    { key: 'tools.attendance', label: 'Asistencia', module: 'Herramientas' },
    { key: 'catalog.clients', label: 'Gestión de Clientes', module: 'Clientes' },
    { key: 'catalog.collections', label: 'Cobranzas Clientes', module: 'Clientes' }
];

export const roundToCommercial = (val: number): number => {
    if (!val || isNaN(val)) return 0;
    return Math.round(val / 50) * 50;
};

// --- LOGIC EXPORTS ---

export const ORDER_WORKFLOW: Record<OrderStatus, { label: string; color: string; next?: OrderStatus }> = {
    [OrderStatus.EN_ARMADO]: { label: 'En Armado', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', next: OrderStatus.ARMADO },
    [OrderStatus.ARMADO]: { label: 'Armado', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20', next: OrderStatus.ARMADO_CONTROLADO },
    [OrderStatus.ARMADO_CONTROLADO]: { label: 'Armado Controlado', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20', next: OrderStatus.FACTURADO },
    [OrderStatus.FACTURADO]: { label: 'Facturado', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20', next: OrderStatus.FACTURA_CONTROLADA },
    [OrderStatus.FACTURA_CONTROLADA]: { label: 'Factura Controlada', color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20', next: OrderStatus.EN_TRANSITO },
    [OrderStatus.EN_TRANSITO]: { label: 'En Tránsito', color: 'bg-blue-600/10 text-blue-600 border-blue-600/20', next: OrderStatus.ENTREGADO },
    [OrderStatus.ENTREGADO]: { label: 'Entregado', color: 'bg-green-500/10 text-green-500 border-green-500/20', next: OrderStatus.PAGADO },
    [OrderStatus.PAGADO]: { label: 'Pagado', color: 'bg-green-600/10 text-green-600 border-green-600/20' }
};

export const getStatusColor = (status: OrderStatus) => {
    return ORDER_WORKFLOW[status]?.color || 'bg-surfaceHighlight/10 text-muted border-surfaceHighlight';
};

export const getZoneStyles = (zone?: OrderZone) => {
    if (!zone) return { borderColor: 'border-surfaceHighlight', badgeBg: 'bg-surfaceHighlight', badgeText: 'text-muted' };
    
    // Normalize string for checking known zones
    const zoneLower = zone.toLowerCase().trim();

    if (zoneLower.includes('mercedes')) return { borderColor: 'border-blue-500', badgeBg: 'bg-blue-500/10', badgeText: 'text-blue-500' };
    if (zoneLower.includes('san luis')) return { borderColor: 'border-purple-500', badgeBg: 'bg-purple-500/10', badgeText: 'text-purple-500' };
    if (zoneLower.includes('norte')) return { borderColor: 'border-orange-500', badgeBg: 'bg-orange-500/10', badgeText: 'text-orange-500' };
    
    // Default style for new dynamic zones (e.g. Merlo)
    return { borderColor: 'border-emerald-500', badgeBg: 'bg-emerald-500/10', badgeText: 'text-emerald-500' };
};

/**
 * Calcula el monto que realmente salió despachado (lo facturado).
 * Si el pedido ya pasó por el despacho, usamos 'shipped_quantity'.
 * Si no, lo que se haya armado ('quantity').
 */
export const getOrderShippedTotal = (order: Order): number => {
    return (order.products || []).reduce((acc, p) => {
        const qtyToUse = p.shippedQuantity ?? p.quantity;
        return acc + (qtyToUse * p.unitPrice);
    }, 0);
};

/**
 * Calcula el monto total original del presupuesto (intención inicial).
 * Los items agregados a posteriori (originalQuantity <= 0) no suman al total de presupuesto original.
 */
export const getOrderOriginalTotal = (order: Order): number => {
    return (order.products || []).reduce((acc, p) => {
        const baseQty = Math.max(0, p.originalQuantity);
        return acc + (baseQty * p.unitPrice);
    }, 0);
};

/**
 * Calcula el monto total de las devoluciones (Notas de Crédito) de un pedido.
 * Solo aplica si el pedido estuvo o está en reparto.
 */
export const getOrderRefundTotal = (order: Order): number => {
    // Si no ha llegado a tránsito, no hay "devolución" monetaria aún, solo faltantes de stock.
    const hasBeenInTransit = [OrderStatus.EN_TRANSITO, OrderStatus.ENTREGADO, OrderStatus.PAGADO].includes(order.status);
    if (!hasBeenInTransit) return 0;

    const shippedTotal = getOrderShippedTotal(order);
    const deliveredTotal = order.total || 0;
    
    return Math.max(0, shippedTotal - deliveredTotal);
};

/**
 * Obtiene lista de productos con faltantes.
 * Usa valor absoluto para soportar productos agregados manualmente con flag negativo.
 */
export const getMissingProducts = (order: Order) => {
    return order.products.filter(p => {
        const absOrig = Math.abs(p.originalQuantity);
        const actual = p.shippedQuantity ?? p.quantity;
        return absOrig > actual;
    });
};

export const getReturnedProducts = (order: Order) => {
    return order.products.filter(p => p.shippedQuantity && p.shippedQuantity > p.quantity);
};

export const applyQuantityChange = (order: Order, code: string, qty: number): Order => {
    const products = order.products.map(p => {
        if (p.code !== code) return p;
        return { ...p, quantity: qty, subtotal: qty * p.unitPrice };
    });
    const total = products.reduce((acc, p) => acc + p.subtotal, 0);
    return { ...order, products, total };
};

export const toggleProductCheck = (order: Order, code: string): Order => {
    const products = order.products.map(p => {
        if (p.code !== code) return p;
        return { ...p, isChecked: !p.isChecked };
    });
    return { ...order, products };
};

export const updateObservations = (order: Order, text: string): Order => {
    return { ...order, observations: text };
};

export const advanceOrderStatus = (order: Order): Order => {
    const nextStatus = ORDER_WORKFLOW[order.status]?.next;
    if (!nextStatus) return order;
    return { ...order, status: nextStatus };
};

export const addProductToOrder = (order: Order, product: Product): Order => {
    const products = [...order.products, product];
    const total = products.reduce((acc, p) => acc + p.subtotal, 0);
    return { ...order, products, total };
};

export const updateProductPrice = (order: Order, code: string, price: number): Order => {
    const products = order.products.map(p => {
        if (p.code !== code) return p;
        return { ...p, unitPrice: price, subtotal: p.quantity * price };
    });
    const total = products.reduce((acc, p) => acc + p.subtotal, 0);
    return { ...order, products, total };
};

export const removeProductFromOrder = (order: Order, code: string): Order => {
    const products = order.products.filter(p => p.code !== code);
    const total = products.reduce((acc, p) => acc + p.subtotal, 0);
    return { ...order, products, total };
};

/**
 * Parsea el texto pegado del PDF/Sistema.
 * Optimizada para detectar bultos, multiplicadores, UNIDADES SUELTAS, códigos y nombres.
 */
export const parseOrderText = (text: string): Product[] => {
    const lines = text.split('\n');
    const products: Product[] = [];
    
    /**
     * REGEX ACTUALIZADA PARA SOPORTAR UNIDADES SUELTAS
     * 1. ^(\d+) -> Cantidad de Bultos/Cajas.
     * 2. (?:\s*\(x?(\d+)\))? -> Multiplicador opcional (x6).
     * 3. \s+(\S+) -> Token A (Puede ser sueltas o código).
     * 4. (?:\s+(\S+))? -> Token B (Opcional, puede ser código o parte del nombre).
     * 5. \s+(.*?) -> El resto del nombre.
     * 6. ... precios ...
     */
    const regex = /^(\d+)(?:\s*\(x?(\d+)\))?\s+(\S+)(?:\s+(\S+))?\s+(.*?)(?:\s*[-–—]\s*)?\$[\s\t]*([\d,.]+)\s*\$[\s\t]*([\d,.]+)/i;

    lines.forEach(line => {
        const match = line.trim().match(regex);
        if (match) {
            const bultos = parseInt(match[1]);
            const multiplier = match[2] ? parseInt(match[2]) : 1;
            
            const tokenA = match[3].trim(); // Podría ser '4' o '8287'
            const tokenB = match[4] ? match[4].trim() : null; // Podría ser '4464' o 'PATAGONIA'
            let nameRest = match[5].trim();
            
            let looseUnits = 0;
            let code = tokenA;
            let finalName = nameRest;

            // Lógica de desambiguación para detectar si TokenA es unidad suelta
            const isTokenANumeric = /^\d+$/.test(tokenA);
            const isTokenBNumeric = tokenB ? /^\d+$/.test(tokenB) : false;

            if (tokenB) {
                if (isTokenANumeric && isTokenBNumeric) {
                    // CASO: 1 (x6) 4 4464 ... -> A=4 (Sueltas), B=4464 (Código)
                    looseUnits = parseInt(tokenA);
                    code = tokenB;
                    finalName = nameRest; 
                } else {
                    // CASO: 1 (x6) 8287 PATAGONIA ... -> A=8287 (Código), B=PATAGONIA (Nombre)
                    code = tokenA;
                    finalName = `${tokenB} ${nameRest}`;
                }
            } else {
                // Solo Token A capturado antes del nombre
                code = tokenA;
            }

            // Limpieza final del nombre
            finalName = finalName.replace(/\s*[-–—]$/, '').trim();
            
            const unitPrice = parseFloat(match[6].replace(/\./g, '').replace(',', '.'));
            
            // CÁLCULO FINAL DE CANTIDAD
            const finalQty = (bultos * multiplier) + looseUnits;
            const finalSubtotal = finalQty * unitPrice;

            products.push({
                code,
                name: finalName,
                originalQuantity: finalQty,
                quantity: finalQty,
                unitPrice,
                subtotal: finalSubtotal,
                isChecked: false
            });
        }
    });
    return products;
};

export const updatePaymentMethod = (order: Order, method: PaymentMethod): Order => {
    return { ...order, paymentMethod: method };
};
