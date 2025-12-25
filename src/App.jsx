import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { 
  ChevronRight, ChevronLeft, CheckCircle, FileText, Smartphone, Download, 
  ExternalLink, Play, Settings, Plus, Trash2, Layout, Eye, MoveUp, MoveDown, 
  Image as ImageIcon, Upload, Bold, Italic, Underline, Type, Globe, Monitor, 
  Lock, Save, Loader
} from 'lucide-react';

// --- ⚠️ ÁREA DE CONFIGURAÇÃO DO FIREBASE ⚠️ ---
// Substitua os dados abaixo pelos que você pegou no Console do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDiLbc_PiVR1EVoLRJlZvNZYSMxb2rEE54",
  authDomain: "onboarding-consultoria.firebaseapp.com",
  projectId: "onboarding-consultoria",
  storageBucket: "onboarding-consultoria.firebasestorage.app",
  messagingSenderId: "658269586608",
  appId: "1:658269586608:web:991d2c39d6f1664aaae775"
};

// Inicializa o Firebase (apenas se a config estiver preenchida)
let db;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (error) {
  console.log("Aguardando configuração do Firebase...");
}

// --- COMPONENTE EDITOR DE TEXTO ---
const RichTextEditor = ({ value, onChange }) => {
  const editorRef = useRef(null);
  const execCmd = (command, value = null) => {
    document.execCommand(command, false, value);
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
        <button onClick={() => execCmd('fontSize', '5')} className="p-1.5 hover:bg-gray-200 rounded text-gray-700"><Type className="w-4 h-4" /></button>
        <button onClick={() => execCmd('fontSize', '3')} className="p-1.5 hover:bg-gray-200 rounded text-gray-700"><Type className="w-3 h-3" /></button>
        <div className="w-px h-4 bg-gray-300 mx-1"></div>
        <button onClick={() => execCmd('foreColor', '#000000')} className="w-5 h-5 rounded-full bg-black border border-gray-200"></button>
        <button onClick={() => execCmd('foreColor', '#2563eb')} className="w-5 h-5 rounded-full bg-blue-600 border border-gray-200"></button>
        <button onClick={() => execCmd('foreColor', '#dc2626')} className="w-5 h-5 rounded-full bg-red-600 border border-gray-200"></button>
        <button onClick={() => execCmd('foreColor', '#16a34a')} className="w-5 h-5 rounded-full bg-green-600 border border-gray-200"></button>
      </div>
      <div ref={editorRef} contentEditable className="p-3 min-h-[100px] text-sm text-gray-800 focus:outline-none prose prose-sm max-w-none" onInput={(e) => onChange(e.currentTarget.innerHTML)} onBlur={(e) => onChange(e.currentTarget.innerHTML)}></div>
    </div>
  );
};

