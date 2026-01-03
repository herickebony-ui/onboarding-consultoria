import React, { useState, useEffect } from 'react';

// 1. Firebase (Auth, Firestore, Storage)
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc, updateDoc, collection, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from "firebase/storage";

// 2. Conexão com seus Arquivos Novos
import { db, auth, storage } from './firebase'; 
import { generateSlug, formatUrl, buildMapsUrl, applyStudentValuesToContract } from './utils/utils';

// 3. Componentes Modularizados
import Dashboard from './components/Dashboard';
import StudentRegistration from './components/StudentRegistration';
import FinancialModule from './components/FinancialModule';
import VideoPlayerGlobal from './components/VideoPlayerGlobal';
import SignaturePad from './components/SignaturePad';
import RichTextEditor from './components/RichTextEditor';

// 4. Ícones (Mantenha os que você já tem do lucide-react)
import { 
  Copy, ChevronRight, ChevronLeft, CheckCircle, FileText, Smartphone, Download, 
  ExternalLink, Play, Settings, Plus, Trash2, Layout, Eye, MoveUp, MoveDown, 
  Image as ImageIcon, Upload, Bold, Italic, MapPin, Underline, Link as LinkIcon, 
  Monitor, Loader, ArrowLeft, Edit, Save, X, Lock, Users, Share2, Search, FileSignature, MoveVertical,
  Palette, Type 
} from 'lucide-react';

