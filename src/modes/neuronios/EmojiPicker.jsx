import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// =========================================================
// ESCOLHER EMOJI (ícone das notas no editor de notas)
// =========================================================
const EMOJIS = [
  '📝', '📄', '📒', '📓', '📔', '📕', '📗', '📘', '📙', '📚',
  '🧠', '💡', '⭐', '🌟', '🔥', '✨', '🎯', '📌', '📍', '🔖',
  '✅', '☑️', '❗', '❓', '⚠️', '💬', '🗂️', '🗃️', '📎', '🔗',
  '🧪', '🔬', '💻', '⌨️', '📐', '📊', '📈', '🧮', '🗓️', '⏰',
  '🎵', '🎨', '🎬', '📷', '🎮', '⚽', '🏋️', '🧘', '🍎', '☕',
  '🌱', '🌳', '🌊', '🌙', '☀️', '🌍', '✈️', '🏠', '💼', '💰',
  '❤️', '💜', '💙', '💚', '💛', '🧡', '🙂', '😎', '🤔', '🚀'
];

export default function EmojiPicker({ x, y, value, title = 'Escolher emoji', onPick, onReset, onClose, resetLabel = 'Padrão' }) {
  const ref = useRef(null);

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

  const left = Math.max(8, Math.min(x, window.innerWidth - 300));
  const top = Math.max(8, Math.min(y, window.innerHeight - 280));
  const host = document.querySelector('.np-panel') || document.querySelector('.nr-root') || document.body;

  return createPortal(
    <div ref={ref} className="nr-color-pop np-emoji-pop" style={{ left, top }} role="dialog" aria-label={title}>
      <div className="nr-color-title">{title}</div>
      <div className="np-emoji-grid">
        {EMOJIS.map((em) => (
          <button key={em} type="button" className={value === em ? 'on' : ''} onClick={() => onPick(em)}>
            {em}
          </button>
        ))}
      </div>
      {onReset && (
        <div className="nr-color-foot">
          <span />
          <button type="button" className="btn small" onClick={onReset}>
            {resetLabel}
          </button>
        </div>
      )}
    </div>,
    host
  );
}