const OnboardingConsultoria = () => {
  const [isEditorMode, setIsEditorMode] = useState(false);
  const [isAdminAccess, setIsAdminAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  // Estados de Dados
  const [coachName, setCoachName] = useState("Sua Consultoria");
  const [whatsappLink, setWhatsappLink] = useState("https://wa.me/");
  const [finalTitle, setFinalTitle] = useState("Tudo Pronto! 🎉");
  const [finalMessage, setFinalMessage] = useState("Recebi suas informações. Agora é comigo!");
  const [finalButtonText, setFinalButtonText] = useState("Falar com o Treinador");
  const [steps, setSteps] = useState([]);

  // --- CORREÇÃO DO VISUAL (Auto-carregar Tailwind) ---
  useEffect(() => {
    if (!document.querySelector('script[src*="tailwindcss"]')) {
      const script = document.createElement('script');
      script.src = "https://cdn.tailwindcss.com";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  // Default Steps
  const defaultSteps = [
    { id: 1, type: 'welcome', title: 'Boas-vindas', content: 'Bem-vindo ao time!', buttonText: '', link: '', images: [] }
  ];

  // 1. Verificar Admin e Carregar Dados
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true') {
      setIsAdminAccess(true);
      setIsEditorMode(true);
    }

    const fetchData = async () => {
      if (!db) {
        setSteps(defaultSteps);
        setIsLoading(false);
        return;
      }

      try {
        const docRef = doc(db, "onboarding", "config_geral");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setCoachName(data.coachName);
          setWhatsappLink(data.whatsappLink);
          setFinalTitle(data.finalTitle);
          setFinalMessage(data.finalMessage);
          setFinalButtonText(data.finalButtonText);
          setSteps(data.steps || defaultSteps);
        } else {
          setSteps(defaultSteps); 
        }
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
        alert("Erro de conexão. Verifique a configuração do Firebase.");
        setSteps(defaultSteps);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // 2. Função para SALVAR
  const handleSaveToCloud = async () => {
    if (!db) return alert("Firebase não configurado no código.");
    setIsSaving(true);
    try {
      await setDoc(doc(db, "onboarding", "config_geral"), {
        coachName,
        whatsappLink,
        finalTitle,
        finalMessage,
        finalButtonText,
        steps
      });
      alert("✅ Alterações salvas com sucesso! Seus alunos já podem ver a nova versão.");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar. Verifique o console.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- HELPER: FORMATAÇÃO DE URL ---
  const formatUrl = (url) => {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return `https://${trimmed}`;
  };

  // --- FUNÇÕES DE EDITOR E NAVEGAÇÃO ---
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(curr => curr + 1);
      window.scrollTo(0, 0);
    } else {
      setIsCompleted(true);
    }
  };
  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(curr => curr - 1);
      setIsCompleted(false);
      window.scrollTo(0, 0);
    }
  };
  const addStep = () => {
    const newStep = { id: Date.now(), type: 'text', title: 'Nova Etapa', content: '...', buttonText: '', link: '', androidLink: '', iosLink: '', webLink: '', images: [], pdfData: null, pdfName: null };
    setSteps([...steps, newStep]);
    setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 100);
  };
  const removeStep = (index) => {
    if (steps.length <= 1) return alert("Mínimo 1 etapa.");
    const newSteps = [...steps]; newSteps.splice(index, 1); setSteps(newSteps);
    if (currentStep >= newSteps.length) setCurrentStep(newSteps.length - 1);
  };
  const updateStep = (index, field, value) => {
    const newSteps = [...steps]; newSteps[index] = { ...newSteps[index], [field]: value }; setSteps(newSteps);
  };
  const moveStep = (index, direction) => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === steps.length - 1)) return;
    const newSteps = [...steps]; const temp = newSteps[index];
    newSteps[index] = newSteps[index + (direction === 'up' ? -1 : 1)];
    newSteps[index + (direction === 'up' ? -1 : 1)] = temp; setSteps(newSteps);
  };
  const handleImageUpload = (stepIndex, e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newSteps = [...steps]; if (!newSteps[stepIndex].images) newSteps[stepIndex].images = [];
        newSteps[stepIndex].images.push(reader.result); setSteps(newSteps);
      }; reader.readAsDataURL(file);
    }
  };
  const removeImage = (stepIndex, imgIndex) => {
    const newSteps = [...steps]; newSteps[stepIndex].images = newSteps[stepIndex].images.filter((_, i) => i !== imgIndex); setSteps(newSteps);
  };
  const handlePdfUpload = (stepIndex, e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newSteps = [...steps]; newSteps[stepIndex].pdfData = reader.result; newSteps[stepIndex].pdfName = file.name; setSteps(newSteps);
      }; reader.readAsDataURL(file);
    } else alert('Apenas PDF.');
  };
  const removePdf = (stepIndex) => {
    const newSteps = [...steps]; newSteps[stepIndex].pdfData = null; newSteps[stepIndex].pdfName = null; setSteps(newSteps);
  };

  // --- RENDERIZAÇÃO PRINCIPAL ---
  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5]"><Loader className="w-8 h-8 animate-spin text-gray-400"/></div>;

  const renderStepContent = (step) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-bold text-gray-900">{step.title}</h2>
      <div className="text-lg text-gray-600 prose prose-gray max-w-none" dangerouslySetInnerHTML={{ __html: step.content }} />
      {step.images && step.images.length > 0 && (
        <div className={`grid gap-4 my-6 ${step.images.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {step.images.map((img, idx) => img && <img key={idx} src={img} alt="" className="rounded-xl w-full h-auto object-cover border border-gray-100 shadow-sm" />)}
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

  // --- MODO VISUALIZAÇÃO ---
  if (!isEditorMode) {
    if (isCompleted) return (
      <div className="min-h-screen bg-[#F7F7F5] flex flex-col items-center justify-center p-6 font-sans text-center relative">
        {isAdminAccess && <button onClick={() => setIsEditorMode(true)} className="absolute top-4 right-4 p-2 bg-white text-gray-500 rounded-full hover:bg-gray-100 shadow-sm border border-gray-200 z-50"><Settings className="w-5 h-5"/></button>}
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
        {isAdminAccess && <button onClick={() => setIsEditorMode(true)} className="fixed top-20 right-4 p-3 bg-black text-white rounded-full shadow-xl hover:bg-gray-800 z-50 flex items-center gap-2"><Settings className="w-5 h-5"/></button>}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200"><div className="max-w-full mx-auto px-4 h-16 flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white font-bold text-xs">ON</div><span className="font-semibold text-gray-700 hidden sm:block truncate max-w-[150px]">{coachName}</span></div><div className="flex items-center gap-3"><span className="text-xs font-medium text-gray-500">Etapa {currentStep + 1}/{steps.length}</span><div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-black transition-all duration-500 ease-out" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}></div></div></div></div></header>
        <main className="max-w-full mx-auto px-4 py-8 md:py-12 pb-32"><div className="bg-white min-h-[400px] rounded-2xl shadow-sm border border-gray-200 p-6 md:p-10 mb-8 relative">{renderStepContent(steps[currentStep])}</div></main>
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4"><div className="max-w-full mx-auto flex items-center justify-between gap-4"><button onClick={handlePrev} disabled={currentStep === 0} className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${currentStep === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}><ChevronLeft className="w-5 h-5"/><span className="hidden sm:inline">Anterior</span></button><button onClick={handleNext} className="flex items-center gap-2 px-8 py-3 bg-black text-white rounded-lg font-bold hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl active:scale-95"><span>{currentStep === steps.length - 1 ? 'Concluir' : 'Próximo'}</span><ChevronRight className="w-5 h-5"/></button></div></footer>
      </div>
    );
  }

  // --- MODO EDITOR ---
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-800">
            <Layout className="w-5 h-5 text-blue-600" />
            <h1 className="font-bold text-lg hidden sm:block">Construtor de Onboarding</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSaveToCloud} disabled={isSaving} className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors shadow-sm ${isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}>
              {isSaving ? <Loader className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} 
              <span className="hidden sm:inline">{isSaving ? "Salvando..." : "Salvar no Site"}</span>
              <span className="sm:hidden">{isSaving ? "..." : "Salvar"}</span>
            </button>
            <button onClick={() => {setCurrentStep(0); setIsCompleted(false); setIsEditorMode(false);}} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
              <Eye className="w-4 h-4" /> 
              <span className="hidden sm:inline">Ver Site</span>
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Settings className="w-4 h-4" /> Configurações Gerais</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Nome da Consultoria</label><input type="text" value={coachName} onChange={(e) => setCoachName(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Link do WhatsApp (Final)</label><input type="text" value={whatsappLink} onChange={(e) => setWhatsappLink(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"/></div>
          </div>
        </section>
        <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Configurações da Página Final</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Título</label><input type="text" value={finalTitle} onChange={(e) => setFinalTitle(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md outline-none"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Texto Botão</label><input type="text" value={finalButtonText} onChange={(e) => setFinalButtonText(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md outline-none"/></div>
          </div>
          <div className="mt-4"><label className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label><textarea value={finalMessage} onChange={(e) => setFinalMessage(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md outline-none resize-none"/></div>
        </section>
        
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Layout className="w-4 h-4" /> Etapas do Fluxo ({steps.length})</h2>
          {steps.map((step, index) => (
            <div key={step.id} className="group bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
              <div className="bg-gray-50 p-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded text-xs font-bold text-gray-600">{index + 1}</span>
                  <span className="font-semibold text-gray-700 text-sm truncate max-w-[120px] sm:max-w-none">{step.title}</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold uppercase tracking-wide hidden sm:inline">{step.type}</span>
                </div>
                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => moveStep(index, 'up')} className="p-1 hover:bg-gray-200 rounded"><MoveUp className="w-4 h-4"/></button>
                  <button onClick={() => moveStep(index, 'down')} className="p-1 hover:bg-gray-200 rounded"><MoveDown className="w-4 h-4"/></button>
                  <button onClick={() => removeStep(index)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
              <div className="p-5 grid gap-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-3"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título</label><input type="text" value={step.title} onChange={(e) => updateStep(index, 'title', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md font-medium outline-none"/></div>
                  <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo</label><select value={step.type} onChange={(e) => updateStep(index, 'type', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white outline-none"><option value="text">Texto</option><option value="welcome">Boas-vindas</option><option value="pdf">PDF</option><option value="video">Vídeo</option><option value="app">App</option></select></div>
                </div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Conteúdo</label><RichTextEditor value={step.content} onChange={(newContent) => updateStep(index, 'content', newContent)}/></div>
                
                {/* CAIXA GALERIA - Agora Branca */}
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Galeria</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {step.images && step.images.map((imgUrl, imgIndex) => (<div key={imgIndex} className="relative group aspect-square bg-white rounded-lg border border-gray-200 overflow-hidden"><img src={imgUrl} alt="" className="w-full h-full object-cover" /><button onClick={() => removeImage(index, imgIndex)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button></div>))}
                    <label className="cursor-pointer flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-500 bg-white"><Upload className="w-6 h-6 text-gray-400 mb-2" /><span className="text-xs text-gray-500 font-medium">Add Imagem</span><input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(index, e)}/></label>
                  </div>
                </div>

                {/* CAIXAS CONDICIONAIS - Agora Brancas */}
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