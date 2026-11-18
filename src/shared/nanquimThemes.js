// =========================================================
// TEMAS DO NANQUIM — papéis, tintas e aquarelas
// Cada tema vira variáveis CSS (--nq-*) no <html>, em versão clara e
// noturna. O "Clássico" é exatamente a paleta da Árvore e usa a cor do
// tema de cores das Habilidades como tinta.
// =========================================================

const hsl = (h, s, l) => {
  const S = s / 100;
  const L = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
};
const rgbTriplet = (h, s, l) => {
  const hex = hsl(h, s, l);
  return `${parseInt(hex.slice(1, 3), 16)} ${parseInt(hex.slice(3, 5), 16)} ${parseInt(hex.slice(5, 7), 16)}`;
};

// Gera claro + noturno a partir do tom do papel e da cor da aquarela
const make = (id, name, desc, paperHue, paperSat, accentHue, accentSat = 52) => ({
  id,
  name,
  desc,
  light: {
    bg: hsl(paperHue, paperSat, 86),
    paper: hsl(paperHue, paperSat * 0.8, 96.5),
    paper2: hsl(paperHue, paperSat * 0.8, 92.5),
    paper3: hsl(paperHue, paperSat * 0.75, 87.5),
    input: hsl(paperHue, paperSat, 98.5),
    ink: hsl(paperHue, 18, 12),
    inkSoft: hsl(paperHue, 14, 20),
    muted: hsl(paperHue, 9, 43),
    shade: rgbTriplet(paperHue, 35, 17),
    accent: hsl(accentHue, accentSat, 34),
    title: hsl(accentHue, accentSat, 30),
    foliage: hsl(accentHue, accentSat, 36),
    foliage2: hsl(accentHue, accentSat - 6, 43),
    foliageActive: hsl(accentHue, accentSat - 6, 52),
    foliageEdge: hsl(accentHue, accentSat + 10, 16),
    groundTop: hsl(accentHue, 12, 6),
    groundMid: hsl(accentHue, 45, 15),
    groundDeep: hsl(accentHue, 55, 28)
  },
  dark: {
    bg: hsl(paperHue, 18, 12),
    paper: hsl(paperHue, 18, 14.5),
    paper2: hsl(paperHue, 18, 17.5),
    paper3: hsl(paperHue, 18, 21),
    input: hsl(paperHue, 20, 11),
    ink: hsl(paperHue, 10, 90),
    inkSoft: hsl(paperHue, 12, 81),
    muted: hsl(paperHue, 9, 64),
    shade: rgbTriplet(paperHue, 25, 82),
    accent: hsl(accentHue, accentSat, 60),
    title: hsl(accentHue, accentSat - 10, 74),
    foliage: hsl(accentHue, accentSat, 34),
    foliage2: hsl(accentHue, accentSat - 6, 39),
    foliageActive: hsl(accentHue, accentSat, 55),
    foliageEdge: hsl(accentHue, accentSat + 10, 11),
    groundTop: hsl(accentHue, 20, 2),
    groundMid: hsl(accentHue, 55, 10),
    groundDeep: hsl(accentHue, 60, 23)
  }
});

// O Clássico: valores exatos da Árvore
const CLASSICO = {
  id: 'classico',
  name: 'Clássico',
  desc: 'O papel da Árvore, com a tinta na cor do seu tema',
  follow: true,
  light: {
    bg: '#ece4d1',
    paper: '#fbf8f1',
    paper2: '#f4efe3',
    paper3: '#ebe4d3',
    input: '#fffdf8',
    ink: '#231f19',
    inkSoft: '#3a3428',
    muted: '#776f61',
    shade: '60 48 28',
    accent: '#2e6f8e',
    title: '#2b6582',
    foliage: '#2c6b8a',
    foliage2: '#3b7d9c',
    foliageActive: '#4f9bbd',
    foliageEdge: '#10344a',
    groundTop: '#0e0f11',
    groundMid: '#132a3a',
    groundDeep: '#1f5170'
  },
  dark: {
    bg: '#17212b',
    paper: '#1b252f',
    paper2: '#212d38',
    paper3: '#283643',
    input: '#16202a',
    ink: '#e4e6e2',
    inkSoft: '#c9d3d9',
    muted: '#9aa6ae',
    shade: '190 210 225',
    accent: '#4f9fc4',
    title: '#8fc3dc',
    foliage: '#2a6888',
    foliage2: '#337493',
    foliageActive: '#4f9fc4',
    foliageEdge: '#0a2131',
    groundTop: '#040507',
    groundMid: '#0b1d2a',
    groundDeep: '#174460'
  }
};

export const NANQUIM_THEMES = [
  CLASSICO,
  make('sepia', 'Sépia Antiga', 'Papel envelhecido e tinta cor de ferrugem', 32, 42, 18, 58),
  make('pergaminho', 'Pergaminho Real', 'Pergaminho dourado com selo carmim', 44, 58, 352, 58),
  make('jade', 'Jardim de Jade', 'Papel de arroz e aquarela verde', 95, 22, 152, 44),
  make('anil', 'Maré de Anil', 'Papel azulado e tinta índigo', 212, 26, 226, 52),
  make('lavanda', 'Lavanda Seca', 'Papel lilás e violeta profundo', 272, 22, 270, 38),
  make('cerejeira', 'Pétala de Cerejeira', 'Papel rosado e tinta framboesa', 345, 38, 338, 52),
  make('outono', 'Folhas de Outono', 'Creme quente e laranja queimado', 28, 55, 22, 70),
  make('grafite', 'Grafite', 'Cinza neutro, desenho a lápis', 210, 6, 210, 12),
  make('musgo', 'Musgo da Floresta', 'Papel oliva e verde-musgo', 70, 26, 95, 40),
  make('cobre', 'Cobre e Carvão', 'Papel cinza-quente e cobre', 25, 14, 20, 62),
  make('oceano', 'Tinta do Mar', 'Areia clara e azul-petróleo', 40, 30, 190, 62)
];

export const getNanquimTheme = (id) => NANQUIM_THEMES.find((t) => t.id === id) || CLASSICO;

// Variáveis CSS do tema (clara ou noturna)
export const nanquimVars = (id, dark) => {
  const t = getNanquimTheme(id);
  const p = dark ? t.dark : t.light;
  return {
    '--nq-bg': p.bg,
    '--nq-paper': p.paper,
    '--nq-paper-2': p.paper2,
    '--nq-paper-3': p.paper3,
    '--nq-input': p.input,
    '--nq-ink': p.ink,
    '--nq-ink-soft': p.inkSoft,
    '--nq-muted': p.muted,
    '--nq-shade-rgb': p.shade,
    '--nq-line': `rgb(${p.shade} / ${dark ? 0.12 : 0.16})`,
    '--nq-line-strong': `rgb(${p.shade} / ${dark ? 0.24 : 0.28})`,
    '--nq-accent': p.accent,
    '--nq-title': p.title,
    '--nq-foliage': p.foliage,
    '--nq-foliage-2': p.foliage2,
    '--nq-foliage-active': p.foliageActive,
    '--nq-foliage-edge': p.foliageEdge,
    '--nq-ground-top': p.groundTop,
    '--nq-ground-mid': p.groundMid,
    '--nq-ground-deep': p.groundDeep
  };
};