const OnboardingConsultoria = () => {
  const defaultSteps = [
    { id: 1, type: 'welcome', title: 'Boas-vindas', content: 'Bem-vindo ao time!', buttonText: '', link: '', coverImage: null, coverPosition: 50, images: [] }
  ];

  const [passwordInput, setPasswordInput] = useState("");

  const [emailInput, setEmailInput] = useState("");
  const [viewState, setViewState] = useState('loading'); 
  const [isAdminAccess, setIsAdminAccess] = useState(false);
  const [activePlanId, setActivePlanId] = useState(null);
  const [activeStudent, setActiveStudent] = useState(null);
  const [activeContract, setActiveContract] = useState(null);
const [activeContractId, setActiveContractId] = useState(null); 
  const [studentPhoneInput, setStudentPhoneInput] = useState(""); 
  const [availablePlans, setAvailablePlans] = useState([]);
  const [students, setStudents] = useState([]);

  const [coachName, setCoachName] = useState("Sua Consultoria");
  const [whatsappLink, setWhatsappLink] = useState("");
  const [finalTitle, setFinalTitle] = useState("Tudo Pronto!");
  const [finalMessage, setFinalMessage] = useState("Sucesso!");
  const [finalButtonText, setFinalButtonText] = useState("Continuar");

  const [steps, setSteps] = useState(defaultSteps);
  const [currentStep, setCurrentStep] = useState(0);
  // --- ÍNDICE (ALUNO) + AVISO DE ORDEM ---
  const [isIndexOpen, setIsIndexOpen] = useState(false);
  const [pendingJumpIndex, setPendingJumpIndex] = useState(null);
  const [showOrderWarning, setShowOrderWarning] = useState(false);
  const [showOrderHint, setShowOrderHint] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [videoEmbedUrl, setVideoEmbedUrl] = useState("");

  const jumpToStep = (idx) => {
    // mesma etapa: só fecha
    if (idx === currentStep) { 
      setIsIndexOpen(false); 
      return; 
    }
    const getYoutubeEmbedUrl = (url) => {
      if (!url) return "";
    
      // youtu.be/ID
      let match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
      if (match?.[1]) return `https://www.youtube.com/embed/${match[1]}`;
    
      // watch?v=ID
      match = url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
      if (match?.[1]) return `https://www.youtube.com/embed/${match[1]}`;
    
      // shorts/ID
      match = url.match(/shorts\/([a-zA-Z0-9_-]{6,})/);
      if (match?.[1]) return `https://www.youtube.com/embed/${match[1]}`;
    
      // embed/ID
      match = url.match(/embed\/([a-zA-Z0-9_-]{6,})/);
      if (match?.[1]) return `https://www.youtube.com/embed/${match[1]}`;
    
      return "";
    };
    
    const openVideoModal = (youtubeUrl) => {
      const embed = getYoutubeEmbedUrl(youtubeUrl);
      if (!embed) {
        // se não for link válido, abre normal
        window.open(youtubeUrl, "_blank");
        return;
      }
      setVideoEmbedUrl(`${embed}?autoplay=1&rel=0`);
      setIsVideoOpen(true);
    };
    
    const closeVideoModal = () => {
      setIsVideoOpen(false);
      setVideoEmbedUrl(""); // mata o vídeo pra parar o som
    };    
    // Se estiver pulando etapas para frente, avisa
    if (idx > currentStep + 1) {
      setPendingJumpIndex(idx);
      setShowOrderWarning(true);
      setShowOrderHint(true); // mostra a faixa amarela
      return;
    }

    setCurrentStep(idx);
    setIsIndexOpen(false);
    window.scrollTo(0, 0);
  };

  const confirmJumpAnyway = () => {
    if (pendingJumpIndex === null) {
      setShowOrderWarning(false);
      return;
    }
    setShowOrderHint(true);
    setCurrentStep(pendingJumpIndex);
    setPendingJumpIndex(null);
    setShowOrderWarning(false);
    setIsIndexOpen(false);
    window.scrollTo(0, 0);
  };

  const cancelJump = () => {
    setPendingJumpIndex(null);
    setShowOrderWarning(false);
  };
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
    // Evita IDs duplicados
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
  const handleUpdatePlanColor = async (id, newColor) => {
    if(!db) return;
    try {
      await updateDoc(doc(db, "onboarding", id), { color: newColor });
      // Atualiza a lista localmente para ver a cor na hora
      setAvailablePlans(prev => prev.map(p => p.id === id ? { ...p, color: newColor } : p));
    } catch (e) { console.error("Erro ao salvar cor", e); }
  };
  // 5. Função de EDITAR (Abrir o editor)
  const handleEditPlan = async (id) => {
    setActivePlanId(id);
    await loadPlan(id);
    setViewState('editor');
  };
  
  // --- ⬇️ LÓGICA DE ASSINATURA DO ALUNO (COLE AQUI) ⬇️ ---
  const [signatureData, setSignatureData] = useState(null);
  const [studentFieldValues, setStudentFieldValues] = useState({});

// --- FUNÇÃO ATUALIZADA: SALVAR ASSINATURA NO LUGAR CERTO ---
const handleSignContract = async () => {
  if (!activeStudent || !db) return;

  // 1. Validação de Campos Pendentes
  const pending = Array.isArray(activeStudent?.pendingFields) ? activeStudent.pendingFields : [];
  const requiredKeys = pending
    .filter(f => f?.owner === "student" && f?.key)
    .map(f => f.key);
  const missing = requiredKeys.filter((k) => !String(studentFieldValues?.[k] ?? "").trim());

  if (missing.length > 0) {
    const firstMissing = pending.find(f => f.key === missing[0]);
    alert(`Por favor, preencha: ${firstMissing?.label || missing[0]}`);
    return;
  }

  if (!signatureData) {
    alert("Por favor, faça sua assinatura.");
    return;
  }

  try {
    setViewState("loading");

    // 2. Captura de Metadados (IP, Data)
    let userIP = "Não identificado";
    try {
      const ipReq = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipReq.json();
      userIP = ipData.ip;
    } catch (err) { console.warn("Sem IP", err); }

    const userAgent = navigator.userAgent; 
    const timestamp = new Date().toISOString();

    const signatureObj = { image: signatureData, signedAt: timestamp, ip: userIP, userAgent };
    const finalStudentData = { ...studentFieldValues, signedAt: timestamp, ipAddress: userIP, deviceInfo: userAgent };

    // 3. ATUALIZAÇÃO INTELIGENTE (Contrato Novo vs Legado)
    if (activeContractId && activeContractId !== "legacy") {
        // --- CENÁRIO NOVO: Atualiza na coleção 'contracts' ---
        await updateDoc(doc(db, "contracts", activeContractId), {
            status: "signed",
            studentData: finalStudentData,
            signature: signatureObj
        });

        // Atualiza o Aluno para refletir que ESTE contrato está assinado
        await updateDoc(doc(db, "students", activeStudent.id), {
            latestContractStatus: "signed",
            status: "signed", // Libera o acesso verde
            // Salva uma cópia da assinatura no aluno para facilitar a exibição
            signature: signatureObj 
        });

    } else {
        // --- CENÁRIO LEGADO (Antigo) ---
        await updateDoc(doc(db, "students", activeStudent.id), {
            status: "signed",
            latestContractStatus: "signed",
            studentData: finalStudentData,
            signature: signatureObj
        });
    }

    // 4. Feedback e Redirecionamento
    // Atualiza o estado local para o usuário não precisar dar F5
    setActiveStudent(prev => ({ 
        ...prev, 
        status: "signed",
        signature: signatureObj 
    }));
    
    // Tenta carregar o plano (se tiver onboarding)
    if (activeStudent.planId) {
        await loadPlan(activeStudent.planId);
        setViewState("student_view_flow");
    } else {
        // Se for só contrato (sem onboarding), mostra mensagem final
        alert("Contrato assinado com sucesso! Você já pode fechar esta página ou baixar sua cópia.");
        setViewState("student_view_flow"); // Ou uma tela de 'Obrigado' se preferir
    }

  } catch (e) {
    console.error(e);
    alert("Erro ao salvar assinatura: " + e.message);
    setViewState("student_login");
  }
};

// --- FUNÇÃO ATUALIZADA: CARREGA O CONTRATO NOVO ANTES DE ENTRAR ---
const handleStudentLoginV2 = async () => {
  if (!activeStudent) {
      alert("Erro: Dados do aluno não carregados. Recarregue a página.");
      return;
  }

  // Limpeza rigorosa dos números para comparação
  const phoneInputClean = studentPhoneInput.replace(/\D/g, '');
  const studentPhoneClean = activeStudent.phone.replace(/\D/g, '');
  
  // Comparação frouxa (evita erro de DDD)
  if (phoneInputClean === studentPhoneClean || studentPhoneClean.endsWith(phoneInputClean)) {
      
      // 1. Salva na sessão
      sessionStorage.setItem('ebony_student_phone', studentPhoneClean);

      // 2. Direcionamento
      if (activeStudent.status === 'signed') {
          // Se já assinou, carrega o plano normal
          await loadPlan(activeStudent.planId);
          setViewState('student_view_flow');
      } else {
          // --- AQUI ESTÁ A CORREÇÃO ---
          // Antes de ir para a tela de assinatura, BUSCAMOS o texto do contrato na coleção nova
          setViewState("loading");
          
          try {
             let contractData = null;
             let contractId = null;

             // Cenário A: Contrato Novo (Coleção contracts)
             if (activeStudent.latestContractId) {
                 const contractSnap = await getDoc(doc(db, "contracts", activeStudent.latestContractId));
                 if (contractSnap.exists()) {
                     contractData = contractSnap.data();
                     contractId = contractSnap.id;
                 }
             }
             
             // Cenário B: Legado (Texto dentro do aluno)
             if (!contractData && activeStudent.contractText) {
                 contractData = { contractText: activeStudent.contractText };
                 contractId = "legacy";
             }

             if (contractData) {
                 setActiveContract(contractData);
                 setActiveContractId(contractId); // Importante para salvar a assinatura depois
                 setViewState('contract_sign');
             } else {
                 alert("Aviso: Nenhum contrato pendente foi encontrado para este cadastro.");
                 setViewState('student_login');
             }

          } catch (error) {
             console.error("Erro ao buscar contrato:", error);
             alert("Erro de conexão ao buscar contrato.");
             setViewState('student_login');
          }
      }
  } else {
      alert(`Número incorreto. O número cadastrado termina em: ...${studentPhoneClean.slice(-4)}`);
  }
};
  // --- ⬆️ FIM DA LÓGICA DE ASSINATURA ⬆️ ---

  // --- ⬆️ FIM DO BLOCO ⬆️ ---

  // --- LOGINS ---
  const handleAdminLogin = async () => {
    // Use um email/senha que você criou lá no Console do Firebase > Authentication
    // Ou mude aqui para pegar de inputs de email/senha se preferir.
    // Por enquanto, para facilitar sua transição, vou manter fixo aqui mas validando no servidor:
    const emailAdmin = "admin@teamebony.com"; 
    
    if (!passwordInput) return alert("Digite a senha.");
  
    try {
      await signInWithEmailAndPassword(auth, emailAdmin, passwordInput);
      setIsAdminAccess(true);
      sessionStorage.setItem('ebony_admin', 'true');
      
      await Promise.all([loadAllPlans(), loadAllStudents()]);
      setViewState('dashboard');
    } catch (error) {
      console.error(error);
      alert("Acesso negado. Verifique a senha.");
    }
  };

  const handleStudentLogin = async () => {
    const phoneClean = studentPhoneInput.replace(/\D/g, '');
    const registeredPhone = activeStudent.phone.replace(/\D/g, '');
    
    if (phoneClean === registeredPhone) {
        if (activeStudent.status === 'signed') {
            await loadPlan(activeStudent.planId);
            setViewState('student_view_flow');
        } else {
            alert("Login correto! Próxima etapa: Tela de Assinatura de Contrato.\n(Esta parte será implementada no próximo passo)");
            // setViewState('contract_sign'); 
        }
    } else {
        alert("Número de WhatsApp não confere com o cadastro deste convite.");
    }
  };

  // --- MICROCIRURGIA 03: O GATILHO INICIAL ---
  // Isso verifica se tem usuário logado ao abrir o site.
  // Sem isso, o sistema fica no "loading" para sempre.
// --- MICROCIRURGIA: GATILHO INICIAL (CORRIGIDO: PRIORIDADE PARA LINKS) ---
useEffect(() => {
  // 1. Captura parâmetros da URL IMEDIATAMENTE
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get("token"); // Link do Aluno
  const urlFlowId = params.get("id");   // Link do Fluxo (Público)

  const unsubscribe = auth.onAuthStateChanged(async (user) => {
    
    // PRIORIDADE 1: LINK DE ALUNO (token)
    // Se tiver token na URL, ignora o admin logado e abre a tela do aluno
    if (urlToken) {
       try {
         setViewState("loading");
         const snap = await getDoc(doc(db, "students", urlToken));

         if (!snap.exists()) {
           alert("Link inválido ou aluno não encontrado.");
           setViewState("login");
           return;
         }

         const st = { id: snap.id, ...snap.data() };
         setActiveStudent(st);
         setStudentPhoneInput("");
         
         // Manda para o login do aluno
         setViewState("student_login");
       } catch (err) {
         console.error("Erro token:", err);
         setViewState("login");
       }
       return; // PÁRA AQUI! Não deixa carregar o Dashboard.
    }

    // PRIORIDADE 2: LINK DE FLUXO PÚBLICO (id)
    // Se tiver ID de fluxo, abre o fluxo (mesmo com admin logado)
    if (urlFlowId) {
       try {
         setViewState("loading");
         await loadPlan(urlFlowId); // Carrega o plano público
         setActiveStudent(null);    // Garante que não tem aluno preso na memória
         setViewState("student_view_flow"); // Abre a visão do fluxo
       } catch(err) {
         console.error("Erro fluxo:", err);
         setViewState("login");
       }
       return; // PÁRA AQUI!
    }

    // PRIORIDADE 3: ADMIN LOGADO
    // Só entra aqui se NÃO tiver link na URL
    if (user) {
      console.log("Admin logado:", user.email);
      setIsAdminAccess(true);
      try {
          await Promise.all([loadAllPlans(), loadAllStudents()]);
          setViewState('dashboard');
      } catch (error) {
          console.error("Erro ao carregar dados iniciais", error);
          setViewState('dashboard');
      }
    } else {
      // PRIORIDADE 4: NINGUÉM LOGADO E SEM LINK
      setViewState("login");
    }
  });
  
  // Funções auxiliares (Mantidas para funcionar o escopo)
  const loadStudentById = async (id) => {
    const snap = await getDoc(doc(db, "students", id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  };
  
  return () => unsubscribe();
}, []);
  // --- FIRESTORE ALUNOS ---
  const loadAllStudents = async () => {
    if (!db) return;
    try {
      const q = await getDocs(collection(db, "students"));
      const list = q.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(list);
    } catch (e) { console.error("Erro alunos", e); }
  };

  const onCreateStudent = async (data) => {
    // ✅ mantenha a trava do db (só melhora a mensagem)
    if (!db) {
      alert("Erro: banco não iniciado. Recarregue a página e tente novamente.");
      return;
    }
  
    try {
      // ✅ agora só exige nome (plano NÃO é obrigatório)
      if (!data?.name || !String(data.name).trim()) {
        alert("Erro: Nome do aluno é obrigatório.");
        return;
      }
  
      // ✅ garante strings (evita crash no .replace do login)
      const safePhone = String(data.phone || "");
      const safeEmail = String(data.email || "");
      const safeCpf = String(data.cpf || "");
  
      const newStudentRef = doc(collection(db, "students"));
  
      const finalData = {
        ...data,
  
        id: newStudentRef.id,
  
        name: String(data.name).trim(),
        phone: safePhone,   // pode ser "" (aluno sem telefone ainda)
        email: safeEmail,
        cpf: safeCpf,
  
        // ✅ vínculos opcionais (ponto-chave)
        planId: data.planId ? data.planId : null,
        latestContractId: data.latestContractId ? data.latestContractId : null,
  
        // ✅ status coerente com “aluno solto”
        status: data.planId ? (data.status || "pending_contract") : "student_only",
  
        createdAt: data.createdAt || new Date().toISOString(),
      };
  
      await setDoc(newStudentRef, finalData);
  
      await loadAllStudents();
      alert("Aluno cadastrado com sucesso! (sem vínculo obrigatório)");
    } catch (e) {
      console.error("ERRO FIREBASE:", e);
      alert("Erro ao criar aluno: " + e.message);
    }
  };  

  const handleDeleteStudent = async (id) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, "students", id));
      await loadAllStudents();
    } catch (e) { alert("Erro ao deletar"); }
  }
  // --- FUNÇÃO DE CHECK (MATERIAL ENTREGUE) - NO LUGAR CERTO ---
  const toggleMaterialDelivered = async (student) => {
    if (!db) return;

    const newStatus = !student.materialDelivered;

    // 1. Atualiza visualmente NA HORA
    setStudents(currentList => 
        currentList.map(item => 
            item.id === student.id ? { ...item, materialDelivered: newStatus } : item
        )
    );

    try {
        // 2. Salva no Banco de Dados (para não perder no F5)
        await updateDoc(doc(db, "students", student.id), {
            materialDelivered: newStatus
        });
    } catch (error) {
        console.error("Erro ao salvar status:", error);
        alert("Erro ao salvar no sistema. A alteração será desfeita.");
        loadAllStudents(); 
    }
  };
  // --- FIRESTORE PLANOS ---
  const loadAllPlans = async () => {
    try {
      // Removemos a trava "if (!db)" para forçar a leitura
      const querySnapshot = await getDocs(collection(db, "onboarding"));
      const plansList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAvailablePlans(plansList);
    } catch (error) { 
      console.error("Tentando conectar...", error);
      // Se der erro (banco não pronto), tenta de novo em 1 segundo
      setTimeout(loadAllPlans, 1000);
    }
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
      // CORREÇÃO URGENTE:
      // Mudamos de setDoc (que apaga tudo) para updateDoc (que só atualiza o necessário).
      // Removemos o campo "name" daqui para ele NÃO mexer no nome do Dashboard.
      await updateDoc(doc(db, "onboarding", activePlanId), { 
        coachName, 
        whatsappLink, 
        finalTitle, 
        finalMessage, 
        finalButtonText, 
        steps 
      });
      alert("✅ Fluxo salvo com sucesso! (Cor e Nome mantidos)");
    } catch (error) { 
      alert("Erro ao salvar."); 
      console.error(error); 
    } finally { 
      setIsSaving(false); 
    }
  };

  // --- FUNÇÕES DE NAVEGAÇÃO E EDITOR ---
  const updateStep = (index, field, value) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };
  const renderVideoPreview = (url) => {
    const u = (url || "").trim();
    if (!u) return null;
  
    // YouTube: https://www.youtube.com/watch?v=ID  ou  https://youtu.be/ID
    const yt = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    if (yt) {
      const src = `https://www.youtube.com/embed/${yt[1]}`;
      return (
        <iframe
          className="w-full h-full"
          src={src}
          title="Vídeo"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }
  
    // Vimeo: https://vimeo.com/123456789
    const vimeo = u.match(/vimeo\.com\/(\d+)/);
    if (vimeo) {
      const src = `https://player.vimeo.com/video/${vimeo[1]}`;
      return (
        <iframe
          className="w-full h-full"
          src={src}
          title="Vídeo"
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      );
    }
  
    // Link direto mp4/webm/ogg
    if (u.match(/\.(mp4|webm|ogg)(\?.*)?$/i)) {
      return <video className="w-full h-full" src={u} controls />;
    }
  
    // fallback
    return (
      <a className="text-blue-600 underline" href={u} target="_blank" rel="noreferrer">
        Abrir vídeo
      </a>
    );
  };  
  const removeCover = (index) => {
    const newSteps = [...steps];
    // Remove a imagem e reseta a posição para o meio
    newSteps[index] = { ...newSteps[index], coverImage: null, coverPosition: 50 };
    setSteps(newSteps);
  };
  
  const moveStep = (index, direction) => {
    let newIndex = index; // Variável para saber para onde ele foi

    if (direction === 'up' && index > 0) {
      const newSteps = [...steps];
      [newSteps[index], newSteps[index - 1]] = [newSteps[index - 1], newSteps[index]];
      setSteps(newSteps);
      newIndex = index - 1; // Foi para cima
    } else if (direction === 'down' && index < steps.length - 1) {
      const newSteps = [...steps];
      [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
      setSteps(newSteps);
      newIndex = index + 1; // Foi para baixo
    }

    // --- LÓGICA DO PULO IMEDIATO ---
    // O setTimeout espera o React redesenhar a tela (50ms) antes de pular
    setTimeout(() => {
      const element = document.getElementById(`step-${newIndex}`);
      if (element) {
        // Calcula a posição do elemento menos 100px (para não ficar atrás do menu fixo)
        const y = element.getBoundingClientRect().top + window.scrollY - 100;
        
        // Pula instantaneamente (behavior: 'auto')
        window.scrollTo({ top: y, behavior: 'auto' });
      }
    }, 50);
  };

  const removeStep = (index) => {
    if (steps.length <= 1) return alert("Você precisa ter pelo menos uma etapa.");
    const newSteps = steps.filter((_, i) => i !== index);
    setSteps(newSteps);
  };

// --- UPLOAD DE CAPA OTIMIZADO (COMPRESSÃO AUTOMÁTICA) ---
const handleCoverUpload = async (index, e) => {
  const file = e.target.files[0];
  if (!file) return;

  const labelElement = e.target.parentElement.querySelector('span');
  if (labelElement) {
      labelElement.innerText = "Otimizando e Enviando...";
      labelElement.className = "text-xs font-bold text-blue-600 animate-pulse";
  }

  try {
    if (!storage) throw new Error("Storage não iniciado");

    // 1. OTIMIZAÇÃO DE IMAGEM (Reduz de 5MB para ~150KB)
    const compressedFile = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200; // Largura máxima (HD)
          const scaleSize = MAX_WIDTH / img.width;
          
          // Se a imagem for menor que o limite, não mexe
          if (scaleSize >= 1) {
              resolve(file); 
              return;
          }

          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Transforma em arquivo leve (JPEG 80% qualidade)
          canvas.toBlob((blob) => {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.8);
        };
      };
    });

    // 2. ENVIO PARA NUVEM
    const storageRef = ref(storage, `capas/${Date.now()}-${file.name}`);
    const snapshot = await uploadBytes(storageRef, compressedFile);
    const url = await getDownloadURL(snapshot.ref);
    
    // 3. SALVAR LINK
    updateStep(index, 'coverImage', url);
    
    // Feedback Visual
    if (labelElement) {
        labelElement.innerText = "Sucesso!";
        setTimeout(() => { 
           if(labelElement) labelElement.innerText = "Carregar Capa"; 
           if(labelElement) labelElement.className = "text-xs text-gray-500 font-medium";
        }, 2000);
    }

  } catch (error) {
    console.error("Erro no upload:", error);
    alert("Erro ao enviar imagem: " + error.message);
    if (labelElement) labelElement.innerText = "Erro no envio";
  }
};

