// =========================================================
// PERSONAGENS 2D — dados (o desenho fica em Hero2D.js)
// 3 personagens padrão no formato do Ricardo: Mago, Arqueiro e Guerreiro.
// Cada um guarda a própria aparência (looks2d) e os upgrades (stats).
// =========================================================

export const DEFAULT_HERO = { cls: 'archer', looks2d: {}, stats: {}, customs: [] };

const CLASS_IDS = ['wizard', 'archer', 'warrior', 'elf'];

// Aceita o formato antigo (3D) e devolve o novo: os upgrades continuam,
// a aparência antiga (blocos) não serve mais e volta ao padrão 2D.
export const normalizeHero = (raw) => {
  const h = raw && typeof raw === 'object' ? raw : {};
  // personagens desenhados no criador (pixel art)
  const customs = Array.isArray(h.customs) ? h.customs.filter((c) => c && c.id && c.pixels) : [];
  const isCustom = typeof h.cls === 'string' && h.cls.startsWith('custom:') && customs.some((c) => `custom:${c.id}` === h.cls);
  const cls = CLASS_IDS.includes(h.cls) || isCustom ? h.cls : 'archer';
  // desenho em pixel art que substitui um personagem principal (até voltar ao original)
  const pixelOverrides = h.pixelOverrides && typeof h.pixelOverrides === 'object' ? { ...h.pixelOverrides } : {};
  return { cls, looks2d: { ...(h.looks2d || {}) }, stats: { ...(h.stats || {}) }, customs, pixelOverrides };
};

export const isCustomClass = (id) => typeof id === 'string' && id.startsWith('custom:');
export const findCustom = (hero, id) => (hero.customs || []).find((c) => `custom:${c.id}` === id) || null;

/** Classe de qualquer personagem (os 3 padrão ou um desenhado) */
export const classFor = (hero, id) => {
  const cid = id || hero.cls;
  if (isCustomClass(cid)) {
    const c = findCustom(hero, cid);
    if (c) {
      return {
        id: cid,
        name: c.name || 'Meu personagem',
        icon: '🎨',
        custom: true,
        base: { atk: 5, def: 5, agi: 5, mag: 5, hp: 5 },
        statOverrides: { mag: { icon: '🎨', name: 'Criatividade', desc: 'Poder do que você inventa' } }
      };
    }
  }
  return getHeroClass(cid);
};

// ---------- Atributos (upgrades pagos com diamantes) ----------
export const MAX_STAT_LEVEL = 10;
export const STAT_DEFS = [
  { id: 'atk', icon: '⚔️', name: 'Ataque', desc: 'Dano dos golpes' },
  { id: 'def', icon: '🛡️', name: 'Defesa', desc: 'Resistência a dano' },
  { id: 'agi', icon: '💨', name: 'Agilidade', desc: 'Velocidade e esquiva' },
  { id: 'mag', icon: '✨', name: 'Magia', desc: 'Poder dos feitiços' },
  { id: 'hp', icon: '❤️', name: 'Vida', desc: 'Pontos de vida' }
];
export const statsFor = (heroClass) =>
  STAT_DEFS.map((st) => ({ ...st, ...((heroClass && heroClass.statOverrides && heroClass.statOverrides[st.id]) || {}) }));
export const upgradeCost = (currentLevel) => currentLevel + 1;
export const getStatLevels = (hero, cls) => ({ atk: 0, def: 0, agi: 0, mag: 0, hp: 0, ...((hero.stats || {})[cls] || {}) });
export const heroPower = (heroClass, levels) =>
  STAT_DEFS.reduce((sum, st) => sum + ((heroClass.base?.[st.id] || 0) + (levels[st.id] || 0)) * 10, 0);

