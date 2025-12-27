import React, { useState, useEffect, useRef } from 'react';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc, updateDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

import { 
  Copy, ChevronRight, ChevronLeft, CheckCircle, FileText, Smartphone, Download, 
  ExternalLink, Play, Settings, Plus, Trash2, Layout, Eye, MoveUp, MoveDown, 
  Image as ImageIcon, Upload, Bold, Italic, MapPin, Underline, Link as LinkIcon, 
  Monitor, Loader, ArrowLeft, Edit, Save, X, Lock, Users, Share2, Search, FileSignature, MoveVertical,
  Palette, Type 
} from 'lucide-react';

import { jsPDF } from "jspdf";

// --- ⚠️ CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDiLbc_PiVR1EVoLRJlZvNZYSMxb2rEE54",
  authDomain: "onboarding-consultoria.firebaseapp.com",
  projectId: "onboarding-consultoria",
  storageBucket: "onboarding-consultoria.firebasestorage.app",
  messagingSenderId: "658269586608",
  appId: "1:658269586608:web:991d2c39d6f1664aaae775"
};

// Inicialização Segura do Banco de Dados e Storage
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

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

// ✅ HELPERS GLOBAIS (1 vez só, fora de componentes)
const escapeRegExp = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const escapeHtml = (str) =>
  String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

    const formatUrl = (url) => {
      if (!url) return "#";
      return url.toString().startsWith("http") ? url : `https://${url}`;
    };
