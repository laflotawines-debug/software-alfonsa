import React, { useState, useEffect, useMemo } from 'react';
import { 
    Users, 
    Settings, 
    Calendar, 
    Save, 
    FileText, 
    Zap, 
    Loader2, 
    CheckCircle2, 
    Building2, 
    MapPin, 
    Circle, 
    Banknote,
    X,
    AlertTriangle,
    Download,
    Info,
    History,
    User as UserIcon,
    Trophy,
    TrendingUp,
    Star,
    Award,
    Target,
    BarChart3,
    ArrowUpRight,
    ArrowDownLeft,
    Clock,
    MinusCircle,
    LayoutList,
    Activity,
    ChevronRight,
    PlusCircle,
    Coins,
    ChevronLeft
} from 'lucide-react';
import { supabase } from '../supabase';
import { User, WorkerAttendanceConfig, GlobalAttendanceSettings } from '../types';

const DAYS_OF_WEEK = [
    { key: 'Lunes', short: 'Lun' },
    { key: 'Martes', short: 'Mar' },
    { key: 'Miércoles', short: 'Mié' },
    { key: 'Jueves', short: 'Jue' },
    { key: 'Viernes', short: 'Vie' },
    { key: 'Sábado', short: 'Sáb' },
    { key: 'Domingo', short: 'Dom' }
];

const DAY_MAP: Record<string, string> = {
    'Lu': 'Lunes', 'Ma': 'Martes', 'Mi': 'Miércoles', 'Ju': 'Jueves', 'Vi': 'Viernes', 'Sa': 'Sábado', 'Do': 'Domingo',
    'Lunes': 'Lunes', 'Martes': 'Martes', 'Miercoles': 'Miércoles', 'Miércoles': 'Miércoles', 'Jueves': 'Jueves', 'Viernes': 'Viernes', 'Sabado': 'Sábado', 'Sábado': 'Sábado', 'Domingo': 'Domingo'
};

interface ParsedDay {
    date: string;
    dayName: string;
    entry: string;
    exit: string;
    observation: string;
    isFeriado: boolean;
    isJustified: boolean;
    hours: number;
    penaltyHours: number;
    status: string;
    isEarly: boolean;
    isLate: boolean;
    minutesLate: number;
}

interface PerformanceRecord {
    user_id: string;
    user_name?: string;
    avatar_url?: string;
    early_arrivals: number;
    late_arrivals: number;
    justified_count: number;
    total_issues: number;
    holidays_worked: number;
    absences: number;
    scheduled_days: number;
    marked_days: number;
    score?: number;
}

