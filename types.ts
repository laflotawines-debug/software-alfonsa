
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
    ACCOUNTS = 'ACCOUNTS',
    PROVIDERS = 'PROVIDERS',
    EXPIRATIONS = 'EXPIRATIONS',
    HISTORY = 'HISTORY',
    LISTS = 'LISTS',
    PRESUPUESTADOR = 'PRESUPUESTADOR', 
    SETTINGS = 'SETTINGS',
    TOOLS = 'TOOLS',
    SQL_EDITOR = 'SQL_EDITOR'
}

export interface NavItem {
    id: View;
    label: string;
    icon: React.ReactNode;
    subItems?: NavItem[];
}

// --- DOMAIN MODEL: PAYMENTS & PROVIDERS ---

export type ProviderStatus = 'Activado' | 'Desactivado' | 'Frenado' | 'Completado' | 'Archivado';
export type TransferStatus = 'Pendiente' | 'Realizado';

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
    condition: string; // ej: "Factura A", "Sin Factura"
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
    isLoadedInSystem?: boolean; // Propiedad añadida para seguimiento
}

// --- DOMAIN MODEL: USERS & ROLES ---
export type UserRole = 'vale' | 'armador';
export interface User {
    id: string;
    name: string;
    role: UserRole;
}

// --- DOMAIN MODEL: ORDERS ---
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
    timestamp: Date;
    userId: string;
    userName: string;
    action: string;
    details?: string;
    previousState?: OrderStatus;
    newState?: OrderStatus;
}

export type PaymentMethod = 'Efectivo' | 'Transferencia' | 'Cheque' | 'Cta Cte' | 'Pendiente';
export type OrderZone = 'V. Mercedes' | 'San Luis' | 'Norte';

export interface Order {
    id: string;
    displayId: string;
    clientName: string;
    zone?: OrderZone; 
    status: OrderStatus;
    createdDate: string;
    paymentMethod?: PaymentMethod;
    assemblerId?: string; 
    controllerId?: string; 
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

// --- DOMAIN MODEL: TRIPS ---
export type TripStatus = 'PLANNING' | 'IN_PROGRESS' | 'CLOSED';
export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID';

// Added missing TripClient type
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

// Added missing Expense types
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

// Added missing ExpirationItem interface
export interface ExpirationItem {
    id: string;
    title: string;
    subtitle: string;
    dateDay: string;
    dateMonth: string;
    isUrgent?: boolean;
}