// ✅ Helper: cria link do Google Maps a partir de um endereço ou link
const buildMapsUrl = (value) => {
  if (!value) return "#";

  const txt = String(value).trim();

  // Se já for um link, só garante o https
  if (txt.startsWith("http://") || txt.startsWith("https://")) {
    return txt;
  }

  // Se for texto/endereço, cria busca do Google Maps
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(txt)}`;
};
        
    const wrapHtmlForPdf = (innerHtml) => `
    <style>
      @page { size: A4; margin: 0; }
      
      .pdf-root {
        font-family: "Times New Roman", Times, serif !important;
        font-size: 12pt !important;
        line-height: 1.5 !important;
        color: #000000 !important;
        text-align: justify !important;
        
        /* Largura fixa em PX (794px = 210mm a 96dpi) para travar o layout */
        width: 794px; 
        min-height: 1123px; /* Altura mínima A4 */
        padding: 25mm 30mm; /* Margens: Sup/Inf 2.5cm, Esq/Dir 3cm */
        background: white;
        box-sizing: border-box;
      }
      
      .pdf-root p, .pdf-root div, .pdf-root span {
        color: #000 !important;
        margin-bottom: 0.8em;
      }
      
      img { max-width: 100%; height: auto; }
    </style>
    
    <div class="pdf-root">
      ${innerHtml}
    </div>
  `;

// --- EDITOR DE TEXTO DEFINITIVO (BARRA COMPLETA + ROLAGEM CORRIGIDA) ---
const RichTextEditor = ({ value, onChange, isA4 = false }) => {
  const editorRef = useRef(null);

  const execCmd = (command, val = null) => {
    document.execCommand(command, false, val);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const addLink = () => {
    const selectionText = window.getSelection()?.toString() || "";
    let url = prompt("Cole o link aqui:", "https://");
    if (!url) return;
    if (!url.startsWith("http://") && !url.startsWith("https://")) url = `https://${url}`;
    const text = prompt("Texto do link:", selectionText || "Clique aqui");
    if (!text) return;
    const linkHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;">${escapeHtml(text)}</a>`;
    document.execCommand("insertHTML", false, linkHtml);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  // --- FUNÇÕES DA BARRA DE FERRAMENTAS ---
  const changeColor = (e) => execCmd("foreColor", e.target.value);
  const changeSize = (e) => execCmd("fontSize", e.target.value);
  const alignLeft = () => execCmd("justifyLeft");
  const alignCenter = () => execCmd("justifyCenter");
  const alignRight = () => execCmd("justifyRight");
  const alignFull = () => execCmd("justifyFull");

  // --- QUEBRA DE PÁGINA VISUAL (Furo Cinza) ---
  const insertPageBreak = () => {
    const html = `
      <div contenteditable="false" style="
          background-color: #e5e7eb; 
          height: 20px; 
          margin: 40px -20mm; 
          border-top: 1px solid #d1d5db; 
          border-bottom: 1px solid #d1d5db;
          display: flex; align-items: center; justify-content: center;
          user-select: none; opacity: 0.8;
      ">
        <span style="font-size: 9px; color: #6b7280; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
          --- QUEBRA DE PÁGINA ---
        </span>
      </div>
      <div><br></div>
    `;
    document.execCommand("insertHTML", false, html);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const insertSignaturePlaceholder = () => {
    const html = `<div class="no-break" style="margin-top:20px;"><div style="height:60px; border-bottom:1px solid #000; width:260px;"></div><div style="font-size:10pt; color:#333; margin-top:5px;">Assinatura do Aluno</div><div>{{assinatura_aluno}}</div></div>`;
    document.execCommand("insertHTML", false, html);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== (value || "")) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  // --- CONFIGURAÇÃO VISUAL (FLUXO vs CONTRATO) ---
  
  // Container externo (A Mesa)
  const wrapperClass = isA4 
    ? "flex flex-col border border-gray-300 rounded-lg bg-gray-100 overflow-hidden h-[80vh]" // Contrato: Altura fixa com rolagem interna
    : "flex flex-col border border-gray-200 rounded-lg bg-white shadow-sm min-h-[300px]"; // Fluxo: Altura automática

  // Área de Scroll (Onde o papel desliza)
  const scrollAreaClass = isA4
    ? "flex-1 overflow-y-auto p-8 flex justify-center bg-gray-200" // Fundo cinza scrollável
    : "w-full";

  // O Papel (A Folha Branca)
  const paperStyle = isA4 
    ? { 
        width: "210mm", 
        minHeight: "297mm", 
        height: "auto", // IMPORTANTE: Cresce com o texto
        backgroundColor: "white", 
        padding: "20mm",
        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
        fontFamily: "'Times New Roman', serif", 
        fontSize: "12pt", 
        color: "#000",
        lineHeight: "1.5",
        outline: "none"
      } 
    : { 
        width: "100%", 
        minHeight: "250px", 
        padding: "20px", 
        backgroundColor: "white", 
        fontFamily: "ui-sans-serif, system-ui, sans-serif", 
        fontSize: "16px", 
        color: "#1f2937", 
        lineHeight: "1.6",
        outline: "none"
      };

  return (
    <div className={wrapperClass}>
      {/* --- BARRA DE FERRAMENTAS (FIXA NO TOPO) --- */}
      <div className="bg-gray-50 border-b border-gray-300 p-2 flex flex-wrap items-center gap-1 sticky top-0 z-20">
        
        {/* Grupo 1: Formatação Texto */}
        <div className="flex bg-white border border-gray-300 rounded overflow-hidden mr-2">
          <button onClick={() => execCmd("bold")} className="p-1.5 hover:bg-gray-100 text-gray-700 border-r border-gray-200" title="Negrito"><Bold className="w-4 h-4"/></button>
          <button onClick={() => execCmd("italic")} className="p-1.5 hover:bg-gray-100 text-gray-700 border-r border-gray-200" title="Itálico"><Italic className="w-4 h-4"/></button>
          <button onClick={() => execCmd("underline")} className="p-1.5 hover:bg-gray-100 text-gray-700" title="Sublinhado"><Underline className="w-4 h-4"/></button>
        </div>

        {/* Grupo 2: Alinhamento */}
        <div className="flex bg-white border border-gray-300 rounded overflow-hidden mr-2">
          <button onClick={alignLeft} className="p-1.5 hover:bg-gray-100 text-gray-700 border-r border-gray-200" title="Esquerda"><div className="text-[10px] font-bold">Esq</div></button>
          <button onClick={alignCenter} className="p-1.5 hover:bg-gray-100 text-gray-700 border-r border-gray-200" title="Centro"><div className="text-[10px] font-bold">Cen</div></button>
          <button onClick={alignFull} className="p-1.5 hover:bg-gray-100 text-gray-700" title="Justificado"><div className="text-[10px] font-bold">Jus</div></button>
        </div>

        {/* Grupo 3: Estilo Visual */}
        <div className="flex items-center gap-2 mr-2 bg-white border border-gray-300 rounded px-2 py-0.5">
          <div className="relative w-6 h-6 flex items-center justify-center cursor-pointer hover:bg-gray-100 rounded">
             <Palette className="w-4 h-4 text-blue-600" />
             <input type="color" onChange={changeColor} className="absolute inset-0 opacity-0 cursor-pointer" title="Cor do Texto" />
          </div>
          <div className="h-4 w-px bg-gray-200"></div>
          <select onChange={changeSize} className="text-xs bg-transparent outline-none cursor-pointer" title="Tamanho da Fonte">
             <option value="2">Pequeno</option>
             <option value="3" selected>Normal</option>
             <option value="4">Médio</option>
             <option value="5">Grande</option>
             <option value="7">Gigante</option>
          </select>
        </div>

        <button onClick={addLink} className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 text-gray-700 mr-2" title="Link"><LinkIcon className="w-4 h-4"/></button>

        {/* Grupo 4: Exclusivo Contrato (A4) */}
        {isA4 && (
          <div className="ml-auto flex items-center gap-2 pl-2 border-l border-gray-300">
             <button onClick={insertSignaturePlaceholder} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-sm">
               <FileSignature className="w-3 h-3"/> Assinatura
             </button>
             <button onClick={insertPageBreak} className="flex items-center gap-1 px-3 py-1.5 bg-red-50 border border-red-200 rounded text-xs font-bold text-red-600 hover:bg-red-100 shadow-sm">
               Quebra Pág.
             </button>
          </div>
        )}
      </div>

      {/* --- ÁREA DE EDIÇÃO (CORRIGIDA) --- */}
      <div className={scrollAreaClass}>
        <div 
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => { if (editorRef.current) onChange(editorRef.current.innerHTML); }}
          style={paperStyle}
        />
      </div>
    </div>
  );
};

const SignaturePad = ({ onSave, onClear }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.parentElement.offsetWidth;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000';
    }
  }, []);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (onSave) onSave(canvasRef.current.toDataURL());
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (onClear) onClear();
  };

  return (
    <div className="border border-gray-300 rounded-xl bg-white overflow-hidden shadow-inner">
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="w-full bg-white cursor-crosshair touch-none"
        style={{ height: '200px' }}
      />
      <div className="bg-gray-50 p-2 border-t border-gray-200 flex justify-end">
        <button onClick={clear} className="text-xs text-red-600 font-bold hover:bg-red-50 px-3 py-1 rounded">Limpar Assinatura</button>
      </div>
    </div>
  );
};

