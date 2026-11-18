import { useEffect, useRef, useState } from "react";
import { ask } from "../../../shared/Dialog.jsx";
import Modal from "./Modal";
import ColorPicker from "./ColorPicker";
import { PASTEL_COLORS } from "../lib/constants";

/** Editor de imagem: lápis, marcador, borracha e recorte. */
export default function ImageEditorModal({ imgSrc, onClose, onSave }) {
  const canvasRef = useRef(null);
  const baseImgRef = useRef(null);
  const drawingRef = useRef(false);
  const cropStartRef = useRef(null);
  const [mode, setMode] = useState("draw");
  const [penColor, setPenColor] = useState(PASTEL_COLORS[3]);
  const [penSize, setPenSize] = useState(4);
  const [cropRect, setCropRect] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      baseImgRef.current = img;
      setCanvasSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = imgSrc;
  }, [imgSrc]);

  const toCanvas = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(canvas.width, ((e.clientX - rect.left) * canvas.width) / rect.width)),
      y: Math.max(0, Math.min(canvas.height, ((e.clientY - rect.top) * canvas.height) / rect.height)),
    };
  };

  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = toCanvas(e);
    const ctx = canvasRef.current.getContext("2d");
    if (mode === "crop") {
      cropStartRef.current = { x, y };
      setCropRect({ x, y, width: 0, height: 0 });
      return;
    }
    drawingRef.current = true;
    setDirty(true);
    ctx.globalCompositeOperation = "source-over";
    if (mode === "highlight") {
      ctx.strokeStyle = penColor + "40";
      ctx.lineWidth = penSize * 3.5;
      ctx.lineCap = "square";
      ctx.lineJoin = "miter";
    } else {
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
    ctx.beginPath();
    ctx.moveTo(x, y);
    if (mode === "eraser") erase(x, y);
  };

  const erase = (x, y) => {
    const ctx = canvasRef.current.getContext("2d");
    if (!baseImgRef.current) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, penSize * 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(baseImgRef.current, 0, 0);
    ctx.restore();
  };

  const handlePointerMove = (e) => {
    const { x, y } = toCanvas(e);
    if (mode === "crop" && cropStartRef.current) {
      const s = cropStartRef.current;
      setCropRect({ x: Math.min(s.x, x), y: Math.min(s.y, y), width: Math.abs(x - s.x), height: Math.abs(y - s.y) });
      return;
    }
    if (!drawingRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (mode === "eraser") erase(x, y);
    else {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const handlePointerUp = () => {
    drawingRef.current = false;
    cropStartRef.current = null;
  };

  const applyCrop = () => {
    if (!cropRect || cropRect.width < 10 || cropRect.height < 10) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const r = {
      x: Math.round(cropRect.x),
      y: Math.round(cropRect.y),
      w: Math.round(cropRect.width),
      h: Math.round(cropRect.height),
    };
    const pixels = ctx.getImageData(r.x, r.y, r.w, r.h);
    canvas.width = r.w;
    canvas.height = r.h;
    ctx.putImageData(pixels, 0, 0);
    const img = new Image();
    img.src = canvas.toDataURL();
    baseImgRef.current = img;
    setCanvasSize({ w: r.w, h: r.h });
    setCropRect(null);
    setDirty(true);
  };

  const close = async () => {
    if (dirty && !(await ask({ title: "Descartar as alterações da imagem?", yes: "Descartar", no: "Continuar editando", danger: true }))) return;
    onClose();
  };

  const pickMode = (m) => {
    setMode(m);
    setCropRect(null);
  };

  return (
    <Modal title="Editor de imagem" icon="✏️" onClose={close} width={1000} className="image-editor" zIndex={30000}>
      <div className="toolbar">
        <button type="button" className={`tool ${mode === "draw" ? "active" : ""}`} onClick={() => pickMode("draw")}>✏️ Lápis</button>
        <button type="button" className={`tool ${mode === "highlight" ? "active" : ""}`} onClick={() => pickMode("highlight")}>🖌️ Marcador</button>
        <button type="button" className={`tool ${mode === "eraser" ? "active" : ""}`} onClick={() => pickMode("eraser")}>🧹 Borracha</button>
        <button type="button" className={`tool ${mode === "crop" ? "active" : ""}`} onClick={() => pickMode("crop")}>✂️ Recortar</button>
        <span className="toolbar-sep" />
        {(mode === "draw" || mode === "highlight") && (
          <ColorPicker label="Cor" value={penColor} onPick={setPenColor} />
        )}
        {mode !== "crop" ? (
          <select value={penSize} onChange={(e) => setPenSize(Number(e.target.value))} className="tool">
            <option value={2}>Fina (2px)</option>
            <option value={4}>Média (4px)</option>
            <option value={8}>Grossa (8px)</option>
            <option value={16}>Extra (16px)</option>
          </select>
        ) : (
          <button type="button" className="tool btn-success" disabled={!cropRect || cropRect.width < 10} onClick={applyCrop}>
            Aplicar corte
          </button>
        )}
      </div>

      <div className="canvas-scroll">
        <div className="canvas-wrap">
          <canvas
            ref={canvasRef}
            className={`mode-${mode}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
          {mode === "crop" && cropRect && canvasSize.w > 0 && (
            <div
              className="crop-rect"
              style={{
                left: `${(cropRect.x / canvasSize.w) * 100}%`,
                top: `${(cropRect.y / canvasSize.h) * 100}%`,
                width: `${(cropRect.width / canvasSize.w) * 100}%`,
                height: `${(cropRect.height / canvasSize.h) * 100}%`,
              }}
            />
          )}
        </div>
      </div>

      <div className="form-buttons">
        <button type="button" className="cancel-button" onClick={close}>Cancelar</button>
        <button
          type="button"
          className="save-button"
          onClick={() => {
            onSave(canvasRef.current.toDataURL("image/png"));
            onClose();
          }}
        >
          Salvar e aplicar
        </button>
      </div>
    </Modal>
  );
}
