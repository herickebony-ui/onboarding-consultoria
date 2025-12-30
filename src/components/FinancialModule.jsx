import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, doc, deleteDoc, updateDoc, addDoc,
  query, writeBatch, limit, serverTimestamp, onSnapshot, orderBy 
} from "firebase/firestore";
import { 
  Wallet, Users, TrendingUp, Search, 
  Plus, X, Filter, History,
  CheckCircle2, Eraser, Edit2, CalendarDays, RefreshCcw, CheckCircle
} from 'lucide-react';
import { db } from '../services/firebase';

// --- HELPERS VISUAIS (ESTILO NOTION) ---
const getMonthBadge = (dateStr) => {
    if (!dateStr) return { day: '--', name: '-', color: 'bg-gray-100 text-gray-400' };
    
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    
    const day = String(date.getDate()).padStart(2, '0');
    const monthIndex = date.getMonth();
    
    const months = [
        { name: 'JAN', color: 'bg-orange-100 text-orange-800 border-orange-200' },
        { name: 'FEV', color: 'bg-pink-100 text-pink-800 border-pink-200' },
        { name: 'MAR', color: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200' },
        { name: 'ABR', color: 'bg-purple-100 text-purple-800 border-purple-200' },
        { name: 'MAI', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
        { name: 'JUN', color: 'bg-blue-100 text-blue-800 border-blue-200' },
        { name: 'JUL', color: 'bg-sky-100 text-sky-800 border-sky-200' },
        { name: 'AGO', color: 'bg-teal-100 text-teal-800 border-teal-200' },
        { name: 'SET', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
        { name: 'OUT', color: 'bg-lime-100 text-lime-800 border-lime-200' },
        { name: 'NOV', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
        { name: 'DEZ', color: 'bg-slate-200 text-slate-800 border-slate-300' },
    ];

    return { day, ...months[monthIndex] };
};

// --- ENGINE DE DATAS ---
const getTodayISO = () => {
    const d = new Date();
    const z = n => ('0' + n).slice(-2);
    return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
};

const normalizeDate = (input) => {
    if (!input) return null;
    if (typeof input === "object" && typeof input.toDate === "function") {
        const d = input.toDate();
        const z = n => ('0' + n).slice(-2);
        return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
    }
    if (typeof input === "string") return input.slice(0, 10);
    return null;
};

const parseLocalMidnight = (isoDate) => {
    if (!isoDate) return null;
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
};

const isBetweenInclusive = (iso, start, end) => {
    if (!iso || !start || !end) return false;
    return iso >= start && iso <= end;
};

const formatDateBr = (dateStr) => {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
};

// Função inteligente para calcular data final
const addMonths = (dateStr, months) => {
    if (!dateStr) return '';
    const date = parseLocalMidnight(dateStr);
    date.setMonth(date.getMonth() + parseInt(months));
    const z = n => ('0' + n).slice(-2);
    return `${date.getFullYear()}-${z(date.getMonth()+1)}-${z(date.getDate())}`;
};

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

// --- LÓGICA DE STATUS ---
const getComputedStatus = (record, todayISO) => {
    if (record.status === 'Pausado') {
        return { label: 'PAUSADO', color: 'bg-black text-white border-gray-600', sortOrder: 0 };
    }

    const payDateStr = normalizeDate(record.payDate);
    const startDateStr = normalizeDate(record.startDate);
    const dueDateStr = normalizeDate(record.dueDate);
    const dToday = parseLocalMidnight(todayISO);
    
    // CASO 1: PAGOU MAS NÃO TEM DATA DE INÍCIO (Recém Lançado)
    if (payDateStr && !startDateStr) {
        return { label: 'PAGO E NÃO INICIADO', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', sortOrder: 1 };
    }

    // CASO 2: TEM VENCIMENTO DEFINIDO
    if (dueDateStr) {
        const dDue = parseLocalMidnight(dueDateStr);
        const diffTime = dToday.getTime() - dDue.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        if (diffDays > 30) return { label: 'INATIVO', color: 'bg-red-600 text-white border-red-700', sortOrder: 5 };
        if (diffDays > 0) return { label: 'VENCIDO', color: 'bg-[#850000] text-white border-red-900', sortOrder: 4 }; 
        if (dToday.getMonth() === dDue.getMonth() && dToday.getFullYear() === dDue.getFullYear()) {
            return { label: 'RENOVA ESSE MÊS', color: 'bg-orange-100 text-orange-800 border-orange-300', sortOrder: 3 };
        }
        return { label: 'ATIVO', color: 'bg-green-100 text-green-800 border-green-300', sortOrder: 6 };
    }

    // CASO 3: SEM DATA E SEM PAGAMENTO
    return { label: 'PENDENTE', color: 'bg-gray-100 text-gray-500', sortOrder: 9 };
};

// --- SERVIÇOS ---
const FinancialService = {
    async createContractWithInstallments(baseData, installmentsData) {
        const batch = writeBatch(db);
        installmentsData.forEach(inst => {
            const recordRef = doc(collection(db, 'payments'));
            batch.set(recordRef, { ...inst, payDate: normalizeDate(inst.payDate), createdAt: serverTimestamp() });
        });
        await batch.commit();
    },
    async updateRecord(recordId, data) {
        const ref = doc(db, 'payments', recordId);
        return updateDoc(ref, { ...data, payDate: normalizeDate(data.payDate) });
    },
    async deleteRecord(recordId) {
        return deleteDoc(doc(db, 'payments', recordId));
    },
    async settlePayment(recordId, payDate) {
        const ref = doc(db, 'payments', recordId);
        return updateDoc(ref, { payDate: normalizeDate(payDate) });
    },
    async createPlan(data) {
        return addDoc(collection(db, 'plans'), data);
    },
    async deletePlan(planId) {
        return deleteDoc(doc(db, 'plans', planId));
    }
};

const DashboardCard = ({ title, value, subtext, icon: Icon, colorClass = "bg-white", textClass="text-slate-800" }) => (
    <div className={`${colorClass} p-6 rounded-xl shadow-sm border border-slate-200 flex items-start justify-between relative overflow-hidden`}>
        <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">{title}</p>
            <h3 className={`text-2xl font-black ${textClass}`}>{value}</h3>
            {subtext && <p className="text-[10px] opacity-60 mt-1">{subtext}</p>}
        </div>
        <div className="p-3 bg-black/5 rounded-lg">
            <Icon size={20} className={textClass} />
        </div>
    </div>
);

// --- COMPONENTE PRINCIPAL ---
export default function FinancialModule({ students }) {
    const [todayISO] = useState(getTodayISO());
    const [records, setRecords] = useState([]); 
    const [loading, setLoading] = useState(true);

    // Estados de Planos
    const [plans, setPlans] = useState([]);
    const [planModalOpen, setPlanModalOpen] = useState(false);

    // Range de Datas (Padrão)
    const [dateRange, setDateRange] = useState(() => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const z = n => ('0' + n).slice(-2);
        return { 
            start: `${firstDay.getFullYear()}-${z(firstDay.getMonth()+1)}-${z(firstDay.getDate())}`, 
            end: `${lastDay.getFullYear()}-${z(lastDay.getMonth()+1)}-${z(lastDay.getDate())}` 
        };
    });
    
    const [filters, setFilters] = useState({ search: '', status: 'all' });

    // Carga de Dados
    useEffect(() => {
        const qRec = query(collection(db, 'payments'), limit(3000));
        const unsubRec = onSnapshot(qRec, (s) => {
            setRecords(s.docs.map(d => ({ id: d.id, ...d.data(), payDate: normalizeDate(d.data().payDate) })));
            setLoading(false);
        });

        const qPlans = query(collection(db, 'plans'), orderBy('name'));
        const unsubPlans = onSnapshot(qPlans, (s) => {
            setPlans(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => { unsubRec(); unsubPlans(); };
    }, []);

    const studentsMap = useMemo(() => students.reduce((acc, s) => ({...acc, [s.id]: s}), {}), [students]);

    // KPI ENGINE
    const stats = useMemo(() => {
        let revenueReal = 0;      
        let forecast = 0;
        let expiredInRange = 0;
        let renewedInRange = 0;
        const activeStudentIds = new Set();
        
        records.forEach(r => {
            const computed = getComputedStatus(r, todayISO); 
            const value = parseFloat(r.netValue) || 0;
            const payISO = normalizeDate(r.payDate);
            const dueISO = normalizeDate(r.dueDate);

            if (payISO && isBetweenInclusive(payISO, dateRange.start, dateRange.end)) revenueReal += value;
            if (dueISO && isBetweenInclusive(dueISO, dateRange.start, dateRange.end)) {
                if (!payISO || isBetweenInclusive(payISO, dateRange.start, dateRange.end)) {
                     if (computed.label !== 'INATIVO' && computed.label !== 'PAUSADO') forecast += value;
                }
            }
            if (['ATIVO', 'PAGO E NÃO INICIADO', 'RENOVA ESSE MÊS'].includes(computed.label)) {
                if (r.studentId) activeStudentIds.add(r.studentId);
            }
            if (dueISO && isBetweenInclusive(dueISO, dateRange.start, dateRange.end)) {
                expiredInRange++;
                if (payISO) renewedInRange++;
            }
        });
        const retentionRate = expiredInRange > 0 ? Math.round((renewedInRange / expiredInRange) * 100) : 100;
        return { revenueReal, forecast, active: activeStudentIds.size, retention: retentionRate };
    }, [records, dateRange, todayISO]);

    // FILTRAGEM
    const filteredRecords = useMemo(() => records.filter(r => {
        const sName = studentsMap[r.studentId]?.name || r.studentName || '';
        if (!sName.toLowerCase().includes(filters.search.toLowerCase())) return false;

        const dueISO = normalizeDate(r.dueDate);
        const payISO = normalizeDate(r.payDate);
        // Regra: Mostra se Venceu OU Pagou no período
        const isDue = dueISO && isBetweenInclusive(dueISO, dateRange.start, dateRange.end);
        const isPaid = payISO && isBetweenInclusive(payISO, dateRange.start, dateRange.end);
        
        if (!isDue && !isPaid) return false;

        const computed = getComputedStatus(r, todayISO);
        if (filters.status !== 'all' && filters.status !== computed.label) return false;

        return true;
    }).sort((a, b) => normalizeDate(a.dueDate) > normalizeDate(b.dueDate) ? 1 : -1), 
    [records, filters, studentsMap, dateRange, todayISO]);

    // MODAIS
    const [modalOpen, setModalOpen] = useState(false);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    
    const [currentRecord, setCurrentRecord] = useState(null);
    const [selectedStudentHistory, setSelectedStudentHistory] = useState(null);
    const [formData, setFormData] = useState({});

    // INTELIGÊNCIA DE SELEÇÃO DE PLANO
    const handleSelectPlan = (planId) => {
        const plan = plans.find(p => p.id === planId);
        if (plan) {
            setFormData(prev => ({
                ...prev,
                planType: plan.name,
                paymentMethod: plan.paymentMethod,
                grossValue: plan.grossValue,
                netValue: plan.netValue,
                durationMonths: plan.durationMonths, // Salva a duração para usar depois
                status: 'PAGO E NÃO INICIADO', // Regra de Ouro
                payDate: todayISO,
                startDate: '', // Limpo de propósito
                dueDate: ''    // Limpo de propósito
            }));
        }
    };

    // INTELIGÊNCIA DE DATA FINAL
    const handleStartDateChange = (e) => {
        const newStart = e.target.value;
        let newDue = formData.dueDate;

        // Se tiver duração salva, calcula o vencimento sozinho
        if (formData.durationMonths) {
            newDue = addMonths(newStart, formData.durationMonths);
        }

        setFormData(prev => ({
            ...prev,
            startDate: newStart,
            dueDate: newDue
        }));
    };

    const openModal = (record = null) => {
        setCurrentRecord(record);
        if (record) {
            setFormData({ ...record, payDate: normalizeDate(record.payDate) || '' });
        } else {
            setFormData({ studentId: '', studentName: '', planType: 'Mensal', paymentMethod: 'Pix', startDate: '', dueDate: '', payDate: '', grossValue: '', netValue: '', status: 'Ativo', installments: 1, notes: '' });
        }
        setModalOpen(true);
    };

    const openHistory = (studentId) => {
        const student = studentsMap[studentId];
        const history = records.filter(r => r.studentId === studentId).sort((a,b) => normalizeDate(b.payDate || b.dueDate) > normalizeDate(a.payDate || a.dueDate) ? -1 : 1);
        setSelectedStudentHistory({ student, history });
        setHistoryModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const sId = formData.studentId;
        const sName = studentsMap[sId]?.name || "Aluno Desconhecido";
        const baseData = {
            studentId: sId, studentName: sName,
            planType: formData.planType, paymentMethod: formData.paymentMethod,
            grossValue: parseFloat(formData.grossValue), netValue: parseFloat(formData.netValue),
            status: formData.status, startDate: formData.startDate, endDate: formData.dueDate,
            dueDate: formData.dueDate, payDate: formData.payDate || null, notes: formData.notes || ''
        };
        try {
            if (currentRecord) await FinancialService.updateRecord(currentRecord.id, baseData);
            else {
                const qtd = parseInt(formData.installments);
                if (qtd > 1) {
                    // Se parcelar, aqui precisaria de uma lógica mais complexa para as datas.
                    // Por enquanto, duplica os meses.
                    const inst = [];
                    for(let i=0; i<qtd; i++) inst.push({ ...baseData, startDate: addMonths(baseData.startDate, i), dueDate: addMonths(baseData.dueDate, i), notes: `${baseData.notes} (${i+1}/${qtd})` });
                    await FinancialService.createContractWithInstallments(baseData, inst);
                } else await FinancialService.createContractWithInstallments(baseData, [baseData]);
            }
            setModalOpen(false);
        } catch (err) { alert(err.message); }
    };

    const handleSettle = async (record) => {
        if (!window.confirm("Confirmar baixa no pagamento?")) return;
        await FinancialService.settlePayment(record.id, todayISO);
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando financeiro...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 font-sans">
            {/* CARDS KPI */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <DashboardCard title="Alunos Ativos" value={stats.active} icon={Users} subtext="Total na base" />
                <DashboardCard title="Faturamento Líquido" value={formatCurrency(stats.revenueReal)} icon={Wallet} colorClass="bg-green-50 border-green-200" textClass="text-green-800" subtext="Recebido no período" />
                <DashboardCard title="Previsão (Forecast)" value={formatCurrency(stats.forecast)} icon={TrendingUp} subtext="Vence no período" />
                <DashboardCard title="Taxa de Retenção" value={`${stats.retention}%`} icon={CheckCircle} subtext="Renovações / Vencimentos" />
            </div>

            {/* BARRA DE FERRAMENTAS */}
            <div className="flex flex-col md:flex-row justify-between gap-4 items-end bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200 w-full md:w-auto">
                    <CalendarDays size={18} className="text-gray-400 ml-2" />
                    <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="text-sm outline-none bg-transparent font-medium text-gray-700" />
                    <span className="text-gray-300">➜</span>
                    <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="text-sm outline-none bg-transparent font-medium text-gray-700" />
                </div>
                <div className="flex-1 flex gap-2 w-full">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input placeholder="Buscar aluno..." value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:border-black outline-none transition-colors" />
                    </div>
                    <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="px-4 py-2 rounded-lg border border-gray-200 outline-none bg-white text-sm font-bold">
                        <option value="all">Todos Status</option>
                        <option value="ATIVO">🟢 Ativo</option>
                        <option value="RENOVA ESSE MÊS">🟠 Renova Mês</option>
                        <option value="PAGO E NÃO INICIADO">🟡 Pago e Não Iniciado</option>
                        <option value="PAUSADO">⚫ Pausado</option>
                        <option value="VENCIDO">🟤 Vencido</option>
                        <option value="INATIVO">🔴 Inativo</option>
                    </select>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setPlanModalOpen(true)} className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-50 text-sm transition-colors"><TrendingUp size={16}/> Planos</button>
                    <button onClick={() => openModal()} className="bg-black text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:bg-gray-800 transition-transform active:scale-95 whitespace-nowrap"><Plus size={18} /> Lançar</button>
                </div>
            </div>

            {/* TABELA VISUAL NOTION */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead><tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-200"><th className="p-4">Aluno</th><th className="p-4">Status</th><th className="p-4">Vencimento</th><th className="p-4">Plano / Forma</th><th className="p-4">Valor Líquido</th><th className="p-4 text-right">Ações</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredRecords.length === 0 ? (<tr><td colSpan="6" className="p-12 text-center text-gray-400 flex flex-col items-center gap-2"><Filter size={32} className="opacity-20"/><p>Nenhum registro no período.</p></td></tr>) : filteredRecords.map(r => {
                            const status = getComputedStatus(r, todayISO);
                            const sName = studentsMap[r.studentId]?.name || r.studentName;
                            const badge = getMonthBadge(r.dueDate); // Visual Notion

                            return (
                                <tr key={r.id} className="hover:bg-gray-50 group transition-colors">
                                    <td className="p-4 cursor-pointer" onClick={() => openHistory(r.studentId)}>
                                        <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors flex items-center gap-2">{sName} <History size={12} className="opacity-0 group-hover:opacity-100"/></div>
                                        {r.notes && <div className="text-[10px] text-gray-400 mt-1 max-w-[150px] truncate">{r.notes}</div>}
                                    </td>
                                    <td className="p-4"><span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide border ${status.color}`}>{status.label}</span></td>
                                    
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl font-black text-gray-300 w-6 text-center">{badge.day}</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge.color}`}>{badge.name}</span>
                                        </div>
                                    </td>

                                    <td className="p-4">
                                        <div className="font-bold text-gray-700 text-xs">{r.planType}</div>
                                        <div className="text-[10px] text-gray-400 uppercase tracking-wide bg-gray-100 px-1.5 py-0.5 rounded inline-block mt-1">{r.paymentMethod}</div>
                                    </td>
                                    
                                    <td className="p-4">
                                        <div className="font-mono font-bold text-gray-800">{formatCurrency(r.netValue)}</div>
                                        {r.payDate && <div className="text-[10px] text-green-600 font-bold mt-0.5 flex items-center gap-1"><CheckCircle2 size={10}/> Pago: {formatDateBr(r.payDate)}</div>}
                                    </td>

                                    <td className="p-4 text-right flex justify-end gap-2">
                                        {!r.payDate && <button onClick={() => handleSettle(r)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg border border-transparent hover:border-green-200 transition-all" title="Confirmar Pagamento"><CheckCircle2 size={18}/></button>}
                                        <button onClick={() => openModal(r)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-200 transition-all"><Edit2 size={18} /></button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            {/* MODAL PLANOS */}
            {planModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center"><h3 className="font-bold text-gray-800">Gerenciar Planos</h3><button onClick={() => setPlanModalOpen(false)}><X size={20} className="text-gray-400"/></button></div>
                        <div className="p-4 max-h-[300px] overflow-y-auto space-y-2">
                            {plans.map(p => (
                                <div key={p.id} className="flex justify-between items-center p-3 border rounded-lg bg-white shadow-sm">
                                    <div><div className="font-bold text-sm text-gray-800">{p.name}</div><div className="text-xs text-gray-500">{p.durationMonths} meses • Liq: {formatCurrency(p.netValue)}</div></div>
                                    <button onClick={() => { if(window.confirm("Excluir plano?")) FinancialService.deletePlan(p.id) }} className="text-red-300 hover:text-red-600 p-2"><X size={16}/></button>
                                </div>
                            ))}
                            {plans.length === 0 && <p className="text-center text-xs text-gray-400 py-4">Nenhum plano cadastrado.</p>}
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.target);
                            FinancialService.createPlan({
                                name: f.get('name'), 
                                durationMonths: parseInt(f.get('duration')),
                                paymentMethod: f.get('method'),
                                grossValue: parseFloat(f.get('gross')), 
                                netValue: parseFloat(f.get('net'))
                            });
                            e.target.reset();
                        }} className="p-4 bg-gray-50 border-t space-y-3">
                            <div className="grid grid-cols-3 gap-2">
                                <input name="name" placeholder="Nome" className="col-span-2 w-full p-2 text-sm border rounded" required />
                                <input name="duration" type="number" placeholder="Meses" className="w-full p-2 text-sm border rounded" required />
                            </div>
                            <select name="method" className="w-full p-2 text-sm border rounded"><option value="Pix">Pix</option><option value="Cartão">Cartão</option></select>
                            <div className="grid grid-cols-2 gap-2">
                                <input name="gross" type="number" step="0.01" placeholder="Bruto" className="p-2 text-sm border rounded" required />
                                <input name="net" type="number" step="0.01" placeholder="Líquido" className="p-2 text-sm border rounded" required />
                            </div>
                            <button className="w-full bg-black text-white py-2 rounded text-sm font-bold shadow-md hover:bg-gray-800">Adicionar Plano</button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL EDIÇÃO */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl"><h2 className="text-lg font-bold text-gray-800">{currentRecord ? 'Editar Lançamento' : 'Novo Lançamento'}</h2><button onClick={() => setModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full"><X size={20} className="text-gray-500"/></button></div>
                        <form onSubmit={handleSave} className="p-6 space-y-5">
                            
                            {!currentRecord && (
                                <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                                    <label className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1 block">⚡ Preenchimento Rápido</label>
                                    <select onChange={(e) => handleSelectPlan(e.target.value)} className="w-full p-2 bg-white border border-blue-200 rounded-md text-sm text-gray-700 font-medium outline-none cursor-pointer hover:border-blue-400 transition-colors">
                                        <option value="">-- Selecione um Plano --</option>
                                        {plans.map(p => <option key={p.id} value={p.id}>{p.name} ({p.durationMonths} meses)</option>)}
                                    </select>
                                </div>
                            )}

                            <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Aluno</label><select value={formData.studentId} onChange={e => setFormData({...formData, studentId: e.target.value})} disabled={!!currentRecord} className="w-full p-3 border border-gray-200 rounded-lg bg-white font-medium focus:border-black outline-none" required><option value="">Selecione...</option>{students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Plano (Nome)</label><input value={formData.planType} onChange={e => setFormData({...formData, planType: e.target.value})} className="w-full p-3 border border-gray-200 rounded-lg text-sm" required /></div>
                                <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Método</label><select value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})} className="w-full p-3 border border-gray-200 rounded-lg bg-white text-sm"><option value="Pix">Pix</option><option value="Cartão">Cartão</option><option value="Dinheiro">Dinheiro</option></select></div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Valor Bruto</label><input type="number" step="0.01" value={formData.grossValue} onChange={e => setFormData({...formData, grossValue: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg text-sm" placeholder="R$ 0,00" required /></div>
                                <div><label className="text-[10px] font-bold text-green-700 uppercase block mb-1">Líquido (Recebido)</label><input type="number" step="0.01" value={formData.netValue} onChange={e => setFormData({...formData, netValue: e.target.value})} className="w-full p-2 border border-green-200 rounded-lg text-sm font-bold text-green-800" placeholder="R$ 0,00" required /></div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Início (Previsão)</label><input type="date" value={formData.startDate} onChange={handleStartDateChange} className="w-full p-2 border rounded-lg text-sm bg-white" /></div>
                                <div><label className="text-[10px] font-bold text-red-800 uppercase block mb-1">Fim (Vencimento)</label><input type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} className="w-full p-2 border border-red-200 rounded-lg text-sm font-semibold bg-white text-red-900" /></div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Status Atual</label>
                                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className={`w-full p-3 border rounded-lg bg-white text-sm font-bold ${formData.status === 'PAGO E NÃO INICIADO' ? 'bg-yellow-50 text-yellow-800 border-yellow-200' : 'border-gray-200'}`}>
                                        <option value="PAGO E NÃO INICIADO">🟡 Pago e Não Iniciado</option>
                                        <option value="ATIVO">🟢 Ativo (Vigendo)</option>
                                        <option value="PAUSADO">⚫ Pausado</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1 flex items-center gap-1"><CheckCircle2 size={12}/> Data Pagamento</label>
                                    <div className="flex items-center gap-2">
                                        <input type="date" value={formData.payDate} onChange={e => setFormData({...formData, payDate: e.target.value})} className="w-full p-2.5 border border-green-200 bg-green-50/50 rounded-lg outline-none text-sm font-bold text-green-800" />
                                        {formData.payDate && (<button type="button" onClick={() => setFormData({...formData, payDate: ''})} className="p-2 text-red-500 hover:bg-red-50 rounded border border-red-200 transition-colors" title="Limpar Pagamento"><Eraser size={16} /></button>)}
                                    </div>
                                </div>
                            </div>

                            <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Observações</label><textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full p-3 border border-gray-200 rounded-lg text-sm" rows="2"></textarea></div>
                            
                            <div className="flex gap-3 pt-4 border-t border-gray-100">
                                {currentRecord && <button type="button" onClick={() => { if(window.confirm("Apagar registro?")) FinancialService.deleteRecord(currentRecord.id).then(() => setModalOpen(false)) }} className="px-4 py-3 text-red-600 font-bold hover:bg-red-50 rounded-xl text-sm transition-colors">Excluir</button>}
                                <button type="button" onClick={() => setModalOpen(false)} className="ml-auto px-6 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl text-sm transition-colors">Cancelar</button>
                                <button type="submit" className="px-8 py-3 bg-black text-white font-bold rounded-xl shadow-lg hover:bg-gray-800 transition-transform active:scale-95 text-sm">Salvar Registro</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL HISTÓRICO LTV */}
            {historyModalOpen && selectedStudentHistory && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
                        <div className="p-6 bg-black text-white flex justify-between items-start"><div><h2 className="text-2xl font-bold">{selectedStudentHistory.student?.name}</h2><p className="text-gray-400 text-sm mt-1">LTV (Lifetime Value) - Histórico de Pagamentos</p></div><button onClick={() => setHistoryModalOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"><X size={20} className="text-white"/></button></div>
                        <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-around text-center"><div><p className="text-[10px] font-bold uppercase text-gray-400">Total Pago (Líquido)</p><p className="text-xl font-black text-green-700">{formatCurrency(selectedStudentHistory.history.reduce((acc, curr) => acc + (curr.payDate ? parseFloat(curr.netValue||0) : 0), 0))}</p></div></div>
                        <div className="flex-1 overflow-y-auto p-0"><table className="w-full text-left"><thead className="sticky top-0 bg-gray-100 border-b border-gray-200 shadow-sm z-10"><tr><th className="p-4 text-[10px] font-black uppercase text-gray-500">Data Pagamento</th><th className="p-4 text-[10px] font-black uppercase text-gray-500">Referência</th><th className="p-4 text-[10px] font-black uppercase text-gray-500">Líquido</th><th className="p-4 text-[10px] font-black uppercase text-gray-500 text-right">Venc. Original</th></tr></thead><tbody className="divide-y divide-gray-100">{selectedStudentHistory.history.map(h => { return (<tr key={h.id} className="hover:bg-gray-50"><td className="p-4">{h.payDate ? <span className="font-bold text-green-700">{formatDateBr(h.payDate)}</span> : <span className="text-xs text-gray-400 italic">Pendente</span>}</td><td className="p-4"><div className="font-bold text-gray-800">{h.planType}</div><div className="text-xs text-gray-400">{h.paymentMethod}</div></td><td className="p-4 font-mono font-bold text-gray-700">{formatCurrency(h.netValue)}</td><td className="p-4 text-right text-xs text-gray-400">{formatDateBr(h.dueDate)}</td></tr>) })}</tbody></table></div>
                    </div>
                </div>
            )}
        </div>
    );
}