// ---------- Os 3 personagens ----------
const SKIN = '#fde28f';
export const HERO_CLASSES = [
  {
    id: 'wizard',
    name: 'Mago',
    icon: '🧙',
    base: { atk: 3, def: 2, agi: 3, mag: 9, hp: 4 },
    hatName: 'Chapéu de mago',
    itemName: 'Cajado',
    look: {
      skin: SKIN,
      hair: '#e5e7eb',
      hairStyle: 'longo',
      beard: 'longa',
      eye: '#0b0b0d',
      eyes: 'grande',
      mouth: 'sorriso',
      outfit: '#4c1d95',
      outfit2: '#2e1065',
      shirt: '#ede9fe',
      pants: '#2e1065',
      shoes: '#3b2416',
      trim: '#facc15',
      hat: 'chapeu-mago',
      headgear: true,
      item: true
    }
  },
  {
    id: 'archer',
    name: 'Arqueiro',
    icon: '🏹',
    base: { atk: 8, def: 3, agi: 7, mag: 2, hp: 5 },
    statOverrides: { mag: { icon: '🎯', name: 'Mira', desc: 'Precisão das flechas' } },
    hatName: 'Chapéu de arqueiro',
    itemName: 'Arco',
    // o personagem desenhado pelo Ricardo
    look: {
      skin: SKIN,
      hair: '#4a1010',
      hairStyle: 'topete',
      beard: 'nenhuma',
      eye: '#0b0b0d',
      eyes: 'grande',
      mouth: 'sorriso',
      outfit: '#0b2530',
      outfit2: '#3a2a1e',
      shirt: '#e7e7e7',
      pants: '#141a1c',
      shoes: '#3b2c22',
      trim: '#dc2626',
      hat: 'chapeu-arqueiro',
      headgear: false,
      item: true
    }
  },
  {
    id: 'warrior',
    name: 'Guerreiro',
    icon: '⚔️',
    base: { atk: 8, def: 8, agi: 3, mag: 1, hp: 7 },
    statOverrides: { mag: { icon: '🗡️', name: 'Espada', desc: 'Domínio da espada' } },
    hatName: 'Elmo',
    itemName: 'Espada e escudo',
    look: {
      skin: '#c08552',
      hair: '#7c2d12',
      hairStyle: 'curto',
      beard: 'curta',
      eye: '#0b0b0d',
      eyes: 'grande',
      mouth: 'sorriso',
      outfit: '#7f1d1d',
      outfit2: '#3f2814',
      shirt: '#e7e7e7',
      pants: '#27272a',
      shoes: '#3b2416',
      trim: '#facc15',
      hat: 'elmo',
      headgear: true,
      item: true
    }
  },
  {
    id: 'elf',
    name: 'Elfa',
    icon: '🧝',
    base: { atk: 5, def: 3, agi: 8, mag: 7, hp: 4 },
    statOverrides: { mag: { icon: '🍃', name: 'Natureza', desc: 'Magia das plantas' } },
    hatName: 'Tiara',
    itemName: 'Cajado de folhas',
    look: {
      skin: '#fde2cf',
      hair: '#fde68a',
      hairStyle: 'longo',
      beard: 'nenhuma',
      eye: '#15803d',
      eyes: 'cilios',
      mouth: 'batom',
      blush: true,
      ears: 'elfo',
      outfit: '#166534',
      outfit2: '#78350f',
      shirt: '#d9f99d',
      pants: '#14532d',
      shoes: '#78350f',
      trim: '#facc15',
      hat: 'tiara',
      headgear: true,
      item: true
    }
  }
];

export const getHeroClass = (id) => HERO_CLASSES.find((c) => c.id === id) || HERO_CLASSES[1];
export const heroNameFor = (heroClass) => heroClass.name;

export const newCustomId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Aparência final de um personagem: padrão dele + o que foi personalizado */
export const getLook = (hero, cls) => {
  const c = getHeroClass(cls || hero.cls);
  return { ...c.look, ...(((hero.looks2d || {})[c.id]) || {}) };
};