// --- FUNÇÃO GLOBAL: PREENCHER CONTRATO ---
const applyStudentValuesToContract = (html, values) => {
  let out = html || "";
  
  Object.entries(values || {}).forEach(([key, val]) => {
    // Tratamento seguro para regex
    const safeKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`{{\\s*${safeKey}\\s*}}`, "g");
    
    // Valor limpo (sem tags HTML estranhas, apenas texto)
    const safeVal = String(val ?? "").trim();
    
    // Se o valor existir, substitui. Se não, coloca linha.
    // Usamos o escapeHtml para segurança, mas sem envolver em <span> extra
    out = out.replace(regex, safeVal ? escapeHtml(safeVal) : "______________________");
  });
 
  // Substitui o placeholder da assinatura pela linha preta e espaço da imagem
  out = out.replace(
    /{{\s*assinatura_aluno\s*}}/g,
    `<div style="margin-top: 20px; width: 100%;">
       <div style="border-bottom: 1px solid #000; width: 260px; margin-bottom: 5px;"></div>
       <div style="font-size: 10pt;">Assinatura do Aluno</div>
     </div>`
  );
  
  // Limpa variáveis residuais que não foram preenchidas
  out = out.replace(/{{\s*[\w_]+\s*}}/g, "______________________");
  
  return out;
};

