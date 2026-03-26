import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../supabase';

interface BulkEditStockModalProps {
    selectedIds: string[];
    onClose: () => void;
    onSuccess: () => void;
}

export const BulkEditStockModal: React.FC<BulkEditStockModalProps> = ({ selectedIds, onClose, onSuccess }) => {
    const [stockMinimo, setStockMinimo] = useState<string>('');
    const [stockIdeal, setStockIdeal] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSave = async () => {
        if (selectedIds.length === 0) return;
        setIsSaving(true);
        setError(null);

        try {
            const payload: any = { updated_at: new Date().toISOString() };
            if (stockMinimo !== '') payload.stock_minimo = parseInt(stockMinimo);
            if (stockIdeal !== '') payload.stock_ideal = parseInt(stockIdeal);

            if (Object.keys(payload).length === 1) {
                // Only updated_at is present
                onClose();
                return;
            }

            const { error: updateError } = await supabase
                .from('master_products')
                .update(payload)
                .in('codart', selectedIds);

            if (updateError) throw updateError;

            onSuccess();
        } catch (err: any) {
            console.error('Error updating stock:', err);
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-surfaceHighlight rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-surfaceHighlight flex justify-between items-center bg-background/50">
                    <div>
                        <h2 className="text-xl font-black text-text uppercase tracking-tight">Ajuste Masivo de Stock</h2>
                        <p className="text-xs font-bold text-muted mt-1 uppercase tracking-widest">{selectedIds.length} artículos seleccionados</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-surfaceHighlight rounded-full transition-colors text-muted hover:text-text">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
                            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                            <p className="text-sm font-bold text-red-500">{error}</p>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">Stock Mínimo (Dejar en blanco para no modificar)</label>
                            <input 
                                type="number" 
                                value={stockMinimo}
                                onChange={(e) => setStockMinimo(e.target.value)}
                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 px-5 text-sm font-black text-primary outline-none focus:border-primary shadow-inner"
                                placeholder="Ej: 10"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">Stock Ideal (Dejar en blanco para no modificar)</label>
                            <input 
                                type="number" 
                                value={stockIdeal}
                                onChange={(e) => setStockIdeal(e.target.value)}
                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-3.5 px-5 text-sm font-black text-primary outline-none focus:border-primary shadow-inner"
                                placeholder="Ej: 50"
                            />
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-surfaceHighlight bg-background/50 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        className="px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-muted hover:text-text hover:bg-surfaceHighlight transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={isSaving || (stockMinimo === '' && stockIdeal === '')}
                        className="px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest bg-primary text-white hover:bg-primaryHover transition-colors flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20"
                    >
                        {isSaving ? <span className="animate-spin">⏳</span> : <Save size={16} />}
                        {isSaving ? 'Guardando...' : 'Aplicar Cambios'}
                    </button>
                </div>
            </div>
        </div>
    );
};
