// =========================================================
// MODO CLARO PARA QUALQUER TEMA
// A partir das cores do tema (fundo escuro + destaque) monta uma
// versão clara: papel com um toque da cor do tema, letra escura
// e o destaque um pouco mais escuro para ter contraste.
// Essas cores entram nas variáveis --nq-* usadas pelo
// light.generated.css (traduções automáticas das cores do app).
// =========================================================
const toRgb = (hex) => {
  const m = String(hex || '').match(/#([0-9a-f]{3,8})/i);
  if (!m) return [30, 41, 59];
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => {
  const ra = toRgb(a);
  const rb = toRgb(b);
  return toHex(ra.map((v, i) => v + (rb[i] - v) * t));
};
const lum = (hex) => {
  const [r, g, b] = toRgb(hex).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Destaque mais escuro no claro (amarelo/ciano neon ficariam ilegíveis no papel). */
export function lightAccent(accent) {
  const l = lum(accent);
  return l > 0.55 ? mix(accent, '#000000', Math.min(0.5, (l - 0.4) * 0.9)) : l > 0.4 ? mix(accent, '#000000', 0.15) : accent;
}

/** Variáveis --nq-* (e as --g-*) do modo claro para um tema. */
export function lightVars(theme) {
  const base = theme.base || theme.modalBg || '#1e293b';
  const accent = theme.color || '#38bdf8';
  const tint = mix(base, accent, 0.25);
  const paper = mix(tint, '#ffffff', 0.93);
  const paper2 = mix(tint, '#ffffff', 0.87);
  const paper3 = mix(tint, '#ffffff', 0.78);
  const ink = mix(base, '#000000', 0.55);
  const shade = toRgb(mix(base, '#000000', 0.45)).join(' ');
  return {
    '--nq-bg': mix(tint, '#ffffff', 0.9),
    '--nq-paper': paper,
    '--nq-paper-2': paper2,
    '--nq-paper-3': paper3,
    '--nq-input': '#ffffff',
    '--nq-ink': ink,
    '--nq-ink-soft': mix(ink, '#ffffff', 0.18),
    '--nq-muted': mix(ink, '#ffffff', 0.42),
    '--nq-shade-rgb': shade,
    '--nq-line': `rgb(${shade} / 0.16)`,
    '--nq-line-strong': `rgb(${shade} / 0.28)`,
    '--nq-accent': lightAccent(accent),
    '--nq-title': ink,
    // as cores do tema também em versão clara (Árvore, Neurônios e janelas)
    '--g-bg': `radial-gradient(circle at 50% 30%, ${paper} 0%, ${paper3} 100%)`,
    '--g-modal': paper,
    '--g-box': paper2,
    '--g-border': mix(accent, '#ffffff', 0.45),
    '--g-accent': lightAccent(accent)
  };
}
