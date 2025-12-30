import React, { useState, useEffect } from 'react';
import { Loader } from 'lucide-react';
import { doc, getDoc, getDocs, collection, updateDoc, deleteDoc, setDoc } from "firebase/firestore";
import { db } from './services/firebase';
import { generateSlug } from './utils/helpers';

// Importação das Novas Páginas e Componentes
import Login from './pages/Login';
import StudentRegistration from './pages/StudentRegistration';
import StudentView from './pages/StudentView';
import Editor from './pages/Editor';
import Dashboard from './components/Dashboard';

const App = () => {
  // --- ESTADOS GLOBAIS ---
  const [viewState, setViewState] = useState('loading'); // 'loading', 'login', 'dashboard', 'editor', 'student_view', 'public_register'
  const [students, setStudents] = useState([]);
  const [availablePlans, setAvailablePlans] = useState([]);
  
  // Estados de Sessão
  const [activePlanId, setActivePlanId] = useState(null); // ID do fluxo sendo editado
  const [activeStudent, setActiveStudent] = useState(null); // Dados do aluno logado
  const [activePlanData, setActivePlanData] = useState(null); // Dados do fluxo para o aluno ver
  const [tempTestSteps, setTempTestSteps] = useState(null); // Para testar o editor sem salvar

  // --- 1. INICIALIZAÇÃO E ROTEAMENTO ---
  useEffect(() => {
    const initSystem = async () => {
      const params = new URLSearchParams(window.location.search);
      const urlId = params.get('id');       
      const urlToken = params.get('token'); 
      const urlRegister = params.get('register');

      // Rota A: Pré-Cadastro Público
      if (urlRegister) {
        setViewState('public_register');
        return;
      }

      // Rota B: Aluno (Link com Token)
      if (urlToken) {
        setViewState('loading');
        try {
          const studentRef = doc(db, "students", urlToken);
          const studentSnap = await getDoc(studentRef);

          if (studentSnap.exists()) {
            const sData = { id: studentSnap.id, ...studentSnap.data() };
            setActiveStudent(sData);

            // Carrega o Plano do Aluno
            if (sData.planId) {
                const planRef = doc(db, "onboarding", sData.planId);
                const planSnap = await getDoc(planRef);
                if (planSnap.exists()) {
                    setActivePlanData(planSnap.data());
                }
            }
            setViewState('student_view');
          } else {
            alert("Convite não encontrado.");
            setViewState('login');
          }
        } catch (e) {
          console.error("Erro ao carregar aluno:", e);
          alert("Erro de conexão.");
        }
        return;
      }

      // Rota C: Admin Logado
      const hasSession = sessionStorage.getItem('ebony_admin') === 'true';
      if (hasSession) {
        await loadDashboardData();
        setViewState('dashboard');
      } else {
        setViewState('login');
      }
    };

    initSystem();
  }, []);

  // --- 2. CARREGAMENTO DE DADOS (DASHBOARD) ---
  const loadDashboardData = async () => {
    try {
      const [plansSnap, studentsSnap] = await Promise.all([
        getDocs(collection(db, "onboarding")),
        getDocs(collection(db, "students"))
      ]);
      
      setAvailablePlans(plansSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setStudents(studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
    }
  };

  // --- 3. AÇÕES DO DASHBOARD ---
  
  const handleLoginSuccess = async () => {
    sessionStorage.setItem('ebony_admin', 'true');
    await loadDashboardData();
    setViewState('dashboard');
  };

  // CRUD Planos
  const handleCreatePlan = async (id, name) => {
    try {
        await setDoc(doc(db, "onboarding", id), { name, steps: [], createdAt: new Date().toISOString() });
        await loadDashboardData();
        // Abre o editor imediatamente
        setActivePlanId(id);
        setViewState('editor');
    } catch (e) { alert("Erro ao criar plano: " + e.message); }
  };

  const handleDeletePlan = async (id) => {
    try { await deleteDoc(doc(db, "onboarding", id)); await loadDashboardData(); } catch(e){ alert("Erro ao deletar"); }
  };

  const handleDuplicatePlan = async (originalId, customName) => {
    const original = availablePlans.find(p => p.id === originalId);
    if (!original) return;
    let newId = generateSlug(customName);
    const { id, ...data } = original;
    try {
        await setDoc(doc(db, "onboarding", newId), { ...data, name: customName });
        alert("Duplicado com sucesso!");
        await loadDashboardData();
    } catch(e) { alert("Erro ao duplicar"); }
  };

  const handleUpdatePlanMeta = async (oldId, newId, newName) => {
    if (oldId === newId) {
        try {
            await updateDoc(doc(db, "onboarding", oldId), { name: newName });
            await loadDashboardData();
        } catch(e) { alert("Erro ao renomear"); }
    }
  };

  const handleUpdatePlanColor = async (id, color) => {
    try {
        await updateDoc(doc(db, "onboarding", id), { color });
        // Atualiza localmente para ser rápido
        setAvailablePlans(prev => prev.map(p => p.id === id ? { ...p, color } : p));
    } catch(e) { console.error(e); }
  };

  // CRUD Alunos
  const handleCreateStudent = async (data) => {
    try {
        const ref = doc(collection(db, "students"));
        await setDoc(ref, { ...data, id: ref.id });
        await loadDashboardData();
        alert("Convite criado!");
    } catch(e) { alert("Erro ao criar convite"); }
  };

  // --- NOVO: LANÇAR PAGAMENTO ---
  const handleAddPayment = async (studentId, paymentData) => {
    try {
        // Cria uma referência na nova tabela "payments"
        const payRef = doc(collection(db, "payments"));
        await setDoc(payRef, {
            ...paymentData,
            id: payRef.id,
            studentId: studentId,
            createdAt: new Date().toISOString()
        });
        
        // Atualiza os dados para refletir no Dashboard
        await loadDashboardData();
        return true;
    } catch (e) {
        console.error("Erro ao lançar pagamento:", e);
        alert("Erro ao salvar financeiro.");
        return false;
    }
  };

  const handleDeleteStudent = async (id) => {
    try { await deleteDoc(doc(db, "students", id)); await loadDashboardData(); } catch(e){ alert("Erro ao deletar aluno"); }
  };

  const handleToggleDelivery = async (student) => {
    try {
        const newVal = !student.materialDelivered;
        // Atualiza visualmente rápido
        setStudents(prev => prev.map(s => s.id === student.id ? { ...s, materialDelivered: newVal } : s));
        await updateDoc(doc(db, "students", student.id), { materialDelivered: newVal });
    } catch(e) { console.error(e); }
  };

  // --- 4. RENDERIZAÇÃO DE TELAS ---

  if (viewState === 'loading') return <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5]"><Loader className="w-8 h-8 animate-spin text-gray-400"/></div>;

  if (viewState === 'public_register') return <StudentRegistration />;

  if (viewState === 'login') return <Login onLoginSuccess={handleLoginSuccess} />;

  if (viewState === 'dashboard') {
    return (
      <Dashboard 
        plans={availablePlans}
        students={students}
        onSelectPlan={(id) => { setActivePlanId(id); setViewState('editor'); }}
        onCreatePlan={handleCreatePlan}
        onDeletePlan={handleDeletePlan}
        onDuplicatePlan={handleDuplicatePlan}
        onUpdatePlanMeta={handleUpdatePlanMeta}
        onUpdatePlanColor={handleUpdatePlanColor}
        onCreateStudent={handleCreateStudent}
        onDeleteStudent={handleDeleteStudent}
        onToggleDelivery={handleToggleDelivery}
        onReloadData={loadDashboardData}
      />
    );
  }

  if (viewState === 'editor') {
    return (
        <Editor 
            planId={activePlanId} 
            onBack={() => setViewState('dashboard')}
            onTest={(currentSteps) => {
                // Monta um plano temporário para teste
                const planMeta = availablePlans.find(p => p.id === activePlanId) || {};
                setTempTestSteps({ ...planMeta, steps: currentSteps });
                setViewState('test_view');
            }}
        />
    );
  }

  // Visualização do Aluno (Real)
  if (viewState === 'student_view') {
    return <StudentView student={activeStudent} plan={activePlanData} onReload={() => window.location.reload()} />;
  }

  // Visualização de Teste (Do Editor)
  if (viewState === 'test_view') {
    // Mock de aluno assinado para pular o contrato e ver o conteúdo direto
    const mockStudent = { status: 'signed', name: 'Modo Teste' };
    return (
        <div>
            <StudentView student={mockStudent} plan={tempTestSteps} />
            <div className="fixed bottom-4 right-4 z-50">
                <button onClick={() => setViewState('editor')} className="bg-red-600 text-white px-6 py-3 rounded-full font-bold shadow-2xl border-2 border-white hover:scale-105 transition-transform">
                    Sair do Teste
                </button>
            </div>
        </div>
    );
  }

  return null;
};

export default App;