import React, { useRef, useEffect, useState } from 'react';

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

  export default SignaturePad;