
import React, { useState } from 'react';
import { Database, Play, Loader2, AlertCircle, Terminal, ClipboardCheck, Sparkles } from 'lucide-react';
import { User } from '../types';

export const SqlEditor: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [query, setQuery] = useState(`-- ========================================================
-- SCRIPT: FUNCIÓN PARA REVERTIR STOCK DE VENTA (INDEPENDIENTE DE LA CARD)
-- ========================================================

CREATE OR REPLACE FUNCTION revertir_venta(
    p_order_id UUID,
    p_user_id UUID,
    p_reason TEXT DEFAULT 'Anulación de factura'
) RETURNS JSONB AS $$
DECLARE
    v_movement RECORD;
    v_movements_found BOOLEAN := false;
BEGIN
    -- Verificar si ya se revirtió (si existe un movimiento positivo de venta para este pedido)
    IF EXISTS (
        SELECT 1 FROM stock_movements 
        WHERE reference_id = p_order_id AND type::text = 'venta' AND quantity > 0
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'La venta ya fue revertida anteriormente');
    END IF;

    -- Revertir exactamente los movimientos de stock que se crearon para esta venta
    -- Buscamos los movimientos negativos (salidas) y creamos su inverso (entradas)
    FOR v_movement IN 
        SELECT * FROM stock_movements 
        WHERE reference_id = p_order_id AND type::text = 'venta' AND quantity < 0
    LOOP
        v_movements_found := true;
        
        -- Insertar movimiento de stock inverso (positivo)
        INSERT INTO stock_movements (
            codart,
            warehouse_id,
            quantity,
            type,
            reference_id,
            transfer_group_code,
            created_by
        ) VALUES (
            v_movement.codart,
            v_movement.warehouse_id,
            -v_movement.quantity, -- Positivo porque el original era negativo
            'venta',
            p_order_id,
            p_reason,
            p_user_id
        );
    END LOOP;

    IF NOT v_movements_found THEN
        RETURN jsonb_build_object('success', false, 'message', 'No se encontraron movimientos de stock para revertir');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Stock revertido correctamente'
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error al revertir stock: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
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
