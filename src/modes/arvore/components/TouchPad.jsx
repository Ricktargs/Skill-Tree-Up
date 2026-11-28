// =========================================================
// CONTROLE NA TELA DO SANTUÁRIO (celular e tablet)
// ◀ ▶ ▲ ▼ = andar / porta / escada · botões da direita: 1, 2, 3
// (interagir, plantar, regar) e ⤒ (pular / nadar)
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

export default function TouchPad({ full = false, buttons = [{ k: " ", label: "⤒", big: true }] }) {
  return (
    <div className="sanc-pad" onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
      <div className="sanc-pad-dpad">
        {full && <PadButton k="ArrowUp" code="ArrowUp" label="▲" className="up" />}
        <PadButton k="a" label="◀" className="left" />
        {full && <PadButton k="ArrowDown" code="ArrowDown" label="▼" className="down" />}
        <PadButton k="d" label="▶" className="right" />
      </div>
      <div className="sanc-pad-actions">
        {buttons.map((b) => (
          <PadButton key={b.label} k={b.k} code={b.code} label={b.label} className={b.big ? "jump" : "act"} />
        ))}
      </div>
    </div>
  );
}
