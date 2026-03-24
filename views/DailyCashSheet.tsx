import React, { useState, useEffect } from 'react';
import { 
    Plus, 
    TrendingUp, 
    TrendingDown, 
    DollarSign, 
    Wallet,
    Printer,
    FileSpreadsheet,
    Lock,
    CheckCircle2,
    Building2,
    CalendarDays,
    Loader2
} from 'lucide-react';
import { User, View } from '../types';
import { supabase } from '../supabase';

export const DailyCashSheet: React.FC<{ currentUser: User, onNavigate: (view: View) => void }> = ({ currentUser, onNavigate }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [branch, setBranch] = useState('Llerena');

    const [movements, setMovements] = useState<any[]>([]);
    const [checks, setChecks] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch movements
            const { data: movementsData, error: movementsError } = await supabase
                .from('cash_movements')
                .select(`
                    *,
                    cash_concepts (name, type)
                `)
                .eq('date', date)
                .eq('branch', branch);

            if (movementsError) throw movementsError;
            setMovements(movementsData || []);

            // Fetch checks for these movements
            if (movementsData && movementsData.length > 0) {
                const movementIds = movementsData.map(m => m.id);
                const { data: checksData, error: checksError } = await supabase
                    .from('checks')
                    .select('*')
                    .in('movement_id', movementIds);
                
                if (checksError) throw checksError;
                setChecks(checksData || []);
            } else {
                setChecks([]);
            }
        } catch (e) {
            console.error('Error fetching daily sheet data:', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [date, branch]);

    const totalIngresosARS = movements
        .filter(m => m.type === 'ingreso')
        .reduce((acc, curr) => acc + Number(curr.amount_ars), 0);
    
    const totalEgresosARS = movements
        .filter(m => m.type === 'egreso')
        .reduce((acc, curr) => acc + Number(curr.amount_ars), 0);

    const totalIngresosUSD = movements
        .filter(m => m.type === 'ingreso')
        .reduce((acc, curr) => acc + Number(curr.amount_usd), 0);

    const totalCheques = checks.reduce((acc, curr) => acc + Number(curr.amount), 0);
    
    const saldoFinal = totalIngresosARS - totalEgresosARS;

    return (
        <div className="flex flex-col gap-6 pb-20 animate-in fade-in duration-300 max-w-7xl mx-auto">
            {/* Header */}
            <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black text-text tracking-tight flex items-center gap-3">
                        Planilla de Caja Diaria
                    </h2>
                    <p className="text-muted text-sm mt-1 font-medium">Control de ingresos, egresos y saldos de sucursal</p>
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                    <div className="space-y-1 flex-1 min-w-[150px]">
                        <label className="text-[10px] font-black text-muted uppercase ml-1">Fecha de Operación</label>
                        <div className="relative">
                            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                            <input 
                                type="date" 
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-2.5 pl-10 pr-4 text-sm font-bold outline-none focus:border-primary transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-1 flex-1 min-w-[200px]">
                        <label className="text-[10px] font-black text-muted uppercase ml-1">Sucursal</label>
                        <div className="relative">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                            <select 
                                value={branch}
                                onChange={e => setBranch(e.target.value)}
                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-2.5 pl-10 pr-4 text-sm font-bold outline-none focus:border-primary transition-all appearance-none"
                            >
                                <option value="Llerena">Llerena (Principal)</option>
                                <option value="Betbeder">Betbeder</option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-5">
                        <button 
                            onClick={() => onNavigate(View.CASH_MOVEMENTS)}
                            className="bg-[#e47c00] hover:bg-[#cc6f00] text-white px-6 py-2.5 rounded-xl text-sm font-black transition-all shadow-lg shadow-orange-500/20 flex items-center gap-2"
                        >
                            <Plus size={18} /> Nuevo Movimiento
                        </button>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-surface border border-surfaceHighlight rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-muted uppercase">Total Ingresos ($)</span>
                        <div className="p-1.5 bg-green-500/10 text-green-500 rounded-lg">
                            <TrendingUp size={16} />
                        </div>
                    </div>
                    <span className="text-2xl font-black text-text">$ {totalIngresosARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="bg-surface border border-surfaceHighlight rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-muted uppercase">Total Egresos ($)</span>
                        <div className="p-1.5 bg-red-500/10 text-red-500 rounded-lg">
                            <TrendingDown size={16} />
                        </div>
                    </div>
                    <span className="text-2xl font-black text-text">$ {totalEgresosARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="bg-surface border border-surfaceHighlight rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-muted uppercase">Ingresos (u$s)</span>
                        <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg">
                            <DollarSign size={16} />
                        </div>
                    </div>
                    <span className="text-2xl font-black text-text">u$s {totalIngresosUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="bg-[#e47c00] rounded-2xl p-5 shadow-lg shadow-orange-500/20 flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold uppercase text-white/80">Saldo Final en Caja</span>
                        <div className="p-1.5 bg-white/20 rounded-lg">
                            <Wallet size={16} />
                        </div>
                    </div>
                    <span className="text-3xl font-black">$ {saldoFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
            </div>

            {/* Listado de Movimientos */}
            <div className="bg-surface border border-surfaceHighlight rounded-3xl shadow-sm overflow-hidden flex flex-col">
                <div className="p-5 border-b border-surfaceHighlight flex justify-between items-center bg-background/50">
                    <h3 className="text-sm font-black text-text uppercase tracking-widest">Listado de Movimientos</h3>
                    <button className="px-4 py-1.5 bg-surfaceHighlight text-muted hover:text-text rounded-lg text-[10px] font-black uppercase transition-colors">
                        Filtrar
                    </button>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-background/50 border-b border-surfaceHighlight text-[10px] text-muted uppercase font-black tracking-widest">
                                <th className="p-4 whitespace-nowrap">No. Mov</th>
                                <th className="p-4 whitespace-nowrap">Concepto</th>
                                <th className="p-4 whitespace-nowrap">Comentarios</th>
                                <th className="p-4 text-right whitespace-nowrap">Ingresos ($)</th>
                                <th className="p-4 text-right whitespace-nowrap">Ingresos (u$s)</th>
                                <th className="p-4 text-right whitespace-nowrap">Egresos ($)</th>
                                <th className="p-4 text-right whitespace-nowrap">Egresos (u$s)</th>
                                <th className="p-4 text-center whitespace-nowrap">Forma / Cheque</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surfaceHighlight">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center">
                                        <Loader2 className="animate-spin mx-auto text-primary" size={32} />
                                    </td>
                                </tr>
                            ) : movements.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-muted text-sm font-bold italic">
                                        No hay movimientos registrados
                                    </td>
                                </tr>
                            ) : (
                                movements.map((m, i) => (
                                    <tr key={m.id} className="hover:bg-surfaceHighlight/10">
                                        <td className="p-4 text-xs font-mono text-muted">#{m.id.slice(0, 6)}</td>
                                        <td className="p-4 text-xs font-bold text-text uppercase">{m.cash_concepts?.name || 'S/C'}</td>
                                        <td className="p-4 text-xs text-muted max-w-xs truncate">{m.comments || '-'}</td>
                                        <td className="p-4 text-right text-xs font-black text-green-600">
                                            {m.type === 'ingreso' && m.amount_ars > 0 ? `$ ${m.amount_ars.toLocaleString('es-AR')}` : '-'}
                                        </td>
                                        <td className="p-4 text-right text-xs font-black text-blue-600">
                                            {m.type === 'ingreso' && m.amount_usd > 0 ? `u$s ${m.amount_usd.toLocaleString('es-AR')}` : '-'}
                                        </td>
                                        <td className="p-4 text-right text-xs font-black text-red-500">
                                            {m.type === 'egreso' && m.amount_ars > 0 ? `$ ${m.amount_ars.toLocaleString('es-AR')}` : '-'}
                                        </td>
                                        <td className="p-4 text-right text-xs font-black text-red-500">
                                            {m.type === 'egreso' && m.amount_usd > 0 ? `u$s ${m.amount_usd.toLocaleString('es-AR')}` : '-'}
                                        </td>
                                        <td className="p-4 text-center">
                                            {checks.some(c => c.movement_id === m.id) ? (
                                                <span className="bg-indigo-500/10 text-indigo-600 px-2 py-0.5 rounded text-[9px] font-black uppercase">Con Cheque</span>
                                            ) : (
                                                <span className="text-muted text-[9px] font-bold uppercase">Efectivo</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot className="bg-background/50 border-t-2 border-surfaceHighlight">
                            <tr>
                                <td colSpan={3} className="p-4 text-right text-xs font-black text-text uppercase">Subtotales</td>
                                <td className="p-4 text-right text-sm font-black text-text">$ {totalIngresosARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                <td className="p-4 text-right text-sm font-black text-text">u$s {totalIngresosUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                <td className="p-4 text-right text-sm font-black text-red-500">$ {totalEgresosARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                <td className="p-4 text-right text-sm font-black text-red-500">u$s 0,00</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Bottom Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cheques de Terceros */}
                <div className="lg:col-span-2 bg-surface border border-surfaceHighlight rounded-3xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-surfaceHighlight flex justify-between items-center bg-background/50">
                        <h3 className="text-sm font-black text-text uppercase tracking-widest flex items-center gap-2">
                            <Building2 size={16} className="text-[#e47c00]" /> Cheques de Terceros Recibidos
                        </h3>
                        <span className="bg-orange-500/10 text-orange-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase">
                            Total: $ {totalCheques.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                    
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-background/50 border-b border-surfaceHighlight text-[10px] text-muted uppercase font-black tracking-widest">
                                    <th className="p-4">Banco</th>
                                    <th className="p-4">Nro. Cheque</th>
                                    <th className="p-4">Vencimiento</th>
                                    <th className="p-4 text-right">Importe ($)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surfaceHighlight">
                                {checks.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-muted text-xs font-bold italic">
                                            No hay cheques registrados
                                        </td>
                                    </tr>
                                ) : (
                                    checks.map((c) => (
                                        <tr key={c.id} className="hover:bg-surfaceHighlight/10">
                                            <td className="p-4 text-xs font-bold text-text uppercase">{c.bank}</td>
                                            <td className="p-4 text-xs font-mono text-muted">{c.number}</td>
                                            <td className="p-4 text-xs text-muted">{new Date(c.due_date).toLocaleDateString()}</td>
                                            <td className="p-4 text-right text-xs font-black text-text">$ {c.amount.toLocaleString('es-AR')}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Resumen Final */}
                <div className="bg-surface border border-surfaceHighlight rounded-3xl shadow-sm p-6 flex flex-col">
                    <h3 className="text-sm font-black text-text uppercase tracking-widest mb-6">Resumen Final del Día</h3>
                    
                    <div className="space-y-4 flex-1">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-muted uppercase">Ingresos Totales (ARS)</span>
                            <span className="text-sm font-black text-green-600">$ {totalIngresosARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-muted uppercase">Egresos Totales (ARS)</span>
                            <span className="text-sm font-black text-red-500">- $ {totalEgresosARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-muted uppercase">Ingresos Totales (USD)</span>
                            <span className="text-sm font-black text-blue-600">u$s {totalIngresosUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-surfaceHighlight">
                        <div className="bg-background border border-surfaceHighlight rounded-2xl p-4 text-center">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest block mb-1">Arqueo de Caja Estimado</span>
                            <span className="text-3xl font-black text-text">$ {saldoFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-surfaceHighlight">
                <div className="flex gap-3 w-full sm:w-auto">
                    <button className="flex-1 sm:flex-none px-4 py-2.5 bg-surface border border-surfaceHighlight hover:bg-surfaceHighlight rounded-xl text-xs font-black text-text uppercase transition-colors flex items-center justify-center gap-2">
                        <Printer size={16} /> Imprimir / PDF
                    </button>
                    <button className="flex-1 sm:flex-none px-4 py-2.5 bg-surface border border-surfaceHighlight hover:bg-surfaceHighlight rounded-xl text-xs font-black text-green-600 uppercase transition-colors flex items-center justify-center gap-2">
                        <FileSpreadsheet size={16} /> Exportar a Excel
                    </button>
                </div>

                <div className="flex gap-3 w-full sm:w-auto">
                    <button className="flex-1 sm:flex-none px-6 py-2.5 bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 rounded-xl text-xs font-black uppercase transition-colors flex items-center justify-center gap-2">
                        <Lock size={16} /> Cerrar Caja
                    </button>
                    <button className="flex-1 sm:flex-none px-8 py-2.5 bg-[#e47c00] hover:bg-[#cc6f00] text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-orange-500/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                        Finalizar Planilla <CheckCircle2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
