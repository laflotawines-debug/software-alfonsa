
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Users, 
    Settings, 
    DollarSign, 
    Calendar, 
    Clock, 
    Save, 
    FileText, 
    Zap, 
    Trash2, 
    LogIn,
    LogOut,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Info,
    Download,
    XCircle,
    AlertTriangle,
    Minus
} from 'lucide-react';
import { supabase } from '../supabase';
import { User, WorkerAttendanceConfig, GlobalAttendanceSettings } from '../types';

const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const DAY_MAP: Record<string, string> = {
    'Lu': 'Lunes',
    'Ma': 'Martes',
    'Mi': 'Miércoles',
    'Ju': 'Jueves',
    'Vi': 'Viernes',
    'Sa': 'Sábado',
    'Do': 'Domingo'
};

interface ParsedDay {
    date: string;
    dayName: string;
    entry: string;
    exit: string;
    observation: string;
    isFeriado: boolean;
    isJustified: boolean;
}

export const Attendance: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'workers' | 'settings'>('workers');
    const [armadores, setArmadores] = useState<User[]>([]);
    const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    const [workerConfigs, setWorkerConfigs] = useState<Record<string, WorkerAttendanceConfig>>({});
    const [globalSettings, setGlobalSettings] = useState<GlobalAttendanceSettings>({
        location: 'LLERENA',
        bonus_1: 30000,
        bonus_2: 20000
    });
    
    const [rawReport, setRawReport] = useState('');
    const [parsedReport, setParsedReport] = useState<ParsedDay[]>([]);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoading(true);
            try {
                const [profRes, configRes, settingsRes] = await Promise.all([
                    supabase.from('profiles').select('*').eq('role', 'armador').order('name'),
                    supabase.from('attendance_worker_configs').select('*'),
                    supabase.from('attendance_settings').select('*').eq('location', 'LLERENA').maybeSingle()
                ]);

                if (profRes.data) {
                    setArmadores(profRes.data as User[]);
                    if (profRes.data.length > 0) setSelectedWorkerId(profRes.data[0].id);
                }

                if (configRes.data) {
                    const configMap: Record<string, WorkerAttendanceConfig> = {};
                    configRes.data.forEach((c: any) => { configMap[c.user_id] = c; });
                    setWorkerConfigs(configMap);
                }

                if (settingsRes.data) setGlobalSettings(settingsRes.data);
            } catch (e) { console.error(e); } finally { setIsLoading(false); }
        };
        loadInitialData();
    }, []);

    const handleWorkerChange = (updates: Partial<WorkerAttendanceConfig>) => {
        if (!selectedWorkerId) return;
        const current = workerConfigs[selectedWorkerId] || {
            user_id: selectedWorkerId,
            hourly_rate: 0,
            work_days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
            entry_time: '08:00',
            exit_time: '16:00',
            location: 'LLERENA'
        };
        setWorkerConfigs({ ...workerConfigs, [selectedWorkerId]: { ...current, ...updates } });
    };

    const toggleDay = (day: string) => {
        if (!selectedWorkerId) return;
        const current = workerConfigs[selectedWorkerId]?.work_days || [];
        const nextDays = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
        handleWorkerChange({ work_days: nextDays });
    };

    const saveWorkerConfig = async () => {
        if (!selectedWorkerId) return;
        setSaveStatus('saving');
        const config = workerConfigs[selectedWorkerId];
        if (!config) return;
        try {
            const { error } = await supabase.from('attendance_worker_configs').upsert({
                user_id: selectedWorkerId,
                hourly_rate: config.hourly_rate,
                work_days: config.work_days,
                entry_time: config.entry_time,
                exit_time: config.exit_time,
                location: 'LLERENA'
            });
            if (error) throw error;
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (e) { setSaveStatus('error'); }
    };

    const saveGlobalSettings = async () => {
        setSaveStatus('saving');
        try {
            const { error } = await supabase.from('attendance_settings').upsert(globalSettings);
            if (error) throw error;
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (e) { setSaveStatus('error'); }
    };

    // --- MOTOR DE PARSEO ---
    const processReport = () => {
        if (!rawReport.trim()) return;
        const lines = rawReport.split('\n');
        const results: ParsedDay[] = [];
        const lineRegex = /^(\d{2})\s+([A-Z][a-z])\s+([\d:]*)\s*([\d:]*)\s*(Falta)?/;

        lines.forEach(line => {
            const trimmedLine = line.trim();
            const match = trimmedLine.match(lineRegex);
            if (match) {
                const date = match[1];
                const dayShort = match[2];
                let entry = match[3] || "";
                let exit = match[4] || "";
                const isFalta = match[5] === "Falta" || trimmedLine.includes("Falta");
                const dayFull = DAY_MAP[dayShort] || dayShort;

                results.push({
                    date,
                    dayName: dayFull,
                    entry,
                    exit,
                    observation: isFalta ? "falta" : "",
                    isFeriado: false,
                    isJustified: false
                });
            }
        });
        setParsedReport(results);
    };

    // --- CÁLCULOS FINALES ---
    const finalReportData = useMemo(() => {
        if (!selectedWorkerId || !workerConfigs[selectedWorkerId] || parsedReport.length === 0) return null;
        const currentConfig = workerConfigs[selectedWorkerId];

        let totalAccumulatedHours = 0;
        let unjustifiedAbsencesCount = 0;
        let latesCount = 0;
        let alwaysEarly = true;
        let totalWorkDays = 0;

        const scheduledEntryMinutes = timeToMinutes(currentConfig.entry_time);
        const scheduledExitMinutes = timeToMinutes(currentConfig.exit_time);
        const theoreticalDailyHours = (scheduledExitMinutes - scheduledEntryMinutes) / 60;

        const detailedDays = parsedReport.map(day => {
            let hours = 0;
            let status = day.observation || "trabajado";
            const isSunday = day.dayName === 'Domingo';
            const isWorkDay = currentConfig.work_days.includes(day.dayName);

            if (isWorkDay) totalWorkDays++;

            const entryMins = day.entry ? timeToMinutes(day.entry) : null;
            const exitMins = day.exit ? timeToMinutes(day.exit) : null;

            // Lógica de Horas y Estados
            if (day.isFeriado) {
                if (day.entry && day.exit) {
                    hours = ((exitMins! - entryMins!) / 60) * 2;
                    status = "feriado trabajado";
                } else {
                    hours = theoreticalDailyHours;
                    status = "feriado no trabajado";
                }
            } else if (day.entry && day.exit) {
                hours = (exitMins! - entryMins!) / 60;
                status = "trabajado";
            } else if (day.entry && !day.exit) {
                status = "incompleto";
            } else if (!day.entry && !day.exit) {
                if (isSunday) status = "no laboral";
                else if (day.observation === 'falta') status = "falta";
                else status = isWorkDay ? "falta" : "no laboral";
            }

            // Lógica de Bono (Puntualidad y Faltas)
            if (isWorkDay && !day.isFeriado) {
                if (status === 'falta' && !day.isJustified) {
                    unjustifiedAbsencesCount++;
                }
                if (entryMins !== null) {
                    if (entryMins > scheduledEntryMinutes + 10) {
                        latesCount++;
                    }
                    if (entryMins >= scheduledEntryMinutes) {
                        alwaysEarly = false;
                    }
                }
            }

            totalAccumulatedHours += hours;

            return { ...day, hours, status };
        });

        // Redondeo final de horas (>30m arriba, else abajo)
        const integerHours = Math.floor(totalAccumulatedHours);
        const decimalPart = totalAccumulatedHours - integerHours;
        const finalRoundedHours = decimalPart > 0.5 ? integerHours + 1 : integerHours;

        // Determinar Bono
        let bonusAmount = 0;
        let bonusStatus = "SIN BONO";
        let bonusReason = "";

        if (unjustifiedAbsencesCount > 0) {
            bonusReason = `Tuvo ${unjustifiedAbsencesCount} ausencia(s) sin justificar`;
        } else if (latesCount > 0) {
            bonusReason = `Llegó tarde ${latesCount} vez/veces (10+ min)`;
        } else {
            if (alwaysEarly) {
                bonusAmount = globalSettings.bonus_1;
                bonusStatus = "BONO 1 (EXCELENCIA)";
            } else {
                bonusAmount = globalSettings.bonus_2;
                bonusStatus = "BONO 2 (CUMPLIMIENTO)";
            }
        }

        const subtotal = finalRoundedHours * currentConfig.hourly_rate;
        const totalToPay = subtotal + bonusAmount;

        return {
            detailedDays,
            totalAccumulatedHours,
            finalRoundedHours,
            unjustifiedAbsencesCount,
            totalWorkDays,
            bonusAmount,
            bonusStatus,
            bonusReason,
            totalToPay,
            subtotal
        };
    }, [parsedReport, selectedWorkerId, workerConfigs, globalSettings]);

    const selectedWorker = useMemo(() => armadores.find(w => w.id === selectedWorkerId), [armadores, selectedWorkerId]);
    const currentConfig = useMemo(() => {
        if (!selectedWorkerId) return null;
        return workerConfigs[selectedWorkerId] || {
            user_id: selectedWorkerId,
            hourly_rate: 0,
            work_days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
            entry_time: '08:00',
            exit_time: '16:00',
            location: 'LLERENA'
        };
    }, [workerConfigs, selectedWorkerId]);

    const toggleCheck = (idx: number, field: 'isFeriado' | 'isJustified') => {
        const next = [...parsedReport];
        next[idx][field] = !next[idx][field];
        setParsedReport(next);
    };

    function timeToMinutes(time: string) {
        if (!time) return 0;
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    }

    if (isLoading) return <div className="h-full w-full flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={48} /></div>;

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-20 max-w-7xl mx-auto">
            <div className="flex flex-col text-center">
                <h1 className="text-4xl font-black text-text italic tracking-tighter uppercase leading-none">Gestión de Asistencia</h1>
                <p className="text-muted text-[10px] uppercase font-bold tracking-[0.3em] mt-2 opacity-60">Alfonsa Distribuidora - Control Salarial</p>
            </div>

            <div className="bg-surface border border-surfaceHighlight p-1.5 rounded-[2rem] flex gap-1 w-full sm:w-fit mx-auto shadow-sm">
                <button onClick={() => setActiveTab('workers')} className={`flex items-center gap-2 px-10 py-4 rounded-[1.5rem] text-xs font-black uppercase transition-all ${activeTab === 'workers' ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-muted hover:bg-surfaceHighlight'}`}><Users size={18} /> Trabajadores</button>
                <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-2 px-10 py-4 rounded-[1.5rem] text-xs font-black uppercase transition-all ${activeTab === 'settings' ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-muted hover:bg-surfaceHighlight'}`}><Settings size={18} /> Ajustes</button>
            </div>

            {activeTab === 'workers' ? (
                <div className="bg-surface border border-surfaceHighlight rounded-[2.5rem] shadow-lg overflow-hidden flex flex-col md:flex-row min-h-[500px]">
                    <div className="w-full md:w-80 border-r border-surfaceHighlight flex flex-col bg-background/20 shrink-0">
                        <div className="p-6 border-b border-surfaceHighlight flex justify-between items-center"><h3 className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Seleccionar Trabajador</h3></div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
                            {armadores.map(w => (
                                <button key={w.id} onClick={() => { setSelectedWorkerId(w.id); setSaveStatus('idle'); }} className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${selectedWorkerId === w.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'hover:bg-surfaceHighlight text-text'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`h-8 w-8 rounded-full flex items-center justify-center font-black text-[10px] border ${selectedWorkerId === w.id ? 'bg-white/20' : 'bg-primary/10 text-primary'}`}>{w.name.substring(0, 2)}</div>
                                        <span className="text-sm font-bold uppercase truncate max-w-[140px]">{w.name}</span>
                                    </div>
                                    <div className={`h-1.5 w-1.5 rounded-full ${selectedWorkerId === w.id ? 'bg-white' : 'bg-muted opacity-20'}`}></div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 p-8 md:p-12 animate-in fade-in">
                        {selectedWorker && currentConfig && (
                            <div className="max-w-2xl space-y-10">
                                <div className="space-y-2">
                                    <h2 className="text-3xl font-black text-text uppercase italic tracking-tighter">Gestión de Trabajadores</h2>
                                    <p className="text-muted text-xs font-bold opacity-60 uppercase">Configura la tarifa, días laborales y horarios específicos para <span className="text-primary">{selectedWorker.name}</span>.</p>
                                </div>

                                <div className="space-y-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Tarifa por Hora ($)</label>
                                        <div className="relative group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-background border border-surfaceHighlight rounded-xl text-muted">
                                                <DollarSign size={20} />
                                            </div>
                                            <input 
                                                type="number" 
                                                value={currentConfig.hourly_rate} 
                                                onChange={e => handleWorkerChange({ hourly_rate: parseFloat(e.target.value) || 0 })}
                                                className="w-full bg-background border border-surfaceHighlight rounded-2xl py-5 pl-16 pr-6 text-xl font-black text-text outline-none focus:border-primary shadow-inner" 
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Días Laborales</label>
                                        <div className="flex flex-wrap gap-2">
                                            {DAYS_OF_WEEK.map(day => (
                                                <button 
                                                    key={day} 
                                                    onClick={() => toggleDay(day)}
                                                    className={`px-6 py-3 rounded-full text-[11px] font-black uppercase transition-all border ${currentConfig.work_days.includes(day) ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'bg-background border-surfaceHighlight text-muted hover:border-primary/40'}`}
                                                >
                                                    {day}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Hora de Entrada Programada</label>
                                            <div className="relative">
                                                <LogIn className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                                                <input 
                                                    type="time" 
                                                    value={currentConfig.entry_time} 
                                                    onChange={e => handleWorkerChange({ entry_time: e.target.value })} 
                                                    className="w-full bg-background border border-surfaceHighlight rounded-2xl py-5 pl-12 pr-6 text-sm font-black text-text outline-none focus:border-primary shadow-inner uppercase" 
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Hora de Salida Programada</label>
                                            <div className="relative">
                                                <LogOut className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                                                <input 
                                                    type="time" 
                                                    value={currentConfig.exit_time} 
                                                    onChange={e => handleWorkerChange({ exit_time: e.target.value })} 
                                                    className="w-full bg-background border border-surfaceHighlight rounded-2xl py-5 pl-12 pr-6 text-sm font-black text-text outline-none focus:border-primary shadow-inner uppercase" 
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-surfaceHighlight">
                                        <button 
                                            onClick={saveWorkerConfig}
                                            disabled={saveStatus === 'saving'}
                                            className={`flex items-center gap-3 px-12 py-5 rounded-2xl font-black uppercase text-sm shadow-xl transition-all active:scale-95 disabled:opacity-50 ${saveStatus === 'success' ? 'bg-green-600 text-white' : 'bg-primary hover:bg-primaryHover text-white shadow-primary/20'}`}
                                        >
                                            {saveStatus === 'saving' ? <Loader2 size={20} className="animate-spin" /> : saveStatus === 'success' ? <CheckCircle2 size={20}/> : <Save size={20} />}
                                            {saveStatus === 'success' ? 'Cambios Guardados' : 'Guardar Cambios'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-surface border border-surfaceHighlight rounded-[2.5rem] p-12 space-y-8 max-w-4xl mx-auto w-full">
                    <h2 className="text-3xl font-black text-text uppercase italic tracking-tighter">Configuración de Bonos</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-muted uppercase">Bono 1 (Puntualidad Perfecta)</label>
                            <input type="number" value={globalSettings.bonus_1} onChange={e => setGlobalSettings({...globalSettings, bonus_1: parseFloat(e.target.value) || 0})} className="w-full bg-background border border-surfaceHighlight rounded-3xl py-6 px-8 text-3xl font-black text-primary" />
                        </div>
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-muted uppercase">Bono 2 (Asistencia Completa)</label>
                            <input type="number" value={globalSettings.bonus_2} onChange={e => setGlobalSettings({...globalSettings, bonus_2: parseFloat(e.target.value) || 0})} className="w-full bg-background border border-surfaceHighlight rounded-3xl py-6 px-8 text-3xl font-black text-text" />
                        </div>
                    </div>
                    <div className="pt-6 border-t border-surfaceHighlight">
                        <button 
                            onClick={saveGlobalSettings}
                            disabled={saveStatus === 'saving'}
                            className={`flex items-center gap-3 px-12 py-5 rounded-2xl font-black uppercase text-sm shadow-xl transition-all active:scale-95 disabled:opacity-50 ${saveStatus === 'success' ? 'bg-green-600 text-white' : 'bg-primary hover:bg-primaryHover text-white shadow-primary/20'}`}
                        >
                            {saveStatus === 'saving' ? <Loader2 size={20} className="animate-spin" /> : saveStatus === 'success' ? <CheckCircle2 size={20}/> : <Save size={20} />}
                            {saveStatus === 'success' ? 'Configuración Guardada' : 'Guardar Configuración'}
                        </button>
                    </div>
                </div>
            )}

            {/* SECCIÓN REPORTE INFERIOR */}
            <div className="bg-surface border border-surfaceHighlight rounded-[2.5rem] p-8 md:p-12 shadow-sm space-y-8 animate-in slide-in-from-bottom-4">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-primary/10 text-primary rounded-2xl"><FileText size={28} /></div>
                    <div>
                        <h3 className="text-2xl font-black text-text uppercase italic tracking-tight">Reporte de Asistencia</h3>
                        <p className="text-muted text-xs font-bold uppercase mt-1 opacity-60">Pega los datos del reloj para procesar las 2 semanas.</p>
                    </div>
                </div>
                <textarea value={rawReport} onChange={e => setRawReport(e.target.value)} placeholder="Tabla Asistencia..." className="w-full min-h-[250px] bg-background border border-surfaceHighlight rounded-[2rem] p-8 text-sm font-mono text-text outline-none focus:border-primary shadow-inner resize-none transition-all placeholder:opacity-30 uppercase" />
                <div className="flex gap-4"><button onClick={processReport} className="flex items-center gap-3 bg-primary text-white hover:bg-primaryHover px-10 py-5 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95"><Zap size={18} /> Procesar Reporte Actual</button></div>
            </div>

            {finalReportData && (
                <div className="space-y-8 animate-in zoom-in-95">
                    <div className="bg-surface border border-surfaceHighlight rounded-[2.5rem] p-8 md:p-12 shadow-sm space-y-10">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div>
                                <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Informe Detallado</span>
                                <h2 className="text-4xl font-black text-text uppercase italic tracking-tighter mt-1">Liquidación de Periodo</h2>
                            </div>
                            <div className="flex gap-3">
                                <button className="flex items-center gap-2 px-6 py-3 rounded-xl border border-surfaceHighlight text-text text-xs font-black uppercase hover:bg-surfaceHighlight transition-all"><FileText size={16}/> Exportar PDF</button>
                                <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600 text-white text-xs font-black uppercase shadow-lg hover:bg-green-700 transition-all"><Download size={16}/> Excel</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                            <div className="bg-background/50 border border-surfaceHighlight p-6 rounded-3xl flex flex-col gap-1"><span className="text-[10px] font-black text-muted uppercase">Empleado</span><span className="text-xl font-black text-text uppercase italic">{selectedWorker?.name}</span></div>
                            <div className="bg-background/50 border border-surfaceHighlight p-6 rounded-3xl flex flex-col gap-1"><span className="text-[10px] font-black text-muted uppercase">Horas Totales</span><span className="text-xl font-black text-text italic">{finalReportData.finalRoundedHours} h</span></div>
                            <div className="bg-background/50 border border-surfaceHighlight p-6 rounded-3xl flex flex-col gap-1"><span className="text-[10px] font-black text-muted uppercase">Tarifa x Hora</span><span className="text-xl font-black text-text italic">$ {currentConfig?.hourly_rate.toLocaleString()}</span></div>
                            <div className="bg-background/50 border border-surfaceHighlight p-6 rounded-3xl flex flex-col gap-1"><span className="text-[10px] font-black text-muted uppercase">Bono</span><span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase self-start mt-1 ${finalReportData.bonusAmount > 0 ? 'bg-green-500 text-white' : 'bg-surfaceHighlight text-muted'}`}>{finalReportData.bonusAmount > 0 ? `$ ${finalReportData.bonusAmount.toLocaleString()}` : 'Sin Bono'}</span></div>
                            <div className="md:col-span-2 bg-blue-600 border border-blue-500 p-6 rounded-3xl flex flex-col gap-1 text-white shadow-xl shadow-blue-500/20"><span className="text-[10px] font-black uppercase opacity-70">Total a Liquidar</span><span className="text-3xl font-black italic">$ {finalReportData.totalToPay.toLocaleString()}</span></div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                            <div className="lg:col-span-4 space-y-6">
                                <div className="bg-orange-50/50 dark:bg-orange-950/10 border border-orange-200 dark:border-orange-900/30 rounded-[2rem] p-8 space-y-6">
                                    <div className="flex items-center gap-3"><div className="p-3 bg-orange-500 text-white rounded-xl"><Calendar size={20}/></div><h3 className="text-xl font-black text-orange-700 dark:text-orange-400 uppercase italic">Ausencias</h3></div>
                                    <div className="space-y-3">
                                        {finalReportData.detailedDays.filter(d => d.status === 'falta').map(f => (
                                            <div key={f.date} className="flex items-center justify-between p-4 bg-white dark:bg-background/40 border border-orange-200 rounded-2xl shadow-sm">
                                                <span className="text-sm font-black text-orange-600">{f.date} ({f.dayName.substring(0, 2)})</span>
                                                <span className={`text-[9px] font-bold uppercase italic ${f.isJustified ? 'text-green-600' : 'text-red-500'}`}>{f.isJustified ? 'Justificada' : 'Sin Justificar'}</span>
                                            </div>
                                        ))}
                                        {finalReportData.unjustifiedAbsencesCount === 0 && <p className="text-xs font-bold text-muted uppercase italic text-center py-4">Perfecta asistencia</p>}
                                    </div>
                                    <div className="pt-4 border-t border-orange-200 flex justify-between items-center"><span className="text-sm font-black text-text">Total Faltas: {finalReportData.detailedDays.filter(d => d.status === 'falta').length}</span><span className="text-[10px] font-black bg-orange-500/10 text-orange-600 px-3 py-1 rounded-full uppercase">De {finalReportData.totalWorkDays} laborales</span></div>
                                </div>

                                <div className="bg-background/50 border border-surfaceHighlight rounded-[2rem] p-8 space-y-6">
                                    <div className="flex items-center gap-3"><div className="p-3 bg-primary/10 text-primary rounded-xl"><Zap size={20}/></div><div className="flex flex-col"><h3 className="text-lg font-black text-text uppercase italic leading-none">Estado Bono</h3><span className="text-[9px] font-black text-muted uppercase tracking-widest mt-1">{finalReportData.bonusStatus}</span></div></div>
                                    {finalReportData.bonusAmount > 0 ? (
                                        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-3 text-green-600"><CheckCircle2 size={18} /><p className="text-[10px] font-black uppercase">¡Califica para el bono del periodo!</p></div>
                                    ) : (
                                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-red-600"><AlertTriangle size={18} className="shrink-0" /><p className="text-[10px] font-black uppercase leading-relaxed">{finalReportData.bonusReason}</p></div>
                                    )}
                                </div>
                            </div>

                            <div className="lg:col-span-8 bg-background/50 border border-surfaceHighlight rounded-[2rem] overflow-hidden">
                                <div className="p-8 border-b border-surfaceHighlight bg-surfaceHighlight/10 flex justify-between items-center"><h3 className="text-xl font-black text-text uppercase italic">Desglose por Día</h3><div className="flex gap-4 text-[9px] font-black text-muted uppercase tracking-widest"><span>F: Feriado</span><span>J: Justificado</span></div></div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="text-[10px] font-black text-muted uppercase tracking-widest border-b border-surfaceHighlight">
                                                <th className="p-5 pl-8">Fecha</th>
                                                <th className="p-4">Día</th>
                                                <th className="p-4">Entrada</th>
                                                <th className="p-4">Salida</th>
                                                <th className="p-4 text-center">Horas</th>
                                                <th className="p-4">Estado</th>
                                                <th className="p-4 text-center">F</th>
                                                <th className="p-4 text-center">J</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-surfaceHighlight">
                                            {finalReportData.detailedDays.map((day, idx) => (
                                                <tr key={idx} className="hover:bg-primary/5 transition-colors group">
                                                    <td className="p-5 pl-8 text-sm font-black text-text">{day.date}</td>
                                                    <td className="p-4 text-xs font-bold text-muted uppercase">{day.dayName.substring(0, 2)}</td>
                                                    <td className="p-4 text-sm font-bold text-text">{day.entry || '--:--'}</td>
                                                    <td className="p-4 text-sm font-bold text-text">{day.exit || '--:--'}</td>
                                                    <td className="p-4 text-center font-black text-sm">{day.hours > 0 ? day.hours.toFixed(2) : '-'}</td>
                                                    <td className="p-4">
                                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border
                                                            ${day.status.includes('trabajado') ? 'bg-green-500/10 text-green-600 border-green-200' :
                                                              day.status === 'falta' ? 'bg-red-500/10 text-red-600 border-red-200' :
                                                              day.status === 'no laboral' ? 'bg-muted/10 text-muted border-muted/20' :
                                                              'bg-orange-500/10 text-orange-600 border-orange-200'}
                                                        `}>
                                                            {day.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <button onClick={() => toggleCheck(idx, 'isFeriado')} className={`p-1.5 rounded-lg border transition-all ${day.isFeriado ? 'bg-primary text-white border-primary' : 'bg-surface border-surfaceHighlight text-muted hover:border-primary/50'}`}>
                                                            {day.isFeriado ? <CheckCircle2 size={16}/> : <Minus size={16} className="opacity-20"/>}
                                                        </button>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <button onClick={() => toggleCheck(idx, 'isJustified')} className={`p-1.5 rounded-lg border transition-all ${day.isJustified ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-surface border-surfaceHighlight text-muted hover:border-indigo-500/50'}`}>
                                                            {day.isJustified ? <CheckCircle2 size={16}/> : <Minus size={16} className="opacity-20"/>}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
