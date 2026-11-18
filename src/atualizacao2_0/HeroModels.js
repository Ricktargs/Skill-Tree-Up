// =========================================================
// MODELOS DOS PERSONAGENS EM BLOCOS
// Cada bloco: [largura, altura, profundidade, x, y, z, cor, extras?]
// Eixos: x → direita, y → baixo, z → frente. Origem = centro do personagem.
// Cores da paleta: O roupa · OD roupa escura · T detalhes · S pele
//                  H cabelo/barba · M metal · MD metal escuro · W madeira · B barriga
// Extras: { rx, ry, rz } rotação em graus · { cls } classe CSS (ex.: 'vx-gem')
// =========================================================

// Cada personagem guarda as próprias cores (looks) e upgrades (stats)
export const DEFAULT_LOOK = { outfit: '#26262b', trim: null };
export const DEFAULT_HERO = { cls: 'wizard', looks: {}, stats: {} };

// Aceita o formato antigo ({ cls, outfit, trim }) e devolve o novo
export const normalizeHero = (raw) => {
  const h = raw && typeof raw === 'object' ? raw : {};
  const cls = h.cls || 'wizard';
  const looks = { ...(h.looks || {}) };
  if (!h.looks && (h.outfit || h.trim)) looks[cls] = { outfit: h.outfit || DEFAULT_LOOK.outfit, trim: h.trim || null };
  return { cls, looks, stats: { ...(h.stats || {}) } };
};

export const getLook = (hero, cls) => ({ ...DEFAULT_LOOK, ...((hero.looks || {})[cls || hero.cls] || {}) });

// ---------- Atributos (upgrades pagos com diamantes) ----------
export const MAX_STAT_LEVEL = 10;
export const STAT_DEFS = [
  { id: 'atk', icon: '⚔️', name: 'Ataque', desc: 'Dano dos golpes' },
  { id: 'def', icon: '🛡️', name: 'Defesa', desc: 'Resistência a dano' },
  { id: 'agi', icon: '💨', name: 'Agilidade', desc: 'Velocidade e esquiva' },
  { id: 'mag', icon: '✨', name: 'Magia', desc: 'Poder dos feitiços' },
  { id: 'hp', icon: '❤️', name: 'Vida', desc: 'Pontos de vida' }
];

// Custo do próximo nível: nível N custa N diamantes
export const upgradeCost = (currentLevel) => currentLevel + 1;

export const getStatLevels = (hero, cls) => ({ atk: 0, def: 0, agi: 0, mag: 0, hp: 0, ...((hero.stats || {})[cls] || {}) });

export const heroPower = (heroClass, levels) =>
  STAT_DEFS.reduce((sum, st) => sum + ((heroClass.base?.[st.id] || 0) + (levels[st.id] || 0)) * 10, 0);

export const OUTFIT_COLORS = [
  { hex: '#26262b', name: 'Preto' },
  { hex: '#52525b', name: 'Grafite' },
  { hex: '#e5e7eb', name: 'Branco' },
  { hex: '#b91c1c', name: 'Vermelho' },
  { hex: '#c2410c', name: 'Laranja' },
  { hex: '#a16207', name: 'Âmbar' },
  { hex: '#15803d', name: 'Verde' },
  { hex: '#0f766e', name: 'Turquesa' },
  { hex: '#1d4ed8', name: 'Azul' },
  { hex: '#1e3a8a', name: 'Marinho' },
  { hex: '#6d28d9', name: 'Roxo' },
  { hex: '#be185d', name: 'Magenta' }
];

export const TRIM_COLORS = [
  { hex: null, name: 'Cor do tema' },
  { hex: '#facc15', name: 'Ouro' },
  { hex: '#e5e7eb', name: 'Prata' },
  { hex: '#f43f5e', name: 'Rubi' },
  { hex: '#34d399', name: 'Esmeralda' },
  { hex: '#60a5fa', name: 'Safira' },
  { hex: '#c084fc', name: 'Ametista' },
  { hex: '#fb923c', name: 'Âmbar' }
];

const BOOT = '#3b2416';
const BELT = '#5b3a1e';
const STEEL = '#cbd5e1';

