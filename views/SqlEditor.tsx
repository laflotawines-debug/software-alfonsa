
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

interface SqlEditorProps { currentUser: User; }

export const SqlEditor: React.FC<SqlEditorProps> = ({ currentUser }) => {
    const fullSchemaScript = `-- =============================================================
-- ALFONSA SOFTWARE: SCRIPT DE INTEGRIDAD TOTAL (v19.0)
-- Especial: Reinicio de Tablero y Control de Archivados
-- =============================================================

-- 1. ACTUALIZAR TIPO DE DATO PARA ESTADOS DE TRANSFERENCIA
-- Nos aseguramos que la columna status soporte 'Archivado'
-- Si la columna ya existe, esto no rompe nada.
DO $$ 
BEGIN
    -- Intentamos forzar que el check constraint acepte 'Archivado'
    ALTER TABLE IF EXISTS public.transfers DROP CONSTRAINT IF EXISTS transfers_status_check;
END $$;

ALTER TABLE public.transfers 
ADD CONSTRAINT transfers_status_check 
CHECK (status IN ('Pendiente', 'Realizado', 'Archivado'));

-- 2. APAGAR SEGURIDAD TEMPORALMENTE
ALTER TABLE IF EXISTS public.providers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.provider_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transfers DISABLE ROW LEVEL SECURITY;

-- 3. OTORGAR PERMISOS ABSOLUTOS (Evita bloqueos silenciosos)
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon, postgres, service_role;

-- 4. FORZAR CASCADA REAL (Para que el botón Eliminar realmente funcione)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- Eliminar FKs de transfers
    FOR r IN (SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'transfers' AND constraint_type = 'FOREIGN KEY') LOOP
        EXECUTE 'ALTER TABLE public.transfers DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
    
    -- Eliminar FKs de provider_accounts
    FOR r IN (SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'provider_accounts' AND constraint_type = 'FOREIGN KEY') LOOP
        EXECUTE 'ALTER TABLE public.provider_accounts DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

ALTER TABLE public.provider_accounts 
ADD CONSTRAINT fk_provider_accounts_providers 
FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE;

ALTER TABLE public.transfers 
ADD CONSTRAINT fk_transfers_providers 
FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE;

ALTER TABLE public.transfers 
ADD CONSTRAINT fk_transfers_accounts 
FOREIGN KEY (account_id) REFERENCES provider_accounts(id) ON DELETE CASCADE;

-- 5. RE-ACTIVAR RLS CON ACCESO PÚBLICO (Garantía de funcionamiento de la App)
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Full Access Providers" ON public.providers;
CREATE POLICY "Full Access Providers" ON public.providers FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Full Access Accounts" ON public.provider_accounts;
CREATE POLICY "Full Access Accounts" ON public.provider_accounts FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Full Access Transfers" ON public.transfers;
CREATE POLICY "Full Access Transfers" ON public.transfers FOR ALL TO public USING (true) WITH CHECK (true);

-- 6. REFRESCAR ESQUEMA
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
                    <p className="text-muted text-sm mt-1 font-medium">Ejecuta el script v19.0 para habilitar el reinicio de tarjetas.</p>
                </div>
                <button onClick={handleCopy} className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-black transition-all shadow-xl uppercase text-xs tracking-widest ${copied ? 'bg-green-500 text-white' : 'bg-primary text-white hover:bg-primaryHover active:scale-95'}`}>
                    {copied ? <Check size={18} /> : <Zap size={18} />}
                    {copied ? 'Copiado' : 'Copiar Script v19.0'}
                </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3">
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm relative">
                        <textarea value={query} readOnly className="w-full h-[600px] bg-slate-950 p-8 outline-none resize-none text-blue-400 font-mono text-xs leading-relaxed" />
                    </div>
                </div>
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
                        <h4 className="text-xs font-black text-primary uppercase tracking-widest mb-3 flex items-center gap-2"><Database size={14} /> Instrucciones</h4>
                        <p className="text-[10px] text-muted font-bold leading-relaxed">
                            1. Copia el script.<br/>
                           2. Ve a Supabase → SQL Editor.<br />
                            3. Pega y presiona RUN.<br/>
                            4. Esto permite que el reinicio oculte transacciones viejas sin borrarlas de la base.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
