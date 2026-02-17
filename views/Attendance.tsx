
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
    ChevronLeft,
    Edit2,
    Check,
    CalendarDays,
    Trash2,
    Printer,
    Crown,
    Medal
} from 'lucide-react';
import { supabase } from '../supabase';
import { User, WorkerAttendanceConfig, GlobalAttendanceSettings, AttendancePeriod } from '../types';

const DAYS_OF_WEEK = [
    { key: 'Lunes', short: 'Lun' },
    { key: 'Martes', short: 'Mar' },
    { key: 'Miércoles', short: 'Mié' },
    { key: 'Jueves', short: 'Ju' },
    { key: 'Viernes', short: 'Vie' },
    { key: 'Sábado', short: 'Sáb' },
    { key: 'Domingo', short: 'Dom' }
];

const DAY_MAP: Record<string, string> = {
    'Lu': 'Lunes', 'Ma': 'Martes', 'Mi': 'Miércoles', 'Ju': 'Jueves', 'Vi': 'Viernes', 'Sa': 'Sábado', 'Do': 'Domingo',
    'Lunes': 'Lunes', 'Martes': 'Martes', 'Miercoles': 'Miércoles', 'Miércoles': 'Miércoles', 'Jueves': 'Jueves', 'Viernes': 'Viernes', 'Sabado': 'Sábado', 'Sábado': 'Sábado', 'Domingo': 'Domingo'
};

interface ParsedDay {
    date: string; // YYYY-MM-DD
    dayName: string;
    entry: string;
    exit: string;
    observation: string;
    isFeriado: boolean;
    isJustified: boolean;
    isNoMark: boolean; 
    hours: number;
    penaltyHours: number;
    status: string;
    isEarly: boolean;
    isLate: boolean;
    minutesLate: number;
    originalRawDate?: string;
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
    const [periodsHistory, setPeriodsHistory] = useState<AttendancePeriod[]>([]);
    