// Rostos 8x8 em pixels (letras → cores em `faceColors`)
const FACES = {
  wizard: ['........', '........', '.gg..gg.', '.we..ew.', '........', 'b.bbbb.b', 'bbbbbbbb', '.bbbbbb.'],
  human_f: ['........', '........', '.ll..ll.', '.we..ew.', '........', 'p......p', '...qq...', '........'],
  dwarf_f: ['........', '.ll..ll.', '.we..ew.', '........', 'p......p', '...qq...', '........', '........'],
  fairy_m: ['........', '........', '.hh..hh.', '.we..ew.', '........', '........', '...mm...', '........'],
  warrior: ['........', '........', '.hh..hh.', '.we..ew.', '........', '...nn...', '..mmmm..', '........'],
  elf: ['........', '........', '.hh..hh.', '.we..ew.', '........', '........', '...mm...', '........'],
  fairy: ['........', '........', '.ee..ee.', '.ew..ew.', '........', 'p......p', '...rr...', '........'],
  dwarf: ['........', '.hh..hh.', '.we..ew.', '........', 'bbbbbbbb', 'bbbbbbbb', 'bbbbbbbb', 'bbbbbbbb'],
  archer: ['........', '........', '.hh..hh.', '.we..ew.', '........', '........', '..mmmm..', '........'],
  dragon: ['........', '........', '.ee..ee.', '.ek..ke.', '........', '........', '........', '........'],
  zombie: ['........', '........', '.rr..kk.', '.rr..kk.', '........', '.ssssss.', '.s.s.s.s', '........']
};

const FACE_COLORS = {
  g: '#9ca3af', // sobrancelha grisalha
  w: '#f8fafc', // branco do olho
  e: 'E', // olho (cor escolhida)
  l: '#111827', // cílios
  q: '#e11d48', // lábios
  b: 'H', // barba (cor do cabelo)
  h: '#3f2a1d', // sobrancelha
  n: 'rgba(0,0,0,0.12)', // sombra do nariz
  m: '#7c2d12', // boca
  v: '#15803d', // íris verde (elfo)
  p: '#f9a8d4', // bochecha
  r: '#be123c', // boca/olho vermelho
  y: '#facc15', // olho amarelo (dragão)
  k: '#111827', // preto
  s: '#3f3f46' // pontos
};

