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
  
  export const escapeRegExp = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  
  export const escapeHtml = (str) =>
    String(str ?? "")
      .replaceAll("&", "&")
      .replaceAll("<", "<")
      .replaceAll(">", ">")
      .replaceAll('"', '"')
      .replaceAll("'", "'");
  
  export const formatUrl = (url) => {
    if (!url) return "#";
    return url.toString().startsWith("http") ? url : `https://${url}`;
  };
  
  export const buildMapsUrl = (value) => {
    if (!value) return "#";
    const txt = String(value).trim();
    if (txt.startsWith("http://") || txt.startsWith("https://")) {
      return txt;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(txt)}`;
  };
  
  // --- FUNÇÃO QUE ESTAVA FALTANDO ---
  export const applyStudentValuesToContract = (html, values) => {
    let out = html || "";
  
    Object.entries(values || {}).forEach(([key, val]) => {
      // Tratamento seguro para regex
      const safeKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`{{\\s*${safeKey}\\s*}}`, "g");
  
      // Valor limpo
      const safeVal = String(val ?? "").trim();
  
      // Se o valor existir, substitui. Se não, coloca linha.
      out = out.replace(regex, safeVal ? escapeHtml(safeVal) : "______________________");
    });
  
    // Substitui o placeholder da assinatura
    out = out.replace(
      /{{\s*assinatura_aluno\s*}}/g,
      `<div style="margin-top: 20px; width: 100%;">
         <div style="border-bottom: 1px solid #000; width: 260px; margin-bottom: 5px;"></div>
         <div style="font-size: 10pt;">Assinatura do Aluno</div>
       </div>`
    );
  
    // Limpa variáveis residuais
    out = out.replace(/{{\s*[\w_]+\s*}}/g, "______________________");
  
    return out;
  };
  
  // Helper para o PDF (CSS Wrapper)
  export const wrapHtmlForPdf = (innerHtml) => `
  <style>
    * { box-sizing: border-box; }
    .pdf-container {
      width: 794px; padding: 40px 50px; background-color: #ffffff;
      font-family: 'Helvetica', 'Arial', sans-serif; font-size: 12px;
      line-height: 1.5; color: #000000; text-align: left;
    }
    .pdf-container h1 { font-size: 24px !important; font-weight: 700 !important; margin: 20px 0 10px 0; color: #000 !important; }
    .pdf-container h2 { font-size: 18px !important; font-weight: 700 !important; margin: 18px 0 10px 0; color: #000 !important; }
    .pdf-container h3 { font-size: 14px !important; font-weight: 700 !important; margin: 15px 0 10px 0; color: #000 !important; }
    .pdf-container p { margin: 0 0 14px 0; text-align: justify; color: #000 !important; }
    .pdf-container strong, .pdf-container b { font-weight: bold !important; color: #000 !important; }
    .pdf-container em, .pdf-container i { font-style: italic !important; color: #000 !important; }
    .pdf-container span, .pdf-container font, .pdf-container a {
      color: #000000 !important; background-color: transparent !important; text-decoration: none !important;
    }
    .pdf-container table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    .pdf-container td, .pdf-container th { vertical-align: top; padding: 4px; color: #000 !important; }
    .pdf-container img { max-width: 100%; height: auto; display: block; }
    .no-break { page-break-inside: avoid; }
  </style>
  <div class="pdf-container">
    ${innerHtml}
  </div>
  `;