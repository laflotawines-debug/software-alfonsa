
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, 
    Printer, 
    Tag, 
    Loader2,
    RefreshCw,
    AlertCircle,
    Boxes,
    ArrowUpCircle,
    CheckSquare,
    Square,
    Eye,
    Settings2,
    Type,
    Percent,
    Layout,
    RotateCcw,
    CheckCircle2,
    XCircle,
    Trash2
} from 'lucide-react';
import { supabase } from '../supabase';
import { MasterProduct } from '../types';
import { jsPDF } from 'jspdf';

interface LabelItem extends MasterProduct {
    selected: boolean;
    lastPrintedPrice?: number;
}

export const Etiquetador: React.FC = () => {
    const [products, setProducts] = useState<LabelItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSavingState, setIsSavingState] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);

    // --- CONFIGURACIÓN DE DISEÑO ---
    const [priceFontSize, setPriceFontSize] = useState(48);
    const [nameFontSize, setNameFontSize] = useState(14);
    const [discountPct, setDiscountPct] = useState(0);
    const [showCode, setShowCode] = useState(true);

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data: catalogData, error: catError } = await supabase
                .from('master_products')
                .select('*')
                .gt('stock_betbeder', 0) 
                .order('desart', { ascending: true });

            if (catError) throw catError;

            const { data: stateData, error: stateError } = await supabase
                .from('printed_labels_state')
                .select('*');

            if (stateError) throw stateError;

            const stateMap = new Map(stateData?.map(s => [s.codart, s.last_printed_price]));
            const mapped = (catalogData || []).map(p => ({
                ...p,
                selected: false,
                lastPrintedPrice: stateMap.get(p.codart)
            }));

            setProducts(mapped);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Error de sincronización.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const needsLabel = (p: LabelItem) => {
        return p.lastPrintedPrice === undefined || Math.abs(p.pventa_1 - p.lastPrintedPrice) > 0.01;
    };

    const filteredProducts = useMemo(() => {
        return products.filter(p => 
            p.desart.toLowerCase().includes(searchTerm.toLowerCase()) || 
            p.codart.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [products, searchTerm]);

    const selectedCount = products.filter(p => p.selected).length;
    const allSelected = filteredProducts.length > 0 && filteredProducts.every(p => p.selected);

    const toggleSelectAll = () => {
        const nextValue = !allSelected;
        const filteredIds = new Set(filteredProducts.map(p => p.codart));
        setProducts(prev => prev.map(p => filteredIds.has(p.codart) ? { ...p, selected: nextValue } : p));
    };

    const toggleSelect = (codart: string) => {
        setProducts(prev => prev.map(p => p.codart === codart ? { ...p, selected: !p.selected } : p));
    };

    const resetPrintHistory = async () => {
        if (!window.confirm("¿Estás seguro? Esto borrará el historial de lo que ya imprimiste. Todas las etiquetas volverán a marcarse como 'pendiente'.")) return;
        
        setIsSavingState(true);
        try {
            const { error: delError } = await supabase
                .from('printed_labels_state')
                .delete()
                .neq('codart', '._._._.'); 

            if (delError) throw delError;
            await fetchData();
        } catch (err: any) {
            alert("Error al resetear: " + err.message);
        } finally {
            setIsSavingState(false);
        }
    };

    const calculateDiscountedPrice = (original: number) => {
        if (discountPct <= 0) return original;
        return original * (1 - discountPct / 100);
    };

    const generateLabelsPDF = async () => {
        const toPrint = products.filter(p => p.selected);
        if (toPrint.length === 0) return;

        setIsSavingState(true);
        try {
            // A4: 210 x 297 mm
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const margin = 10;
            const labelWidth = 90;
            const labelHeight = 60;
            const gap = 5;
            const labelsPerRow = 2;
            const labelsPerPage = 8;

            toPrint.forEach((p, index) => {
                const pageIndex = index % labelsPerPage;
                if (index > 0 && pageIndex === 0) doc.addPage();
                
                const row = Math.floor(pageIndex / labelsPerRow);
                const col = pageIndex % labelsPerRow;
                const x = margin + col * (labelWidth + gap);
                const y = margin + row * (labelHeight + gap);
                
                // 1. Marco de la etiqueta
                doc.setDrawColor(230).setLineWidth(0.1).rect(x, y, labelWidth, labelHeight);
                
                // 2. Código (Arriba Izquierda)
                if (showCode) {
                    doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(180).text(p.codart, x + 4, y + 6);
                }

                const finalPrice = calculateDiscountedPrice(p.pventa_1);
                
                // 3. Área de Precio (Centrada verticalmente en la mitad superior)
                let priceY = y + (labelHeight / 2) - 2;
                
                // Si hay descuento, movemos el precio original arriba
                if (discountPct > 0) {
                    doc.setFontSize(10).setTextColor(150).setFont('helvetica', 'bold');
                    doc.text(
                        `$ ${Math.round(p.pventa_1).toLocaleString('es-AR')}`,
                        x + labelWidth / 2,
                        y + (labelHeight / 2) - 16,
                        { align: 'center' }
                    );
                    doc.setDrawColor(150).setLineWidth(0.3).line(
                        x + (labelWidth / 2) - 12, y + (labelHeight / 2) - 17.5,
                        x + (labelWidth / 2) + 12, y + (labelHeight / 2) - 17.5
                    );
                }

                // Precio Principal
                doc.setFontSize(priceFontSize).setTextColor(0).setFont('helvetica', 'bold');
                doc.text(
                    `$ ${Math.round(finalPrice).toLocaleString('es-AR')}`, 
                    x + labelWidth / 2, 
                    priceY + (priceFontSize / 8), 
                    { align: 'center' }
                );

                // 4. Área del Nombre (Ocupa el resto de la tarjeta abajo)
                // Usamos splitTextToSize para manejar múltiples líneas
                doc.setFontSize(nameFontSize).setTextColor(40).setFont('helvetica', 'bold');
                const textWidth = labelWidth - 10; // Margen interno
                const splitTitle = doc.splitTextToSize(p.desart.toUpperCase(), textWidth);
                
                // Calculamos la altura total del bloque de texto para centrarlo en el espacio de abajo
                const lineHeight = nameFontSize * 0.45; // mm aprox por línea
                const totalTextHeight = splitTitle.length * lineHeight;
                
                // El espacio para el nombre empieza desde la mitad hacia abajo
                const nameAreaStartY = y + (labelHeight / 2) + 5;
                const nameAreaHeight = labelHeight - (labelHeight / 2) - 10;
                
                // Centramos el bloque de texto verticalmente en su área
                const finalNameY = nameAreaStartY + (nameAreaHeight / 2) - (totalTextHeight / 2) + lineHeight;

                doc.text(
                    splitTitle, 
                    x + labelWidth / 2, 
                    finalNameY, 
                    { align: 'center', maxWidth: textWidth }
                );
            });

            // Guardar estado en DB
            const upsertPayload = toPrint.map(p => ({
                codart: p.codart,
                last_printed_price: p.pventa_1
            }));

            const { error: upError } = await supabase.from('printed_labels_state').upsert(upsertPayload);
            if (upError) throw upError;
            
            doc.save(`etiquetas_alfonsa_${Date.now()}.pdf`);
            await fetchData();
        } catch (err: any) {
            alert("Error al generar PDF: " + err.message);
        } finally {
            setIsSavingState(false);
        }
    };

    const previewProduct = products.find(p => p.selected) || products[0] || { codart: '7610', desart: '4000 GRAN RESERVA CAB SAUV 750CC', pventa_1: 14000 };

    return (
        <div className="flex flex-col gap-6 pb-20 max-w-7xl mx-auto animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight uppercase italic flex items-center gap-3">
                        <Tag className="text-primary" size={32} />
                        Etiquetador
                    </h2>
                    <p className="text-muted text-sm mt-1 font-medium flex items-center gap-2">
                        <Boxes size={14} className="text-primary" />
                        Ajusta el tamaño del nombre para que ocupe todo el espacio.
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button 
                        onClick={resetPrintHistory} 
                        disabled={isLoading || isSavingState} 
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-4 rounded-2xl bg-surface border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all font-black text-[10px] uppercase shadow-sm"
                    >
                        <RotateCcw size={18} /> Limpiar Historial
                    </button>
                    <button 
                        onClick={fetchData} 
                        className="p-4 rounded-2xl bg-surface border border-surfaceHighlight text-muted hover:text-primary transition-all shadow-sm"
                    >
                        <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button 
                        onClick={generateLabelsPDF} 
                        disabled={selectedCount === 0 || isSavingState} 
                        className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-primary hover:bg-primaryHover text-white px-10 py-4 rounded-2xl font-black text-sm uppercase transition-all shadow-xl shadow-primary/20 disabled:opacity-50 active:scale-95"
                    >
                        {isSavingState ? <Loader2 size={20} className="animate-spin" /> : <Printer size={20} />} 
                        Imprimir ({selectedCount})
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-surface rounded-3xl border border-surfaceHighlight p-6 shadow-sm">
                        <div className="flex flex-col md:flex-row gap-4 mb-6">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
                                <input 
                                    type="text" 
                                    placeholder="Buscar producto..." 
                                    value={searchTerm} 
                                    onChange={(e) => setSearchTerm(e.target.value)} 
                                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-background border border-surfaceHighlight outline-none focus:border-primary font-bold shadow-inner" 
                                />
                            </div>
                            <button 
                                onClick={() => setProducts(prev => prev.map(p => ({ ...p, selected: needsLabel(p) })))} 
                                className="px-6 py-4 rounded-2xl bg-orange-500 text-white font-black text-[10px] uppercase flex items-center gap-2 hover:bg-orange-600 transition-all shadow-lg"
                            >
                                <ArrowUpCircle size={18} /> 
                                Pendientes ({products.filter(p => needsLabel(p)).length})
                            </button>
                        </div>

                        <div className="overflow-hidden border border-surfaceHighlight rounded-2xl max-h-[600px] overflow-y-auto">
                            <table className="w-full text-left">
                                <thead className="bg-background/90 sticky top-0 z-10 text-[10px] text-muted uppercase font-black border-b border-surfaceHighlight">
                                    <tr>
                                        <th className="p-4 w-12 text-center">
                                            <button onClick={toggleSelectAll} className="p-1 hover:text-primary transition-colors">
                                                {allSelected ? <CheckSquare size={20} className="text-primary" /> : <Square size={20} />}
                                            </button>
                                        </th>
                                        <th className="p-4">Artículo</th>
                                        <th className="p-4 text-right">Precio Hoy</th>
                                        <th className="p-4 text-center">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surfaceHighlight">
                                    {isLoading ? (
                                        <tr><td colSpan={5} className="py-20 text-center"><Loader2 size={32} className="animate-spin mx-auto text-primary" /></td></tr>
                                    ) : filteredProducts.map(p => {
                                        const delta = needsLabel(p);
                                        return (
                                            <tr 
                                                key={p.codart} 
                                                onClick={() => toggleSelect(p.codart)} 
                                                className={`cursor-pointer hover:bg-primary/5 transition-colors ${p.selected ? 'bg-primary/5' : ''}`}
                                            >
                                                <td className="p-4 text-center">
                                                    {p.selected ? <CheckSquare size={20} className="text-primary" /> : <Square size={20} />}
                                                </td>
                                                <td className="p-4">
                                                    <p className="text-[10px] font-black text-primary mb-0.5">{p.codart}</p>
                                                    <p className="text-xs font-bold text-text uppercase truncate max-w-[300px]">{p.desart}</p>
                                                </td>
                                                <td className="p-4 text-right text-xs font-black text-text">
                                                    $ {p.pventa_1.toLocaleString('es-AR')}
                                                </td>
                                                <td className="p-4 text-center">
                                                    {delta ? (
                                                        <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-600 text-[9px] font-black uppercase tracking-widest animate-pulse">Sin Imprimir</span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded bg-green-500/5 text-green-500/40 text-[9px] font-black uppercase tracking-widest">Al día</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-surface rounded-3xl border border-surfaceHighlight p-6 shadow-sm">
                        <h3 className="text-xs font-black text-muted mb-4 flex items-center gap-2 uppercase italic tracking-widest">
                            <Eye size={18} className="text-primary" /> Vista Previa Real
                        </h3>
                        <div className="bg-background p-6 rounded-2xl flex items-center justify-center border border-dashed border-surfaceHighlight">
                            <div className="w-full aspect-[3/2] bg-white rounded shadow-2xl border border-slate-200 flex flex-col p-4 relative overflow-hidden text-slate-900 font-sans">
                                {showCode && <span className="absolute top-3 left-4 text-[10px] font-black text-slate-300">{previewProduct.codart}</span>}
                                
                                <div className="flex-1 flex flex-col items-center justify-center text-center mt-2">
                                    {discountPct > 0 && (
                                        <div className="flex flex-col items-center mb-1">
                                            <div className="relative">
                                                <span className="text-[14px] font-bold text-slate-400">$ {Math.round(previewProduct.pventa_1).toLocaleString('es-AR')}</span>
                                                <div className="absolute top-1/2 left-0 w-full h-px bg-slate-400 rotate-[-5deg]" />
                                            </div>
                                        </div>
                                    )}
                                    <h4 className="font-black leading-none tracking-tighter" style={{ fontSize: `${priceFontSize}px` }}>
                                        $ {Math.round(calculateDiscountedPrice(previewProduct.pventa_1)).toLocaleString('es-AR')}
                                    </h4>
                                    
                                    {/* Contenedor dinámico para el nombre */}
                                    <div className="mt-4 flex flex-col items-center justify-center flex-1 w-full">
                                        <p className="font-black uppercase leading-[1.15] break-words text-center" style={{ fontSize: `${nameFontSize}px` }}>
                                            {previewProduct.desart}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <p className="text-[9px] text-muted text-center mt-4 font-bold uppercase tracking-wider">Papel: 90mm x 60mm (Termotransferible)</p>
                    </div>

                    <div className="bg-surface rounded-3xl border border-surfaceHighlight p-6 shadow-sm space-y-6">
                        <h3 className="text-sm font-black text-muted flex items-center gap-2 uppercase italic tracking-widest">
                            <Settings2 size={18} className="text-primary" /> Configuración de Impresión
                        </h3>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black text-muted uppercase flex items-center gap-2"><Layout size={14} /> Tamaño del Nombre</label>
                                <span className="text-sm font-black text-text">{nameFontSize}px</span>
                            </div>
                            <input 
                                type="range" min="10" max="24" 
                                value={nameFontSize} 
                                onChange={(e) => setNameFontSize(parseInt(e.target.value))}
                                className="w-full accent-primary" 
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black text-muted uppercase flex items-center gap-2"><Type size={14} /> Tamaño del Precio</label>
                                <span className="text-sm font-black text-text">{priceFontSize}px</span>
                            </div>
                            <input 
                                type="range" min="30" max="75" 
                                value={priceFontSize} 
                                onChange={(e) => setPriceFontSize(parseInt(e.target.value))}
                                className="w-full accent-primary" 
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black text-muted uppercase flex items-center gap-2"><Percent size={14} /> Descuento Aplicado</label>
                                <span className="text-sm font-black text-primary">{discountPct}%</span>
                            </div>
                            <input 
                                type="range" min="0" max="50" step="5" 
                                value={discountPct} 
                                onChange={(e) => setDiscountPct(parseInt(e.target.value))}
                                className="w-full accent-primary" 
                            />
                        </div>

                        <div className="pt-4 border-t border-surfaceHighlight flex items-center justify-between">
                            <span className="text-[10px] font-black text-muted uppercase">Mostrar Cód Art</span>
                            <button 
                                onClick={() => setShowCode(!showCode)}
                                className={`w-12 h-6 rounded-full transition-all relative ${showCode ? 'bg-primary' : 'bg-surfaceHighlight'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${showCode ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