export const HERO_CLASSES = [
  {
    id: 'wizard',
    base: { atk: 3, def: 2, agi: 3, mag: 9, hp: 4 },
    name: 'Mago',
    nameF: 'Maga',
    skin: '#f1c193',
    hair: '#e5e7eb',
    eye: '#1e3a8a',
    face: 'wizard',
    faceF: 'human_f',
    blocks: [
      [13, 12, 14, -8, 58, 0, BOOT],
      [13, 12, 14, 8, 58, 0, BOOT],
      [36, 50, 22, 0, 28, 0, 'O'],
      [38, 6, 24, 0, 50, 0, 'OD'],
      [11, 8, 5, -7, 12, 12.5, 'O', { only: 'f' }],
      [11, 8, 5, 7, 12, 12.5, 'O', { only: 'f' }],
      [37, 5, 23, 0, 18, 0, 'T'],
      [11, 34, 12, -24, 22, 0, 'O'],
      [10, 8, 10, -24, 42, 0, 'S'],
      [11, 34, 12, 24, 18, 0, 'O'],
      [10, 8, 10, 24, 38, 0, 'S'],
      [5, 96, 5, 31, 14, 6, 'W'],
      [12, 12, 12, 31, -40, 6, 'T', { cls: 'vx-gem' }],
      [30, 30, 30, 0, -12, 0, 'S', { face: true }],
      [26, 10, 6, 0, 6, 14, 'H', { only: 'm' }],
      [32, 34, 6, 0, -8, -14, 'H', { only: 'f' }],
      [3, 22, 30, -15.5, -12, 0, 'H', { only: 'f' }],
      [3, 22, 30, 15.5, -12, 0, 'H', { only: 'f' }],
      [42, 5, 42, 0, -29, 0, 'OD'],
      [30, 11, 30, 0, -37, 0, 'O'],
      [21, 11, 21, 1, -48, 0, 'O'],
      [13, 10, 13, 4, -58, 0, 'OD'],
      [7, 7, 7, 9, -65, 0, 'OD'],
      [6, 6, 2, 0, -37, 16, 'T']
    ]
  },
  {
    id: 'warrior',
    base: { atk: 8, def: 8, agi: 3, mag: 1, hp: 7 },
    name: 'Guerreiro',
    nameF: 'Guerreira',
    skin: '#e8b48a',
    hair: '#3f2a1d',
    eye: '#78350f',
    face: 'warrior',
    faceF: 'human_f',
    blocks: [
      [13, 12, 14, -8, 58, 0, BOOT],
      [13, 12, 14, 8, 58, 0, BOOT],
      [12, 14, 12, -8, 46, 0, 'OD'],
      [12, 14, 12, 8, 46, 0, 'OD'],
      [32, 30, 18, 0, 24, 0, 'O'],
      [34, 16, 20, 0, 16, 0, 'M'],
      [11, 8, 5, -7, 14, 11.5, 'M', { only: 'f' }],
      [11, 8, 5, 7, 14, 11.5, 'M', { only: 'f' }],
      [33, 4, 19, 0, 32, 0, BELT],
      [5, 5, 2, 0, 16, 10.5, 'T'],
      [14, 7, 14, -21, 8, 0, 'M'],
      [14, 7, 14, 21, 8, 0, 'M'],
      [10, 26, 10, -21, 22, 0, 'O'],
      [10, 26, 10, 21, 22, 0, 'O'],
      [9, 7, 9, -21, 38, 0, 'S'],
      [9, 7, 9, 21, 38, 0, 'S'],
      [30, 30, 30, 0, -12, 0, 'S', { face: true }],
      [34, 10, 34, 0, -26, 0, 'M'],
      [4, 22, 32, -16, -12, 0, 'M'],
      [4, 22, 32, 16, -12, 0, 'M'],
      [34, 22, 4, 0, -12, -16, 'M'],
      [4, 10, 3, 0, -14, 16, 'M'],
      [4, 12, 18, 0, -37, 0, 'T'],
      [10, 26, 5, 0, 6, -19, 'H', { only: 'f' }],
      // Espada
      [4, 10, 4, 21, 42, 9, 'W'],
      [14, 3, 5, 21, 36, 9, 'M'],
      [4, 40, 3, 21, 14, 9, '#e5e7eb'],
      // Escudo
      [5, 32, 26, -28, 22, 4, 'M'],
      [3, 26, 20, -30, 22, 4, 'O'],
      [2, 12, 10, -31.5, 22, 4, 'T']
    ]
  },
  {
    id: 'elf',
    base: { atk: 5, def: 3, agi: 8, mag: 6, hp: 4 },
    name: 'Elfo',
    nameF: 'Elfa',
    skin: '#a7e3a1',
    hair: '#fde68a',
    eye: '#15803d',
    face: 'elf',
    faceF: 'human_f',
    blocks: [
      [12, 12, 13, -7, 58, 0, '#3f2a14'],
      [12, 12, 13, 7, 58, 0, '#3f2a14'],
      [11, 16, 11, -7, 45, 0, 'OD'],
      [11, 16, 11, 7, 45, 0, 'OD'],
      [30, 30, 18, 0, 22, 0, 'O'],
      [10, 7, 4, -6, 13, 10, 'O', { only: 'f' }],
      [10, 7, 4, 6, 13, 10, 'O', { only: 'f' }],
      [32, 6, 20, 0, 38, 0, 'O'],
      [31, 4, 19, 0, 28, 0, 'T'],
      [30, 42, 3, 0, 24, -11, 'OD'],
      [9, 28, 9, -19, 21, 0, 'O'],
      [9, 28, 9, 19, 21, 0, 'O'],
      [8, 7, 8, -19, 37, 0, 'S'],
      [8, 7, 8, 19, 37, 0, 'S'],
      [30, 30, 30, 0, -12, 0, 'S', { face: true }],
      [32, 8, 32, 0, -28, 0, 'H'],
      [32, 32, 6, 0, -10, -14, 'H'],
      [3, 16, 30, -15.5, -18, 0, 'H'],
      [3, 16, 30, 15.5, -18, 0, 'H'],
      [12, 5, 4, -20, -12, 0, 'S', { rz: 20 }],
      [12, 5, 4, 20, -12, 0, 'S', { rz: -20 }],
      [33, 3, 33, 0, -23, 0, 'T'],
      // Espada élfica
      [3, 9, 3, 19, 42, 9, 'W'],
      [10, 2, 4, 19, 37, 9, 'T'],
      [3, 30, 2, 19, 20, 9, '#d1fae5']
    ]
  },
  {
    id: 'fairy',
    base: { atk: 2, def: 2, agi: 9, mag: 8, hp: 3 },
    name: 'Fada',
    skin: '#fde2cf',
    hair: '#f9a8d4',
    eye: '#7c3aed',
    gender: 'f',
    face: 'fairy',
    faceM: 'fairy_m',
    lift: -10,
    scale: 0.9,
    blocks: [
      [8, 14, 8, -5, 48, 0, 'S'],
      [8, 14, 8, 5, 48, 0, 'S'],
      [9, 6, 10, -5, 57, 1, 'T'],
      [9, 6, 10, 5, 57, 1, 'T'],
      [24, 18, 14, 0, 22, 0, 'O'],
      [8, 6, 4, -5, 17, 8, 'O', { only: 'f' }],
      [8, 6, 4, 5, 17, 8, 'O', { only: 'f' }],
      [34, 14, 26, 0, 37, 0, 'O'],
      [36, 3, 28, 0, 44, 0, 'T'],
      [7, 24, 7, -16, 24, 0, 'S'],
      [7, 24, 7, 16, 24, 0, 'S'],
      [30, 30, 30, 0, -12, 0, 'S', { face: true }],
      [32, 8, 32, 0, -28, 0, 'H'],
      [32, 36, 6, 0, -8, -14, 'H', { only: 'f' }],
      [3, 20, 30, -15.5, -16, 0, 'H', { only: 'f' }],
      [3, 20, 30, 15.5, -16, 0, 'H', { only: 'f' }],
      // Asas
      [2, 32, 24, -12, 6, -16, 'T', { ry: -40, rz: 18, cls: 'vx-wing' }],
      [2, 32, 24, 12, 6, -16, 'T', { ry: 40, rz: -18, cls: 'vx-wing' }],
      [2, 18, 16, -10, 26, -15, 'T', { ry: -35, rz: -20, cls: 'vx-wing' }],
      [2, 18, 16, 10, 26, -15, 'T', { ry: 35, rz: 20, cls: 'vx-wing' }],
      // Varinha
      [3, 26, 3, 16, 30, 8, '#fef3c7'],
      [9, 9, 3, 16, 14, 8, 'T', { rz: 45, cls: 'vx-gem' }]
    ]
  },
  {
    id: 'dwarf',
    base: { atk: 7, def: 9, agi: 2, mag: 2, hp: 8 },
    name: 'Anão',
    nameF: 'Anã',
    skin: '#6b4226',
    hair: '#c2410c',
    eye: '#78350f',
    face: 'dwarf',
    faceF: 'dwarf_f',
    blocks: [
      [15, 10, 16, -9, 60, 0, BOOT],
      [15, 10, 16, 9, 60, 0, BOOT],
      [13, 8, 13, -9, 52, 0, 'OD'],
      [13, 8, 13, 9, 52, 0, 'OD'],
      [38, 26, 22, 0, 35, 0, 'O'],
      [11, 8, 5, -7, 28, 12.5, 'O', { only: 'f' }],
      [11, 8, 5, 7, 28, 12.5, 'O', { only: 'f' }],
      [39, 5, 23, 0, 41, 0, BELT],
      [8, 6, 2, 0, 41, 12.5, 'T'],
      [12, 22, 12, -25, 30, 0, 'O'],
      [12, 22, 12, 25, 30, 0, 'O'],
      [11, 8, 11, -25, 44, 0, 'S'],
      [11, 8, 11, 25, 44, 0, 'S'],
      [30, 30, 30, 0, 6, 0, 'S', { face: true }],
      [32, 22, 6, 0, 22, 14, 'H', { only: 'm' }],
      [6, 22, 6, -17, 24, 12, 'H', { only: 'f' }],
      [6, 22, 6, 17, 24, 12, 'H', { only: 'f' }],
      [5, 4, 5, -17, 36, 12, 'T', { only: 'f' }],
      [5, 4, 5, 17, 36, 12, 'T', { only: 'f' }],
      [34, 10, 34, 0, -12, 0, 'M'],
      [36, 3, 36, 0, -7, 0, 'MD'],
      [6, 14, 6, -20, -18, 0, '#e5e7eb', { rz: 25 }],
      [6, 14, 6, 20, -18, 0, '#e5e7eb', { rz: -25 }],
      // Machado
      [4, 46, 4, 25, 28, 9, 'W'],
      [4, 16, 14, 25, 8, 15, 'M'],
      [2, 16, 3, 25, 8, 23, '#e5e7eb']
    ]
  },
  {
    id: 'archer',
    base: { atk: 8, def: 3, agi: 7, mag: 2, hp: 5 },
    name: 'Arqueiro',
    nameF: 'Arqueira',
    skin: '#e8b48a',
    hair: '#3f2a1d',
    eye: '#15803d',
    face: 'archer',
    faceF: 'human_f',
    blocks: [
      [13, 12, 14, -8, 58, 0, BOOT],
      [13, 12, 14, 8, 58, 0, BOOT],
      [12, 14, 12, -8, 46, 0, 'OD'],
      [12, 14, 12, 8, 46, 0, 'OD'],
      [32, 30, 18, 0, 24, 0, 'O'],
      [11, 8, 5, -7, 15, 11.5, 'O', { only: 'f' }],
      [11, 8, 5, 7, 15, 11.5, 'O', { only: 'f' }],
      [33, 4, 19, 0, 32, 0, BELT],
      [10, 26, 10, -21, 22, 0, 'O'],
      [10, 26, 10, 21, 22, 0, 'O'],
      [9, 7, 9, -21, 38, 0, 'S'],
      [9, 7, 9, 21, 38, 0, 'S'],
      [30, 30, 30, 0, -12, 0, 'S', { face: true }],
      // Capuz
      [34, 10, 34, 0, -26, 0, 'O'],
      [34, 32, 6, 0, -12, -15, 'O'],
      [4, 30, 32, -17, -12, 0, 'O'],
      [4, 30, 32, 17, -12, 0, 'O'],
      [14, 8, 14, 0, -32, -8, 'OD'],
      [4, 18, 3, -11, 4, 16, 'H', { only: 'f' }],
      [4, 18, 3, 11, 4, 16, 'H', { only: 'f' }],
      // Aljava com flechas
      [10, 26, 8, 8, 16, -13, 'W', { rz: 15 }],
      [3, 9, 3, 6, -1, -13, 'T', { rz: 15 }],
      [3, 9, 3, 11, 0, -13, 'T', { rz: 15 }],
      // Arco
      [3, 11, 3, -23, -4, 6, 'W'],
      [3, 11, 3, -26, 6, 6, 'W'],
      [3, 12, 3, -27, 18, 6, 'W'],
      [3, 11, 3, -26, 30, 6, 'W'],
      [3, 11, 3, -23, 40, 6, 'W'],
      [1, 46, 1, -21, 18, 6, '#e5e7eb']
    ]
  },
  {
    id: 'dragon',
    base: { atk: 9, def: 6, agi: 5, mag: 7, hp: 9 },
    name: 'Dragão',
    skin: 'O',
    hair: 'T',
    eye: '#facc15',
    noGender: true,
    face: 'dragon',
    lift: -12,
    scale: 1.3,
    floating: true,
    blocks: [
      [17, 17, 17, 30, 22.0, 6.0, 'O', { wave: 0.0 }],
      [13, 3, 15, 30, 30.5, 6.0, 'B', { wave: 0.0 }],
      [4, 7, 9, 30, 10.5, 6.0, 'T', { wave: 0.0 }],
      [16, 16, 16, 19, 29.3, 4.6, 'O', { wave: -0.18 }],
      [12, 3, 14, 19, 37.3, 4.6, 'B', { wave: -0.18 }],
      [4, 11, 4, 19, 42.3, -2.4000000000000004, 'O', { wave: -0.18 }],
      [6, 3, 6, 20, 48.3, -2.4000000000000004, '#e5e7eb', { wave: -0.18 }],
      [4, 11, 4, 19, 42.3, 11.6, 'O', { wave: -0.18 }],
      [6, 3, 6, 20, 48.3, 11.6, '#e5e7eb', { wave: -0.18 }],
      [15, 15, 15, 8, 30.5, 1.0, 'O', { wave: -0.36 }],
      [11, 3, 13, 8, 38.0, 1.0, 'B', { wave: -0.36 }],
      [4, 7, 7, 8, 20.0, 1.0, 'T', { wave: -0.36 }],
      [14, 14, 14, -3, 24.6, -3.0, 'O', { wave: -0.54 }],
      [10, 3, 12, -3, 31.6, -3.0, 'B', { wave: -0.54 }],
      [13, 13, 13, -14, 16.5, -5.7, 'O', { wave: -0.72 }],
      [9, 3, 11, -14, 23.0, -5.7, 'B', { wave: -0.72 }],
      [4, 7, 5, -14, 7.0, -5.7, 'T', { wave: -0.72 }],
      [12, 12, 12, -25, 13.0, -5.6, 'O', { wave: -0.9 }],
      [8, 3, 10, -25, 19.0, -5.6, 'B', { wave: -0.9 }],
      [4, 11, 4, -25, 24.0, -10.6, 'O', { wave: -0.9 }],
      [6, 3, 6, -24, 30.0, -10.6, '#e5e7eb', { wave: -0.9 }],
      [4, 11, 4, -25, 24.0, -0.5999999999999996, 'O', { wave: -0.9 }],
      [6, 3, 6, -24, 30.0, -0.5999999999999996, '#e5e7eb', { wave: -0.9 }],
      [11, 11, 11, -35, 17.0, -2.9, 'O', { wave: -1.08 }],
      [7, 3, 9, -35, 22.5, -2.9, 'B', { wave: -1.08 }],
      [4, 7, 4, -35, 8.5, -2.9, 'T', { wave: -1.08 }],
      [10, 10, 10, -44, 25.2, 1.1, 'O', { wave: -1.26 }],
      [6, 3, 8, -44, 30.2, 1.1, 'B', { wave: -1.26 }],
      [9, 9, 9, -52, 30.7, 4.7, 'O', { wave: -1.44 }],
      [5, 3, 7, -52, 35.2, 4.7, 'B', { wave: -1.44 }],
      [4, 7, 4, -52, 23.2, 4.7, 'T', { wave: -1.44 }],
      [9, 9, 9, -59, 28.9, 6.0, 'O', { wave: -1.62 }],
      [5, 3, 7, -59, 33.4, 6.0, 'B', { wave: -1.62 }],
      // Cabeça olhando para a direita
      [22, 17, 19, 45, 11, 5, 'O', { wave: 0.18 }],
      [15, 10, 15, 60, 14, 5, 'O', { wave: 0.18 }],
      [13, 4, 13, 59, 21, 5, 'B', { wave: 0.18 }],
      [3, 3, 2, 50, 7, -5, '#facc15', { wave: 0.18 }],
      [3, 3, 2, 50, 7, 15, '#facc15', { wave: 0.18 }],
      [2, 2, 1, 51, 7, -6, '#111827', { wave: 0.18 }],
      [2, 2, 1, 51, 7, 16, '#111827', { wave: 0.18 }],
      // Chifres em galhada
      [3, 16, 3, 41, -4, 0, '#e5e7eb', { rz: 28, wave: 0.18 }],
      [3, 16, 3, 41, -4, 10, '#e5e7eb', { rz: 28, wave: 0.18 }],
      [3, 7, 3, 37, -12, 0, '#e5e7eb', { rz: -20, wave: 0.18 }],
      [3, 7, 3, 37, -12, 10, '#e5e7eb', { rz: -20, wave: 0.18 }],
      // Bigodes longos
      [26, 1.5, 1.5, 76, 13, -3, 'T', { ry: 22, rz: -12, wave: 0.18 }],
      [26, 1.5, 1.5, 76, 13, 13, 'T', { ry: -22, rz: -12, wave: 0.18 }],
      // Juba
      [7, 14, 18, 34, 8, 5, 'T', { wave: 0.18 }],
      [5, 10, 14, 28, 2, 5, 'T', { wave: 0.18 }],
      // Pérola mágica
      [8, 8, 8, 64, -10, 5, 'T', { cls: 'vx-gem', wave: 0.3 }],
      // Ponta da cauda
      [10, 9, 9, -67, 30, 0, 'T', { wave: -1.9 }],
    ]
  },
  {
    id: 'zombie',
    base: { atk: 6, def: 5, agi: 2, mag: 3, hp: 9 },
    name: 'Morto-Vivo',
    nameF: 'Morta-Viva',
    skin: '#7aa05a',
    hair: '#3f3f46',
    eye: '#111827',
    face: 'zombie',
    blocks: [
      [13, 12, 14, -8, 58, 0, '#3f3f46'],
      [13, 12, 14, 8, 58, 0, '#3f3f46'],
      [12, 14, 12, -8, 46, 0, 'OD'],
      [12, 10, 12, 8, 44, 0, 'OD'],
      [12, 4, 12, 8, 51, 0, 'S'],
      [32, 30, 18, 0, 24, 0, 'O'],
      [11, 8, 5, -7, 15, 11.5, 'O', { only: 'f' }],
      [11, 8, 5, 7, 15, 11.5, 'O', { only: 'f' }],
      [8, 8, 2, -6, 22, 9.5, '#a16207'],
      [6, 4, 18, 10, 40, 0, 'OD'],
      [6, 3, 18, -10, 40, 0, 'OD'],
      // Braço direito para frente, esquerdo caído
      [10, 26, 10, 21, 10, 12, 'O', { rx: -80 }],
      [9, 7, 9, 21, 8, 27, 'S'],
      [10, 26, 10, -22, 24, 0, 'O', { rz: 8 }],
      [9, 7, 9, -24, 39, 0, 'S'],
      [30, 30, 30, 0, -12, 0, 'S', { face: true, rz: 8 }],
      [30, 4, 30, -1, -28, 0, 'H', { rz: 8 }],
      [30, 24, 4, 1, 0, -16, 'H', { rz: 8, only: 'f' }]
    ]
  }
];

