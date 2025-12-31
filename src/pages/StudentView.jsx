import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, ChevronRight, CheckCircle, Smartphone, ExternalLink, 
  MapPin, Download, Monitor, X, Play, FileText 
} from 'lucide-react';
// Certifique-se que o caminho do VideoPlayerGlobal está correto
import VideoPlayerGlobal from '../components/ui/VideoPlayerGlobal';

// --- HELPERS (Trazidos do Backup) ---
const formatUrl = (url) => {
  if (!url) return "#";
  return url.toString().startsWith("http") ? url : `https://${url}`;
};

const buildMapsUrl = (value) => {
  if (!value) return "#";
  const txt = String(value).trim();
  if (txt.startsWith("http://") || txt.startsWith("https://")) return txt;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(txt)}`;
};

const StudentView = ({ plan, onReload }) => {
  // 1. Extração dos Dados do Plano (Backup Logic)
  const steps = plan?.steps || [];
  const coachName = plan?.coachName || "Consultoria";
  const whatsappLink = plan?.whatsappLink || "";
  const finalTitle = plan?.finalTitle || "Tudo Pronto!";
  const finalMessage = plan?.finalMessage || "Parabéns por concluir o onboarding.";
  const finalButtonText = plan?.finalButtonText || "Ir para o WhatsApp";

  // 2. Estados de Navegação
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  
  // Estados Visuais
  const [isIndexOpen, setIsIndexOpen] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [videoEmbedUrl, setVideoEmbedUrl] = useState("");
  
  // Controle de Pulo de Etapa
  const [pendingJumpIndex, setPendingJumpIndex] = useState(null);
  const [showOrderWarning, setShowOrderWarning] = useState(false);

  // --- 3. Lógica de Navegação (Do Backup) ---
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    } else {
      setIsCompleted(true);
      window.scrollTo(0, 0);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  };

  const jumpToStep = (idx) => {
    if (idx === currentStep) { setIsIndexOpen(false); return; }
    
    // Trava de segurança para não pular muitas etapas
    if (idx > currentStep + 1) {
      setPendingJumpIndex(idx);
      setShowOrderWarning(true);
      return;
    }

    setCurrentStep(idx);
    setIsIndexOpen(false);
    window.scrollTo(0, 0);
  };

  const confirmJumpAnyway = () => {
    if (pendingJumpIndex !== null) {
      setCurrentStep(pendingJumpIndex);
      setPendingJumpIndex(null);
    }
    setShowOrderWarning(false);
    setIsIndexOpen(false);
    window.scrollTo(0, 0);
  };

  // --- 4. Função de Renderização do Conteúdo (A "Alma" do Visual) ---
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

  // --- 5. TELA DE CONCLUSÃO ---
  if (isCompleted) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex flex-col items-center justify-center p-4 font-sans animate-in fade-in zoom-in">
        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-xl ring-4 ring-green-50">
          <CheckCircle className="w-12 h-12" />
        </div>
        <h2 className="text-3xl font-black text-gray-900 mb-3 text-center">{finalTitle}</h2>
        <p className="text-gray-600 max-w-md mb-10 text-center leading-relaxed">{finalMessage}</p>
        
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <a href={formatUrl(whatsappLink)} target="_blank" rel="noreferrer" className="bg-green-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-green-700 transition-all hover:scale-[1.02] shadow-xl flex items-center justify-center gap-2 w-full">
            <Smartphone className="w-6 h-6" /> {finalButtonText}
          </a>
          <button onClick={() => { setIsCompleted(false); setCurrentStep(0); window.scrollTo(0,0); }} className="px-8 py-3 text-gray-400 font-bold text-sm hover:text-gray-600 transition-colors">
            Voltar ao início
          </button>
        </div>
      </div>
    );
  }

  // --- 6. RENDERIZAÇÃO PRINCIPAL (Estrutura do Backup) ---
  return (
    <div className="min-h-screen bg-[#F7F7F5] font-sans text-gray-900 pb-0">
      
      {/* HEADER PREMIUM (O quadrado preto ON) */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm transition-all">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-lg">ON</div>
            <div className="leading-tight">
              <h1 className="text-sm font-bold text-gray-900">Onboarding</h1>
              <p className="text-[10px] text-gray-500 font-medium truncate max-w-[150px]">{coachName}</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Progresso</span>
            <div className="w-24 md:w-32 h-2 bg-gray-100 rounded-full overflow-hidden mt-1 border border-gray-200">
              <div className="h-full bg-black transition-all duration-500 ease-out" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} />
            </div>
          </div>
        </div>
      </header>

      {/* ÍCONE DE ÍNDICE FLUTUANTE (O botão hambúrguer) */}
      <div className="fixed top-[85px] left-0 w-full z-30 pointer-events-none">
        <div className="max-w-6xl mx-auto px-4">
          <button 
            onClick={() => setIsIndexOpen(!isIndexOpen)} 
            className="pointer-events-auto w-10 h-10 flex flex-col items-center justify-center gap-[4px] rounded-xl border border-gray-200 bg-white shadow-lg hover:scale-105 transition-all text-gray-600"
          >
            <span className="block w-5 h-[2px] bg-current rounded-full" />
            <span className="block w-5 h-[2px] bg-current rounded-full" />
            <span className="block w-5 h-[2px] bg-current rounded-full" />
          </button>
        </div>
      </div>

      {/* ÁREA PRINCIPAL */}
      <main className="max-w-2xl mx-auto px-4 py-8 pt-12 min-h-[calc(100vh-80px)]">
         <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 md:p-10 relative overflow-hidden">
            {renderStepContent(steps[currentStep])}
         </div>
      </main>

      {/* FOOTER NAVEGAÇÃO */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-200 p-4 z-40 pb-6 md:pb-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <button 
            onClick={handlePrev} 
            disabled={currentStep === 0} 
            className={`flex items-center gap-2 px-4 md:px-6 py-3 rounded-xl font-bold transition-all text-sm ${currentStep === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <ArrowLeft className="w-5 h-5" /> Voltar
          </button>

          <button 
            onClick={handleNext} 
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 text-sm ${currentStep === steps.length - 1 ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-black text-white hover:bg-gray-800'}`}
          >
            {currentStep === steps.length - 1 ? 'Finalizar' : 'Próximo'}
            {currentStep === steps.length - 1 ? <CheckCircle className="w-5 h-5"/> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
      </footer>

      {/* --- MODAIS (Restaurados do Backup) --- */}
      
      {/* 1. Modal Índice */}
      {isIndexOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 transition-opacity" onClick={() => setIsIndexOpen(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-gray-900">Índice do Fluxo</h3>
              <button onClick={() => setIsIndexOpen(false)} className="p-2 bg-white rounded-full text-gray-500 hover:text-black shadow-sm"><X className="w-4 h-4"/></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
              {steps.map((s, i) => (
                <button key={i} onClick={() => jumpToStep(i)} className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-colors ${i === currentStep ? "bg-black text-white shadow-md" : "hover:bg-gray-50 text-gray-600"}`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-md ${i === currentStep ? "bg-white/20" : "bg-gray-200 text-gray-500"}`}>{i + 1}</span>
                    <span className="font-bold text-sm truncate max-w-[200px]">{s.title}</span>
                  </div>
                  {i === currentStep && <div className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded">Atual</div>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Vídeo */}
      {isVideoOpen && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={() => {setIsVideoOpen(false); setVideoEmbedUrl("");}}>
          <div className="bg-black w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl relative">
             <button className="absolute top-4 right-4 text-white bg-white/10 p-2 rounded-full hover:bg-white/20 z-50"><X className="w-6 h-6"/></button>
             <div className="aspect-video w-full">
                <iframe src={videoEmbedUrl} className="w-full h-full" frameBorder="0" allow="autoplay; fullscreen" allowFullScreen />
             </div>
          </div>
        </div>
      )}

      {/* 3. Modal Aviso Pular */}
      {showOrderWarning && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center animate-in zoom-in">
             <h3 className="text-lg font-bold text-gray-900 mb-2">Pular etapas?</h3>
             <p className="text-sm text-gray-500 mb-6">Recomendamos seguir a ordem para não perder informações importantes.</p>
             <div className="flex gap-3 justify-center">
                <button onClick={() => setShowOrderWarning(false)} className="px-5 py-2 rounded-lg font-bold text-gray-600 hover:bg-gray-100">Cancelar</button>
                <button onClick={confirmJumpAnyway} className="px-5 py-2 rounded-lg font-bold bg-black text-white hover:bg-gray-800 shadow-lg">Pular mesmo assim</button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default StudentView;