// --- COMPONENTE DASHBOARD (ADMIN) ---
const Dashboard = ({ 
  onSelectPlan, 
  onCreatePlan, 
  plans, 
  onDeletePlan, 
  onDuplicatePlan, 
  onUpdatePlanMeta, 
  students, 
  onCreateStudent, 
  onDeleteStudent 
}) => {

  // Controle das Abas
  const [activeTab, setActiveTab] = useState('flows'); 

  // --- ESTADOS DE FLUXOS ---
  const [newPlanName, setNewPlanName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [editName, setEditName] = useState("");
  const [duplicatingPlan, setDuplicatingPlan] = useState(null);
  const [duplicateName, setDuplicateName] = useState("");

  // --- ESTADOS DE ALUNOS & CONVITE ---
  const [isInviting, setIsInviting] = useState(false);
  
  // Campos básicos do convite
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentPhone, setNewStudentPhone] = useState("");
  const [selectedPlanForStudent, setSelectedPlanForStudent] = useState("");

  // Campos para o Template Dinâmico
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [adminFieldValues, setAdminFieldValues] = useState({});

  // --- ESTADOS DE MODELOS (TEMPLATES) ---
  const [templates, setTemplates] = useState([]);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState({ id: '', name: '', content: '', fields: [] });
  const [newField, setNewField] = useState({ key: '', label: '', type: 'text', owner: 'student' });

  const handleSaveTemplate = async () => {
    if (!currentTemplate.name) return alert("Dê um nome ao modelo.");
    try {
      const id = currentTemplate.id || generateSlug(currentTemplate.name);
      await setDoc(doc(db, "contract_templates", id), {
        name: currentTemplate.name,
        content: currentTemplate.content,
        fields: currentTemplate.fields || [],
        updatedAt: new Date().toISOString()
      });
      alert("Modelo salvo!");
      setIsEditingTemplate(false);
      const q = await getDocs(collection(db, "contract_templates"));
      setTemplates(q.docs.map(d => ({ ...d.data(), id: d.id })));
    } catch (e) { alert("Erro ao salvar template"); console.error(e); }
  };

  const addFieldToTemplate = () => {
    if (!newField.key || !newField.label) return alert("Preencha Chave e Rótulo");
    const cleanKey = newField.key.replace(/[{}]/g, '').trim();
    setCurrentTemplate({ ...currentTemplate, fields: [...currentTemplate.fields, { ...newField, key: cleanKey }] });
    setNewField({ key: '', label: '', type: 'text', owner: 'student' });
  };

  const removeFieldFromTemplate = (idx) => {
    const newFields = [...currentTemplate.fields];
    newFields.splice(idx, 1);
    setCurrentTemplate({ ...currentTemplate, fields: newFields });
  };

  // --- EFEITOS (LOADERS) ---
  useEffect(() => {
    if (activeTab === 'templates' || isInviting) {
      const loadTemplates = async () => {
        try {
          const database = db; 
          if (!database) return;
          const q = await getDocs(collection(database, "contract_templates"));
          const data = q.docs.map(d => ({ ...d.data(), id: d.id }));
          setTemplates(data); 
          console.log("Templates carregados:", data.length);
        } catch (e) { console.error("Erro ao buscar templates:", e); }
      };
      loadTemplates();
    }
  }, [activeTab, isInviting]);

  // --- FUNÇÕES DE FLUXO ---
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

  // --- FUNÇÕES DE ALUNO (CONVITE INTELIGENTE) ---
  const handleCreateInvite = () => {
    if (!newStudentName || !newStudentPhone || !selectedPlanForStudent || !selectedTemplateId) {
      alert("Preencha Nome, WhatsApp, Fluxo e escolha um Modelo de Contrato.");
      return;
    }

    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return alert("Modelo não encontrado.");

    let finalContractHTML = template.content;
    
    // Substitui campos do Admin
    const adminFields = template.fields.filter(f => f.owner === 'admin');
    
    for (const field of adminFields) {
      const val = adminFieldValues[field.key];
      if (!val) {
        alert(`O campo "${field.label}" é obrigatório para o Admin.`);
        return;
      }
      const regex = new RegExp(`{{${field.key}}}`, 'g');
      finalContractHTML = finalContractHTML.replace(
        regex,
        `<span class="contract-var">${escapeHtml(val)}</span>`
      );
    }

    const studentFields = template.fields.filter(f => f.owner === 'student');

    onCreateStudent({
      name: newStudentName,
      phone: newStudentPhone.replace(/\D/g, ''),
      planId: selectedPlanForStudent,
      contractText: finalContractHTML, 
      pendingFields: studentFields,
      templateId: selectedTemplateId,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    
    setIsInviting(false);
    
    setNewStudentName("");
    setNewStudentPhone("");
    setAdminFieldValues({});
    setSelectedTemplateId("");
  };

  const copyStudentLink = (studentId) => {
    const url = `${window.location.origin}/?token=${studentId}`;
    navigator.clipboard.writeText(url);
    alert("Link do Convite copiado! Envie para o aluno:\n" + url);
  };
  const buildSignedContractHtml = (student) => {
    const base = student?.contractText || "<p>Contrato não encontrado.</p>";
    const values = student?.studentData || {};
    let html = applyStudentValuesToContract(base, values);

    if (student?.signature?.image) {
      // Substitui a linha de assinatura pela imagem da assinatura
      html = html.replace(
        /<div style="height:60px; border-bottom:1px solid #111; width:260px; margin-top:10px;"><\/div>/g,
        `<div style="width:260px; position:relative; margin-top: 20px;">
            <img src="${student.signature.image}" style="width:200px; height:auto; display:block; margin-bottom:-10px;" />
            <div style="border-bottom:1px solid #000; width:260px;"></div>
         </div>`
      );
    }
    return html;
  };

  const generateContractPDF = async (student) => {
    if (!student?.signature?.image) {
      alert("Este aluno ainda não assinou.");
      return;
    }
  
    // Feedback visual
    const loadingMsg = document.createElement('div');
    loadingMsg.innerHTML = `
      <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.9);color:white;padding:20px 40px;border-radius:12px;z-index:99999;font-family:sans-serif;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:20px;height:20px;border:3px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>
          <span style="font-weight:bold;">Gerando PDF...</span>
        </div>
      </div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    `;
    document.body.appendChild(loadingMsg);
  
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      
      // Container temporário - VISÍVEL mas atrás de tudo
      const container = document.createElement("div");
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        z-index: -9999;
        width: 794px;
        height: auto;
        background: #ffffff;
        color: #000000;
        overflow: hidden;
      `;
      
      // Monta o HTML do contrato assinado
      const signedHtml = buildSignedContractHtml(student);
      container.innerHTML = wrapHtmlForPdf(signedHtml);
      document.body.appendChild(container);
  
      // Aguarda imagens carregarem (assinatura, logos, etc)
      await new Promise(resolve => setTimeout(resolve, 800));
  
      // Gera o PDF
      await pdf.html(container.querySelector(".pdf-root"), {
        callback: (doc) => {
          const fileName = `Contrato_${String(student.name || "Aluno").replace(/\s+/g, "_")}.pdf`;
          doc.save(fileName);
          
          // Limpa tudo
          document.body.removeChild(container);
          document.body.removeChild(loadingMsg);
        },
        x: 0,
        y: 0,
        width: 210, // A4 em mm
        windowWidth: 794, // A4 em pixels (96 DPI)
        margin: [0, 0, 0, 0], // Margens controladas pelo CSS interno
        html2canvas: { 
          scale: 2, // Qualidade alta
          useCORS: true, // Permite imagens externas
          letterRendering: true, // Melhora texto
          scrollY: 0,
          scrollX: 0,
          backgroundColor: "#ffffff",
          logging: false // Remove logs no console
        },
        autoPaging: 'text' // Quebra de página automática
      });
  
    } catch (error) {
      console.error("❌ Erro ao gerar PDF:", error);
      alert("Erro ao gerar o PDF. Verifique o console para detalhes.");
      
      // Limpa em caso de erro
      const tempContainer = document.querySelector('div[style*="z-index: -9999"]');
      if (tempContainer) document.body.removeChild(tempContainer);
      if (document.body.contains(loadingMsg)) document.body.removeChild(loadingMsg);
    }
  };

  // --- RENDERIZAÇÃO DO DASHBOARD ---
  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestão Consultoria Team Ebony</h1>
            <p className="text-gray-500">Gestão de Consultoria</p>
          </div>
          
          <div className="bg-white p-1 rounded-xl border border-gray-200 flex shadow-sm">
            <button onClick={() => setActiveTab('flows')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'flows' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>Meus Fluxos</button>
            <button onClick={() => setActiveTab('students')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'students' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}><Users className="w-4 h-4"/> Meus Alunos</button>
            <button onClick={() => setActiveTab('templates')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'templates' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}><FileText className="w-4 h-4"/> Modelos</button>
          </div>
        </div>

        {/* --- ABA 1: MEUS FLUXOS --- */}
        {activeTab === 'flows' && (
          <div className="animate-in fade-in duration-300">
            {editingPlan && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
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
                <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
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

{/* --- ABA 2: MEUS ALUNOS --- */}
{activeTab === 'students' && (
          <div className="animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">Lista de Alunos</h2>
              <button onClick={() => setIsInviting(true)} className="bg-black text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-lg">
                <Plus className="w-5 h-5" /> Novo Aluno
              </button>
            </div>

            {/* Modal Novo Aluno - ESTRUTURA CORRIGIDA PARA PREVIEW */}
            {isInviting && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row animate-in fade-in zoom-in duration-200">
                  
                  {/* COLUNA ESQUERDA: Formulário e Dados */}
                  <div className="w-full md:w-1/3 p-6 border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50 space-y-4 overflow-y-auto">
                    <h3 className="font-bold text-lg mb-4 text-gray-800">Dados do Convite</h3>
                    
                    <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome do Aluno</label>
                          <input type="text" value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} className="w-full p-2 border border-gray-300 rounded bg-white outline-none focus:border-blue-500" placeholder="Ex: João Silva"/>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">WhatsApp</label>
                          <input type="text" value={newStudentPhone} onChange={(e) => setNewStudentPhone(e.target.value)} className="w-full p-2 border border-gray-300 rounded bg-white outline-none focus:border-blue-500" placeholder="11999998888"/>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fluxo de Treino</label>
                          <select value={selectedPlanForStudent} onChange={(e) => setSelectedPlanForStudent(e.target.value)} className="w-full p-2 border border-gray-300 rounded bg-white outline-none focus:border-blue-500">
                            <option value="">Selecione um fluxo...</option>
                            {plans.map(p => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-blue-600 uppercase mb-1">Modelo de Contrato</label>
                          <select 
                            value={selectedTemplateId} 
                            onChange={(e) => {
                              setSelectedTemplateId(e.target.value);
                              setAdminFieldValues({}); 
                            }} 
                            className="w-full p-2 border border-blue-300 rounded bg-blue-50 outline-none font-bold text-blue-800 focus:ring-2 focus:ring-blue-200"
                          >
                            <option value="">Selecione o Modelo...</option>
                            {templates.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                    </div>
                    
                    {/* CAMPOS DINÂMICOS DO ADMIN */}
                    {selectedTemplateId && (
                        <div className="pt-4 border-t border-gray-200 animate-in fade-in">
                          <h4 className="font-bold text-sm mb-3 text-blue-800">Preencher Dados da Minuta</h4>
                          <div className="space-y-3 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                              {templates.find(t => t.id === selectedTemplateId)?.fields?.filter(f => f.owner === 'admin').map((field, idx) => (
                                  <div key={idx}>
                                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{field.label}</label>
                                      <input 
                                        type={field.type === 'date' ? 'date' : 'text'} 
                                        placeholder={`Digite ${field.label}...`} 
                                        value={adminFieldValues[field.key] || ''} 
                                        onChange={(e) => setAdminFieldValues({...adminFieldValues, [field.key]: e.target.value})} 
                                        className="w-full p-2 border border-gray-200 rounded text-sm outline-none focus:border-blue-500"
                                      />
                                  </div>
                              ))}
                          </div>
                        </div>
                    )}
                  </div>

                  {/* COLUNA DIREITA: Preview em tempo real */}
                  <div className="w-full md:w-2/3 p-6 flex flex-col bg-white overflow-hidden">
                    <div className="flex justify-between items-center mb-4">
                       <h3 className="font-bold text-lg text-gray-800">Prévia do Contrato</h3>
                       <button onClick={() => setIsInviting(false)} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                         <X className="w-6 h-6"/>
                       </button>
                    </div>
                    
                    <div className="flex-1 w-full p-8 border border-gray-200 rounded-lg text-sm leading-relaxed bg-gray-50 overflow-y-auto min-h-[400px] shadow-inner relative">
                        {selectedTemplateId ? (
                             <div 
                               dangerouslySetInnerHTML={{ 
                                __html: (() => {
                                  const tpl = templates.find(t => String(t.id) === String(selectedTemplateId));
                                  if (!tpl?.content) return "<p>Modelo sem conteúdo.</p>";
                                
                                  let html = tpl.content;
                                
                                  // aplica campos do admin na prévia
                                  (tpl.fields || [])
                                    .filter(f => f.owner === "admin")
                                    .forEach((f) => {
                                      const safeKey = String(f.key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                                      const regex = new RegExp(`{{\\s*${safeKey}\\s*}}`, "g");
                                      html = html.replace(regex, adminFieldValues[f.key] ? `<b>${adminFieldValues[f.key]}</b>` : "________________");
                                    });
                                
                                  // campos do aluno ficam em branco na prévia
                                  (tpl.fields || [])
                                    .filter(f => f.owner === "student")
                                    .forEach((f) => {
                                      const safeKey = String(f.key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                                      const regex = new RegExp(`{{\\s*${safeKey}\\s*}}`, "g");
                                      html = html.replace(regex, "________________");
                                    });
                                
                                  return html;
                                })()                                 
                               }} 
                               className="prose prose-sm max-w-none text-gray-700" 
                             />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-3">
                                <FileText className="w-16 h-16 opacity-10"/>
                                <p className="font-medium italic">Selecione um modelo à esquerda para visualizar o contrato.</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                      <button 
                        onClick={() => setIsInviting(false)} 
                        className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-bold transition-colors"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={handleCreateInvite} 
                        className="px-8 py-2 bg-black text-white rounded-lg font-bold hover:bg-gray-800 shadow-lg flex items-center gap-2 transition-transform active:scale-95"
                      >
                        <span>Gerar Convite</span> 
                        <ChevronRight className="w-4 h-4"/>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Lista de Alunos na Tabela */}
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
                            {student.status === 'signed' && (
                                <button onClick={() => generateContractPDF(student)} className="p-2 border border-gray-200 rounded-lg text-green-600 hover:bg-green-50 hover:border-green-200" title="Baixar PDF">
                                    <FileSignature className="w-4 h-4" />
                                </button>
                            )}
                            <button onClick={() => copyStudentLink(student.id)} className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-blue-50" title="Link">
                                <Share2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => {if(confirm('Remover?')) onDeleteStudent(student.id)}} className="p-2 border border-gray-200 rounded-lg text-gray-400 hover:bg-red-50">
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
        
        {/* --- ABA 3: MEUS MODELOS (ETAPA 1) --- */}
        {activeTab === 'templates' && (
          <div className="animate-in fade-in duration-300">
            {!isEditingTemplate ? (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Meus Modelos de Contrato</h2>
                  <button onClick={() => { setCurrentTemplate({ id: '', name: '', content: '', fields: [] }); setIsEditingTemplate(true); }} className="bg-black text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-800 shadow-lg"><Plus className="w-5 h-5" /> Novo Modelo</button>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  {templates.map(t => (
                    <div key={t.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
                      <h3 className="font-bold text-lg mb-2">{t.name}</h3>
                      <p className="text-xs text-gray-400 mb-4">ID: {t.id}</p>
                      <p className="text-sm text-gray-600 mb-4">{t.fields?.length || 0} variáveis configuradas.</p>
                      <button onClick={() => { setCurrentTemplate(t); setIsEditingTemplate(true); }} className="w-full py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100">Editar</button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-xl border border-gray-200 flex flex-col h-[85vh]">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
                  <div className="flex items-center gap-4 flex-1">
                    <button onClick={() => setIsEditingTemplate(false)}><ArrowLeft className="w-5 h-5 text-gray-500"/></button>
                    <input type="text" placeholder="Nome do Modelo" value={currentTemplate.name} onChange={e => setCurrentTemplate({...currentTemplate, name: e.target.value})} className="bg-transparent font-bold text-lg outline-none w-full"/>
                  </div>
                  <button onClick={handleSaveTemplate} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 flex items-center gap-2"><Save className="w-4 h-4"/> Salvar Modelo</button>
                </div>
                <div className="flex-1 overflow-hidden h-full flex flex-col md:flex-row">
                  <div className="w-full md:w-2/3 p-6 overflow-y-auto border-r border-gray-200">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Texto do Contrato</label>
                    <RichTextEditor isA4={true} value={currentTemplate.content} onChange={(html) => setCurrentTemplate({...currentTemplate, content: html})} />                  </div>
                  <div className="w-full md:w-1/3 p-6 bg-gray-50 overflow-y-auto">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Settings className="w-4 h-4"/> Variáveis</h3>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 mb-6 shadow-sm">
                      <h4 className="text-xs font-bold text-blue-600 uppercase mb-3">Nova Variável</h4>
                      <div className="space-y-3">
                        <div><label className="text-[10px] font-bold text-gray-400 uppercase">Chave</label><div className="flex items-center gap-1"><span className="text-gray-400 font-mono text-sm">{`{{`}</span><input type="text" value={newField.key} onChange={e => setNewField({...newField, key: e.target.value.replace(/[^a-z0-9_]/g, '')})} className="flex-1 p-1 border-b border-gray-300 outline-none font-mono text-sm bg-transparent"/><span className="text-gray-400 font-mono text-sm">{`}}`}</span></div></div>
                        <div><label className="text-[10px] font-bold text-gray-400 uppercase">Nome (Label)</label><input type="text" value={newField.label} onChange={e => setNewField({...newField, label: e.target.value})} className="w-full p-2 border border-gray-200 rounded text-sm"/></div>
                        <div className="grid grid-cols-2 gap-2">
                          <div><label className="text-[10px] font-bold text-gray-400 uppercase">Quem?</label><select value={newField.owner} onChange={e => setNewField({...newField, owner: e.target.value})} className="w-full p-2 border border-gray-200 rounded text-sm bg-white"><option value="student">Aluno</option><option value="admin">Eu (Admin)</option></select></div>
                          <div><label className="text-[10px] font-bold text-gray-400 uppercase">Tipo</label><select value={newField.type} onChange={e => setNewField({...newField, type: e.target.value})} className="w-full p-2 border border-gray-200 rounded text-sm bg-white"><option value="text">Texto</option><option value="number">Número</option><option value="money">Dinheiro</option><option value="date">Data</option></select></div>
                        </div>
                        <button onClick={addFieldToTemplate} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 mt-2">Adicionar</button>
                      </div>
                    </div>
                    <div className="space-y-2">{currentTemplate.fields && currentTemplate.fields.map((field, idx) => (<div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 flex justify-between items-center"><div><div className="font-mono text-xs font-bold text-blue-600 bg-blue-50 inline-block px-1 rounded mb-1">{`{{${field.key}}}`}</div><div className="text-xs text-gray-500">{field.label}</div></div><button onClick={() => removeFieldFromTemplate(idx)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button></div>))}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

const OnboardingConsultoria = () => {
  const ADMIN_PASSWORD = "ebony";

  const defaultSteps = [
    { id: 1, type: 'welcome', title: 'Boas-vindas', content: 'Bem-vindo ao time!', buttonText: '', link: '', coverImage: null, coverPosition: 50, images: [] }
  ];

  const [passwordInput, setPasswordInput] = useState("");

  const [viewState, setViewState] = useState('loading'); 
  const [isAdminAccess, setIsAdminAccess] = useState(false);
  const [activePlanId, setActivePlanId] = useState(null);
  const [activeStudent, setActiveStudent] = useState(null); 
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

  // 5. Função de EDITAR (Abrir o editor)
  const handleEditPlan = async (id) => {
    setActivePlanId(id);
    await loadPlan(id);
    setViewState('editor');
  };
  
  // --- ⬇️ LÓGICA DE ASSINATURA DO ALUNO (COLE AQUI) ⬇️ ---
  const [signatureData, setSignatureData] = useState(null);
  const [studentFieldValues, setStudentFieldValues] = useState({});

  const handleSignContract = async () => {
    if (!activeStudent || !db) return;

    // 1. Verifica campos pendentes
    const pending = Array.isArray(activeStudent?.pendingFields) ? activeStudent.pendingFields : [];
    const requiredKeys = pending
      .filter(f => f?.owner === "student" && f?.key)
      .map(f => f.key);

    // 2. Valida se preencheu tudo
    const missing = requiredKeys.filter((k) => !String(studentFieldValues?.[k] ?? "").trim());

    if (missing.length > 0) {
      const firstMissing = pending.find(f => f.key === missing[0]);
      alert(`Por favor, preencha: ${firstMissing?.label || missing[0]}`);
      return;
    }

    // 3. Valida se desenhou a assinatura
    if (!signatureData) {
      alert("Por favor, faça sua assinatura.");
      return;
    }

    try {
      setViewState("loading");

      // 4. Atualiza no Firebase
      await updateDoc(doc(db, "students", activeStudent.id), {
        status: "signed",
        studentData: {
          ...studentFieldValues,
          signedAt: new Date().toISOString(),
        },
        signature: {
          image: signatureData,
          userAgent: navigator.userAgent,
        },
      });

      // 5. Atualiza estado local e redireciona
      setActiveStudent(prev => ({ ...prev, status: "signed" }));
      await loadPlan(activeStudent.planId);
      setViewState("student_view_flow");
      alert("Contrato assinado com sucesso! Bem-vindo(a)!");

    } catch (e) {
      console.error(e);
      alert("Erro ao salvar assinatura. Tente novamente.");
      setViewState("student_login");
    }
  };

  // Atualiza o login para levar à tela de contrato se necessário
  // ⚠️ ATENÇÃO: Substitua sua função handleStudentLogin atual por esta:
  const handleStudentLoginV2 = async () => {
    const phoneClean = studentPhoneInput.replace(/\D/g, '');
    const registeredPhone = activeStudent.phone.replace(/\D/g, '');
    
    if (phoneClean === registeredPhone) {
        // SALVA O LOGIN NA SESSÃO
        sessionStorage.setItem('ebony_student_phone', phoneClean);

        if (activeStudent.status === 'signed') {
            await loadPlan(activeStudent.planId);
            setViewState('student_view_flow');
        } else {
            setViewState('contract_sign'); 
        }
    } else {
        alert("Número de WhatsApp não confere com o cadastro deste convite.");
    }
  };
  // --- ⬆️ FIM DA LÓGICA DE ASSINATURA ⬆️ ---

  // --- ⬆️ FIM DO BLOCO ⬆️ ---

  // --- INICIALIZAÇÃO CORRIGIDA E SIMPLIFICADA ---
  useEffect(() => {
    const initSystem = async () => {
      
      // 1. CARREGA O VISUAL (TAILWIND)
      if (!window.tailwind) {
        if (!document.querySelector('script[src*="tailwindcss"]')) {
          const script = document.createElement('script');
          script.src = "https://cdn.tailwindcss.com";
          document.head.appendChild(script);
        }
        await new Promise(r => setTimeout(r, 300)); // Pequena pausa para garantir
      }

      // 2. SISTEMA DE ROTEAMENTO
      const params = new URLSearchParams(window.location.search);
      const urlId = params.get('id');        
      const urlToken = params.get('token'); 
      const urlAdmin = params.get('admin');

      // CASO 1: LINK DE ALUNO
      if (urlToken) {
        try {
            const studentRef = doc(db, "students", urlToken);
            const studentSnap = await getDoc(studentRef);
            if (studentSnap.exists()) {
                const sData = { id: studentSnap.id, ...studentSnap.data() };
                setActiveStudent(sData);
                const savedPhone = sessionStorage.getItem('ebony_student_phone');
                const studentPhone = sData.phone.replace(/\D/g, '');
                
                if (savedPhone === studentPhone) {
                    if (sData.status === 'signed') {
                        await loadPlan(sData.planId);
                        setViewState('student_view_flow');
                    } else {
                        setViewState('contract_sign');
                    }
                } else {
                    setViewState('student_login');
                }
            } else {
                alert("Convite não encontrado.");
                setViewState('error');
            }
        } catch (e) { 
            console.error(e); 
            setViewState('login'); // Em caso de erro grave, joga pro login
        }

      // CASO 2: LINK DIRETO (ANTIGO)
      } else if (urlId) {
        await loadPlan(urlId);
        setActivePlanId(urlId);
        setViewState('student_view_legacy');

      // CASO 3: ADMIN / DASHBOARD
      } else {
        const hasSession = sessionStorage.getItem('ebony_admin') === 'true';
        if (urlAdmin === 'true' || hasSession) {
          setIsAdminAccess(true);
          try {
            // Tenta carregar os dados
            await Promise.all([loadAllPlans(), loadAllStudents()]);
          } catch (error) {
            console.error("Erro ao carregar dados iniciais:", error);
          }
          setViewState('dashboard'); // Abre o dashboard mesmo se der erro no load (para não travar tela branca)
        } else {
          setViewState('login');
        }
      }
    };

    initSystem();
  }, []);

  // --- LOGINS ---
  const handleAdminLogin = async () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAdminAccess(true);
      // SALVA O LOGIN NA SESSÃO (Para não pedir senha no F5)
      sessionStorage.setItem('ebony_admin', 'true');
      
      try {
        await Promise.all([loadAllPlans(), loadAllStudents()]);
        setViewState('dashboard');
      } catch (e) {
        console.error(e);
        alert("Erro ao carregar dados. Verifique a internet.");
      }
    } else {
      alert("Senha incorreta.");
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
    if (!db) return;
    try {
      const docRef = doc(collection(db, "students")); 
      const finalData = { ...data, id: docRef.id };
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
      await setDoc(doc(db, "onboarding", activePlanId), { 
        name: coachName, 
        coachName, whatsappLink, finalTitle, finalMessage, finalButtonText, steps 
      });
      alert("✅ Fluxo salvo com sucesso!");
    } catch (error) { alert("Erro ao salvar."); console.error(error); } finally { setIsSaving(false); }
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
    if (direction === 'up' && index > 0) {
      const newSteps = [...steps];
      [newSteps[index], newSteps[index - 1]] = [newSteps[index - 1], newSteps[index]];
      setSteps(newSteps);
    } else if (direction === 'down' && index < steps.length - 1) {
      const newSteps = [...steps];
      [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
      setSteps(newSteps);
    }
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

// --- UPLOAD DE GALERIA (REAL PARA A NUVEM) ---
// --- UPLOAD DE GALERIA OTIMIZADO (COMPRESSÃO AUTOMÁTICA) ---
const handleImageUpload = async (index, e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Feedback visual simples no botão (muda o texto temporariamente)
  const labelElement = e.target.parentElement.querySelector('span');
  if (labelElement) {
      labelElement.innerText = "Comprimindo...";
      labelElement.className = "text-xs font-bold text-blue-600 animate-pulse";
  }

  try {
    if (!storage) throw new Error("Storage não iniciado");

    // 1. OTIMIZAÇÃO (O "Mini-Robô" que diminui a foto)
    const compressedFile = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200; // Limite de largura (HD)
          const scaleSize = MAX_WIDTH / img.width;
          
          // Se a imagem já for pequena, não mexe
          if (scaleSize >= 1) {
              resolve(file); 
              return;
          }

          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Transforma em JPEG leve (80% qualidade)
          canvas.toBlob((blob) => {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.8);
        };
      };
    });

    // 2. UPLOAD DO ARQUIVO LEVE
    const storageRef = ref(storage, `galeria/${Date.now()}-${file.name}`);
    const snapshot = await uploadBytes(storageRef, compressedFile);
    const url = await getDownloadURL(snapshot.ref);
    
    // 3. ADICIONA À LISTA DE IMAGENS EXISTENTE
    const currentImages = steps[index].images || [];
    updateStep(index, 'images', [...currentImages, url]);
    
    // Restaura o texto do botão
    if (labelElement) {
        labelElement.innerText = "Add Imagem";
        labelElement.className = "text-xs text-gray-500 font-medium";
    }

  } catch (error) {
    console.error("Erro no upload:", error);
    alert("Erro ao enviar imagem: " + error.message);
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
        // Aqui conectamos as funções corretamente:
        onSelectPlan={handleEditPlan}           // Usa a função de editar que acabamos de criar
        onCreatePlan={handleCreatePlan}         // Usa a função de criar restaurada
        onDeletePlan={handleDeletePlan}         // Função original de deletar
        onDuplicatePlan={handleDuplicatePlan}   // Função original de duplicar
        onUpdatePlanMeta={handleUpdatePlanMetadata} // Função original de atualizar nome
        
        students={students}
        onCreateStudent={onCreateStudent}
        onDeleteStudent={handleDeleteStudent} 
      />
    );
  }

  // --- RENDERIZAÇÃO ---

  if (viewState === 'loading') return <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5]"><Loader className="w-8 h-8 animate-spin text-gray-400"/></div>;
  
  // TELA 1: LOGIN ADMIN
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

  // --- AQUI ESTAVA O ERRO: O CÓDIGO "LIXO" FOI REMOVIDO DAQUI ---

  if (viewState === 'contract_sign') {
    const baseHTML = activeStudent?.contractText || "<p>Contrato não encontrado.</p>";

    // campos do modelo que são do aluno
    const pending = Array.isArray(activeStudent?.pendingFields) ? activeStudent.pendingFields : [];

    // junta: campos dinâmicos + CPF/Endereço (que tu mantém como fixos)
    const mergedValues = {
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

    {(step.type === 'text' || step.type === 'welcome') && step.link && (
      <a href={formatUrl(step.link)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-blue-600 hover:underline font-medium mt-4">{step.buttonText || "Acessar Link"} <ExternalLink className="w-4 h-4"/></a>
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
      <><div className="relative bg-gray-900 aspect-video rounded-xl overflow-hidden flex items-center justify-center group cursor-pointer shadow-lg mt-6"><div className="absolute inset-0 bg-black/40"></div><Play className="w-16 h-16 text-white opacity-90 relative z-10" /><p className="absolute bottom-4 left-4 text-white font-medium text-sm z-10">Vídeo Explicativo</p>{step.link && <a href={formatUrl(step.link)} target="_blank" rel="noreferrer" className="absolute inset-0 z-20"></a>}</div>{step.buttonText && <a href={formatUrl(step.link)} target="_blank" rel="noreferrer" className="block w-full text-center py-3 bg-blue-600 text-white rounded-lg font-bold mt-4">{step.buttonText}</a>}</>
    )}
  </div>
);

// --- RENDER FINAL (EDITOR OU ALUNO) ---
if (viewState === 'editor' || viewState === 'student_view_flow' || viewState === 'student_view_legacy') {
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
      )}

{/* CONTEÚDO PRINCIPAL */}
<main className={`max-w-6xl mx-auto px-4 py-8 ${viewState === 'editor' ? 'max-w-4xl' : ''}`}>
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
                    {(step.type === 'text' || step.type === 'boas-vindas') && (
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