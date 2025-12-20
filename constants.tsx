import React from 'react';
import { DetailedOrder, ExpirationItem, Order, OrderStatus, Trip } from './types';

export const RECENT_ORDERS: Order[] = [
  {
    id: '#ORD-3452',
    displayId: '#ORD-3452',
    clientName: 'Ana Silva',
    createdDate: '24 Nov 2023',
    total: 1250.00,
    status: OrderStatus.PAGADO,
    products: [],
    history: [],
    customerColor: 'bg-pink-500/10 text-pink-500',
    customerInitials: 'AS',
    paymentMethod: 'Efectivo'
  },
  {
    id: '#ORD-3451',
    displayId: '#ORD-3451',
    clientName: 'Carlos Ruiz',
    createdDate: '24 Nov 2023',
    total: 340.00,
    status: OrderStatus.EN_ARMADO,
    products: [],
    history: [],
    customerColor: 'bg-blue-500/10 text-blue-500',
    customerInitials: 'CR',
    paymentMethod: 'Pendiente'
  },
  {
    id: '#ORD-3450',
    displayId: '#ORD-3450',
    clientName: 'María Lopez',
    createdDate: '23 Nov 2023',
    total: 2100.00,
    status: OrderStatus.PAGADO,
    products: [],
    history: [],
    customerColor: 'bg-purple-500/10 text-purple-500',
    customerInitials: 'ML',
    paymentMethod: 'Transferencia'
  }
];

export const EXPIRATIONS: ExpirationItem[] = [
  {
    id: '1',
    title: 'Factura #9021 - TechCorp',
    subtitle: 'Vence mañana',
    dateDay: '24',
    dateMonth: 'NOV',
    isUrgent: true
  },
  {
    id: '2',
    title: 'Licencia Software',
    subtitle: '4 días restantes',
    dateDay: '28',
    dateMonth: 'NOV'
  },
  {
    id: '3',
    title: 'Impuestos Mensuales',
    subtitle: 'Próxima semana',
    dateDay: '01',
    dateMonth: 'DIC'
  }
];

export const CHART_DATA = [
  { name: 'Sem 1', value: 2000 },
  { name: 'Sem 2', value: 4500 },
  { name: 'Sem 3', value: 3800 },
  { name: 'Sem 4', value: 6200 },
];

export const KANBAN_ORDERS: DetailedOrder[] = [];

// --- MOCK DATABASE FOR CLIENT SEARCH ---
export const MOCK_CLIENT_DB = [
    { id: 'cli-001', name: 'Minimarket El Sol', address: 'Av. Libertador 1234' },
    { id: 'cli-002', name: 'Almacén Doña Rosa', address: 'Calle 5 Sur, 400' },
    { id: 'cli-003', name: 'Ferretería Central', address: 'Ruta 68, km 10' },
    { id: 'cli-004', name: 'Supermercado Los Andes', address: 'Los Andes 550' },
    { id: 'cli-005', name: 'Kiosco La Esquina', address: 'San Martin 200' },
    { id: 'cli-006', name: 'Restaurante El Criollo', address: 'Plaza de Armas' },
    { id: 'cli-007', name: 'Panadería La Espiga', address: 'Av. Colón 800' },
];

// --- MOCK TRIPS FOR SHEET VIEW ---
export const MOCK_TRIPS: Trip[] = [
    {
        id: 'trip-1023',
        displayId: '#1023',
        name: 'Reparto Zona Norte - Mañana',
        status: 'IN_PROGRESS',
        driverName: 'Juan Pérez',
        date: '24 Oct 2023',
        route: 'Ruta Norte',
        clients: [
            {
                id: 'c-001',
                name: 'Minimarket El Sol',
                address: 'Av. Libertador 1234',
                previousBalance: 1200,
                currentInvoiceAmount: 5000,
                paymentCash: 0,
                paymentTransfer: 0,
                isTransferExpected: false,
                status: 'PENDING'
            },
            {
                id: 'c-002',
                name: 'Almacén Doña Rosa',
                address: 'Calle 5 Sur, 400',
                previousBalance: 0,
                currentInvoiceAmount: 3200,
                paymentCash: 3200,
                paymentTransfer: 0,
                isTransferExpected: false,
                status: 'PAID'
            },
            {
                id: 'c-003',
                name: 'Ferretería Central',
                address: 'Ruta 68, km 10',
                previousBalance: 14000,
                currentInvoiceAmount: 0, 
                paymentCash: 0,
                paymentTransfer: 5000,
                isTransferExpected: true,
                status: 'PARTIAL'
            }
        ],
        expenses: [
            {
                id: 'e-1',
                type: 'combustible',
                amount: 5000,
                note: 'Carga YPF',
                timestamp: new Date()
            }
        ]
    },
    {
        id: 'trip-1024',
        displayId: '#1024',
        name: 'San Luis Centro - Jueves',
        status: 'PLANNING',
        driverName: 'Pedro Sanchez',
        date: '25 Oct 2023',
        route: 'San Luis Centro',
        clients: [
             {
                id: 'c-004',
                name: 'Supermercado Los Andes',
                address: 'Los Andes 550',
                previousBalance: 5000,
                currentInvoiceAmount: 12000,
                paymentCash: 0,
                paymentTransfer: 0,
                isTransferExpected: false,
                status: 'PENDING'
            }
        ],
        expenses: []
    }
];