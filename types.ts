
import React from 'react';

// --- UI / NAVIGATION TYPES ---
export enum View {
    DASHBOARD = 'DASHBOARD',
    ORDERS = 'ORDERS',
    ORDER_SHEET = 'ORDER_SHEET', 
    CREATE_BUDGET = 'CREATE_BUDGET',
    PAYMENTS_OVERVIEW = 'PAYMENTS_OVERVIEW',
    PAYMENTS_PROVIDERS = 'PAYMENTS_PROVIDERS',
    PAYMENTS_HISTORY = 'PAYMENTS_HISTORY',
    PROVIDER_STATEMENTS = 'PROVIDER_STATEMENTS', 
    CATALOG = 'CATALOG',
    CLIENTS_MASTER = 'CLIENTS_MASTER', 
    CLIENT_COLLECTIONS = 'CLIENT_COLLECTIONS',
    CLIENT_STATEMENTS = 'CLIENT_STATEMENTS',
    SUPPLIERS_MASTER = 'SUPPLIERS_MASTER',
    PROVIDERS = 'PROVIDERS',
    EXPIRATIONS = 'EXPIRATIONS',
    LISTA_CHINA = 'LISTA_CHINA', 
    PRESUPUESTADOR = 'PRESUPUESTADOR', 
    ETIQUETADOR = 'ETIQUETADOR',
    PRICE_MANAGEMENT = 'PRICE_MANAGEMENT',
    SETTINGS = 'SETTINGS',
    TOOLS = 'TOOLS',
    STOCK_CONTROL = 'STOCK_CONTROL',
    ATTENDANCE = 'ATTENDANCE',
    INV_INBOUNDS = 'INV_INBOUNDS',
    INV_ADJUSTMENTS = 'INV_ADJUSTMENTS',
    INV_TRANSFERS = 'INV_TRANSFERS',
    INV_HISTORY = 'INV_HISTORY',
    INV_SUPPLIER_ORDERS = 'INV_SUPPLIER_ORDERS'
}

export interface NavItem {
    id: View;
    label: string;
    icon: React.ReactNode;
    subItems?: NavItem[];
    permission?: string;
}

export interface AppNotification {
    id: string;
    user_id: string;
    message: string;
    type: 'info' | 'success' | 'warning';
    link_id?: string;
    is_read: boolean;
    created_at: string;
}

// --- ATTENDANCE DOMAIN ---
export interface WorkerAttendanceConfig {
    user_id: string;
    hourly_rate: number;
    work_days: string[]; 
    entry_time: string; 
    exit_time: string;
    entry_time_pm?: string; 
    exit_time_pm?: string;
    location: string;
}

export interface GlobalAttendanceSettings {
    location: string;
    bonus_1: number;
    bonus_2: number;
}

// --- REST OF DOMAIN MODELS ---
export interface DeliveryZone {
    id: string;
    name: string;
    active: boolean;
}

export interface AccountMovement {
    id: string;
    client_code: string;
    date: string;
    concept: string;
    debit: number; 
    credit: number;
    balance: number; 
    order_id?: string;
    collection_id?: string;
    created_at?: string;
    is_annulled?: boolean; 
}

export interface ProviderAccountMovement {
    id: string;
    provider_code: string;
    date: string;
    concept: string;
    debit: number;  
    credit: number; 
    balance: number; 
    created_at?: string;
    created_by?: string;
    is_annulled?: boolean;
}

export interface SavedBudget {
    id: string;
    client_code: string;
    total: number;
    created_at: string;
    items?: SavedBudgetItem[];
}

export interface SavedBudgetItem {
    id: string;
    budget_id: string;
    codart: string;
    name: string;
    quantity: number;
    unit_price: number;
}

export interface SupplierOrder {
    id: string;
    supplier_code: string;
    supplier_name?: string;
    estimated_arrival: string;
    status: 'pendiente' | 'confirmado';
    pdf_url?: string;
    created_at: string;
    created_by: string;
    items?: SupplierOrderItem[];
}

export interface SupplierOrderItem {
    id: string;
    order_id: string;
    codart: string;
    desart?: string;
    quantity: number;
    units_per_box?: number;
}

export interface StockControlSession {
    id: string;
    name: string;
    warehouse_id: string;
    warehouse_name?: string;
    status: 'active' | 'finished';
    created_by: string;
    created_at: string;
    item_count?: number;
    assigned_users?: string[];
}

export interface StockControlItem {
    id: string;
    session_id: string;
    codart: string;
    desart?: string;
    system_qty: number;
    corrected_qty?: number;
    counts: {
        user_id: string;
        user_name: string;
        qty: number;
    }[];
}

export interface AppPermission {
    key: string;
    module: string;
    label: string;
}

export interface ClientMaster {
    codigo: string;
    nombre: string;
    domicilio?: string;
    localidad?: string;
    provincia?: string;
    celular?: string;
    email?: string;
    created_at?: string;
}

export interface ClientCollection {
    id: string;
    client_code: string;
    amount: number;
    date: string;
    notes?: string;
    created_at: string;
}

export type WarehouseCode = 'LLERENA' | 'BETBEDER';
export type InboundStatus = 'borrador' | 'enviado' | 'aprobado' | 'anulado';
export type MovementType = 'ingreso' | 'ajuste' | 'transferencia' | 'reverso';

export interface WarehouseMapping {
    id: string;
    name: WarehouseCode;
}

export interface StockInbound {
    id: string;
    display_number: number;
    supplier_code: string;
    warehouse_id: string;
    status: InboundStatus;
    created_at: string;
    created_by: string;
    sent_at?: string;
    approved_at?: string;
    approved_by?: string;
    observations?: string;
    supplier_name?: string;
    assembler_name?: string;
    warehouse_name?: WarehouseCode;
}

