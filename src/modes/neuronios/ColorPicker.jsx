import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// =========================================================
// SELETOR DE COR (neurônios, tags e marca-texto)
// Um balão pequeno com as cores da paleta, uma cor livre e "Padrão".
// =========================================================

const PICK_COLORS = [
  '#7d9bb8', '#a9d8e8', '#60a5fa', '#818cf8', '#b9a3d1', '#e879f9',
  '#e8a0a0', '#f87171', '#f2b880', '#fb923c', '#f6e7a1', '#facc15',
  '#7fa889', '#b8ddb5', '#34d399', '#2dd4bf', '#e8c5a0', '#94a3b8'
];

export default function ColorPicker({ x, y, value, colors = PICK_COLORS, title, onPick, onReset, onClose, resetLabel = 'Padrão', alpha = 1, extra = null }) {
  const ref = useRef(null);

  // Fecha clicando fora ou com Esc
  useEffect(() => {
    const down = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const key = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }
    };
    const t = setTimeout(() => window.addEventListener('pointerdown', down, true), 0);
    window.addEventListener('keydown', key, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('keydown', key, true);
    };
  }, [onClose]);

  // Não deixa o balão sair da tela
  const left = Math.max(8, Math.min(x, window.innerWidth - 228));
  const top = Math.max(8, Math.min(y, window.innerHeight - (extra ? 240 : 190)));
  const host = document.querySelector('.np-panel') || document.querySelector('.nr-root') || document.body;

  return createPortal(
    <div
      ref={ref}
      className="nr-color-pop"
      style={{ left, top }}
      onMouseDown={(e) => {
        // não tira o foco do texto (menos nos controles, como a barra de opacidade)
        if (!e.target.closest('input')) e.preventDefault();
      }}
      role="dialog"
      aria-label={title || 'Escolher cor'}
    >
      {title && <div className="nr-color-title">{title}</div>}
      <div className="nr-color-grid">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            className={`nr-color-sw ${value && value.toLowerCase() === c.toLowerCase() ? 'on' : ''}`}
            style={{ background: c, opacity: Math.max(0.35, alpha) }}
            title={c}
            onClick={() => {
              onPick(c);
              onClose(); // escolheu: a paleta fecha
            }}
          />
        ))}
      </div>
      {extra}
      <div className="nr-color-foot">
        <label className="nr-color-custom" title="Escolher qualquer cor">
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#7d9bb8'} onChange={(e) => onPick(e.target.value)} />
          Outra cor
        </label>
        {onReset && (
          <button type="button" className="btn small" onClick={onReset}>
            {resetLabel}
          </button>
        )}
      </div>
    </div>,
    host
  );
}
