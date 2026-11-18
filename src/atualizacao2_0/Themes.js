import { useState, useCallback } from 'react';
import { useUndoRestore } from './GlobalUndo.js';

// =========================================================
// TEMAS VISUAIS — categorias de 12 temas + temas criados pelo usuário.
// Cada tema tem: bg (fundo), modalBg (janelas), boxBg (caixas),
// border (bordas) e color (cor de destaque).
// =========================================================

// ---------- Mistura de cores ----------
const toRgb = (hex) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => {
  const ra = toRgb(a);
  const rb = toRgb(b);
  return toHex(ra.map((v, i) => v + (rb[i] - v) * t));
};

// Gera as 5 cores de um tema a partir do destaque e da base,
// seguindo a mesma proporção dos temas originais
export const makeTheme = (id, name, accent, base, extra = {}) => ({
  id,
  name,
  color: accent,
  base,
  bg: `radial-gradient(circle at 50% 30%, ${mix(base, accent, 0.06)} 0%, ${mix(base, '#000000', 0.62)} 100%)`,
  modalBg: mix(base, '#000000', 0.32),
  boxBg: mix(base, '#000000', 0.18),
  border: mix(base, accent, 0.28),
  ...extra
});

const build = (prefix, rows) => rows.map(([id, name, accent, base]) => makeTheme(`${prefix}_${id}`, name, accent, base));

// ---------- Categorias ----------
// Os 12 temas originais continuam com os mesmos ids (perfis salvos não mudam)
const NEON_CLASSIC = [
  { id: 'cyberpunk', name: 'Cyberpunk', bg: 'radial-gradient(circle at 50% 30%, #111827 0%, #080c14 100%)', modalBg: '#0e1626', border: '#1e293b', color: '#38bdf8', boxBg: '#131e32' },
  { id: 'slate', name: 'Cinza Rochoso', bg: 'radial-gradient(circle at 50% 30%, #1e293b 0%, #0f172a 100%)', modalBg: '#182232', border: '#334155', color: '#94a3b8', boxBg: '#1e293b' },
  { id: 'emerald', name: 'Floresta de Esmeralda', bg: 'radial-gradient(circle at 50% 30%, #064e3b 0%, #022c22 100%)', modalBg: '#03382c', border: '#065f46', color: '#34d399', boxBg: '#043e30' },
  { id: 'sunset', name: 'Noite Roxa', bg: 'radial-gradient(circle at 50% 30%, #4c1d95 0%, #0f0728 100%)', modalBg: '#210d43', border: '#5b21b6', color: '#c084fc', boxBg: '#28114f' },
  { id: 'crimson', name: 'Abismo Escarlate', bg: 'radial-gradient(circle at 50% 30%, #450a0a 0%, #180303 100%)', modalBg: '#280606', border: '#7f1d1d', color: '#f87171', boxBg: '#2d0808' },
  { id: 'deepblue', name: 'Azul Profundo', bg: 'radial-gradient(circle at 50% 30%, #172554 0%, #080e24 100%)', modalBg: '#0f1b3d', border: '#1e3a8a', color: '#60a5fa', boxBg: '#111e47' },
  { id: 'volcano', name: 'Vulcânico', bg: 'radial-gradient(circle at 50% 30%, #431407 0%, #180502 100%)', modalBg: '#260b04', border: '#7c2d12', color: '#fb923c', boxBg: '#331107' },
  { id: 'gold', name: 'Aurora Dourada', bg: 'radial-gradient(circle at 50% 30%, #422006 0%, #1a0c02 100%)', modalBg: '#281303', border: '#78350f', color: '#facc15', boxBg: '#331b07' },
  { id: 'mystic', name: 'Névoa Mística', bg: 'radial-gradient(circle at 50% 30%, #311042 0%, #12041a 100%)', modalBg: '#1e0a29', border: '#581c87', color: '#e879f9', boxBg: '#270d35' },
  { id: 'neonpink', name: 'Rosa Neon', bg: 'radial-gradient(circle at 50% 30%, #500724 0%, #1f020e 100%)', modalBg: '#320417', border: '#831843', color: '#f472b6', boxBg: '#3b081e' },
  { id: 'ocean', name: 'Oceano Noturno', bg: 'radial-gradient(circle at 50% 30%, #083344 0%, #02121a 100%)', modalBg: '#04212d', border: '#164e63', color: '#22d3ee', boxBg: '#062a38' },
  { id: 'silver', name: 'Prata Cyber', bg: 'radial-gradient(circle at 50% 30%, #27272a 0%, #09090b 100%)', modalBg: '#18181b', border: '#3f3f46', color: '#e4e4e7', boxBg: '#1f1f23' }
];

