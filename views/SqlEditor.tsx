
import React, { useState } from 'react';
import { Database, Play, Loader2, AlertCircle, Terminal, ClipboardCheck, Sparkles } from 'lucide-react';
import { User } from '../types';

export const SqlEditor: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [query, setQuery] = useState(`-- ========================================================
-- SCRIPT DE ACTUALIZACIÓN: RESERVAS Y NOTIFICACIONES
-- ========================================================

-- 1. ACTUALIZAR TABLA DE PEDIDOS (Soporte Reservas)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_reservation boolean DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS scheduled_date date;

-- 2. TABLA DE NOTIFICACIONES (Si no existe)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info',
  link_id uuid, 
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can see own notifications" ON public.notifications;
CREATE POLICY "Users can see own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- 3. MODIFICACIÓN TABLA PEDIDOS (Auditoría)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- 4. NUEVA TABLA: PERIODOS DE ASISTENCIA (HISTORIAL)
CREATE TABLE IF NOT EXISTS public.attendance_periods (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  period_label text, 
  total_hours numeric DEFAULT 0,
  total_penalty_hours numeric DEFAULT 0,
  hourly_rate numeric DEFAULT 0,
  bonus_amount numeric DEFAULT 0,
  extra_amount numeric DEFAULT 0,
  debt_amount numeric DEFAULT 0,
  total_to_pay numeric DEFAULT 0,
  details jsonb, 
  score_obtained integer DEFAULT 0,
  days_worked integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- 5. FUNCIÓN TRIGGER (LÓGICA DE MENSAJES)
CREATE OR REPLACE FUNCTION public.handle_order_notifications()
RETURNS trigger AS $$
DECLARE
  target_user record;
  actor_id uuid;
  client_text text;
BEGIN
  IF (TG_OP = 'INSERT') THEN actor_id := NEW.created_by; ELSE actor_id := NEW.updated_by; END IF;
  IF actor_id IS NULL THEN actor_id := auth.uid(); END IF;
  client_text := COALESCE(NEW.client_name, 'Cliente');

  -- Solo notificar si NO es una reserva
  IF (TG_OP = 'INSERT' AND NEW.is_reservation = false) THEN
    FOR target_user IN SELECT id FROM public.profiles WHERE role = 'armador' LOOP
      IF target_user.id != actor_id THEN
        INSERT INTO public.notifications (user_id, message, type, link_id)
        VALUES (target_user.id, 'Nuevo pedido: ' || client_text, 'info', NEW.id);
      END IF;
    END LOOP;
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    IF (OLD.status != 'armado_controlado' AND NEW.status = 'armado_controlado') THEN
      FOR target_user IN SELECT id FROM public.profiles WHERE role = 'vale' LOOP
        IF target_user.id != actor_id THEN
          INSERT INTO public.notifications (user_id, message, type, link_id)
          VALUES (target_user.id, client_text || ' listo para facturar', 'success', NEW.id);
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_order_change_notify ON public.orders;
CREATE TRIGGER on_order_change_notify
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE PROCEDURE public.handle_order_notifications();
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
