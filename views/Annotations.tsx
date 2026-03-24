
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Clock, 
    PackageMinus, 
    Banknote, 
    MessageSquare, 
    Plus, 
    CheckCircle2, 
    Circle,
    User,
    Loader2,
    StickyNote,
    Send,
    X,
    Filter,
    Trash2,
    Calendar,
    ChevronDown,
    Search,
    Package,
    Minus,
    RefreshCw
} from 'lucide-react';
import { supabase } from '../supabase';
import { User as UserType, Annotation, AnnotationCategory, MasterProduct } from '../types';

interface SelectedProduct {
    codart: string;
    desart: string;
    quantity: number;
    stock_llerena: number;
}

interface ExpenseItem {
    id: string;
    amount: number;
    concept: string;
}

interface AnnotationsProps {
    currentUser: UserType;
}

const CATEGORIES: { id: AnnotationCategory, label: string, icon: React.ReactNode, color: string, badgeBg: string, badgeText: string }[] = [
    { 
        id: 'HORARIO', 
        label: 'Horario de Llegada', 
        icon: <Clock size={16} />, 
        color: 'text-blue-500', 
        badgeBg: 'bg-blue-500/10',
        badgeText: 'text-blue-500'
    },
    { 
        id: 'PRODUCTO', 
        label: 'Retira Producto', 
        icon: <PackageMinus size={16} />, 
        color: 'text-orange-500', 
        badgeBg: 'bg-orange-500/10',
        badgeText: 'text-orange-500' 
    },
    { 
        id: 'GASTOS', 
        label: 'Gastos', 
        icon: <Banknote size={16} />, 
        color: 'text-green-500', 
        badgeBg: 'bg-green-500/10',
        badgeText: 'text-green-500' 
    },
    { 
        id: 'OTROS', 
        label: 'Otros', 
        icon: <MessageSquare size={16} />, 
        color: 'text-slate-400', 
        badgeBg: 'bg-slate-500/10',
        badgeText: 'text-slate-500' 
    }
];