// --- UPLOAD DE GALERIA COM BARRA DE PROGRESSO ---
const handleImageUpload = async (index, e) => {
  const file = e.target.files[0];
  if (!file) return;

  const labelElement = e.target.parentElement.querySelector('span');
  const originalText = "Add Imagem";

  try {
    if (!storage) throw new Error("Storage não iniciado");

    // 1. OTIMIZAÇÃO (Mantemos seu código de compressão que estava ótimo)
    if (labelElement) labelElement.innerText = "Comprimindo...";
    
    const compressedFile = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200; 
          const scaleSize = MAX_WIDTH / img.width;
          
          if (scaleSize >= 1) { resolve(file); return; }

          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          canvas.toBlob((blob) => {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.8);
        };
      };
    });

    // 2. UPLOAD COM PROGRESSO
    const storageRef = ref(storage, `galeria/${Date.now()}-${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, compressedFile);

    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (labelElement) {
            labelElement.innerText = `${Math.round(progress)}%`;
            labelElement.className = "text-xs font-bold text-blue-600";
        }
      }, 
      (error) => {
        console.error(error);
        alert("Erro no upload");
        if (labelElement) labelElement.innerText = "Erro";
      }, 
      async () => {
        // Upload completo
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        const currentImages = steps[index].images || [];
        updateStep(index, 'images', [...currentImages, url]);
        
        if (labelElement) {
            labelElement.innerText = originalText;
            labelElement.className = "text-xs text-gray-500 font-medium";
        }
      }
    );

  } catch (error) {
    console.error("Erro no upload:", error);
    alert("Erro: " + error.message);
    if (labelElement) labelElement.innerText = "Erro!";
  }
};

  const removeImage = (stepIndex, imgIndex) => {
    const currentImages = steps[stepIndex].images || [];
    const newImages = currentImages.filter((_, i) => i !== imgIndex);
    updateStep(stepIndex, 'images', newImages);
  };

  const handlePdfUpload = (index, e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const newSteps = [...steps];
      newSteps[index] = { ...newSteps[index], pdfData: url, pdfName: file.name };
      setSteps(newSteps);
    }
  };

  const removePdf = (index) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], pdfData: null, pdfName: null };
    setSteps(newSteps);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    } else {
      setIsCompleted(true);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  };
  
  if (viewState === 'dashboard') {
    return (
      <Dashboard 
        plans={availablePlans} 
        onSelectPlan={handleEditPlan}            
        onCreatePlan={handleCreatePlan}         
        onDeletePlan={handleDeletePlan}         
        onDuplicatePlan={handleDuplicatePlan}   
        onUpdatePlanMeta={handleUpdatePlanMetadata} 
        
        // ADICIONE ESTA LINHA AQUI:
        onUpdatePlanColor={handleUpdatePlanColor} 
        
        students={students}
        onCreateStudent={onCreateStudent}
        onDeleteStudent={handleDeleteStudent}
        onReloadData={loadAllStudents}

        onToggleDelivery={toggleMaterialDelivered}
        onOpenFinancial={() => setViewState('financial')}
      />
    );
  }

  // --- TELA: MÓDULO FINANCEIRO ---
  if (viewState === 'financial') {
    return (
      <FinancialModule 
        db={db} // IMPORTANTE: Passar o banco de dados
        user={auth.currentUser} // Se precisar de autenticação
        onBack={() => setViewState('dashboard')} // Botão de voltar
      />
    );
  }
  // --- RENDERIZAÇÃO ---

  if (viewState === 'loading') return <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5]"><Loader className="w-8 h-8 animate-spin text-gray-400"/></div>;
  
  // TELA 0: PRÉ-CADASTRO
  if (viewState === 'public_register') {
    return <StudentRegistration db={db} />;
  }
  // TELA 1: LOGIN ADMIN
// --- TELA DE LOGIN (Substitua o bloco if (viewState === 'login') inteiro) ---
if (viewState === 'login') return (
  <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F7F5] p-4 font-sans">
    <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-500">
      <div className="bg-black p-8 text-center">
        <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center mx-auto mb-4 shadow-inner">
          <span className="text-white font-bold text-lg tracking-wider">ON</span>
        </div>
        <h2 className="text-white text-lg font-bold">Gestão Consultoria Team Ebony</h2>
        <p className="text-gray-400 text-xs mt-1 uppercase tracking-widest opacity-80">Acesso Administrativo</p>
      </div>
      
      <div className="p-8 pt-10 space-y-5">
          
          {/* CAMPO DE E-MAIL (NOVO) */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">E-mail</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {/* Se tiver importado Mail do lucide-react, use <Mail />. Senão use <Users /> */}
                <Users className="h-5 w-5 text-gray-300 group-focus-within:text-black transition-colors" />
              </div>
              <input 
                type="email" 
                placeholder="admin@teamebony.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>

          {/* CAMPO DE SENHA */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">Senha</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-300 group-focus-within:text-black transition-colors" />
              </div>
              <input 
                type="password" 
                placeholder="••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>

          <button 
            onClick={handleAdminLogin} 
            className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-all transform active:scale-[0.98]"
          >
            Entrar no Sistema
            <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
          </button>
      </div>

      <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 text-center">
        <p className="text-[10px] text-gray-400">Área restrita para treinadores.</p>
      </div>
    </div>
    <p className="mt-8 text-xs text-gray-400 font-medium opacity-50">Consultoria Ebony Team © 2025</p>
  </div>
);


  // TELA 3: LOGIN DO ALUNO
  if (viewState === 'student_login') return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5] p-4 font-sans">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center animate-in zoom-in">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Smartphone className="w-8 h-8"/>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Olá, {activeStudent?.name?.split(' ')[0] || "Olá"}!</h2>
        <p className="text-sm text-gray-500 mb-6">Para confirmar sua identidade e acessar seu contrato, digite seu WhatsApp cadastrado com DDD e o 9 na frente.</p>
        
        <input 
          type="tel" 
          placeholder="(DDD) 90000-0000" 
          value={studentPhoneInput} 
          onChange={e=>setStudentPhoneInput(e.target.value)} 
          onKeyDown={e=>e.key==='Enter'&&handleStudentLoginV2()}
          className="w-full p-4 border border-gray-200 rounded-xl mb-4 focus:ring-2 focus:ring-black outline-none text-center text-lg tracking-widest font-bold bg-gray-50 transition-all"
        />
        
        <button 
          onClick={handleStudentLoginV2}
          className="w-full py-4 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-lg active:scale-95"
        >
          Acessar
        </button>
      </div>
    </div>
  );

  if (viewState === 'contract_sign') {
    const baseHTML = activeContract?.contractText || "<div style='padding:40px; text-align:center; color:red; font-weight:bold;'>⚠️ ERRO: O texto do contrato não foi gerado. O treinador precisa salvar a minuta no Dashboard primeiro.</div>";

    // campos do modelo que são do aluno
    const pending = Array.isArray(activeStudent?.pendingFields) ? activeStudent.pendingFields : [];

    // AQUI ESTÁ A MÁGICA: Junta o que ele digita com o que JÁ ESTÁ SALVO (que você corrigiu)
    const mergedValues = {
      // chaves no formato que teus templates usam:
      nome: activeStudent.name || "",
      telefone: activeStudent.phone || "",
      cpf: activeStudent.cpf || "",
      rg: activeStudent.rg || "",
      email: activeStudent.email || "",
      endereco: activeStudent.address || "",
      profissao: activeStudent.profession || "",
      nascimento: activeStudent.birthDate
        ? new Date(activeStudent.birthDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
        : "",
    
      // campos extras que o aluno digitar (se teu template tiver)
      ...studentFieldValues,
    };
    

    // monta HTML do contrato já preenchido
    const contractDisplay = applyStudentValuesToContract(baseHTML, mergedValues);

    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-8">
        <div className="bg-black p-6 text-white text-center">
          <h1 className="text-2xl font-bold">Contrato de Prestação de Serviços</h1>
          <p className="text-gray-400 text-sm mt-1">Leia atentamente e assine ao final</p>
        </div>

        <div className="p-6 md:p-10 space-y-8">

          {/* Campos dinâmicos do template (todos os outros) */}
          {pending.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              {pending
                .filter((f) => f?.owner === "student")
                // evita duplicar se teu template também tiver cpf_aluno/endereco_aluno
                .filter((f) => !["cpf_aluno", "endereco_aluno"].includes(f.key))
                .map((field, idx) => (
                  <div key={idx}>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      {field.label}
                    </label>

                    <input
                      type={field.type === "date" ? "date" : "text"}
                      value={studentFieldValues[field.key] || ""}
                      onChange={(e) =>
                        setStudentFieldValues((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                      className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-black transition-colors"
                      placeholder={`Digite ${field.label}...`}
                    />
                  </div>
                ))}
            </div>
          )}

          {/* Texto do Contrato (render HTML certo) */}
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 h-64 overflow-y-auto">
            <div
              className="prose prose-sm max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ __html: contractDisplay }}
            />
          </div>

          {/* Assinatura */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2">
              <FileSignature className="w-4 h-4" /> Sua Assinatura (Desenhe abaixo)
            </label>

            <SignaturePad onSave={setSignatureData} onClear={() => setSignatureData(null)} />
            <p className="text-[10px] text-gray-400 mt-2 text-right">
              Ao assinar, você concorda com os termos acima.
            </p>
          </div>

          {/* Botão Final */}
          <button
            onClick={handleSignContract}
            className="w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all bg-black text-white hover:bg-gray-800 hover:shadow-xl active:scale-95"
          >
            Assinar e acessar o Onboarding
          </button>
        </div>
      </div>
    </div>
  );
}

// --- FUNÇÃO DE RENDERIZAÇÃO DO CONTEÚDO (VISÃO DO ALUNO) ---
const renderStepContent = (step) => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    {step.coverImage && (
      <div className="-mx-6 -mt-6 md:-mx-10 md:-mt-10 mb-6 relative group bg-gray-50">
        <img 
          src={step.coverImage} 
          alt="Capa" 
          className="w-full h-auto object-cover rounded-t-2xl shadow-sm transition-all duration-300" 
          style={{ 
            objectPosition: `center ${step.coverPosition || 50}%`,
            maxHeight: '400px' 
          }}
        />
      </div>
    )}
    <h2 className="text-2xl font-bold text-gray-900">{step.title}</h2>
    <div className="text-lg text-gray-600 prose prose-gray max-w-none prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline" dangerouslySetInnerHTML={{ __html: step.content }} />
    
    {/* --- AQUI ESTÁ A MUDANÇA DA GALERIA --- */}
    {step.images && step.images.length > 0 && (
      // Mudança 1: Força 2 colunas no mobile, 3 no tablet, 4 no PC
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 my-8">
        {step.images.map((img, idx) => img && (
          // Mudança 2: Altura h-64 (mais compacta) e "group" para o hover
          <div key={idx} className="relative group bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-center overflow-hidden h-64 shadow-sm hover:shadow-md transition-all">
              {/* Mudança 3: Efeito de zoom suave no hover */}
              <img src={img} alt="" className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" />
          </div>
        ))}
      </div>
    )}
    {/* --- FIM DA MUDANÇA --- */}
    {(step.type === 'text' || step.type === 'welcome') && (step.linkExtra || step.link) && (
      <a
        href={formatUrl(step.linkExtra || step.link)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 text-blue-600 hover:underline font-medium mt-4"
      >
        {step.buttonText || "Acessar Link"} <ExternalLink className="w-4 h-4" />
      </a>
    )}

    {step.type === 'pdf' && (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mt-6">
        <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-red-100 text-red-600 rounded-lg"><FileText className="w-6 h-6" /></div><div><h3 className="font-bold text-gray-900">Arquivo para Download</h3><p className="text-sm text-gray-500">{step.pdfName || "Documento PDF"}</p></div></div>
        <a href={step.pdfData || formatUrl(step.link) || "#"} download={!!step.pdfData ? (step.pdfName || "documento.pdf") : undefined} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"><Download className="w-4 h-4" />{step.buttonText || "Baixar Arquivo"}</a>
      </div>
    )}
    {step.type === 'location' && (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mt-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
          <MapPin className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900">Localização</h3>
          <p className="text-sm text-gray-500">
            Toque no botão para abrir no Google Maps.
          </p>
        </div>
      </div>

      {step.location ? (
        <a
          href={buildMapsUrl(step.location)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold"
        >
          {step.buttonText || "Abrir no Google Maps"}
          <ExternalLink className="w-4 h-4" />
        </a>
      ) : (
        <div className="text-sm text-red-600 font-bold">
          Localização não configurada nesta etapa.
        </div>
      )}
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
      <div className="mt-6">
        <div className="relative bg-black aspect-video rounded-xl overflow-hidden shadow-lg border border-gray-200">
          {/* Usa o componente global que criamos */}
          <VideoPlayerGlobal url={step.videoUrl || step.link} />
        </div>
        
        {/* Botão de ação opcional abaixo do vídeo */}
        {step.buttonText && (
          <a 
            href={formatUrl(step.videoUrl || step.link)} 
            target="_blank" 
            rel="noreferrer" 
            className="block w-full text-center py-3 bg-blue-600 text-white rounded-lg font-bold mt-4 hover:bg-blue-700 transition-colors"
          >
            {step.buttonText}
          </a>
        )}
      </div>
    )}
  </div>
);

// --- RENDER FINAL (EDITOR OU ALUNO) ---
if (viewState === 'editor' || viewState === 'student_view_flow' || viewState === 'student_view_legacy') {

  // 🛑 TRAVA DE SEGURANÇA MÁXIMA (GUARDIÃO)
  // Se o sistema tentar abrir o EDITOR, ele verifica se existe a credencial de admin.
  // Se for um aluno (que não tem essa credencial), ele é bloqueado e enviado pro Login.
  if (viewState === 'editor') {
     const isAdmin = sessionStorage.getItem('ebony_admin') === 'true';
     if (!isAdmin) {
         // Não tem permissão? Redireciona para o login agora.
         setTimeout(() => setViewState('login'), 0); 
         return null; // Não renderiza nada administrativo
     }
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5] font-sans text-gray-900 relative pb-32">
      {/* HEADER DO EDITOR (SE TIVER) */}
      {viewState === 'editor' && (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-800">
               <button onClick={() => {loadAllPlans(); loadAllStudents(); setViewState('dashboard')}} className="p-2 hover:bg-gray-100 rounded-full mr-2"><ArrowLeft className="w-5 h-5"/></button>
               <h1 className="font-bold text-lg">Editando: <span className="text-blue-600">{activePlanId}</span></h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleSaveToCloud} disabled={isSaving} className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors shadow-sm ${isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}>{isSaving ? <Loader className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} <span className="hidden sm:inline">{isSaving ? "Salvando..." : "Salvar no Site"}</span></button>
              <button onClick={() => {setCurrentStep(0); setIsCompleted(false); setViewState('student_view_legacy');}} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"><Eye className="w-4 h-4" /> <span className="hidden sm:inline">Testar</span></button>
            </div>
          </div>
        </header>
      )}

        {/* HEADER DO ALUNO (SE TIVER) */}
        {viewState !== 'editor' && (
          <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200">
            
            {/* LINHA 1 */}
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
              
              {/* ESQUERDA: ON + Textos */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-lg">
                  ON
                </div>

                <div className="leading-tight">
                  <h1 className="text-sm font-bold text-gray-900">Onboarding</h1>
                  <p className="text-[10px] text-gray-500 font-medium">{coachName}</p>
                </div>
              </div>

              {/* DIREITA: PROGRESSO + TEMPO ESTIMADO ABAIXO */}
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-gray-500 uppercase">Progresso</span>

                <div className="w-28 h-2 bg-gray-200 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-black transition-all duration-500 ease-out"
                    style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                  />
                </div>

                {currentStep === 0 && (
                  <span className="mt-1 text-[10px] text-gray-400 font-medium">
                    Tempo estimado: 3–5 min
                  </span>
                )}
              </div>
            </div>

          </header>
        )}
{/* --- BOTÃO EXCLUSIVO DO MODO TESTE (PARA VOLTAR AO EDITOR) --- */}
{/* CORREÇÃO: Adicionado && isAdminAccess para garantir que alunos não vejam este botão */}
{viewState === 'student_view_legacy' && isAdminAccess && (
  <div className="fixed bottom-24 right-4 z-[9999] animate-in fade-in slide-in-from-right">
    <button
      onClick={() => setViewState('editor')}
      className="flex items-center gap-2 px-5 py-3 bg-red-600 text-white rounded-full font-bold shadow-2xl hover:bg-red-700 hover:scale-105 transition-all border-2 border-white"
    >
      <Edit className="w-4 h-4" />
      Sair do Teste
    </button>
  </div>
)}
{/* ÍCONE ÍNDICE - AJUSTADO (LINHAS IGUAIS + POSIÇÃO CERTA) */}
{viewState !== 'editor' && (
  // Container invisível que alinha com o conteúdo do site
  <div className="fixed top-[80px] left-0 w-full z-50 pointer-events-none">
    <div className="max-w-6xl mx-auto px-4">
      <button
        onClick={() => setIsIndexOpen((v) => !v)}
        // Tamanho reduzido (w-9 h-9), cor cinza médio (bg-gray-200), borda suave
        className="pointer-events-auto w-9 h-9 flex flex-col items-center justify-center gap-[3px] rounded-lg border border-gray-300 bg-gray-200 hover:bg-white shadow-sm transition-all"
        title="Abrir índice"
        aria-label="Abrir índice"
      >
        {/* Forçando altura de 2px exatos para evitar linha fina */}
        <span className="block w-4 h-[2px] bg-gray-500 rounded-full" />
        <span className="block w-4 h-[2px] bg-gray-500 rounded-full" />
        <span className="block w-4 h-[2px] bg-gray-500 rounded-full" />
      </button>
    </div>
  </div>
)}

{/* --- MODAL ÍNDICE (ALUNO) --- */}
{viewState !== 'editor' && isIndexOpen && (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-bold text-gray-900">Índice</h3>
        <button
          onClick={() => setIsIndexOpen(false)}
          className="p-1 hover:bg-gray-100 rounded-full"
          aria-label="Fechar"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto p-2">
        {steps.map((s, i) => (
          <button
            key={s.id ?? i}
            onClick={() => jumpToStep(i)}
            className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between hover:bg-gray-50 ${
              i === currentStep ? "bg-gray-100" : ""
            }`}
          >
            <div className="min-w-0">
              <div className="text-sm font-bold text-gray-900 truncate">
                {s.title || `Etapa ${i + 1}`}
              </div>
              {i === currentStep && (
                <div className="text-[10px] text-gray-500">Você está aqui</div>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        ))}
      </div>
    </div>
  </div>
)}
{/* --- MODAL VÍDEO (YOUTUBE EMBED) --- */}
{viewState !== 'editor' && isVideoOpen && (
  <div
    className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4"
    onClick={closeVideoModal}
  >
    <div
      className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-bold text-gray-900">Vídeo</h3>
        <button
          onClick={closeVideoModal}
          className="p-1 hover:bg-gray-100 rounded-full"
          aria-label="Fechar vídeo"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="p-3">
        <div className="relative w-full pt-[56.25%] rounded-xl overflow-hidden bg-black">
          <iframe
            className="absolute inset-0 w-full h-full"
            src={videoEmbedUrl}
            title="Vídeo explicativo"
            frameBorder="0"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  </div>
)}