export const THEME_CATEGORIES = [
  { id: 'neon', icon: '⚡', name: 'Neon Clássico', themes: NEON_CLASSIC },
  {
    id: 'pastel',
    icon: '🍬',
    name: 'Tons Pastéis',
    themes: build('pastel', [
      ['lavanda', 'Lavanda Sonhadora', '#c4b5fd', '#2a2340'],
      ['algodao', 'Algodão Doce', '#f9a8d4', '#3a2233'],
      ['menta', 'Brisa de Menta', '#a7f3d0', '#1f3a33'],
      ['pessego', 'Pêssego Aveludado', '#fdba8c', '#3b2a22'],
      ['porcelana', 'Céu de Porcelana', '#bae6fd', '#1f2f3d'],
      ['limonada', 'Limonada Rosa', '#fda4af', '#3a2229'],
      ['baunilha', 'Creme de Baunilha', '#fde68a', '#37311f'],
      ['lilas', 'Nuvem de Lilás', '#e9d5ff', '#2f2540'],
      ['pistache', 'Sorvete de Pistache', '#d9f99d', '#2a331f'],
      ['coral', 'Coral Suave', '#fecaca', '#3a2626'],
      ['aqua', 'Água-Marinha Leitosa', '#99f6e4', '#1d3533'],
      ['marshmallow', 'Marshmallow Tostado', '#fed7aa', '#352a24']
    ])
  },
  {
    id: 'nature',
    icon: '🌿',
    name: 'Natureza Selvagem',
    themes: build('nature', [
      ['musgo', 'Musgo Ancestral', '#84cc16', '#1a2e05'],
      ['bambu', 'Bosque de Bambu', '#4ade80', '#052e16'],
      ['outono', 'Folhas de Outono', '#f59e0b', '#2b1404'],
      ['dunas', 'Dunas do Deserto', '#fbbf24', '#2e1f0a'],
      ['recife', 'Recife de Coral', '#fb7185', '#082f35'],
      ['cerejeira', 'Cerejeira em Flor', '#f9a8d4', '#2a0f1f'],
      ['tundra', 'Tundra Gelada', '#a5f3fc', '#0c1f2b'],
      ['pantano', 'Pântano Sombrio', '#a3e635', '#141f0a'],
      ['lavanda', 'Campos de Lavanda', '#a78bfa', '#1c1433'],
      ['cascata', 'Cascata Cristalina', '#38bdf8', '#062438'],
      ['lava', 'Lava Adormecida', '#ef4444', '#1f0a05'],
      ['girassol', 'Mar de Girassóis', '#facc15', '#261d05']
    ])
  },
  {
    id: 'cosmos',
    icon: '🌌',
    name: 'Cosmos',
    themes: build('cosmos', [
      ['orion', 'Nebulosa de Órion', '#e879f9', '#1a0b2e'],
      ['lactea', 'Via Láctea', '#c7d2fe', '#0b1026'],
      ['supernova', 'Supernova', '#fb923c', '#1f0b14'],
      ['buraco', 'Buraco Negro', '#a78bfa', '#050308'],
      ['aurora', 'Aurora Boreal', '#2dd4bf', '#061a24'],
      ['marte', 'Poeira de Marte', '#f97316', '#2a0e06'],
      ['saturno', 'Anéis de Saturno', '#fcd34d', '#1e1a10'],
      ['cometa', 'Cauda de Cometa', '#67e8f9', '#07152a'],
      ['eclipse', 'Eclipse Lunar', '#f87171', '#140a0a'],
      ['pulsar', 'Pulsar Violeta', '#c084fc', '#12062a'],
      ['ana', 'Estrela Anã Branca', '#f1f5f9', '#0f1420'],
      ['quasar', 'Quasar Esmeralda', '#34d399', '#04161a']
    ])
  },
  {
    id: 'gems',
    icon: '💎',
    name: 'Pedras Preciosas',
    themes: build('gems', [
      ['rubi', 'Rubi Imperial', '#f43f5e', '#2a0510'],
      ['safira', 'Safira Real', '#3b82f6', '#071530'],
      ['ametista', 'Ametista Encantada', '#a855f7', '#1c0a30'],
      ['jade', 'Jade Oriental', '#10b981', '#052219'],
      ['topazio', 'Topázio Solar', '#f59e0b', '#2a1a04'],
      ['turmalina', 'Turmalina Melancia', '#f472b6', '#0d2a1c'],
      ['opala', 'Opala de Fogo', '#fb923c', '#2a0f0a'],
      ['onix', 'Ônix Noturno', '#d4d4d8', '#0a0a0c'],
      ['perola', 'Pérola Negra', '#e2e8f0', '#15171f'],
      ['citrino', 'Citrino Radiante', '#fde047', '#26200a'],
      ['aguamarinha', 'Água-Marinha', '#22d3ee', '#062530'],
      ['granada', 'Granada Carmesim', '#dc2626', '#210707']
    ])
  },
  {
    id: 'realms',
    icon: '⚔️',
    name: 'Reinos Lendários',
    themes: build('realms', [
      ['dragao', 'Covil do Dragão', '#f97316', '#240905'],
      ['elfo', 'Floresta Élfica', '#86efac', '#0a2414'],
      ['necro', 'Cripta do Necromante', '#a3e635', '#0c0f0a'],
      ['paladino', 'Paladino Dourado', '#fcd34d', '#1f1a0f'],
      ['arcano', 'Torre Arcana', '#818cf8', '#0f0f2e'],
      ['vampiro', 'Castelo Vampírico', '#e11d48', '#1a0509'],
      ['gelo', 'Trono de Gelo', '#7dd3fc', '#0a1a2a'],
      ['anao', 'Forja dos Anões', '#fb923c', '#1f140d'],
      ['sombra', 'Guilda das Sombras', '#94a3b8', '#0b0d12'],
      ['druida', 'Círculo Druídico', '#4ade80', '#10200a'],
      ['kraken', 'Abismo do Kraken', '#2dd4bf', '#041a1f'],
      ['fenix', 'Ninho da Fênix', '#fbbf24', '#2a0c04']
    ])
  },
  {
    id: 'retro',
    icon: '🌅',
    name: 'Retrô & Synthwave',
    themes: build('retro', [
      ['outrun', 'Outrun 1984', '#f472b6', '#1a0533'],
      ['miami', 'Noites de Miami', '#22d3ee', '#2a0a2e'],
      ['vapor', 'Vaporwave', '#c084fc', '#1f0f33'],
      ['fliperama', 'Fliperama', '#facc15', '#0d0b26'],
      ['vhs', 'Fita VHS', '#f87171', '#141024'],
      ['disco', 'Discoteca', '#e879f9', '#22062a'],
      ['laser', 'Grade Laser', '#34d399', '#08102a'],
      ['crt', 'Monitor CRT', '#4ade80', '#031208'],
      ['cassete', 'Cassete Âmbar', '#fb923c', '#1a0f05'],
      ['toquio', 'Tóquio Neon', '#f43f5e', '#0a0a1f'],
      ['pordosol', 'Pôr do Sol Digital', '#fb7185', '#2a0a1f'],
      ['cromado', 'Cromado Futurista', '#cbd5e1', '#111827']
    ])
  }
];

