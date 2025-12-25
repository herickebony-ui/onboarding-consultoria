import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc, updateDoc } from "firebase/firestore";
import { 
  Copy, ChevronRight, ChevronLeft, CheckCircle, FileText, Smartphone, Download, 
  ExternalLink, Play, Settings, Plus, Trash2, Layout, Eye, MoveUp, MoveDown, 
  Image as ImageIcon, Upload, Bold, Italic, Underline, Link as LinkIcon, 
  Monitor, Loader, ArrowLeft, Edit, Save, X, Lock, Users, Share2, Search
} from 'lucide-react';

// --- ⚠️ CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDiLbc_PiVR1EVoLRJlZvNZYSMxb2rEE54",
  authDomain: "onboarding-consultoria.firebaseapp.com",
  projectId: "onboarding-consultoria",
  storageBucket: "onboarding-consultoria.firebasestorage.app",
  messagingSenderId: "658269586608",
  appId: "1:658269586608:web:991d2c39d6f1664aaae775"
};

let db;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (error) {
  console.log("Aguardando configuração...");
}

// --- HELPER: GERADOR DE SLUG LIMPO ---
const generateSlug = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, "") 
    .replace(/\s+/g, '-')     
    .replace(/[^\w\-]+/g, '') 
    .replace(/\-\-+/g, '-');  
};