{/* --- MODAL AVISO (PULAR ORDEM) --- */}
{viewState !== 'editor' && showOrderWarning && (
  <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-2">Recomendado seguir a ordem</h3>
      <p className="text-sm text-gray-600 mb-6">
        A gente recomenda seguir as etapas em sequência para não perder nada.
        Quer ir mesmo assim?
      </p>

      <div className="flex gap-2 justify-end">
        <button
          onClick={cancelJump}
          className="px-4 py-2 rounded-lg font-bold text-gray-600 hover:bg-gray-100"
        >
          Cancelar
        </button>
        <button
          onClick={confirmJumpAnyway}
          className="px-4 py-2 rounded-lg font-bold bg-black text-white hover:bg-gray-800"
        >
          Ir mesmo assim
        </button>
      </div>
    </div>
  </div>
)}

{/* CONTEÚDO PRINCIPAL */}
<main className={`max-w-6xl mx-auto px-4 py-8 transition-all ${viewState === 'editor' ? 'max-w-4xl' : 'flex flex-col justify-center min-h-[calc(100vh-160px)]'}`}>
              {viewState === 'editor' ? (
                <div className="space-y-8"> {/* Container Principal do Editor */}
                  
                  {/* Seção 1: Configurações Gerais */}
                  <div className="bg-gray-50 rounded-xl border border-gray-300 shadow-md overflow-hidden">
                    <div className="bg-[#850000] p-4 border-b border-[#850000]/30 flex items-center gap-3">
                      <Settings className="w-5 h-5 text-white" />
                      <h3 className="text-lg font-black text-white uppercase tracking-wide">
                        Configurações Gerais
                      </h3>
                    </div>

                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Consultoria</label>
                          <input 
                            type="text" 
                            value={coachName} 
                            onChange={(e) => setCoachName(e.target.value)} 
                            className="w-full p-2 border border-gray-300 rounded bg-white focus:ring-2 focus:ring-rose-900 outline-none transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Link do WhatsApp (Final)</label>
                          <input 
                            type="text" 
                            value={whatsappLink} 
                            onChange={(e) => setWhatsappLink(e.target.value)} 
                            className="w-full p-2 border border-gray-300 rounded bg-white focus:ring-2 focus:ring-rose-900 outline-none transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Seção 2: Configurações da Página Final */}
                  <div className="bg-gray-50 rounded-xl border border-gray-300 shadow-md overflow-hidden">
                    <div className="bg-[#850000] p-4 border-b border-[#850000] flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-white" />
                      <h3 className="text-lg font-black text-white uppercase tracking-wide">
                        Configurações da Página Final
                      </h3>
                    </div>

                    <div className="p-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                          <input 
                            type="text" 
                            value={finalTitle} 
                            onChange={(e) => setFinalTitle(e.target.value)} 
                            className="w-full p-2 border border-gray-300 rounded bg-white focus:ring-2 focus:ring-rose-900 outline-none transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Texto do Botão</label>
                          <input 
                            type="text" 
                            value={finalButtonText || ''} 
                            onChange={(e) => setFinalButtonText && setFinalButtonText(e.target.value)} 
                            className="w-full p-2 border border-gray-300 rounded bg-white focus:ring-2 focus:ring-rose-900 outline-none transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem Final</label>
                        <textarea 
                          value={finalMessage || ''} 
                          onChange={(e) => setFinalMessage && setFinalMessage(e.target.value)} 
                          rows={3}
                          className="w-full p-2 border border-gray-300 rounded bg-white focus:ring-2 focus:ring-rose-900 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Título da Seção de Etapas (Aparece apenas no editor) */}
                  <div className="space-y-4">
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-4">
                       <Layout className="w-4 h-4" /> Etapas do Fluxo ({steps.length})
                    </h2>

              {/* --- NAVEGAÇÃO RÁPIDA (Menu "Índice" Inteligente) --- */}
              <div className="group/menu fixed right-2 top-1/2 transform -translate-y-1/2 z-50 flex flex-col gap-6 hidden xl:flex p-4 rounded-2xl hover:bg-gray-50/80 transition-colors">
                {steps.map((s, i) => (
                  <a 
                    key={i} 
                    href={`#step-${i}`} 
                    className="group/item relative flex items-center justify-end"
                  >
                    {/* Título (Com limite de tamanho e "..." no final) */}
                    <span className="cursor-pointer absolute right-6 px-3 py-1.5 bg-gray-900 text-white text-[11px] font-bold rounded-lg opacity-0 translate-x-4 group-hover/menu:opacity-100 group-hover/menu:translate-x-0 transition-all duration-300 ease-out shadow-xl border border-gray-700 z-50 truncate max-w-[230px] hover:bg-rose-900">
                      {i + 1}. {s.title || "Sem Título"}
                    </span>
                    
                    {/* Bolinha */}
                    <div className="w-4 h-4 bg-gray-300 rounded-full border border-gray-400 group-hover/item:bg-[#850000] group-hover/item:border-[#850000] group-hover/item:scale-150 transition-all shadow-sm"></div>
                  </a>
                ))}
              </div>

              {steps.map((step, index) => (
                <div
                id={`step-${index}`}               
                key={step.id} 
                className="group bg-gray-50 rounded-xl border border-gray-300 shadow-md mb-8 overflow-visible transition-all hover:shadow-lg">            
                  {/* Cabeçalho da Etapa */}
                  <div className="bg-[#850000] p-4 border-b border-[#850000]/30 flex items-center justify-between sticky top-16 z-40 shadow-md">
                    <div className="flex items-center gap-3">
                      {/* O Número (Agora com fundo branco e texto vinho para inverter) */}
                      <span className="w-8 h-8 flex items-center justify-center bg-white text-rose-900 rounded-lg text-sm font-bold shadow-sm">
                        {index + 1}
                      </span>
                      
                      {/* Título (Texto BRANCO) */}
                      <span className="text-lg font-black text-white uppercase tracking-wide truncate max-w-[200px] sm:max-w-md">
                        {step.title || "Sem Título"}
                      </span>
                    </div>

                    {/* Botões (Ícones Brancos) */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveStep(index, 'up')} className="p-2 hover:bg-rose-800 rounded text-white transition-all">
                          <MoveUp className="w-5 h-5" />
                        </button>
                        <button onClick={() => moveStep(index, 'down')} className="p-2 hover:bg-rose-800 rounded text-white transition-all">
                          <MoveDown className="w-5 h-5" />
                        </button>
                        <button onClick={() => removeStep(index)} className="p-2 text-rose-200 hover:bg-red-600 hover:text-white rounded transition-all">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                  {/* Conteúdo da Etapa */}
                  <div className="p-5 grid gap-4">
                    
                    {/* --- IMAGEM DE CAPA COM BOTÃO DE EXCLUIR --- */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Imagem de Capa (Horizontal)</label>
                      {!step.coverImage ? (
                        <label className="cursor-pointer flex flex-col items-center justify-center h-24 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-500 bg-white transition-colors">
                          <ImageIcon className="w-6 h-6 text-gray-400 mb-2" />
                          <span className="text-xs text-gray-500 font-medium">Carregar Capa</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverUpload(index, e)}/>
                        </label>
                      ) : (
                        <div className="space-y-3">
                          <div className="relative rounded-lg overflow-hidden border border-gray-200 group bg-gray-100">
                            {/* AQUI ESTÁ O AJUSTE: h-80 (320px) para ficar igual ao site real */}
                            <img 
                              src={step.coverImage} 
                              alt="Capa" 
                              className="w-full h-80 object-cover transition-all" 
                              style={{ objectPosition: `center ${step.coverPosition || 50}%` }}
                            />
                            
                            {/* BOTÃO DE EXCLUIR (Com onMouseDown para garantir o clique) */}
                            <button 
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault(); 
                                e.stopPropagation();
                                removeCover(index);
                              }} 
                              className="absolute top-2 right-2 w-8 h-8 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 flex items-center justify-center z-50 cursor-pointer transition-transform hover:scale-110"
                              title="Remover Capa"
                            >
                              <Trash2 className="w-4 h-4 pointer-events-none"/>
                            </button>
                          </div>

                          {/* Slider de Posição */}
                          <div className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200">
                            <MoveVertical className="w-4 h-4 text-gray-400" />
                            <div className="flex-1">
                              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Ajustar Posição Vertical</label>
                              <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                value={step.coverPosition || 50} 
                                onChange={(e) => updateStep(index, 'coverPosition', e.target.value)} 
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-8 text-right">{step.coverPosition || 50}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* --- FIM IMAGEM DE CAPA --- */}

                    {/* Título e Tipo */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título</label>
                        <input type="text" value={step.title} onChange={(e) => updateStep(index, 'title', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md font-medium outline-none"/>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo</label>
                        <select value={step.type} onChange={(e) => updateStep(index, 'type', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white outline-none">
                          <option value="text">Texto</option>
                          <option value="welcome">Boas-vindas</option>
                          <option value="pdf">PDF</option>
                          <option value="video">Vídeo</option>
                          <option value="app">App</option>
                          <option value="location">Localização</option>
                        </select>
                      </div>
                    </div>

                    {/* Editor de Texto (Modo Fluxo) */}
                    <RichTextEditor isA4={false} value={step.content} onChange={(newContent) => updateStep(index, 'content', newContent)}/>                        
                    
                    {/* Galeria de Fotos */}
                    {step.type === "video" && (
                      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mt-4">
                        <label className="text-xs font-bold uppercase mb-1 block">Link do Vídeo</label>
                        <input
                          type="text"
                          value={step.videoUrl || ""}
                          onChange={(e) => updateStep(index, "videoUrl", e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none"
                          placeholder='Ex: https://youtu.be/XXXX ou link .mp4'
                        />

                        {!!(step.videoUrl || "").trim() && (
                          <div className="mt-3 aspect-video w-full overflow-hidden rounded-lg border border-gray-200">
                            {renderVideoPreview(step.videoUrl)}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Galeria (Fotos Extras)</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {step.images && step.images.map((imgUrl, imgIndex) => (
                          <div key={imgIndex} className="relative group aspect-square bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <img src={imgUrl} alt="" className="w-full h-full object-contain" />
                            <button onClick={() => removeImage(index, imgIndex)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        ))}
                        <label className="cursor-pointer flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-500 bg-white">
                          <Upload className="w-6 h-6 text-gray-400 mb-2" />
                          <span className="text-xs text-gray-500 font-medium">Add Imagem</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(index, e)}/>
                        </label>
                      </div>
                    </div>

                    {/* Inputs Condicionais (App, PDF, Links) */}
                    {step.type === 'app' && (
                      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <div className="grid gap-2">
                          <div><label className="text-xs font-medium">Android</label><input type="text" value={step.androidLink} onChange={(e) => updateStep(index, 'androidLink', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none"/></div>
                          <div><label className="text-xs font-medium">iOS</label><input type="text" value={step.iosLink} onChange={(e) => updateStep(index, 'iosLink', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none"/></div>
                          <div><label className="text-xs font-medium">Web</label><input type="text" value={step.webLink} onChange={(e) => updateStep(index, 'webLink', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none"/></div>
                        </div>
                      </div>
                    )}
                    {(step.type === 'pdf') && (
                      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="text-xs font-bold uppercase mb-1">Link Externo</label><input type="text" value={step.link} onChange={(e) => updateStep(index, 'link', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none"/></div>
                        <div><label className="text-xs font-bold uppercase mb-1">Upload PDF</label>{!step.pdfData ? <label className="w-full p-2 border border-dashed border-gray-300 rounded-md bg-white text-sm text-gray-500 cursor-pointer flex items-center justify-center gap-2"><Upload className="w-4 h-4"/> Selecionar<input type="file" accept="application/pdf" className="hidden" onChange={(e) => handlePdfUpload(index, e)}/></label> : <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-md"><span className="text-xs text-green-800 truncate">{step.pdfName}</span><button onClick={() => removePdf(index)} className="p-1 text-red-500"><Trash2 className="w-3 h-3"/></button></div>}</div>
                        <div className="md:col-span-2"><label className="text-xs font-bold uppercase mb-1">Texto Botão</label><input type="text" value={step.buttonText} onChange={(e) => updateStep(index, 'buttonText', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none"/></div>
                      </div>
                    )}
                    {/* Inputs do tipo: Localização */}
                    {step.type === 'location' && (
                      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="text-xs font-bold uppercase mb-1">Endereço ou Link do Google Maps</label>
                          <input
                            type="text"
                            value={step.location || ""}
                            onChange={(e) => updateStep(index, 'location', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none"
                            placeholder='Ex: "Av. Cinquentenário, 1000, Itabuna - BA" ou cole um link do Maps'
                          />
                          <p className="text-[10px] text-gray-400 mt-1">
                            Dica: pode ser endereço em texto OU um link completo do Google Maps.
                          </p>
                        </div>
                        <div>
                          <label className="text-xs font-bold uppercase mb-1">Texto do Botão</label>
                          <input
                            type="text"
                            value={step.buttonText || ""}
                            onChange={(e) => updateStep(index, 'buttonText', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none"
                            placeholder="Ex: Abrir no Google Maps"
                          />
                        </div>
                      </div>  
                    )}
                    {(step.type === 'text' || step.type === 'welcome') && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <div>
                          <label className="text-xs font-bold uppercase mb-1">Link Extra</label>
                          <input
                            type="text"
                            value={step.linkExtra || ""}
                            onChange={(e) => updateStep(index, "linkExtra", e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none"
                            placeholder='Ex: "https://..."'
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold uppercase mb-1">Texto Botão</label>
                          <input
                            type="text"
                            value={step.buttonText || ""}
                            onChange={(e) => updateStep(index, "buttonText", e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none"
                            placeholder='Ex: "Acessar"'
                          />
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              ))}

              {/* Botão Adicionar Etapa */}
              <button onClick={() => setSteps([...steps, { id: Date.now(), type: 'text', title: 'Nova Etapa', content: '...', buttonText: '', link: '', coverImage: null, coverPosition: 50, images: [] }])} className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-medium hover:border-blue-500 flex items-center justify-center gap-2">
                <Plus className="w-5 h-5" /> Adicionar Etapa
              </button>
            </div>
          </div>
        ) : (
          // --- VISUALIZAÇÃO (ALUNO/PREVIEW) ---
          isCompleted ? (
            <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in zoom-in">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-lg">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{finalTitle}</h2>
              <p className="text-gray-500 max-w-md mb-8">{finalMessage}</p>
              
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <a 
                  href={formatUrl(whatsappLink)} 
                  target="_blank" 
                  rel="noreferrer"
                  className="bg-green-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-green-700 transition-transform active:scale-95 shadow-xl flex items-center justify-center gap-2 w-full"
                >
                  <Smartphone className="w-6 h-6" /> {finalButtonText}
                </a>

                <button 
                  onClick={() => { setIsCompleted(false); setCurrentStep(0); window.scrollTo(0,0); }}
                  className="px-8 py-3 border border-gray-200 text-gray-500 rounded-xl font-bold text-sm hover:bg-gray-50 hover:text-gray-900 transition-colors w-full"
                >
                  Voltar ao início do Onboarding
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white min-h-[400px] rounded-2xl shadow-sm border border-gray-200 p-6 md:p-10 mb-8 relative">
              {renderStepContent(steps[currentStep])}
            </div>
          )
        )}    
      </main>

{/* FOOTER NAVEGAÇÃO (Só aparece se NÃO for editor E NÃO tiver completado) */}
{viewState !== 'editor' && !isCompleted && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            
            {/* BOTÃO VOLTAR (Mudado de Anterior para Voltar) */}
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                currentStep === 0
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-black border border-transparent hover:border-gray-200'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Voltar</span>
            </button>

            {/* BOTÃO PRÓXIMO / FINALIZAR */}
            <button
              onClick={handleNext}
              className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl active:scale-95 ${
                 currentStep === steps.length - 1 
                 ? 'bg-green-600 text-white hover:bg-green-700' // Cor verde para finalizar
                 : 'bg-black text-white hover:bg-gray-800'      // Cor preta para próximo
              }`}
            >
              <span>{currentStep === steps.length - 1 ? 'Finalizar' : 'Próximo'}</span>
              {currentStep === steps.length - 1 ? <CheckCircle className="w-5 h-5"/> : <ChevronRight className="w-5 h-5" />}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

return null;
};

export default OnboardingConsultoria;