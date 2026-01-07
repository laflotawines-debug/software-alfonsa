
import React, { useState } from 'react';
import { Database, Play, Loader2, AlertCircle, Terminal, ClipboardCheck, Sparkles } from 'lucide-react';
import { User } from '../types';

export const SqlEditor: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [query, setQuery] = useState(`-- ========================================================
-- SCRIPT DE REPARACIÓN Y ACTUALIZACIÓN: PEDIDOS A PROVEEDORES
-- ========================================================

-- 1. Asegurar que las tablas existan
CREATE TABLE IF NOT EXISTS public.supplier_orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_code text NOT NULL,
    supplier_name text,
    estimated_arrival date NOT NULL,
    status text DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'confirmado')),
    pdf_url text,
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.supplier_order_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES public.supplier_orders(id) ON DELETE CASCADE,
    codart text NOT NULL,
    quantity numeric NOT NULL DEFAULT 1
);

-- 2. CRÍTICO: Definir relación con master_products para que el JOIN funcione
-- Primero eliminamos si ya existe para evitar errores
ALTER TABLE public.supplier_order_items DROP CONSTRAINT IF EXISTS fk_items_master_products;

-- Creamos la relación (vía codart)
ALTER TABLE public.supplier_order_items 
ADD CONSTRAINT fk_items_master_products 
FOREIGN KEY (codart) REFERENCES public.master_products(codart);

-- 3. Habilitar RLS para seguridad
ALTER TABLE public.supplier_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Supplier Orders CRUD" ON public.supplier_orders;
CREATE POLICY "Supplier Orders CRUD" ON public.supplier_orders
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Supplier Order Items CRUD" ON public.supplier_order_items;
CREATE POLICY "Supplier Order Items CRUD" ON public.supplier_order_items
    FOR ALL USING (true) WITH CHECK (true);

-- 4. Insertar permiso
INSERT INTO public.app_permissions (key, module, label)
VALUES ('inventory.supplier_orders', 'Inventario', 'Pedidos Proveedores')
ON CONFLICT (key) DO NOTHING;`);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(query);
        alert("Script copiado. Ejecútalo en Supabase para reparar la relación de tablas.");
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
                        <Terminal size={14} className="text-primary" /> Scripts del Sistema
                    </span>
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