    const [rawReport, setRawReport] = useState('');
    const [parsedReport, setParsedReport] = useState<ParsedDay[]>([]);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [perfSaveStatus, setPerfSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');
    
    const [debtAmount, setDebtAmount] = useState<number>(0);
    const [extraHoursInput, setExtraHoursInput] = useState<number>(0);
    const [manualExtraAmount, setManualExtraAmount] = useState<number>(0);

    const [selectedPerfDetail, setSelectedPerfDetail] = useState<PerformanceRecord | null>(null);
    const [selectedPeriodDetail, setSelectedPeriodDetail] = useState<AttendancePeriod | null>(null);
    
    const [editingTime, setEditingTime] = useState<{ date: string, type: 'entry' | 'exit' } | null>(null);

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

    const fetchHistory = async (userId: string) => {
        const { data } = await supabase.from('attendance_periods').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (data) setPeriodsHistory(data);
    };

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        setDebtAmount(0);
        setExtraHoursInput(0);
        setManualExtraAmount(0);
        if (activeTab === 'performance' && selectedPerfDetail) {
            fetchHistory(selectedPerfDetail.user_id);
        }
    }, [selectedWorkerId, selectedPerfDetail]);

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

    const timeToMinutes = (time: string) => {
        if (!time) return 0;
        const [h, m] = (time || "00:00").split(':').map(Number);
        return h * 60 + m;
    };

    const processReport = () => {
        if (!rawReport.trim() || !currentConfig) return;
        const lines = rawReport.split('\n');
        const results: ParsedDay[] = [];
        
        const today = new Date();
        let monthOffset = 0;

        for (const line of lines) {
            const match = line.trim().match(/^(\d{2})\s+([A-Za-z]+)/);
            if (match) {
                const dayNum = parseInt(match[1]);
                if (dayNum > today.getDate() + 5) {
                    monthOffset = -1;
                }
                break;
            }
        }

        let currentYear = today.getFullYear();
        let currentMonth = today.getMonth() + monthOffset;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear -= 1;
        }

        let previousDayNum = -1;

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || /tabla|asistencia|dd\/ss|ent|sal|am|pm|extra|Primer registro|Ultimo registro|Horas cumplidas/i.test(trimmed) || trimmed.includes('==')) return;

            const llerenaRegex = /^(\d{2})\s+([A-Za-z]+)(.*)/;
            const matchLlerena = trimmed.match(llerenaRegex);

            if (matchLlerena) {
                const dayNumStr = matchLlerena[1];
                const dayNum = parseInt(dayNumStr);
                const dayShort = matchLlerena[2]; 
                const restOfLine = matchLlerena[3];

                if (previousDayNum !== -1 && dayNum < previousDayNum) {
                    currentMonth++;
                    if (currentMonth > 11) {
                        currentMonth = 0;
                        currentYear++;
                    }
                }
                previousDayNum = dayNum;

                const fullDate = new Date(currentYear, currentMonth, dayNum);
                const isoDate = fullDate.toISOString().split('T')[0];

                const timesMatch = restOfLine.match(/(\d{1,2}:\d{2})/g) || [];
                let entry = ""; 
                let exit = "";

                if (timesMatch.length >= 2) { 
                    entry = timesMatch[0]; 
                    exit = timesMatch[timesMatch.length - 1]; 
                } 
                else if (timesMatch.length === 1) { 
                    const foundTime = timesMatch[0];
                    const foundMins = timeToMinutes(foundTime);
                    
                    // Lógica inteligente: ¿Qué está más cerca según la configuración del trabajador?
                    const schedEntry = timeToMinutes(currentConfig.entry_time);
                    const schedExit = timeToMinutes(currentConfig.exit_time);
                    const schedEntryPm = timeToMinutes(currentConfig.entry_time_pm || "");
                    const schedExitPm = timeToMinutes(currentConfig.exit_time_pm || "");

                    const distEntry = Math.abs(foundMins - schedEntry);
                    const distExit = Math.abs(foundMins - schedExit);
                    const distEntryPm = currentConfig.entry_time_pm ? Math.abs(foundMins - schedEntryPm) : 9999;
                    const distExitPm = currentConfig.exit_time_pm ? Math.abs(foundMins - schedExitPm) : 9999;

                    const minDist = Math.min(distEntry, distExit, distEntryPm, distExitPm);

                    if (minDist === distEntry || minDist === distEntryPm) {
                        entry = foundTime;
                    } else {
                        exit = foundTime;
                    }
                }

                const dayName = DAY_MAP[dayShort.substring(0, 2)] || dayShort;

                results.push({ 
                    date: isoDate, dayName, entry, exit, observation: "", 
                    isFeriado: false, isJustified: false, isNoMark: false, hours: 0, penaltyHours: 0, 
                    status: '', isEarly: false, isLate: false, minutesLate: 0, 
                    originalRawDate: dayNumStr 
                });
                return;
            }

            const betbederRegex = /^(\d{2}\/\d{2})\s+(\d{2}:\d{2})\s+(\d{2}:\d{2}).*?([a-zA-Z]+)$/;
            const matchBetbeder = trimmed.match(betbederRegex);

            if (matchBetbeder) {
                const datePart = matchBetbeder[1]; 
                const entry = matchBetbeder[2];    
                const exit = matchBetbeder[3];     
                const dayText = matchBetbeder[4];  

                const [d, m] = datePart.split('/').map(Number);
                
                let itemYear = today.getFullYear();
                if (today.getMonth() === 0 && m === 12) {
                    itemYear = itemYear - 1;
                }

                const fullDate = new Date(itemYear, m - 1, d);
                const isoDate = fullDate.toISOString().split('T')[0];
                const dayName = DAY_MAP[dayText] || dayText;

                results.push({
                    date: isoDate,
                    dayName: dayName,
                    entry,
                    exit,
                    observation: "",
                    isFeriado: false,
                    isJustified: false,
                    isNoMark: false,
                    hours: 0,
                    penaltyHours: 0,
                    status: '',
                    isEarly: false,
                    isLate: false,
                    minutesLate: 0,
                    originalRawDate: String(d).padStart(2, '0')
                });
            }
        });

        if (results.length > 0) {
            setParsedReport(results);
            setActiveTab('report');
        } else {
            alert("No se detectaron líneas válidas. Asegúrese de copiar el texto correctamente (formato Llerena o Betbeder).");
        }
    };

    const finalReportData = useMemo(() => {
        if (!selectedWorkerId || !currentConfig || parsedReport.length === 0) return null;

        const reportMap = new Map<string, ParsedDay>(parsedReport.map(r => [r.date, r] as [string, ParsedDay]));
        
        const sortedDates = [...parsedReport].map(r => r.date).sort();
        const startIso = sortedDates[0];
        const endIso = sortedDates[sortedDates.length - 1];
        
        const [sy, sm, sd] = startIso.split('-').map(Number);
        const startDate = new Date(sy, sm - 1, sd);
        
        const [ey, em, ed] = endIso.split('-').map(Number);
        const endDate = new Date(ey, em - 1, ed);

        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const fullPeriod: ParsedDay[] = [];
        
        for (let i = 0; i <= diffDays; i++) {
            const current = new Date(startDate);
            current.setDate(startDate.getDate() + i);
            const iso = current.toISOString().split('T')[0];
            
            const existing = reportMap.get(iso);
            if (existing) {
                fullPeriod.push({ ...existing });
            } else {
                const dayIdx = current.getDay();
                const dayName = DAYS_OF_WEEK[dayIdx === 0 ? 6 : dayIdx - 1].key;
                fullPeriod.push({ 
                    date: iso, 
                    dayName, 
                    entry: "", exit: "", observation: "", 
                    isFeriado: false, isJustified: false, isNoMark: false,
                    hours: 0, penaltyHours: 0, status: "", 
                    isEarly: false, isLate: false, minutesLate: 0,
                    originalRawDate: String(current.getDate()).padStart(2, '0')
                });
            }
        }

        let totalGrossHours = 0; // Horas trabajadas (Brutas)
        let totalPenaltyHours = 0;
        let totalLateCount = 0;

        const detailedDays = fullPeriod.map(day => {
            let hours = 0; let penaltyHours = 0; let status = "";
            const isWorkDay = currentConfig.work_days.includes(day.dayName);
            const entryMins = day.entry ? timeToMinutes(day.entry) : null;
            const exitMins = day.exit ? timeToMinutes(day.exit) : null;

            const amEntry = timeToMinutes(currentConfig.entry_time);
            const pmEntry = currentConfig.entry_time_pm ? timeToMinutes(currentConfig.entry_time_pm) : null;
            
            let targetEntry = amEntry; 
            if (entryMins !== null && pmEntry !== null) {
                const diffAm = Math.abs(entryMins - amEntry);
                const diffPm = Math.abs(entryMins - pmEntry);
                if (diffPm < diffAm) { 
                    targetEntry = pmEntry; 
                }
            }

            const scheduledDailyHours = 8;
            let isEarly = false; let isLate = false;
            let diffMinutes = 0;

            if (day.isFeriado) {
                if (day.entry && day.exit) {
                    hours = ((exitMins! - entryMins!) / 60) * 2;
                    status = "FERIADO TRABAJADO";
                } else { 
                    hours = scheduledDailyHours;
                    status = "FERIADO"; 
                }
            } else if (day.entry && day.exit) {
                hours = (exitMins! - entryMins!) / 60;
                diffMinutes = entryMins! - targetEntry;

                if (diffMinutes < 0) isEarly = true;

                if (diffMinutes > 0) {
                    isLate = true;
                    if (diffMinutes <= 10) {
                        status = "TARDE (TOLERANCIA)"; 
                    } else {
                        totalLateCount++; 
                        if (diffMinutes >= 120) { 
                            penaltyHours = 4; status = "TARDE (>2H) -4Hs";
                        } else if (diffMinutes >= 60) { 
                            penaltyHours = 2; status = "TARDE (>1H) -2Hs";
                        } else {
                            penaltyHours = 1; status = "TARDE (>10m) -1Hs";
                        }
                    }
                } else {
                    status = "TRABAJADO";
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

            totalGrossHours += hours; // Sumamos horas reales sin restar multa
            totalPenaltyHours += penaltyHours;
            
            return { 
                ...day, 
                hours, 
                penaltyHours, 
                status, 
                isEarly, 
                isLate, 
                minutesLate: Math.max(0, diffMinutes) 
            };
        });

        const settings = globalSettings[currentConfig.location] || { bonus_1: 30000, bonus_2: 20000 };
        const roundedHours = Math.round(totalGrossHours); // Horas totales para el cálculo base
        const baseSalary = roundedHours * currentConfig.hourly_rate; // Salario Base Bruto
        const penaltyDeduction = totalPenaltyHours * currentConfig.hourly_rate; // Deducción monetaria

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

        const calculatedExtraFromHours = extraHoursInput * currentConfig.hourly_rate;
        const totalAdditions = calculatedExtraFromHours + manualExtraAmount;
        
        // CÁLCULO FINAL: (Base Bruto - Multas) + Bonos + Extras - Deuda
        const totalToPay = baseSalary - penaltyDeduction + bonusAmount + totalAdditions - debtAmount;

        const markedCount = detailedDays.filter(d => {
            if (d.isNoMark) return false; 
            if (d.entry && d.exit) return true;
            return false;
        }).length;

        const effectiveScheduledDays = detailedDays.filter(d => {
            const isWorkDay = currentConfig.work_days.includes(d.dayName);
            const isHoliday = d.status === 'FERIADO';
            const isJustified = d.isJustified;
            
            if (!isWorkDay) return false;
            if (isHoliday || isJustified) return false;
            
            return true;
        }).length;

        const metrics = {
            user_id: selectedWorkerId,
            early_arrivals: detailedDays.filter(d => d.isEarly).length,
            late_arrivals: totalLateCount, 
            justified_count: detailedDays.filter(d => d.isJustified && (d.isLate || d.status.includes('FALTA'))).length,
            total_issues: detailedDays.filter(d => d.minutesLate > 0 || d.status === 'FALTA' || d.status.includes('INCOMPLETO')).length,
            holidays_worked: detailedDays.filter(d => d.status === 'FERIADO TRABAJADO').length,
            absences: detailedDays.filter(d => d.status === 'FALTA').length,
            scheduled_days: effectiveScheduledDays, 
            marked_days: markedCount
        };

        return { 
            detailedDays, 
            totalHours: roundedHours, 
            totalPenaltyHours, 
            penaltyDeduction,
            totalLateCount, 
            subtotal: baseSalary, 
            bonusAmount, 
            bonusStatus, 
            totalToPay, 
            metrics, 
            calculatedExtraFromHours,
            startDate,
            endDate
        };
    }, [parsedReport, currentConfig, globalSettings, debtAmount, extraHoursInput, manualExtraAmount]);

    const toggleFlag = (idx: number, field: 'isFeriado' | 'isJustified' | 'isNoMark') => {
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

    const updateManualTime = (date: string, type: 'entry' | 'exit', value: string) => {
        // Validar formato 24h HH:mm
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (value && !timeRegex.test(value)) {
             // Intento de auto-corrección simple
             if (/^\d{4}$/.test(value)) {
                value = value.slice(0, 2) + ':' + value.slice(2);
             } else {
                 setEditingTime(null);
                 return;
             }
        }

        setParsedReport(prev => {
            const existingIdx = prev.findIndex(p => p.date === date);
            if (existingIdx === -1) return prev;
            const next = [...prev];
            next[existingIdx] = { ...next[existingIdx], [type]: value };
            return next;
        });
        setEditingTime(null);
    };

    const handleSavePeriodAndPerformance = async () => {
        if (!finalReportData?.metrics || !selectedWorkerId || !currentConfig) return;
        setPerfSaveStatus('saving');
        try {
            // 1. Update Accumulated Performance
            const { data: existing } = await supabase.from('attendance_performance').select('*').eq('user_id', selectedWorkerId).maybeSingle();
            
            const perfPayload = {
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

            const { error: perfError } = await supabase.from('attendance_performance').upsert(perfPayload);
            if (perfError) throw perfError;

            // 2. Insert Period Record (History)
            const startD = finalReportData.startDate;
            const day = startD.getDate();
            const month = startD.toLocaleString('es-AR', { month: 'long' });
            const year = startD.getFullYear();
            const periodLabel = day <= 15 
                ? `Primera Quincena ${month} ${year}` 
                : `Segunda Quincena ${month} ${year}`;

            let score = 0;
            const m = finalReportData.metrics;
            score += m.early_arrivals * 1;
            score -= m.late_arrivals * 1;
            score -= m.absences * 1;
            if (m.late_arrivals > 0 && (m.justified_count / m.late_arrivals) >= 0.8) score += 1;
            else if (m.late_arrivals > 0) score -= 1;
            
            const markingEff = m.marked_days / (m.scheduled_days || 1);
            if (markingEff >= 1) score += 2;
            else if (markingEff > 0.8) score += 1;
            else if (markingEff < 0.5) score -= 1;

            const periodPayload = {
                user_id: selectedWorkerId,
                start_date: finalReportData.startDate.toISOString().split('T')[0],
                end_date: finalReportData.endDate.toISOString().split('T')[0],
                period_label: periodLabel,
                total_hours: finalReportData.totalHours, // Saves Gross Hours
                total_penalty_hours: finalReportData.totalPenaltyHours,
                hourly_rate: currentConfig.hourly_rate,
                bonus_amount: finalReportData.bonusAmount,
                extra_amount: finalReportData.calculatedExtraFromHours + manualExtraAmount,
                debt_amount: debtAmount,
                total_to_pay: finalReportData.totalToPay,
                details: finalReportData.detailedDays, 
                score_obtained: score,
                days_worked: finalReportData.detailedDays.filter(d => d.hours > 0).length
            };

            const { error: periodError } = await supabase.from('attendance_periods').insert(periodPayload);
            if (periodError) throw periodError;

            setPerfSaveStatus('success');
            setTimeout(() => setPerfSaveStatus('idle'), 3000);
            loadData();
        } catch (e: any) {
            console.error(e);
            alert("Error al guardar: " + e.message);
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
            const denom = p.scheduled_days || 1;
            const markingEff = p.marked_days / denom;
            if (markingEff >= 1) score += 2;
            else if (markingEff > 0.8) score += 1;
            else if (markingEff < 0.5) score -= 1;
            return { ...p, score };
        }).sort((a, b) => (b.score || 0) - (a.score || 0));
    }, [performanceHistory]);

    if (selectedPerfDetail) {
        return (
            <WorkerHistoryView 
                worker={selectedPerfDetail} 
                periods={periodsHistory} 
                onClose={() => setSelectedPerfDetail(null)} 
                onViewPeriod={(p) => setSelectedPeriodDetail(p)}
                onDeletePeriod={async (id) => {
                    if(!confirm("¿Eliminar este registro histórico?")) return;
                    await supabase.from('attendance_periods').delete().eq('id', id);
                    fetchHistory(selectedPerfDetail.user_id);
                }}
            />
        );
    }

    if (selectedPeriodDetail) {
        return (
            <PeriodDetailView 
                period={selectedPeriodDetail} 
                onBack={() => setSelectedPeriodDetail(null)} 
            />
        );
    }

    const topThree = rankingSorted.slice(0, 3);
    const restOfList = rankingSorted.slice(3);

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
                                                            <input type="time" value={currentConfig.exit_time_pm || ''} onChange={e => handleWorkerChange({ exit_time_pm: e.target.value })} className="w-full bg-white dark:bg-background border border-surfaceHighlight rounded-2xl py-4 px-4 text-xs font-black text-text outline-none focus:border-primary shadow-sm" />
                                                            <div className="absolute -top-2 left-3 px-1 bg-white dark:bg-background text-[8px] font-bold text-muted uppercase">Salida</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-surfaceHighlight/50 space-y-6">
                                            <div className="space-y-3">
                                                <label className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2"><Zap size={16} /> Procesar Informe de Huella</label>
                                                <textarea value={rawReport} onChange={e => setRawReport(e.target.value)} placeholder="Pegue aquí el texto del reporte de asistencia (formato Llerena o Betbeder)..." className="w-full h-32 bg-white dark:bg-background border border-surfaceHighlight rounded-2xl p-4 text-xs font-mono text-text outline-none focus:border-primary shadow-inner resize-none transition-all" />
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
                                    <p className="text-muted text-sm font-medium mt-2 uppercase tracking-wide italic">Resumen del Periodo — {selectedWorker?.name}</p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                    {isVale && (
                                        <button onClick={handleSavePeriodAndPerformance} disabled={perfSaveStatus === 'saving'} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-black text-xs transition-all shadow-lg ${perfSaveStatus === 'success' ? 'bg-green-600 text-white shadow-green-900/20' : 'bg-primary text-white shadow-primary/20 hover:bg-primaryHover'}`}>
                                            {perfSaveStatus === 'saving' ? <Loader2 size={16} className="animate-spin"/> : perfSaveStatus === 'success' ? <CheckCircle2 size={16}/> : <Save size={16}/>}
                                            {perfSaveStatus === 'success' ? 'Guardado' : 'Guardar Rendimiento'}
                                        </button>
                                    )}
                                    <button onClick={() => window.print()} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-surface border border-surfaceHighlight text-text font-bold text-xs shadow-sm hover:bg-surfaceHighlight transition-all"><FileText size={16}/> PDF</button>
                                </div>
                            </div>

                            <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 md:p-8 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-8 shadow-sm">
                                <SummaryItem label="Horas Trabajadas" value={finalReportData.totalHours.toString()} color="text-text" />
                                <SummaryItem label="Multas (Hs)" value={finalReportData.totalPenaltyHours.toString()} color="text-red-500" />
                                <SummaryItem label="Desc. Multas" value={`-$ ${finalReportData.penaltyDeduction.toLocaleString()}`} color="text-red-500" />
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
                                        <span className="flex items-center gap-1"><Circle size={8} fill="#2563eb" className="text-blue-600"/> Justificado</span>
                                        <span className="flex items-center gap-1"><Circle size={8} fill="#ef4444" className="text-red-500"/> NM (No Marcado)</span>
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
                                            <th className="p-4 text-center w-12">NM</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-surfaceHighlight">
                                        {finalReportData.detailedDays.map((day, idx) => {
                                            const isNonWorking = day.status === 'NO TRABAJA';
                                            const rowClass = isNonWorking 
                                                ? 'bg-surfaceHighlight/20 opacity-60 text-muted' 
                                                : day.status === 'FALTA' ? 'bg-red-500/5' : 'hover:bg-primary/5';

                                            const isEditingEntry = editingTime?.date === day.date && editingTime?.type === 'entry';
                                            const isEditingExit = editingTime?.date === day.date && editingTime?.type === 'exit';

                                            return (
                                                <tr key={idx} className={`transition-colors ${rowClass}`}>
                                                    <td className={`p-4 pl-8 text-xs font-black ${day.status === 'FALTA' ? 'text-red-600' : ''}`}>
                                                        {new Date(day.date + 'T12:00:00').toLocaleDateString('es-AR')}
                                                    </td>
                                                    <td className={`p-4 text-xs font-bold ${isNonWorking ? '' : 'text-blue-600'}`}>{day.dayName.substring(0, 2)}</td>
                                                    
                                                    {/* ENTRADA EDITABLE 24H SI NM ESTÁ ACTIVO */}
                                                    <td className="p-4 text-xs font-medium">
                                                        <div className="flex items-center gap-2 group/time">
                                                            {isEditingEntry ? (
                                                                <input 
                                                                    type="text" 
                                                                    autoFocus
                                                                    placeholder="00:00"
                                                                    maxLength={5}
                                                                    defaultValue={day.entry} 
                                                                    onInput={(e) => {
                                                                        const val = (e.target as HTMLInputElement).value.replace(/\D/g, '');
                                                                        if (val.length >= 3) {
                                                                            (e.target as HTMLInputElement).value = val.slice(0, 2) + ':' + val.slice(2, 4);
                                                                        }
                                                                    }}
                                                                    onBlur={(e) => updateManualTime(day.date, 'entry', e.target.value)}
                                                                    onKeyDown={(e) => e.key === 'Enter' && updateManualTime(day.date, 'entry', (e.target as HTMLInputElement).value)}
                                                                    className="bg-background border border-primary rounded p-1 text-[10px] w-16 text-center outline-none font-black shadow-sm"
                                                                />
                                                            ) : (
                                                                <>
                                                                    <span className={day.isNoMark ? 'text-blue-600 font-bold' : ''}>{day.entry || '--:--'}</span>
                                                                    {day.isNoMark && (
                                                                        <button 
                                                                            onClick={() => setEditingTime({ date: day.date, type: 'entry' })}
                                                                            className="opacity-0 group-hover/time:opacity-100 p-1 rounded hover:bg-surfaceHighlight text-muted hover:text-primary transition-all"
                                                                        >
                                                                            <Edit2 size={10} />
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* SALIDA EDITABLE 24H SI NM ESTÁ ACTIVO */}
                                                    <td className="p-4 text-xs font-medium">
                                                        <div className="flex items-center gap-2 group/time">
                                                            {isEditingExit ? (
                                                                <input 
                                                                    type="text" 
                                                                    autoFocus
                                                                    placeholder="00:00"
                                                                    maxLength={5}
                                                                    defaultValue={day.exit} 
                                                                    onInput={(e) => {
                                                                        const val = (e.target as HTMLInputElement).value.replace(/\D/g, '');
                                                                        if (val.length >= 3) {
                                                                            (e.target as HTMLInputElement).value = val.slice(0, 2) + ':' + val.slice(2, 4);
                                                                        }
                                                                    }}
                                                                    onBlur={(e) => updateManualTime(day.date, 'exit', e.target.value)}
                                                                    onKeyDown={(e) => e.key === 'Enter' && updateManualTime(day.date, 'exit', (e.target as HTMLInputElement).value)}
                                                                    className="bg-background border border-primary rounded p-1 text-[10px] w-16 text-center outline-none font-black shadow-sm"
                                                                />
                                                            ) : (
                                                                <>
                                                                    <span className={day.isNoMark ? 'text-blue-600 font-bold' : ''}>{day.exit || '--:--'}</span>
                                                                    {day.isNoMark && (
                                                                        <button 
                                                                            onClick={() => setEditingTime({ date: day.date, type: 'exit' })}
                                                                            className="opacity-0 group-hover/time:opacity-100 p-1 rounded hover:bg-surfaceHighlight text-muted hover:text-primary transition-all"
                                                                        >
                                                                            <Edit2 size={10} />
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>

                                                    <td className="p-4 text-center text-xs font-black">{day.hours > 0 ? (day.hours).toFixed(2) : '-'}</td>
                                                    <td className="p-4 text-center">
                                                        {day.penaltyHours > 0 && <span className="text-xs font-black text-red-500">{day.penaltyHours} hs</span>}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border w-fit ${getStatusStyle(day.status)}`}>{day.status}</span>
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
                                                    <td className="p-4 text-center">
                                                        <button onClick={() => toggleFlag(idx, 'isNoMark')} className={`w-5 h-5 rounded-full border-2 transition-all ${day.isNoMark ? 'bg-red-500 border-red-600 shadow-sm' : 'border-surfaceHighlight hover:border-red-200'}`} title="No Marcado (NM)" />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            
                            <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 flex flex-col md:flex-row items-start gap-8">
                                <div className="flex gap-4">
                                    <AlertTriangle className="text-primary shrink-0" size={20} />
                                    <div>
                                        <h4 className="text-[11px] font-black text-primary uppercase tracking-widest">Información de Rendimiento</h4>
                                        <p className="text-[10px] text-muted font-bold leading-relaxed uppercase mt-1">
                                            Las horas de multa impactan el neto a pagar. Al marcar "Justificado" (J) en una tardanza o falta, el trabajador no pierde el derecho al bono 2 y su puntaje de ranking se protege parcialmente.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <Clock className="text-red-500 shrink-0" size={20} />
                                    <div>
                                        <h4 className="text-[11px] font-black text-red-500 uppercase tracking-widest">Flag NM (No Marcado)</h4>
                                        <p className="text-[10px] text-muted font-bold leading-relaxed uppercase mt-1">
                                            Al habilitar **NM**, el trabajador cobrará las horas que ingreses manualmente usando el lápiz. El formato debe ser **24 horas** (ej: 17:30 para las 5:30 PM). Este día **no contará** para su efectividad de marcado.
                                        </p>
                                    </div>
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

                            {/* TOP 3 PODIUM */}
                            {topThree.length > 0 && (
                                <div className="flex flex-col md:flex-row justify-center items-end gap-6 mb-12">
                                    {topThree.map((p, idx) => {
                                        // Visual order for podium: 2nd, 1st, 3rd
                                        const visualOrder = idx === 0 ? 1 : idx === 1 ? 0 : 2;
                                        // But we iterate 0, 1, 2. Let's just map them.
                                        // Actually, let's map explicitly based on index to force the visual layout
                                        return null; 
                                    })}
                                    {/* 2ND PLACE */}
                                    {topThree[1] && <TopPerformerCard worker={topThree[1]} rank={2} onClick={() => setSelectedPerfDetail(topThree[1])} />}
                                    {/* 1ST PLACE */}
                                    {topThree[0] && <TopPerformerCard worker={topThree[0]} rank={1} onClick={() => setSelectedPerfDetail(topThree[0])} />}
                                    {/* 3RD PLACE */}
                                    {topThree[2] && <TopPerformerCard worker={topThree[2]} rank={3} onClick={() => setSelectedPerfDetail(topThree[2])} />}
                                </div>
                            )}

                            {/* REST OF THE LIST */}
                            {restOfList.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-black text-text uppercase italic tracking-tight flex items-center gap-2">
                                        <LayoutList size={20} className="text-muted" /> Clasificación General
                                    </h3>
                                    <div className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm">
                                        {restOfList.map((p, idx) => (
                                            <RankingListItem 
                                                key={p.user_id} 
                                                worker={p} 
                                                rank={idx + 4} 
                                                onClick={() => setSelectedPerfDetail(p)} 
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

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

            {selectedPerfDetail && (
                <WorkerHistoryView 
                    worker={selectedPerfDetail} 
                    periods={periodsHistory} 
                    onClose={() => setSelectedPerfDetail(null)} 
                    onViewPeriod={(p) => setSelectedPeriodDetail(p)}
                    onDeletePeriod={async (id) => {
                        if(!confirm("¿Eliminar este registro histórico?")) return;
                        await supabase.from('attendance_periods').delete().eq('id', id);
                        fetchHistory(selectedPerfDetail.user_id);
                    }}
                />
            )}

            {selectedPeriodDetail && (
                <PeriodDetailView 
                    period={selectedPeriodDetail} 
                    onBack={() => setSelectedPeriodDetail(null)} 
                />
            )}
        </div>
    );
};

// --- NEW COMPONENTS FOR LEADERBOARD ---

const TopPerformerCard: React.FC<{ worker: PerformanceRecord; rank: number; onClick: () => void }> = ({ worker, rank, onClick }) => {
    const isFirst = rank === 1;
    const isSecond = rank === 2;
    
    let borderColor = 'border-orange-300';
    let bgColor = 'bg-gradient-to-b from-orange-50 to-white dark:from-orange-900/10 dark:to-background';
    let textColor = 'text-orange-600';
    let badgeIcon = <Medal size={24} />;
    let heightClass = 'h-auto md:h-[420px]'; // Base height
    let scaleClass = 'scale-100';
    let label = "3º PUESTO";

    if (isFirst) {
        borderColor = 'border-yellow-400';
        bgColor = 'bg-gradient-to-b from-yellow-50 to-white dark:from-yellow-900/10 dark:to-background';
        textColor = 'text-yellow-600';
        badgeIcon = <Crown size={32} fill="currentColor" />;
        heightClass = 'h-auto md:h-[480px]';
        scaleClass = 'md:-mt-12 z-10 shadow-2xl';
        label = "MEJOR TRABAJADOR";
    } else if (isSecond) {
        borderColor = 'border-slate-300';
        bgColor = 'bg-gradient-to-b from-slate-50 to-white dark:from-slate-800/10 dark:to-background';
        textColor = 'text-slate-600';
        badgeIcon = <Medal size={28} />;
        heightClass = 'h-auto md:h-[440px]';
        label = "2º PUESTO";
    }

    const justifiedPct = worker.late_arrivals > 0 
        ? Math.round((worker.justified_count / worker.late_arrivals) * 100) 
        : 100;

    const attendanceRate = Math.round((worker.marked_days / (worker.scheduled_days || 1)) * 100);

    return (
        <div 
            onClick={onClick}
            className={`relative flex-1 w-full min-w-[280px] rounded-[2.5rem] border-2 p-6 flex flex-col items-center text-center cursor-pointer transition-all hover:scale-[1.02] shadow-xl ${borderColor} ${bgColor} ${heightClass} ${scaleClass}`}
        >
            {isFirst && (
                <div className="absolute -top-5 bg-yellow-400 text-yellow-900 px-6 py-2 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-lg border-2 border-white">
                    {label}
                </div>
            )}
            
            <div className={`rounded-full p-1 border-4 ${borderColor} bg-white relative mt-4`}>
                <div className="h-24 w-24 rounded-full overflow-hidden bg-gray-200">
                    {worker.avatar_url ? (
                        <img src={worker.avatar_url} className="h-full w-full object-cover" />
                    ) : (
                        <div className="h-full w-full flex items-center justify-center font-black text-2xl text-muted">
                            {worker.user_name?.substring(0, 2).toUpperCase()}
                        </div>
                    )}
                </div>
                <div className={`absolute -bottom-2 -right-2 h-10 w-10 rounded-full flex items-center justify-center border-4 border-white ${isFirst ? 'bg-yellow-400 text-yellow-900' : isSecond ? 'bg-slate-300 text-slate-700' : 'bg-orange-300 text-orange-800'}`}>
                    {badgeIcon}
                </div>
            </div>

            <h3 className="mt-4 text-xl font-black text-text uppercase italic leading-tight px-2 line-clamp-1">{worker.user_name}</h3>
            <p className={`text-2xl font-black mt-1 ${textColor}`}>+{worker.score} PTS</p>

            <div className="w-full mt-6 grid grid-cols-2 gap-3">
                <div className="bg-white/60 dark:bg-black/20 p-2 rounded-xl border border-black/5">
                    <p className="text-[9px] font-black text-muted uppercase tracking-tighter">TEMPRANO (+1)</p>
                    <p className="text-green-600 font-black">{worker.early_arrivals}</p>
                </div>
                <div className="bg-white/60 dark:bg-black/20 p-2 rounded-xl border border-black/5">
                    <p className="text-[9px] font-black text-muted uppercase tracking-tighter">TARDANZAS (-1)</p>
                    <p className="text-red-500 font-black">{worker.late_arrivals}</p>
                </div>
                <div className="bg-white/60 dark:bg-black/20 p-2 rounded-xl border border-black/5">
                    <p className="text-[9px] font-black text-muted uppercase tracking-tighter">AUSENCIAS (-1)</p>
                    <p className="text-red-700 font-black">{worker.absences}</p>
                </div>
                <div className="bg-white/60 dark:bg-black/20 p-2 rounded-xl border border-black/5">
                    <p className="text-[9px] font-black text-muted uppercase tracking-tighter">JUSTIFICACIÓN</p>
                    <p className="text-blue-600 font-black">{justifiedPct}%</p>
                </div>
            </div>

            <div className="w-full mt-4 pt-4 border-t border-black/5">
                <div className="flex justify-between items-center text-[9px] font-black uppercase mb-1 tracking-widest text-muted">
                    <span>MARCADO DE ASISTENCIA</span>
                    <span>{Math.min(100, attendanceRate)}%</span>
                </div>
                <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden">
                    <div className="h-full bg-[#e47c00]" style={{ width: `${Math.min(100, attendanceRate)}%` }}></div>
                </div>
                <p className="text-[8px] font-black uppercase text-primary mt-3 flex items-center justify-center gap-1 hover:underline">
                    VER DETALLE <ChevronRight size={10} />
                </p>
            </div>
        </div>
    );
};

const RankingListItem: React.FC<{ worker: PerformanceRecord; rank: number; onClick: () => void }> = ({ worker, rank, onClick }) => {
    const attendanceRate = Math.round((worker.marked_days / (worker.scheduled_days || 1)) * 100);
    
    return (
        <div 
            onClick={onClick}
            className="flex items-center justify-between p-5 hover:bg-surfaceHighlight/30 transition-all border-b border-surfaceHighlight last:border-none cursor-pointer group"
        >
            <div className="flex items-center gap-6">
                <span className="text-lg font-black text-muted/50 w-6 text-center">#{rank}</span>
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-surfaceHighlight overflow-hidden">
                        {worker.avatar_url ? (
                            <img src={worker.avatar_url} className="h-full w-full object-cover" />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center font-black text-xs text-muted">
                                {worker.user_name?.substring(0, 2).toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-text uppercase group-hover:text-primary transition-colors">{worker.user_name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="h-1.5 w-24 bg-surfaceHighlight rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, attendanceRate)}%` }}></div>
                            </div>
                            <span className="text-[9px] font-bold text-muted">{attendanceRate}% Asist.</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="text-right">
                <p className="text-[10px] font-black text-muted uppercase tracking-widest">PUNTOS</p>
                <p className="text-lg font-black text-text group-hover:scale-110 transition-transform origin-right">{worker.score}</p>
            </div>
        </div>
    );
};

const WorkerHistoryView: React.FC<{
    worker: PerformanceRecord;
    periods: AttendancePeriod[];
    onClose: () => void;
    onViewPeriod: (period: AttendancePeriod) => void;
    onDeletePeriod: (id: string) => void;
}> = ({ worker, periods, onClose, onViewPeriod, onDeletePeriod }) => {
    
    // Cálculo dinámico de efectividad (tope 100%)
    const totalScheduled = worker.scheduled_days || 1;
    const efficiency = Math.min(100, Math.round((worker.marked_days / totalScheduled) * 100));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-surface w-full max-w-3xl rounded-3xl border border-surfaceHighlight shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                
                {/* Header Profile Style */}
                <div className="p-8 border-b border-surfaceHighlight bg-background/50 flex flex-col md:flex-row justify-between items-start gap-6">
                    <div className="flex items-center gap-6">
                        <div className="h-20 w-20 rounded-2xl overflow-hidden border-2 border-primary/20 bg-background flex items-center justify-center shadow-lg relative">
                            {worker.avatar_url ? <img src={worker.avatar_url} className="h-full w-full object-cover" /> : <span className="font-black text-primary text-xl">{worker.user_name?.substring(0, 2).toUpperCase()}</span>}
                            <div className="absolute -bottom-2 -right-2 h-6 w-6 rounded-full bg-green-500 border-2 border-white"></div>
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-text uppercase italic tracking-tighter leading-none">{worker.user_name}</h3>
                            <p className="text-xs font-bold text-muted uppercase tracking-widest mt-1">Historial de Rendimiento</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-surfaceHighlight rounded-full text-muted transition-all absolute top-6 right-6"><X size={24}/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    {/* Tarjeta Dorada de Puntaje */}
                    <div className="bg-[#e47c00] text-white p-8 rounded-3xl shadow-xl shadow-orange-500/20 relative overflow-hidden flex flex-col justify-center min-h-[140px]">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-90 relative z-10">Puntaje Acumulado 2024</span>
                        <div className="flex items-baseline gap-2 relative z-10 mt-2">
                            <span className="text-6xl font-black italic tracking-tighter">{worker.score}</span>
                            <span className="text-xl font-bold opacity-80">pts</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-background border border-surfaceHighlight p-4 rounded-2xl">
                            <div className="flex items-center justify-between mb-2"><Activity className="text-green-500" size={16}/><span className="text-[10px] font-black text-green-600 uppercase">0 PTS</span></div>
                            <p className="text-[9px] font-black text-muted uppercase tracking-widest">Días Temprano</p>
                            <p className="text-2xl font-black text-text mt-1">{worker.early_arrivals}</p>
                        </div>
                        <div className="bg-background border border-surfaceHighlight p-4 rounded-2xl">
                            <div className="flex items-center justify-between mb-2"><Clock className="text-red-500" size={16}/><span className="text-[10px] font-black text-red-600 uppercase">0 PTS</span></div>
                            <p className="text-[9px] font-black text-muted uppercase tracking-widest">Tardanzas</p>
                            <p className="text-2xl font-black text-text mt-1">{worker.late_arrivals}</p>
                        </div>
                        <div className="bg-background border border-surfaceHighlight p-4 rounded-2xl">
                            <div className="flex items-center justify-between mb-2"><MinusCircle className="text-red-700" size={16}/><span className="text-[10px] font-black text-red-700 uppercase">0 PTS</span></div>
                            <p className="text-[9px] font-black text-muted uppercase tracking-widest">Ausencias</p>
                            <p className="text-2xl font-black text-text mt-1">{worker.absences}</p>
                        </div>
                        <div className="bg-background border border-surfaceHighlight p-4 rounded-2xl">
                            <div className="flex items-center justify-between mb-2"><CheckCircle2 className="text-blue-600" size={16}/><span className="text-[10px] font-black text-blue-600 uppercase">100%</span></div>
                            <p className="text-[9px] font-black text-muted uppercase tracking-widest">Efectividad</p>
                            <p className="text-2xl font-black text-text mt-1 italic">{worker.marked_days}d</p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="bg-background border border-surfaceHighlight p-6 rounded-3xl space-y-3">
                        <div className="flex justify-between items-end">
                            <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Efectividad de Marcado (Huellero)</p>
                            <p className="text-xs font-bold text-text uppercase">Actual: {worker.marked_days} / {totalScheduled} Días</p>
                        </div>
                        <div className="h-4 w-full bg-surfaceHighlight rounded-full overflow-hidden shadow-inner">
                            <div className="h-full bg-[#e47c00]" style={{ width: `${efficiency}%` }}></div>
                        </div>
                    </div>

                    {/* Historial Quincenal List */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <History size={20} className="text-[#e47c00]" />
                            <h3 className="text-lg font-black text-text uppercase italic tracking-tight">Historial Quincenal</h3>
                        </div>
                        
                        {periods.length === 0 ? (
                            <div className="text-center py-10 text-muted opacity-50 font-bold uppercase text-xs italic border-2 border-dashed border-surfaceHighlight rounded-2xl">Sin historial registrado</div>
                        ) : periods.map(period => (
                            <div key={period.id} className="bg-surface border border-surfaceHighlight rounded-2xl p-5 flex flex-col md:flex-row justify-between items-center gap-4 hover:border-[#e47c00]/50 transition-all shadow-sm group">
                                <div className="flex items-center gap-4 w-full md:w-auto">
                                    <div className="h-12 w-12 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center border border-orange-500/20">
                                        <CalendarDays size={24} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-muted uppercase tracking-widest">{period.period_label.split(' ').slice(0,2).join(' ')}</p>
                                        <h4 className="text-sm font-black text-text uppercase mt-0.5">{new Date(period.start_date).toLocaleDateString('es-AR')} al {new Date(period.end_date).toLocaleDateString('es-AR')}</h4>
                                    </div>
                                </div>
                                
                                <div className="flex gap-8 text-center">
                                    <div>
                                        <p className="text-[8px] font-black text-muted uppercase tracking-widest">Puntaje</p>
                                        <p className="text-lg font-black text-[#e47c00] italic">+{period.score_obtained} pts</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-muted uppercase tracking-widest">Días Trab.</p>
                                        <p className="text-lg font-black text-text">{period.days_worked}</p>
                                    </div>
                                </div>

                                <div className="flex gap-2 w-full md:w-auto">
                                    <button 
                                        onClick={() => onViewPeriod(period)}
                                        className="flex-1 md:flex-none px-6 py-3 bg-[#e47c00] hover:bg-[#cc6f00] text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-orange-500/20 transition-all active:scale-95"
                                    >
                                        Ver Detalles
                                    </button>
                                    <button 
                                        onClick={() => onDeletePeriod(period.id)}
                                        className="p-3 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const PeriodDetailView: React.FC<{ period: AttendancePeriod, onBack: () => void }> = ({ period, onBack }) => {
    // Calculamos el detalle financiero en tiempo de render para visualización
    const grossTotal = period.total_hours * period.hourly_rate;
    const penaltyDeduction = period.total_penalty_hours * period.hourly_rate;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-0 md:p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-background w-full md:max-w-6xl h-full md:h-[90vh] md:rounded-3xl border-none md:border border-surfaceHighlight shadow-2xl flex flex-col overflow-hidden relative">
                
                {/* Header */}
                <div className="p-6 md:p-8 border-b border-surfaceHighlight bg-surface flex justify-between items-start shrink-0">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black text-text uppercase italic tracking-tighter">Detalle de Auditoría y Liquidación</h2>
                        <p className="text-sm font-bold text-muted mt-1">Periodo: {new Date(period.start_date).toLocaleDateString()} - {new Date(period.end_date).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-3 rounded-xl border border-surfaceHighlight hover:bg-surfaceHighlight text-text font-bold text-xs uppercase transition-all shadow-sm">
                            <Printer size={16}/> Imprimir
                        </button>
                        <button onClick={onBack} className="px-6 py-3 bg-[#e47c00] hover:bg-[#cc6f00] text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-orange-500/20 transition-all active:scale-95">
                            Cerrar
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-background/50">
                    <div className="flex flex-col lg:flex-row gap-8 mb-8">
                        {/* Summary Cards */}
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-6 bg-surface border border-surfaceHighlight p-6 rounded-3xl shadow-sm">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black text-muted uppercase tracking-widest">Horas Trabajadas</span>
                                <span className="text-3xl font-black text-text tracking-tighter">{period.total_hours}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black text-muted uppercase tracking-widest">Multa (Hs)</span>
                                <span className="text-3xl font-black text-red-500 tracking-tighter">{period.total_penalty_hours}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black text-muted uppercase tracking-widest">Desc. Multas</span>
                                <span className="text-3xl font-black text-red-500 tracking-tighter">-$ {penaltyDeduction.toLocaleString()}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black text-muted uppercase tracking-widest">Tarifa x H</span>
                                <span className="text-3xl font-black text-text tracking-tighter">${period.hourly_rate}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black text-muted uppercase tracking-widest">Total Bruto</span>
                                <span className="text-3xl font-black text-text tracking-tighter">$ {grossTotal.toLocaleString()}</span>
                            </div>
                            <div className="mt-2 col-span-2 md:col-span-5 flex justify-start">
                                <span className="px-3 py-1 rounded-full bg-surfaceHighlight text-muted font-black text-[10px] uppercase border border-surfaceHighlight/50">
                                    {period.bonus_amount > 0 ? `Bono Aplicado: $${period.bonus_amount}` : 'Sin Bono'}
                                </span>
                            </div>
                        </div>

                        {/* Adjustments Panel */}
                        <div className="lg:w-80 bg-surface border border-surfaceHighlight p-6 rounded-3xl shadow-sm flex flex-col justify-center">
                            <h4 className="text-[10px] font-black text-[#e47c00] uppercase tracking-widest mb-4 flex items-center gap-2">
                                <PlusCircle size={12}/> Ajustes y Adicionales
                            </h4>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="bg-background border border-surfaceHighlight rounded-xl p-2">
                                    <p className="text-[8px] font-black text-muted uppercase">Extra</p>
                                    <p className="text-sm font-black text-green-600">{period.extra_amount}</p>
                                </div>
                                <div className="bg-background border border-surfaceHighlight rounded-xl p-2">
                                    <p className="text-[8px] font-black text-muted uppercase">Bono</p>
                                    <p className="text-sm font-black text-green-600">{period.bonus_amount}</p>
                                </div>
                                <div className="bg-background border border-surfaceHighlight rounded-xl p-2">
                                    <p className="text-[8px] font-black text-muted uppercase">Deuda</p>
                                    <p className="text-sm font-black text-red-500">{period.debt_amount}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Daily Table */}
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden shadow-sm mb-8">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-[800px]">
                                <thead className="bg-background/40 text-[9px] text-muted font-black uppercase tracking-widest border-b border-surfaceHighlight">
                                    <tr>
                                        <th className="p-4 pl-8">Fecha</th>
                                        <th className="p-4">Día</th>
                                        <th className="p-4">Entrada</th>
                                        <th className="p-4">Salida</th>
                                        <th className="p-4 text-center">Horas</th>
                                        <th className="p-4 text-center">Multa</th>
                                        <th className="p-4">Estado / Novedad</th>
                                        <th className="p-4 text-center w-10">F</th>
                                        <th className="p-4 text-center w-10">J</th>
                                        <th className="p-4 text-center w-10">NM</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surfaceHighlight text-xs font-medium">
                                    {(period.details as ParsedDay[]).map((day, idx) => (
                                        <tr key={idx} className="hover:bg-surfaceHighlight/10 transition-colors">
                                            <td className="p-4 pl-8 font-bold">{new Date(day.date + 'T12:00:00').toLocaleDateString('es-AR')}</td>
                                            <td className="p-4 font-bold text-blue-600">{day.dayName.substring(0,2)}</td>
                                            <td className="p-4">{day.entry || '--'}</td>
                                            <td className="p-4">{day.exit || '--'}</td>
                                            <td className="p-4 text-center font-black">{day.hours > 0 ? (day.hours).toFixed(2) : '-'}</td>
                                            <td className="p-4 text-center text-red-500 font-bold">{day.penaltyHours > 0 ? `-${day.penaltyHours} hs` : '-'}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border w-fit ${getStatusStyle(day.status)}`}>{day.status}</span>
                                            </td>
                                            <td className="p-4 text-center"><div className={`w-3 h-3 rounded-full mx-auto ${day.isFeriado ? 'bg-orange-500' : 'bg-surfaceHighlight'}`}/></td>
                                            <td className="p-4 text-center"><div className={`w-3 h-3 rounded-full mx-auto ${day.isJustified ? 'bg-blue-600' : 'bg-surfaceHighlight'}`}/></td>
                                            <td className="p-4 text-center"><div className={`w-3 h-3 rounded-full mx-auto ${day.isNoMark ? 'bg-red-500' : 'bg-surfaceHighlight'}`}/></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="bg-orange-50 border border-orange-100 p-6 rounded-3xl flex-1 flex flex-col justify-center">
                            <p className="text-[10px] font-black text-orange-800 uppercase tracking-widest">Días Trabajados</p>
                            <p className="text-3xl font-black text-orange-600 mt-1">{period.days_worked} <span className="text-lg opacity-60">/ 15</span></p>
                        </div>
                        <div className="bg-surface border border-surfaceHighlight p-6 rounded-3xl flex-1 flex flex-col justify-center">
                            <p className="text-[10px] font-black text-muted uppercase tracking-widest">Horas Auditadas</p>
                            <p className="text-3xl font-black text-[#e47c00] mt-1">100%</p>
                        </div>
                        <div className="flex-1 flex flex-col items-end justify-center text-right pt-4 md:pt-0">
                            <p className="text-xs font-black text-muted uppercase tracking-widest mb-1">Neto Final a Pagar</p>
                            <p className="text-5xl font-black text-green-600 tracking-tighter">$ {period.total_to_pay.toLocaleString()}</p>
                            <p className="text-[8px] text-muted font-bold uppercase mt-2 italic">Cálculo automático incluyendo multas y ajustes manuales.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SummaryItem: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
    <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">{label}</span>
        <span className={`text-xl font-black uppercase tracking-tighter ${color}`}>{value}</span>
    </div>
);

const RankingStat: React.FC<{ label: string; value: string | number; color: string }> = ({ label, value, color }) => (
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

const SedeBonusCard: React.FC<{ location: string; settings?: GlobalAttendanceSettings; onSave: () => void }> = ({ location, settings, onSave }) => {
    const [b1, setB1] = useState(settings?.bonus_1?.toString() || '0');
    const [b2, setB2] = useState(settings?.bonus_2?.toString() || '0');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (settings) {
            setB1(settings.bonus_1.toString());
            setB2(settings.bonus_2.toString());
        }
    }, [settings]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await supabase.from('attendance_settings').upsert({
                location,
                bonus_1: parseFloat(b1) || 0,
                bonus_2: parseFloat(b2) || 0
            });
            onSave();
        } catch (e) { console.error(e); } finally { setIsSaving(false); }
    };

    return (
        <div className="bg-surface border border-surfaceHighlight rounded-3xl p-8 shadow-sm">
            <h3 className="text-xl font-black text-text uppercase italic mb-6 border-b border-surfaceHighlight pb-2">{location}</h3>
            <div className="space-y-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-green-600 uppercase tracking-widest ml-1">Bono Excelencia (1)</label>
                    <input type="number" value={b1} onChange={e => setB1(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 px-5 text-lg font-black text-text outline-none focus:border-green-500 shadow-inner" />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1">Bono Cumplimiento (2)</label>
                    <input type="number" value={b2} onChange={e => setB2(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-2xl py-4 px-5 text-lg font-black text-text outline-none focus:border-blue-500 shadow-inner" />
                </div>
                <button onClick={handleSave} disabled={isSaving} className="w-full py-4 bg-primary text-white rounded-2xl font-black uppercase text-xs shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Guardar Valores
                </button>
            </div>
        </div>
    );
};
