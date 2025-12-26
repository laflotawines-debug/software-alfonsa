import React, { useState } from 'react';
import {
    Copy,
    Check,
    Zap,
    Database,
    ShieldCheck,
    RefreshCw
} from 'lucide-react';
import { User } from '../types';

interface SqlEditorProps {
    currentUser: User;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({ currentUser }) => {
    const fullSchemaScript = `-- =============================================================
-- ALFONSA SOFTWARE: SCRIPT DE INTEGRACIÓN (v11.0)
-- Optimización para Lista China y Etiquetas
-- =============================================================

-- 1. TABLA: ESTADO DE ETIQUETAS IMPRESAS
CREATE TABLE IF NOT EXISTS public.printed_labels_state (
    codart text PRIMARY KEY REFERENCES public.master_products(codart) ON DELETE CASCADE,
    last_printed_price numeric NOT NULL,
    updated_at timestamptz DEFAULT now()
);

-- 2. TABLA: SNAPSHOT LISTA CHINA (WHATSAPP)
-- Agregamos desart para tener referencia completa del nombre guardado
CREATE TABLE IF NOT EXISTS public.whatsapp_list_snapshot (
    codart text PRIMARY KEY,
    desart text,
    last_price numeric,
    created_at timestamptz DEFAULT now()
);

-- 3. SEGURIDAD RLS (Row Level Security)
ALTER TABLE public.printed_labels_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_list_snapshot ENABLE ROW LEVEL SECURITY;

-- Políticas para permitir todo a usuarios autenticados
DROP POLICY IF EXISTS "Acceso total etiquetas" ON public.printed_labels_state;
CREATE POLICY "Acceso total etiquetas" ON public.printed_labels_state
FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total snapshots" ON public.whatsapp_list_snapshot;
CREATE POLICY "Acceso total snapshots" ON public.whatsapp_list_snapshot
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. REFRESCAR CACHÉ DE POSTGREST
NOTIFY pgrst, 'reload schema';
`;

    const [query, setQuery] = useState(fullSchemaScript);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(query);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col gap-6 h-full pb-10 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight flex items-center gap-3 italic uppercase">
                        <ShieldCheck size={32} className="text-primary" />
                        SQL Editor
                    </h2>
                    <p className="text-muted text-sm mt-1 font-medium">
                        Ejecuta este script v11.0 para que la Lista China funcione correctamente.
                    </p>
                </div>

                <button
                    onClick={handleCopy}
                    className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-black transition-all shadow-xl uppercase text-xs tracking-widest ${
                        copied
                            ? 'bg-green-500 text-white'
                            : 'bg-primary text-white hover:bg-primaryHover active:scale-95'
                    }`}
                >
                    {copied ? <Check size={18} /> : <Zap size={18} />}
                    {copied ? 'Copiado' : 'Copiar Script v11.0'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3">
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm relative">
                        <textarea
                            value={query}
                            readOnly
                            className="w-full h-[600px] bg-slate-950 p-8 outline-none resize-none text-blue-400 font-mono text-xs leading-relaxed"
                        />
                    </div>
                </div>

                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
                        <h4 className="text-xs font-black text-primary uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Database size={14} />
                            Instrucciones
                        </h4>

                        <p className="text-[10px] text-muted font-bold leading-relaxed">
                            1. Copia el script.<br />
                            2. Ve a Supabase -&gt; SQL Editor.<br />
                            3. Pega y dale a RUN.<br />
                            4. Vuelve aquí y usa la Lista China.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
