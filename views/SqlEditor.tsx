
import React, { useState } from 'react';
import { Database, Play, Loader2, AlertCircle, Terminal, ClipboardCheck, Sparkles } from 'lucide-react';
import { User } from '../types';

export const SqlEditor: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [query, setQuery] = useState(`-- ==========================================
-- SCRIPT DE ACTUALIZACIÓN: ETIQUETADOR V2
-- AGREGA SOPORTE PARA DESCUENTOS PERSISTENTES
-- ==========================================

ALTER TABLE public.printed_labels_state 
ADD COLUMN IF NOT EXISTS last_discount numeric DEFAULT 0;

-- script previo de reparación de stock...
DROP TRIGGER IF EXISTS tr_after_insert_movement ON public.stock_movements;
DROP TRIGGER IF EXISTS tr_sync_stock_inbound ON public.stock_movements;

CREATE OR REPLACE FUNCTION public.fn_sync_stock_from_movement()
RETURNS TRIGGER AS $$
DECLARE
    v_wh_name text;
BEGIN
    SELECT name INTO v_wh_name FROM public.warehouses WHERE id = NEW.warehouse_id;
    IF v_wh_name = 'LLERENA' THEN
        UPDATE public.master_products 
        SET stock_llerena = COALESCE(stock_llerena, 0) + NEW.quantity,
            stock_total = COALESCE(stock_total, 0) + NEW.quantity,
            updated_at = now()
        WHERE codart = NEW.codart;
    ELSIF v_wh_name = 'BETBEDER' OR v_wh_name = 'ISEAS' THEN
        UPDATE public.master_products 
        SET stock_betbeder = COALESCE(stock_betbeder, 0) + NEW.quantity,
            stock_total = COALESCE(stock_total, 0) + NEW.quantity,
            updated_at = now()
        WHERE codart = NEW.codart;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_after_insert_movement 
AFTER INSERT ON public.stock_movements 
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_stock_from_movement();`);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(query);
        alert("Script copiado. Ejecútalo en Supabase para corregir errores del etiquetador y stock.");
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
                    <span className="text-[10px] font-black text-orange-500 uppercase flex items-center gap-1">
                        <Sparkles size={12}/> Incluye corrección columna 'last_discount'
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