export const getHeroClass = (id) => HERO_CLASSES.find((c) => c.id === id) || HERO_CLASSES[0];

// Resolve um código da paleta para uma cor CSS
export const resolveColor = (code, palette) => {
  switch (code) {
    case 'O':
      return palette.outfit;
    case 'OD':
      return `color-mix(in srgb, ${palette.outfit} 62%, #000000)`;
    case 'T':
      return palette.trim;
    case 'S':
      return palette.skin;
    case 'H':
      return palette.hair;
    case 'E':
      return palette.eye;
    case 'M':
      return STEEL;
    case 'MD':
      return '#64748b';
    case 'W':
      return '#8b5a2b';
    case 'B':
      return `color-mix(in srgb, ${palette.outfit} 35%, #fcd34d)`;
    default:
      return code;
  }
};

// `look` = cores daquele personagem ({ outfit, trim })
export const buildPalette = (heroClass, look) => {
  const outfit = look.outfit || DEFAULT_LOOK.outfit;
  const trim = look.trim || 'var(--theme-accent, #38bdf8)';
  const base = { outfit, trim, skin: '#f1c193', hair: '#e5e7eb', eye: '#1e293b' };
  return {
    outfit,
    trim,
    skin: look.skin || resolveColor(heroClass.skin, base),
    hair: look.hair || resolveColor(heroClass.hair, base),
    eye: look.eye || heroClass.eye || '#1e293b'
  };
};

