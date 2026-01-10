
import React, { useState } from 'react';
import { Database, Play, Loader2, AlertCircle, Terminal, ClipboardCheck, Sparkles } from 'lucide-react';
import { User } from '../types';

export const SqlEditor: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [query, setQuery] = useState(`-- ========================================================
-- SCRIPT DE REPARACIÓN: GESTIÓN DE PRECIOS, TEMAS Y PERMISOS
-- ========================================================

-- 1. Asegurar que codart sea la Primary Key (Necesario para upsert)
ALTER TABLE public.master_products ADD PRIMARY KEY (codart);

-- 2. Habilitar RLS (Row Level Security)
ALTER TABLE public.master_products ENABLE ROW LEVEL SECURITY;

-- 3. Crear política de actualización para usuarios autenticados
DROP POLICY IF EXISTS "Permitir actualización masiva a vales" ON public.master_products;
CREATE POLICY "Permitir actualización masiva a vales" ON public.master_products
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 4. Asegurar tabla de snapshot para Lista China
CREATE TABLE IF NOT EXISTS public.whatsapp_list_snapshot (
    codart text PRIMARY KEY REFERENCES public.master_products(codart),
    desart text,
    last_price numeric,
    created_at timestamptz DEFAULT now()
);

-- 5. Agregar soporte para Preferencia de Tema en Perfiles
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='theme_preference') THEN
        ALTER TABLE public.profiles ADD COLUMN theme_preference text DEFAULT 'light';
    END IF;
END $$;

-- 6. Insertar permisos fundamentales de herramientas
INSERT INTO public.app_permissions (key, module, label)
VALUES 
    ('tools.price_management', 'Herramientas', 'Gestión de Precios'),
    ('tools.stock_control', 'Herramientas', 'Gestión de Stock'),
    ('tools.presupuestador', 'Herramientas', 'Presupuestador'),
    ('tools.etiquetador', 'Herramientas', 'Etiquetador'),
    ('tools.lista_china', 'Herramientas', 'Lista China'),
    ('catalog.statements', 'Clientes', 'Estados de Cuenta')
ON CONFLICT (key) DO NOTHING;`);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(query);
        alert("Script copiado. Ejecútalo en el SQL Editor de Supabase para activar los permisos de gestión de stock y preferencias de tema.");
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
