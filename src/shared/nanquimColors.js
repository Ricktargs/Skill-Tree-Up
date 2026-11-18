// =========================================================
// TRADUTOR DE CORES: visual Gameficado (escuro, neon) → Nanquim
// (papel, nanquim e aquarela, igual à Árvore).
// Usado por um script que gera o CSS do Nanquim e, em tempo real,
// para as cores escritas direto no código (style={{ ... }}).
// =========================================================

// ---------- Leitura de cores ----------
const NAMED = {
  white: [255, 255, 255],
  black: [0, 0, 0],
  transparent: null
};

const hexToRgb = (hex) => {
  let h = hex.slice(1);
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
};

const toHsl = ([r, g, b]) => {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === R) h = (G - B) / d + (G < B ? 6 : 0);
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return [h * 60, s, l];
};


const fmt = ([r, g, b], alpha = 1) => (alpha >= 0.999 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 1000) / 1000})`);

// ---------- Tradução de uma cor ----------
// role: 'text' (cor de letra), 'bg' (fundo), 'line' (borda/linha), 'glow' (sombra/brilho)
// O resultado usa as variáveis do tema Nanquim (--nq-*), então serve para
// todos os temas do Nanquim, no claro e no noturno.
const pct = (v) => `${Math.round(v * 100)}%`;
const alpha = (v) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;
const shade = (a) => `rgb(var(--nq-shade-rgb) / ${alpha(a)})`;

// eslint-disable-next-line no-unused-vars
export function mapColor(rgba, role, dark = false) {
  const [r, g, b, a = 1] = rgba;
  const [h, s, l] = toHsl([r, g, b]);
  // Azul-marinho/ardósia escuros (o "fundo" do visual antigo) contam como neutros
  const navy = h >= 190 && h <= 250;
  const neutral = s < 0.28 || l < 0.1 || l > 0.94 || (l < 0.34 && (navy || s < 0.6)) || (navy && s < 0.4 && l > 0.55);
  const own = fmt([r, g, b], a);

  // Cores fortes (acentos, verde, vermelho...) continuam, misturadas com a tinta
  if (!neutral) {
    if (role === 'text') return `color-mix(in srgb, ${fmt([r, g, b])} 62%, var(--nq-ink))`;
    if (role === 'glow') return shade(Math.min(a, 0.18));
    if (role === 'bg' && l < 0.3) return `color-mix(in srgb, ${fmt([r, g, b])} 16%, var(--nq-paper))`;
    return own;
  }

  if (role === 'glow') return shade(Math.min(a * 0.35, 0.22));

  if (a < 0.999) {
    // Véus: branco translúcido (destaque no escuro) vira sombra de tinta no papel
    if (l > 0.6) return shade(Math.min(a * 0.9, 0.22));
    if (role === 'text') return 'var(--nq-muted)';
    // Preto translúcido (painéis escuros) vira um papel um pouco mais fundo
    return shade(Math.min(a * 0.18, 0.12));
  }

  if (role === 'text') {
    if (l > 0.82) return 'var(--nq-ink)';
    if (l > 0.55) return `color-mix(in srgb, var(--nq-ink) ${pct(Math.max(0, 1 - ((0.82 - l) / 0.3 + 0.35)))}, var(--nq-muted))`;
    return 'var(--nq-muted)';
  }

  if (role === 'line') return 'var(--nq-line-strong)';

  // Fundos: escuro → papel; quanto mais claro o original, mais "fundo" o papel
  if (l < 0.5) {
    const t = Math.min(1, l / 0.35);
    if (t < 0.15) return 'var(--nq-paper)';
    if (t > 0.85) return 'var(--nq-paper-3)';
    return `color-mix(in srgb, var(--nq-paper), var(--nq-paper-3) ${pct(t)})`;
  }
  return 'var(--nq-paper-2)';
}

// ---------- Tradução de um valor CSS inteiro ----------
const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+\s*)?\)|\b(?:white|black)\b/g;

const parseColor = (str) => {
  if (str[0] === '#') return hexToRgb(str);
  const named = NAMED[str.toLowerCase()];
  if (named !== undefined) return named ? [...named, 1] : null;
  const nums = str.match(/[\d.]+/g).map(Number);
  return [nums[0], nums[1], nums[2], nums[3] === undefined ? 1 : nums[3]];
};

export const roleOf = (prop) => {
  const p = prop.toLowerCase();
  if (p === 'color' || p === 'caret-color' || p === 'fill' || p === '-webkit-text-fill-color') return 'text';
  if (p.includes('shadow')) return 'glow';
  if (p.startsWith('border') || p.startsWith('outline') || p === 'stroke' || p === 'column-rule-color') return 'line';
  if (p.startsWith('background') || p === 'accent-color') return 'bg';
  return null;
};

export function mapValue(value, role, dark = false) {
  if (!value || !role) return value;
  // Variáveis (var(--theme-accent)) ficam como estão
  return value.replace(COLOR_RE, (m) => {
    const c = parseColor(m);
    if (!c) return m;
    return mapColor(c, role, dark);
  });
}

// Traduz um "cssText" inteiro (atributo style)
export function mapStyleText(text, dark = false) {
  if (!text) return text;
  return text.replace(/(^|;)\s*([a-zA-Z-]+)\s*:\s*([^;]+)/g, (full, sep, prop, val) => {
    const role = roleOf(prop);
    if (!role) return full;
    return `${sep} ${prop}: ${mapValue(val, role, dark)}`;
  });
}