// Gênero do personagem (o dragão não tem)
export const getGender = (look, heroClass) => look.gender || heroClass.gender || 'm';

// Blocos visíveis para o gênero escolhido ({ only: 'm' } / { only: 'f' })
export const blocksFor = (heroClass, gender) =>
  heroClass.blocks.filter((b) => !b[7] || !b[7].only || b[7].only === gender);

// Nome do personagem no gênero escolhido (Mago → Maga...)
export const heroNameFor = (heroClass, gender) => (gender === 'f' && heroClass.nameF) || heroClass.name;

export const faceFor = (heroClass, gender) =>
  (gender === 'f' ? heroClass.faceF : heroClass.faceM) || heroClass.face;

export const SKIN_COLORS = ['#fde2cf', '#f5d0b0', '#f1c193', '#e8b48a', '#c68642', '#8d5524', '#6b4226', '#3d2314', '#a7e3a1', '#7aa05a', '#93c5fd', '#c4b5fd'];
export const EYE_COLORS = ['#1e293b', '#78350f', '#1d4ed8', '#0891b2', '#15803d', '#7c3aed', '#be123c', '#facc15'];
export const HAIR_COLORS = ['#111827', '#3f2a1d', '#78350f', '#c2410c', '#fde68a', '#e5e7eb', '#f9a8d4', '#60a5fa', '#a78bfa', '#34d399'];

export const FACE_PATTERNS = FACES;
export const FACE_PIXEL_COLORS = FACE_COLORS;
