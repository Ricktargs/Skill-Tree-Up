import { useEffect, useRef, useState } from "react";
import { PASTEL_COLORS } from "../lib/constants";

/** Botão com paleta pastel + seletor livre de cor. */
export default function ColorPicker({ label, icon, value, onPick, title, keepFocus = false }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const noFocus = keepFocus ? (e) => e.preventDefault() : undefined;

  return (
    <div className="menu-anchor" ref={ref}>
      <button type="button" className="tool" onMouseDown={noFocus} onClick={() => setOpen((v) => !v)} title={title || label}>
        {icon || <span className="swatch-dot" style={{ background: value }} />}
        <span>{label}</span>
      </button>
      {open && (
        <div className="menu color-menu">
          <div className="muted small strong">Cores pastel</div>
          <div className="color-grid">
            {PASTEL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`swatch ${value === c ? "active" : ""}`}
                style={{ background: c }}
                onMouseDown={noFocus}
                onClick={() => {
                  onPick(c);
                  setOpen(false);
                }}
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>
          <button type="button" className="link-button" onMouseDown={noFocus} onClick={() => setCustom((v) => !v)}>
            {custom ? "➖ Ocultar" : "🌈 Outras cores"}
          </button>
          {custom && (
            <label className="row small">
              Seletor:
              <input type="color" value={value || "#000000"} onChange={(e) => onPick(e.target.value)} />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
