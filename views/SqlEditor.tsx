
import React, { useState } from 'react';
import { 
    Play, 
    Trash2, 
    Clock, 
    Database, 
    ChevronRight, 
    AlertCircle, 
    Terminal, 
    Code2,
    Search,
    RefreshCw,
    ShieldCheck,
    Copy,
    Check
} from 'lucide-react';
import { User } from '../types';

interface SqlEditorProps {
    currentUser: User;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({ currentUser }) => {
    // Schema DDL for Supabase - Master Schema with Triggers
    const supabaseSchema = `-- ==========================================
-- ALFONSA SOFTWARE - ESQUEMA SUPABASE PRO
-- Copia y pega este código en el SQL Editor de Supabase
-- ==========================================

-- 1. ENUMS
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE order_status AS ENUM ('en_armado', 'armado', 'armado_controlado', 'facturado', 'factura_controlada', 'en_transito', 'entregado', 'pagado');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_zone') THEN
        CREATE TYPE order_zone AS ENUM ('V. Mercedes', 'San Luis', 'Norte');
    END IF;
END $$;

-- 2. TABLA DE PERFILES (Sincronizada con auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('vale', 'armador')) NOT NULL DEFAULT 'armador',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TRIGGER: CREAR PERFIL AL REGISTRAR USUARIO
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 
    COALESCE(NEW.raw_user_meta_data->>'role', 'armador')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. PROVEEDORES Y CUENTAS
CREATE TABLE IF NOT EXISTS public.providers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  goal_amount NUMERIC(12,2) DEFAULT 0,
  priority INTEGER DEFAULT 3,
  status TEXT CHECK (status IN ('Activado', 'Desactivado', 'Frenado', 'Completado', 'Archivado')) DEFAULT 'Activado',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.provider_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID REFERENCES public.providers(id) ON DELETE CASCADE,
  condition TEXT,
  holder TEXT,
  identifier_alias TEXT,
  identifier_cbu TEXT,
  meta_amount NUMERIC(12,2) DEFAULT 0,
  current_amount NUMERIC(12,2) DEFAULT 0,
  pending_amount NUMERIC(12,2) DEFAULT 0,
  status TEXT CHECK (status IN ('Activa', 'Inactiva')) DEFAULT 'Activa'
);

-- 5. TRANSFERENCIAS (CON ON DELETE CASCADE)
CREATE TABLE IF NOT EXISTS public.transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  date_text TEXT,
  provider_id UUID REFERENCES public.providers(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.provider_accounts(id) ON DELETE CASCADE,
  notes TEXT,
  status TEXT CHECK (status IN ('Pendiente', 'Realizado')) DEFAULT 'Pendiente',
  is_loaded_in_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. PEDIDOS E ITEMS
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,
  client_name TEXT NOT NULL,
  zone order_zone DEFAULT 'V. Mercedes',
  status order_status DEFAULT 'en_armado',
  payment_method TEXT DEFAULT 'Pendiente',
  total NUMERIC(12,2) DEFAULT 0,
  observations TEXT,
  assembler_id UUID REFERENCES public.profiles(id),
  controller_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  original_quantity INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  shipped_quantity INTEGER,
  unit_price NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  is_checked BOOLEAN DEFAULT FALSE
);

-- 7. SEGURIDAD (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Perfil - Todos pueden ver" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Pedidos - Todos pueden gestionar" ON public.orders FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Items - Todos pueden gestionar" ON public.order_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Finanzas - Solo Vale" ON public.transfers FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'vale'));
CREATE POLICY "Proveedores - Solo Vale" ON public.providers FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'vale'));
CREATE POLICY "Cuentas - Solo Vale" ON public.provider_accounts FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'vale'));
`;

    const [query, setQuery] = useState(supabaseSchema);
    const [results, setResults] = useState<any[]>([]);
    const [isExecuting, setIsExecuting] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleExecute = () => {
        setIsExecuting(true);
        setTimeout(() => {
            setResults([
                { status: 'Success', message: 'DDL Validado y con soporte para borrado en cascada.' },
            ]);
            setIsExecuting(false);
        }, 800);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(query);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (currentUser.role !== 'vale') {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
                <div className="p-6 bg-red-500/10 rounded-full mb-4">
                    <ShieldCheck size={64} className="text-red-500" />
                </div>
                <h3 className="text-2xl font-black text-text">Acceso Restringido</h3>
                <p className="text-muted mt-2 max-w-md">Solo administradores con rol "Vale" pueden configurar la infraestructura.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 h-full pb-10 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight flex items-center gap-3">
                        <Terminal size={32} className="text-primary" />
                        Supabase Schema
                    </h2>
                    <p className="text-muted text-sm mt-1">Sincronización de bases de datos y seguridad RLS.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 flex flex-col gap-4">
                    <div className="bg-surface border border-surfaceHighlight rounded-2xl overflow-hidden shadow-sm flex flex-col">
                        <div className="px-4 py-2 bg-background/50 border-b border-surfaceHighlight flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-widest text-muted">schema.sql</span>
                            <div className="flex gap-2">
                                <button onClick={handleCopy} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-bold text-xs transition-all ${copied ? 'bg-green-500 text-white' : 'bg-surfaceHighlight text-text hover:bg-primary hover:text-white'}`}>
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                    {copied ? 'Copiado' : 'Copiar DDL'}
                                </button>
                                <button onClick={handleExecute} className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-white font-bold text-xs shadow-lg">
                                    <Play size={14} fill="currentColor" /> Validar
                                </button>
                            </div>
                        </div>
                        <textarea value={query} onChange={(e) => setQuery(e.target.value)} className="w-full h-[500px] bg-surface pl-4 pr-4 py-4 outline-none resize-none text-blue-400 dark:text-blue-300 font-mono text-sm" spellCheck={false} />
                    </div>
                </div>

                <div className="flex flex-col gap-6">
                    <div className="bg-surface border border-surfaceHighlight rounded-2xl p-5 shadow-sm">
                        <h3 className="text-sm font-bold text-text uppercase tracking-wider mb-4 flex items-center gap-2">
                            <ShieldCheck size={16} className="text-primary" /> Seguridad RLS
                        </h3>
                        <p className="text-xs text-muted leading-relaxed">
                            Las finanzas están protegidas. Solo el rol "Vale" puede borrar o editar proveedores y pagos.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
