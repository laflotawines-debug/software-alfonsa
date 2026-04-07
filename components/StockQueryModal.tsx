import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Package, MapPin, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';

interface StockQueryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const StockQueryModal: React.FC<StockQueryModalProps> = ({ isOpen, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setResults([]);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = searchTerm.trim();
        if (!trimmed || trimmed.length < 2) return;

        setIsSearching(true);
        try {
            let query = supabase
                .from('master_products')
                .select('codart, desart, stock_llerena, stock_betbeder');

            const words = trimmed.split(/\s+/).filter(w => w.length > 0);

            if (words.length > 1) {
                // Multi-word search: all words must be in desart
                words.forEach(word => {
                    query = query.ilike('desart', `%${word}%`);
                });
            } else {
                // Single word search: match any field
                query = query.or(`desart.ilike.%${trimmed}%,codart.ilike.%${trimmed}%,cbarra.ilike.%${trimmed}%`);
            }

            const { data, error } = await query
                .order('desart')
                .limit(20);

            if (error) throw error;
            setResults(data || []);
        } catch (err) {
            console.error("Error searching stock:", err);
        } finally {
            setIsSearching(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-surface w-full max-w-2xl rounded-3xl border border-surfaceHighlight shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-surfaceHighlight bg-background/50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Package className="text-primary" size={20} />
                        </div>
                        <h3 className="text-lg font-black text-text uppercase tracking-tight">Consulta Rápida de Stock</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-surfaceHighlight rounded-full text-muted transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 border-b border-surfaceHighlight">
                    <form onSubmit={handleSearch} className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar por código, barras o descripción (ej: 'fer bran')..."
                            className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary shadow-inner uppercase"
                        />
                        <button 
                            type="submit" 
                            disabled={isSearching || searchTerm.trim().length < 2}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold uppercase disabled:opacity-50"
                        >
                            {isSearching ? <Loader2 size={16} className="animate-spin" /> : 'Buscar'}
                        </button>
                    </form>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {results.length === 0 && !isSearching && searchTerm.trim().length >= 2 && (
                        <div className="text-center py-12 text-muted font-bold uppercase text-sm">
                            No se encontraron resultados
                        </div>
                    )}
                    
                    {results.length === 0 && !isSearching && searchTerm.trim().length < 2 && (
                        <div className="text-center py-12 text-muted font-bold uppercase text-sm opacity-50">
                            Escriba al menos 2 caracteres para buscar
                        </div>
                    )}

                    {results.length > 0 && (
                        <div className="space-y-2">
                            {results.map(product => (
                                <div key={product.codart} className="bg-background border border-surfaceHighlight rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-primary/30 transition-colors">
                                    <div className="flex-1">
                                        <div className="text-xs font-black text-primary mb-1">#{product.codart}</div>
                                        <div className="text-sm font-bold text-text uppercase">{product.desart}</div>
                                    </div>
                                    <div className="flex gap-4 shrink-0">
                                        <div className="bg-surfaceHighlight/30 px-4 py-2 rounded-xl flex flex-col items-center min-w-[100px]">
                                            <span className="text-[10px] font-black text-muted uppercase tracking-widest mb-1 flex items-center gap-1">
                                                <MapPin size={10} /> Llerena
                                            </span>
                                            <span className={`text-lg font-black ${product.stock_llerena > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {product.stock_llerena || 0}
                                            </span>
                                        </div>
                                        <div className="bg-surfaceHighlight/30 px-4 py-2 rounded-xl flex flex-col items-center min-w-[100px]">
                                            <span className="text-[10px] font-black text-muted uppercase tracking-widest mb-1 flex items-center gap-1">
                                                <MapPin size={10} /> Betbeder
                                            </span>
                                            <span className={`text-lg font-black ${product.stock_betbeder > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {product.stock_betbeder || 0}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
