import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";

// ATENÇÃO AQUI: Importe do firebase voltando uma pasta (..)
import { db, storage } from "../firebase";

// --- ASSINATURA DA EMPRESA (FIXA) ---
export const COMPANY_SIGNATURE_URL = "https://i.imgur.com/K7u9k5B.png";

// --- HELPER: GERADOR DE SLUG LIMPO ---
export const generateSlug = (text) => {
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
export const escapeRegExp = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const escapeHtml = (str) =>
  String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

    export const formatUrl = (url) => {
      if (!url) return "#";
      return url.toString().startsWith("http") ? url : `https://${url}`;
    };
// ✅ Helper: cria link do Google Maps a partir de um endereço ou link
export const buildMapsUrl = (value) => {
  if (!value) return "#";

  const txt = String(value).trim();

  // Se já for um link, só garante o https
  if (txt.startsWith("http://") || txt.startsWith("https://")) {
    return txt;
  }

  // Se for texto/endereço, cria busca do Google Maps
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(txt)}`;
};

// ✅ CSS V11 (CORRIGIDO): Tira o azul, mas RESPEITA negrito e títulos
export const wrapHtmlForPdf = (innerHtml) => `
<style>
  * { box-sizing: border-box; }

  .pdf-container {
    width: 794px;
    padding: 40px 50px;
    background-color: #ffffff;
    font-family: 'Helvetica', 'Arial', sans-serif;
    font-size: 12px;
    line-height: 1.5;
    color: #000000; /* Cor base preta */
    text-align: left;
    overflow: visible;
    overflow-wrap: break-word;
    word-break: normal;
  }

  /* --- 1. REGRAS PARA TÍTULOS (Devolve os tamanhos) --- */
  .pdf-container h1 { font-size: 24px !important; font-weight: 700 !important; margin: 20px 0 10px 0; color: #000 !important; }
  .pdf-container h2 { font-size: 18px !important; font-weight: 700 !important; margin: 18px 0 10px 0; color: #000 !important; }
  .pdf-container h3 { font-size: 14px !important; font-weight: 700 !important; margin: 15px 0 10px 0; color: #000 !important; }

  /* --- 2. REGRAS PARA TEXTO COMUM --- */
  .pdf-container p { 
    margin: 0 0 14px 0; 
    text-align: justify; 
    color: #000 !important;
  }

  /* --- 3. REGRAS PARA NEGRITO E ITÁLICO (Protegidas) --- */
  .pdf-container strong, 
  .pdf-container b { 
    font-weight: bold !important; 
    color: #000 !important;
  }
  
  .pdf-container em, 
  .pdf-container i { 
    font-style: italic !important; 
    color: #000 !important;
  }

  /* --- 4. O MATA-AZUL (SÓ COR E FUNDO) --- */
  /* Remove apenas a cor e o fundo das variáveis, sem mexer no tamanho ou peso da fonte */
  .pdf-container span,
  .pdf-container font,
  .pdf-container a {
    color: #000000 !important;
    background-color: transparent !important;
    text-decoration: none !important;
  }

  /* Tabelas e Imagens */
  .pdf-container table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  .pdf-container td, .pdf-container th { vertical-align: top; padding: 4px; color: #000 !important; }
  .pdf-container img { max-width: 100%; height: auto; display: block; }

  .no-break { page-break-inside: avoid; }
</style>

<div class="pdf-container">
  ${innerHtml}
</div>
`;

// --- FUNÇÃO GLOBAL: PREENCHER CONTRATO ---
export const applyStudentValuesToContract = (html, values) => {
    let out = html || "";
    
    Object.entries(values || {}).forEach(([key, val]) => {
      // Tratamento seguro para regex
      const safeKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`{{\\s*${safeKey}\\s*}}`, "g");
      
      // Valor limpo (sem tags HTML estranhas, apenas texto)
      // Nota: Certifique-se de que a função escapeHtml também existe no seu código!
      const safeVal = String(val ?? "").trim();
      
      // Se o valor existir, substitui. Se não, coloca linha.
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

// --- GERADOR DA PÁGINA DE LOG (CORRIGIDO: V7 - RESET CSS + BLOCO LIMPO) ---
export const buildAuditPageHtml = (student) => {
    const sData = student.studentData || {};
    
    const rawCpf = student.cpf || sData.cpf || 'Não informado';
    const finalCpf = rawCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  
    const signDate = sData.signedAt ? new Date(sData.signedAt).toLocaleString('pt-BR') : 'Data n/d';
    const createdDate = student.createdAt ? new Date(student.createdAt).toLocaleString('pt-BR') : 'Data n/d';
    const ip = sData.ipAddress || "IP não registrado";
    const docId = student.id;
    const hashId =  docId.split('').reverse().join('') + "ab9"; 
  
    // NOTA: Removemos page-break-before aqui pois faremos via JS
    // Adicionamos line-height: 1.5 explícito para corrigir o encavalamento
    return `
      <div style="
          display: block; 
          width: 100%; 
          font-family: 'Helvetica', 'Arial', sans-serif; 
          color: #000; 
          line-height: 1.5 !important; 
          background-color: white;
      ">
        
        <div style="padding-top: 20px; color: #333;">
          
          <table style="width: 100%; border-bottom: 2px solid #000; margin-bottom: 30px; border-collapse: collapse;">
              <tr>
                  <td style="vertical-align: bottom; padding-bottom: 10px; width: 60%;">
                      <div style="font-weight: 900; font-size: 24px; color: #000; text-transform: uppercase; line-height: 1.2;">Team Ebony</div>
                      <div style="font-size: 10px; color: #555; margin-top: 5px;">Nutrição, Treinamento & Performance</div>
                  </td>
                  <td style="text-align: right; vertical-align: bottom; padding-bottom: 10px; font-size: 9px; color: #666; width: 40%;">
                      <div style="line-height: 1.4;">
                          <strong>Autenticação Eletrônica</strong><br>
                          ID: ${docId}<br>
                          Data: ${signDate}
                      </div>
                  </td>
              </tr>
          </table>
  
          <h2 style="text-align: center; font-size: 16px; margin-bottom: 40px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold;">Folha de Assinaturas</h2>
  
          <table style="width: 100%; margin-bottom: 50px; border-collapse: collapse;">
              <tr>
                  <td style="width: 45%; text-align: center; vertical-align: top;">
                      ${student.signature?.image 
                        ? `<img src="${student.signature.image}" style="width: 140px; height: auto; display: block; margin: 0 auto 10px auto;" />` 
                        : '<div style="height: 60px;"></div>'}
                      <div style="border-top: 1px solid #000; padding-top: 5px; margin: 0 10px;">
                          <div style="font-weight: bold; font-size: 12px; margin-bottom: 2px;">${student.name}</div>
                          <div style="font-size: 10px; color: #555; line-height: 1.2;">CPF: ${finalCpf}<br>ALUNO (CONTRATANTE)</div>
                      </div>
                  </td>
  
                  <td style="width: 10%;"></td> 
  
                  <td style="width: 45%; text-align: center; vertical-align: top;">
                      <img src="${COMPANY_SIGNATURE_URL}" style="width: 140px; height: auto; display: block; margin: 0 auto 10px auto;" />
                      
                      <div style="border-top: 1px solid #000; padding-top: 5px; margin: 0 10px;">
                          <div style="font-weight: bold; font-size: 12px; margin-bottom: 2px;">Hérick Ebony</div>
                          <div style="font-size: 10px; color: #555; line-height: 1.2;">Team Ebony<br>CONTRATADA</div>
                      </div>
                  </td>
              </tr>
          </table>
  
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #eee;">
              <h3 style="font-size: 12px; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 15px; text-transform: uppercase; font-weight: bold;">Trilha de Auditoria</h3>
              
              <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                  <tr>
                      <td style="padding: 5px 0; width: 130px; font-weight: bold; color: #333; vertical-align: top;">${createdDate}</td>
                      <td style="padding: 5px 0; vertical-align: top;">
                          <strong style="display:block; margin-bottom:2px;">Criação do Documento</strong>
                          <span style="color: #666;">Gerado pelo sistema Team Ebony.</span>
                      </td>
                  </tr>
                  <tr>
                      <td style="padding: 10px 0; font-weight: bold; color: #333; vertical-align: top;">${signDate}</td>
                      <td style="padding: 10px 0; vertical-align: top;">
                          <strong style="display:block; margin-bottom:2px;">Assinatura do Aluno</strong>
                          <span style="color: #666; display:block; margin-bottom:2px;">IP: ${ip}</span>
                          <span style="color: #666;">Dispositivo: ${sData.deviceInfo || 'Navegador Web'}</span>
                      </td>
                  </tr>
              </table>
          </div>
  
          <div style="margin-top: 30px; text-align: center; font-size: 9px; color: #888; border-top: 1px dashed #ccc; padding-top: 10px; line-height: 1.4;">
              <div style="font-weight: bold; font-size: 10px; color: #000; margin-bottom: 4px;">VALIDAÇÃO DE SEGURANÇA DIGITAL</div>
              Hash SHA256: ${hashId}<br>
              Este documento possui validade jurídica conforme MP 2.200-2/2001.
          </div>
  
        </div>
      </div>
    `;
  };
  
  const renderElementAsFullPageImage = async (doc, element, options = {}) => {
    const {
      margin = 30,     // margem em PT (parece Word)
      shrink = 0.92,   // 0.92 = reduz um pouco (ajusta o “texto grande demais”)
      scale = 2        // qualidade da imagem
    } = options;
  
    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false
    });
  
    const imgData = canvas.toDataURL("image/png");
  
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
  
    // área útil (com margem)
    const maxW = (pageW - margin * 2) * shrink;
    const maxH = (pageH - margin * 2) * shrink;
  
    // escala proporcional pra caber na área útil
    let finalW = maxW;
    let finalH = (canvas.height * finalW) / canvas.width;
  
    if (finalH > maxH) {
      finalH = maxH;
      finalW = (canvas.width * finalH) / canvas.height;
    }
  
    // posiciona como “Word”: começa no topo com margem (não centraliza no meio da página)
    const x = margin + (pageW - margin * 2 - finalW) / 2;
    const y = margin;
  
    doc.addImage(imgData, "PNG", x, y, finalW, finalH);
  };
  
  const fixTightSpacing = (html) => {
    return String(html)
      // coloca espaço depois de tags de formatação quando a próxima coisa for letra/número
      .replace(/<\/(strong|b|em|i|u)>(?=[0-9A-Za-zÀ-ÖØ-öø-ÿ])/g, "</$1> ")
      // evita “duplo espaço”
      .replace(/\s{2,}/g, " ");
  };

  export const buildSignedContractHtml = (student) => {
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

// ✅ FUNÇÃO CORRIGIDA V4: REMOVE FUNDO E LETRA COLORIDA
export const generateContractPDF = async (student) => {
    if (!student?.signature?.image) {
      alert("A assinatura ainda não foi carregada. Tente novamente.");
      return;
    }
  
    const loadingId = "pdf-loading-toast";
    if (!document.getElementById(loadingId)) {
        const loadingMsg = document.createElement('div');
        loadingMsg.id = loadingId;
        loadingMsg.innerHTML = `
          <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.95);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:15px;">
             <div style="width:50px;height:50px;border:5px solid #000;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>
             <div style="font-family:sans-serif; text-align:center;">
               <h3 style="font-weight:bold;font-size:20px;margin:0;">Gerando Documento...</h3>
               <p id="pdf-progress-text" style="color:#666;margin:5px 0 0 0;">Iniciando...</p>
             </div>
          </div>
          <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
        `;
        document.body.appendChild(loadingMsg);
    }
    
    const updateStatus = (msg) => {
        const el = document.getElementById("pdf-progress-text");
        if(el) el.innerText = msg;
    }
  
    let masterContainer = null;
  
    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4"
      });
  
      // 1. OBTÉM O HTML PURO (Sem tentar substituir cores via regex aqui)
      const rawContractHtml = buildSignedContractHtml(student);
      const cleanContractHtml = fixTightSpacing(rawContractHtml);
  
      // 2. CRIAR UM "MUNDO" ISOLADO NO DOM
      masterContainer = document.createElement("div");
      masterContainer.style.position = "absolute";
      masterContainer.style.top = "-20000px";
      masterContainer.style.left = "0";
      masterContainer.style.width = "794px";
      
      // Preparar Contrato (Parte A)
      const contractDiv = document.createElement("div");
      contractDiv.id = "print-contract-part";
      contractDiv.style.width = "794px";
      contractDiv.style.background = "white";
      contractDiv.innerHTML = wrapHtmlForPdf(cleanContractHtml);
      
      // Preparar Auditoria (Parte B)
      const auditDiv = document.createElement("div");
      auditDiv.id = "print-audit-part";
      auditDiv.style.width = "794px";
      auditDiv.style.background = "white";
      auditDiv.style.marginTop = "100px";
      auditDiv.innerHTML = wrapHtmlForPdf(buildAuditPageHtml(student));
  
      masterContainer.appendChild(contractDiv);
      masterContainer.appendChild(auditDiv);
      document.body.appendChild(masterContainer);
  
      await new Promise(resolve => setTimeout(resolve, 1500));
  
      updateStatus("Renderizando contrato (Parte 1)...");
  
      await new Promise((resolve, reject) => {
        pdf.html(contractDiv.querySelector(".pdf-container"), {
          // Callback renomeado para evitar conflito de nome
          callback: async (pdfCriado) => {
            
            try {
              updateStatus("Gerando folha de assinaturas (Parte 2)...");
  
              pdfCriado.setPage(pdfCriado.internal.getNumberOfPages());
              pdfCriado.addPage();
  
              await renderElementAsFullPageImage(
                pdfCriado,
                auditDiv.querySelector(".pdf-container")
              );
  
              updateStatus("Finalizando e salvando...");
  
              // Rodapé
              const totalPages = pdfCriado.internal.getNumberOfPages();
              const docId = student.id;
  
              pdfCriado.setFontSize(8);
              pdfCriado.setTextColor(120);
  
              for (let i = 1; i <= totalPages; i++) {
                pdfCriado.setPage(i);
                pdfCriado.setDrawColor(200);
                pdfCriado.line(30, 810, 565, 810);
                pdfCriado.text(`ID: ${docId} | Pág ${i}/${totalPages}`, 30, 825);
                pdfCriado.text("Team Ebony Consulting", 565, 825, { align: "right" });
              }
  
              // Backup Firebase
              updateStatus("Fazendo backup na nuvem...");
              const pdfBlob = pdfCriado.output("blob");
              const storageRef = ref(storage, `contratos_assinados/${docId}.pdf`);
  
              await uploadBytes(storageRef, pdfBlob);
              const downloadUrl = await getDownloadURL(storageRef);
  
              // CORREÇÃO: Usando 'doc' (importado do firestore) corretamente
              // (Assumindo que você não tem mais a variável 'doc' conflitante aqui dentro)
              await updateDoc(doc(db, "students", student.id), {
                contractPdfUrl: downloadUrl,
                status: "signed",
                contractPdfUpdatedAt: new Date().toISOString(),
              });
  
              // Salvar Local
              const firstName = (student.name || "Aluno").split(" ")[0];
              const fileName = `Contrato_${firstName}_${String(docId).substring(0, 4)}.pdf`;
              pdfCriado.save(fileName);
  
              // Limpeza
              if (masterContainer && document.body.contains(masterContainer)) {
                document.body.removeChild(masterContainer);
              }
              const loadingEl = document.getElementById(loadingId);
              if (loadingEl) document.body.removeChild(loadingEl);
  
              alert("✅ Sucesso! Contrato gerado corretamente.");
              resolve();
            } catch (e) {
              reject(e);
            }
          },
  
          x: 0,
          y: 0,
          autoPaging: "text",
          html2canvas: { scale: 0.75, logging: false, useCORS: true, backgroundColor: "#fff" },
          margin: [30, 0, 40, 0],
          width: 595,
          windowWidth: 794,
        });
      });
  
    } catch (error) {
      console.error("Erro CRÍTICO PDF:", error);
      alert("Erro ao gerar PDF: " + error.message);
      
      if(masterContainer && document.body.contains(masterContainer)) {
          document.body.removeChild(masterContainer);
      }
      const loadingEl = document.getElementById(loadingId);
      if (loadingEl) document.body.removeChild(loadingEl);
    }
  };
  
