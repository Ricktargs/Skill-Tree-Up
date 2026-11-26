// =========================================================
// JANELA SOLTA (PC): arrastar pela barra de cima e mudar o tamanho
// pelos cantos (inferior direito e superior direito).
// Posição e tamanho ficam salvos; duplo clique na barra volta ao lugar.
// No celular/tablet (disabled) não faz nada.
// =========================================================
import { useEffect, useState } from 'react';

export const MOBILE_MQ =
  '(max-width: 760px), (max-height: 520px) and (orientation: landscape), (min-width: 761px) and (max-width: 1100px) and (min-height: 521px), (pointer: coarse) and (min-width: 761px) and (max-width: 1400px) and (min-height: 521px)';

const read = (key) => {
  try {
    const w = JSON.parse(localStorage.getItem(key));
    return w && typeof w.width === 'number' ? w : null;
  } catch {
    return null;
  }
};

export function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

export function useFloatingWindow(storageKey, { disabled = false, minW = 380, minH = 320 } = {}) {
  const [win, setWin] = useState(() => read(storageKey));
  useEffect(() => {
    try {
      if (win) localStorage.setItem(storageKey, JSON.stringify(win));
      else localStorage.removeItem(storageKey);
    } catch {
      /* sem armazenamento */
    }
  }, [storageKey, win]);

  const clamp = (w) => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const width = Math.max(minW, Math.min(w.width, W));
    const height = Math.max(minH, Math.min(w.height, H));
    return { width, height, left: Math.max(0, Math.min(w.left, W - 120)), top: Math.max(0, Math.min(w.top, H - 48)) };
  };

  /** mode: 'move' (barra de cima), 'br' (canto inferior direito), 'tr' (canto superior direito) */
  const start = (e, mode, el) => {
    if (disabled || e.button !== 0 || !el) return;
    if (mode === 'move' && e.target.closest('button, input, select, textarea, a, [role="tab"], [contenteditable="true"]')) return;
    e.preventDefault();
    e.stopPropagation();
    const r = el.getBoundingClientRect();
    const base = { left: r.left, top: r.top, width: r.width, height: r.height };
    const sx = e.clientX;
    const sy = e.clientY;
    document.body.classList.add('fw-dragging');
    const move = (ev) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      let next;
      if (mode === 'move') next = { ...base, left: base.left + dx, top: base.top + dy };
      else if (mode === 'br') next = { ...base, width: base.width + dx, height: base.height + dy };
      else {
        // canto de cima: a borda de baixo fica parada
        const h = Math.max(minH, base.height - dy);
        next = { ...base, width: base.width + dx, top: base.top + (base.height - h), height: h };
      }
      setWin(clamp(next));
    };
    const up = () => {
      document.body.classList.remove('fw-dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const style = !disabled && win ? { ...clamp(win), bottom: 'auto', right: 'auto', maxWidth: 'none', position: 'fixed', margin: 0 } : undefined;
  return { style, floating: Boolean(style), start, reset: () => setWin(null) };
}