// --- EDITOR DE TEXTO AVANÇADO ---
const RichTextEditor = ({ value, onChange }) => {
  const editorRef = useRef(null);
  
  const execCmd = (command, value = null) => {
    document.execCommand(command, false, value);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const addLink = () => {
    const selection = window.getSelection().toString();
    let url = prompt("Cole o link aqui:", "https://");
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    const text = prompt("Texto do link:", selection || "Clique aqui");
    if (!text) return;
    const linkHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">${text}</a>`;
    document.execCommand('insertHTML', false, linkHtml);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  return (
    <div className="border border-gray-300 rounded-md overflow-hidden bg-white">
      <div className="flex items-center gap-1 p-2 bg-gray-50 border-b border-gray-200 flex-wrap">
        <button onClick={() => execCmd('bold')} className="p-1.5 hover:bg-gray-200 rounded text-gray-700"><Bold className="w-4 h-4" /></button>
        <button onClick={() => execCmd('italic')} className="p-1.5 hover:bg-gray-200 rounded text-gray-700"><Italic className="w-4 h-4" /></button>
        <button onClick={() => execCmd('underline')} className="p-1.5 hover:bg-gray-200 rounded text-gray-700"><Underline className="w-4 h-4" /></button>
        <div className="w-px h-4 bg-gray-300 mx-1"></div>
        <button onClick={addLink} className="p-1.5 hover:bg-blue-100 text-blue-600 rounded" title="Inserir Link Personalizado"><LinkIcon className="w-4 h-4" /></button>
      </div>
      <div ref={editorRef} contentEditable className="p-3 min-h-[100px] text-sm text-gray-800 focus:outline-none prose prose-sm max-w-none" onInput={(e) => onChange(e.currentTarget.innerHTML)} onBlur={(e) => onChange(e.currentTarget.innerHTML)}></div>
    </div>
  );
};

// --- COMPONENTE DASHBOARD (ADMIN) ---
const Dashboard = ({ onSelectPlan, onCreatePlan, plans, onDeletePlan, onDuplicatePlan, onUpdatePlanMeta, students, onCreateStudent, onDeleteStudent }) => {
  const [activeTab, setActiveTab] = useState('flows'); // 'flows' ou 'students'
  
  // Estados para Fluxos
  const [newPlanName, setNewPlanName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null); 
  const [editName, setEditName] = useState("");
  const [duplicatingPlan, setDuplicatingPlan] = useState(null);
  const [duplicateName, setDuplicateName] = useState("");

  // Estados para Alunos (NOVO)
  const [isInviting, setIsInviting] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentPhone, setNewStudentPhone] = useState("");
  const [selectedPlanForStudent, setSelectedPlanForStudent] = useState("");
  const [contractText, setContractText] = useState(`CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE CONSULTORIA ONLINE

Pelo presente instrumento particular, de um lado EBONY TEAM, e de outro lado O(A) ALUNO(A) identificado(a) no cadastro deste sistema.

1. DO OBJETO
O presente contrato tem por objeto a prestação de serviços de consultoria esportiva online...

2. DA VIGÊNCIA
O presente contrato terá vigência de acordo com o plano contratado...

(Edite este texto conforme necessário para este aluno específico)`);

  // -- AÇÕES DE FLUXO --
  const handleCreate = () => {
    if(!newPlanName) return;
    const id = generateSlug(newPlanName);
    const exists = plans.some(p => p.id === id);
    if(exists) { alert("Já existe um fluxo com este nome/ID."); return; }
    onCreatePlan(id, newPlanName);
  };

  const copyLink = (id) => {
    const url = `${window.location.origin}/?id=${id}`;
    navigator.clipboard.writeText(url);
    alert("Link copiado: " + url);
  };

  const saveEdit = () => {
    if (!editName) return alert("Nome obrigatório");
    onUpdatePlanMeta(editingPlan.id, editingPlan.id, editName);
    setEditingPlan(null);
  };

  const confirmDuplicate = () => {
    if (!duplicateName) return alert("Nome da cópia obrigatório");
    onDuplicatePlan(duplicatingPlan.id, duplicateName);
    setDuplicatingPlan(null);
  };

  // -- AÇÕES DE ALUNO (NOVO) --
  const handleCreateInvite = () => {
    if (!newStudentName || !newStudentPhone || !selectedPlanForStudent) {
      alert("Preencha Nome, WhatsApp e escolha um Fluxo.");
      return;
    }
    onCreateStudent({
      name: newStudentName,
      phone: newStudentPhone.replace(/\D/g, ''), // Remove formatação, deixa só números
      planId: selectedPlanForStudent,
      contractText: contractText,
      status: 'pending', // pending, signed
      createdAt: new Date().toISOString()
    });
    setIsInviting(false);
    setNewStudentName("");
    setNewStudentPhone("");
  };

  const copyStudentLink = (studentId) => {
    const url = `${window.location.origin}/?token=${studentId}`;
    navigator.clipboard.writeText(url);
    alert("Link do Convite copiado! Envie para o aluno:\n" + url);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Painel Ebony</h1>
            <p className="text-gray-500">Gestão de Consultoria</p>
          </div>
          
          {/* Menu de Abas */}
          <div className="bg-white p-1 rounded-xl border border-gray-200 flex shadow-sm">
            <button 
              onClick={() => setActiveTab('flows')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'flows' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              Meus Fluxos
            </button>
            <button 
              onClick={() => setActiveTab('students')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'students' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <Users className="w-4 h-4"/> Meus Alunos
            </button>
          </div>
        </div>

        {/* --- ABA: MEUS FLUXOS --- */}
        {activeTab === 'flows' && (
          <div className="animate-in fade-in duration-300">
            {/* ... Modais de Edição/Duplicação (Mantidos) ... */}
            {editingPlan && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md animate-in fade-in zoom-in duration-200">
                  <h2 className="text-xl font-bold mb-4">Renomear Fluxo</h2>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full p-2 border border-gray-300 rounded mb-6"/>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditingPlan(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                    <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">Salvar</button>
                  </div>
                </div>
              </div>
            )}
            {duplicatingPlan && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md animate-in fade-in zoom-in duration-200">
                  <h2 className="text-xl font-bold mb-2">Duplicar Fluxo</h2>
                  <input autoFocus type="text" value={duplicateName} onChange={(e) => setDuplicateName(e.target.value)} className="w-full p-2 border border-gray-300 rounded mb-2"/>
                  <p className="text-xs text-gray-400 mb-6 font-mono">ID será: {generateSlug(duplicateName || 'novo-id')}</p>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setDuplicatingPlan(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                    <button onClick={confirmDuplicate} className="px-4 py-2 bg-black text-white rounded font-bold hover:bg-gray-800 flex items-center gap-2"><Copy className="w-4 h-4"/> Duplicar</button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="bg-white p-6 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-center hover:border-blue-500 transition-colors min-h-[200px]">
                {!isCreating ? (
                  <button onClick={() => setIsCreating(true)} className="flex flex-col items-center gap-2 w-full h-full py-8">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center"><Plus className="w-6 h-6"/></div>
                    <span className="font-bold text-gray-700">Criar Novo Fluxo</span>
                  </button>
                ) : (
                  <div className="w-full animate-in fade-in">
                    <input autoFocus type="text" placeholder="Nome do Fluxo" className="w-full p-2 border border-gray-300 rounded mb-3 text-sm" value={newPlanName} onChange={e => setNewPlanName(e.target.value)} />
                    <div className="flex gap-2">
                      <button onClick={handleCreate} className="flex-1 bg-black text-white py-2 rounded text-sm font-bold">Criar</button>
                      <button onClick={() => setIsCreating(false)} className="px-3 bg-gray-100 rounded text-sm font-bold">X</button>
                    </div>
                  </div>
                )}
              </div>
              {plans.map((plan) => (
                <div key={plan.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative group flex flex-col justify-between min-h-[200px]">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg text-gray-900 leading-tight">{plan.name || plan.id}</h3>
                      <button onClick={() => {setEditingPlan(plan); setEditName(plan.name || plan.id)}} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit className="w-4 h-4" /></button>
                    </div>
                    <p className="text-xs text-gray-400 font-mono mb-6 bg-gray-50 inline-block px-2 py-1 rounded">ID: {plan.id}</p>
                  </div>
                  <div className="space-y-2">
                    <button onClick={() => onSelectPlan(plan.id)} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 flex items-center justify-center gap-2"><Settings className="w-4 h-4"/> Editar Fluxo</button>
                    <div className="flex gap-2">
                      <button onClick={() => copyLink(plan.id)} className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-2" title="Link Direto (Antigo)"><LinkIcon className="w-4 h-4"/> Link</button>
                      <button onClick={() => {setDuplicatingPlan(plan); setDuplicateName(`${plan.name} (Cópia)`)}} className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-2"><Copy className="w-4 h-4"/> Duplicar</button>
                    </div>
                  </div>
                  <button onClick={() => {if(confirm('Tem certeza?')) onDeletePlan(plan.id)}} className="absolute -top-2 -right-2 p-2 bg-white border border-gray-200 shadow-sm rounded-full text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-10"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- ABA: MEUS ALUNOS (NOVA) --- */}
        {activeTab === 'students' && (
          <div className="animate-in fade-in duration-300">
            
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">Lista de Alunos</h2>
              <button onClick={() => setIsInviting(true)} className="bg-black text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-lg">
                <Plus className="w-5 h-5" /> Novo Aluno
              </button>
            </div>

            {/* Modal Novo Aluno */}
            {isInviting && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                    <h2 className="text-xl font-bold">Novo Convite de Aluno</h2>
                    <button onClick={() => setIsInviting(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5"/></button>
                  </div>
                  
                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Aluno</label>
                        <input type="text" value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-black" placeholder="Ex: João da Silva"/>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">WhatsApp (Será a Senha)</label>
                        <input type="text" value={newStudentPhone} onChange={(e) => setNewStudentPhone(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-black" placeholder="Ex: 11999998888"/>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Fluxo de Treino (O que ele vai receber)</label>
                      <select value={selectedPlanForStudent} onChange={(e) => setSelectedPlanForStudent(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-black bg-white">
                        <option value="">Selecione um fluxo...</option>
                        {plans.map(p => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Minuta do Contrato</label>
                      <p className="text-xs text-gray-500 mb-2">Este é o texto que aparecerá para o aluno assinar. Os dados pessoais serão preenchidos automaticamente.</p>
                      <textarea 
                        value={contractText} 
                        onChange={(e) => setContractText(e.target.value)} 
                        className="w-full h-64 p-4 border border-gray-300 rounded-lg outline-none focus:border-black text-sm font-mono leading-relaxed resize-y"
                      />
                    </div>
                  </div>

                  <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 sticky bottom-0">
                    <button onClick={() => setIsInviting(false)} className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-200 rounded-lg">Cancelar</button>
                    <button onClick={handleCreateInvite} className="px-6 py-3 bg-black text-white font-bold rounded-lg hover:bg-gray-800 shadow-md">Gerar Convite</button>
                  </div>
                </div>
              </div>
            )}

            {/* Lista de Alunos */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {students.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-20"/>
                  <p>Nenhum aluno cadastrado ainda.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Aluno</th>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Fluxo</th>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {students.map((student) => (
                        <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-gray-900">{student.name}</div>
                            <div className="text-xs text-gray-400">{student.phone}</div>
                          </td>
                          <td className="p-4">
                            <span className="bg-gray-100 text-gray-600 py-1 px-2 rounded text-xs font-medium">
                              {plans.find(p => p.id === student.planId)?.name || student.planId}
                            </span>
                          </td>
                          <td className="p-4">
                            {student.status === 'signed' ? (
                              <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 py-1 px-2 rounded-full text-xs font-bold border border-green-200">
                                <CheckCircle className="w-3 h-3"/> Assinado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 py-1 px-2 rounded-full text-xs font-bold border border-yellow-200">
                                <Loader className="w-3 h-3"/> Pendente
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right flex justify-end gap-2">
                            <button 
                              onClick={() => copyStudentLink(student.id)} 
                              className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                              title="Copiar Link do Convite"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => {if(confirm('Remover aluno?')) onDeleteStudent(student.id)}} 
                              className="p-2 border border-gray-200 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

const OnboardingConsultoria = () => {
  const [viewState, setViewState] = useState('loading'); // loading, login, dashboard, editor, student
  const [isAdminAccess, setIsAdminAccess] = useState(false);
  const [activePlanId, setActivePlanId] = useState(null);
  const [availablePlans, setAvailablePlans] = useState([]);
  
  // Lista de Alunos (Estado Global)
  const [students, setStudents] = useState([]);
  
  // Login State
  const [passwordInput, setPasswordInput] = useState("");
  const ADMIN_PASSWORD = "ebony"; 

  // Editor State
  const [isSaving, setIsSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  
  // Fluxo
  const [coachName, setCoachName] = useState("Sua Consultoria");
  const [whatsappLink, setWhatsappLink] = useState("https://wa.me/");
  const [finalTitle, setFinalTitle] = useState("Tudo Pronto! 🎉");
  const [finalMessage, setFinalMessage] = useState("Recebi suas informações. Agora é comigo!");
  const [finalButtonText, setFinalButtonText] = useState("Falar com o Treinador");
  const [steps, setSteps] = useState([]);

  const defaultSteps = [{ id: 1, type: 'welcome', title: 'Boas-vindas', content: 'Bem-vindo ao time!', buttonText: '', link: '', coverImage: null, coverPosition: 50, images: [] }];

  useEffect(() => {
    if (!document.querySelector('script[src*="tailwindcss"]')) {
      const script = document.createElement('script');
      script.src = "https://cdn.tailwindcss.com";
      script.async = true;
      document.head.appendChild(script);
    }

    const init = async () => {
      const params = new URLSearchParams(window.location.search);
      const urlId = params.get('id');       // Link antigo (legado)
      const urlToken = params.get('token'); // NOVO: Link do Aluno
      const urlAdmin = params.get('admin');

      if (urlToken) {
        // LÓGICA DO ALUNO (FUTURA)
        // Por enquanto, apenas mostraremos que o link funciona
        // Na próxima etapa, aqui entra a verificação do contrato
        alert("Link do aluno detectado: " + urlToken + ". (Próxima etapa: Tela de Assinatura)");
        setViewState('loading'); // Placeholder
      } else if (urlId) {
        // Link antigo direto (pode manter ou remover depois)
        await loadPlan(urlId);
        setActivePlanId(urlId);
        setViewState('student');
      } else if (urlAdmin === 'true') {
        setIsAdminAccess(true);
        await Promise.all([loadAllPlans(), loadAllStudents()]);
        setViewState('dashboard');
      } else {
        setViewState('login');
      }
    };

    init();
  }, []);

  const handleLogin = async () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAdminAccess(true);
      await Promise.all([loadAllPlans(), loadAllStudents()]);
      setViewState('dashboard');
    } else {
      alert("Senha incorreta.");
    }
  };

  // --- FIRESTORE ALUNOS (NOVO) ---
  const loadAllStudents = async () => {
    if (!db) return;
    try {
      const q = await getDocs(collection(db, "students"));
      const list = q.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Ordenar por data (mais recente primeiro) se houver campo date
      setStudents(list);
    } catch (e) { console.error("Erro alunos", e); }
  };

  const handleCreateStudent = async (studentData) => {
    if (!db) return;
    try {
      // Cria documento com ID automático
      const docRef = doc(collection(db, "students")); 
      const finalData = { ...studentData, id: docRef.id };
      await setDoc(docRef, finalData);
      await loadAllStudents();
      alert("Convite criado com sucesso!");
    } catch (e) { console.error(e); alert("Erro ao criar convite"); }
  };

  const handleDeleteStudent = async (id) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, "students", id));
      await loadAllStudents();
    } catch (e) { alert("Erro ao deletar"); }
  }

  // --- FIRESTORE PLANOS ---
  const loadAllPlans = async () => {
    if (!db) return;
    try {
      const querySnapshot = await getDocs(collection(db, "onboarding"));
      const plansList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAvailablePlans(plansList);
    } catch (error) { console.error("Erro ao listar planos", error); }
  };

  const loadPlan = async (id) => {
    if (!db) { setSteps(defaultSteps); return; }
    try {
      const docRef = doc(db, "onboarding", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCoachName(data.coachName || "Sua Consultoria");
        setWhatsappLink(data.whatsappLink || "");
        setFinalTitle(data.finalTitle || "Tudo Pronto!");
        setFinalMessage(data.finalMessage || "Sucesso!");
        setFinalButtonText(data.finalButtonText || "Continuar");
        setSteps(data.steps || defaultSteps);
      } else {
        setCoachName("Nova Consultoria");
        setSteps(defaultSteps);
      }
    } catch (error) { console.error("Erro ao carregar plano", error); }
  };

  const handleSaveToCloud = async () => {
    if (!db || !activePlanId) return alert("Erro de configuração.");
    setIsSaving(true);
    try {
      await setDoc(doc(db, "onboarding", activePlanId), { 
        name: coachName, 
        coachName, whatsappLink, finalTitle, finalMessage, finalButtonText, steps 
      });
      alert("✅ Fluxo salvo com sucesso!");
    } catch (error) { alert("Erro ao salvar."); console.error(error); } finally { setIsSaving(false); }
  };

  const handleCreatePlan = async (id, name) => {
    setActivePlanId(id);
    setCoachName(name); 
    setSteps(defaultSteps); 
    setViewState('editor'); 
  };

  const handleDeletePlan = async (id) => {
    if(!db) return;
    try {
      await deleteDoc(doc(db, "onboarding", id));
      await loadAllPlans();
    } catch (e) { alert("Erro ao deletar"); }
  };

  const handleDuplicatePlan = async (originalId, customName) => {
    if(!db) return;
    const originalPlan = availablePlans.find(p => p.id === originalId);
    if (!originalPlan) return;
    let newId = generateSlug(customName);
    if (availablePlans.some(p => p.id === newId)) {
        newId = `${newId}-${Math.floor(Math.random() * 100)}`;
    }
    const { id, ...dataToSave } = originalPlan;
    const newPlanData = { ...dataToSave, name: customName };
    try {
      await setDoc(doc(db, "onboarding", newId), newPlanData);
      alert("Fluxo duplicado com sucesso!");
      await loadAllPlans();
    } catch (e) { console.error(e); alert("Erro ao duplicar"); }
  };

  const handleUpdatePlanMetadata = async (oldId, newId, newName) => {
    if(!db) return;
    if (oldId === newId) {
      try {
        await setDoc(doc(db, "onboarding", oldId), { name: newName }, { merge: true });
        await loadAllPlans();
      } catch (e) { alert("Erro ao atualizar nome."); }
    }
  };

  const goBackToDashboard = async () => {
    await loadAllPlans();
    setViewState('dashboard');
    setActivePlanId(null);
    window.history.pushState({}, "", "/");
  };

  // --- HELPERS E NAVEGAÇÃO ---
  const formatUrl = (url) => {
    if (!url) return '';
    const trimmed = url.trim();
    return (trimmed.startsWith('http://') || trimmed.startsWith('https://')) ? trimmed : `https://${trimmed}`;
  };
  const handleNext = () => { if (currentStep < steps.length - 1) { setCurrentStep(curr => curr + 1); window.scrollTo(0, 0); } else { setIsCompleted(true); } };
  const handlePrev = () => { if (currentStep > 0) { setCurrentStep(curr => curr - 1); setIsCompleted(false); window.scrollTo(0, 0); } };
  
  // CRUD Steps
  const addStep = () => { setSteps([...steps, { id: Date.now(), type: 'text', title: 'Nova Etapa', content: '...', buttonText: '', link: '', coverImage: null, coverPosition: 50, images: [] }]); setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 100); };
  const removeStep = (index) => { if (steps.length <= 1) return alert("Mínimo 1 etapa."); const newSteps = [...steps]; newSteps.splice(index, 1); setSteps(newSteps); if (currentStep >= newSteps.length) setCurrentStep(newSteps.length - 1); };
  const updateStep = (index, field, value) => { const newSteps = [...steps]; newSteps[index] = { ...newSteps[index], [field]: value }; setSteps(newSteps); };
  const moveStep = (index, direction) => { if ((direction === 'up' && index === 0) || (direction === 'down' && index === steps.length - 1)) return; const newSteps = [...steps]; const temp = newSteps[index]; newSteps[index] = newSteps[index + (direction === 'up' ? -1 : 1)]; newSteps[index + (direction === 'up' ? -1 : 1)] = temp; setSteps(newSteps); };
  
  // Uploads (Mantidos)
  const handleCoverUpload = (idx, e) => { const file = e.target.files[0]; if(file) { const r = new FileReader(); r.onloadend = () => { const ns = [...steps]; ns[idx].coverImage = r.result; ns[idx].coverPosition = 50; setSteps(ns); }; r.readAsDataURL(file); } };
  const removeCover = (idx) => { const ns = [...steps]; ns[idx].coverImage = null; setSteps(ns); };
  const handleImageUpload = (idx, e) => { const file = e.target.files[0]; if(file) { const r = new FileReader(); r.onloadend = () => { const ns = [...steps]; if(!ns[idx].images) ns[idx].images=[]; ns[idx].images.push(r.result); setSteps(ns); }; r.readAsDataURL(file); } };
  const removeImage = (idx, i) => { const ns = [...steps]; ns[idx].images = ns[idx].images.filter((_, x) => x !== i); setSteps(ns); };
  const handlePdfUpload = (idx, e) => { const file = e.target.files[0]; if(file && file.type === 'application/pdf') { const r = new FileReader(); r.onloadend = () => { const ns = [...steps]; ns[idx].pdfData = r.result; ns[idx].pdfName = file.name; setSteps(ns); }; r.readAsDataURL(file); } else alert('Apenas PDF.'); };
  const removePdf = (idx) => { const ns = [...steps]; ns[idx].pdfData = null; ns[idx].pdfName = null; setSteps(ns); };

  // --- RENDERIZAÇÃO ---
  if (viewState === 'loading') return <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5]"><Loader className="w-8 h-8 animate-spin text-gray-400"/></div>;
  
  if (viewState === 'login') return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F7F5] p-4 font-sans">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-500">
        <div className="bg-black p-8 text-center">
          <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center mx-auto mb-4 shadow-inner">
            <span className="text-white font-bold text-lg tracking-wider">ON</span>
          </div>
          <h2 className="text-white text-lg font-bold">Painel Ebony</h2>
          <p className="text-gray-400 text-xs mt-1 uppercase tracking-widest opacity-80">Acesso Administrativo</p>
        </div>
        <div className="p-8 pt-10">
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">Senha de Acesso</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-300 group-focus-within:text-black transition-colors" />
                </div>
                <input 
                  type="password" 
                  autoFocus
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>
            <button 
              onClick={handleLogin} 
              className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-all transform active:scale-[0.98]"
            >
              Entrar no Sistema
              <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
            </button>
          </div>
        </div>
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-400">Área restrita para treinadores.</p>
        </div>
      </div>
      <p className="mt-8 text-xs text-gray-400 font-medium opacity-50">Consultoria Ebony Team © 2025</p>
    </div>
  );

  if (viewState === 'error') return <div className="min-h-screen flex items-center justify-center text-gray-500">Link inválido.</div>;

  if (viewState === 'dashboard') {
    return (
      <Dashboard 
        plans={availablePlans} 
        onSelectPlan={(id) => { setActivePlanId(id); loadPlan(id); setViewState('editor'); }} 
        onCreatePlan={handleCreatePlan} 
        onDeletePlan={handleDeletePlan}
        onDuplicatePlan={handleDuplicatePlan} 
        onUpdatePlanMeta={handleUpdatePlanMetadata}
        students={students}
        onCreateStudent={handleCreateStudent}
        onDeleteStudent={handleDeleteStudent}
      />
    );
  }

  const renderStepContent = (step) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {step.coverImage && (
        <div className="-mx-6 -mt-6 md:-mx-10 md:-mt-10 mb-6 relative group bg-gray-50">
          <img 
            src={step.coverImage} 
            alt="Capa" 
            className="w-full h-auto object-contain rounded-t-2xl shadow-sm transition-all duration-300" 
          />
        </div>
      )}
      <h2 className="text-2xl font-bold text-gray-900">{step.title}</h2>
      <div className="text-lg text-gray-600 prose prose-gray max-w-none prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline" dangerouslySetInnerHTML={{ __html: step.content }} />
      {step.images && step.images.length > 0 && (
        <div className={`grid gap-4 my-6 ${step.images.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'}`}>
          {step.images.map((img, idx) => img && (
            <div key={idx} className="bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center overflow-hidden h-72">
                <img src={img} alt="" className="w-full h-full object-contain" />
            </div>
          ))}
        </div>
      )}
      {(step.type === 'text' || step.type === 'welcome') && step.link && (
        <a href={formatUrl(step.link)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-blue-600 hover:underline font-medium mt-4">{step.buttonText || "Acessar Link"} <ExternalLink className="w-4 h-4"/></a>
      )}
      {step.type === 'pdf' && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mt-6">
          <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-red-100 text-red-600 rounded-lg"><FileText className="w-6 h-6" /></div><div><h3 className="font-bold text-gray-900">Arquivo para Download</h3><p className="text-sm text-gray-500">{step.pdfName || "Documento PDF"}</p></div></div>
          <a href={step.pdfData || formatUrl(step.link) || "#"} download={!!step.pdfData ? (step.pdfName || "documento.pdf") : undefined} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"><Download className="w-4 h-4" />{step.buttonText || "Baixar Arquivo"}</a>
        </div>
      )}
      {step.type === 'app' && (
        <div className="mt-8"><h3 className="font-bold text-gray-900 mb-4 text-center">Escolha sua plataforma:</h3><div className="flex flex-col gap-3 max-w-sm mx-auto">
          {step.iosLink && <a href={formatUrl(step.iosLink)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 w-full py-3 px-4 bg-black text-white rounded-xl font-medium"><Smartphone className="w-5 h-5"/>App Store (iPhone)</a>}
          {step.androidLink && <a href={formatUrl(step.androidLink)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 w-full py-3 px-4 bg-black text-white rounded-xl font-medium"><Smartphone className="w-5 h-5"/>Google Play (Android)</a>}
          {step.webLink && <a href={formatUrl(step.webLink)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-medium"><Monitor className="w-5 h-5"/>Acessar Navegador</a>}
        </div></div>
      )}
      {step.type === 'video' && (
        <><div className="relative bg-gray-900 aspect-video rounded-xl overflow-hidden flex items-center justify-center group cursor-pointer shadow-lg mt-6"><div className="absolute inset-0 bg-black/40"></div><Play className="w-16 h-16 text-white opacity-90 relative z-10" /><p className="absolute bottom-4 left-4 text-white font-medium text-sm z-10">Vídeo Explicativo</p>{step.link && <a href={formatUrl(step.link)} target="_blank" rel="noreferrer" className="absolute inset-0 z-20"></a>}</div>{step.buttonText && <a href={formatUrl(step.link)} target="_blank" rel="noreferrer" className="block w-full text-center py-3 bg-blue-600 text-white rounded-lg font-bold mt-4">{step.buttonText}</a>}</>
      )}
    </div>
  );

  if (viewState === 'student') {
    if (isCompleted) return (
      <div className="min-h-screen bg-[#F7F7F5] flex flex-col items-center justify-center p-6 font-sans text-center relative">
        {isAdminAccess && <button onClick={() => setViewState('editor')} className="absolute top-4 right-4 p-2 bg-white text-gray-500 rounded-full hover:bg-gray-100 shadow-sm border border-gray-200 z-50"><Settings className="w-5 h-5"/></button>}
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-gray-100 animate-in zoom-in duration-500">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle className="w-10 h-10"/></div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{finalTitle}</h1>
          <p className="text-gray-600 mb-8 whitespace-pre-wrap">{finalMessage}</p>
          <a href={formatUrl(whatsappLink)} target="_blank" rel="noreferrer" className="block w-full py-3 px-4 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-200">{finalButtonText}</a>
          <button onClick={() => {setIsCompleted(false); setCurrentStep(0);}} className="mt-4 text-sm text-gray-400 hover:text-gray-600 underline">Reiniciar</button>
        </div>
      </div>
    );
    return (
      <div className="min-h-screen bg-[#F7F7F5] font-sans text-gray-900 relative">
        {isAdminAccess && <button onClick={() => setViewState('editor')} className="fixed top-20 right-4 p-3 bg-black text-white rounded-full shadow-xl hover:bg-gray-800 z-50 flex items-center gap-2"><Settings className="w-5 h-5"/></button>}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-lg">ON</div>
              <div>
                <h1 className="text-sm font-bold text-gray-900 leading-tight">Onboarding</h1>
                <p className="text-[10px] text-gray-500 font-medium">{coachName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-500">Etapa {currentStep + 1}/{steps.length}</span>
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-black transition-all duration-500 ease-out" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}></div>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-8 md:py-12 pb-32">
          <div className="bg-white min-h-[400px] rounded-2xl shadow-sm border border-gray-200 p-6 md:p-10 mb-8 relative">
            {renderStepContent(steps[currentStep])}
          </div>
        </main>
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <button onClick={handlePrev} disabled={currentStep === 0} className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${currentStep === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}><ChevronLeft className="w-5 h-5"/><span className="hidden sm:inline">Anterior</span></button>
            <button onClick={handleNext} className="flex items-center gap-2 px-8 py-3 bg-black text-white rounded-lg font-bold hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl active:scale-95"><span>{currentStep === steps.length - 1 ? 'Concluir' : 'Próximo'}</span><ChevronRight className="w-5 h-5"/></button>
          </div>
        </footer>
      </div>
    );
  }

  // MODO EDITOR (Mantido)
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-800">
             <button onClick={goBackToDashboard} className="p-2 hover:bg-gray-100 rounded-full mr-2" title="Voltar aos Planos"><ArrowLeft className="w-5 h-5"/></button>
             <h1 className="font-bold text-lg hidden sm:block">Editando: <span className="text-blue-600">{activePlanId}</span></h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSaveToCloud} disabled={isSaving} className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors shadow-sm ${isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}>{isSaving ? <Loader className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} <span className="hidden sm:inline">{isSaving ? "Salvando..." : "Salvar no Site"}</span></button>
            <button onClick={() => {setCurrentStep(0); setIsCompleted(false); setViewState('student');}} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"><Eye className="w-4 h-4" /> <span className="hidden sm:inline">Testar</span></button>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm"><h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Settings className="w-4 h-4" /> Configurações Gerais</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Nome da Consultoria</label><input type="text" value={coachName} onChange={(e) => setCoachName(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"/></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Link do WhatsApp (Final)</label><input type="text" value={whatsappLink} onChange={(e) => setWhatsappLink(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"/></div></div></section>
        <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm"><h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Configurações da Página Final</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Título</label><input type="text" value={finalTitle} onChange={(e) => setFinalTitle(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md outline-none"/></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Texto Botão</label><input type="text" value={finalButtonText} onChange={(e) => setFinalButtonText(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md outline-none"/></div></div><div className="mt-4"><label className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label><textarea value={finalMessage} onChange={(e) => setFinalMessage(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md outline-none resize-none"/></div></section>
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Layout className="w-4 h-4" /> Etapas do Fluxo ({steps.length})</h2>
          {steps.map((step, index) => (
            <div key={step.id} className="group bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
              <div className="bg-gray-50 p-3 border-b border-gray-100 flex items-center justify-between"><div className="flex items-center gap-3"><span className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded text-xs font-bold text-gray-600">{index + 1}</span><span className="font-semibold text-gray-700 text-sm truncate max-w-[120px] sm:max-w-none">{step.title}</span><span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold uppercase tracking-wide hidden sm:inline">{step.type}</span></div><div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity"><button onClick={() => moveStep(index, 'up')} className="p-1 hover:bg-gray-200 rounded"><MoveUp className="w-4 h-4"/></button><button onClick={() => moveStep(index, 'down')} className="p-1 hover:bg-gray-200 rounded"><MoveDown className="w-4 h-4"/></button><button onClick={() => removeStep(index)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button></div></div>
              
              <div className="p-5 grid gap-4">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Imagem de Capa (Horizontal)</label>
                  {!step.coverImage ? (
                    <label className="cursor-pointer flex flex-col items-center justify-center h-24 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-500 bg-white transition-colors">
                      <ImageIcon className="w-6 h-6 text-gray-400 mb-2" /><span className="text-xs text-gray-500 font-medium">Carregar Capa</span><input type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverUpload(index, e)}/>
                    </label>
                  ) : (
                    <div className="space-y-3">
                       <div className="relative rounded-lg overflow-hidden border border-gray-200 group bg-gray-100"><img src={step.coverImage} alt="Capa" className="w-full h-32 object-contain transition-all" style={{ objectPosition: `center ${step.coverPosition || 50}%` }}/><button onClick={() => removeCover(index)} className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4"/></button></div>
                       <div className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200"><MoveVertical className="w-4 h-4 text-gray-400" /><div className="flex-1"><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Ajustar Posição Vertical</label><input type="range" min="0" max="100" value={step.coverPosition || 50} onChange={(e) => updateStep(index, 'coverPosition', e.target.value)} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"/></div><span className="text-xs text-gray-500 w-8 text-right">{step.coverPosition || 50}%</span></div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-3"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título</label><input type="text" value={step.title} onChange={(e) => updateStep(index, 'title', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md font-medium outline-none"/></div>
                  <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo</label><select value={step.type} onChange={(e) => updateStep(index, 'type', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white outline-none"><option value="text">Texto</option><option value="welcome">Boas-vindas</option><option value="pdf">PDF</option><option value="video">Vídeo</option><option value="app">App</option></select></div>
                </div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Conteúdo</label><RichTextEditor value={step.content} onChange={(newContent) => updateStep(index, 'content', newContent)}/></div>
                
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Galeria (Fotos Extras)</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {step.images && step.images.map((imgUrl, imgIndex) => (<div key={imgIndex} className="relative group aspect-square bg-white rounded-lg border border-gray-200 overflow-hidden"><img src={imgUrl} alt="" className="w-full h-full object-contain" /><button onClick={() => removeImage(index, imgIndex)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button></div>))}
                    <label className="cursor-pointer flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-500 bg-white"><Upload className="w-6 h-6 text-gray-400 mb-2" /><span className="text-xs text-gray-500 font-medium">Add Imagem</span><input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(index, e)}/></label>
                  </div>
                </div>

                {step.type === 'app' && <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm"><div className="grid gap-2"><div><label className="text-xs font-medium">Android</label><input type="text" value={step.androidLink} onChange={(e) => updateStep(index, 'androidLink', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none"/></div><div><label className="text-xs font-medium">iOS</label><input type="text" value={step.iosLink} onChange={(e) => updateStep(index, 'iosLink', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none"/></div><div><label className="text-xs font-medium">Web</label><input type="text" value={step.webLink} onChange={(e) => updateStep(index, 'webLink', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none"/></div></div></div>}
                {(step.type === 'pdf') && <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="text-xs font-bold uppercase mb-1">Link Externo</label><input type="text" value={step.link} onChange={(e) => updateStep(index, 'link', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none"/></div><div><label className="text-xs font-bold uppercase mb-1">Upload PDF</label>{!step.pdfData ? <label className="w-full p-2 border border-dashed border-gray-300 rounded-md bg-white text-sm text-gray-500 cursor-pointer flex items-center justify-center gap-2"><Upload className="w-4 h-4"/> Selecionar<input type="file" accept="application/pdf" className="hidden" onChange={(e) => handlePdfUpload(index, e)}/></label> : <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-md"><span className="text-xs text-green-800 truncate">{step.pdfName}</span><button onClick={() => removePdf(index)} className="p-1 text-red-500"><Trash2 className="w-3 h-3"/></button></div>}</div><div className="md:col-span-2"><label className="text-xs font-bold uppercase mb-1">Texto Botão</label><input type="text" value={step.buttonText} onChange={(e) => updateStep(index, 'buttonText', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none"/></div></div>}
                {(step.type !== 'app' && step.type !== 'pdf') && <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm"><div><label className="text-xs font-bold uppercase mb-1">Link Extra</label><input type="text" value={step.link} onChange={(e) => updateStep(index, 'link', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none"/></div><div><label className="text-xs font-bold uppercase mb-1">Texto Botão</label><input type="text" value={step.buttonText} onChange={(e) => updateStep(index, 'buttonText', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none"/></div></div>}
              </div>
            </div>
          ))}
          <button onClick={addStep} className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-medium hover:border-blue-500 flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> Adicionar Etapa</button>
        </div>
      </main>
    </div>
  );
};

export default OnboardingConsultoria;