export const DEFAULT_THEME = NEON_CLASSIC[0];

// ---------- Temas criados pelo usuário ----------
const STORAGE_KEY_CUSTOM = 'rpg_custom_themes_v1';

const hydrateCustom = (t) =>
  makeTheme(t.id, t.name || 'Tema', t.color || '#38bdf8', t.base || '#111827', { custom: true });

export const loadCustomThemes = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_CUSTOM));
    return Array.isArray(saved) ? saved.filter((t) => t && t.id).map(hydrateCustom) : [];
  } catch (e) {
    return [];
  }
};

// Só o essencial vai para o armazenamento (o resto é recalculado)
const serialize = (list) => list.map(({ id, name, color, base }) => ({ id, name, color, base }));

export function useCustomThemes() {
  const [customThemes, setCustomThemesState] = useState(loadCustomThemes);
  useUndoRestore((k) => k === STORAGE_KEY_CUSTOM, () => setCustomThemesState(loadCustomThemes()));

  const setCustomThemes = useCallback((updater) => {
    setCustomThemesState((prev) => {
      const next = (typeof updater === 'function' ? updater(prev) : updater).map(hydrateCustom);
      try {
        localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(serialize(next)));
      } catch (e) {}
      return next;
    });
  }, []);

  return [customThemes, setCustomThemes];
}

export const exportCustomThemes = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_CUSTOM)) || [];
  } catch (e) {
    return [];
  }
};

export const importCustomThemes = (list) => {
  if (!Array.isArray(list)) return;
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(list));
  } catch (e) {}
};

export const getThemeById = (id, customThemes = []) => {
  for (const cat of THEME_CATEGORIES) {
    const found = cat.themes.find((t) => t.id === id);
    if (found) return found;
  }
  return customThemes.find((t) => t.id === id) || DEFAULT_THEME;
};

export const findCategoryOf = (id, customThemes = []) => {
  if (customThemes.some((t) => t.id === id)) return 'custom';
  return THEME_CATEGORIES.find((c) => c.themes.some((t) => t.id === id))?.id || 'neon';
};

// Cor de texto legível sobre a cor de destaque (escuro em destaques claros, como os pastéis)
export const onAccentColor = (hex) => {
  try {
    const [r, g, b] = toRgb(hex).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 0.45 ? '#0b1020' : '#ffffff';
  } catch (e) {
    return '#ffffff';
  }
};
