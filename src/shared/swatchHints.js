// =========================================================
// NOMES DOS EMOJIS E DAS CORES NOS SELETORES (os 3 modos)
//  · passar o mouse em cima: aparece o nome
//  · clicar / tocar: o nome aparece rapidinho em cima de onde clicou
// Vale para qualquer grade de escolha (emojis ou bolinhas de cor):
// não precisa mexer em cada seletor.
// =========================================================
import { EMOJI_EN, EMOJI_PT } from './emojiNames.js';
import { tx } from '../i18n/index.jsx';

const EMOJI_RE = /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|[←-⇿⌀-⏿■-➿⬀-⯿])(?:️|‍(?:\p{Extended_Pictographic}|[♀♂])️?|\p{Emoji_Modifier})*$/u;
const CANDIDATE = 'button, [role="button"], [role="option"], [role="radio"], [class*="swatch"], [class*="color"], [class*="emoji"], [class*="dot"]';
const isEn = () => /^en/i.test(document.documentElement.lang || '');

// ---------- emojis ----------
const emojiText = (el) => {
  if (!el || el.children.length > 1) return null;
  const t = (el.textContent || '').trim();
  return t && t.length <= 12 && EMOJI_RE.test(t) ? t : null;
};
export const emojiName = (e) => {
  const k = String(e || '').replace(/️/g, '');
  return (isEn() ? EMOJI_EN[k] : EMOJI_PT[k]) || EMOJI_PT[k] || null;
};

// ---------- cores ----------
const parseRgb = (c) => {
  const m = String(c || '').match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?/);
  if (!m) return null;
  let a = m[4] === undefined ? 1 : parseFloat(m[4]);
  if (m[4] && m[4].endsWith('%')) a /= 100;
  return { r: +m[1], g: +m[2], b: +m[3], a };
};
const hex = ({ r, g, b }) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

const HUES = [
  [10, 'Vermelho', 'Red'],
  [38, 'Laranja', 'Orange'],
  [50, 'Dourado', 'Gold'],
  [66, 'Amarelo', 'Yellow'],
  [88, 'Lima', 'Lime'],
  [150, 'Verde', 'Green'],
  [176, 'Verde-água', 'Teal'],
  [196, 'Ciano', 'Cyan'],
  [218, 'Azul-celeste', 'Sky blue'],
  [244, 'Azul', 'Blue'],
  [264, 'Anil', 'Indigo'],
  [290, 'Roxo', 'Purple'],
  [318, 'Magenta', 'Magenta'],
  [345, 'Rosa', 'Pink'],
  [361, 'Vermelho', 'Red']
];
export function colorName(rgb) {
  const en = isEn();
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  if (l > 0.94) return en ? 'White' : 'Branco';
  if (l < 0.09) return en ? 'Black' : 'Preto';
  if (s < 0.13) {
    if (l > 0.72) return en ? 'Light gray' : 'Cinza claro';
    if (l < 0.32) return en ? 'Dark gray' : 'Cinza escuro';
    return en ? 'Gray' : 'Cinza';
  }
  // marrom e bege: laranjas escuros ou apagados
  if (h >= 12 && h < 50 && l < 0.42 && s < 0.85) return en ? 'Brown' : 'Marrom';
  if (h >= 25 && h < 55 && l > 0.7 && s < 0.6) return en ? 'Beige' : 'Bege';
  const [, pt, eng] = HUES.find(([lim]) => h < lim);
  let base = en ? eng : pt;
  if ((base === 'Vermelho' || base === 'Red') && l > 0.72) base = en ? 'Pink' : 'Rosa';
  let mod = '';
  if (l > 0.76 && s > 0.2) mod = en ? 'Pastel ' : ' pastel';
  else if (l > 0.62) mod = en ? 'Light ' : ' claro';
  else if (l < 0.3) mod = en ? 'Dark ' : ' escuro';
  return en ? `${mod}${base.toLowerCase()}`.replace(/^./, (c) => c.toUpperCase()) : `${base}${mod}`;
}

// a bolinha de cor do elemento (ele mesmo ou um filho sem texto)
const swatchColor = (el) => {
  if (!el || (el.textContent || '').trim()) return null;
  const rect = el.getBoundingClientRect();
  if (!rect.width || rect.width > 70 || rect.height > 70) return null;
  for (const node of [el, el.firstElementChild]) {
    if (!node) continue;
    const c = parseRgb(getComputedStyle(node).backgroundColor);
    if (c && c.a > 0.5) return c;
  }
  return null;
};

// é uma grade de escolhas? (vários irmãos parecidos)
const isPicker = (el, test) => {
  const parent = el.parentElement;
  if (!parent) return false;
  let n = 0;
  for (const sib of parent.children) {
    if (sib.tagName === el.tagName && test(sib)) n += 1;
    if (n >= 3) return true;
  }
  return false;
};

