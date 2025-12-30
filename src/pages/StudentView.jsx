import React, { useState, useRef, useEffect } from 'react';
import { 
  Smartphone, CheckCircle, ChevronRight, ArrowLeft, 
  MapPin, ExternalLink, Download, FileText, Monitor, FileSignature 
} from 'lucide-react';
import { doc, updateDoc } from "firebase/firestore";
import { db } from '../services/firebase';
import { formatUrl, buildMapsUrl, applyStudentValuesToContract } from '../utils/helpers';
import VideoPlayerGlobal from '../components/ui/VideoPlayerGlobal';
import SignaturePad from '../components/ui/SignaturePad';

const StudentView = ({ student, plan, onReload }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  
  // Estados para Assinatura
  const [signatureData, setSignatureData] = useState(null);
  const [studentFieldValues, setStudentFieldValues] = useState({});
  const [isSigning, setIsSigning] = useState(false);

  // Estados para Navegação (Índice)
  const [isIndexOpen, setIsIndexOpen] = useState(false);

  // --- LÓGICA DE ASSINATURA ---
  const handleSignContract = async () => {
    if (!signatureData) return alert("Por favor, faça sua assinatura.");
    
    // Validação de campos pendentes
    const pending = Array.isArray(student?.pendingFields) ? student.pendingFields : [];
    const requiredKeys = pending.filter(f => f?.owner === "student").map(f => f.key);
    const missing = requiredKeys.filter((k) => !String(studentFieldValues?.[k] ?? "").trim());

    if (missing.length > 0) return alert(`Preencha todos os campos obrigatórios.`);

    setIsSigning(true);
    try {
      let userIP = "Não identificado";
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        const json = await res.json();
        userIP = json.ip;
      } catch (e) { console.warn("IP fail"); }

      const timestamp = new Date().toISOString();
      
      await updateDoc(doc(db, "students", student.id), {
        status: "signed",
        studentData: {
          ...studentFieldValues,
          signedAt: timestamp,
          ipAddress: userIP,
          deviceInfo: navigator.userAgent
        },
        signature: {
          image: signatureData,
          signedAt: timestamp,
          ip: userIP,
          userAgent: navigator.userAgent,
        },
      });

      alert("Contrato assinado com sucesso!");
      if (onReload) onReload(); 

    } catch (error) {
      console.error(error);
      alert("Erro ao salvar assinatura.");
    } finally {
      setIsSigning(false);
    }
  };

  // --- SE O ALUNO NÃO ASSINOU, MOSTRA O CONTRATO ---
  if (student.status !== 'signed') {
    const baseHTML = student?.contractText || "<p>Erro: Contrato não encontrado.</p>";
    const mergedValues = {
      nome: student.name || "",
      telefone: student.phone || "",
      cpf: student.cpf || "",
      rg: student.rg || "",
      email: student.email || "",
      endereco: student.address || "",
      profissao: student.profession || "",
      nascimento: student.birthDate ? new Date(student.birthDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "",
      ...studentFieldValues,
    };
    const contractDisplay = applyStudentValuesToContract(baseHTML, mergedValues);
    const pendingFields = Array.isArray(student?.pendingFields) ? student.pendingFields.filter(f => f.owner === 'student') : [];

    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-8">
          <div className="bg-black p-6 text-white text-center">
            <h1 className="text-2xl font-bold">Contrato de Prestação de Serviços</h1>
            <p className="text-gray-400 text-sm mt-1">Leia atentamente e assine ao final</p>
          </div>
          <div className="p-6 md:p-10 space-y-8">
            {pendingFields.length > 0 && (
              <div className="grid md:grid-cols-2 gap-4">
                {pendingFields.map((field, idx) => (
                  <div key={idx}>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{field.label}</label>
                    <input type={field.type === "date" ? "date" : "text"} value={studentFieldValues[field.key] || ""} onChange={(e) => setStudentFieldValues(prev => ({...prev, [field.key]: e.target.value}))} className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-black transition-colors"/>
                  </div>
                ))}
              </div>
            )}
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 h-64 overflow-y-auto">
              <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: contractDisplay }} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2"><FileSignature className="w-4 h-4" /> Sua Assinatura</label>
              <SignaturePad onSave={setSignatureData} onClear={() => setSignatureData(null)} />
            </div>
            <button onClick={handleSignContract} disabled={isSigning} className="w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all bg-black text-white hover:bg-gray-800 hover:shadow-xl active:scale-95 disabled:bg-gray-400">
              {isSigning ? "Salvando..." : "Assinar e Acessar"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- SE O ALUNO JÁ ASSINOU, MOSTRA O FLUXO (ONBOARDING) ---
  const steps = plan?.steps || [];
  const currentStepData = steps[currentStep] || {};

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

  if (isCompleted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F7F5] p-4 text-center animate-in fade-in zoom-in">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-lg"><CheckCircle className="w-10 h-10" /></div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">{plan?.finalTitle || "Tudo Pronto!"}</h2>
        <p className="text-gray-500 max-w-md mb-8">{plan?.finalMessage || "Sucesso!"}</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <a href={formatUrl(plan?.whatsappLink)} target="_blank" rel="noreferrer" className="bg-green-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-green-700 transition-transform active:scale-95 shadow-xl flex items-center justify-center gap-2 w-full"><Smartphone className="w-6 h-6" /> {plan?.finalButtonText || "Continuar"}</a>
          <button onClick={() => { setIsCompleted(false); setCurrentStep(0); }} className="px-8 py-3 border border-gray-200 text-gray-500 rounded-xl font-bold text-sm hover:bg-gray-50">Voltar ao início</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5] font-sans text-gray-900 relative pb-32">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-lg">ON</div>
            <div className="leading-tight"><h1 className="text-sm font-bold text-gray-900">Onboarding</h1><p className="text-[10px] text-gray-500 font-medium">{plan?.coachName || "Consultoria"}</p></div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-gray-500 uppercase">Progresso</span>
            <div className="w-28 h-2 bg-gray-200 rounded-full overflow-hidden mt-1"><div className="h-full bg-black transition-all duration-500 ease-out" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} /></div>
          </div>
        </div>
      </header>

      {/* CONTEÚDO */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white min-h-[400px] rounded-2xl shadow-sm border border-gray-200 p-6 md:p-10 mb-8 relative animate-in fade-in slide-in-from-bottom-4">
          {currentStepData.coverImage && (
            <div className="-mx-6 -mt-6 md:-mx-10 md:-mt-10 mb-6 relative group bg-gray-50">
              <img src={currentStepData.coverImage} alt="Capa" className="w-full h-auto object-cover rounded-t-2xl shadow-sm" style={{ objectPosition: `center ${currentStepData.coverPosition || 50}%`, maxHeight: '400px' }} />
            </div>
          )}
          
          <h2 className="text-2xl font-bold text-gray-900">{currentStepData.title}</h2>
          <div className="text-lg text-gray-600 prose prose-gray max-w-none mt-4" dangerouslySetInnerHTML={{ __html: currentStepData.content }} />

          {/* Galeria */}
          {currentStepData.images && currentStepData.images.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 my-8">
              {currentStepData.images.map((img, idx) => img && (
                <div key={idx} className="relative group bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-center overflow-hidden h-64 shadow-sm hover:shadow-md transition-all">
                  <img src={img} alt="" className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" />
                </div>
              ))}
            </div>
          )}

          {/* Botão de Link Extra */}
          {(currentStepData.type === 'text' || currentStepData.type === 'welcome') && (currentStepData.linkExtra || currentStepData.link) && (
            <a href={formatUrl(currentStepData.linkExtra || currentStepData.link)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-blue-600 hover:underline font-medium mt-4">
              {currentStepData.buttonText || "Acessar Link"} <ExternalLink className="w-4 h-4" />
            </a>
          )}

          {/* Bloco de Vídeo */}
          {currentStepData.type === 'video' && (
            <div className="mt-6">
              <div className="relative bg-black aspect-video rounded-xl overflow-hidden shadow-lg border border-gray-200">
                <VideoPlayerGlobal url={currentStepData.videoUrl || currentStepData.link} />
              </div>
              {currentStepData.buttonText && (
                <a href={formatUrl(currentStepData.videoUrl || currentStepData.link)} target="_blank" rel="noreferrer" className="block w-full text-center py-3 bg-blue-600 text-white rounded-lg font-bold mt-4 hover:bg-blue-700 transition-colors">
                  {currentStepData.buttonText}
                </a>
              )}
            </div>
          )}

          {/* Bloco de PDF */}
          {currentStepData.type === 'pdf' && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mt-6">
              <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-red-100 text-red-600 rounded-lg"><FileText className="w-6 h-6" /></div><div><h3 className="font-bold text-gray-900">Arquivo para Download</h3><p className="text-sm text-gray-500">{currentStepData.pdfName || "Documento PDF"}</p></div></div>
              <a href={currentStepData.pdfData || formatUrl(currentStepData.link) || "#"} download={!!currentStepData.pdfData ? (currentStepData.pdfName || "documento.pdf") : undefined} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"><Download className="w-4 h-4" />{currentStepData.buttonText || "Baixar Arquivo"}</a>
            </div>
          )}

          {/* Bloco de Localização */}
          {currentStepData.type === 'location' && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mt-6">
              <div className="flex items-center gap-3 mb-3"><div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><MapPin className="w-6 h-6" /></div><div><h3 className="font-bold text-gray-900">Localização</h3><p className="text-sm text-gray-500">Toque no botão para abrir no Google Maps.</p></div></div>
              {currentStepData.location ? (
                <a href={buildMapsUrl(currentStepData.location)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold">{currentStepData.buttonText || "Abrir no Google Maps"} <ExternalLink className="w-4 h-4" /></a>
              ) : <div className="text-sm text-red-600 font-bold">Localização não configurada.</div>}
            </div>
          )}

          {/* Bloco de App */}
          {currentStepData.type === 'app' && (
            <div className="mt-8"><h3 className="font-bold text-gray-900 mb-4 text-center">Escolha sua plataforma:</h3><div className="flex flex-col gap-3 max-w-sm mx-auto">
              {currentStepData.iosLink && <a href={formatUrl(currentStepData.iosLink)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 w-full py-3 px-4 bg-black text-white rounded-xl font-medium"><Smartphone className="w-5 h-5"/>App Store (iPhone)</a>}
              {currentStepData.androidLink && <a href={formatUrl(currentStepData.androidLink)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 w-full py-3 px-4 bg-black text-white rounded-xl font-medium"><Smartphone className="w-5 h-5"/>Google Play (Android)</a>}
              {currentStepData.webLink && <a href={formatUrl(currentStepData.webLink)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-medium"><Monitor className="w-5 h-5"/>Acessar Navegador</a>}
            </div></div>
          )}
        </div>
      </main>

      {/* FOOTER NAVEGAÇÃO */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <button onClick={handlePrev} disabled={currentStep === 0} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${currentStep === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100 hover:text-black border border-transparent hover:border-gray-200'}`}><ArrowLeft className="w-5 h-5" /> <span className="hidden sm:inline">Voltar</span></button>
          <button onClick={handleNext} className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl active:scale-95 ${currentStep === steps.length - 1 ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-black text-white hover:bg-gray-800'}`}>
            <span>{currentStep === steps.length - 1 ? 'Finalizar' : 'Próximo'}</span>
            {currentStep === steps.length - 1 ? <CheckCircle className="w-5 h-5"/> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default StudentView;