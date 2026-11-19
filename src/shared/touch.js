// =========================================================
// MODO TOUCH (só em celular — tela de toque e pequena)
// - Segurar o dedo ≈ botão direito do mouse (abre os menus)
// - Pinça (dois dedos) ≈ roda do mouse nos mapas que dão zoom
//   (quem aceita: elementos com data-pinch-zoom="<coeficiente da roda>")
// - <html class="is-touch">: o CSS deixa tudo mais fácil de tocar e
//   desliga efeitos pesados (aquarela do Santuário etc.)
// =========================================================

const detect = () => {
  if (typeof window === 'undefined') return false;
  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()) return true; // app Android
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.screen.width, window.screen.height) <= 820;
  return Boolean(coarse && small && navigator.maxTouchPoints > 0);
};

export const IS_TOUCH = detect();

const HOLD_MS = 480;
const MOVE_TOLERANCE = 10;
const EDITABLE = 'input, textarea, select, [contenteditable="true"], [contenteditable=""], .ProseMirror';
// Botões em que segurar já tem função (repetir − / +, andar no Santuário)
const OWN_HOLD = '.icon-button, .plus-button, .sanc-pad, [data-no-hold]';

function holdRing(x, y) {
  const el = document.createElement('div');
  el.className = 'touch-hold-ring';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 450);
}

let installed = false;
export function installTouch() {
  if (installed || !IS_TOUCH) return;
  installed = true;
  document.documentElement.classList.add('is-touch');

  // ---------- Segurar = botão direito ----------
  let press = null;
  let synthAt = 0;
  let blockClickUntil = 0;
  const cancel = () => {
    if (press) clearTimeout(press.timer);
    press = null;
  };
  const fire = () => {
    if (!press) return;
    const { x, y, target } = press;
    press = null;
    synthAt = Date.now();
    blockClickUntil = synthAt + 700;
    try {
      navigator.vibrate && navigator.vibrate(12);
    } catch {
      /* sem vibração */
    }
    holdRing(x, y);
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y, screenX: x, screenY: y, button: 2, buttons: 2, view: window });
    ev.__orbeTouch = true;
    target.dispatchEvent(ev);
  };

  document.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return cancel();
      const t = e.touches[0];
      const target = e.target instanceof Element ? e.target : null;
      if (!target || target.closest(EDITABLE) || target.closest(OWN_HOLD)) return cancel();
      cancel();
      press = { x: t.clientX, y: t.clientY, target, timer: setTimeout(fire, HOLD_MS) };
      return undefined;
    },
    { capture: true, passive: true }
  );
  document.addEventListener(
    'touchmove',
    (e) => {
      if (!press) return;
      const t = e.touches[0];
      if (!t || e.touches.length > 1 || Math.hypot(t.clientX - press.x, t.clientY - press.y) > MOVE_TOLERANCE) cancel();
    },
    { capture: true, passive: true }
  );
  document.addEventListener('touchend', cancel, { capture: true, passive: true });
  document.addEventListener('touchcancel', cancel, { capture: true, passive: true });

  // O Android também manda o "contextmenu" dele ao segurar: só vale um dos dois
  document.addEventListener(
    'contextmenu',
    (e) => {
      if (e.__orbeTouch) return;
      if (press) {
        // o do sistema chegou primeiro: usa ele e cancela o nosso
        cancel();
        synthAt = Date.now();
        blockClickUntil = synthAt + 700;
        return;
      }
      if (Date.now() - synthAt < 1200) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );
  // O "clique" de quando solta o dedo depois de segurar não conta
  document.addEventListener(
    'click',
    (e) => {
      if (Date.now() < blockClickUntil) {
        e.preventDefault();
        e.stopPropagation();
        blockClickUntil = 0;
      }
    },
    true
  );

  // ---------- Pinça = zoom ----------
  const touches = new Map(); // pointerId -> { x, y, target }
  let pinch = null; // { el, d, coef, cap, ids }
  const dist = () => {
    const [a, b] = [...touches.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const mid = () => {
    const [a, b] = [...touches.values()];
    return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : { x: 0, y: 0 };
  };
  // todos os dedos saíram da tela: nada de dedo "fantasma" para a próxima pinça
  const reset = (e) => {
    if (e.touches && e.touches.length === 0) {
      touches.clear();
      pinch = null;
    }
  };
  document.addEventListener('touchend', reset, { capture: true, passive: true });
  document.addEventListener('touchcancel', reset, { capture: true, passive: true });
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'touch') return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY, target: e.target });
      if (touches.size !== 2) return;
      const m = mid();
      const hit = document.elementFromPoint(m.x, m.y);
      const el = (hit && hit.closest('[data-pinch-zoom]')) || (e.target.closest && e.target.closest('[data-pinch-zoom]'));
      if (!el) return;
      cancel();
      // o segundo dedo não chega no mapa; o primeiro "solta" (para de arrastar)
      e.stopPropagation();
      pinch = { el, d: dist(), coef: parseFloat(el.dataset.pinchZoom) || 0.0015, cap: parseFloat(el.dataset.pinchCap) || 0, ids: new Set(touches.keys()) };
      const [firstId, first] = [...touches.entries()][0];
      try {
        const upEv = new PointerEvent('pointerup', { bubbles: true, pointerId: firstId, pointerType: 'touch', clientX: first.x, clientY: first.y, isPrimary: true });
        upEv.__orbePinch = true; // este "soltar" é só para o mapa parar de arrastar
        first.target.dispatchEvent(upEv);
      } catch {
        /* sem PointerEvent sintético */
      }
    },
    true
  );
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'touch' || !touches.has(e.pointerId)) return;
      const t = touches.get(e.pointerId);
      t.x = e.clientX;
      t.y = e.clientY;
      if (!pinch || !pinch.ids.has(e.pointerId)) return;
      e.stopPropagation();
      if (touches.size < 2) return;
      const d = dist();
      if (!pinch.d || !d) return;
      const ratio = d / pinch.d;
      if (Math.abs(ratio - 1) < 0.01) return;
      pinch.d = d;
      const m = mid();
      let total = -Math.log(ratio) / pinch.coef;
      const step = pinch.cap || Math.abs(total);
      while (Math.abs(total) > 0.01) {
        const chunk = Math.sign(total) * Math.min(Math.abs(total), step);
        total -= chunk;
        pinch.el.dispatchEvent(new WheelEvent('wheel', { deltaY: chunk, clientX: m.x, clientY: m.y, bubbles: true, cancelable: true }));
      }
    },
    true
  );
  const up = (e) => {
    if (e.pointerType !== 'touch' || e.__orbePinch) return;
    touches.delete(e.pointerId);
    if (pinch && pinch.ids.has(e.pointerId)) {
      e.stopPropagation(); // o mapa já recebeu o "soltar" quando a pinça começou
      if (touches.size === 0) pinch = null;
    }
  };
  window.addEventListener('pointerup', up, true);
  window.addEventListener('pointercancel', up, true);
}

// ---------- Teclas virtuais (controle do Santuário) ----------
export const pressKey = (key, down) => {
  window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key, code: key === ' ' ? 'Space' : `Key${key.toUpperCase()}`, bubbles: true, cancelable: true }));
};