export interface StockInboundItem {
    id: string;
    inbound_id: string;
    codart: string;
    desart?: string;
    quantity: number;
    expiry_date?: string;
}

export interface StockMovement {
    id: string;
    created_at: string;
    codart: string;
    desart?: string;
    warehouse_id: string;
    quantity: number;
    type: MovementType;
    status: 'activo' | 'anulado';
    reference_id: string;
    transfer_group_code?: string;
    created_by: string;
    user_name?: string;
    warehouse_name?: string;
    inbound_display_number?: number;
}

export interface MasterProduct {
    codart: string;
    codprove?: string;
    cbarra?: string;
    desart: string;
    costo: number;
    familia?: string;
    nsubf?: string;
    en_dolares?: string;
    tasa?: string;
    nomprov?: string;
    pventa_1: number;
    pventa_2: number;
    pventa_3: number;
    pventa_4: number;
    units_per_box?: number;
    unicom?: string;
    unidad?: string;
    coeficient?: number;
    stock_total?: number;
    stock_betbeder?: number;
    stock_llerena?: number;
    stock_iseas?: number;
    vencido_iseas?: number;
    vencido_llerena?: number;
    defectuoso_llerena?: number;
    updated_at?: string;
    is_nacional?: boolean; 
    last_sale_date?: string; 
    last_invoice_ref?: string; 
    proveedor_nombre_oficial?: string; 
}

export interface SupplierMaster {
    codigo: string;
    razon_social: string;
    nombre_comercial?: string;
    domicilio?: string;
    localidad?: string;
    provincia?: string;
    celular?: string;
    email?: string;
    activo: boolean;
    created_at?: string;
}

export type ExpirationStatus = 'CRÍTICO' | 'PRÓXIMO' | 'MODERADO' | 'NORMAL';
export interface ProductExpiration {
    id: string;
    productName: string;
    quantity: string;
    expiryDate: Date;
    daysRemaining: number;
    status: ExpirationStatus;
}
export type ProviderStatus = 'Activado' | 'Desactivado' | 'Frenado' | 'Completado' | 'Archivado';
export type TransferStatus = 'Pendiente' | 'Realizado' | 'Archivado';
export interface Provider {
    id: string;
    name: string;
    goalAmount: number;
    priority: number; 
    status: ProviderStatus;
    accounts: ProviderAccount[];
}
export interface ProviderAccount {
    id: string;
    providerId: string;
    condition: string; 
    holder: string;
    identifierAlias: string;
    identifierCBU: string;
    metaAmount: number;
    currentAmount: number;
    pendingAmount: number;
    status: 'Activa' | 'Inactiva';
}
export interface Transfer {
    id: string;
    clientName: string;
    amount: number;
    date: string;
    providerId: string;
    accountId: string;
    notes?: string;
    status: TransferStatus;
    isLoadedInSystem?: boolean; 
}
export type UserRole = 'vale' | 'armador';
export interface User {
    id: string;
    name: string;
    role: UserRole;
    permissions: string[];
    avatar_url?: string;
    preferred_branch?: string; 
    theme_preference?: 'dark' | 'light'; 
}
export enum OrderStatus {
    EN_ARMADO = 'en_armado',
    ARMADO = 'armado',
    ARMADO_CONTROLADO = 'armado_controlado',
    FACTURADO = 'facturado',
    FACTURA_CONTROLADA = 'factura_controlada',
    EN_TRANSITO = 'en_transito',
    ENTREGADO = 'entregado',
    PAGADO = 'pagado'
}
export interface Product {
    code: string;
    name: string;
    originalQuantity: number;
    quantity: number;
    shippedQuantity?: number;
    unitPrice: number;
    subtotal: number;
    isChecked: boolean;
}
export interface HistoryEntry {
    timestamp: string;
    userId: string;
    userName: string;
    action: string;
    details?: string;
    previousState?: OrderStatus;
    newState?: OrderStatus;
}
export type PaymentMethod = 'Efectivo' | 'Transferencia' | 'Cheque' | 'Cta Cte' | 'Pendiente';
export type OrderZone = string; 
export interface Order {
    id: string;
    displayId: string;
    clientName: string;
    zone?: OrderZone; 
    status: OrderStatus;
    createdDate: string;
    lastUpdated?: string;
    paymentMethod?: PaymentMethod;
    assemblerId?: string; 
    assemblerName?: string;
    controllerId?: string; 
    controllerName?: string;
    invoicerName?: string;
    products: Product[];
    total: number;
    observations?: string; 
    history: HistoryEntry[];
    customerColor?: string;
    customerInitials?: string;
}
export interface DetailedOrder extends Order {
    productCount: number;
}
export type TripStatus = 'PLANNING' | 'IN_PROGRESS' | 'CLOSED';
export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID';
export interface TripClient {
    id: string;
    name: string;
    address: string;
    previousBalance: number;
    currentInvoiceAmount: number;
    paymentCash: number;
    paymentTransfer: number;
    isTransferExpected: boolean;
    status: PaymentStatus;
}
export type ExpenseType = 'viatico' | 'peaje' | 'combustible' | 'otro';
export interface TripExpense {
    id: string;
    type: ExpenseType;
    amount: number;
    note: string;
    timestamp: Date;
}
export interface Trip {
    id: string;
    displayId: string;
    name: string; 
    status: TripStatus;
    driverName: string;
    date: string;
    route: string;
    clients: TripClient[];
    expenses: TripExpense[];
}
export interface ExpirationItem {
    id: string;
    title: string;
    subtitle: string;
    dateDay: string;
    dateMonth: string;
    isUrgent?: boolean;
}
