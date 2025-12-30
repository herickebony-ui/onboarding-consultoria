import React, { useRef, useEffect } from 'react';
import { 
  Bold, Italic, Underline, Palette, Link as LinkIcon, 
  FileSignature, AlignLeft, AlignCenter, AlignJustify 
} from 'lucide-react';
import { escapeHtml } from '../../utils/helpers';

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
    const linkHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:blue;text-decoration:underline;">${escapeHtml(text)}</a>`;
    document.execCommand("insertHTML", false, linkHtml);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  // Funções da Barra de Ferramentas
  const changeColor = (e) => execCmd("foreColor", e.target.value);
  const changeSize = (e) => execCmd("fontSize", e.target.value);
  const alignLeft = () => execCmd("justifyLeft");
  const alignCenter = () => execCmd("justifyCenter");
  const alignFull = () => execCmd("justifyFull");

  // Quebra de Página Visual (Gap Cinza)
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

  // Estilos
  const wrapperClass = isA4 
    ? "flex flex-col border border-gray-300 rounded-lg bg-gray-100 overflow-hidden h-[80vh]" 
    : "flex flex-col border border-gray-200 rounded-lg bg-white shadow-sm min-h-[300px]";

  const scrollAreaClass = isA4
    ? "flex-1 overflow-y-auto p-8 flex justify-center bg-gray-200"
    : "w-full";

  const paperStyle = isA4 
    ? { 
        width: "210mm", 
        minHeight: "297mm", 
        height: "auto",
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
      {/* BARRA DE FERRAMENTAS */}
      <div className="bg-gray-50 border-b border-gray-300 p-2 flex flex-wrap items-center gap-1 sticky top-0 z-20">
        
        {/* Formatação */}
        <div className="flex bg-white border border-gray-300 rounded overflow-hidden mr-2">
          <button onClick={() => execCmd("bold")} className="p-1.5 hover:bg-gray-100 text-gray-700 border-r border-gray-200" title="Negrito"><Bold className="w-4 h-4"/></button>
          <button onClick={() => execCmd("italic")} className="p-1.5 hover:bg-gray-100 text-gray-700 border-r border-gray-200" title="Itálico"><Italic className="w-4 h-4"/></button>
          <button onClick={() => execCmd("underline")} className="p-1.5 hover:bg-gray-100 text-gray-700" title="Sublinhado"><Underline className="w-4 h-4"/></button>
        </div>

        {/* Alinhamento */}
        <div className="flex bg-white border border-gray-300 rounded overflow-hidden mr-2">
          <button onClick={alignLeft} className="p-1.5 hover:bg-gray-100 text-gray-700 border-r border-gray-200" title="Esquerda"><AlignLeft className="w-4 h-4"/></button>
          <button onClick={alignCenter} className="p-1.5 hover:bg-gray-100 text-gray-700 border-r border-gray-200" title="Centro"><AlignCenter className="w-4 h-4"/></button>
          <button onClick={alignFull} className="p-1.5 hover:bg-gray-100 text-gray-700" title="Justificado"><AlignJustify className="w-4 h-4"/></button>
        </div>

        {/* Estilo Visual */}
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

      {/* ÁREA DE EDIÇÃO */}
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

export default RichTextEditor;