export const Attendance: React.FC<{ currentUser?: User }> = ({ currentUser }) => {
    const [activeTab, setActiveTab] = useState<'workers' | 'settings' | 'report' | 'performance'>('workers');
    const [armadores, setArmadores] = useState<User[]>([]);
    const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    const [workerConfigs, setWorkerConfigs] = useState<Record<string, WorkerAttendanceConfig>>({});
    const [globalSettings, setGlobalSettings] = useState<Record<string, GlobalAttendanceSettings>>({});
    const [performanceHistory, setPerformanceHistory] = useState<PerformanceRecord[]>([]);
    
    const [rawReport, setRawReport] = useState('');
    const [parsedReport, setParsedReport] = useState<ParsedDay[]>([]);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [perfSaveStatus, setPerfSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');
    
    // Estados financieros locales (transitorios para el cálculo)
    const [debtAmount, setDebtAmount] = useState<number>(0);
    const [extraHoursInput, setExtraHoursInput] = useState<number>(0);
    const [manualExtraAmount, setManualExtraAmount] = useState<number>(0);

    const [selectedPerfDetail, setSelectedPerfDetail] = useState<PerformanceRecord | null>(null);

    const isVale = currentUser?.role === 'vale';

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [profRes, configRes, settingsRes, perfRes] = await Promise.all([
                supabase.from('profiles').select('*').eq('role', 'armador').order('name'),
                supabase.from('attendance_worker_configs').select('*'),
                supabase.from('attendance_settings').select('*'),
                supabase.from('attendance_performance').select('*')
            ]);

            if (profRes.data) setArmadores(profRes.data as User[]);
            if (configRes.data) {
                const configMap: Record<string, WorkerAttendanceConfig> = {};
                configRes.data.forEach((c: any) => { configMap[c.user_id] = c; });
                setWorkerConfigs(configMap);
                // NOTA: En móvil no pre-seleccionamos para mostrar la lista primero
                if (profRes.data && profRes.data.length > 0 && !selectedWorkerId && window.innerWidth >= 768) {
                    setSelectedWorkerId(profRes.data[0].id);
                }
            }
            if (settingsRes.data) {
                const sMap: Record<string, GlobalAttendanceSettings> = {};
                settingsRes.data.forEach((s: any) => { sMap[s.location] = s; });
                setGlobalSettings(sMap);
            }
            if (perfRes.data && profRes.data) {
                const mappedPerf = perfRes.data.map((p: any) => {
                    const user = profRes.data.find(u => u.id === p.user_id);
                    return { ...p, user_name: user?.name, avatar_url: user?.avatar_url };
                });
                setPerformanceHistory(mappedPerf);
            }
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    useEffect(() => { loadData(); }, []);

    // Resetear valores temporales al cambiar de trabajador
    useEffect(() => {
        setDebtAmount(0);
        setExtraHoursInput(0);
        setManualExtraAmount(0);
    }, [selectedWorkerId]);

    const selectedWorker = useMemo(() => 
        armadores.find(w => w.id === selectedWorkerId), 
    [armadores, selectedWorkerId]);

    const currentConfig = useMemo(() => {
        if (!selectedWorkerId) return null;
        const existing = workerConfigs[selectedWorkerId];
        return existing || {
            user_id: selectedWorkerId,
            hourly_rate: 0,
            work_days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
            entry_time: '08:00',
            exit_time: '16:00',
            entry_time_pm: '17:00',
            exit_time_pm: '23:30',
            location: 'LLERENA'
        };
    }, [selectedWorkerId, workerConfigs]);

    const handleWorkerChange = (updates: Partial<WorkerAttendanceConfig>) => {
        if (!selectedWorkerId || !currentConfig) return;
        setWorkerConfigs(prev => ({
            ...prev,
            [selectedWorkerId]: { ...currentConfig, ...updates }
        }));
    };

    const toggleDay = (day: string) => {
        if (!currentConfig) return;
        const currentDays = currentConfig.work_days || [];
        const nextDays = currentDays.includes(day) 
            ? currentDays.filter(d => d !== day) 
            : [...currentDays, day];
        handleWorkerChange({ work_days: nextDays });
    };

    const saveWorkerConfig = async () => {
        if (!selectedWorkerId || !currentConfig) return;
        setSaveStatus('saving');
        try {
            const { error } = await supabase.from('attendance_worker_configs').upsert({
                user_id: selectedWorkerId,
                hourly_rate: currentConfig.hourly_rate,
                work_days: currentConfig.work_days,
                entry_time: currentConfig.entry_time,
                exit_time: currentConfig.exit_time,
                entry_time_pm: currentConfig.entry_time_pm || '17:00',
                exit_time_pm: currentConfig.exit_time_pm || '23:30',
                location: currentConfig.location
            });
            if (error) throw error;
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (e) { setSaveStatus('error'); }
    };

    const processReport = () => {
        if (!rawReport.trim() || !currentConfig) return;
        const lines = rawReport.split('\n');
        const results: ParsedDay[] = [];
        
        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.toLowerCase().includes('tabla') || trimmed.includes('==')) return;
            const parts = trimmed.split(/\s+/);

            if (currentConfig.location === 'BETBEDER') {
                if (parts.length >= 4 && parts[0].includes('/')) {
                    const date = parts[0];
                    const dayRaw = parts[parts.length - 1];
                    const dayFull = DAY_MAP[dayRaw] || dayRaw;
                    let entry = ""; let exit = "";
                    if (!trimmed.toLowerCase().includes('sin registro')) {
                        entry = parts[1];
                        exit = parts[2];
                    }
                    results.push({ date, dayName: dayFull, entry, exit, observation: "", isFeriado: false, isJustified: false, hours: 0, penaltyHours: 0, status: '', isEarly: false, isLate: false, minutesLate: 0 });
                }
            } else {
                const llerenaRegex = /^(\d{2})\s+([A-Z][a-z])(.*)/;
                const match = trimmed.match(llerenaRegex);
                if (match) {
                    const date = match[1]; 
                    const dayShort = match[2]; 
                    const timesMatch = match[3].match(/(\d{1,2}:\d{2})/g) || [];
                    const entry = timesMatch.length > 0 ? timesMatch[0] : ""; 
                    const exit = timesMatch.length > 1 ? timesMatch[1] : "";
                    
                    results.push({ date, dayName: DAY_MAP[dayShort] || dayShort, entry, exit, observation: "", isFeriado: false, isJustified: false, hours: 0, penaltyHours: 0, status: '', isEarly: false, isLate: false, minutesLate: 0 });
                }
            }
        });

        if (results.length > 0) {
            setParsedReport(results);
            setActiveTab('report');
        }
    };

    const finalReportData = useMemo(() => {
        if (!selectedWorkerId || !currentConfig || parsedReport.length === 0) return null;

        const timeToMinutes = (time: string) => {
            const [h, m] = (time || "00:00").split(':').map(Number);
            return h * 60 + m;
        };

        const reportMap = new Map<string, ParsedDay>(parsedReport.map(r => [r.date, r] as [string, ParsedDay]));
        const firstEntry = parsedReport[0];
        const fullQuincena: ParsedDay[] = [];
        let anchorDate = new Date();
        if (currentConfig.location === 'BETBEDER' && firstEntry.date.includes('/')) {
            const [d, m] = firstEntry.date.split('/').map(Number);
            anchorDate.setDate(d); anchorDate.setMonth(m - 1);
        } else {
            anchorDate.setDate(parseInt(firstEntry.date));
        }

        for (let i = 0; i < 14; i++) {
            const current = new Date(anchorDate);
            current.setDate(anchorDate.getDate() + i);
            let dateStr = currentConfig.location === 'BETBEDER' ? `${String(current.getDate()).padStart(2, '0')}/${String(current.getMonth() + 1).padStart(2, '0')}` : String(current.getDate()).padStart(2, '0');
            const dayName = DAYS_OF_WEEK[current.getDay() === 0 ? 6 : current.getDay() - 1].key;
            const existing = reportMap.get(dateStr);
            if (existing) { fullQuincena.push({ ...(existing as ParsedDay) }); } else {
                fullQuincena.push({ date: dateStr, dayName: dayName, entry: "", exit: "", observation: "", isFeriado: false, isJustified: false, hours: 0, penaltyHours: 0, status: "", isEarly: false, isLate: false, minutesLate: 0 });
            }
        }

        let totalAccumulatedHours = 0;
        let totalPenaltyHours = 0;
        let totalLateCount = 0;

        const detailedDays = fullQuincena.map(day => {
            let hours = 0; let penaltyHours = 0; let status = "TRABAJADO";
            const isWorkDay = currentConfig.work_days.includes(day.dayName);
            const entryMins = day.entry ? timeToMinutes(day.entry) : null;
            const exitMins = day.exit ? timeToMinutes(day.exit) : null;

            const amEntry = timeToMinutes(currentConfig.entry_time);
            const amExit = timeToMinutes(currentConfig.exit_time);
            const pmEntry = currentConfig.entry_time_pm ? timeToMinutes(currentConfig.entry_time_pm) : null;
            const pmExit = currentConfig.exit_time_pm ? timeToMinutes(currentConfig.exit_time_pm) : null;

            let targetEntry = amEntry; let targetExit = amExit;
            if (entryMins !== null && pmEntry !== null) {
                const diffAm = Math.abs(entryMins - amEntry);
                const diffPm = Math.abs(entryMins - pmEntry);
                if (diffPm < diffAm) { targetEntry = pmEntry; targetExit = pmExit!; }
            }

            const scheduledDailyHours = (targetExit - targetEntry) / 60;
            let isEarly = false; let isLate = false;
            let diffMinutes = 0;

            if (day.isFeriado) {
                if (day.entry && day.exit) {
                    hours = ((exitMins! - entryMins!) / 60) * 2;
                    status = "FERIADO TRABAJADO";
                } else { hours = scheduledDailyHours; status = "FERIADO"; }
            } else if (day.entry && day.exit) {
                hours = (exitMins! - entryMins!) / 60;
                diffMinutes = entryMins! - targetEntry;

                if (diffMinutes <= -10) {
                    isEarly = true;
                }

                if (diffMinutes > 0) {
                    isLate = true;
                    // REGLA: Si llega > 10 min tarde, se penaliza hora Y se pierde bono.
                    // Si llega 1-10 min tarde, NO se penaliza hora, pero afecta bono si no es excelencia.
                    if (diffMinutes <= 10) {
                        status = "TARDE (TOLERANCIA)"; 
                    } else {
                        totalLateCount++; // Penalización grave
                        if (diffMinutes >= 120) { 
                            penaltyHours = 4;
                            status = "TARDE (>2H) -4Hs";
                        } else if (diffMinutes >= 60) { 
                            penaltyHours = 2;
                            status = "TARDE (>1H) -2Hs";
                        } else {
                            penaltyHours = 1;
                            status = "TARDE (>10m) -1Hs";
                        }
                    }
                }
            } else if ((day.entry && !day.exit) || (!day.entry && day.exit)) {
                status = "REGISTRO INCOMPLETO (-6Hs)";
                penaltyHours = 6;
                totalLateCount++; 
            } else {
                if (isWorkDay) {
                    if (day.isJustified) { 
                        hours = scheduledDailyHours / 2; 
                        status = "FALTA JUSTIFICADA"; 
                    } else { 
                        status = "FALTA"; 
                    }
                } else { 
                    status = "NO TRABAJA"; 
                }
            }

            totalAccumulatedHours += (hours - penaltyHours);
            totalPenaltyHours += penaltyHours;
            return { ...(day as ParsedDay), hours, penaltyHours, status, isEarly, isLate, minutesLate: Math.max(0, diffMinutes) };
        });

        const settings = globalSettings[currentConfig.location] || { bonus_1: 30000, bonus_2: 20000 };
        const roundedHours = Math.round(totalAccumulatedHours);
        const subtotal = roundedHours * currentConfig.hourly_rate;

        // LÓGICA DE BONOS
        const workedDays = detailedDays.filter(d => d.entry && d.exit);
        const isAlwaysEarly = workedDays.length > 0 && workedDays.every(d => d.isEarly);
        const hasFatalIssues = detailedDays.some(d => {
            if (d.minutesLate > 10 && !d.isJustified) return true;
            if ((d.status === 'FALTA' || d.status.includes('INCOMPLETO')) && !d.isJustified) return true;
            return false;
        });
        const hasJustifiedAbsence = detailedDays.some(d => d.status === 'FALTA JUSTIFICADA');
        const hasJustifiedLateness = detailedDays.some(d => d.minutesLate > 10 && d.isJustified);

        let bonusAmount = 0;
        let bonusStatus = "SIN BONO";

        if (!hasFatalIssues) {
            if (isAlwaysEarly && !hasJustifiedAbsence && !hasJustifiedLateness) {
                bonusAmount = settings.bonus_1;
                bonusStatus = "BONO EXCELENCIA (1)";
            } else {
                bonusAmount = settings.bonus_2;
                bonusStatus = "BONO CUMPLIMIENTO (2)";
            }
        }

        // CÁLCULO DE EXTRAS Y FINAL
        const calculatedExtraFromHours = extraHoursInput * currentConfig.hourly_rate;
        const totalAdditions = calculatedExtraFromHours + manualExtraAmount;
        const totalToPay = subtotal + bonusAmount + totalAdditions - debtAmount;

        // LÓGICA DE MÉTRICAS
        const markedCount = detailedDays.filter(d => {
            if (d.entry && d.exit) return true;
            if (d.status === 'FERIADO') return true;
            if (d.isJustified) return true;
            if (d.status === 'NO TRABAJA') return true;
            return false;
        }).length;

        const metrics = {
            user_id: selectedWorkerId,
            early_arrivals: detailedDays.filter(d => d.isEarly).length,
            late_arrivals: totalLateCount, 
            justified_count: detailedDays.filter(d => d.isJustified && (d.isLate || d.status.includes('FALTA'))).length,
            total_issues: detailedDays.filter(d => d.minutesLate > 0 || d.status === 'FALTA' || d.status.includes('INCOMPLETO')).length,
            holidays_worked: detailedDays.filter(d => d.status === 'FERIADO TRABAJADO').length,
            absences: detailedDays.filter(d => d.status === 'FALTA').length,
            scheduled_days: detailedDays.filter(d => currentConfig.work_days.includes(d.dayName)).length,
            marked_days: markedCount
        };

        return { 
            detailedDays, 
            totalHours: roundedHours, 
            totalPenaltyHours, 
            totalLateCount, 
            subtotal, 
            bonusAmount, 
            bonusStatus, 
            totalToPay, 
            metrics,
            calculatedExtraFromHours
        };
    }, [parsedReport, currentConfig, globalSettings, debtAmount, extraHoursInput, manualExtraAmount]);

    const toggleFlag = (idx: number, field: 'isFeriado' | 'isJustified') => {
        const dayToFlag = finalReportData?.detailedDays[idx];
        if (!dayToFlag) return;
        setParsedReport(prev => {
            const existingIdx = prev.findIndex(p => p.date === dayToFlag.date);
            const next = [...prev];
            if (existingIdx !== -1) {
                next[existingIdx] = { ...(next[existingIdx] as ParsedDay), [field]: !next[existingIdx][field] };
            } else {
                next.push({ ...(dayToFlag as ParsedDay), [field]: !dayToFlag[field] });
                next.sort((a,b) => a.date.localeCompare(b.date));
            }
            return next;
        });
    };

    const handleSavePerformance = async () => {
        if (!finalReportData?.metrics || !selectedWorkerId) return;
        setPerfSaveStatus('saving');
        try {
            const { data: existing } = await supabase.from('attendance_performance').select('*').eq('user_id', selectedWorkerId).maybeSingle();
            
            const payload = {
                user_id: selectedWorkerId,
                early_arrivals: (existing?.early_arrivals || 0) + finalReportData.metrics.early_arrivals,
                late_arrivals: (existing?.late_arrivals || 0) + finalReportData.metrics.late_arrivals,
                justified_count: (existing?.justified_count || 0) + finalReportData.metrics.justified_count,
                total_issues: (existing?.total_issues || 0) + finalReportData.metrics.total_issues,
                holidays_worked: (existing?.holidays_worked || 0) + finalReportData.metrics.holidays_worked,
                absences: (existing?.absences || 0) + finalReportData.metrics.absences,
                scheduled_days: (existing?.scheduled_days || 0) + finalReportData.metrics.scheduled_days,
                marked_days: (existing?.marked_days || 0) + finalReportData.metrics.marked_days,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase.from('attendance_performance').upsert(payload);
            if (error) throw error;
            setPerfSaveStatus('success');
            setTimeout(() => setPerfSaveStatus('idle'), 3000);
            loadData();
        } catch (e) {
            console.error(e);
            setPerfSaveStatus('idle');
        }
    };

    const rankingSorted = useMemo(() => {
        return [...performanceHistory].map(p => {
            let score = 0;
            score += (p.early_arrivals * 1);
            score -= (p.late_arrivals * 1);
            score -= (p.absences * 1);
            if (p.late_arrivals > 0) {
                const justRatio = p.justified_count / p.late_arrivals;
                if (justRatio >= 0.8) score += 1;
                else score -= 1;
            }
            const baseDays = 12; 
            const markingEff = (p.marked_days / (p.scheduled_days || baseDays));
            
            if (markingEff >= 1) {
                score += 2;
            } else if (markingEff > 0.8) {
                score += 1;
            } else if (markingEff < 0.5) {
                score -= 1;
            }
            return { ...p, score };
        }).sort((a, b) => (b.score || 0) - (a.score || 0));
    }, [performanceHistory]);

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden -m-4 md:-m-8">
            <div className="bg-surface border-b border-surfaceHighlight px-4 md:px-8 flex justify-between items-center shrink-0">
                <div className="flex gap-4 md:gap-8 overflow-x-auto no-scrollbar">
                    <button onClick={() => setActiveTab('workers')} className={`py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'workers' || activeTab === 'report' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'}`}>
                        <span className="flex items-center gap-2"><Users size={18}/> Gestión Trabajadores</span>
                    </button>
                    <button onClick={() => setActiveTab('settings')} className={`py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'settings' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'}`}>
                        <span className="flex items-center gap-2"><Settings size={18}/> Ajustes Globales</span>
                    </button>
                </div>
                {isVale && (
                    <button onClick={() => setActiveTab('performance')} className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black uppercase transition-all shadow-sm ${activeTab === 'performance' ? 'bg-primary text-white shadow-primary/20' : 'bg-surfaceHighlight text-muted hover:text-text'}`}>
                        <Trophy size={16}/> Rendimiento
                    </button>
                )}
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
                {activeTab === 'workers' && (
                    <>
                        <div className={`w-full md:w-80 border-b md:border-b-0 md:border-r border-surfaceHighlight bg-background/30 flex flex-col shrink-0 ${selectedWorkerId ? 'hidden md:flex' : 'flex flex-1 min-h-0'}`}>
                            <div className="p-6 border-b border-surfaceHighlight flex justify-between items-center">
                                <h3 className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Listado de Personal</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                {armadores.map(w => {
                                    const isSelected = selectedWorkerId === w.id;
                                    const config = workerConfigs[w.id];
                                    return (
                                        <button key={w.id} onClick={() => { setSelectedWorkerId(w.id); setRawReport(''); }} className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${isSelected ? 'bg-primary text-white shadow-xl scale-[1.02]' : 'hover:bg-surfaceHighlight text-text bg-surface md:bg-transparent shadow-sm md:shadow-none'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`h-10 w-10 rounded-xl overflow-hidden flex items-center justify-center font-black text-[10px] border ${isSelected ? 'bg-white/20 border-white/30' : 'bg-surfaceHighlight/50 border-surfaceHighlight'}`}>
                                                    {w.avatar_url ? <img src={w.avatar_url} className="h-full w-full object-cover" /> : w.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col text-left">
                                                    <span className="text-sm font-bold truncate max-w-[140px] uppercase">{w.name}</span>
                                                    <span className={`text-[9px] font-black uppercase ${isSelected ? 'text-white/60' : 'text-muted'}`}>
                                                        {config?.location || 'Sin Sede'}
                                                    </span>
                                                </div>
                                            </div>
                                            <Circle size={8} fill="currentColor" className={!!config ? 'text-green-500' : 'text-surfaceHighlight'} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className={`flex-1 overflow-y-auto p-4 md:p-8 md:p-12 bg-white dark:bg-background ${!selectedWorkerId ? 'hidden md:block' : 'block'}`}>
                            {currentConfig && selectedWorker ? (
                                <div className="max-w-3xl space-y-8 md:space-y-12 animate-in fade-in slide-in-from-right-4 md:slide-in-from-bottom-4">
                                    {/* Botón Volver (Solo Móvil) */}
                                    <button onClick={() => setSelectedWorkerId(null)} className="md:hidden flex items-center gap-2 text-muted hover:text-text transition-colors text-xs font-black uppercase tracking-widest mb-4">
                                        <ChevronLeft size={16} /> Volver al Listado
                                    </button>

                                    <div className="flex items-center gap-6">
                                        <div className="h-24 w-24 rounded-[2.5rem] overflow-hidden border-4 border-surfaceHighlight shadow-2xl bg-background flex items-center justify-center shrink-0">
                                            {selectedWorker.avatar_url ? <img src={selectedWorker.avatar_url} className="h-full w-full object-cover" /> : <UserIcon size={48} className="text-muted" />}
                                        </div>
                                        <div>
                                            <h2 className="text-3xl md:text-4xl font-black text-text tracking-tighter flex items-center gap-3 uppercase italic leading-none">{selectedWorker.name}</h2>
                                            <p className="text-muted text-sm font-medium mt-1 uppercase tracking-wider">Configuración individual.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-10">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-4">
                                                <label className="text-xs font-black text-text uppercase tracking-wide">Tarifa por Hora</label>
                                                <div className="relative group">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-surfaceHighlight/30 p-2 rounded-lg text-muted"><Banknote size={18} /></div>
                                                    <input type="number" value={currentConfig.hourly_rate} onChange={e => handleWorkerChange({ hourly_rate: parseFloat(e.target.value) || 0 })} className="w-full bg-white dark:bg-background border border-surfaceHighlight rounded-2xl py-5 pl-16 pr-6 text-lg font-black text-text outline-none focus:border-primary transition-all shadow-sm" />
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <label className="text-xs font-black text-text uppercase tracking-wide">Sede Asignada</label>
                                                <div className="flex gap-3">
                                                    <button onClick={() => handleWorkerChange({ location: 'LLERENA' })} className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase transition-all border flex items-center justify-center gap-2 ${currentConfig.location === 'LLERENA' ? 'bg-primary/5 border-primary text-primary shadow-sm' : 'bg-white dark:bg-background text-muted border-surfaceHighlight hover:bg-surfaceHighlight/50'}`}><Building2 size={16}/> Llerena</button>
                                                    <button onClick={() => handleWorkerChange({ location: 'BETBEDER' })} className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase transition-all border flex items-center justify-center gap-2 ${currentConfig.location === 'BETBEDER' ? 'bg-primary/5 border-primary text-primary shadow-sm' : 'bg-white dark:bg-background text-muted border-surfaceHighlight hover:bg-surfaceHighlight/50'}`}><MapPin size={16}/> Betbeder</button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <label className="text-xs font-black text-text uppercase tracking-wide">Días Laborales Programados</label>
                                            <div className="flex flex-wrap gap-3">
                                                {DAYS_OF_WEEK.map(d => (
                                                    <button 
                                                        key={d.key} 
                                                        onClick={() => toggleDay(d.key)} 
                                                        className={`px-4 md:px-6 py-3 rounded-2xl text-[10px] md:text-xs font-bold transition-all border ${currentConfig.work_days.includes(d.key) ? 'bg-primary/5 border-primary text-primary shadow-sm' : 'bg-white dark:bg-background text-muted border-surfaceHighlight hover:bg-surfaceHighlight/50'}`}
                                                    >
                                                        {d.short}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-8">
                                            <h3 className="text-sm font-black text-text uppercase italic border-b border-surfaceHighlight pb-2">Turnos Programados</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">Turno Mañana</label>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="relative">
                                                            <input type="time" value={currentConfig.entry_time} onChange={e => handleWorkerChange({ entry_time: e.target.value })} className="w-full bg-white dark:bg-background border border-surfaceHighlight rounded-2xl py-4 px-4 text-xs font-black text-text outline-none focus:border-primary shadow-sm" />
                                                            <div className="absolute -top-2 left-3 px-1 bg-white dark:bg-background text-[8px] font-bold text-muted uppercase">Entrada</div>
                                                        </div>
                                                        <div className="relative">
                                                            <input type="time" value={currentConfig.exit_time} onChange={e => handleWorkerChange({ exit_time: e.target.value })} className="w-full bg-white dark:bg-background border border-surfaceHighlight rounded-2xl py-4 px-4 text-xs font-black text-text outline-none focus:border-primary shadow-sm" />
                                                            <div className="absolute -top-2 left-3 px-1 bg-white dark:bg-background text-[8px] font-bold text-muted uppercase">Salida</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">Turno Tarde (Rotativo)</label>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="relative">
                                                            <input type="time" value={currentConfig.entry_time_pm || ''} onChange={e => handleWorkerChange({ entry_time_pm: e.target.value })} className="w-full bg-white dark:bg-background border border-surfaceHighlight rounded-2xl py-4 px-4 text-xs font-black text-text outline-none focus:border-primary shadow-sm" />
                                                            <div className="absolute -top-2 left-3 px-1 bg-white dark:bg-background text-[8px] font-bold text-muted uppercase">Entrada</div>
                                                        </div>
                                                        <div className="relative">
                                                            <input type="time" value={currentConfig.exit_time_pm || ''} onChange={e => handleWorkerChange({ exit_time: e.target.value })} className="w-full bg-white dark:bg-background border border-surfaceHighlight rounded-2xl py-4 px-4 text-xs font-black text-text outline-none focus:border-primary shadow-sm" />
                                                            <div className="absolute -top-2 left-3 px-1 bg-white dark:bg-background text-[8px] font-bold text-muted uppercase">Salida</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-surfaceHighlight/50 space-y-6">
                                            <div className="space-y-3">
                                                <label className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2"><Zap size={16} /> Procesar Informe de Huella</label>
                                                <textarea value={rawReport} onChange={e => setRawReport(e.target.value)} placeholder="Pegue aquí el texto del reporte de asistencia..." className="w-full h-32 bg-white dark:bg-background border border-surfaceHighlight rounded-2xl p-4 text-xs font-mono text-text outline-none focus:border-primary shadow-inner resize-none transition-all" />
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <button onClick={saveWorkerConfig} disabled={saveStatus === 'saving'} className={`py-4 rounded-2xl font-black uppercase text-xs shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 ${saveStatus === 'success' ? 'bg-green-600 text-white' : 'bg-primary text-white shadow-primary/30 hover:bg-primaryHover'}`}>
                                                    {saveStatus === 'saving' ? <Loader2 size={18} className="animate-spin" /> : saveStatus === 'success' ? <CheckCircle2 size={18}/> : <Save size={18} />}
                                                    Guardar Cambios
                                                </button>
                                                <button onClick={processReport} disabled={!rawReport.trim()} className="py-4 rounded-2xl font-black uppercase text-xs bg-slate-900 text-white shadow-xl hover:bg-black transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-30">
                                                    <FileText size={18} /> Generar Detalle Quincenal
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-20"><Users size={80} className="mb-4" /><p className="font-black uppercase tracking-[0.3em] text-sm">Seleccione un trabajador</p></div>
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'report' && finalReportData && (
                    <div className="flex-1 bg-background p-4 md:p-8 md:p-12 overflow-y-auto animate-in zoom-in-95">
                        <div className="max-w-6xl mx-auto space-y-10 pb-20">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                                <div>
                                    <p className="text-primary font-black text-[10px] uppercase tracking-[0.3em] mb-1">Cálculo de Quincena</p>
                                    <h1 className="text-3xl md:text-4xl font-black text-text tracking-tighter uppercase italic leading-none">Informe Detallado</h1>
                                    <p className="text-muted text-sm font-medium mt-2 uppercase tracking-wide italic">Resumen de 14 días — {selectedWorker?.name}</p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                    {isVale && (
                                        <button onClick={handleSavePerformance} disabled={perfSaveStatus === 'saving'} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-black text-xs transition-all shadow-lg ${perfSaveStatus === 'success' ? 'bg-green-600 text-white shadow-green-900/20' : 'bg-primary text-white shadow-primary/20 hover:bg-primaryHover'}`}>
                                            {perfSaveStatus === 'saving' ? <Loader2 size={16} className="animate-spin"/> : perfSaveStatus === 'success' ? <CheckCircle2 size={16}/> : <Save size={16}/>}
                                            {perfSaveStatus === 'success' ? 'Rendimiento Guardado' : 'Guardar Rendimiento'}
                                        </button>
                                    )}
                                    <button onClick={() => window.print()} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-surface border border-surfaceHighlight text-text font-bold text-xs shadow-sm hover:bg-surfaceHighlight transition-all"><FileText size={16}/> PDF</button>
                                </div>
                            </div>

                            <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 md:p-8 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-8 shadow-sm">
                                <SummaryItem label="Horas Totales" value={finalReportData.totalHours.toString()} color="text-text" />
                                <SummaryItem label="Multa (Hs)" value={finalReportData.totalPenaltyHours.toString()} color="text-red-500" />
                                <SummaryItem label="Tardanzas" value={finalReportData.totalLateCount.toString()} color="text-orange-500" />
                                <SummaryItem label="Tarifa x H" value={`$ ${currentConfig?.hourly_rate.toLocaleString()}`} color="text-text" />
                                <SummaryItem label="Total Bruto" value={`$ ${finalReportData.subtotal.toLocaleString()}`} color="text-text" />
                                <div className="flex flex-col gap-2">
                                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Bono</span>
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border self-start ${finalReportData.bonusAmount > 0 ? 'bg-green-500/10 text-green-600 border-green-200' : 'bg-surfaceHighlight text-muted'}`}>{finalReportData.bonusStatus}</span>
                                </div>
                                <div className="col-span-2 lg:col-span-2 flex flex-col gap-4 bg-background/30 p-4 rounded-2xl border border-surfaceHighlight">
                                    <div className="flex justify-between items-center border-b border-surfaceHighlight pb-2">
                                        <h4 className="text-[10px] font-black text-primary uppercase flex items-center gap-2"><PlusCircle size={12}/> Ajustes y Adicionales</h4>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="flex flex-col gap-1 relative">
                                            <span className="text-[9px] font-bold text-muted uppercase tracking-tighter">Horas Extras</span>
                                            <input type="number" value={extraHoursInput} onChange={(e) => setExtraHoursInput(parseFloat(e.target.value) || 0)} className="w-full bg-surface border border-surfaceHighlight rounded-lg p-2 text-xs font-black text-text outline-none focus:border-green-500 text-center shadow-inner" placeholder="0" />
                                            {finalReportData.calculatedExtraFromHours > 0 && (
                                                <span className="absolute -bottom-4 left-0 w-full text-[9px] font-black text-green-600 text-center">+ $ {Math.round(finalReportData.calculatedExtraFromHours).toLocaleString()}</span>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[9px] font-bold text-muted uppercase tracking-tighter">Extra Manual $</span>
                                            <input type="number" value={manualExtraAmount} onChange={(e) => setManualExtraAmount(parseFloat(e.target.value) || 0)} className="w-full bg-surface border border-surfaceHighlight rounded-lg p-2 text-xs font-black text-green-600 outline-none focus:border-green-500 text-center shadow-inner" placeholder="$ 0" />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[9px] font-bold text-muted uppercase tracking-tighter text-red-500">Deuda</span>
                                            <input type="number" value={debtAmount} onChange={(e) => setDebtAmount(parseFloat(e.target.value) || 0)} className="w-full bg-surface border border-surfaceHighlight rounded-lg p-2 text-xs font-black text-red-500 outline-none focus:border-red-500 text-center shadow-inner" placeholder="$ 0" />
                                        </div>
                                    </div>
                                </div>
                                <div className="col-span-2 md:col-span-4 lg:col-span-8 flex justify-end pt-4 border-t border-surfaceHighlight">
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs font-bold text-muted uppercase tracking-widest mb-1">Neto Final a Pagar</span>
                                        <span className="text-4xl font-black text-green-600 tracking-tighter">$ {finalReportData.totalToPay.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm overflow-x-auto">
                                <div className="p-4 border-b border-surfaceHighlight bg-background/20 flex justify-between items-center min-w-[800px]">
                                    <h3 className="text-xs font-black uppercase text-muted tracking-[0.2em]">Detalle Diario</h3>
                                    <div className="flex gap-4 text-[9px] font-black text-muted uppercase tracking-widest">
                                        <span className="flex items-center gap-1"><Circle size={8} fill="#f97316" className="text-orange-500"/> Feriado</span>
                                        <span className="flex items-center gap-1"><Circle size={8} fill="#2563eb" className="text-blue-600"/> Justificado (Tardanza/Falta)</span>
                                    </div>
                                </div>
                                <table className="w-full text-left min-w-[800px]">
                                    <thead className="bg-background/40 text-[10px] text-muted font-black uppercase tracking-widest border-b border-surfaceHighlight">
                                        <tr>
                                            <th className="p-4 pl-8">Fecha</th>
                                            <th className="p-4">Día</th>
                                            <th className="p-4">Entrada</th>
                                            <th className="p-4">Salida</th>
                                            <th className="p-4 text-center">Horas</th>
                                            <th className="p-4 text-center">Multa (Hs)</th>
                                            <th className="p-4">Estado / Novedad</th>
                                            <th className="p-4 text-center w-12">F</th>
                                            <th className="p-4 text-center w-12">J</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-surfaceHighlight">
                                        {finalReportData.detailedDays.map((day, idx) => {
                                            return (
                                                <tr key={idx} className={`hover:bg-primary/5 transition-colors ${day.status === 'NO TRABAJA' ? 'opacity-40' : ''}`}>
                                                    <td className={`p-4 pl-8 text-xs font-black ${day.status === 'FALTA' ? 'text-red-600' : 'text-text'}`}>{day.date}</td>
                                                    <td className="p-4 text-xs font-bold text-blue-600">{day.dayName.substring(0, 2)}</td>
                                                    <td className="p-4 text-xs font-medium text-text">{day.entry || '--:--'}</td>
                                                    <td className="p-4 text-xs font-medium text-text">{day.exit || '--:--'}</td>
                                                    <td className="p-4 text-center text-xs font-black">{day.hours > 0 ? (day.hours - day.penaltyHours).toFixed(2) : '-'}</td>
                                                    <td className="p-4 text-center">
                                                        {day.penaltyHours > 0 && <span className="text-xs font-black text-red-500">-{day.penaltyHours} hs</span>}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${getStatusStyle(day.status)}`}>{day.status}</span>
                                                            {day.isEarly && <span className="text-[7px] text-green-600 font-bold uppercase ml-1 italic tracking-tighter">Llegó temprano</span>}
                                                            {day.isLate && !day.isJustified && day.minutesLate <= 10 && <span className="text-[7px] text-orange-500 font-bold uppercase ml-1 italic tracking-tighter">Tarde (Tolerancia)</span>}
                                                            {day.isLate && !day.isJustified && day.minutesLate > 10 && <span className="text-[7px] text-red-500 font-bold uppercase ml-1 italic tracking-tighter">Tardanza sin justificar</span>}
                                                            {day.isLate && day.isJustified && <span className="text-[7px] text-blue-500 font-bold uppercase ml-1 italic tracking-tighter">Tardanza Justificada</span>}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <button onClick={() => toggleFlag(idx, 'isFeriado')} className={`w-5 h-5 rounded-full border-2 transition-all ${day.isFeriado ? 'bg-orange-500 border-orange-600 shadow-sm' : 'border-surfaceHighlight hover:border-orange-200'}`} />
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <button onClick={() => toggleFlag(idx, 'isJustified')} className={`w-5 h-5 rounded-full border-2 transition-all ${day.isJustified ? 'bg-blue-600 border-blue-700 shadow-sm' : 'border-surfaceHighlight hover:border-blue-200'}`} />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            
                            <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 flex items-start gap-4">
                                <AlertTriangle className="text-primary shrink-0" size={20} />
                                <div>
                                    <h4 className="text-[11px] font-black text-primary uppercase tracking-widest">Información de Rendimiento</h4>
                                    <p className="text-[10px] text-muted font-bold leading-relaxed uppercase mt-1">
                                        Las horas de multa impactan el neto a pagar. Al marcar "Justificado" (J) en una tardanza o falta, el trabajador no pierde el derecho al bono 2 y su puntaje de ranking se protege parcialmente.
                                    </p>
                                </div>
                            </div>

                            <button onClick={() => setActiveTab('workers')} className="flex items-center gap-2 text-muted hover:text-primary transition-colors text-xs font-black uppercase tracking-widest"><X size={16}/> Salir del Informe</button>
                        </div>
                    </div>
                )}

                {activeTab === 'performance' && isVale && (
                    <div className="flex-1 p-8 md:p-12 overflow-y-auto bg-background">
                        <div className="max-w-6xl mx-auto space-y-12">
                            <div className="flex justify-between items-end">
                                <div>
                                    <h2 className="text-4xl font-black text-text tracking-tighter uppercase italic leading-none">Ranking de Rendimiento</h2>
                                    <p className="text-muted text-sm font-medium mt-3 uppercase tracking-wider">Cumplimiento de reglas y puntualidad histórica acumulada.</p>
                                </div>
                                <div className="hidden md:flex gap-4">
                                     <div className="bg-surface border border-surfaceHighlight rounded-2xl px-6 py-3 shadow-sm text-center">
                                        <p className="text-[9px] font-black text-muted uppercase tracking-widest">Puntaje Base</p>
                                        <p className="text-xl font-black text-primary">Sistema Acumulativo</p>
                                     </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {rankingSorted.map((p, idx) => {
                                    const rankColor = idx === 0 ? 'border-yellow-500 bg-yellow-500/5' : idx === 1 ? 'border-slate-400 bg-slate-400/5' : idx === 2 ? 'border-orange-500 bg-orange-500/5' : 'border-surfaceHighlight bg-surface';
                                    const Medal = idx === 0 ? Award : idx === 1 ? Star : idx === 2 ? Trophy : null;
                                    const justifiedRatio = p.late_arrivals > 0 ? Math.round((p.justified_count / (p.late_arrivals)) * 100) : 0;

                                    return (
                                        <div 
                                            key={p.user_id} 
                                            onClick={() => setSelectedPerfDetail(p)}
                                            className={`p-8 rounded-[2.5rem] border-2 transition-all shadow-sm flex flex-col gap-6 relative group hover:scale-[1.02] cursor-pointer ${rankColor}`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-16 w-16 rounded-2xl overflow-hidden border-2 border-surfaceHighlight bg-background flex items-center justify-center relative shadow-md">
                                                        {p.avatar_url ? <img src={p.avatar_url} className="h-full w-full object-cover" /> : <span className="font-black text-muted text-lg">{p.user_name?.substring(0, 2).toUpperCase()}</span>}
                                                        <div className="absolute -top-2 -left-2 h-7 w-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-[11px] font-black border-2 border-white shadow-lg">#{idx+1}</div>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-text uppercase italic tracking-tight leading-tight truncate max-w-[140px] text-base">{p.user_name}</h4>
                                                        <div className="flex items-center gap-1.5 mt-1 text-[11px] font-black uppercase text-primary">
                                                            <TrendingUp size={14} className="text-green-500"/> {(p as any).score} pts
                                                        </div>
                                                    </div>
                                                </div>
                                                {Medal && <Medal className={idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-slate-400' : 'text-orange-500'} size={36} />}
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <RankingStat label="Temprano (+1)" value={p.early_arrivals} color="text-green-600" />
                                                <RankingStat label="Tardanzas (-1)" value={p.late_arrivals} color="text-red-500" />
                                                <RankingStat label="Ausencias (-1)" value={p.absences} color="text-red-700" />
                                                <RankingStat label="Justificación" value={`${justifiedRatio}%`} color="text-blue-600" />
                                            </div>

                                            <div className="pt-4 border-t border-surfaceHighlight/50">
                                                <div className="flex justify-between items-center text-[9px] font-black uppercase mb-2 tracking-widest">
                                                    <span className="text-muted">Marcado de Asistencia</span>
                                                    <span className="text-text">{Math.round((p.marked_days / (p.scheduled_days || 12)) * 100)}%</span>
                                                </div>
                                                <div className="h-2 w-full bg-surfaceHighlight rounded-full overflow-hidden shadow-inner">
                                                    <div className="h-full bg-primary" style={{ width: `${(p.marked_days / (p.scheduled_days || 12)) * 100}%` }}></div>
                                                </div>
                                            </div>
                                            
                                            <div className="absolute bottom-4 right-8 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[8px] font-black uppercase text-primary">
                                                Ver Detalle <ChevronRight size={12}/>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {rankingSorted.length === 0 && (
                                <div className="py-24 text-center opacity-30 italic">
                                    <Target size={64} className="mx-auto mb-4" />
                                    <p className="font-black uppercase tracking-[0.3em] text-sm">Sin datos históricos guardados.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="flex-1 p-8 md:p-16 max-w-4xl overflow-y-auto">
                        <h2 className="text-3xl font-black text-text uppercase italic mb-8">Ajustes de Bonos Globales</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <SedeBonusCard location="LLERENA" settings={globalSettings['LLERENA']} onSave={loadData} />
                            <SedeBonusCard location="BETBEDER" settings={globalSettings['BETBEDER']} onSave={loadData} />
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL DE DETALLE DE RENDIMIENTO */}
            {selectedPerfDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-surface w-full max-w-lg rounded-[2.5rem] border border-surfaceHighlight shadow-2xl overflow-hidden flex flex-col">
                        <div className="p-8 border-b border-surfaceHighlight bg-background/20 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="h-16 w-16 rounded-2xl overflow-hidden border-2 border-primary/20 bg-background flex items-center justify-center shadow-md">
                                    {selectedPerfDetail.avatar_url ? <img src={selectedPerfDetail.avatar_url} className="h-full w-full object-cover" /> : <span className="font-black text-primary text-xl">{selectedPerfDetail.user_name?.substring(0, 2).toUpperCase()}</span>}
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-text uppercase italic tracking-tight">{selectedPerfDetail.user_name}</h3>
                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mt-1">Estadísticas Históricas Acumuladas</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedPerfDetail(null)} className="p-2 hover:bg-surfaceHighlight rounded-full text-muted transition-all"><X size={28}/></button>
                        </div>

                        <div className="p-8 space-y-8 overflow-y-auto max-h-[60vh]">
                            <div className="bg-primary text-white p-8 rounded-3xl text-center shadow-xl shadow-primary/20 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Puntaje Total de Ranking</span>
                                <p className="text-6xl font-black mt-3 leading-none italic tracking-tighter">{selectedPerfDetail.score} pts</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <DetailMetricItem 
                                    label="Días Temprano" 
                                    value={selectedPerfDetail.early_arrivals} 
                                    points={`+${selectedPerfDetail.early_arrivals}`} 
                                    icon={<Activity className="text-green-500" size={16}/>} 
                                />
                                <DetailMetricItem 
                                    label="Tardanzas" 
                                    value={selectedPerfDetail.late_arrivals} 
                                    points={`-${selectedPerfDetail.late_arrivals}`} 
                                    icon={<Clock className="text-red-500" size={16}/>} 
                                />
                                <DetailMetricItem 
                                    label="Ausencias" 
                                    value={selectedPerfDetail.absences} 
                                    points={`-${selectedPerfDetail.absences}`} 
                                    icon={<MinusCircle className="text-red-700" size={16}/>} 
                                />
                                <DetailMetricItem 
                                    label="Justificaciones" 
                                    value={`${selectedPerfDetail.late_arrivals > 0 ? Math.round((selectedPerfDetail.justified_count/selectedPerfDetail.late_arrivals)*100) : 0}%`} 
                                    points={selectedPerfDetail.late_arrivals > 0 ? (selectedPerfDetail.justified_count/selectedPerfDetail.late_arrivals >= 0.8 ? '+1' : '-1') : '0'} 
                                    icon={<CheckCircle2 className="text-blue-600" size={16}/>} 
                                />
                            </div>

                            <div className="bg-background border border-surfaceHighlight rounded-3xl p-6 space-y-4">
                                <div className="flex justify-between items-center text-[11px] font-black uppercase">
                                    <span className="text-muted">Efectividad de Marcado</span>
                                    <span className="text-text">{selectedPerfDetail.marked_days} / {selectedPerfDetail.scheduled_days || 12} días</span>
                                </div>
                                <div className="h-3 w-full bg-surfaceHighlight rounded-full overflow-hidden shadow-inner">
                                    <div className="h-full bg-primary" style={{ width: `${(selectedPerfDetail.marked_days / (selectedPerfDetail.scheduled_days || 12)) * 100}%` }}></div>
                                </div>
                                <p className="text-[9px] text-muted font-bold text-center uppercase tracking-widest">
                                    {Math.round((selectedPerfDetail.marked_days / (selectedPerfDetail.scheduled_days || 12)) * 100) === 100 ? '+2 puntos por asistencia perfecta' : 
                                     Math.round((selectedPerfDetail.marked_days / (selectedPerfDetail.scheduled_days || 12)) * 100) > 70 ? '+1 punto por alta asistencia' : 
                                     Math.round((selectedPerfDetail.marked_days / (selectedPerfDetail.scheduled_days || 12)) * 100) < 50 ? '-1 punto por baja asistencia' : '0 puntos adicionales'}
                                </p>
                            </div>
                        </div>

                        <div className="p-8 bg-background/50 border-t border-surfaceHighlight">
                            <button onClick={() => setSelectedPerfDetail(null)} className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase tracking-widest transition-all hover:bg-black active:scale-95">Cerrar Detalle</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const DetailMetricItem: React.FC<{ label: string, value: string | number, points: string, icon: React.ReactNode }> = ({ label, value, points, icon }) => (
    <div className="bg-background border border-surfaceHighlight p-5 rounded-2xl flex flex-col gap-2 shadow-sm">
        <div className="flex items-center justify-between">
            {icon}
            <span className={`text-[10px] font-black uppercase ${points.includes('+') ? 'text-green-600' : points === '0' ? 'text-muted' : 'text-red-600'}`}>{points} pts</span>
        </div>
        <div>
            <p className="text-[9px] font-black text-muted uppercase tracking-tight">{label}</p>
            <p className="text-xl font-black text-text">{value}</p>
        </div>
    </div>
);

const SummaryItem: React.FC<{ label: string, value: string, color: string }> = ({ label, value, color }) => (
    <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">{label}</span>
        <span className={`text-xl font-black uppercase tracking-tighter ${color}`}>{value}</span>
    </div>
);

const RankingStat: React.FC<{ label: string, value: string | number, color: string }> = ({ label, value, color }) => (
    <div className="bg-background/40 p-3 rounded-2xl flex flex-col border border-surfaceHighlight/50">
        <span className="text-[8px] font-black text-muted uppercase tracking-tight mb-1">{label}</span>
        <span className={`text-sm font-black ${color}`}>{value}</span>
    </div>
);

const getStatusStyle = (status: string) => {
    if (status.includes('FERIADO')) return 'bg-orange-500/10 text-orange-600 border-orange-200';
    if (status.includes('TRABAJADO')) return 'bg-green-500/10 text-green-600 border-green-200';
    if (status === 'FALTA JUSTIFICADA') return 'bg-blue-500/10 text-blue-600 border-blue-200';
    if (status.includes('TARDE') || status === 'INCOMPLETO') return 'bg-yellow-500/10 text-yellow-600 border-yellow-200';
    if (status === 'FALTA' || status.includes('REGISTRO INCOMPLETO')) return 'bg-red-500/10 text-red-600 border-red-200';
    if (status === 'NO TRABAJA') return 'bg-surfaceHighlight text-muted border-surfaceHighlight opacity-40';
    return 'bg-surfaceHighlight text-muted border-surfaceHighlight';
};

const SedeBonusCard: React.FC<{ location: string, settings?: GlobalAttendanceSettings, onSave: () => void }> = ({ location, settings, onSave }) => {
    const [b1, setB1] = useState(settings?.bonus_1 || 30000);
    const [b2, setB2] = useState(settings?.bonus_2 || 20000);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        const { error } = await supabase.from('attendance_settings').upsert({ location, bonus_1: b1, bonus_2: b2 });
        if (!error) onSave();
        setIsSaving(false);
    };

    return (
        <div className="bg-surface border border-surfaceHighlight rounded-[2.5rem] p-8 space-y-6 shadow-sm">
            <h3 className="text-xl font-black text-text uppercase italic leading-none">{location}</h3>
            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted uppercase ml-1">Bono 1 (Excelencia)</label>
                    <input type="number" value={b1} onChange={e => setB1(parseFloat(e.target.value)||0)} className="w-full bg-white dark:bg-background border border-surfaceHighlight rounded-2xl p-4 font-black text-primary shadow-sm" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted uppercase ml-1">Bono 2 (Cumplimiento)</label>
                    <input type="number" value={b2} onChange={e => setB2(parseFloat(e.target.value)||0)} className="w-full bg-white dark:bg-background border border-surfaceHighlight rounded-2xl p-4 font-black text-text shadow-sm" />
                </div>
            </div>
            <button onClick={handleSave} disabled={isSaving} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-lg active:scale-95 transition-all">
                {isSaving ? <Loader2 size={16} className="animate-spin mx-auto"/> : 'Actualizar Bonos'}
            </button>
        </div>
    );
};