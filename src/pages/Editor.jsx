import React, { useState, useEffect } from 'react';
import { 
  Save, Eye, ArrowLeft, Loader, Layout, MoveUp, MoveDown, Trash2, 
  ImageIcon, Upload, MoveVertical, Plus, Settings, CheckCircle 
} from 'lucide-react';
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from "firebase/storage";
import { db, storage } from '../services/firebase';
import RichTextEditor from '../components/ui/RichTextEditor';
import VideoPlayerGlobal from '../components/ui/VideoPlayerGlobal';

const defaultSteps = [
  { id: 1, type: 'welcome', title: 'Boas-vindas', content: 'Bem-vindo ao time!', buttonText: '', link: '', coverImage: null, coverPosition: 50, images: [] }
];

const Editor = ({ planId, onBack, onTest }) => {
  const [steps, setSteps] = useState(defaultSteps);
  const [coachName, setCoachName] = useState("");
  const [whatsappLink, setWhatsappLink] = useState("");
  const [finalTitle, setFinalTitle] = useState("");
  const [finalMessage, setFinalMessage] = useState("");
  const [finalButtonText, setFinalButtonText] = useState("");
  
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Carregar dados do plano
  useEffect(() => {
    const loadData = async () => {
        if (!planId) return;
        setLoading(true);
        try {
            const docRef = doc(db, "onboarding", planId);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data();
                setSteps(data.steps || defaultSteps);
                setCoachName(data.coachName || "");
                setWhatsappLink(data.whatsappLink || "");
                setFinalTitle(data.finalTitle || "");
                setFinalMessage(data.finalMessage || "");
                setFinalButtonText(data.finalButtonText || "");
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao carregar fluxo.");
        } finally {
            setLoading(false);
        }
    };
    loadData();
  }, [planId]);

  const handleSaveToCloud = async () => {
    if (!planId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "onboarding", planId), { 
        coachName, whatsappLink, finalTitle, finalMessage, finalButtonText, steps 
      });
      alert("✅ Fluxo salvo com sucesso!");
    } catch (error) { 
      alert("Erro ao salvar."); console.error(error); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const updateStep = (index, field, value) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  const moveStep = (index, direction) => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === steps.length - 1)) return;
    const newSteps = [...steps];
    const target = direction === 'up' ? index - 1 : index + 1;
    [newSteps[index], newSteps[target]] = [newSteps[target], newSteps[index]];
    setSteps(newSteps);
    
    // Pulo suave
    setTimeout(() => {
        const el = document.getElementById(`step-${target}`);
        if(el) el.scrollIntoView({behavior: 'smooth', block: 'center'});
    }, 100);
  };

  const removeStep = (index) => {
    if (steps.length <= 1) return alert("Mínimo de 1 etapa.");
    if(confirm("Apagar etapa?")) {
        setSteps(steps.filter((_, i) => i !== index));
    }
  };

  // Uploads
  const handleCoverUpload = async (index, e) => {
    const file = e.target.files[0];
    if(!file) return;
    try {
        const storageRef = ref(storage, `capas/${Date.now()}-${file.name}`);
        const snap = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snap.ref);
        updateStep(index, 'coverImage', url);
    } catch(err) { alert("Erro upload capa"); }
  };

  const handleImageUpload = async (index, e) => {
    const file = e.target.files[0];
    if(!file) return;
    try {
        const storageRef = ref(storage, `galeria/${Date.now()}-${file.name}`);
        const snap = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snap.ref);
        const current = steps[index].images || [];
        updateStep(index, 'images', [...current, url]);
    } catch(err) { alert("Erro upload galeria"); }
  };

  const handlePdfUpload = (index, e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateStep(index, 'pdfData', url);
      updateStep(index, 'pdfName', file.name);
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader className="w-8 h-8 animate-spin mx-auto"/></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32">
      {/* BARRA TOPO */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 -mx-4 px-4 py-3 flex items-center justify-between shadow-sm mb-6">
        <div className="flex items-center gap-2">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft className="w-5 h-5"/></button>
            <h1 className="font-bold text-lg">Editando: <span className="text-blue-600">{planId}</span></h1>
        </div>
        <div className="flex gap-2">
            <button onClick={handleSaveToCloud} disabled={isSaving} className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors ${isSaving ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}>
                {isSaving ? <Loader className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} <span>Salvar</span>
            </button>
            <button onClick={() => onTest(steps)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"><Eye className="w-4 h-4"/> Testar</button>
        </div>
      </header>

      {/* CONFIGS GERAIS */}
      <div className="bg-gray-50 rounded-xl border border-gray-300 shadow-sm overflow-hidden">
        <div className="bg-[#850000] p-4 border-b border-[#850000] flex items-center gap-3"><Settings className="w-5 h-5 text-white"/><h3 className="text-lg font-black text-white uppercase">Configurações Gerais</h3></div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Nome da Consultoria</label><input value={coachName} onChange={e=>setCoachName(e.target.value)} className="w-full p-2 border rounded"/></div>
            <div><label className="block text-sm font-medium mb-1">Link WhatsApp (Final)</label><input value={whatsappLink} onChange={e=>setWhatsappLink(e.target.value)} className="w-full p-2 border rounded"/></div>
        </div>
      </div>

      {/* ETAPAS */}
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Layout className="w-4 h-4"/> Etapas ({steps.length})</h2>
      
      {steps.map((step, index) => (
        <div id={`step-${index}`} key={step.id} className="group bg-gray-50 rounded-xl border border-gray-300 shadow-md overflow-visible transition-all hover:shadow-lg">
            <div className="bg-[#850000] p-4 border-b border-[#850000] flex justify-between items-center sticky top-16 z-40 shadow-md">
                <div className="flex items-center gap-3">
                    <span className="w-8 h-8 flex items-center justify-center bg-white text-rose-900 rounded-lg text-sm font-bold">{index + 1}</span>
                    <span className="text-lg font-black text-white uppercase truncate max-w-[200px]">{step.title}</span>
                </div>
                <div className="flex gap-1">
                    <button onClick={()=>moveStep(index, 'up')} className="p-2 hover:bg-rose-800 rounded text-white"><MoveUp className="w-5 h-5"/></button>
                    <button onClick={()=>moveStep(index, 'down')} className="p-2 hover:bg-rose-800 rounded text-white"><MoveDown className="w-5 h-5"/></button>
                    <button onClick={()=>removeStep(index)} className="p-2 hover:bg-red-600 rounded text-rose-200 hover:text-white"><Trash2 className="w-5 h-5"/></button>
                </div>
            </div>

            <div className="p-5 grid gap-4">
                {/* CAPA */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Capa</label>
                    {!step.coverImage ? (
                        <label className="cursor-pointer flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg hover:border-blue-500"><ImageIcon className="w-6 h-6 text-gray-400"/><span className="text-xs text-gray-500">Enviar Capa</span><input type="file" className="hidden" onChange={(e)=>handleCoverUpload(index,e)}/></label>
                    ) : (
                        <div className="relative group">
                            <img src={step.coverImage} className="w-full h-40 object-cover rounded-lg" style={{objectPosition: `center ${step.coverPosition||50}%`}}/>
                            <button onClick={()=>updateStep(index, 'coverImage', null)} className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full"><Trash2 className="w-4 h-4"/></button>
                            <input type="range" min="0" max="100" value={step.coverPosition||50} onChange={e=>updateStep(index,'coverPosition',e.target.value)} className="w-full mt-2"/>
                        </div>
                    )}
                </div>

                <div className="grid md:grid-cols-4 gap-4">
                    <div className="md:col-span-3"><label className="text-xs font-bold uppercase">Título</label><input value={step.title} onChange={e=>updateStep(index,'title',e.target.value)} className="w-full p-2 border rounded"/></div>
                    <div><label className="text-xs font-bold uppercase">Tipo</label><select value={step.type} onChange={e=>updateStep(index,'type',e.target.value)} className="w-full p-2 border rounded"><option value="text">Texto</option><option value="video">Vídeo</option><option value="pdf">PDF</option><option value="app">App</option><option value="location">Local</option></select></div>
                </div>

                <RichTextEditor value={step.content} onChange={val=>updateStep(index,'content',val)}/>

                {step.type === 'video' && (
                    <div><label className="text-xs font-bold uppercase">Link Vídeo (YouTube/Vimeo/Mp4)</label><input value={step.videoUrl||''} onChange={e=>updateStep(index,'videoUrl',e.target.value)} className="w-full p-2 border rounded"/>
                    {step.videoUrl && <div className="mt-2 aspect-video bg-black rounded overflow-hidden"><VideoPlayerGlobal url={step.videoUrl}/></div>}</div>
                )}

                {/* --- BLOCOS RESTAURADOS (APP, PDF, LOCAL, LINKS) --- */}
                
                {step.type === 'app' && (
                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mt-4">
                    <label className="text-xs font-bold uppercase mb-2 block">Links dos Aplicativos</label>
                    <div className="grid gap-2">
                      <div><label className="text-xs font-medium">Link Android (Google Play)</label><input value={step.androidLink||''} onChange={e=>updateStep(index,'androidLink',e.target.value)} className="w-full p-2 border rounded text-sm"/></div>
                      <div><label className="text-xs font-medium">Link iOS (App Store)</label><input value={step.iosLink||''} onChange={e=>updateStep(index,'iosLink',e.target.value)} className="w-full p-2 border rounded text-sm"/></div>
                      <div><label className="text-xs font-medium">Link Navegador/Web</label><input value={step.webLink||''} onChange={e=>updateStep(index,'webLink',e.target.value)} className="w-full p-2 border rounded text-sm"/></div>
                    </div>
                  </div>
                )}

                {step.type === 'pdf' && (
                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mt-4 grid md:grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold uppercase mb-1">Link Externo (Opcional)</label><input value={step.link||''} onChange={e=>updateStep(index,'link',e.target.value)} className="w-full p-2 border rounded text-sm"/></div>
                    <div>
                        <label className="text-xs font-bold uppercase mb-1">Upload PDF</label>
                        {!step.pdfData ? (
                            <label className="w-full p-2 border border-dashed rounded bg-white text-sm text-gray-500 cursor-pointer flex items-center justify-center gap-2 hover:bg-gray-50"><Upload className="w-4 h-4"/> Escolher Arquivo<input type="file" accept="application/pdf" className="hidden" onChange={e=>handlePdfUpload(index,e)}/></label>
                        ) : (
                            <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded"><span className="text-xs text-green-800 truncate max-w-[150px]">{step.pdfName||"Arquivo.pdf"}</span><button onClick={()=>updateStep(index,'pdfData',null)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4"/></button></div>
                        )}
                    </div>
                    <div className="md:col-span-2"><label className="text-xs font-bold uppercase mb-1">Texto do Botão</label><input value={step.buttonText||''} onChange={e=>updateStep(index,'buttonText',e.target.value)} className="w-full p-2 border rounded text-sm" placeholder="Ex: Baixar PDF"/></div>
                  </div>
                )}

                {step.type === 'location' && (
                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mt-4 grid md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="text-xs font-bold uppercase mb-1">Endereço ou Link Google Maps</label>
                        <input value={step.location||''} onChange={e=>updateStep(index,'location',e.target.value)} className="w-full p-2 border rounded text-sm" placeholder="Av. Paulista, 1000..."/>
                    </div>
                    <div><label className="text-xs font-bold uppercase mb-1">Texto do Botão</label><input value={step.buttonText||''} onChange={e=>updateStep(index,'buttonText',e.target.value)} className="w-full p-2 border rounded text-sm" placeholder="Abrir no Maps"/></div>
                  </div>
                )}

                {(step.type === 'text' || step.type === 'welcome') && (
                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mt-4 grid md:grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold uppercase mb-1">Link Botão Extra</label><input value={step.linkExtra||''} onChange={e=>updateStep(index,'linkExtra',e.target.value)} className="w-full p-2 border rounded text-sm" placeholder="https://..."/></div>
                    <div><label className="text-xs font-bold uppercase mb-1">Texto do Botão</label><input value={step.buttonText||''} onChange={e=>updateStep(index,'buttonText',e.target.value)} className="w-full p-2 border rounded text-sm" placeholder="Acessar"/></div>
                  </div>
                )}

                {/* GALERIA */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <label className="text-xs font-bold uppercase mb-2 block">Galeria</label>
                    <div className="grid grid-cols-4 gap-2">
                        {step.images?.map((img, i)=>(<div key={i} className="relative aspect-square"><img src={img} className="w-full h-full object-contain border rounded"/><button onClick={()=>{const n=[...step.images];n.splice(i,1);updateStep(index,'images',n)}} className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl"><Trash2 className="w-3 h-3"/></button></div>))}
                        <label className="border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:border-blue-500"><Plus/><input type="file" className="hidden" onChange={e=>handleImageUpload(index,e)}/></label>
                    </div>
                </div>
            </div>
        </div>
      ))}

      <button onClick={()=>setSteps([...steps, {id: Date.now(), type:'text', title:'Nova Etapa', content:'', images:[]}])} className="w-full py-4 border-2 border-dashed border-gray-400 rounded-xl text-gray-500 font-bold hover:border-blue-600 hover:text-blue-600 flex justify-center gap-2"><Plus/> Adicionar Etapa</button>
    </div>
  );
};

export default Editor;