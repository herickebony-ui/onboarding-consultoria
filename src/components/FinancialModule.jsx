import React, { useState, useEffect, useMemo } from 'react';
import { 
    collection, doc, deleteDoc, updateDoc, addDoc,
    query, writeBatch, limit, serverTimestamp, onSnapshot, orderBy,
    where, getDocs // <--- ADICIONE ESTES DOIS SE NÃO TIVER
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
    async updatePlan(planId, data) {
        const ref = doc(db, 'plans', planId);
        return updateDoc(ref, data);
    },
    // --- TRAVA DE SEGURANÇA: Só exclui se ninguém usar ---
    async deletePlan(planId, planName) {
        // 1. Verifica se existe algum pagamento usando esse nome de plano
        const q = query(collection(db, 'payments'), where('planType', '==', planName), limit(1));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            // Se achou pelo menos 1, bloqueia e avisa
            throw new Error(`BLOQUEADO: O plano "${planName}" não pode ser excluído pois existem registros financeiros vinculados a ele. Edite o nome ou o status, mas não exclua.`);
        }

        // 2. Se estiver limpo, manda bala
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
    const [editingPlan, setEditingPlan] = useState(null);

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

        const qPlans = query(collection(db, 'plans'));
        const unsubPlans = onSnapshot(qPlans, (s) => {
            // Ordenação manual no Front-end (mais seguro para evitar erros de índice no Firebase)
            const sortedPlans = s.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => a.name.localeCompare(b.name));
            setPlans(sortedPlans);
        });

        return () => { unsubRec(); unsubPlans(); };
    }, []);

    const studentsMap = useMemo(() => students.reduce((acc, s) => ({...acc, [s.id]: s}), {}), [students]);

    // --- KPI ENGINE (INTELIGÊNCIA TEMPORAL CORRIGIDA) ---
    const stats = useMemo(() => {
        let revenueReal = 0;      
        let forecast = 0;
        let expiredInRange = 0;
        let renewedInRange = 0;
        const activeStudentIds = new Set(); // Conjunto para não contar aluno duplicado
        
        records.forEach(r => {
            // Regra 1: Pausado não conta como Ativo (não consome energia)
            if (r.status === 'Pausado') return;

            const value = parseFloat(r.netValue) || 0;
            const payISO = normalizeDate(r.payDate);
            const dueISO = normalizeDate(r.dueDate);
            const startISO = normalizeDate(r.startDate);

            // 1. Faturamento Real: Entrou dinheiro no período?
            if (payISO && isBetweenInclusive(payISO, dateRange.start, dateRange.end)) {
                revenueReal += value;
            }

            // 2. Previsão: Vence no período?
            if (dueISO && isBetweenInclusive(dueISO, dateRange.start, dateRange.end)) {
                if (!payISO || isBetweenInclusive(payISO, dateRange.start, dateRange.end)) {
                     forecast += value;
                }
            }

            // 3. ALUNOS ATIVOS (Máquina do Tempo)
            // A. Contrato estava vigente durante o período do filtro?
            const isVigente = startISO && dueISO && 
                              startISO <= dateRange.end && 
                              dueISO >= dateRange.start;

            // B. Estava em Onboarding? (Pagou DENTRO ou ANTES do período, e ainda não tinha data de início ou começou depois)
            const isOnboarding = payISO && !startISO && 
                                 payISO <= dateRange.end;

            if ((isVigente || isOnboarding) && r.studentId) {
                activeStudentIds.add(r.studentId);
            }

            // 4. Retenção
            if (dueISO && isBetweenInclusive(dueISO, dateRange.start, dateRange.end)) {
                expiredInRange++;
                if (payISO) renewedInRange++;
            }
        });

        const retentionRate = expiredInRange > 0 ? Math.round((renewedInRange / expiredInRange) * 100) : 100;
        return { revenueReal, forecast, active: activeStudentIds.size, retention: retentionRate };
    }, [records, dateRange]);

    // FILTRAGEM (COM LÓGICA DE VIGÊNCIA)
    const filteredRecords = useMemo(() => records.filter(r => {
        // 1. Filtro de Texto (Nome)
        const sName = studentsMap[r.studentId]?.name || r.studentName || '';
        if (!sName.toLowerCase().includes(filters.search.toLowerCase())) return false;

        // 2. Datas Relevantes
        const dueISO = normalizeDate(r.dueDate);
        const payISO = normalizeDate(r.payDate);
        const startISO = normalizeDate(r.startDate);

        // A. Aconteceu algo financeiro? (Pagou ou Venceu no período selecionado)
        const isFinancialEvent = (dueISO && isBetweenInclusive(dueISO, dateRange.start, dateRange.end)) ||
                                 (payISO && isBetweenInclusive(payISO, dateRange.start, dateRange.end));

        // B. O contrato está "Vigente" (Ativo) durante esse período?
        // Lógica: (Início do contrato <= Fim do Filtro) E (Fim do contrato >= Início do Filtro)
        const isActiveInRange = startISO && dueISO &&
                                (startISO <= dateRange.end) && 
                                (dueISO >= dateRange.start);
        
        // REGRA FINAL: Mostra se teve evento financeiro OU se está vigente no período
        if (!isFinancialEvent && !isActiveInRange) return false;

        // 3. Filtro de Status (Dropdown)
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

    // INTELIGÊNCIA DE DATA FINAL E STATUS
    const handleStartDateChange = (e) => {
        const newStart = e.target.value;
        let newDue = formData.dueDate;
        let newStatus = formData.status;

        // 1. Se tiver duração salva, calcula o vencimento sozinho
        if (formData.durationMonths) {
            newDue = addMonths(newStart, formData.durationMonths);
        }

        // 2. Se preencheu a data de início, já muda o status para ATIVO automaticamente
        if (newStart) {
            newStatus = 'ATIVO';
        }

        setFormData(prev => ({
            ...prev,
            startDate: newStart,
            dueDate: newDue,
            status: newStatus // Atualiza o dropdown visualmente
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
            durationMonths: formData.durationMonths || null, // <--- A MEMÓRIA DA DURAÇÃO
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
                                        {/* NOVO: Data de Início Pequena */}
                                        <div className="text-[10px] text-gray-400 mb-1 font-medium">
                                            Início: {formatDateBr(r.startDate)}
                                        </div>

                                        {/* VISUAL NOTION (Mantido) */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl font-black text-gray-300 w-6 text-center">{badge.day}</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge.color}`}>{badge.name}</span>
                                        </div>
                                    </td>

                                    <td className="p-4">
                                        {/* O fundo colorido agora vem do banco de dados */}
                                        <div className={`font-bold text-xs inline-block px-2 py-0.5 rounded border 
                                            ${plans.find(p => p.name === r.planType)?.color === 'green' ? 'bg-green-100 text-green-800 border-green-200' : 
                                            plans.find(p => p.name === r.planType)?.color === 'yellow' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                            'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                            {r.planType}
                                        </div>
                                        <div className="text-[10px] text-gray-400 uppercase tracking-wide block mt-1">{r.paymentMethod}</div>
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
            
            {/* MODAL DE GERENCIAR PLANOS (COM EDIÇÃO E CORES) */}
            {planModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                        
                        {/* Cabeçalho */}
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">Gerenciar Planos</h3>
                            <button onClick={() => { setPlanModalOpen(false); setEditingPlan(null); }}><X size={20} className="text-gray-400"/></button>
                        </div>

                        {/* Lista de Planos Existentes */}
                        <div className="p-4 max-h-[300px] overflow-y-auto space-y-2 bg-gray-50/50">
                            {plans.sort((a,b) => a.name.localeCompare(b.name)).map(p => (
                                <div key={p.id} className={`flex justify-between items-center p-3 border rounded-lg bg-white shadow-sm hover:border-black transition-colors ${editingPlan?.id === p.id ? 'ring-2 ring-black border-transparent' : ''}`}>
                                    <div className="flex items-center gap-3">
                                        {/* Bolinha da Cor */}
                                        <div className={`w-3 h-3 rounded-full bg-${p.color || 'gray'}-400`}></div>
                                        <div>
                                            <div className="font-bold text-sm text-gray-800">{p.name}</div>
                                            <div className="text-xs text-gray-500">{p.durationMonths} meses • Liq: {formatCurrency(p.netValue)}</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        {/* Botão Editar (Mantido) */}
                                        <button onClick={() => setEditingPlan(p)} className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Editar"><Edit2 size={16}/></button>
                                        
                                        {/* Botão Excluir (COM A NOVA TRAVA DE SEGURANÇA) */}
                                        <button onClick={async () => { 
                                            if(window.confirm(`Tem certeza que deseja excluir o plano "${p.name}"?`)) {
                                                try {
                                                    // Passa ID e Nome para verificar antes de apagar
                                                    await FinancialService.deletePlan(p.id, p.name); 
                                                } catch (error) {
                                                    // Se der erro (estiver em uso), mostra o alerta
                                                    alert(error.message); 
                                                }
                                            }
                                        }} className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded" title="Excluir">
                                            <X size={16}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {plans.length === 0 && <p className="text-center text-xs text-gray-400 py-4">Nenhum plano cadastrado.</p>}
                        </div>

                        {/* Formulário de Cadastro/Edição */}
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            const f = new FormData(e.target);
                            const planData = {
                                name: f.get('name'), 
                                durationMonths: parseInt(f.get('duration')),
                                paymentMethod: f.get('method'),
                                grossValue: parseFloat(f.get('gross')), 
                                netValue: parseFloat(f.get('net')),
                                color: f.get('color') // Salva a cor escolhida
                            };

                            if (editingPlan) {
                                await FinancialService.updatePlan(editingPlan.id, planData);
                                setEditingPlan(null); // Sai do modo edição
                            } else {
                                await FinancialService.createPlan(planData);
                            }
                            e.target.reset();
                        }} className="p-5 bg-white border-t border-gray-100 space-y-3 shadow-[0_-5px_15px_rgba(0,0,0,0.02)] relative z-10">
                            
                            {/* Aviso de Edição */}
                            {editingPlan && <div className="text-xs font-bold text-blue-600 mb-2 flex justify-between"><span>✏️ Editando: {editingPlan.name}</span> <button type="button" onClick={() => setEditingPlan(null)} className="underline text-gray-400 font-normal">Cancelar</button></div>}

                            <div className="grid grid-cols-3 gap-2">
                                <input name="name" defaultValue={editingPlan?.name} placeholder="Nome do Plano" className="col-span-2 w-full p-2 text-sm border border-gray-200 rounded focus:border-black outline-none" required />
                                <input name="duration" type="number" defaultValue={editingPlan?.durationMonths} placeholder="Meses" className="w-full p-2 text-sm border border-gray-200 rounded focus:border-black outline-none" required />
                            </div>
                            
                            {/* Seletor de Cores Expandido (Variações de Tom) */}
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Etiqueta de Cor</label>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        'slate',   // Cinza
                                        'red', 'rose', // Vermelhos
                                        'orange', 'amber', 'yellow', 'lime', // ☀️ 4 Tons de Amarelo/Dourado
                                        'lime', 'green', 'emerald', 'teal', // 🌿 4 Tons de Verde
                                        'cyan', 'sky', 'blue', 'indigo', // 💧 4 Tons de Azul
                                        'violet', 'purple', 'fuchsia', 'pink' // Roxos/Rosas
                                    ].map(color => (
                                        <label key={color} className="relative cursor-pointer group">
                                            <input type="radio" name="color" value={color} className="peer sr-only" defaultChecked={editingPlan ? editingPlan.color === color : color === 'slate'} />
                                            {/* Bolinha da cor */}
                                            <div className={`w-6 h-6 rounded-full border border-gray-200 peer-checked:scale-110 peer-checked:ring-2 peer-checked:ring-offset-1 peer-checked:ring-black transition-all bg-${color}-400 hover:opacity-80`} title={color}></div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <select name="method" defaultValue={editingPlan?.paymentMethod} className="w-full p-2 text-sm border border-gray-200 rounded bg-white focus:border-black outline-none"><option value="Pix">Pix</option><option value="Cartão">Cartão</option></select>
                            
                            <div className="grid grid-cols-2 gap-2">
                                <input name="gross" type="number" step="0.01" defaultValue={editingPlan?.grossValue} placeholder="Bruto (R$)" className="p-2 text-sm border border-gray-200 rounded focus:border-black outline-none" required />
                                <input name="net" type="number" step="0.01" defaultValue={editingPlan?.netValue} placeholder="Líquido (R$)" className="p-2 text-sm border border-green-200 rounded focus:border-green-600 outline-none font-medium text-green-700" required />
                            </div>
                            
                            <button className={`w-full py-2.5 rounded text-sm font-bold shadow-md transition-all ${editingPlan ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-black hover:bg-gray-800 text-white'}`}>
                                {editingPlan ? 'Salvar Alterações' : 'Adicionar Novo Plano'}
                            </button>
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
                    {/* Alterado para max-w-5xl para caber as novas colunas */}
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
                        
                        {/* CABEÇALHO DO MODAL */}
                        <div className="p-6 bg-black text-white flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-bold">{selectedStudentHistory.student?.name}</h2>
                                <p className="text-gray-400 text-sm mt-1">LTV (Lifetime Value) - Histórico de Pagamentos</p>
                            </div>
                            <button onClick={() => setHistoryModalOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
                                <X size={20} className="text-white"/>
                            </button>
                        </div>

                        {/* RESUMO FINANCEIRO */}
                        <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-around text-center">
                            <div>
                                <p className="text-[10px] font-bold uppercase text-gray-400">Total Pago (Líquido)</p>
                                <p className="text-xl font-black text-green-700">
                                    {formatCurrency(selectedStudentHistory.history.reduce((acc, curr) => acc + (curr.payDate ? parseFloat(curr.netValue||0) : 0), 0))}
                                </p>
                            </div>
                        </div>

                        {/* TABELA COM NOVAS COLUNAS */}
                        <div className="flex-1 overflow-y-auto p-0">
                            <table className="w-full text-left">
                                <thead className="sticky top-0 bg-gray-100 border-b border-gray-200 shadow-sm z-10">
                                    <tr>
                                        <th className="p-4 text-[10px] font-black uppercase text-gray-500">Data Pagamento</th>
                                        <th className="p-4 text-[10px] font-black uppercase text-gray-500">Referência</th>
                                        <th className="p-4 text-[10px] font-black uppercase text-gray-500">Líquido</th>
                                        
                                        {/* NOVAS COLUNAS ADICIONADAS AQUI */}
                                        <th className="p-4 text-[10px] font-black uppercase text-gray-500">Início Vigência</th>
                                        <th className="p-4 text-[10px] font-black uppercase text-gray-500">Fim Vigência</th>
                                        
                                        <th className="p-4 text-[10px] font-black uppercase text-gray-500 text-right">Status Calc.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {selectedStudentHistory.history.map(h => { 
                                        return (
                                            <tr key={h.id} className="hover:bg-gray-50">
                                                <td className="p-4">
                                                    {h.payDate ? <span className="font-bold text-green-700">{formatDateBr(h.payDate)}</span> : <span className="text-xs text-gray-400 italic">Pendente</span>}
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-bold text-gray-800">{h.planType}</div>
                                                    <div className="text-xs text-gray-400">{h.paymentMethod}</div>
                                                </td>
                                                <td className="p-4 font-mono font-bold text-gray-700">{formatCurrency(h.netValue)}</td>
                                                
                                                {/* DADOS DAS NOVAS COLUNAS */}
                                                <td className="p-4 text-xs text-gray-600 font-medium">{formatDateBr(h.startDate)}</td>
                                                <td className="p-4 text-xs text-gray-600 font-medium">{formatDateBr(h.dueDate)}</td>
                                                
                                                <td className="p-4 text-right">
                                                    <span className="text-[10px] border px-1 py-0.5 rounded bg-gray-50 text-gray-500">
                                                        {getComputedStatus(h, todayISO).label}
                                                    </span>
                                                </td>
                                            </tr>
                                        ) 
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}