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
// --- ASSINATURA DA EMPRESA (FIXA) ---
const COMPANY_SIGNATURE_URL = "https://i.imgur.com/K7u9k5B.png";
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
// ✅ NOVO COMPONENTE GLOBAL: Player de Vídeo Inteligente (Corrigido com playsinline)
const VideoPlayerGlobal = ({ url }) => {
  if (!url) return null;
  const cleanUrl = url.trim();

  // 1. YouTube (Suporta links curtos, longos e embeds)
  const ytMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return (
      <iframe
        className="w-full h-full"
        // ADICIONADO: playsinline=1 força o vídeo a ficar na página
        src={`https://www.youtube.com/embed/${ytMatch[1]}?rel=0&playsinline=1`}
        title="YouTube video"
        frameBorder="0"
        // ADICIONADO: Atributo playsInline para compatibilidade mobile
        playsInline
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  // 2. Vimeo
  const vimeoMatch = cleanUrl.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return (
      <iframe
        className="w-full h-full"
        src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
        title="Vimeo video"
        frameBorder="0"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  }

  // 3. Vídeo Direto (.mp4, .webm, etc)
  if (cleanUrl.match(/\.(mp4|webm|ogg)$/i)) {
    return (
      <video className="w-full h-full" controls playsInline>
        <source src={cleanUrl} />
        Seu navegador não suporta este vídeo.
      </video>
    );
  }

  // 4. Fallback (Se não for vídeo reconhecido, mostra link)
  return (
    <div className="flex items-center justify-center h-full bg-gray-100 text-gray-500">
      <a href={cleanUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 underline">
        <ExternalLink className="w-4 h-4" /> Abrir Link do Vídeo
      </a>
    </div>
  );
};
    // ✅ ATUALIZADO: CSS ajustado para A4 Real
    const wrapHtmlForPdf = (innerHtml) => `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&display=swap');
      
      /* Configuração da Página para o motor do PDF */
      .pdf-container {
        width: 794px; /* Largura exata A4 em px (96dpi) */
        min-height: 1123px;
        padding: 40px 60px; /* Margens internas confortáveis */
        background: white;
        font-family: 'Times New Roman', serif; /* Fonte padrão de contrato */
        font-size: 14px; /* Tamanho legível */
        color: #000;
        line-height: 1.5;
        text-align: justify;
      }

      /* Garante que imagens (assinatura) não estouram */
      img { max-width: 100%; height: auto; }
      
      /* Força quebra de página limpa se necessário */
      .page-break { page-break-before: always; }
    </style>

    <div class="pdf-container">
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
            <option value="3">Normal</option>
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

// --- COMPONENTE DE ASSINATURA V6 (CORRIGIDO: RESIZE + SELEÇÃO) ---
const SignaturePad = ({ onSave, onClear }) => {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 250, ratio: 1 });
  const drawingRef = useRef(false);

  // --- CONFIGURAÇÃO ---
  const MIN_WIDTH = 1.8;
  const MAX_WIDTH = 4.8;
  const MIN_DISTANCE = 0.6;
  const CURVE_STEPS = 10;
  const VELOCITY_FILTER = 0.82;
  const PRESSURE_WEIGHT = 0.55;

  // --- REFS ---
  const ptsRef = useRef([]);
  const lastVelocityRef = useRef(0);
  const lastWidthRef = useRef(3);
  const hasInkRef = useRef(false);
  const movedRef = useRef(false);
  // 🔥 NOVO: Ref para salvar o desenho durante o resize
  const tempImgRef = useRef(null);

  // 1) Configuração Robusta do Canvas (Com Persistência de Dados)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      // 🔥 PASSO 1: Salva o desenho atual antes de mudar o tamanho
      // Só salva se já tiver tinta, para evitar salvar um canvas em branco
      let savedData = null;
      if (hasInkRef.current) {
         savedData = canvas.toDataURL();
      }

      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const w = parent.offsetWidth;
      const h = 250;

      sizeRef.current = { w, h, ratio };

      // Ao definir width/height, o canvas limpa automaticamente
      canvas.width = Math.floor(w * ratio);
      canvas.height = Math.floor(h * ratio);

      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#000";
      ctx.fillStyle = "#000";
      ctx.lineWidth = 3;

      ctxRef.current = ctx;

      // 🔥 PASSO 2: Restaura o desenho antigo (se existir)
      if (savedData) {
        const img = new Image();
        img.src = savedData;
        img.onload = () => {
          // Desenha a imagem esticada para o novo tamanho
          // Nota: Isso pode distorcer levemente se a proporção mudar muito, 
          // mas para assinaturas é imperceptível e mantém o registro.
          ctx.drawImage(img, 0, 0, w, h);
        };
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  // 2) Coordenadas
  const getPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      t: performance.now(),
      p: (typeof e.pressure === "number" && e.pressure > 0) ? e.pressure : 0.5,
    };
  };

  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (a, b) => Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const velocity = (a, b) => dist(a, b) / Math.max(1, (b.t - a.t));

  const quadPoint = (p0, p1, p2, t) => {
    const mt = 1 - t;
    return {
      x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
    };
  };

  const computeWidth = (vel, pressure) => {
    const v = Math.min(2.5, Math.max(0, vel));
    const speedFactor = 1 - (v / 2.5);
    const press = Math.min(1, Math.max(0.1, pressure));
    const mixed = (1 - PRESSURE_WEIGHT) * speedFactor + PRESSURE_WEIGHT * press;
    const w = MIN_WIDTH + (MAX_WIDTH - MIN_WIDTH) * mixed;
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w));
  };

  const drawQuadraticVariableWidth = (from, ctrl, to, startW, endW) => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    let prev = from;
    for (let i = 1; i <= CURVE_STEPS; i++) {
      const t = i / CURVE_STEPS;
      const cur = quadPoint(from, ctrl, to, t);
      const w = lerp(startW, endW, t);

      ctx.beginPath();
      ctx.lineWidth = w;
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(cur.x, cur.y);
      ctx.stroke();

      prev = cur;
    }
    hasInkRef.current = true;
  };

  const resetStrokeState = () => {
    ptsRef.current = [];
    lastVelocityRef.current = 0;
    lastWidthRef.current = 3;
    movedRef.current = false;
  };

  const handlePointerDown = (e) => {
    // 🔥 CORREÇÃO DE SELEÇÃO: Mata qualquer evento padrão
    e.preventDefault();
    e.stopPropagation(); 

    // 🔥 TRUQUE EXTRA: Trava seleção no body enquanto desenha
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none'; // Safari Mobile

    const canvas = canvasRef.current;
    if (!canvas || !ctxRef.current) return;

    drawingRef.current = true;
    resetStrokeState();

    const pt = getPoint(e);
    ptsRef.current.push(pt);

    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  };

  const handlePointerMove = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!drawingRef.current) return;

    const pt = getPoint(e);
    const last = ptsRef.current[ptsRef.current.length - 1];
    if (last && dist(last, pt) < MIN_DISTANCE) return;

    movedRef.current = true;
    ptsRef.current.push(pt);

    if (ptsRef.current.length < 3) return;
    if (ptsRef.current.length > 3) ptsRef.current.shift();

    const [p0, p1, p2] = ptsRef.current;
    const m1 = mid(p0, p1);
    const m2 = mid(p1, p2);

    const v = velocity(p1, p2);
    const filteredV = VELOCITY_FILTER * lastVelocityRef.current + (1 - VELOCITY_FILTER) * v;
    const targetW = computeWidth(filteredV, p2.p);
    const startW = lastWidthRef.current;

    drawQuadraticVariableWidth(m1, p1, m2, startW, targetW);

    lastVelocityRef.current = filteredV;
    lastWidthRef.current = targetW;
  };

  const finishStroke = (e) => {
    e.preventDefault();
    
    // 🔥 LIBERA SELEÇÃO: Devolve o comportamento normal ao body
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';

    if (!drawingRef.current) return;
    drawingRef.current = false;

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;

    try {
      if (canvas && e.pointerId) canvas.releasePointerCapture(e.pointerId);
    } catch (err) {}

    if (ctx && !movedRef.current) {
      const pt = ptsRef.current[0] || getPoint(e);
      const r = (MAX_WIDTH / 2) * 0.9;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();
      hasInkRef.current = true;
    }

    if (onSave && canvas && hasInkRef.current) {
      onSave(canvas.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    resetStrokeState();
    hasInkRef.current = false;
    if (onClear) onClear();
  };

  return (
    <div
      // 🔥 CORREÇÃO: Impede o início de seleção no container pai também
      onSelectStart={(e) => e.preventDefault()}
      className="border border-gray-300 rounded-xl bg-white overflow-hidden shadow-inner select-none touch-none"
      style={{ touchAction: "none" }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onPointerLeave={finishStroke}
        onPointerOut={finishStroke}
        style={{
          touchAction: "none",
          display: "block",
          width: "100%",
          height: "250px",
          cursor: "crosshair",
        }}
      />

      <div className="bg-gray-50 p-2 border-t border-gray-200 flex justify-between items-center px-4">
        <span className="text-[10px] text-gray-400 uppercase font-bold pointer-events-none select-none">
          Assine no espaço acima
        </span>
        <button
          onClick={clear}
          type="button"
          className="text-xs text-red-600 font-bold hover:bg-red-50 px-3 py-1.5 rounded transition-colors uppercase tracking-wide select-none"
        >
          Limpar
        </button>
      </div>
    </div>
  );
};

// --- COMPONENTE DASHBOARD (ADMIN) ---
const Dashboard = ({ 
  onSelectPlan, 
  onCreatePlan, 
  plans, 
  onDeletePlan, 
  onDuplicatePlan, 
  onUpdatePlanMeta, onUpdatePlanColor,
  students, 
  onCreateStudent, 
  onDeleteStudent, onReloadData
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
  const [editingStudentId, setEditingStudentId] = useState(null); // ID do aluno sendo editado/aprovado
  
  // Campos básicos do convite
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentPhone, setNewStudentPhone] = useState("");
  const [selectedPlanForStudent, setSelectedPlanForStudent] = useState("");

  // Campos para o Template Dinâmico
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [adminFieldValues, setAdminFieldValues] = useState({});
  // Estado para editar os dados extras do aluno (CPF, RG, etc.)
  const [extraData, setExtraData] = useState({ cpf: '', rg: '', email: '', address: '', birthDate: '', profession: '' });
  // --- NOVOS ESTADOS PARA O FLUXO DE APROVAÇÃO (WORD) ---
  const [approvalStep, setApprovalStep] = useState(1); // 1 = Formulário, 2 = Editor Final
  const [draftContract, setDraftContract] = useState(""); // O texto do contrato para editar
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

  // --- FUNÇÃO QUE FALTAVA: COPIAR LINK DO ALUNO ---
  const copyStudentLink = (studentId) => {
    const url = `${window.location.origin}/?token=${studentId}`;
    navigator.clipboard.writeText(url);
    alert("Link de acesso do aluno copiado:\n" + url);
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

  // --- FUNÇÕES DE ALUNO (CONVITE INTELIGENTE & APROVAÇÃO) ---
  
  // Função para abrir o modal com os dados do aluno que veio do site
  // --- FUNÇÕES DE ALUNO (CONVITE INTELIGENTE & APROVAÇÃO) ---
  
  const openApproveModal = (student) => {
    setEditingStudentId(student.id);
    setNewStudentName(student.name);
    setNewStudentPhone(student.phone);
    setApprovalStep(1);
    // Carrega os dados extras para edição
    setExtraData({
        cpf: student.cpf || '',
        rg: student.rg || '',
        email: student.email || '',
        address: student.address || '',
        birthDate: student.birthDate || '',
        profession: student.profession || ''
    });
    setIsInviting(true);
  };

  // Função NOVA: Salva apenas os dados cadastrais E ATUALIZA A TELA
  const handleSaveDataOnly = async () => {
    if (!editingStudentId) return alert("Nenhum aluno selecionado para edição.");
    
    try {
        await updateDoc(doc(db, "students", editingStudentId), {
            name: newStudentName,
            phone: newStudentPhone.replace(/\D/g, ''),
            ...extraData // Salva CPF, RG, Endereço, etc.
        });
        
        // Força a atualização da lista na hora!
        if (onReloadData) {
            await onReloadData(); 
        }
        
        alert("✅ Dados do aluno atualizados com sucesso!");
    } catch (e) {
        console.error(e);
        alert("Erro ao salvar dados.");
    }
  };

// 1. GERAR RASCUNHO (Passo A -> Passo B)
const handleGenerateDraft = () => {
  if (!newStudentName || !newStudentPhone || !selectedPlanForStudent || !selectedTemplateId) {
    alert("Preencha Nome, WhatsApp, Fluxo e escolha um Modelo.");
    return;
  }

  const template = templates.find(t => t.id === selectedTemplateId);
  if (!template) return alert("Modelo não encontrado.");

  let html = template.content;

  // A. Preenche Variáveis Manuais (Admin - Valor, Duração, etc)
  const adminFields = template.fields.filter(f => f.owner === 'admin');
  for (const field of adminFields) {
    const val = adminFieldValues[field.key];
    if (!val) {
      alert(`O campo "${field.label}" é obrigatório.`);
      return;
    }
    const regex = new RegExp(`{{${field.key}}}`, 'g');
    html = html.replace(regex, val);
  }

  // B. O GRANDE DICIONÁRIO (Conecta Banco de Dados -> Contrato)
  const studentDataForMerge = {
      // Dados Básicos
      nome: newStudentName,
      telefone: newStudentPhone,
      
      // Dados Cadastrais (ExtraData)
      cpf: extraData.cpf,
      rg: extraData.rg,
      email: extraData.email,
      profissao: extraData.profession,
      endereco: extraData.address,
      
      // Formata a data (Ex: 1998-08-07 -> 07/08/1998)
      nascimento: extraData.birthDate ? new Date(extraData.birthDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : "",
  };

  // Aplica a tradução no texto
  html = applyStudentValuesToContract(html, studentDataForMerge);

  // C. Avança para o Editor Final
  setDraftContract(html);
  setApprovalStep(2);
};

  // 2. FINALIZAR E ENVIAR (Passo B -> Firebase)
  const handleFinalizeInvite = async () => {
    const studentFields = templates.find(t => t.id === selectedTemplateId)?.fields.filter(f => f.owner === 'student') || [];

    const finalData = {
      name: newStudentName,
      phone: newStudentPhone.replace(/\D/g, ''),
      ...extraData, 
      planId: selectedPlanForStudent,
      contractText: draftContract, // Salva o texto que você editou no "Word"
      pendingFields: studentFields,
      templateId: selectedTemplateId,
      status: 'pending',
    };

    try {
      if (editingStudentId) {
        await updateDoc(doc(db, "students", editingStudentId), finalData);
        alert("Contrato gerado e vinculado com sucesso!");
      } else {
        await onCreateStudent({
          ...finalData,
          createdAt: new Date().toISOString()
        });
      }
      
      // Reseta tudo
      setIsInviting(false);
      setEditingStudentId(null);
      setNewStudentName("");
      setNewStudentPhone("");
      setExtraData({ cpf: '', rg: '', email: '', address: '', birthDate: '', profession: '' });
      setAdminFieldValues({});
      setSelectedTemplateId("");
      setApprovalStep(1); // Volta para o passo 1
      
      if (onReloadData) await onReloadData();

    } catch (e) {
      console.error(e);
      alert("Erro ao salvar.");
    }
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
  // --- GERADOR DA PÁGINA DE LOG (CORRIGIDO E LIMPO) ---
  // --- GERADOR DA PÁGINA DE LOG (CORRIGIDO: CPF + QUEBRA DE PÁGINA) ---
  const buildAuditPageHtml = (student) => {
    const sData = student.studentData || {};
    
    // CORREÇÃO DO CPF: Busca na raiz (cadastro) ou nos dados salvos (assinatura)
    const rawCpf = student.cpf || sData.cpf || 'Não informado';
    // Formata CPF se necessário (opcional, mas garante visual bonito)
    const finalCpf = rawCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

    const signDate = sData.signedAt ? new Date(sData.signedAt).toLocaleString('pt-BR') : 'Data n/d';
    const createdDate = student.createdAt ? new Date(student.createdAt).toLocaleString('pt-BR') : 'Data n/d';
    const ip = sData.ipAddress || "IP não registrado";
    const docId = student.id;
    const hashId =  docId.split('').reverse().join('') + "ab9"; 

    // ATENÇÃO AO ESTILO ABAIXO:
    // 'page-break-before: always' força nova página no PDF.
    // 'margin-top: 50px' dá respiro para o cabeçalho não colar no topo.
    return `
      <div style="page-break-before: always; clear: both; display: block; width: 100%;"></div>
      
      <div style="padding-top: 20px; font-family: sans-serif; color: #333;">
        
        <table style="width: 100%; border-bottom: 2px solid #000; margin-bottom: 30px;">
            <tr>
                <td style="vertical-align: bottom; padding-bottom: 10px;">
                    <div style="font-weight: 900; font-size: 28px; color: #000; text-transform: uppercase;">Team Ebony</div>
                    <div style="font-size: 10px; color: #555; margin-top: 5px;">Nutrição, Treinamento & Performance</div>
                </td>
                <td style="text-align: right; vertical-align: bottom; padding-bottom: 10px; font-size: 9px; color: #666;">
                    <strong>Autenticação Eletrônica</strong><br>
                    ID: ${docId}<br>
                    Data: ${signDate}
                </td>
            </tr>
        </table>

        <h2 style="text-align: center; font-size: 16px; margin-bottom: 40px; text-transform: uppercase; letter-spacing: 2px;">Folha de Assinaturas</h2>

        <table style="width: 100%; margin-bottom: 50px;">
            <tr>
                <td style="width: 45%; text-align: center; vertical-align: bottom;">
                    ${student.signature?.image 
                      ? `<img src="${student.signature.image}" style="width: 140px; height: auto; display: block; margin: 0 auto 5px auto;" />` 
                      : '<div style="height: 60px;"></div>'}
                    <div style="border-top: 1px solid #000; padding-top: 5px; margin: 0 20px;">
                        <div style="font-weight: bold; font-size: 12px;">${student.name}</div>
                        <div style="font-size: 10px; color: #555;">CPF: ${finalCpf}</div>
                        <div style="font-size: 10px; color: #555;">ALUNO (CONTRATANTE)</div>
                    </div>
                </td>

                <td style="width: 45%; text-align: center; vertical-align: bottom;">
                    <img src="${COMPANY_SIGNATURE_URL}" style="width: 140px; height: auto; display: block; margin: 0 auto 5px auto;" />
                    
                    <div style="border-top: 1px solid #000; padding-top: 5px; margin: 0 20px;">
                        <div style="font-weight: bold; font-size: 12px;">Hérick Ebony</div>
                        <div style="font-size: 10px; color: #555;">Team Ebony</div>
                        <div style="font-size: 10px; color: #555;">CONTRATADA</div>
                    </div>
                </td>
            </tr>
        </table>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #eee;">
            <h3 style="font-size: 12px; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 15px; text-transform: uppercase;">Trilha de Auditoria</h3>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                <tr>
                    <td style="padding: 5px 0; width: 120px; font-weight: bold; color: #333;">${createdDate}</td>
                    <td style="padding: 5px 0;">
                        <strong>Criação do Documento</strong><br>
                        <span style="color: #666;">Gerado pelo sistema Team Ebony.</span>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; font-weight: bold; color: #333;">${signDate}</td>
                    <td style="padding: 10px 0;">
                        <strong>Assinatura do Aluno</strong><br>
                        <span style="color: #666;">IP: ${ip}</span><br>
                        <span style="color: #666;">Dispositivo: ${sData.deviceInfo || 'Navegador Web'}</span>
                    </td>
                </tr>
            </table>
        </div>

        <div style="margin-top: 30px; text-align: center; font-size: 9px; color: #888; border-top: 1px dashed #ccc; padding-top: 10px;">
            <div style="font-weight: bold; font-size: 10px; color: #000; margin-bottom: 4px;">VALIDAÇÃO DE SEGURANÇA DIGITAL</div>
            Hash SHA256: ${hashId}<br>
            Este documento possui validade jurídica conforme MP 2.200-2/2001.
        </div>

      </div>
    `;
  };
 // ✅ FUNÇÃO FINAL: Contrato + Página de Auditoria (Autentique Style)
 const generateContractPDF = async (student) => {
  if (!student?.signature?.image) {
    alert("A assinatura ainda não foi carregada. Tente novamente em alguns segundos.");
    return;
  }

  // Feedback visual
  const loadingId = "pdf-loading-toast";
  if (!document.getElementById(loadingId)) {
      const loadingMsg = document.createElement('div');
      loadingMsg.id = loadingId;
      loadingMsg.innerHTML = `
        <div style="position:fixed;top:20px;right:20px;background:black;color:white;padding:15px 25px;border-radius:8px;z-index:99999;font-family:sans-serif;box-shadow:0 10px 25px rgba(0,0,0,0.2);display:flex;align-items:center;gap:10px;">
          <div style="width:16px;height:16px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>
          <span style="font-weight:bold;font-size:14px;">Gerando Contrato Seguro...</span>
        </div>
        <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
      `;
      document.body.appendChild(loadingMsg);
  }

  try {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4"
    });

    // Container Invisível (Fora da tela)
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-10000px";
    container.style.top = "0";
    container.style.width = "794px"; 
    
    // 1. CONSTRÓI O CONTEÚDO (Texto + Página de Log)
    // Removemos a assinatura do meio do texto (se houver placeholder antigo) para não ficar duplicado, ou deixamos como preferir.
    // Vou concatenar o HTML do contrato + o HTML da página de auditoria
    const contractBody = buildSignedContractHtml(student);
    const auditPage = buildAuditPageHtml(student);
    
    // O 'wrapHtmlForPdf' agora recebe tudo junto
    container.innerHTML = wrapHtmlForPdf(contractBody + auditPage);
    
    document.body.appendChild(container);

    // Aguarda imagens (assinatura e logos)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Gera o PDF
    await pdf.html(container.querySelector(".pdf-container"), {
      callback: (doc) => {
        const fileName = `Contrato_Assinado_${String(student.name || "Aluno").split(' ')[0]}.pdf`;
        doc.save(fileName);
        
        document.body.removeChild(container);
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) document.body.removeChild(loadingEl);
      },
      x: 0,
      y: 0,
      html2canvas: { scale: 0.75, useCORS: true, logging: false },
      autoPaging: 'text',
      margin: [20, 0, 20, 0],
      width: 595
    });

  } catch (error) {
    console.error("Erro PDF:", error);
    alert("Erro ao gerar PDF.");
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) document.body.removeChild(loadingEl);
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
                <div 
                  key={plan.id} 
                  className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all relative group flex flex-col justify-between min-h-[200px]"
                  style={{ 
                    // AQUI: A borda esquerda pega a cor escolhida (ou cinza se não tiver)
                    borderLeft: `6px solid ${plan.color || '#e5e7eb'}`,
                    borderTop: '1px solid #f3f4f6',
                    borderRight: '1px solid #f3f4f6',
                    borderBottom: '1px solid #f3f4f6'
                  }}
                >
                  <div>
                    <div className="flex justify-between items-start mb-2 pl-2">
                      <h3 className="font-bold text-lg text-gray-900 leading-tight">{plan.name || plan.id}</h3>
                      
                      <div className="flex items-center gap-1">
                        {/* SELETOR DE COR */}
                        <div className="relative group/color">
                           <div 
                             className="w-6 h-6 rounded-full border border-gray-200 cursor-pointer shadow-sm"
                             style={{ backgroundColor: plan.color || '#ffffff' }}
                             title="Mudar cor da etiqueta"
                           />
                           <input 
                              type="color" 
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              onChange={(e) => onUpdatePlanColor(plan.id, e.target.value)}
                              value={plan.color || "#ffffff"}
                           />
                        </div>

                        {/* Botão de Editar Nome */}
                        <button onClick={() => {setEditingPlan(plan); setEditName(plan.name || plan.id)}} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-400 font-mono mb-6 bg-gray-50 inline-block px-2 py-1 rounded ml-2">ID: {plan.id}</p>
                  </div>

                  <div className="space-y-2 pl-2">
                    <button onClick={() => onSelectPlan(plan.id)} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 flex items-center justify-center gap-2">
                      <Settings className="w-4 h-4"/> Editar Fluxo
                    </button>
                    <div className="flex gap-2">
                      <button onClick={() => copyLink(plan.id)} className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-2" title="Link Direto"><LinkIcon className="w-4 h-4"/> Link</button>
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
              <button onClick={() => {
                  setEditingStudentId(null);
                  setNewStudentName("");
                  setNewStudentPhone("");
                  setExtraData({ cpf: '', rg: '', email: '', address: '', birthDate: '', profession: '' });
                  setApprovalStep(1); // Garante que começa no passo 1 (Formulário)
                  setIsInviting(true);
              }} className="bg-black text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-lg">
                <Plus className="w-5 h-5" /> Novo Aluno
              </button>
            </div>

            {/* --- MODAL DE APROVAÇÃO 2.0 (ESTILO AUTENTIQUE) --- */}
            {isInviting && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
                  
                  {/* CABEÇALHO DO MODAL */}
                  <div className="bg-gray-100 border-b border-gray-300 p-4 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                            {approvalStep === 1 ? (
                                <><Users className="w-5 h-5"/> Passo 1: Dados & Negociação</>
                            ) : (
                                <><FileSignature className="w-5 h-5"/> Passo 2: Revisão Final da Minuta (Word)</>
                            )}
                        </h3>
                        <p className="text-xs text-gray-500">
                            {approvalStep === 1 ? "Confira os dados do aluno e defina as regras do plano." : "Edite o texto final se necessário. O que estiver aqui será o contrato oficial."}
                        </p>
                    </div>
                    <button onClick={() => setIsInviting(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-6 h-6 text-gray-500"/>
                    </button>
                  </div>

                  {/* CORPO DO MODAL (DIVIDIDO) */}
                  <div className="flex-1 flex overflow-hidden">
                    
                    {/* --- PASSO 1: FORMULÁRIO DE DADOS --- */}
                    {approvalStep === 1 && (
                        <>
                            {/* COLUNA ESQUERDA: DADOS */}
                            <div className="w-1/3 bg-gray-50 p-6 border-r border-gray-200 overflow-y-auto space-y-5">
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-gray-400 uppercase">Dados Básicos</label>
                                    <input type="text" value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} className="w-full p-2 border rounded bg-white" placeholder="Nome Completo"/>
                                    <input type="text" value={newStudentPhone} onChange={(e) => setNewStudentPhone(e.target.value)} className="w-full p-2 border rounded bg-white" placeholder="WhatsApp"/>
                                </div>

                                <div className="bg-white p-4 rounded-lg border border-gray-300 shadow-sm space-y-3">
                                    <h4 className="font-bold text-gray-700 text-xs uppercase border-b pb-2 mb-2 flex items-center gap-2">
                                        <FileText className="w-3 h-3"/> Dados Cadastrais (Editável)
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input type="text" placeholder="CPF" value={extraData.cpf} onChange={e => setExtraData({...extraData, cpf: e.target.value})} className="w-full p-2 border rounded text-sm"/>
                                        <input type="text" placeholder="RG" value={extraData.rg} onChange={e => setExtraData({...extraData, rg: e.target.value})} className="w-full p-2 border rounded text-sm"/>
                                        <input type="date" value={extraData.birthDate} onChange={e => setExtraData({...extraData, birthDate: e.target.value})} className="w-full p-2 border rounded text-sm"/>
                                        <input type="text" placeholder="Profissão" value={extraData.profession} onChange={e => setExtraData({...extraData, profession: e.target.value})} className="w-full p-2 border rounded text-sm"/>
                                        <input type="text" placeholder="Endereço Completo" value={extraData.address} onChange={e => setExtraData({...extraData, address: e.target.value})} className="w-full p-2 border rounded text-sm col-span-2"/>
                                        <input type="text" placeholder="Email" value={extraData.email} onChange={e => setExtraData({...extraData, email: e.target.value})} className="w-full p-2 border rounded text-sm col-span-2"/>
                                    </div>
                                    {/* Botão de Salvar Apenas Dados */}
                                    {editingStudentId && (
                                        <button onClick={handleSaveDataOnly} className="w-full py-2 bg-blue-50 text-blue-600 text-xs font-bold rounded hover:bg-blue-100 flex items-center justify-center gap-2 border border-blue-200">
                                            <Save className="w-3 h-3"/> Salvar Correções no Banco
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-3 border-t pt-4">
                                    <label className="text-xs font-bold text-gray-400 uppercase">Configuração do Contrato</label>
                                    <select value={selectedPlanForStudent} onChange={(e) => setSelectedPlanForStudent(e.target.value)} className="w-full p-2 border rounded bg-white">
                                        <option value="">Selecione o Fluxo...</option>
                                        {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    <select value={selectedTemplateId} onChange={(e) => {setSelectedTemplateId(e.target.value); setAdminFieldValues({});}} className="w-full p-2 border rounded bg-white font-bold text-blue-800">
                                        <option value="">Selecione o Modelo...</option>
                                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>

                                {selectedTemplateId && (
                                    <div className="bg-yellow-50 p-4 rounded border border-yellow-200 animate-in fade-in">
                                        <h4 className="text-xs font-bold text-yellow-700 uppercase mb-2">Variáveis de Negociação</h4>
                                        {templates.find(t => t.id === selectedTemplateId)?.fields?.filter(f => f.owner === 'admin').map((field, idx) => (
                                            <div key={idx} className="mb-2">
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase">{field.label}</label>
                                                <input type={field.type === 'date' ? 'date' : 'text'} value={adminFieldValues[field.key] || ''} onChange={(e) => setAdminFieldValues({...adminFieldValues, [field.key]: e.target.value})} className="w-full p-2 border border-yellow-300 rounded bg-white text-sm font-medium"/>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* COLUNA DIREITA: PRÉVIA ESTÁTICA (AVISO) */}
                            <div className="w-2/3 p-8 bg-gray-100 overflow-y-auto flex flex-col items-center justify-center">
                                <div className="w-[210mm] min-h-[297mm] bg-white shadow-2xl p-[20mm] text-gray-400 select-none opacity-60 flex flex-col items-center justify-center border border-gray-300 text-center gap-4">
                                    <FileText className="w-16 h-16 opacity-20"/>
                                    <p className="text-sm font-medium">
                                        A visualização e edição final do contrato<br/>aparecerão na próxima etapa.
                                    </p>
                                    <p className="text-xs">Preencha os dados à esquerda e clique em "Próximo".</p>
                                </div>
                            </div>
                        </>
                    )}

                    {/* --- PASSO 2: EDITOR FINAL (WORD) --- */}
                    {approvalStep === 2 && (
                        <div className="w-full h-full bg-gray-200 flex justify-center overflow-hidden">
                             {/* Aqui o contrato já vem montado para você editar se quiser */}
                             <RichTextEditor isA4={true} value={draftContract} onChange={setDraftContract} />
                        </div>
                    )}

                  </div>

                  {/* RODAPÉ: BOTÕES DE AÇÃO */}
                  <div className="bg-white border-t border-gray-300 p-4 flex justify-end gap-3 z-50">
                    <button 
                        onClick={() => setIsInviting(false)} 
                        className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-bold transition-colors text-xs mr-auto"
                    >
                        Cancelar
                    </button>

                    {approvalStep === 1 ? (
                        <button 
                            onClick={handleGenerateDraft} 
                            className="px-8 py-3 bg-black text-white rounded-lg font-bold hover:bg-gray-800 shadow-lg flex items-center gap-2"
                        >
                            Próximo: Revisar Minuta <ChevronRight className="w-4 h-4"/>
                        </button>
                    ) : (
                        <>
                            <button 
                                onClick={() => setApprovalStep(1)} 
                                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50"
                            >
                                Voltar e Editar Dados
                            </button>
                            <button 
                                onClick={handleFinalizeInvite} 
                                className="px-8 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-lg flex items-center gap-2"
                            >
                                <CheckCircle className="w-4 h-4"/> Aprovar e Enviar Link
                            </button>
                        </>
                    )}
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
                            ) : student.status === 'em_analise' ? (
                                <button onClick={() => openApproveModal(student)} className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 py-1 px-3 rounded-full text-xs font-bold border border-blue-200 hover:bg-blue-200 hover:scale-105 transition-all animate-pulse">
                                    <FileSignature className="w-3 h-3"/> Analisar Cadastro
                                </button>
                            ) : (
                                <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 py-1 px-2 rounded-full text-xs font-bold border border-yellow-200">
                                    <Loader className="w-3 h-3"/> Aguardando Assinatura
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
                    {/* --- BLOCO NOVO: A COLA DE VARIÁVEIS AUTOMÁTICAS --- */}
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-6 shadow-sm">
                      <h4 className="text-xs font-bold text-blue-800 uppercase mb-2 flex items-center gap-2">
                        <CheckCircle className="w-3 h-3"/> Automáticas (Já inclusas)
                      </h4>
                      <p className="text-[10px] text-blue-600 mb-3 leading-tight">
                        O sistema preenche estes dados sozinho com base no cadastro do aluno. Use exatamente assim:
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {['{{nome}}', '{{cpf}}', '{{rg}}', '{{endereco}}', '{{email}}', '{{telefone}}', '{{profissao}}', '{{nascimento}}'].map(tag => (
                          <div 
                            key={tag} 
                            className="bg-white border border-blue-100 rounded px-2 py-1 text-[10px] font-mono text-blue-700 font-bold text-center cursor-pointer hover:bg-blue-100 transition-colors" 
                            onClick={() => {navigator.clipboard.writeText(tag); alert(`Copiado: ${tag}`)}}
                            title="Clique para copiar"
                          >
                            {tag}
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* --------------------------------------------------- */}
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

// --- NOVO COMPONENTE: PRÉ-CADASTRO PÚBLICO ---
const StudentRegistration = ({ db }) => {
  const [formData, setFormData] = useState({
    name: "", cpf: "", rg: "", email: "", phone: "",
    address: "", profession: "", birthDate: ""
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.cpf) return alert("Preencha os campos obrigatórios.");
    
    setLoading(true);
    try {
      // Cria o aluno com status 'em_analise'
      const docRef = doc(collection(db, "students"));
      await setDoc(docRef, {
        ...formData,
        phone: formData.phone.replace(/\D/g, ''), // Limpa o telefone
        status: 'em_analise', // Status novo para sua aprovação
        createdAt: new Date().toISOString(),
        planId: null, // Ainda não tem plano
        templateId: null // Ainda não tem contrato
      });
      setSuccess(true);
    } catch (error) {
      console.error(error);
      alert("Erro ao enviar cadastro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5] p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md animate-in zoom-in">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8"/>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Cadastro Recebido!</h2>
          <p className="text-gray-600">Recebemos seus dados com sucesso. Nossa equipe vai analisar e entrará em contato pelo WhatsApp em breve para a assinatura do contrato.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5] py-10 px-4 font-sans flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
        <div className="bg-black p-6 text-white text-center">
          <h1 className="text-2xl font-bold">Ficha de Cadastro</h1>
          <p className="text-gray-400 text-sm mt-1">Preencha seus dados para iniciar a consultoria</p>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Completo *</label>
              <input name="name" required value={formData.name} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-black transition-colors" placeholder="Seu nome completo" />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CPF *</label>
              <input name="cpf" required value={formData.cpf} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-black transition-colors" placeholder="000.000.000-00" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">RG *</label>
              <input name="rg" required value={formData.rg} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-black transition-colors" placeholder="Registro Geral" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data de Nascimento *</label>
              <input name="birthDate" type="date" required value={formData.birthDate} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-black transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Profissão *</label>
              <input name="profession" required value={formData.profession} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-black transition-colors" placeholder="Sua profissão" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Endereço Completo *</label>
              <input name="address" required value={formData.address} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-black transition-colors" placeholder="Rua, Número, Bairro, Cidade - UF, CEP" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">WhatsApp (com DDD) *</label>
              <input name="phone" type="tel" required value={formData.phone} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-black transition-colors" placeholder="(00) 90000-0000" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">E-mail *</label>
              <input name="email" type="email" required value={formData.email} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-black transition-colors" placeholder="seu@email.com" />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-4 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2 shadow-lg mt-4">
            {loading ? <Loader className="w-5 h-5 animate-spin"/> : "Enviar Cadastro"}
          </button>
        </form>
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

// --- FUNÇÃO ATUALIZADA: CAPTURA IP E METADADOS ---
const handleSignContract = async () => {
  if (!activeStudent || !db) return;

  // 1. Validação (Mantém a mesma)
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

    // 2. CAPTURA DE DADOS DE RASTREABILIDADE (NOVO)
    let userIP = "Não identificado";
    try {
      const ipReq = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipReq.json();
      userIP = ipData.ip;
    } catch (err) {
      console.warn("Não foi possível pegar o IP", err);
    }

    const userAgent = navigator.userAgent; // Navegador/Dispositivo
    const timestamp = new Date().toISOString();

    // 3. Atualiza no Firebase com o Log
    await updateDoc(doc(db, "students", activeStudent.id), {
      status: "signed",
      studentData: {
        ...studentFieldValues,
        signedAt: timestamp,
        ipAddress: userIP,
        deviceInfo: userAgent
      },
      signature: {
        image: signatureData,
        signedAt: timestamp,
        ip: userIP,
        userAgent: userAgent,
      },
    });

    // 4. Feedback e Redirecionamento
    setActiveStudent(prev => ({ 
        ...prev, 
        status: "signed",
        signature: { image: signatureData, ip: userIP, signedAt: timestamp } 
    }));
    
    await loadPlan(activeStudent.planId);
    setViewState("student_view_flow");
    alert("Contrato assinado e registrado com sucesso!");

  } catch (e) {
    console.error(e);
    alert("Erro ao salvar assinatura. Tente novamente.");
    setViewState("student_login");
  }
};

// Função atualizada para garantir o redirecionamento correto
const handleStudentLoginV2 = async () => {
  if (!activeStudent) {
      alert("Erro: Dados do aluno não carregados. Recarregue a página.");
      return;
  }

  // Limpeza rigorosa dos números para comparação
  const phoneInputClean = studentPhoneInput.replace(/\D/g, '');
  const studentPhoneClean = activeStudent.phone.replace(/\D/g, '');
  
  // Comparação frouxa (verifica se o digitado CONTÉM no cadastro ou vice-versa para evitar erro de DDD 0)
  if (phoneInputClean === studentPhoneClean || studentPhoneClean.endsWith(phoneInputClean)) {
      
      // 1. Salva na sessão para não pedir de novo se der F5
      sessionStorage.setItem('ebony_student_phone', studentPhoneClean);

      // 2. Direcionamento
      if (activeStudent.status === 'signed') {
          await loadPlan(activeStudent.planId);
          setViewState('student_view_flow');
      } else {
          // AQUI É O PULO DO GATO: Manda para a tela de assinatura
          setViewState('contract_sign'); 
      }
  } else {
      alert(`Número incorreto. O número cadastrado termina em: ...${studentPhoneClean.slice(-4)}`);
  }
};
  // --- ⬆️ FIM DA LÓGICA DE ASSINATURA ⬆️ ---

  // --- ⬆️ FIM DO BLOCO ⬆️ ---

// --- INICIALIZAÇÃO CORRIGIDA E SIMPLIFICADA ---
useEffect(() => {
  const initSystem = async () => {
    
    // 1. Garante Tailwind
    if (!window.tailwind) {
      if (!document.querySelector('script[src*="tailwindcss"]')) {
        const script = document.createElement('script');
        script.src = "https://cdn.tailwindcss.com";
        document.head.appendChild(script);
      }
      await new Promise(r => setTimeout(r, 300));
    }

    // 2. Leitura dos Parâmetros da URL
    const params = new URLSearchParams(window.location.search);
    const urlId = params.get('id');        
    const urlToken = params.get('token'); // Link do Aluno
    const urlAdmin = params.get('admin');
    const urlRegister = params.get('register');

    // --- ROTEAMENTO INTELIGENTE ---

    // CENÁRIO A: Link Público de Pré-Cadastro
    if (urlRegister) {
        setViewState('public_register');
        return;
    }

    // CENÁRIO B: Link Exclusivo do Aluno (Token) -> PRIORIDADE MÁXIMA
    if (urlToken) {
      setViewState('loading'); // Mostra loading enquanto busca
      try {
        const studentRef = doc(db, "students", urlToken);
        const studentSnap = await getDoc(studentRef);

        if (studentSnap.exists()) {
           const sData = { id: studentSnap.id, ...studentSnap.data() };
           setActiveStudent(sData); // Salva o aluno na memória

           // Verifica se já está logado neste navegador (SessionStorage)
           const savedPhone = sessionStorage.getItem('ebony_student_phone');
           const studentPhone = sData.phone ? sData.phone.replace(/\D/g, '') : '';
           
           // Se o telefone salvo for igual ao do aluno carregado, entra direto
           if (savedPhone === studentPhone) {
              if (sData.status === 'signed') {
                  // Se já assinou, carrega o conteúdo
                  await loadPlan(sData.planId);
                  setViewState('student_view_flow');
              } else {
                  // Se não assinou, vai para o contrato
                  setViewState('contract_sign');
              }
           } else {
              // Se não tiver logado (ou for outro aluno), manda pro Login
              setViewState('student_login');
           }
        } else {
           alert("Link inválido ou convite não encontrado.");
           setViewState('login'); // Volta pro login admin em caso de erro
        }
      } catch (e) {
         console.error("Erro ao buscar aluno:", e);
         alert("Erro de conexão. Tente recarregar.");
      }
      return; // Encerra aqui para não conflitar com outras rotas
    }

    // CENÁRIO C: Link de Fluxo Direto (Legado/Testes)
    if (urlId) {
      await loadPlan(urlId);
      setActivePlanId(urlId);
      setViewState('student_view_legacy');
      return;
    }

    // CENÁRIO D: Acesso Admin / Dashboard
    const hasSession = sessionStorage.getItem('ebony_admin') === 'true';
    if (urlAdmin === 'true' || hasSession) {
      setIsAdminAccess(true);
      try {
        await Promise.all([loadAllPlans(), loadAllStudents()]);
      } catch (error) {
        console.error("Erro dados iniciais:", error);
      }
      setViewState('dashboard');
    } else {
      setViewState('login');
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
    const baseHTML = activeStudent?.contractText || "<div style='padding:40px; text-align:center; color:red; font-weight:bold;'>⚠️ ERRO: O texto do contrato não foi gerado. O treinador precisa salvar a minuta no Dashboard primeiro.</div>";

    // campos do modelo que são do aluno
    const pending = Array.isArray(activeStudent?.pendingFields) ? activeStudent.pendingFields : [];

    // AQUI ESTÁ A MÁGICA: Junta o que ele digita com o que JÁ ESTÁ SALVO (que você corrigiu)
    const mergedValues = {
      // Dados salvos no banco (Correção do Admin)
      name: activeStudent.name,
      phone: activeStudent.phone,
      cpf: activeStudent.cpf,
      rg: activeStudent.rg,
      email: activeStudent.email,
      address: activeStudent.address,
      birthDate: activeStudent.birthDate ? new Date(activeStudent.birthDate).toLocaleDateString('pt-BR') : "",
      profession: activeStudent.profession,
      
      // Dados que ele está digitando agora (se houver campos extras)
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