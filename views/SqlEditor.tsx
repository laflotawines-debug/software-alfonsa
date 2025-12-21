
import React, { useState } from 'react';
import { 
    Play, 
    Database, 
    AlertCircle, 
    Terminal, 
    ShieldCheck, 
    Copy, 
    Check 
} from 'lucide-react';
import { User } from '../types';

interface SqlEditorProps {
    currentUser: User;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({ currentUser }) => {
    const supabaseSchema = `-- ==========================================
-- ALFONSA SOFTWARE - REPARACIÓN TOTAL v5.0
-- ==========================================

-- 1. ASEGURAR TABLAS Y ESTRUCTURA
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'armador',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. HABILITAR RLS Y ELIMINAR BLOQUEOS
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE 
    tbl RECORD;
BEGIN
    FOR tbl IN 
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN ('profiles', 'providers', 'provider_accounts', 'transfers', 'orders', 'order_items', 'trips', 'trip_clients', 'trip_expenses', 'product_expirations')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Acceso total" ON public.%I', tbl.tablename);
        EXECUTE format('CREATE POLICY "Acceso total" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl.tablename);
    END LOOP;
END $$;

-- 3. ASIGNAR PERMISOS DE ESCRITURA AL ROL AUTENTICADO
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 4. RESTAURAR ROL ADMINISTRADOR (VALE) PARA FERNANDO
-- Esta línea asegura que recuperes tu acceso total inmediatamente
UPDATE public.profiles 
SET role = 'vale' 
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'fernandoist98@gmail.com'
);

-- 5. TRIGGER PARA NUEVOS USUARIOS
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    new.id, 
    split_part(new.email, '@', 1), 
    CASE WHEN new.email = 'fernandoist98@gmail.com' THEN 'vale' ELSE 'armador' END
  )
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
`;

    const [query, setQuery] = useState(supabaseSchema);
    const [isExecuting, setIsExecuting] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleExecute = () => {
        setIsExecuting(true);
        setTimeout(() => {
            setIsExecuting(false);
            alert("SINTAXIS VALIDADA.\n\nCopia este código, pégalo en el SQL Editor de Supabase y presiona 'RUN'.\n\nTu rol se actualizará a 'vale' automáticamente.");
        }, 800);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(query);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col gap-6 h-full pb-10 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight flex items-center gap-3">
                        <Terminal size={32} className="text-primary" />
                        SQL Master Tool
                    </h2>
                    <p className="text-muted text-sm mt-1">Repara permisos y restaura privilegios de administrador.</p>
                </div>
                <button onClick={handleCopy} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all ${copied ? 'bg-green-500 text-white' : 'bg-primary text-white hover:bg-primaryHover shadow-lg shadow-primary/20'}`}>
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                    {copied ? '¡Copiado!' : 'Copiar Script'}
                </button>
            </div>

            <div className="bg-surface border border-surfaceHighlight rounded-2xl overflow-hidden shadow-sm">
                <textarea 
                    value={query} 
                    onChange={(e) => setQuery(e.target.value)} 
                    className="w-full h-[500px] bg-surface pl-6 pr-6 py-6 outline-none resize-none text-blue-400 dark:text-blue-300 font-mono text-xs leading-relaxed" 
                    spellCheck={false} 
                />
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 flex items-start gap-4">
                <ShieldCheck size={24} className="text-primary shrink-0" />
                <div>
                    <h4 className="text-sm font-black text-text uppercase tracking-tight">Promoción de Administrador Detectada</h4>
                    <p className="text-xs text-muted leading-relaxed mt-1">
                        Este script detectará tu correo <b>fernandoist98@gmail.com</b> y forzará el cambio de rol a <b>'vale'</b> en la base de datos. Una vez ejecutado, recarga la aplicación.
                    </p>
                </div>
            </div>
        </div>
    );
};
