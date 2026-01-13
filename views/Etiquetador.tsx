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
    Tag,
    MoveVertical,
    Circle
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
    
    const [labelWidthCm, setLabelWidthCm] = useState(6);
    const [labelHeightCm, setLabelHeightCm] = useState(3.5);
    
    const [originalPriceRem, setOriginalPriceRem] = useState(1.35);
    const [priceRem, setPriceRem] = useState(4.7);
    const [nameRem, setNameRem] = useState(1);
    
    const [originalPriceYmm, setOriginalPriceYmm] = useState(9);
    const [priceYmm, setPriceYmm] = useState(22);
    const [nameYmm, setNameYmm] = useState(29);
    
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
            
            const currentItemDiscount = isEndingOffer 
                ? 0 
                : (batchDiscount > 0 ? batchDiscount : (hasPrintedOffer ? history.discount : 0));

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
        const keywords = searchTerm.toLowerCase().split(' ').filter(k => k.trim().length > 0);

        return processedProducts.filter(p => {
            const prodText = `${p.desart} ${p.codart}`.toLowerCase();
            const keywordsMatch = keywords.every(word => prodText.includes(word));
            const matchesSubfamily = subfamilyFilter === 'TODAS' || p.nsubf === subfamilyFilter;
            
            let matchesListType = true;
            if (listTypeFilter === 'OFERTAS') matchesListType = p.hasPrintedOffer;
            if (listTypeFilter === 'CAMBIOS') matchesListType = p.isChange || p.isNew;

            return keywordsMatch && matchesSubfamily && matchesListType;
        }).slice(0, 80); 
    }, [processedProducts, searchTerm, subfamilyFilter, listTypeFilter]);

    const toggleAllVisible = () => {
        const next = new Set(selectedFromSearch);
        const allFilteredSelected = filteredProducts.every(p => selectedFromSearch.has(p.codart));
        if (allFilteredSelected) {
            filteredProducts.forEach(p => next.delete(p.codart));
        } else {
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
        const existingCodes = new Set(labelQueue.map(i => i.codart));
        const toAdd = processedProducts.filter(p => selectedFromSearch.has(p.codart) && !existingCodes.has(p.codart));
        
        if (toAdd.length === 0 && selectedFromSearch.size > 0) {
            alert("Los artículos seleccionados ya están en la cola.");
            setSelectedFromSearch(new Set());
            return;
        }

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
                    const oldPriceText = `$${Math.round(item.originalPrice).toLocaleString('es-AR')}`;
                    doc.setFontSize(originalPriceRem * 11).setTextColor(150).setFont('helvetica', 'normal');
                    const tachadoY = y + originalPriceYmm;
                    doc.text(oldPriceText, x + labelWidth / 2, tachadoY, { align: 'center' });
                    const tw = doc.getTextWidth(oldPriceText);
                    const lineHeightOffset = (originalPriceRem * 1.4);
                    doc.setDrawColor(150).setLineWidth(0.2).line(x + (labelWidth/2) - (tw/2), tachadoY - lineHeightOffset, x + (labelWidth/2) + (tw/2), tachadoY - lineHeightOffset);
                }

                const finalPriceStr = `$${Math.round(item.finalPrice).toLocaleString('es-AR')}`;
                doc.setFontSize(priceRem * 8).setTextColor(0).setFont('helvetica', 'bold');
                
                if (finalPriceStr.includes('.')) {
                    const parts = finalPriceStr.split('.');
                    const fullWidth = doc.getTextWidth(finalPriceStr.replace('.', ' ')); 
                    const part1Width = doc.getTextWidth(parts[0]);
                    const separatorWidth = 2.5; 
                    const startX = x + (labelWidth / 2) - (fullWidth / 2);
                    doc.text(parts[0], startX, y + priceYmm);
                    const circleX = startX + part1Width + (separatorWidth / 2);
                    const circleY = y + priceYmm - 1.2; 
                    doc.setFillColor(0).circle(circleX, circleY, 0.75, 'F');
                    doc.text(parts[1], startX + part1Width + separatorWidth, y + priceYmm);
                } else {
                    doc.text(finalPriceStr, x + labelWidth / 2, y + priceYmm, { align: 'center' });
                }
                
                doc.setFontSize(nameRem * 11).setTextColor(0).setFont('helvetica', 'bold');
                const splitTitle = doc.splitTextToSize(item.desart.toUpperCase(), labelWidth - 6);
                doc.text(splitTitle, x + labelWidth / 2, y + nameYmm, { align: 'center', maxWidth: labelWidth - 6 });
            });

            if (shouldSaveState) {
                const upsertData = itemsToPrint.map(i => ({ codart: i.codart, last_printed_price: i.originalPrice, last_discount: i.discount }));
                await supabase.from('printed_labels_state').upsert(upsertData, { onConflict: 'codart' });
                setLabelQueue([]);
                setForceNormalPrice(new Set());
                fetchData(); 
                alert("¡Lote impreso y base actualizada!");
            }
            const pdfBlob = doc.output('bloburl');
            window.open(pdfBlob, '_blank');
        } catch (err: any) { alert("Error: " + err.message); }
    };

    return (
        <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-140px)] gap-6 animate-in fade-in lg:overflow-hidden pb-10">
            
            {/* COLUMNA IZQUIERDA: BUSCADOR Y COLA */}
            <div className="flex-1 flex flex-col gap-6 min-h-0">
                
                {/* BUSCADOR Y FILTROS */}
                <div className="bg-surface rounded-3xl border border-surfaceHighlight shadow-sm flex flex-col shrink-0 overflow-hidden">
                    <div className="p-4 border-b border-surfaceHighlight flex flex-col gap-3 bg-background/20">
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                                <input type="text" placeholder="Búsqueda inteligente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold text-text outline-none focus:border-primary uppercase shadow-inner" />
                            </div>
                            <div className="flex gap-2">
                                <div className="relative min-w-[140px]">
                                    <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                                    <select value={subfamilyFilter} onChange={(e) => setSubfamilyFilter(e.target.value)} className="w-full appearance-none bg-background border border-surfaceHighlight rounded-2xl py-3.5 pl-9 pr-8 text-[11px] font-black text-muted focus:text-primary outline-none cursor-pointer uppercase shadow-inner">
                                        {subfamilies.map(sf => <option key={sf} value={sf}>{sf === 'TODAS' ? 'TODAS SUBF.' : sf}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" size={12} />
                                </div>
                                <div className="relative min-w-[110px]">
                                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                                    <select value={listTypeFilter} onChange={(e) => setListTypeFilter(e.target.value as ListFilter)} className="w-full appearance-none bg-background border border-surfaceHighlight rounded-2xl py-3.5 pl-9 pr-8 text-[11px] font-black text-muted focus:text-primary outline-none cursor-pointer uppercase shadow-inner">
                                        <option value="TODOS">TODOS</option>
                                        <option value="OFERTAS">OFERTAS</option>
                                        <option value="CAMBIOS">CAMBIOS</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" size={12} />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t border-surfaceHighlight/30 pt-2">
                            <div className="flex items-center gap-2 bg-background px-4 py-1.5 rounded-2xl border border-surfaceHighlight shadow-inner">
                                <Flame size={14} className="text-orange-500" />
                                <input type="number" value={batchDiscount} onChange={e => setBatchDiscount(parseInt(e.target.value)||0)} className="w-10 bg-transparent text-center font-black text-primary outline-none text-sm" />
                                <span className="text-[9px] font-black uppercase text-muted">% OFF GLOBAL</span>
                            </div>
                            <button onClick={addSelectedToQueue} disabled={selectedFromSearch.size === 0} className="flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-white rounded-2xl font-black text-[11px] uppercase shadow-lg disabled:opacity-30 transition-all active:scale-95">
                                <Plus size={14} /> Agregar ({selectedFromSearch.size})
                            </button>
                        </div>
                    </div>
                </div>

                {/* RESULTADOS DE BÚSQUEDA */}
                <div className="lg:flex-[1.2] bg-surface rounded-3xl border border-surfaceHighlight shadow-sm flex flex-col overflow-hidden min-h-[300px] lg:min-h-0">
                    <div className="overflow-x-auto overflow-y-auto flex-1 scrollbar-thin">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-background/40 text-[9px] text-muted uppercase font-black tracking-widest border-b border-surfaceHighlight sticky top-0 z-10 backdrop-blur-md">
                                <tr>
                                    <th className="p-3 w-12 text-center cursor-pointer hover:text-primary transition-colors" onClick={toggleAllVisible}>
                                        <div className="flex items-center justify-center">
                                            {isAllFilteredSelected ? <CheckSquare size={18} className="text-primary" /> : isSomeFilteredSelected ? <MinusSquare size={18} className="text-primary" /> : <Square size={18} className="text-muted" />}
                                        </div>
                                    </th>
                                    <th className="p-3">Artículo</th>
                                    <th className="p-3 text-right">Góndola</th>
                                    <th className="p-3 text-right">Maestro</th>
                                    <th className="p-3 text-center">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surfaceHighlight/50">
                                {isLoading ? (
                                    <tr><td colSpan={5} className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></td></tr>
                                ) : filteredProducts.length === 0 ? (
                                    <tr><td colSpan={5} className="p-10 text-center text-muted font-bold uppercase opacity-30">No hay artículos</td></tr>
                                ) : filteredProducts.map(p => (
                                    <tr key={p.codart} className={`group hover:bg-primary/5 transition-colors cursor-pointer ${selectedFromSearch.has(p.codart) ? 'bg-primary/5' : ''}`} onClick={() => toggleSearchSelection(p.codart)}>
                                        <td className="p-3 text-center">{selectedFromSearch.has(p.codart) ? <CheckSquare size={18} className="text-primary mx-auto" /> : <Square size={18} className="text-muted mx-auto" />}</td>
                                        <td className="p-3">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] font-black text-text uppercase leading-tight">{p.desart}</span>
                                                    {p.hasPrintedOffer && (
                                                        <button onClick={(e) => toggleRevertOffer(e, p.codart)} className={`h-5 w-5 rounded flex items-center justify-center border transition-all shrink-0 ${p.isEndingOffer ? 'bg-red-500 text-white border-red-600 shadow-sm' : 'bg-orange-500/10 text-orange-600 border-orange-300 hover:bg-red-500 hover:text-white'}`}>
                                                            <span className="text-[10px] font-black">F</span>
                                                        </button>
                                                    )}
                                                </div>
                                                <span className="text-[9px] font-mono text-muted">#{p.codart}</span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-right"><span className="font-bold text-xs text-muted">{p.lastPrintedFinal !== null ? `$${Math.round(p.lastPrintedFinal).toLocaleString('es-AR')}` : '---'}</span></td>
                                        <td className="p-3 text-right"><div className="flex flex-col items-end"><span className={`text-xs font-black ${p.isEndingOffer ? 'text-primary' : 'text-text'}`}>$ {p.pventa_1.toLocaleString('es-AR')}</span>{p.currentItemDiscount > 0 && <span className="text-[9px] text-primary font-bold">-{p.currentItemDiscount}%</span>}</div></td>
                                        <td className="p-3 text-center">{p.isNew ? <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-200 text-[8px] font-black uppercase">Nueva</span> : p.isChange ? <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-600 border border-orange-200 text-[8px] font-black uppercase">Cambio</span> : <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-600 border border-green-200 text-[8px] font-black uppercase">OK</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* COLA DE IMPRESIÓN */}
                <div className="lg:flex-1 bg-surface rounded-3xl border border-surfaceHighlight shadow-sm flex flex-col overflow-hidden min-h-[250px] lg:min-h-0">
                    <div className="px-6 py-3 border-b border-surfaceHighlight bg-background/20 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-3"><Tag size={18} className="text-primary" /><h3 className="text-sm font-black text-text uppercase italic">Cola ({labelQueue.length})</h3></div>
                        <button onClick={() => setLabelQueue([])} className="text-[10px] font-black text-muted hover:text-red-500 uppercase tracking-widest transition-colors flex items-center gap-1"><Trash2 size={12}/> Vaciar</button>
                    </div>
                    <div className="flex-1 overflow-y-auto scrollbar-thin">
                        <table className="w-full text-left">
                            <tbody className="divide-y divide-surfaceHighlight">
                                {labelQueue.map((item) => (
                                    <tr key={item.id} className={`group hover:bg-primary/5 transition-colors ${!item.selected ? 'opacity-40 grayscale' : ''}`}>
                                        <td className="p-3 text-center w-12"><button onClick={() => setLabelQueue(prev => prev.map(i => i.id === item.id ? {...i, selected: !i.selected} : i))}>{item.selected ? <CheckSquare className="text-primary" size={18} /> : <Square className="text-muted" size={18} />}</button></td>
                                        <td className="p-3"><p className="text-[11px] font-black text-text uppercase leading-tight">{item.desart}</p><p className="text-[9px] font-mono text-muted uppercase">#{item.codart}</p></td>
                                        <td className="p-3 text-right"><p className="text-sm font-black text-green-600">$ {Math.round(item.finalPrice).toLocaleString('es-AR')}</p></td>
                                        <td className="p-3 text-center w-12"><button onClick={() => setLabelQueue(prev => prev.filter(i => i.id !== item.id))} className="p-2 text-muted hover:text-red-500 transition-colors"><Trash2 size={16} /></button></td>
                                    </tr>
                                ))}
                                {labelQueue.length === 0 && (<tr><td className="p-12 text-center text-muted italic font-bold uppercase opacity-30 text-xs">Sin etiquetas</td></tr>)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* SIDEBAR DERECHO */}
            <div className="w-full lg:w-[320px] xl:w-[380px] flex flex-col gap-4 shrink-0 lg:h-full lg:overflow-y-auto lg:pr-1 scrollbar-thin">
                <div className="bg-surface rounded-3xl border border-surfaceHighlight shadow-sm flex flex-col shrink-0">
                    <div className="px-5 py-2.5 border-b border-surfaceHighlight bg-background/20 flex justify-between items-center"><h3 className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2 italic"><Eye size={14} className="text-primary" /> Diseño Referencia</h3></div>
                    <div className="p-6 bg-background/40 flex justify-center items-center min-h-[160px]">
                        <div className="bg-white border-[2px] border-black relative font-sans text-black shadow-2xl overflow-hidden box-border" style={{ width: `${labelWidthCm * 45}px`, height: `${labelHeightCm * 45}px` }}>
                            <div className="absolute top-[3px] left-[5px] text-[9px] font-bold">8044</div>
                            {batchDiscount > 0 && (<div className="absolute top-[3px] right-[5px] bg-black text-white px-1.5 py-0.5 rounded-[3px] text-[8px] font-black">-{batchDiscount}%</div>)}
                            {showOriginalPrice && batchDiscount > 0 && (<div className="absolute left-0 w-full flex justify-center" style={{ top: `${originalPriceYmm * 4.5}px`, transform: 'translateY(-100%)' }}><div className="relative text-gray-400 font-bold leading-none" style={{ fontSize: `${originalPriceRem}rem` }}>$32.000<div className="absolute top-1/2 left-[-2px] w-[calc(100%+4px)] h-[1.5px] bg-gray-400" /></div></div>)}
                            <div className="absolute left-0 w-full flex flex-col items-center" style={{ top: `${priceYmm * 4.5}px`, transform: 'translateY(-100%)' }}><div className="font-black leading-none whitespace-nowrap flex items-center gap-[0px]" style={{ fontSize: `${priceRem}rem` }}><span>$2</span><div className="w-[0.28em] h-[0.28em] bg-black rounded-full mt-[0.12em] shrink-0" /><span>800</span></div></div>
                            <div className="absolute left-0 w-full px-2" style={{ top: `${nameYmm * 4.5}px`, transform: 'translateY(-100%)' }}><div className="w-full h-px bg-gray-100 mb-1"></div><p className="font-black uppercase leading-none text-center line-clamp-2" style={{ fontSize: `${nameRem}rem` }}>ARTÍCULO DE PRUEBA</p></div>
                        </div>
                    </div>
                </div>
                
                <div className="bg-surface rounded-3xl border border-surfaceHighlight p-5 shadow-sm shrink-0">
                    <h3 className="text-[11px] font-black text-text flex items-center gap-2 uppercase italic border-b border-surfaceHighlight pb-3 mb-3">Geometría (cm):</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <InputNumber label="Ancho" value={labelWidthCm} onChange={setLabelWidthCm} />
                        <InputNumber label="Alto" value={labelHeightCm} onChange={setLabelHeightCm} />
                    </div>
                </div>

                <div className="bg-surface rounded-3xl border border-surfaceHighlight p-5 shadow-sm shrink-0">
                    <h3 className="text-[11px] font-black text-text flex items-center gap-2 uppercase italic border-b border-surfaceHighlight pb-3 mb-3">Tipografías (Rem):</h3>
                    <div className="grid grid-cols-3 gap-3">
                        <InputNumber label="Tachado" value={originalPriceRem} onChange={setOriginalPriceRem} step={0.05} />
                        <InputNumber label="Precio" value={priceRem} onChange={setPriceRem} step={0.1} />
                        <InputNumber label="Nombre" value={nameRem} onChange={setNameRem} step={0.05} />
                    </div>
                </div>

                <div className="bg-surface rounded-3xl border border-surfaceHighlight p-5 shadow-sm shrink-0 border-primary/20">
                    <h3 className="text-[11px] font-black text-primary flex items-center gap-2 uppercase italic border-b border-surfaceHighlight/50 pb-3 mb-3"><MoveVertical size={14} /> Posición Vertical (mm):</h3>
                    <div className="grid grid-cols-2 gap-3">
                         <InputNumber label="Tachado Y" value={originalPriceYmm} onChange={setOriginalPriceYmm} step={1} />
                         <InputNumber label="Precio Y" value={priceYmm} onChange={setPriceYmm} step={1} />
                         <div className="col-span-2"><InputNumber label="Nombre Y" value={nameYmm} onChange={setNameYmm} step={1} /></div>
                    </div>
                </div>

                <div className="bg-surface rounded-3xl border border-surfaceHighlight p-5 shadow-sm shrink-0">
                    <h3 className="text-[11px] font-black text-text flex items-center gap-2 uppercase italic border-b border-surfaceHighlight pb-3 mb-3"><Settings2 size={16} className="text-primary" /> Opciones</h3>
                    <div className="space-y-3">
                        <button onClick={() => setShowOriginalPrice(!showOriginalPrice)} className="w-full flex items-start gap-3 text-left"><div className={`mt-0.5 shrink-0 ${showOriginalPrice ? 'text-primary' : 'text-muted'}`}>{showOriginalPrice ? <CheckSquare size={18}/> : <Square size={18}/>}</div><span className="text-[11px] font-black text-text uppercase">Mostrar precio tachado</span></button>
                        <button onClick={() => setPrintOnlyOffers(!printOnlyOffers)} className="w-full flex items-start gap-3 text-left pt-3 border-t border-surfaceHighlight/50"><div className={`mt-0.5 shrink-0 ${printOnlyOffers ? 'text-primary' : 'text-muted'}`}>{printOnlyOffers ? <CheckSquare size={18}/> : <Square size={18}/>}</div><span className="text-[11px] font-black text-text uppercase">Solo ofertas en PDF</span></button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    <button onClick={() => generatePDF(false)} disabled={labelQueue.length === 0} className="py-4 bg-surface border border-surfaceHighlight text-text hover:bg-surfaceHighlight rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-30 shadow-sm"><FileText size={16} /> Vista Previa</button>
                    <button onClick={() => generatePDF(true)} disabled={labelQueue.length === 0} className="py-4 bg-[#e47c00] hover:bg-[#cc6f00] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-30"><Printer size={16} /> Imprimir Lote</button>
                </div>
            </div>
        </div>
    );
};

const InputNumber: React.FC<{ label: string, value: number, onChange: (v: number) => void, step?: number }> = ({ label, value, onChange, step = 1 }) => (
    <div className="space-y-1">
        <label className="text-[9px] font-bold text-muted uppercase tracking-tight ml-1">{label}</label>
        <input type="number" value={value} step={step} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-2 px-3 text-sm font-black text-text outline-none focus:border-primary shadow-inner" />
    </div>
);