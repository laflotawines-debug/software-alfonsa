
import React, { useState } from 'react';
import { Database, Play, Loader2, AlertCircle, Terminal, ClipboardCheck, Sparkles } from 'lucide-react';
import { User } from '../types';

export const SqlEditor: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [query, setQuery] = useState(`-- ========================================================
-- SCRIPT DE MANTENIMIENTO: ESTRUCTURA BASE DE DATOS
-- ========================================================

-- 1. Agregar columna de Sucursal Preferida a Perfiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferred_branch text DEFAULT 'LLERENA';

-- 2. Tabla de Historial de Cobranzas
CREATE TABLE IF NOT EXISTS public.client_collections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_code text NOT NULL,
  amount numeric DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT client_collections_pkey PRIMARY KEY (id),
  CONSTRAINT client_collections_client_fkey FOREIGN KEY (client_code) REFERENCES public.clients_master(codigo)
);

-- 3. Tabla de Cuenta Corriente (Movimientos)
CREATE TABLE IF NOT EXISTS public.client_account_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_code text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  concept text,
  debit numeric DEFAULT 0,
  credit numeric DEFAULT 0,
  order_id uuid,
  collection_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  is_annulled boolean DEFAULT false,
  CONSTRAINT client_account_movements_pkey PRIMARY KEY (id),
  CONSTRAINT client_account_movements_client_fkey FOREIGN KEY (client_code) REFERENCES public.clients_master(codigo)
);

-- 4. Actualizar políticas de seguridad
ALTER TABLE public.client_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access collections" ON public.client_collections;
CREATE POLICY "Enable all access collections" ON public.client_collections FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.client_account_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access movements" ON public.client_account_movements;
CREATE POLICY "Enable all access movements" ON public.client_account_movements FOR ALL USING (true) WITH CHECK (true);

-- 5. Tabla de Zonas de Entrega (FIX ERROR PGRST205)
CREATE TABLE IF NOT EXISTS public.delivery_zones (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT delivery_zones_pkey PRIMARY KEY (id),
    CONSTRAINT delivery_zones_name_key UNIQUE (name)
);

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access zones" ON public.delivery_zones;
CREATE POLICY "Enable all access zones" ON public.delivery_zones FOR ALL USING (true) WITH CHECK (true);

-- Insertar zonas por defecto si no existen
INSERT INTO public.delivery_zones (name) 
VALUES ('V. Mercedes'), ('San Luis'), ('Norte') 
ON CONFLICT (name) DO NOTHING;
`);

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
                    <ClipboardCheck size={18} /> Copiar Script
                </button>
            </div>
            <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                        <Terminal size={14} className="text-primary" /> SQL Console
                    </span>
                    <span className="text-[9px] font-bold text-green-500 uppercase bg-green-500/10 px-2 py-1 rounded">Sistema Fix</span>
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
