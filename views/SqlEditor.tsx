
import React, { useState } from 'react';
import { Database, Play, Loader2, AlertCircle, Terminal, ClipboardCheck, Sparkles } from 'lucide-react';
import { User } from '../types';

export const SqlEditor: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [query, setQuery] = useState(`-- ========================================================
-- SCRIPT DE REPARACIÓN OBLIGATORIO (EJECUTAR EN SUPABASE)
-- ========================================================

-- 1. FUNCIÓN PARA FIJAR CANTIDAD ENVIADA (REPARTO)
-- Soluciona el error PGRST202 al pasar a reparto
CREATE OR REPLACE FUNCTION public.set_shipped_quantity_for_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Al pasar a reparto, fijamos que lo enviado (shipped_quantity) 
  -- es igual a lo que hay cargado actualmente (quantity)
  UPDATE public.order_items
  SET shipped_quantity = quantity
  WHERE order_id = p_order_id;
END;
$$;

-- 2. ASEGURAR COLUMNA DE CANTIDAD ENVIADA (NOTA DE CRÉDITO)
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS shipped_quantity integer;

-- 3. ASIGNAR ROL "VALE" (ADMIN) A USUARIOS ESPECÍFICOS
UPDATE public.profiles
SET role = 'vale'
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE LOWER(email) IN ('sanchezgerman515@gmail.com', 'sattipablo@gmail.com')
);

-- 4. INSERTAR PERMISOS FUNDAMENTALES
INSERT INTO public.app_permissions (key, module, label)
VALUES 
    ('orders.view', 'Pedidos', 'Ver Gestión de Pedidos'),
    ('orders.create', 'Pedidos', 'Crear Nuevo Pedido'),
    ('orders.sheet', 'Pedidos', 'Ver Planilla de Viajes'),
    ('orders.sheet_manage', 'Pedidos', 'Gestionar/Borrar Viajes'),
    ('orders.view_financials', 'Pedidos', 'Ver Montos en Tarjetas'),
    ('tools.price_management', 'Herramientas', 'Gestión de Precios'),
    ('tools.stock_control', 'Herramientas', 'Gestión de Stock'),
    ('tools.presupuestador', 'Herramientas', 'Presupuestador'),
    ('tools.etiquetador', 'Herramientas', 'Etiquetador'),
    ('tools.lista_china', 'Herramientas', 'Lista China'),
    ('catalog.statements', 'Clientes', 'Estados de Cuenta'),
    ('inventory.inbounds', 'Inventario', 'Gestionar Ingresos')
ON CONFLICT (key) DO UPDATE 
SET label = EXCLUDED.label, module = EXCLUDED.module;

-- 5. POLÍTICAS RLS (PERMITIR ELIMINACIÓN)
DROP POLICY IF EXISTS "Permitir borrado a vales" ON public.clients_master;
CREATE POLICY "Permitir borrado a vales" ON public.clients_master
    FOR DELETE
    USING (true);`);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(query);
        alert("Script copiado. Pégalo en el SQL Editor de Supabase y presiona RUN.");
    };

    return (
        <div className="flex flex-col gap-6 pb-20 animate-in fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black text-text uppercase italic flex items-center gap-3">
                    <Database className="text-primary" size={32} /> Editor SQL
                </h2>
                <button onClick={copyToClipboard} className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-black text-xs uppercase shadow-lg hover:bg-primaryHover transition-all">
                    <ClipboardCheck size={18} /> Copiar Script de Reparación
                </button>
            </div>
            <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                        <Terminal size={14} className="text-primary" /> Scripts de Configuración
                    </span>
                    <span className="text-[9px] font-bold text-orange-500 uppercase bg-orange-500/10 px-2 py-1 rounded">Fix: Reparto & Nota de Crédito</span>
                </div>
                <textarea 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full h-[600px] p-6 bg-slate-950 text-blue-300 font-mono text-xs rounded-2xl border border-surfaceHighlight outline-none resize-none shadow-inner"
                />
            </div>
        </div>
    );
};