function describe(target) {
  const el = target && target.closest && target.closest(CANDIDATE);
  if (!el || el.closest('[data-no-name], .orbe-hint')) return null;
  const ownAria = el.getAttribute('data-hint-aria') ? '' : el.getAttribute('aria-label');
  const own = el.getAttribute('data-hint-name') || el.getAttribute('title') || ownAria || '';
  const emo = emojiText(el);
  if (emo) {
    // botão de ação com nome próprio (barra de ferramentas): já tem a dica dele
    if (own && !el.getAttribute('data-hint-name')) return null;
    if (el.getAttribute('data-hint-name') && !emojiName(emo)) return null;
    if (!isPicker(el, (s) => Boolean(emojiText(s)) && !s.getAttribute('title') && !s.getAttribute('aria-label'))) return null;
    const name = emojiName(emo) || own;
    return name ? { el, text: name, icon: emo } : null;
  }
  const c = swatchColor(el);
  if (c) {
    if (!isPicker(el, (s) => Boolean(swatchColor(s)))) return null;
    // nome próprio da cor (ex.: "Roxo Neon (#a855f7)") sem repetir o código
    const clean = own.replace(/\s*\(?#[0-9a-f]{3,8}\)?\s*$/i, '').replace(/^cor$/i, '').trim();
    const name = clean && !/^#?[0-9a-f]{3,8}$/i.test(clean) ? clean : colorName(c);
    return { el, text: name, sub: hex(c), color: hex(c) };
  }
  return null;
}

// ---------- o balãozinho ----------
let bubble = null;
let hideTimer = null;
let showTimer = null;
const ensure = () => {
  if (bubble) return bubble;
  bubble = document.createElement('div');
  bubble.className = 'orbe-hint';
  bubble.setAttribute('role', 'status');
  bubble.setAttribute('aria-live', 'polite');
  document.body.appendChild(bubble);
  return bubble;
};
function show(info, { clicked = false } = {}) {
  const b = ensure();
  clearTimeout(hideTimer);
  b.textContent = '';
  if (info.color) {
    const dot = document.createElement('i');
    dot.style.background = info.color;
    b.appendChild(dot);
  } else if (info.icon) {
    const ic = document.createElement('span');
    ic.className = 'orbe-hint-icon';
    ic.textContent = info.icon;
    b.appendChild(ic);
  }
  const label = document.createElement('b');
  label.textContent = tx(info.text);
  b.appendChild(label);
  if (info.sub) {
    const sub = document.createElement('small');
    sub.textContent = info.sub;
    b.appendChild(sub);
  }
  const r = info.el.getBoundingClientRect();
  b.classList.toggle('clicked', clicked);
  b.classList.add('on');
  // em cima do item; se não couber, embaixo
  const bw = b.offsetWidth;
  const bh = b.offsetHeight;
  const below = r.top - bh - 10 < 4;
  const x = Math.max(6 + bw / 2, Math.min(window.innerWidth - 6 - bw / 2, r.left + r.width / 2));
  b.style.left = `${x}px`;
  b.style.top = `${below ? r.bottom + 8 : r.top - 8}px`;
  b.classList.toggle('below', below);
  // o clique repete a animação de "pulinho"
  if (clicked) {
    b.classList.remove('pop');
    void b.offsetWidth;
    b.classList.add('pop');
    hideTimer = setTimeout(hide, 700);
  }
}
function hide() {
  clearTimeout(showTimer);
  if (bubble) bubble.classList.remove('on', 'pop');
}

let installed = false;
export function installSwatchHints() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  let hovered = null;
  document.addEventListener(
    'pointerover',
    (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      const info = describe(e.target);
      if (!info) return;
      if (hovered === info.el) return;
      hovered = info.el;
      // sem a dica do navegador repetindo o mesmo nome
      if (info.color && info.el.hasAttribute('title')) {
        info.el.setAttribute('data-hint-name', info.el.getAttribute('title'));
        info.el.removeAttribute('title');
      }
      if (!info.el.hasAttribute('aria-label')) {
        info.el.setAttribute('aria-label', tx(info.text));
        info.el.setAttribute('data-hint-aria', '1');
      }
      clearTimeout(showTimer);
      showTimer = setTimeout(() => show(info), 110);
    },
    true
  );
  document.addEventListener(
    'pointerout',
    (e) => {
      if (!hovered || hovered.contains(e.relatedTarget)) return;
      hovered = null;
      clearTimeout(showTimer);
      if (bubble && !bubble.classList.contains('pop')) hide();
    },
    true
  );
  document.addEventListener(
    'click',
    (e) => {
      const info = describe(e.target);
      if (!info) return;
      // espera o seletor reagir (alguns fecham ao escolher): mede antes
      const rect = info.el.getBoundingClientRect();
      const ghost = { getBoundingClientRect: () => rect };
      requestAnimationFrame(() => show({ ...info, el: info.el.isConnected ? info.el : ghost }, { clicked: true }));
      // sem a bolinha ficar com o contorno de "selecionada" depois do clique
      if (e.detail > 0) setTimeout(() => info.el.isConnected && info.el.blur && info.el.blur(), 0);
    },
    true
  );
  window.addEventListener('scroll', () => bubble && !bubble.classList.contains('pop') && hide(), true);
  document.addEventListener('keydown', (e) => e.key === 'Escape' && hide(), true);
}
