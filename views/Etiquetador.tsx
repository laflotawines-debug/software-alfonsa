
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, 
    Printer, 
    Loader2,
    Eye,
    Settings2,
    Plus,
    CheckSquare,
    Square,
    MinusSquare,
    Flame,
    Trash2,
    Layers,
    ChevronDown,
    Filter,
    FileText,
    RotateCcw,
    Tag
} from 'lucide-react';
import { supabase } from '../supabase';
import { MasterProduct } from '../types';
import { jsPDF } from 'jspdf';

interface LabelQueueItem {
    id: string;
    codart: string;
    desart: string;
    originalPrice: number;
    discount: number;
    finalPrice: number;
    selected: boolean;
}

type ListFilter = 'TODOS' | 'OFERTAS' | 'CAMBIOS';

export const Etiquetador: React.FC = () => {
    const [products, setProducts] = useState<MasterProduct[]>([]);
    const [printedState, setPrintedState] = useState<Record<string, { price: number, discount: number }>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [subfamilyFilter, setSubfamilyFilter] = useState('TODAS');
    const [listTypeFilter, setListTypeFilter] = useState<ListFilter>('TODOS');
    
    const [selectedFromSearch, setSelectedFromSearch] = useState<Set<string>>(new Set());
    const [forceNormalPrice, setForceNormalPrice] = useState<Set<string>>(new Set()); 
    const [batchDiscount, setBatchDiscount] = useState(0);
    const [labelQueue, setLabelQueue] = useState<LabelQueueItem[]>([]);
    
    // Configuraciones de Diseño
    const [labelWidthCm, setLabelWidthCm] = useState(6);
    const [labelHeightCm, setLabelHeightCm] = useState(3.5);
    const [priceRem, setPriceRem] = useState(4.5); 
    const [nameRem, setNameRem] = useState(0.75);
    
    const [showOriginalPrice, setShowOriginalPrice] = useState(true);
    const [printOnlyOffers, setPrintOnlyOffers] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [prodRes, stateRes] = await Promise.all([
                supabase.from('master_products').select('*').gt('stock_betbeder', 0).order('desart', { ascending: true }),
                supabase.from('printed_labels_state').select('*')
            ]);
            if (prodRes.data) setProducts(prodRes.data);
            if (stateRes.data) {
                const map: Record<string, { price: number, discount: number }> = {};
                stateRes.data.forEach((s: any) => { 
                    map[s.codart] = { 
                        price: s.last_printed_price || 0, 
                        discount: s.last_discount || 0 
                    }; 
                });
                setPrintedState(map);
            }
        } catch (err) { console.error(err); } finally { setIsLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const subfamilies = useMemo(() => {
        const unique = Array.from(new Set(products.map(p => p.nsubf).filter(Boolean)));
        return ['TODAS', ...unique.sort()];
    }, [products]);

    const processedProducts = useMemo(() => {
        return products.map(p => {
            const history = printedState[p.codart];
            const isNew = !history;
            const hasPrintedOffer = history && history.discount > 0;
            const isEndingOffer = forceNormalPrice.has(p.codart);
            const currentItemDiscount = isEndingOffer ? 0 : batchDiscount;
            const proposedFinal = p.pventa_1 * (1 - currentItemDiscount / 100);
            const lastPrintedFinal = history ? history.price * (1 - history.discount / 100) : null;
            const isChange = !isNew && Math.round(proposedFinal) !== Math.round(lastPrintedFinal || 0);

            return {
                ...p,
                history,
                isNew,
                isChange,
                hasPrintedOffer,
                isEndingOffer,
                lastPrintedFinal,
                currentItemDiscount,
                proposedFinal
            };
        });
    }, [products, printedState, batchDiscount, forceNormalPrice]);

    const filteredProducts = useMemo(() => {
        return processedProducts.filter(p => {
            const matchesSearch = p.desart.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 p.codart.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesSubfamily = subfamilyFilter === 'TODAS' || p.nsubf === subfamilyFilter;
            
            let matchesListType = true;
            if (listTypeFilter === 'OFERTAS') matchesListType = p.hasPrintedOffer;
            if (listTypeFilter === 'CAMBIOS') matchesListType = p.isChange || p.isNew;

            return matchesSearch && matchesSubfamily && matchesListType;
        }).slice(0, 50); // Aumentado para mejor selección masiva
    }, [processedProducts, searchTerm, subfamilyFilter, listTypeFilter]);

    // Lógica para Seleccionar Todo el filtro actual
    const toggleAllVisible = () => {
        const next = new Set(selectedFromSearch);
        const allFilteredSelected = filteredProducts.every(p => selectedFromSearch.has(p.codart));
        
        if (allFilteredSelected) {
            // Quitar todos los visibles
            filteredProducts.forEach(p => next.delete(p.codart));
        } else {
            // Agregar todos los visibles
            filteredProducts.forEach(p => next.add(p.codart));
        }
        setSelectedFromSearch(next);
    };

    const isAllFilteredSelected = useMemo(() => {
        if (filteredProducts.length === 0) return false;
        return filteredProducts.every(p => selectedFromSearch.has(p.codart));
    }, [filteredProducts, selectedFromSearch]);

    const isSomeFilteredSelected = useMemo(() => {
        if (filteredProducts.length === 0) return false;
        return !isAllFilteredSelected && filteredProducts.some(p => selectedFromSearch.has(p.codart));
    }, [filteredProducts, selectedFromSearch, isAllFilteredSelected]);

    const toggleSearchSelection = (codart: string) => {
        const next = new Set(selectedFromSearch);
        if (next.has(codart)) next.delete(codart); else next.add(codart);
        setSelectedFromSearch(next);
    };

    const toggleRevertOffer = (e: React.MouseEvent, codart: string) => {
        e.stopPropagation();
        const next = new Set(forceNormalPrice);
        if (next.has(codart)) next.delete(codart); else next.add(codart);
        setForceNormalPrice(next);
    };

    const addSelectedToQueue = () => {
        const toAdd = processedProducts.filter(p => selectedFromSearch.has(p.codart));
        const newItems: LabelQueueItem[] = toAdd.map(p => ({
            id: `${p.codart}-${Date.now()}-${Math.random()}`,
            codart: p.codart,
            desart: p.desart,
            originalPrice: p.pventa_1,
            discount: p.currentItemDiscount,
            finalPrice: p.proposedFinal,
            selected: true
        }));
        setLabelQueue(prev => [...newItems, ...prev]);
        setSelectedFromSearch(new Set());
    };

    const generatePDF = async (shouldSaveState: boolean = true) => {
        let itemsToPrint = labelQueue.filter(i => i.selected);
        if (printOnlyOffers) itemsToPrint = itemsToPrint.filter(i => i.discount > 0);
        if (itemsToPrint.length === 0) { alert("No hay productos seleccionados."); return; }

        try {
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const margin = 10;
            const labelWidth = labelWidthCm * 10;
            const labelHeight = labelHeightCm * 10;
            const gap = 1; 
            const labelsPerRow = Math.floor((210 - (margin * 2)) / (labelWidth + gap));
            const labelsPerCol = Math.floor((297 - (margin * 2)) / (labelHeight + gap));
            const labelsPerPage = labelsPerRow * labelsPerCol;

            itemsToPrint.forEach((item, index) => {
                const pageIndex = index % labelsPerPage;
                if (index > 0 && pageIndex === 0) doc.addPage();
                const row = Math.floor(pageIndex / labelsPerRow);
                const col = pageIndex % labelsPerRow;
                const x = margin + col * (labelWidth + gap);
                const y = margin + row * (labelHeight + gap);
                
                doc.setDrawColor(0).setLineWidth(0.5).rect(x, y, labelWidth, labelHeight);
                doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(0).text(item.codart, x + 2, y + 4);

                if (item.discount > 0) {
                    const badgeW = 9; const badgeH = 4;
                    doc.setFillColor(0).roundedRect(x + labelWidth - badgeW - 1.5, y + 1.5, badgeW, badgeH, 0.5, 0.5, 'F');
                    doc.setTextColor(255).setFontSize(6).text(`-${item.discount}%`, x + labelWidth - (badgeW/2) - 1.5, y + 4.3, { align: 'center' });
                }

                if (item.discount > 0 && showOriginalPrice) {
                    const oldPrice = `$ ${Math.round(item.originalPrice).toLocaleString('es-AR')}`;
                    doc.setFontSize(7).setTextColor(150).setFont('helvetica', 'normal');
                    doc.text(oldPrice, x + labelWidth / 2, y + (labelHeight * 0.3), { align: 'center' });
                    const tw = doc.getTextWidth(oldPrice);
                    doc.setDrawColor(150).setLineWidth(0.2).line(x + (labelWidth/2) - (tw/2), y + (labelHeight * 0.3) - 1, x + (labelWidth/2) + (tw/2), y + (labelHeight * 0.3) - 1);
                }

                doc.setFontSize(priceRem * 8).setTextColor(0).setFont('helvetica', 'bold');
                doc.text(`$ ${Math.round(item.finalPrice).toLocaleString('es-AR')}`, x + labelWidth / 2, y + (labelHeight * 0.65), { align: 'center' });
                doc.setFontSize(nameRem * 11).setTextColor(0).setFont('helvetica', 'bold');
                const splitTitle = doc.splitTextToSize(item.desart.toUpperCase(), labelWidth - 6);
                doc.text(splitTitle, x + labelWidth / 2, y + labelHeight - 4, { align: 'center', maxWidth: labelWidth - 6 });
            });

            if (shouldSaveState) {
                const upsertData = itemsToPrint.map(i => ({ codart: i.codart, last_printed_price: i.originalPrice, last_discount: i.discount }));
                const { error } = await supabase.from('printed_labels_state').upsert(upsertData, { onConflict: 'codart' });
                if (error) throw error;
                setLabelQueue([]);
                setForceNormalPrice(new Set());
                await fetchData(); 
                alert("¡Lote impreso y base de góndola actualizada!");
            }
            const pdfBlob = doc.output('bloburl');
            window.open(pdfBlob, '_blank');
        } catch (err: any) { alert("Error: " + err.message); }
    };

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] gap-6 animate-in fade-in overflow-hidden">
            
            <div className="flex-1 flex flex-col gap-6 min-w-0 overflow-hidden">
                <div className="bg-surface rounded-3xl border border-surfaceHighlight shadow-sm flex flex-col max-h-[500px] shrink-0">
                    <div className="p-5 border-b border-surfaceHighlight flex flex-col gap-4 bg-background/20">
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                                <input 
                                    type="text" placeholder="Buscar por nombre o código..." value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-background border border-surfaceHighlight rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary uppercase shadow-inner"
                                />
                            </div>
                            <div className="flex gap-2">
                                <div className="relative min-w-[160px]">
                                    <Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                                    <select value={subfamilyFilter} onChange={(e) => setSubfamilyFilter(e.target.value)} className="w-full appearance-none bg-background border border-surfaceHighlight rounded-2xl py-3.5 pl-11 pr-10 text-sm font-black text-muted focus:text-primary outline-none cursor-pointer uppercase transition-all shadow-inner">
                                        {subfamilies.map(sf => <option key={sf} value={sf}>{sf === 'TODAS' ? 'TODAS SUBF.' : sf}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" size={14} />
                                </div>
                                <div className="relative min-w-[140px]">
                                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                                    <select value={listTypeFilter} onChange={(e) => setListTypeFilter(e.target.value as ListFilter)} className="w-full appearance-none bg-background border border-surfaceHighlight rounded-2xl py-3.5 pl-11 pr-10 text-sm font-black text-muted focus:text-primary outline-none cursor-pointer uppercase transition-all shadow-inner">
                                        <option value="TODOS">TODOS</option>
                                        <option value="OFERTAS">OFERTAS</option>
                                        <option value="CAMBIOS">CAMBIOS</option>
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" size={14} />
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-between gap-3 border-t border-surfaceHighlight/30 pt-3">
                            <div className="flex items-center gap-2 bg-background px-4 py-2 rounded-2xl border border-surfaceHighlight">
                                <Flame size={14} className="text-orange-500" />
                                <input type="number" value={batchDiscount} onChange={e => setBatchDiscount(parseInt(e.target.value)||0)} className="w-10 bg-transparent text-center font-black text-primary outline-none" />
                                <span className="text-[10px] font-black uppercase text-muted">% OFF GLOBAL</span>
                            </div>
                            <button 
                                onClick={addSelectedToQueue} disabled={selectedFromSearch.size === 0}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-primary text-white rounded-2xl font-black text-xs uppercase shadow-lg disabled:opacity-30 transition-all active:scale-95"
                            >
                                <Plus size={16} /> Agregar ({selectedFromSearch.size})
                            </button>
                        </div>
                    </div>
                    
                    <div className="overflow-y-auto">
                        <table className="w-full text-left">
                            <thead className="bg-background/40 text-[9px] text-muted uppercase font-black tracking-widest border-b border-surfaceHighlight sticky top-0 z-10">
                                <tr>
                                    <th className="p-3 w-12 text-center cursor-pointer hover:text-primary transition-colors" onClick={toggleAllVisible}>
                                        <div className="flex items-center justify-center">
                                            {isAllFilteredSelected ? (
                                                <CheckSquare size={18} className="text-primary" />
                                            ) : isSomeFilteredSelected ? (
                                                <MinusSquare size={18} className="text-primary" />
                                            ) : (
                                                <Square size={18} className="text-muted" />
                                            )}
                                        </div>
                                    </th>
                                    <th className="p-3">Artículo / Clasificación</th>
                                    <th className="p-3 text-right">Precio en Góndola</th>
                                    <th className="p-3 text-right">Precio Maestro</th>
                                    <th className="p-3 text-center">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surfaceHighlight/50">
                                {isLoading ? (
                                    <tr><td colSpan={5} className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></td></tr>
                                ) : filteredProducts.map(p => (
                                    <tr key={p.codart} className={`group hover:bg-primary/5 transition-colors cursor-pointer ${selectedFromSearch.has(p.codart) ? 'bg-primary/5' : ''}`} onClick={() => toggleSearchSelection(p.codart)}>
                                        <td className="p-3 text-center">{selectedFromSearch.has(p.codart) ? <CheckSquare size={18} className="text-primary mx-auto" /> : <Square size={18} className="text-muted mx-auto" />}</td>
                                        <td className="p-3">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] font-black text-text uppercase truncate max-w-[180px]">{p.desart}</span>
                                                    {p.hasPrintedOffer && (
                                                        <button 
                                                            onClick={(e) => toggleRevertOffer(e, p.codart)}
                                                            className={`h-5 w-5 rounded flex items-center justify-center border transition-all
                                                                ${p.isEndingOffer 
                                                                    ? 'bg-red-500 text-white border-red-600 shadow-sm' 
                                                                    : 'bg-orange-500/10 text-orange-600 border-orange-300 hover:bg-red-500 hover:text-white'}
                                                            `}
                                                            title={p.isEndingOffer ? "Oferta Quitada" : "Artículo en Oferta"}
                                                        >
                                                            <span className="text-[10px] font-black">F</span>
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[9px] font-mono text-muted">#{p.codart}</span>
                                                    {p.nsubf && <span className="text-[8px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">{p.nsubf}</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="font-bold text-xs text-muted">{p.lastPrintedFinal !== null ? `$ ${Math.round(p.lastPrintedFinal).toLocaleString('es-AR')}` : '---'}</span>
                                                {p.hasPrintedOffer && !p.isEndingOffer && <span className="text-[7px] text-orange-500 font-black uppercase">Oferta Activa</span>}
                                            </div>
                                        </td>
                                        <td className="p-3 text-right font-black text-xs text-text">
                                            <div className="flex flex-col items-end">
                                                <span className={p.isEndingOffer ? 'text-primary' : ''}>$ {p.pventa_1.toLocaleString('es-AR')}</span>
                                                {p.currentItemDiscount > 0 && <span className="text-[9px] text-primary font-bold">-{p.currentItemDiscount}%</span>}
                                                {p.isEndingOffer && <span className="text-[8px] text-red-500 font-black uppercase flex items-center gap-1 mt-0.5"><RotateCcw size={8}/> Revertir a Normal</span>}
                                            </div>
                                        </td>
                                        <td className="p-3 text-center">
                                            {p.isNew ? (
                                                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-200 text-[8px] font-black uppercase">Nueva</span>
                                            ) : p.isChange ? (
                                                <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-600 border border-orange-200 text-[8px] font-black uppercase">Cambio</span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-600 border border-green-200 text-[8px] font-black uppercase">OK</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex-1 bg-surface rounded-3xl border border-surfaceHighlight shadow-sm flex flex-col overflow-hidden min-h-0">
                    <div className="px-6 py-4 border-b border-surfaceHighlight bg-background/20 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-3"><Tag size={20} className="text-primary" /><h3 className="text-sm font-black text-text uppercase italic">Cola de Impresión</h3></div>
                        <button onClick={() => setLabelQueue([])} className="text-[9px] font-black text-muted hover:text-red-500 uppercase tracking-widest transition-colors">Vaciar</button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-left">
                            <tbody className="divide-y divide-surfaceHighlight">
                                {labelQueue.map((item) => (
                                    <tr key={item.id} className={`group hover:bg-primary/5 transition-colors ${!item.selected ? 'opacity-40 grayscale' : ''}`}>
                                        <td className="p-4 text-center w-12"><button onClick={() => setLabelQueue(prev => prev.map(i => i.id === item.id ? {...i, selected: !i.selected} : i))}>{item.selected ? <CheckSquare className="text-primary" size={20} /> : <Square className="text-muted" size={20} />}</button></td>
                                        <td className="p-4"><p className="text-xs font-black text-text uppercase leading-tight">{item.desart}</p><p className="text-[9px] font-mono text-muted uppercase">#{item.codart}</p></td>
                                        <td className="p-4 text-right"><p className="text-sm font-black text-green-600">$ {Math.round(item.finalPrice).toLocaleString('es-AR')}</p><p className="text-[8px] font-bold text-muted uppercase">{item.discount > 0 ? `Oferta ${item.discount}%` : 'Precio Normal'}</p></td>
                                        <td className="p-4 text-center w-12"><button onClick={() => setLabelQueue(prev => prev.filter(i => i.id !== item.id))} className="p-2 text-muted hover:text-red-500 transition-colors"><Trash2 size={16} /></button></td>
                                    </tr>
                                ))}
                                {labelQueue.length === 0 && (<tr><td className="p-20 text-center text-muted italic font-bold uppercase opacity-30">Cola Vacía</td></tr>)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="w-full lg:w-[320px] xl:w-[380px] flex flex-col gap-6 shrink-0 h-full overflow-y-auto pr-2 pb-10 scrollbar-thin">
                <div className="bg-surface rounded-3xl border border-surfaceHighlight shadow-sm flex flex-col shrink-0">
                    <div className="px-5 py-3 border-b border-surfaceHighlight bg-background/20 flex justify-between items-center"><h3 className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2 italic"><Eye size={14} className="text-primary" /> Diseño Referencia</h3></div>
                    <div className="p-8 bg-background/40 flex justify-center items-center min-h-[240px]">
                        <div className="bg-white border-[2px] border-black flex flex-col relative font-sans text-black shadow-2xl overflow-hidden box-border" style={{ width: `${labelWidthCm * 50}px`, height: `${labelHeightCm * 50}px`, padding: '12px' }}>
                            <div className="flex justify-between items-start w-full h-[15%]"><span className="text-[10px] font-bold leading-none">8044</span>{batchDiscount > 0 && <div className="bg-black text-white px-1.5 py-0.5 rounded-[3px] text-[9px] font-black leading-none">-{batchDiscount}%</div>}</div>
                            <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0">{showOriginalPrice && batchDiscount > 0 && <div className="relative text-gray-400 font-bold text-[11px] mb-0.5 leading-none">$ 32.000<div className="absolute top-1/2 left-[-2px] w-[calc(100%+4px)] h-px bg-gray-400" /></div>}<div className="font-black leading-none whitespace-nowrap overflow-hidden" style={{ fontSize: `${priceRem}rem` }}>$ 28.800</div></div>
                            <div className="w-full flex items-center justify-center border-t border-gray-100 pt-2 h-[25%]"><p className="font-black uppercase leading-none text-center line-clamp-2" style={{ fontSize: `${nameRem}rem` }}>ARTÍCULO DE PRUEBA</p></div>
                        </div>
                    </div>
                </div>
                <div className="bg-surface rounded-3xl border border-surfaceHighlight p-6 shadow-sm shrink-0">
                    <h3 className="text-xs font-black text-text flex items-center gap-2 uppercase italic border-b border-surfaceHighlight pb-4 mb-4">Dimensiones y Fuentes:</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <InputNumber label="Ancho (cm)" value={labelWidthCm} onChange={setLabelWidthCm} /><InputNumber label="Alto (cm)" value={labelHeightCm} onChange={setLabelHeightCm} /><InputNumber label="Precio (rem)" value={priceRem} onChange={setPriceRem} step={0.1} /><InputNumber label="Nombre (rem)" value={nameRem} onChange={setNameRem} step={0.05} />
                    </div>
                </div>
                <div className="bg-surface rounded-3xl border border-surfaceHighlight p-6 shadow-sm shrink-0">
                    <h3 className="text-xs font-black text-text flex items-center gap-2 uppercase italic border-b border-surfaceHighlight pb-4 mb-4"><Settings2 size={16} className="text-primary" /> Lote</h3>
                    <div className="space-y-3">
                        <button onClick={() => setShowOriginalPrice(!showOriginalPrice)} className="w-full flex items-start gap-3 text-left"><div className={`mt-0.5 shrink-0 ${showOriginalPrice ? 'text-primary' : 'text-muted'}`}>{showOriginalPrice ? <CheckSquare size={18}/> : <Square size={18}/>}</div><span className="text-[11px] font-black text-text uppercase">Mostrar precio tachado</span></button>
                        <button onClick={() => setPrintOnlyOffers(!printOnlyOffers)} className="w-full flex items-start gap-3 text-left pt-3 border-t border-surfaceHighlight/50"><div className={`mt-0.5 shrink-0 ${printOnlyOffers ? 'text-primary' : 'text-muted'}`}>{printOnlyOffers ? <CheckSquare size={18}/> : <Square size={18}/>}</div><span className="text-[11px] font-black text-text uppercase">Solo ofertas en PDF</span></button>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => generatePDF(false)} disabled={labelQueue.length === 0} className="py-4 bg-surface border border-surfaceHighlight text-text hover:bg-surfaceHighlight rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-30"><FileText size={16} /> Vista Previa</button>
                    <button onClick={() => generatePDF(true)} disabled={labelQueue.length === 0} className="py-4 bg-[#e47c00] hover:bg-[#cc6f00] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/30 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-30"><Printer size={16} /> Imprimir Lote</button>
                </div>
            </div>
        </div>
    );
};

const InputNumber: React.FC<{ label: string, value: number, onChange: (v: number) => void, step?: number }> = ({ label, value, onChange, step = 1 }) => (
    <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-muted uppercase tracking-tight ml-1">{label}</label>
        <input type="number" value={value} step={step} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-sm font-black text-text outline-none focus:border-primary shadow-inner" />
    </div>
);
