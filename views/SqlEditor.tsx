
import React, { useState } from 'react';
import { Database, Play, Loader2, AlertCircle, Terminal, ClipboardCheck, Sparkles } from 'lucide-react';
import { User } from '../types';

export const SqlEditor: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [query, setQuery] = useState(`-- ========================================================
-- SCRIPT: CREACIÓN DE TABLA CONCEPTOS DE CAJA
-- ========================================================

CREATE TABLE IF NOT EXISTS public.cash_concepts (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    type text NOT NULL CHECK (type IN ('ingreso', 'egreso')),
    category text NOT NULL CHECK (category IN ('caja', 'banco')),
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cash_concepts_pkey PRIMARY KEY (id)
);

-- Habilitar seguridad (RLS)
ALTER TABLE public.cash_concepts ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Enable read access for all users" ON public.cash_concepts FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.cash_concepts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users only" ON public.cash_concepts FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users only" ON public.cash_concepts FOR DELETE USING (auth.role() = 'authenticated');

-- Insertar permiso
INSERT INTO public.app_permissions (key, module, label) 
VALUES ('cash.concepts', 'Caja', 'Conceptos de Ingreso/Egreso') 
ON CONFLICT (key) DO NOTHING;
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
                    <span className="text-[9px] font-bold text-green-500 uppercase bg-green-500/10 px-2 py-1 rounded">Ready</span>
                </div>
                <textarea 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full h-[600px] p-6 bg-slate-950 text-blue-300 font-mono text-xs rounded-2xl border border-surfaceHighlight outline-none resize-none shadow-inner"
                    spellCheck={false}
                />
            </div>
        </div>
    );
};
