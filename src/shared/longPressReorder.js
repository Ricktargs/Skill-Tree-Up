// =========================================================
// SEGURAR 1 SEGUNDO E ARRASTAR PARA REORDENAR
// Usado nos níveis do "Editar habilidade". Funciona com mouse e toque.
// Segurou parado ~1s → o cartão "levanta" e segue o dedo/mouse; soltou
// em cima de outro cartão → onMove(de, para).
// Clicar em campo de texto, caixa de marcar ou botão não inicia nada.
// =========================================================
const IGNORE = 'input, textarea, select, button, a, [contenteditable="true"], [contenteditable=""]';

export function startLongPressReorder(e, { itemSelector, getKey, onMove, onLift, delay = 1000 }) {
  if (e.button !== undefined && e.button !== 0) return;
  const t = e.target;
  if (!t || t.closest(IGNORE)) return;
  const card = t.closest(itemSelector);
  if (!card) return;

  const sx = e.clientX;
  const sy = e.clientY;
  let active = false;
  let over = null;
  let timer = 0;

  const markOver = (el) => {
    if (over === el) return;
    if (over) over.classList.remove('lp-drop-target');
    over = el;
    if (over) over.classList.add('lp-drop-target');
  };

  const blockTouch = (ev) => {
    if (active) ev.preventDefault();
  };
  const blockClick = (ev) => {
    ev.stopPropagation();
    ev.preventDefault();
  };

  const cleanup = () => {
    clearTimeout(timer);
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', up, true);
    window.removeEventListener('pointercancel', cancel, true);
    window.removeEventListener('touchmove', blockTouch, { capture: true });
    card.classList.remove('lp-lifted');
    card.style.transform = '';
    markOver(null);
    document.body.classList.remove('lp-reordering');
  };

  const move = (ev) => {
    const dx = ev.clientX - sx;
    const dy = ev.clientY - sy;
    if (!active) {
      // mexeu antes de 1s: é rolagem/seleção, não arrasto
      if (Math.hypot(dx, dy) > 8) cleanup();
      return;
    }
    ev.preventDefault();
    card.style.transform = `translate(${dx}px, ${dy}px) scale(1.03)`;
    const under = document.elementFromPoint(ev.clientX, ev.clientY);
    const target = under ? under.closest(itemSelector) : null;
    markOver(target && target !== card ? target : null);
  };

  const up = () => {
    const from = getKey(card);
    const to = over ? getKey(over) : null;
    const wasActive = active;
    cleanup();
    if (wasActive) {
      // o clique que vem depois de soltar não deve fazer nada
      window.addEventListener('click', blockClick, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', blockClick, { capture: true }), 0);
      if (to != null && to !== from) onMove(from, to);
    }
  };
  const cancel = () => cleanup();

  timer = setTimeout(() => {
    active = true;
    card.classList.add('lp-lifted');
    document.body.classList.add('lp-reordering');
    const sel = window.getSelection && window.getSelection();
    if (sel) sel.removeAllRanges();
    if (navigator.vibrate) navigator.vibrate(25);
    if (onLift) onLift();
  }, delay);

  window.addEventListener('pointermove', move, true);
  window.addEventListener('pointerup', up, true);
  window.addEventListener('pointercancel', cancel, true);
  window.addEventListener('touchmove', blockTouch, { capture: true, passive: false });
}