export const Annotations: React.FC<AnnotationsProps> = ({ currentUser }) => {
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<AnnotationCategory | 'TODOS'>('TODOS');
    
    // Create Modal
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newContent, setNewContent] = useState('');
    const [newCategory, setNewCategory] = useState<AnnotationCategory>('OTROS');
    const [isSaving, setIsSaving] = useState(false);

    // Expenses Selection for 'GASTOS' category
    const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([{ id: Date.now().toString(), amount: 0, concept: '' }]);

    // Product Selection for 'PRODUCTO' category
    const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<MasterProduct[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Delete state
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Permission check for "Mark as Read" (Only Admin)
    const canMarkAsRead = currentUser.role === 'vale';

    const fetchAnnotations = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('annotations')
                .select(`
                    *,
                    profiles:user_id (
                        name,
                        role,
                        avatar_url
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                const mapped = data.map((a: any) => ({
                    ...a,
                    user_name: a.profiles?.name || 'Usuario',
                    user_role: a.profiles?.role || 'staff',
                    user_avatar: a.profiles?.avatar_url
                }));
                setAnnotations(mapped);
            }
        } catch (err) {
            console.error("Error fetching annotations:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAnnotations();
        
        // Subscribe to changes
        const channel = supabase
            .channel('annotations_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'annotations' }, () => {
                fetchAnnotations();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const handleSearchProducts = async (query: string) => {
        setSearchQuery(query);
        if (query.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const { data, error } = await supabase
                .from('master_products')
                .select('codart, desart, stock_llerena')
                .neq('familia', 'ELIMINADOS')
                .ilike('desart', `%${query}%`)
                .limit(5);

            if (error) throw error;
            setSearchResults(data || []);
        } catch (err) {
            console.error("Error searching products:", err);
        } finally {
            setIsSearching(false);
        }
    };

    const addProduct = (p: MasterProduct) => {
        if (selectedProducts.find(sp => sp.codart === p.codart)) return;
        setSelectedProducts(prev => [...prev, {
            codart: p.codart,
            desart: p.desart,
            quantity: 1,
            stock_llerena: p.stock_llerena || 0
        }]);
        setSearchQuery('');
        setSearchResults([]);
    };

    const removeProduct = (codart: string) => {
        setSelectedProducts(prev => prev.filter(p => p.codart !== codart));
    };

    const updateProductQty = (codart: string, qty: number) => {
        setSelectedProducts(prev => prev.map(p => 
            p.codart === codart ? { ...p, quantity: Math.max(1, qty) } : p
        ));
    };

    const handleCreate = async () => {
        if (newCategory === 'OTROS' && !newContent.trim()) return;
        if (newCategory === 'HORARIO' && !newContent.trim()) return;
        if (newCategory === 'PRODUCTO' && selectedProducts.length === 0 && !newContent.trim()) return;
        
        const validExpenses = expenseItems.filter(e => e.amount > 0 && e.concept.trim() !== '');
        if (newCategory === 'GASTOS' && validExpenses.length === 0 && !newContent.trim()) return;

        setIsSaving(true);
        try {
            let finalContent = newContent;
            
            // If it's a product withdrawal, we store the products as JSON in the content field
            if (newCategory === 'PRODUCTO' && selectedProducts.length > 0) {
                finalContent = JSON.stringify({
                    note: newContent,
                    products: selectedProducts
                });
            } else if (newCategory === 'GASTOS' && validExpenses.length > 0) {
                finalContent = JSON.stringify({
                    note: newContent,
                    expenses: validExpenses
                });
            }

            const { error } = await supabase.from('annotations').insert({
                user_id: currentUser.id,
                content: finalContent,
                category: newCategory,
                is_read: false
            });
            if (error) throw error;
            setNewContent('');
            setSelectedProducts([]);
            setExpenseItems([{ id: Date.now().toString(), amount: 0, concept: '' }]);
            setIsCreateOpen(false);
        } catch (e: any) {
            alert("Error: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        // Optimistic update
        setAnnotations(prev => prev.filter(a => a.id !== id));
        setDeletingId(null);

        try {
            const { error } = await supabase.from('annotations').delete().eq('id', id);
            if (error) throw error;
        } catch (e: any) {
            alert("Error al eliminar: " + e.message);
            fetchAnnotations(); // Revert
        }
    };

    const toggleReadStatus = async (id: string, currentStatus: boolean) => {
        // Only admins can toggle status, but everyone sees the status.
        if (!canMarkAsRead) return; 
        
        try {
            // Optimistic update
            setAnnotations(prev => prev.map(a => a.id === id ? { ...a, is_read: !currentStatus } : a));
            
            await supabase
                .from('annotations')
                .update({ is_read: !currentStatus })
                .eq('id', id);
        } catch (e) {
            console.error(e);
            // Revert on error
            fetchAnnotations();
        }
    };

    const filteredAnnotations = annotations.filter(a => filter === 'TODOS' || a.category === filter);

    // Grouping logic for 'HORARIO' and general date grouping
    const groupedAnnotationsByDate = useMemo(() => {
        if (filter === 'HORARIO') return null; // Handled separately

        const groups: Record<string, Annotation[]> = {};
        filteredAnnotations.forEach(a => {
            const dateStr = new Date(a.created_at).toLocaleDateString('es-AR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(a);
        });

        // Sort dates descending
        return Object.entries(groups).sort((a, b) => {
            // Parse es-AR date strings back to dates for sorting is tricky, better to use the first item's timestamp
            const timeA = new Date(a[1][0].created_at).getTime();
            const timeB = new Date(b[1][0].created_at).getTime();
            return timeB - timeA;
        });
    }, [filteredAnnotations, filter]);

    const groupedAnnotations = useMemo(() => {
        if (filter !== 'HORARIO') return null;
        
        const groups: Record<string, Annotation[]> = {};
        filteredAnnotations.forEach(a => {
            if (!groups[a.user_id]) groups[a.user_id] = [];
            groups[a.user_id].push(a);
        });
        
        return Object.values(groups).sort((a, b) => {
            const maxA = Math.max(...a.map(x => new Date(x.created_at).getTime()));
            const maxB = Math.max(...b.map(x => new Date(x.created_at).getTime()));
            return maxB - maxA;
        });
    }, [filteredAnnotations, filter]);

    return (
        <div className="flex flex-col gap-6 pb-20 animate-in fade-in duration-500 max-w-5xl mx-auto w-full">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight flex items-center gap-3 uppercase italic">
                        <StickyNote className="text-primary" size={32} />
                        Panel de Anotaciones
                    </h2>
                    <p className="text-muted text-sm mt-1 font-medium italic">Comunicaciones internas y reportes de depósito.</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button 
                        onClick={fetchAnnotations} 
                        className="p-4 rounded-2xl bg-surface border border-surfaceHighlight text-muted hover:text-primary transition-all shadow-sm"
                        title="Actualizar"
                    >
                        <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button 
                        onClick={() => setIsCreateOpen(true)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#e47c00] hover:bg-[#cc6f00] text-white px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-xl shadow-orange-500/20 active:scale-95 transition-all"
                    >
                        <Plus size={18} /> Nueva Anotación
                    </button>
                </div>
            </div>

            {/* FILTERS */}
            <div className="flex flex-wrap gap-2">
                <button 
                    onClick={() => setFilter('TODOS')}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${filter === 'TODOS' ? 'bg-[#e47c00] text-white border-[#e47c00]' : 'bg-surface border-surfaceHighlight text-muted hover:text-text'}`}
                >
                    TODOS
                </button>
                {CATEGORIES.map(cat => (
                    <button 
                        key={cat.id}
                        onClick={() => setFilter(cat.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${filter === cat.id ? 'bg-surfaceHighlight text-text border-primary' : 'bg-surface border-surfaceHighlight text-muted hover:text-text'}`}
                    >
                        {cat.icon} {cat.label}
                    </button>
                ))}
            </div>

            {/* LIST */}
            <div className="flex flex-col gap-4">
                {isLoading && annotations.length === 0 ? (
                    <div className="py-24 flex justify-center"><Loader2 size={48} className="animate-spin text-primary" /></div>
                ) : filteredAnnotations.length === 0 ? (
                    <div className="py-24 text-center border-2 border-dashed border-surfaceHighlight rounded-3xl bg-surface/30 opacity-50">
                        <MessageSquare size={48} className="mx-auto mb-4 text-muted" />
                        <p className="font-black uppercase tracking-widest text-muted italic">No hay anotaciones.</p>
                    </div>
                ) : (
                    filter === 'HORARIO' && groupedAnnotations ? (
                        groupedAnnotations.map(group => (
                            <AnnotationGroupCard 
                                key={group[0].user_id} 
                                annotations={group}
                                currentUser={currentUser}
                                onDelete={handleDelete}
                                onToggleRead={toggleReadStatus}
                                canMarkAsRead={canMarkAsRead}
                                deletingId={deletingId}
                                setDeletingId={setDeletingId}
                            />
                        ))
                    ) : groupedAnnotationsByDate ? (
                        groupedAnnotationsByDate.map(([dateStr, notes]) => (
                            <div key={dateStr} className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="h-px flex-1 bg-surfaceHighlight"></div>
                                    <span className="text-[10px] font-black uppercase text-muted tracking-widest bg-surface px-3 py-1 rounded-full border border-surfaceHighlight">
                                        {dateStr}
                                    </span>
                                    <div className="h-px flex-1 bg-surfaceHighlight"></div>
                                </div>
                                {notes.map(note => (
                                    <AnnotationCard 
                                        key={note.id} 
                                        note={note} 
                                        currentUser={currentUser}
                                        onDelete={handleDelete}
                                        onToggleRead={toggleReadStatus}
                                        canMarkAsRead={canMarkAsRead}
                                        deletingId={deletingId}
                                        setDeletingId={setDeletingId}
                                    />
                                ))}
                            </div>
                        ))
                    ) : null
                )}
            </div>

            {/* CREATE MODAL */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
                    <div className="bg-surface w-full max-w-lg my-auto rounded-3xl border border-surfaceHighlight shadow-2xl flex flex-col overflow-hidden max-h-[95vh] sm:max-h-[90vh]">
                        <div className="p-4 sm:p-6 border-b border-surfaceHighlight bg-background/30 flex justify-between items-center shrink-0">
                            <h3 className="text-lg sm:text-xl font-black text-text uppercase italic">Nueva Anotación</h3>
                            <button onClick={() => setIsCreateOpen(false)} className="p-2 hover:bg-surfaceHighlight rounded-full text-muted transition-all">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1 overscroll-contain">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Categoría</label>
                                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                        {CATEGORIES.map(cat => (
                                            <button 
                                                key={cat.id}
                                                onClick={() => setNewCategory(cat.id)}
                                                className={`p-2 sm:p-3 rounded-xl border flex items-center gap-2 sm:gap-3 transition-all text-left ${newCategory === cat.id ? `bg-surfaceHighlight border-primary ring-1 ring-primary` : 'bg-background border-surfaceHighlight hover:border-primary/30'}`}
                                            >
                                                <div className={`p-1.5 sm:p-2 rounded-lg ${cat.badgeBg} ${cat.badgeText}`}>{cat.icon}</div>
                                                <span className={`text-[10px] sm:text-xs font-black uppercase ${newCategory === cat.id ? 'text-text' : 'text-muted'}`}>{cat.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                                        {newCategory === 'GASTOS' ? 'Notas Adicionales (Opcional)' : 'Mensaje / Detalle'}
                                    </label>
                                    <textarea 
                                        autoFocus
                                        value={newContent}
                                        onChange={(e) => setNewContent(e.target.value)}
                                        placeholder={newCategory === 'PRODUCTO' ? "Notas adicionales sobre el retiro..." : newCategory === 'GASTOS' ? "Comentarios generales sobre los gastos..." : "Escribe tu anotación aquí..."}
                                        className="w-full bg-background border border-surfaceHighlight rounded-2xl p-4 text-sm font-medium text-text outline-none focus:border-primary shadow-inner min-h-[80px] sm:min-h-[100px] resize-none"
                                    />
                                </div>

                                {newCategory === 'GASTOS' && (
                                    <div className="space-y-4 animate-in slide-in-from-bottom-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Detalle de Gastos</label>
                                            <button 
                                                onClick={() => setExpenseItems([...expenseItems, { id: Date.now().toString(), amount: 0, concept: '' }])}
                                                className="flex items-center gap-1 text-[10px] font-black uppercase text-primary hover:text-primary/80 transition-colors"
                                            >
                                                <Plus size={14} /> Agregar Gasto
                                            </button>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            {expenseItems.map((item, index) => (
                                                <div key={item.id} className="flex items-start gap-3 bg-background border border-surfaceHighlight rounded-2xl p-3">
                                                    <div className="w-1/3 relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500 font-black">$</span>
                                                        <input 
                                                            type="number"
                                                            value={item.amount || ''}
                                                            onChange={(e) => {
                                                                const newItems = [...expenseItems];
                                                                newItems[index].amount = parseFloat(e.target.value) || 0;
                                                                setExpenseItems(newItems);
                                                            }}
                                                            placeholder="0.00"
                                                            className="w-full bg-surfaceHighlight/30 border-none rounded-xl pl-8 pr-3 py-2 text-sm font-black text-green-500 outline-none focus:ring-1 focus:ring-green-500/50"
                                                        />
                                                    </div>
                                                    <div className="flex-1 relative">
                                                        <input 
                                                            type="text"
                                                            value={item.concept}
                                                            onChange={(e) => {
                                                                const newItems = [...expenseItems];
                                                                newItems[index].concept = e.target.value;
                                                                setExpenseItems(newItems);
                                                            }}
                                                            placeholder="Concepto o detalle..."
                                                            className="w-full bg-surfaceHighlight/30 border-none rounded-xl px-3 py-2 text-sm font-medium text-text outline-none focus:ring-1 focus:ring-primary/50"
                                                        />
                                                    </div>
                                                    {expenseItems.length > 1 && (
                                                        <button 
                                                            onClick={() => setExpenseItems(expenseItems.filter(e => e.id !== item.id))}
                                                            className="p-2 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors mt-0.5"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {newCategory === 'PRODUCTO' && (
                                    <div className="space-y-4 animate-in slide-in-from-bottom-2">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Buscar Productos (Stock Llerena)</label>
                                            <div className="relative">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                                                <input 
                                                    type="text"
                                                    value={searchQuery}
                                                    onChange={(e) => handleSearchProducts(e.target.value)}
                                                    placeholder="Nombre del producto..."
                                                    className="w-full bg-background border border-surfaceHighlight rounded-2xl pl-12 pr-4 py-3 text-sm font-medium text-text outline-none focus:border-primary"
                                                />
                                                {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-primary" size={18} />}
                                            </div>

                                            {searchResults.length > 0 && (
                                                <div className="bg-background border border-surfaceHighlight rounded-2xl overflow-hidden shadow-xl mt-1">
                                                    {searchResults.map(p => (
                                                        <button 
                                                            key={p.codart}
                                                            onClick={() => addProduct(p)}
                                                            className="w-full p-3 hover:bg-surfaceHighlight flex items-center justify-between text-left transition-colors border-b border-surfaceHighlight last:border-0"
                                                        >
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-black text-text uppercase">{p.desart}</span>
                                                                <span className="text-[10px] text-muted font-mono">{p.codart}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${p.stock_llerena > 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                                                    Stock: {p.stock_llerena}
                                                                </span>
                                                                <Plus size={16} className="text-primary" />
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {selectedProducts.length > 0 && (
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Productos a Retirar</label>
                                                <div className="bg-background border border-surfaceHighlight rounded-2xl overflow-hidden divide-y divide-surfaceHighlight">
                                                    {selectedProducts.map(p => (
                                                        <div key={p.codart} className="p-3 flex items-center justify-between gap-4">
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-black text-text uppercase truncate">{p.desart}</p>
                                                                <p className="text-[9px] text-muted font-mono">STOCK ACTUAL: {p.stock_llerena}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button 
                                                                    onClick={() => updateProductQty(p.codart, p.quantity - 1)}
                                                                    className="p-1 rounded-lg bg-surfaceHighlight text-muted hover:text-text"
                                                                >
                                                                    <Minus size={14} />
                                                                </button>
                                                                <input 
                                                                    type="number"
                                                                    value={p.quantity}
                                                                    onChange={(e) => updateProductQty(p.codart, parseInt(e.target.value) || 1)}
                                                                    className="w-12 bg-surfaceHighlight border-none rounded-lg py-1 text-center text-xs font-black text-text outline-none"
                                                                />
                                                                <button 
                                                                    onClick={() => updateProductQty(p.codart, p.quantity + 1)}
                                                                    className="p-1 rounded-lg bg-surfaceHighlight text-muted hover:text-text"
                                                                >
                                                                    <Plus size={14} />
                                                                </button>
                                                                <button 
                                                                    onClick={() => removeProduct(p.codart)}
                                                                    className="p-1.5 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg ml-2"
                                                                >
                                                                    <X size={16} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 sm:p-6 border-t border-surfaceHighlight bg-background/30 shrink-0">
                                <button 
                                    onClick={handleCreate}
                                    disabled={
                                        (newCategory === 'OTROS' && !newContent.trim()) || 
                                        (newCategory === 'HORARIO' && !newContent.trim()) || 
                                        (newCategory === 'PRODUCTO' && selectedProducts.length === 0 && !newContent.trim()) || 
                                        (newCategory === 'GASTOS' && expenseItems.filter(e => e.amount > 0 && e.concept.trim() !== '').length === 0 && !newContent.trim()) ||
                                        isSaving
                                    }
                                    className="w-full py-3 sm:py-4 bg-[#e47c00] hover:bg-[#cc6f00] text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                    Publicar Anotación
                                </button>
                            </div>
                        </div>
                    </div>
            )}
        </div>
    );
};

// --- SUB-COMPONENTS ---

const AnnotationCard: React.FC<{
    note: Annotation;
    currentUser: UserType;
    onDelete: (id: string) => void;
    onToggleRead: (id: string, status: boolean) => void;
    canMarkAsRead: boolean;
    deletingId: string | null;
    setDeletingId: (id: string | null) => void;
}> = ({ note, currentUser, onDelete, onToggleRead, canMarkAsRead, deletingId, setDeletingId }) => {
    const catConfig = CATEGORIES.find(c => c.id === note.category) || CATEGORIES[3];
    const canDelete = currentUser.role === 'vale' || note.user_id === currentUser.id;
    const formattedDate = new Date(note.created_at).toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // Parse content if it's a product withdrawal or expense
    let displayContent = note.content;
    let products: SelectedProduct[] = [];
    let expenses: ExpenseItem[] = [];

    if (note.category === 'PRODUCTO' || note.category === 'GASTOS') {
        try {
            const parsed = JSON.parse(note.content);
            if (parsed.products) {
                displayContent = parsed.note;
                products = parsed.products;
            } else if (parsed.expenses) {
                displayContent = parsed.note;
                expenses = parsed.expenses;
            }
        } catch (e) {
            // Not JSON, keep as is
        }
    }

    return (
        <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm flex flex-col md:flex-row gap-6 relative overflow-hidden group hover:border-primary/30 transition-colors">
            {/* Left: User Info */}
            <div className="flex items-start gap-4 min-w-[200px]">
                <div className="h-12 w-12 rounded-2xl overflow-hidden border border-surfaceHighlight bg-background flex items-center justify-center shrink-0">
                    {note.user_avatar ? (
                        <img src={note.user_avatar} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                        <User size={20} className="text-muted" />
                    )}
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-black text-text uppercase leading-tight">{note.user_name}</span>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-bold text-muted uppercase">{note.user_role}</span>
                        <span className="text-[9px] text-muted">•</span>
                        <span className="text-[9px] font-bold text-muted uppercase">{getTimeAgo(note.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-muted/60">
                        <Calendar size={10} />
                        <span className="text-[9px] font-mono">{formattedDate}</span>
                    </div>
                </div>
            </div>

            {/* Middle: Content */}
            <div className="flex-1 relative">
                <div className="flex items-center justify-between mb-2">
                    <span className={`flex items-center gap-1.5 px-3 py-1 rounded text-[9px] font-black uppercase border ${catConfig.badgeBg} ${catConfig.badgeText} border-current/20`}>
                        {catConfig.icon} {catConfig.label}
                    </span>
                    
                    {/* Delete Button */}
                    {canDelete && (
                        deletingId === note.id ? (
                            <div className="flex items-center gap-2 animate-in slide-in-from-right-2">
                                <button 
                                    onClick={() => onDelete(note.id)}
                                    className="px-3 py-1 bg-red-600 text-white rounded-lg text-[9px] font-black uppercase shadow-lg active:scale-95"
                                >
                                    Confirmar
                                </button>
                                <button 
                                    onClick={() => setDeletingId(null)}
                                    className="p-1 text-muted hover:text-text"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={() => setDeletingId(note.id)}
                                className="p-1.5 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                title="Eliminar Anotación"
                            >
                                <Trash2 size={16} />
                            </button>
                        )
                    )}
                </div>
                
                {products.length > 0 && (
                    <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {products.map(p => (
                            <div key={p.codart} className="flex items-center gap-3 bg-background/50 border border-surfaceHighlight rounded-xl p-2">
                                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <Package size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black text-text uppercase truncate">{p.desart}</p>
                                    <p className="text-[9px] text-muted font-bold">CANTIDAD: {p.quantity}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {expenses.length > 0 && (
                    <div className="mb-4 space-y-2">
                        {expenses.map(e => (
                            <div key={e.id} className="flex items-center gap-3 bg-background/50 border border-surfaceHighlight rounded-xl p-3">
                                <div className="h-8 w-auto min-w-[80px] px-3 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center shrink-0 font-black text-sm">
                                    ${e.amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-text">{e.concept}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {displayContent && (
                    <p className="text-sm font-medium text-text leading-relaxed whitespace-pre-wrap">
                        {displayContent}
                    </p>
                )}
            </div>

            {/* Right: Action / Status */}
            <div className="flex flex-col items-end justify-center pl-4 border-l border-surfaceHighlight/50">
                <button 
                    onClick={() => onToggleRead(note.id, note.is_read)}
                    disabled={!canMarkAsRead}
                    className={`flex flex-col items-center gap-1 transition-all ${!canMarkAsRead ? 'cursor-default' : 'cursor-pointer active:scale-90'}`}
                    title={canMarkAsRead ? "Marcar como Leído/Completado" : "Estado de lectura"}
                >
                    {note.is_read ? (
                        <div className="h-10 w-10 rounded-full bg-[#e47c00] text-white flex items-center justify-center shadow-lg shadow-orange-500/20">
                            <CheckCircle2 size={24} />
                        </div>
                    ) : (
                        <div className="h-10 w-10 rounded-full bg-surfaceHighlight border-2 border-muted/20 text-muted flex items-center justify-center hover:border-primary/50 hover:text-primary transition-colors">
                            <Circle size={24} />
                        </div>
                    )}
                    <span className={`text-[8px] font-black uppercase tracking-widest ${note.is_read ? 'text-[#e47c00]' : 'text-muted'}`}>
                        {note.is_read ? 'LEÍDO' : 'PENDIENTE'}
                    </span>
                </button>
            </div>
        </div>
    );
};

const AnnotationGroupCard: React.FC<{
    annotations: Annotation[];
    currentUser: UserType;
    onDelete: (id: string) => void;
    onToggleRead: (id: string, status: boolean) => void;
    canMarkAsRead: boolean;
    deletingId: string | null;
    setDeletingId: (id: string | null) => void;
}> = ({ annotations, currentUser, onDelete, onToggleRead, canMarkAsRead, deletingId, setDeletingId }) => {
    const [selectedId, setSelectedId] = useState(annotations[0].id);
    
    // Ensure selectedId is valid
    useEffect(() => {
        if (!annotations.find(a => a.id === selectedId)) {
            if (annotations.length > 0) setSelectedId(annotations[0].id);
        }
    }, [annotations, selectedId]);

    const selectedNote = annotations.find(a => a.id === selectedId) || annotations[0];
    if (!selectedNote) return null;

    const catConfig = CATEGORIES.find(c => c.id === selectedNote.category) || CATEGORIES[3];
    const canDelete = currentUser.role === 'vale' || selectedNote.user_id === currentUser.id;
    const formattedDate = new Date(selectedNote.created_at).toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // Parse content if it's a product withdrawal or expense
    let displayContent = selectedNote.content;
    let products: SelectedProduct[] = [];
    let expenses: ExpenseItem[] = [];

    if (selectedNote.category === 'PRODUCTO' || selectedNote.category === 'GASTOS') {
        try {
            const parsed = JSON.parse(selectedNote.content);
            if (parsed.products) {
                displayContent = parsed.note;
                products = parsed.products;
            } else if (parsed.expenses) {
                displayContent = parsed.note;
                expenses = parsed.expenses;
            }
        } catch (e) {
            // Not JSON
        }
    }

    return (
        <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm flex flex-col md:flex-row gap-6 relative overflow-hidden group hover:border-primary/30 transition-colors">
            {/* Left: User Info (Static for the group) */}
            <div className="flex items-start gap-4 min-w-[200px]">
                <div className="h-12 w-12 rounded-2xl overflow-hidden border border-surfaceHighlight bg-background flex items-center justify-center shrink-0">
                    {selectedNote.user_avatar ? (
                        <img src={selectedNote.user_avatar} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                        <User size={20} className="text-muted" />
                    )}
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-black text-text uppercase leading-tight">{selectedNote.user_name}</span>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-bold text-muted uppercase">{selectedNote.user_role}</span>
                        <span className="text-[9px] text-muted">•</span>
                        <span className="text-[9px] font-bold text-muted uppercase bg-surfaceHighlight px-1.5 rounded">
                            {annotations.length} Registros
                        </span>
                    </div>
                </div>
            </div>

            {/* Middle: Content with Select */}
            <div className="flex-1 relative flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <span className={`flex items-center gap-1.5 px-3 py-1 rounded text-[9px] font-black uppercase border ${catConfig.badgeBg} ${catConfig.badgeText} border-current/20`}>
                        {catConfig.icon} {catConfig.label}
                    </span>
                    
                    {/* Delete Button */}
                    {canDelete && (
                        deletingId === selectedNote.id ? (
                            <div className="flex items-center gap-2 animate-in slide-in-from-right-2">
                                <button 
                                    onClick={() => onDelete(selectedNote.id)}
                                    className="px-3 py-1 bg-red-600 text-white rounded-lg text-[9px] font-black uppercase shadow-lg active:scale-95"
                                >
                                    Confirmar
                                </button>
                                <button 
                                    onClick={() => setDeletingId(null)}
                                    className="p-1 text-muted hover:text-text"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={() => setDeletingId(selectedNote.id)}
                                className="p-1.5 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                title="Eliminar Registro Seleccionado"
                            >
                                <Trash2 size={16} />
                            </button>
                        )
                    )}
                </div>

                {/* SELECTOR */}
                <div className="relative">
                    <select 
                        value={selectedId}
                        onChange={(e) => setSelectedId(e.target.value)}
                        className="w-full appearance-none bg-background border border-surfaceHighlight rounded-xl px-4 py-3 pr-10 text-sm font-bold text-text outline-none focus:border-primary cursor-pointer shadow-sm hover:bg-surfaceHighlight/30 transition-colors"
                    >
                        {annotations.map(a => {
                            const date = new Date(a.created_at).toLocaleString('es-AR', {
                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                            });
                            
                            let preview = a.content;
                            if (a.category === 'PRODUCTO' || a.category === 'GASTOS') {
                                try {
                                    const p = JSON.parse(a.content);
                                    if (a.category === 'PRODUCTO') {
                                        preview = p.note || `${p.products?.length || 0} productos`;
                                    } else if (a.category === 'GASTOS') {
                                        preview = p.note || `${p.expenses?.length || 0} gastos`;
                                    }
                                } catch(e) {}
                            }
                            
                            const truncatedPreview = preview.length > 50 ? preview.substring(0, 50) + '...' : preview;
                            return (
                                <option key={a.id} value={a.id}>
                                    {date} • {truncatedPreview}
                                </option>
                            );
                        })}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" size={16} />
                </div>

                {/* Full Content Display */}
                <div className="bg-surfaceHighlight/20 p-4 rounded-xl border border-surfaceHighlight/50">
                    <div className="flex items-center gap-2 mb-2 text-muted/60">
                        <Calendar size={12} />
                        <span className="text-[10px] font-mono uppercase">{formattedDate} ({getTimeAgo(selectedNote.created_at)})</span>
                    </div>

                    {products.length > 0 && (
                        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {products.map(p => (
                                <div key={p.codart} className="flex items-center gap-3 bg-background/50 border border-surfaceHighlight rounded-xl p-2">
                                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                        <Package size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black text-text uppercase truncate">{p.desart}</p>
                                        <p className="text-[9px] text-muted font-bold">CANTIDAD: {p.quantity}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {expenses.length > 0 && (
                        <div className="mb-4 space-y-2">
                            {expenses.map(e => (
                                <div key={e.id} className="flex items-center gap-3 bg-background/50 border border-surfaceHighlight rounded-xl p-3">
                                    <div className="h-8 w-auto min-w-[80px] px-3 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center shrink-0 font-black text-sm">
                                        ${e.amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-text">{e.concept}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {displayContent && (
                        <p className="text-sm font-medium text-text leading-relaxed whitespace-pre-wrap">
                            {displayContent}
                        </p>
                    )}
                </div>
            </div>

            {/* Right: Action / Status */}
            <div className="flex flex-col items-end justify-center pl-4 border-l border-surfaceHighlight/50">
                <button 
                    onClick={() => onToggleRead(selectedNote.id, selectedNote.is_read)}
                    disabled={!canMarkAsRead}
                    className={`flex flex-col items-center gap-1 transition-all ${!canMarkAsRead ? 'cursor-default' : 'cursor-pointer active:scale-90'}`}
                    title={canMarkAsRead ? "Marcar como Leído/Completado" : "Estado de lectura"}
                >
                    {selectedNote.is_read ? (
                        <div className="h-10 w-10 rounded-full bg-[#e47c00] text-white flex items-center justify-center shadow-lg shadow-orange-500/20">
                            <CheckCircle2 size={24} />
                        </div>
                    ) : (
                        <div className="h-10 w-10 rounded-full bg-surfaceHighlight border-2 border-muted/20 text-muted flex items-center justify-center hover:border-primary/50 hover:text-primary transition-colors">
                            <Circle size={24} />
                        </div>
                    )}
                    <span className={`text-[8px] font-black uppercase tracking-widest ${selectedNote.is_read ? 'text-[#e47c00]' : 'text-muted'}`}>
                        {selectedNote.is_read ? 'LEÍDO' : 'PENDIENTE'}
                    </span>
                </button>
            </div>
        </div>
    );
};

function getTimeAgo(dateStr: string) {
    const diff = (new Date().getTime() - new Date(dateStr).getTime()) / 1000 / 60;
    if (diff < 1) return 'un momento';
    if (diff < 60) return `${Math.floor(diff)} min`;
    const hours = diff / 60;
    if (hours < 24) return `${Math.floor(hours)} horas`;
    return `${Math.floor(hours / 24)} días`;
}