// ---------- Paletas para o editor ----------
export const OUTFIT_COLORS = [
  { hex: '#0b2530', name: 'Petróleo' },
  { hex: '#18181b', name: 'Preto' },
  { hex: '#52525b', name: 'Grafite' },
  { hex: '#e5e7eb', name: 'Branco' },
  { hex: '#7f1d1d', name: 'Vinho' },
  { hex: '#b91c1c', name: 'Vermelho' },
  { hex: '#c2410c', name: 'Laranja' },
  { hex: '#a16207', name: 'Âmbar' },
  { hex: '#166534', name: 'Verde' },
  { hex: '#0f766e', name: 'Turquesa' },
  { hex: '#1d4ed8', name: 'Azul' },
  { hex: '#1e3a8a', name: 'Marinho' },
  { hex: '#4c1d95', name: 'Roxo' },
  { hex: '#be185d', name: 'Magenta' }
];
export const DETAIL_COLORS = [
  { hex: '#3a2a1e', name: 'Couro' },
  { hex: '#5b3a1e', name: 'Marrom' },
  { hex: '#2e1065', name: 'Roxo-escuro' },
  { hex: '#14532d', name: 'Verde-escuro' },
  { hex: '#1f2937', name: 'Cinza-escuro' },
  { hex: '#78350f', name: 'Caramelo' },
  { hex: '#7f1d1d', name: 'Vinho' },
  { hex: '#0b2530', name: 'Petróleo' }
];
export const PANTS_COLORS = [
  { hex: '#141a1c', name: 'Preto' },
  { hex: '#27272a', name: 'Grafite' },
  { hex: '#1e3a8a', name: 'Jeans' },
  { hex: '#3f2814', name: 'Marrom' },
  { hex: '#2e1065', name: 'Roxo-escuro' },
  { hex: '#14532d', name: 'Verde-escuro' },
  { hex: '#a8a29e', name: 'Bege' },
  { hex: '#e5e7eb', name: 'Branco' }
];
export const SHOE_COLORS = [
  { hex: '#3b2c22', name: 'Marrom' },
  { hex: '#18181b', name: 'Preto' },
  { hex: '#78350f', name: 'Caramelo' },
  { hex: '#e5e7eb', name: 'Branco' },
  { hex: '#7f1d1d', name: 'Vinho' },
  { hex: '#1e3a8a', name: 'Azul' }
];
export const TRIM_COLORS = [
  { hex: '#facc15', name: 'Ouro' },
  { hex: '#e5e7eb', name: 'Prata' },
  { hex: '#dc2626', name: 'Rubi' },
  { hex: '#34d399', name: 'Esmeralda' },
  { hex: '#60a5fa', name: 'Safira' },
  { hex: '#c084fc', name: 'Ametista' },
  { hex: '#fb923c', name: 'Âmbar' }
];
export const SKIN_COLORS = [
  { hex: '#fde28f', name: 'Amarelo (desenho)' },
  { hex: '#fde2cf', name: 'Porcelana' },
  { hex: '#f5d0b0', name: 'Marfim' },
  { hex: '#f1c193', name: 'Bege' },
  { hex: '#e8b48a', name: 'Pêssego' },
  { hex: '#c08552', name: 'Parda' },
  { hex: '#c68642', name: 'Caramelo' },
  { hex: '#8d5524', name: 'Canela' },
  { hex: '#6b4226', name: 'Café' },
  { hex: '#3d2314', name: 'Ébano' },
  { hex: '#a7e3a1', name: 'Verde-claro' },
  { hex: '#93c5fd', name: 'Azul-gelo' }
];
export const EYE_COLORS = [
  { hex: '#0b0b0d', name: 'Preto' },
  { hex: '#78350f', name: 'Castanho' },
  { hex: '#1e3a8a', name: 'Azul-marinho' },
  { hex: '#1d4ed8', name: 'Azul' },
  { hex: '#0891b2', name: 'Turquesa' },
  { hex: '#15803d', name: 'Verde' },
  { hex: '#7c3aed', name: 'Violeta' },
  { hex: '#be123c', name: 'Vermelho' }
];
export const HAIR_COLORS = [
  { hex: '#4a1010', name: 'Vinho' },
  { hex: '#111827', name: 'Preto' },
  { hex: '#3f2a1d', name: 'Castanho-escuro' },
  { hex: '#78350f', name: 'Castanho' },
  { hex: '#7c2d12', name: 'Ruivo-escuro' },
  { hex: '#c2410c', name: 'Ruivo' },
  { hex: '#fde68a', name: 'Loiro' },
  { hex: '#e5e7eb', name: 'Grisalho' },
  { hex: '#f9a8d4', name: 'Rosa' },
  { hex: '#60a5fa', name: 'Azul' },
  { hex: '#a78bfa', name: 'Lilás' },
  { hex: '#34d399', name: 'Verde-menta' }
];
