
import React, { useState, useEffect } from 'react';
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
    Calendar
} from 'lucide-react';
import { supabase } from '../supabase';
import { User as UserType, Annotation, AnnotationCategory } from '../types';

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

    const handleCreate = async () => {
        if (!newContent.trim()) return;
        setIsSaving(true);
        try {
            const { error } = await supabase.from('annotations').insert({
                user_id: currentUser.id,
                content: newContent,
                category: newCategory,
                is_read: false
            });
            if (error) throw error;
            setNewContent('');
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
                <button 
                    onClick={() => setIsCreateOpen(true)}
                    className="flex items-center gap-2 bg-[#e47c00] hover:bg-[#cc6f00] text-white px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-xl shadow-orange-500/20 active:scale-95 transition-all"
                >
                    <Plus size={18} /> Nueva Anotación
                </button>
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
                    filteredAnnotations.map(note => {
                        const catConfig = CATEGORIES.find(c => c.id === note.category) || CATEGORIES[3];
                        const canDelete = currentUser.role === 'vale' || note.user_id === currentUser.id;
                        const formattedDate = new Date(note.created_at).toLocaleString('es-AR', {
                            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        });
                        
                        return (
                            <div key={note.id} className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm flex flex-col md:flex-row gap-6 relative overflow-hidden group hover:border-primary/30 transition-colors">
                                {/* Left: User Info */}
                                <div className="flex items-start gap-4 min-w-[200px]">
                                    <div className="h-12 w-12 rounded-2xl overflow-hidden border border-surfaceHighlight bg-background flex items-center justify-center shrink-0">
                                        {note.user_avatar ? (
                                            <img src={note.user_avatar} className="h-full w-full object-cover" />
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
                                                        onClick={() => handleDelete(note.id)}
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
                                    <p className="text-sm font-medium text-text leading-relaxed whitespace-pre-wrap">
                                        {note.content}
                                    </p>
                                </div>

                                {/* Right: Action / Status */}
                                <div className="flex flex-col items-end justify-center pl-4 border-l border-surfaceHighlight/50">
                                    <button 
                                        onClick={() => toggleReadStatus(note.id, note.is_read)}
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
                    })
                )}
            </div>

            {/* CREATE MODAL */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-surface w-full max-w-lg rounded-3xl border border-surfaceHighlight shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-surfaceHighlight bg-background/30 flex justify-between items-center">
                            <h3 className="text-xl font-black text-text uppercase italic">Nueva Anotación</h3>
                            <button onClick={() => setIsCreateOpen(false)} className="p-2 hover:bg-surfaceHighlight rounded-full text-muted transition-all">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Categoría</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {CATEGORIES.map(cat => (
                                        <button 
                                            key={cat.id}
                                            onClick={() => setNewCategory(cat.id)}
                                            className={`p-3 rounded-xl border flex items-center gap-3 transition-all text-left ${newCategory === cat.id ? `bg-surfaceHighlight border-primary ring-1 ring-primary` : 'bg-background border-surfaceHighlight hover:border-primary/30'}`}
                                        >
                                            <div className={`p-2 rounded-lg ${cat.badgeBg} ${cat.badgeText}`}>{cat.icon}</div>
                                            <span className={`text-xs font-black uppercase ${newCategory === cat.id ? 'text-text' : 'text-muted'}`}>{cat.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Mensaje / Detalle</label>
                                <textarea 
                                    autoFocus
                                    value={newContent}
                                    onChange={(e) => setNewContent(e.target.value)}
                                    placeholder="Escribe tu anotación aquí..."
                                    className="w-full bg-background border border-surfaceHighlight rounded-2xl p-4 text-sm font-medium text-text outline-none focus:border-primary shadow-inner min-h-[120px] resize-none"
                                />
                            </div>

                            <button 
                                onClick={handleCreate}
                                disabled={!newContent.trim() || isSaving}
                                className="w-full py-4 bg-[#e47c00] hover:bg-[#cc6f00] text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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

function getTimeAgo(dateStr: string) {
    const diff = (new Date().getTime() - new Date(dateStr).getTime()) / 1000 / 60;
    if (diff < 1) return 'un momento';
    if (diff < 60) return `${Math.floor(diff)} min`;
    const hours = diff / 60;
    if (hours < 24) return `${Math.floor(hours)} horas`;
    return `${Math.floor(hours / 24)} días`;
}
