// =========================================================
// FORÇAS DO MAPA (como no painel do Obsidian)
// Centro mais forte puxa os soltos para o meio; repulsão menor deixa tudo mais junto:
// o mapa vira uma teia/constelação que se ramifica conforme crescem as ligações.
// =========================================================
const FORCES_KEY = 'nr-forces-v1';
export const DEFAULT_FORCES = { center: 0.016, repel: 1600, link: 0.05, distance: 80 };
export const FORCE_LIMITS = {
  center: [0, 0.06, 0.001],
  repel: [200, 6000, 50],
  link: [0.01, 0.15, 0.005],
  distance: [30, 250, 5]
};

export const loadForces = () => {
  try {
    const v = JSON.parse(localStorage.getItem(FORCES_KEY) || 'null') || {};
    const out = { ...DEFAULT_FORCES };
    Object.keys(out).forEach((k) => {
      const n = Number(v[k]);
      const [min, max] = FORCE_LIMITS[k];
      if (Number.isFinite(n)) out[k] = Math.min(max, Math.max(min, n));
    });
    return out;
  } catch {
    return { ...DEFAULT_FORCES };
  }
};

export const saveForces = (forces) => {
  try {
    localStorage.setItem(FORCES_KEY, JSON.stringify(forces));
  } catch {
    /* sem espaço: só não lembra */
  }
};

// ---------- Brilho do neurônio ----------
// Quanto mais informação (texto, páginas, imagens) e ligações, mais clara e brilhante
// fica a cor escolhida. Cresce devagar: só um neurônio MUITO cheio chega no máximo.
export const richness = ({ words = 0, links = 0, pages = 0, images = 0 }) => {
  const score = links * 3 + words / 60 + pages * 4 + images * 2;
  return 1 - Math.exp(-score / 120); // 0 … 1
};
export const glowColor = (base, t) => {
  if (!t || t < 0.02) return base;
  const light = Math.round(t * 42); // até 42% mais claro
  return `color-mix(in srgb, ${base} ${100 - light}%, #ffffff)`;
};
// Brilho em px: nada no começo, suave no meio, forte só quando lotar
export const glowSize = (t) => (t < 0.3 ? 0 : t < 0.85 ? (t - 0.3) * 9 : 5 + (t - 0.85) * 60);
