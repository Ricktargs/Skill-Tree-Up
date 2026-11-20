// =========================================================
// CONTROLE NA TELA DO SANTUÁRIO (só no celular)
// Setas = W A S D · botão redondo = pular (Espaço)
// =========================================================
import { useEffect, useRef } from "react";
import { pressKey } from "../../../shared/touch.js";

function PadButton({ k, code, label, className = "", repeat = false }) {
  const held = useRef(false);
  const release = () => {
    if (!held.current) return;
    held.current = false;
    clearInterval(timer.current);
    pressKey(k, false, code);
  };
  const timer = useRef(0);
  useEffect(() => release, []); // soltar ao sair da tela
  return (
    <button
      type="button"
      className={`sanc-pad-btn ${className}`}
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* sem captura */
        }
        held.current = true;
        pressKey(k, true, code);
        // cavar: segurar continua batendo no bloco
        if (repeat) timer.current = setInterval(() => pressKey(k, true, code), 190);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

export default function TouchPad() {
  return (
    <div className="sanc-pad" onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
      <div className="sanc-pad-dpad">
        <PadButton k="w" label="▲" className="up" />
        <PadButton k="a" label="◀" className="left" />
        <PadButton k="d" label="▶" className="right" />
        <PadButton k="s" label="▼" className="down" />
      </div>
      <PadButton k="2" code="Numpad2" label="⛏" className="dig" repeat />
      <PadButton k=" " label="⤒" className="jump" />
    </div>
  );
}
