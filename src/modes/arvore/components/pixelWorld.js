/* =========================================================
   SANTUÁRIO EM PIXEL ART — desenhos do mundo
   Tudo é desenhado em "pixels de arte" (1 unidade = 1 pixel do
   desenho, do mesmo tamanho dos pixels do personagem) numa tela
   pequena que depois é ampliada sem borrar.
   - Fora: céu, fundo com profundidade, chão e a Árvore-casa gigante.
   - Dentro do tronco: 2 andares ligados por uma escada.
========================================================= */

export const VH = 240; // altura da tela em pixels de arte
export const GROUND = 196; // onde o chão começa (fora)
export const OUT_W = 2000;
export const TX = 1000; // centro da árvore
export const IN_W = 440;
export const FLOOR1 = 212;
export const FLOOR2 = 120;
export const LADDER_X = 140;
export const FAR = 0.3;
export const MID = 0.55;
export const PAD = 172; // espaço acima da tela (copa e céu em telas altas)
export const BOT = 152; // terra a mais embaixo (telas altas)
const VB = VH + BOT;

export const SCENES = {
  campo: { name: 'Campo', desc: 'Grama e colinas até o horizonte', bounds: [120, 1880] },
  ilha: { name: 'Ilha voadora', desc: 'Uma ilha flutuando entre as nuvens', bounds: [600, 1400], island: [560, 1440] },
  praia: { name: 'Praia', desc: 'Areia e mar do lado de casa', bounds: [120, 1668], sand: 1400, sea: 1660 }
};
export const SCENE_IDS = Object.keys(SCENES);

// limites para andar dentro de casa
export const IN_BOUNDS = [34, 404];
export const DECK_Y = 104; // varanda da árvore
export const DECK = [TX + 60, TX + 160];
export const BALCONY_DOOR = TX + 76;
// canteiro (mini horta) à esquerda da casa
export const GARDEN_X = TX - 330;
export const GARDEN_BED_W = 14;
export const GARDEN_GAP = 3;
export const GARDEN_X0 = GARDEN_X - Math.round((4 * GARDEN_BED_W + 3 * GARDEN_GAP) / 2);

// coisas para interagir (E). y = altura do chão onde ficam
export const SPOTS = [
  { id: 'door', where: 'out', x: TX, y: GROUND, w: 40, label: 'Entrar em casa', act: 'enter' },
  { id: 'garden', where: 'out', x: GARDEN_X, y: GROUND, w: 70, label: 'Canteiro', act: 'garden' },
  { id: 'deckdoor', where: 'out', x: BALCONY_DOOR, y: DECK_Y, w: 24, label: 'Entrar pela varanda', act: 'deckIn' },
  { id: 'exit', where: 'in', x: 50, y: FLOOR1, w: 32, label: 'Sair de casa', act: 'exit' },
  { id: 'up', where: 'in', x: LADDER_X, y: FLOOR1, w: 26, label: 'Subir a escada', act: 'up' },
  { id: 'chest', where: 'in', x: 308, y: FLOOR1, w: 40, label: 'Baú do personagem', act: 'hero' },
  { id: 'clock', where: 'in', x: 354, y: FLOOR1, w: 24, label: 'Relógio (Pomodoro)', act: 'pomodoro' },
  { id: 'shelf', where: 'in', x: 80, y: FLOOR2, w: 56, label: 'Estante (Notas)', act: 'notes' },
  { id: 'down', where: 'in', x: LADDER_X, y: FLOOR2, w: 26, label: 'Descer a escada', act: 'down' },
  { id: 'bed', where: 'in', x: 214, y: FLOOR2, w: 72, label: 'Dormir', act: 'sleep' },
  { id: 'deck', where: 'in', x: 404, y: FLOOR2, w: 24, label: 'Ir para a varanda', act: 'deckOut' }
];

/* ---------------- blocos (colisão em quadradinhos de 4 pixels) ---------------- */
export const TILE = 4;
export const GRID_OUT = { cols: OUT_W / TILE, rows: (PAD + VH + BOT) / TILE, oy: PAD };
export const GRID_IN = { cols: IN_W / TILE, rows: (VH + BOT) / TILE, oy: 0 };
export function defaultSolid(where, kind) {
  const G = where === 'out' ? GRID_OUT : GRID_IN;
  const grid = new Uint8Array(G.cols * G.rows);
  const row = (y) => Math.floor((y + G.oy) / TILE);
  const fill = (x0, x1, y0, y1) => {
    for (let r = Math.max(0, row(y0)); r < Math.min(G.rows, row(y1)); r++)
      for (let c = Math.max(0, Math.floor(x0 / TILE)); c < Math.min(G.cols, Math.ceil(x1 / TILE)); c++) grid[r * G.cols + c] = 1;
  };
  if (where === 'out') {
    const isl = SCENES[kind] && SCENES[kind].island;
    if (isl) fill(isl[0], isl[1], GROUND, VH + BOT);
    else fill(0, OUT_W, GROUND, VH + BOT);
    fill(DECK[0], DECK[1], DECK_Y, DECK_Y + 4);
    fill(DECK[1] - 4, DECK[1], DECK_Y - 16, DECK_Y); // grade no fim da varanda (dá para pular)
  } else {
    fill(0, IN_W, FLOOR1, VH + BOT);
    fill(24, 416, FLOOR2, FLOOR2 + 8);
    fill(0, 24, -40, VH + BOT);
    fill(416, IN_W, -40, VH + BOT);
  }
  return grid;
}

/* ---------------- utilidades ---------------- */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { c, g };
}
export function rect(g, x, y, w, h, col) {
  g.fillStyle = col;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
export function px(g, x, y, col) {
  g.fillStyle = col;
  g.fillRect(Math.round(x), Math.round(y), 1, 1);
}
export function disc(g, cx, cy, r, col) {
  g.fillStyle = col;
  cx = Math.round(cx);
  cy = Math.round(cy);
  r = Math.round(r);
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.round(Math.sqrt(r * r - dy * dy));
    g.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
  }
}
function ellipse(g, cx, cy, rx, ry, col) {
  g.fillStyle = col;
  for (let dy = -ry; dy <= ry; dy++) {
    const dx = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))));
    g.fillRect(Math.round(cx - dx), Math.round(cy + dy), dx * 2 + 1, 1);
  }
}
// linha grossa (carimbando discos)
function stroke(g, pts, r0, r1, col) {
  const total = pts.length - 1;
  for (let i = 0; i < total; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let k = 0; k <= n; k++) {
      const t = (i + k / Math.max(1, n)) / total;
      disc(g, x0 + ((x1 - x0) * k) / Math.max(1, n), y0 + ((y1 - y0) * k) / Math.max(1, n), r0 + (r1 - r0) * t, col);
    }
  }
}

/* ---------------- cores por estação ---------------- */
export const PAL = {
  primavera: {
    leaf: ['#1f5f2e', '#2f7d3a', '#46a046', '#7cc95a'],
    bloom: '#f9a8d4',
    grass: ['#58b947', '#3c8f37', '#8fd86a'],
    hill: ['#a4dc93', '#7cc077'],
    flower: ['#f9a8d4', '#fde047', '#ffffff', '#c084fc']
  },
  verao: {
    leaf: ['#1b5a2c', '#26773a', '#3a9a44', '#6cc457'],
    grass: ['#4eae42', '#357f33', '#82d060'],
    hill: ['#93d38c', '#6db86f'],
    flower: ['#facc15', '#f87171', '#ffffff']
  },
  outono: {
    leaf: ['#7a2e10', '#b4471a', '#de7424', '#f4b23e'],
    grass: ['#a3a03e', '#7d7a2e', '#c7bf58'],
    hill: ['#d4bb72', '#bda25a'],
    flower: ['#f97316', '#facc15']
  },
  inverno: {
    leaf: ['#244d3a', '#33664c', '#4d8466', '#eef5f9'],
    grass: ['#eef5f9', '#c6d6e0', '#ffffff'],
    hill: ['#e4edf2', '#cddbe4'],
    flower: [],
    snow: true
  }
};
const BARK = ['#3d2412', '#4e2f17', '#6b4423', '#7d5130', '#946238'];
const DIRT = ['#7a4b26', '#5e3a1d', '#93603a'];
const WOOD = ['#5a3820', '#8a5a2e', '#a8743e', '#c48a52'];

/* ---------------- céu (desenhado a cada quadro, fixo na tela) ---------------- */
const DAY_SKY = ['#5bb8f5', '#6cc2f7', '#7dcaf8', '#8fd3fa', '#a2dcfb', '#b6e5fc', '#caeefd', '#dcf4fe'];
const NIGHT_SKY = ['#0a0f2c', '#0e1535', '#121b3f', '#17224a', '#1c2a55', '#223260', '#293b6b', '#304476'];
let STARS = null;
export function drawSky(g, cw, night, t, h = VH) {
  const bands = night ? NIGHT_SKY : DAY_SKY;
  const top = h - VH; // telas altas: o céu continua para cima
  const bh = Math.ceil(VH / bands.length);
  if (top > 0) rect(g, 0, 0, cw, top + 1, bands[0]);
  g.save();
  g.translate(0, top);
  bands.forEach((col, i) => rect(g, 0, i * bh, cw, bh, col));
  if (night) {
    if (!STARS) {
      const r = rng(7);
      STARS = Array.from({ length: 140 }, () => ({ x: r(), y: r() * 340 - 170, p: r() * 6, big: r() < 0.12 }));
    }
    STARS.forEach((s) => {
      const on = Math.sin(t * 1.6 + s.p) > -0.4;
      const x = Math.round(s.x * cw);
      if (s.y < -top) return;
      if (on) px(g, x, s.y, s.big ? '#ffffff' : '#c7d2fe');
      if (s.big && on) {
        px(g, x - 1, s.y, '#818cf8');
        px(g, x + 1, s.y, '#818cf8');
        px(g, x, s.y - 1, '#818cf8');
        px(g, x, s.y + 1, '#818cf8');
      }
    });
    // lua
    const mx = Math.round(cw * 0.78);
    disc(g, mx, 42, 13, '#fef9c3');
    disc(g, mx + 5, 38, 11, NIGHT_SKY[1]);
  } else {
    const sx = Math.round(cw * 0.8);
    disc(g, sx, 40, 17, '#fff7c2');
    disc(g, sx, 40, 13, '#ffe066');
    disc(g, sx - 3, 37, 5, '#fff3a6');
  }
  g.restore();
}

// nuvens (fixas no céu, andando devagar)
let CLOUDS = null;
export function drawClouds(g, cw, camX, night, t) {
  if (!CLOUDS) {
    const r = rng(21);
    CLOUDS = Array.from({ length: 9 }, () => ({ x: r() * 1400, y: 14 + r() * 80, s: 0.6 + r() * 0.8, v: 2 + r() * 4 }));
  }
  const col = night ? ['#3b4a7a', '#4a5a8c'] : ['#e8f4fb', '#ffffff'];
  CLOUDS.forEach((c) => {
    const span = cw + 140;
    let x = (((c.x + t * c.v - camX * 0.08) % span) + span) % span - 70;
    const s = c.s;
    disc(g, x, c.y + 4 * s, 10 * s, col[0]);
    disc(g, x + 14 * s, c.y, 13 * s, col[0]);
    disc(g, x + 30 * s, c.y + 4 * s, 9 * s, col[0]);
    rect(g, x - 8 * s, c.y + 6 * s, 46 * s, 8 * s, col[0]);
    disc(g, x + 12 * s, c.y - 2 * s, 10 * s, col[1]);
    disc(g, x, c.y + 2 * s, 7 * s, col[1]);
    x += 0;
  });
}

/* ---------------- ilhas de fundo ---------------- */
function floatIsland(g, x, y, w, P, fade = 0) {
  const top = shade(P.grass[0], fade);
  const rock = shade('#8a6a4a', fade);
  const rockD = shade('#5d4330', fade);
  const half = w / 2;
  for (let dx = -half; dx <= half; dx++) {
    const t = dx / half;
    const depth = Math.round(w * 0.55 * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - Math.abs(t) * 0.3));
    rect(g, x + dx, y + 3, 1, depth, Math.abs(dx) > half * 0.6 ? rockD : rock);
    rect(g, x + dx, y, 1, 3, top);
  }
  // arvorezinha
  disc(g, x - half * 0.3, y - 6, Math.max(3, w * 0.12), shade(P.leaf[2], fade));
}

/* ---------------- fundo distante ---------------- */
const hillA = (x) => 134 + Math.sin(x * 0.011) * 14 + Math.sin(x * 0.027 + 1.3) * 7;
const hillB = (x) => 166 + Math.sin(x * 0.017 + 2) * 9 + Math.sin(x * 0.043) * 4;

export function buildFar(kind, season) {
  const P = PAL[season];
  const W = Math.ceil(OUT_W * FAR) + 1900;
  const { c, g } = mk(W, VB + PAD);
  g.translate(0, PAD);
  const r = rng(11);
  if (kind === 'campo') {
    for (let x = 0; x < W; x++) {
      const h = Math.round(hillA(x));
      rect(g, x, h, 1, VB - h, P.hill[0]);
      if (P.snow) px(g, x, h, '#ffffff');
    }
    for (let i = 0; i < 55; i++) {
      const x = r() * W;
      const h = hillA(x);
      const s = 3 + Math.round(r() * 3);
      rect(g, x, h - s, 1, s + 2, shade(P.hill[1], -0.3));
      disc(g, x, h - s - 2, s, shade(P.hill[1], -0.12));
    }
  } else if (kind === 'ilha') {
    for (let i = 0; i < 12; i++) {
      floatIsland(g, 60 + i * (W / 12) + r() * 80, 70 + r() * 90, 26 + r() * 46, P, 0.35);
    }
    for (let x = 0; x < W; x++) {
      const h = Math.round(212 + Math.sin(x * 0.05) * 3 + Math.sin(x * 0.13) * 2);
      rect(g, x, h, 1, VB - h, '#dbeafe');
    }
  } else {
    // mar até o horizonte
    rect(g, 0, 150, W, VB - 150, '#2f7fc1');
    for (let y = 152; y < VB; y += 5) {
      for (let x = Math.floor(r() * 12); x < W; x += 14 + Math.floor(r() * 18)) rect(g, x, y, 3 + Math.floor(r() * 5), 1, '#5aa5dc');
    }
    // ilhota lá longe
    for (let i = 0; i < 4; i++) {
      const x = 200 + i * 520 + r() * 100;
      ellipse(g, x, 151, 30 + r() * 30, 7, shade(P.hill[1], -0.25));
    }
  }
  return c;
}

export function buildMid(kind, season) {
  const P = PAL[season];
  const W = Math.ceil(OUT_W * MID) + 1900;
  const { c, g } = mk(W, VB + PAD);
  g.translate(0, PAD);
  const r = rng(33);
  if (kind === 'campo') {
    for (let x = 0; x < W; x++) {
      const h = Math.round(hillB(x));
      rect(g, x, h, 1, VB - h, P.hill[1]);
      if (P.snow) px(g, x, h, '#ffffff');
    }
    for (let i = 0; i < 40; i++) {
      const x = r() * W;
      const h = hillB(x);
      const s = 5 + Math.round(r() * 5);
      rect(g, x - 1, h - s, 3, s + 3, BARK[1]);
      disc(g, x, h - s - 3, s, P.leaf[1]);
      disc(g, x - 2, h - s - 5, s - 2, P.leaf[2]);
      if (P.snow) rect(g, x - s + 2, h - s * 2 - 2, s * 2 - 4, 2, '#ffffff');
    }
  } else if (kind === 'ilha') {
    for (let i = 0; i < 7; i++) floatIsland(g, 100 + i * (W / 7) + r() * 120, 120 + r() * 60, 40 + r() * 40, P, 0.15);
  } else {
    return null;
  }
  return c;
}

/* ---------------- chão ---------------- */
function groundStrip(g, x0, x1, P, r, bottom = () => VB) {
  for (let x = x0; x < x1; x++) {
    const b = bottom(x);
    if (b <= GROUND) continue;
    rect(g, x, GROUND, 1, b - GROUND, DIRT[0]);
    rect(g, x, GROUND, 1, 4, P.grass[0]);
    if (r() < 0.5) px(g, x, GROUND + 4, P.grass[1]);
    if (r() < 0.25) px(g, x, GROUND - 1, P.grass[0]);
    if (r() < 0.08) px(g, x, GROUND - 2, P.grass[2]);
    if (r() < 0.2) px(g, x, GROUND + 1, P.grass[2]);
    for (let y = GROUND + 6; y < b; y++) {
      const v = r();
      if (v < 0.05) px(g, x, y, DIRT[2]);
      else if (v < 0.1) px(g, x, y, DIRT[1]);
    }
  }
  // pedrinhas na terra
  for (let i = 0; i < (x1 - x0) / 40; i++) {
    const x = x0 + r() * (x1 - x0);
    const y = GROUND + 12 + r() * 30;
    if (y < bottom(x) - 4) {
      ellipse(g, x, y, 3, 2, '#8d8378');
      px(g, x - 1, y - 1, '#b3a99d');
    }
  }
}

function flowers(g, x0, x1, P, r, n) {
  if (!P.flower.length) return;
  for (let i = 0; i < n; i++) {
    const x = Math.round(x0 + r() * (x1 - x0));
    if (Math.abs(x - TX) < 70 || Math.abs(x - GARDEN_X) < 58) continue;
    const col = P.flower[Math.floor(r() * P.flower.length)];
    px(g, x, GROUND - 1, P.grass[1]);
    px(g, x, GROUND - 2, P.grass[1]);
    px(g, x, GROUND - 3, col);
    px(g, x - 1, GROUND - 3, col);
    px(g, x + 1, GROUND - 3, col);
    px(g, x, GROUND - 4, col);
    px(g, x, GROUND - 3, '#fde68a');
  }
}

function bush(g, x, P, s = 1) {
  const y = GROUND;
  disc(g, x, y - 6 * s, 9 * s, P.leaf[1]);
  disc(g, x + 10 * s, y - 4 * s, 7 * s, P.leaf[1]);
  disc(g, x - 9 * s, y - 3 * s, 6 * s, P.leaf[1]);
  disc(g, x - 2 * s, y - 9 * s, 6 * s, P.leaf[2]);
  disc(g, x + 8 * s, y - 7 * s, 4 * s, P.leaf[2]);
  px(g, x - 4 * s, y - 12 * s, P.leaf[3]);
  px(g, x - 3 * s, y - 12 * s, P.leaf[3]);
  if (P.snow) {
    rect(g, x - 7 * s, y - 15 * s, 12 * s, 3, '#ffffff');
    rect(g, x + 5 * s, y - 11 * s, 8 * s, 2, '#ffffff');
  }
  if (P.bloom) [[-4, -7], [5, -5], [1, -11], [-8, -2]].forEach(([dx, dy]) => px(g, x + dx * s, y + dy * s, P.bloom));
}

function rock(g, x, s = 1) {
  ellipse(g, x, GROUND - 3 * s, 8 * s, 5 * s, '#8d8378');
  ellipse(g, x - 2 * s, GROUND - 5 * s, 5 * s, 3 * s, '#a59b90');
  px(g, x - 4 * s, GROUND - 7 * s, '#c4bbb1');
}

function mushroom(g, x) {
  rect(g, x - 1, GROUND - 5, 3, 5, '#f5f0e6');
  ellipse(g, x, GROUND - 6, 5, 3, '#dc2626');
  px(g, x - 2, GROUND - 7, '#ffffff');
  px(g, x + 2, GROUND - 6, '#ffffff');
}

function fence(g, x0, n) {
  for (let i = 0; i < n; i++) {
    const x = x0 + i * 12;
    rect(g, x, GROUND - 16, 3, 16, WOOD[1]);
    rect(g, x, GROUND - 17, 3, 1, WOOD[2]);
  }
  rect(g, x0, GROUND - 13, (n - 1) * 12 + 3, 2, WOOD[2]);
  rect(g, x0, GROUND - 7, (n - 1) * 12 + 3, 2, WOOD[2]);
}

function mailbox(g, x) {
  rect(g, x, GROUND - 22, 2, 22, WOOD[0]);
  rect(g, x - 5, GROUND - 30, 12, 8, '#2563eb');
  rect(g, x - 5, GROUND - 31, 12, 1, '#3b82f6');
  rect(g, x + 7, GROUND - 34, 1, 7, '#1f2937');
  rect(g, x + 7, GROUND - 34, 4, 3, '#ef4444');
}

function lampPost(g, x, lights) {
  rect(g, x, GROUND - 40, 2, 40, '#374151');
  rect(g, x - 2, GROUND - 2, 6, 2, '#1f2937');
  rect(g, x - 3, GROUND - 48, 8, 8, '#1f2937');
  rect(g, x - 2, GROUND - 47, 6, 6, '#fde68a');
  rect(g, x - 4, GROUND - 49, 10, 2, '#111827');
  lights.push({ x: x + 1, y: GROUND - 44, r: 3, glow: 26 });
}

/* ---------------- canteiro (mini horta) ---------------- */
function drawGardenBeds(g, P) {
  const x0 = GARDEN_X0;
  const total = 4 * GARDEN_BED_W + 3 * GARDEN_GAP;
  // cerquinha baixa atrás
  for (let x = x0 - 8; x <= x0 + total + 8; x += 7) {
    rect(g, x, GROUND - 14, 2, 14, WOOD[1]);
    px(g, x, GROUND - 15, WOOD[2]);
  }
  rect(g, x0 - 8, GROUND - 11, total + 18, 1, WOOD[2]);
  // canteiros de madeira com terra
  for (let i = 0; i < 4; i++) {
    const x = x0 + i * (GARDEN_BED_W + GARDEN_GAP);
    rect(g, x, GROUND - 6, GARDEN_BED_W, 6, WOOD[1]);
    rect(g, x, GROUND - 6, GARDEN_BED_W, 1, WOOD[3]);
    rect(g, x + 1, GROUND - 5, GARDEN_BED_W - 2, 2, '#5b3a1e');
    px(g, x + 3, GROUND - 5, '#7a4f2a');
    px(g, x + 9, GROUND - 4, '#7a4f2a');
    rect(g, x, GROUND - 1, GARDEN_BED_W, 1, WOOD[0]);
  }
  // plaquinha com uma cenoura
  const sx = x0 + total + 12;
  rect(g, sx, GROUND - 16, 2, 16, WOOD[0]);
  rect(g, sx - 6, GROUND - 24, 14, 10, WOOD[2]);
  rect(g, sx - 5, GROUND - 23, 12, 8, WOOD[3]);
  [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [1, 2]].forEach(([dx, dy]) => px(g, sx - 1 + dx, GROUND - 20 + dy, '#f97316'));
  px(g, sx, GROUND - 21, '#22c55e');
  px(g, sx + 1, GROUND - 22, '#22c55e');
  px(g, sx - 1, GROUND - 22, '#22c55e');
  // regador
  const wx = x0 - 18;
  rect(g, wx, GROUND - 7, 8, 7, '#7c8b99');
  rect(g, wx, GROUND - 7, 8, 1, '#a9b6c2');
  rect(g, wx + 8, GROUND - 6, 3, 1, '#7c8b99');
  rect(g, wx + 10, GROUND - 8, 2, 2, '#7c8b99');
  rect(g, wx - 2, GROUND - 6, 2, 4, '#5d6b78');
  rect(g, wx + 1, GROUND - 10, 6, 1, '#5d6b78');
  if (P.snow) rect(g, x0 - 8, GROUND - 16, total + 18, 1, '#ffffff');
}

// plantas do canteiro (mudam com o tempo: desenhadas a cada quadro)
// beds[i] = { crop, stage 0..3, wet }
export function drawGardenPlants(g, ox, beds, t) {
  beds.forEach((b, i) => {
    const x = GARDEN_X0 + i * (GARDEN_BED_W + GARDEN_GAP) + ox;
    if (!b) return;
    if (b.wet) {
      rect(g, x + 1, GROUND - 5, GARDEN_BED_W - 2, 2, '#3a2412');
      if (Math.sin(t * 3 + i) > 0.7) px(g, x + 4 + i, GROUND - 5, '#93c5fd');
    }
    const carrot = b.crop === 'cenoura';
    const leaf = carrot ? '#4ade80' : '#15803d';
    const leafD = carrot ? '#16a34a' : '#14532d';
    const cols = [x + 3, x + 7, x + 11];
    cols.forEach((c, k) => {
      if (b.stage === 0) {
        px(g, c, GROUND - 5, '#3b2412');
        px(g, c - 1, GROUND - 4, '#c4a072');
        return;
      }
      const h = b.stage === 1 ? 2 : b.stage === 2 ? 5 : 7;
      const sway = Math.sin(t * 2 + i + k) > 0.6 ? 1 : 0;
      for (let y = 0; y < h; y++) px(g, c + (y > h / 2 ? sway : 0), GROUND - 6 - y, y % 2 ? leaf : leafD);
      if (b.stage >= 2) {
        if (carrot) {
          px(g, c - 1, GROUND - 6 - h + 1, leaf);
          px(g, c + 1, GROUND - 6 - h + 2, leaf);
          px(g, c - 1 + sway, GROUND - 6 - h + 3, leafD);
        } else {
          rect(g, c - 2, GROUND - 6 - h + 1, 2, 2, leaf);
          rect(g, c + 1, GROUND - 6 - h + 2, 2, 2, leaf);
          px(g, c, GROUND - 6 - h + 3, '#9d174d');
        }
      }
      if (b.stage === 3) {
        // a raiz aparecendo na terra
        rect(g, c - 1, GROUND - 6, 3, 2, carrot ? '#f97316' : '#be185d');
        px(g, c, GROUND - 4, carrot ? '#ea580c' : '#9d174d');
        if (Math.sin(t * 4 + i * 2 + k) > 0.85) px(g, c + 2, GROUND - 10 - h, '#fef08a');
      }
    });
  });
}

/* ---------------- a Árvore-casa gigante ---------------- */
const trunkHalf = (y) => {
  // larga embaixo, afina subindo e alarga um pouco ao abrir os galhos
  if (y > 176) return 104 + ((y - 176) / 20) ** 2 * 46;
  if (y > 70) return 92 + ((y - 70) / 106) * 12;
  return 92 + ((70 - y) / 70) * 18;
};

function drawTree(g, P, lights) {
  const r = rng(99);
  // raízes saindo do chão
  [
    [-150, 10, 34, 7],
    [-122, 6, 26, 9],
    [128, 8, 30, 8],
    [158, 12, 26, 6],
    [-176, 14, 18, 4],
    [186, 14, 16, 4]
  ].forEach(([dx, dy, rx, ry]) => {
    ellipse(g, TX + dx, GROUND - 2 + dy * 0.2, rx, ry, BARK[2]);
    ellipse(g, TX + dx - 2, GROUND - 4 + dy * 0.2, rx - 6, Math.max(2, ry - 3), BARK[3]);
  });
  // tronco
  for (let y = -10; y < GROUND + 2; y++) {
    const hw = Math.round(trunkHalf(y));
    for (let x = -hw; x <= hw; x++) {
      const u = (x + hw) / (2 * hw);
      const col = u < 0.06 ? BARK[0] : u < 0.18 ? BARK[1] : u < 0.36 ? BARK[3] : u < 0.48 ? BARK[4] : u < 0.8 ? BARK[3] : u < 0.93 ? BARK[2] : BARK[1];
      px(g, TX + x, y, col);
    }
  }
  // sulcos da casca
  for (let i = 0; i < 34; i++) {
    const u = r();
    let y = -10 + r() * 180;
    const len = 18 + r() * 50;
    let wob = 0;
    for (let k = 0; k < len && y < GROUND; k++, y++) {
      const hw = trunkHalf(y);
      wob += (r() - 0.5) * 0.6;
      const x = TX - hw + 6 + u * (2 * hw - 12) + wob;
      px(g, x, y, BARK[0]);
      if (r() < 0.3) px(g, x + 1, y, BARK[1]);
    }
  }
  // nós da madeira
  [[TX - 60, 166], [TX + 70, 30], [TX - 30, 12], [TX + 52, 176]].forEach(([x, y]) => {
    ellipse(g, x, y, 5, 4, BARK[1]);
    ellipse(g, x, y, 3, 2, BARK[0]);
    px(g, x - 1, y - 1, BARK[4]);
  });

  // galhões indo para a copa
  stroke(g, [[TX - 70, 40], [TX - 170, 6], [TX - 290, -8]], 16, 7, BARK[2]);
  stroke(g, [[TX - 72, 36], [TX - 170, 2], [TX - 288, -12]], 10, 4, BARK[3]);
  stroke(g, [[TX + 70, 30], [TX + 190, 0], [TX + 320, 2]], 15, 6, BARK[2]);
  stroke(g, [[TX + 72, 26], [TX + 190, -4], [TX + 318, -2]], 9, 3, BARK[3]);

  // copa gigante (vai além do topo da tela)
  const blobs = [];
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    const x = TX - 470 + t * 940 + (r() - 0.5) * 40;
    const edge = Math.abs(t - 0.5) * 2;
    const y = -24 + edge * edge * 60 + r() * 22;
    const rad = 46 + r() * 26 - edge * 14;
    blobs.push([x, y, rad]);
  }
  blobs.forEach(([x, y, rr]) => disc(g, x, y + 7, rr, P.leaf[0]));
  blobs.forEach(([x, y, rr]) => disc(g, x, y, rr - 3, P.leaf[1]));
  blobs.forEach(([x, y, rr]) => disc(g, x - rr * 0.22, y - rr * 0.25, rr * 0.55, P.leaf[2]));
  // brilhos e textura de folhas
  for (let i = 0; i < 700; i++) {
    const b = blobs[Math.floor(r() * blobs.length)];
    const a = r() * Math.PI * 2;
    const d = r() * b[2] * 0.9;
    const x = b[0] + Math.cos(a) * d;
    const y = b[1] + Math.sin(a) * d;
    const v = r();
    if (v < 0.35) px(g, x, y, P.leaf[3]);
    else if (v < 0.6) px(g, x, y, P.leaf[0]);
    else if (P.bloom && v < 0.75) {
      px(g, x, y, P.bloom);
      px(g, x + 1, y, P.bloom);
    }
  }
  // franjinha de folhas embaixo
  blobs.forEach(([x, y, rr]) => {
    for (let k = -rr; k < rr; k += 5 + Math.floor(r() * 5)) {
      const by = y + 7 + Math.sqrt(Math.max(0, rr * rr - k * k));
      rect(g, x + k, by, 2, 2 + Math.floor(r() * 3), P.leaf[0]);
    }
  });
  if (P.snow) {
    blobs.forEach(([x, y, rr]) => {
      for (let k = -rr * 0.8; k < rr * 0.8; k++) {
        const ty = y - Math.sqrt(Math.max(0, rr * rr * 0.92 - k * k));
        rect(g, x + k, ty, 1, 3 + (Math.abs(k) % 3 === 0 ? 1 : 0), '#f4f9fc');
      }
    });
  }

  // varanda do lado direito (dá para andar nela, entrando pela porta de cima)
  const [d0, d1] = DECK;
  rect(g, d0, DECK_Y, d1 - d0, 5, WOOD[1]);
  rect(g, d0, DECK_Y, d1 - d0, 1, WOOD[3]);
  for (let x = d0 + 3; x < d1; x += 9) rect(g, x, DECK_Y + 1, 1, 4, WOOD[0]);
  for (let k = d0 + 44; k <= d1 - 4; k += 8) rect(g, k, DECK_Y - 16, 2, 16, WOOD[2]);
  rect(g, d0 + 42, DECK_Y - 17, d1 - d0 - 42, 2, WOOD[2]);
  rect(g, d1 - 4, DECK_Y - 17, 4, 17, WOOD[1]);
  // mão-francesa por baixo
  for (let k = 0; k < 22; k++) rect(g, d0 + 70 + k, DECK_Y + 5 + k, 3, 2, WOOD[0]);
  // vasinho na varanda
  rect(g, d1 - 16, DECK_Y - 8, 8, 8, '#c2410c');
  disc(g, d1 - 12, DECK_Y - 11, 4, P.leaf[2]);
  // porta de cima (da casa para a varanda)
  {
    const cx = BALCONY_DOOR;
    const w = 10;
    const top = DECK_Y - 36;
    for (let y = top - 2; y < DECK_Y; y++) {
      const ar = y < top + w ? Math.round(Math.sqrt(Math.max(0, (w + 2) ** 2 - (top + w - y) ** 2))) : w + 2;
      rect(g, cx - ar, y, ar * 2 + 1, 1, WOOD[0]);
    }
    for (let y = top; y < DECK_Y; y++) {
      const ar = y < top + w ? Math.round(Math.sqrt(Math.max(0, w ** 2 - (top + w - y) ** 2))) : w;
      for (let x = -ar; x <= ar; x++) px(g, cx + x, y, (x + w) % 6 === 0 ? WOOD[1] : WOOD[3]);
    }
    disc(g, cx + 6, DECK_Y - 16, 1, '#facc15');
  }

  // janelas (de dia: vidro; de noite acendem)
  const winRound = (x, y, rr) => {
    disc(g, x, y, rr + 3, WOOD[0]);
    disc(g, x, y, rr + 1, WOOD[1]);
    disc(g, x, y, rr, '#28405e');
    disc(g, x - 2, y - 2, rr - 3, '#3b5f86');
    px(g, x - rr + 3, y - 2, '#9cc9f0');
    px(g, x - rr + 4, y - 3, '#9cc9f0');
    rect(g, x - rr, y, rr * 2 + 1, 1, WOOD[0]);
    rect(g, x, y - rr, 1, rr * 2 + 1, WOOD[0]);
    lights.push({ x, y, r: rr, round: true, glow: rr + 12 });
  };
  winRound(TX - 56, 118, 12);
  winRound(TX + 14, 52, 9);
  // janela quadrada com floreira
  const wx = TX + 40;
  const wy = 128;
  rect(g, wx - 3, wy - 3, 28, 30, WOOD[0]);
  rect(g, wx - 1, wy - 1, 24, 26, WOOD[1]);
  rect(g, wx, wy, 22, 24, '#28405e');
  rect(g, wx + 1, wy + 1, 9, 10, '#3b5f86');
  rect(g, wx + 11, wy, 1, 24, WOOD[0]);
  rect(g, wx, wy + 11, 22, 1, WOOD[0]);
  px(g, wx + 2, wy + 2, '#9cc9f0');
  px(g, wx + 3, wy + 2, '#9cc9f0');
  lights.push({ x: wx, y: wy, w: 22, h: 24, glow: 20 });
  rect(g, wx - 4, wy + 25, 30, 4, WOOD[2]);
  for (let k = 0; k < 6; k++) disc(g, wx - 1 + k * 5, wy + 23, 2, P.flower[k % Math.max(1, P.flower.length)] || P.leaf[2]);

  // porta em arco
  const dw = 20;
  const dTop = GROUND - 50;
  for (let y = dTop - 3; y < GROUND; y++) {
    const ar = y < dTop + dw ? Math.round(Math.sqrt(Math.max(0, (dw + 3) ** 2 - (dTop + dw - y) ** 2))) : dw + 3;
    rect(g, TX - ar, y, ar * 2 + 1, 1, WOOD[0]);
  }
  for (let y = dTop; y < GROUND; y++) {
    const ar = y < dTop + dw ? Math.round(Math.sqrt(Math.max(0, dw ** 2 - (dTop + dw - y) ** 2))) : dw;
    for (let x = -ar; x <= ar; x++) {
      const seam = (x + dw) % 7 === 0;
      px(g, TX + x, y, seam ? WOOD[1] : x < -ar + 3 ? WOOD[2] : WOOD[3]);
    }
  }
  rect(g, TX - dw, GROUND - 36, dw * 2 + 1, 2, WOOD[0]);
  rect(g, TX - dw, GROUND - 14, dw * 2 + 1, 2, WOOD[0]);
  disc(g, TX + 11, GROUND - 24, 2, '#facc15');
  px(g, TX + 10, GROUND - 25, '#fef08a');
  // janelinha da porta
  disc(g, TX, dTop + 10, 4, WOOD[0]);
  disc(g, TX, dTop + 10, 3, '#28405e');
  lights.push({ x: TX, y: dTop + 10, r: 3, round: true, glow: 8 });
  // degrau de pedra
  rect(g, TX - 28, GROUND, 57, 3, '#9ca3af');
  rect(g, TX - 28, GROUND, 57, 1, '#d1d5db');
  rect(g, TX - 24, GROUND + 3, 49, 2, '#6b7280');
  // lanterna pendurada ao lado da porta
  const lx = TX - 38;
  rect(g, lx, GROUND - 66, 10, 2, '#1f2937');
  rect(g, lx + 8, GROUND - 66, 2, 6, '#1f2937');
  rect(g, lx + 5, GROUND - 60, 8, 9, '#1f2937');
  rect(g, lx + 6, GROUND - 59, 6, 7, '#fde68a');
  lights.push({ x: lx + 9, y: GROUND - 55, r: 3, glow: 30 });
  // plaquinha com coração
  rect(g, TX + 32, GROUND - 44, 20, 13, WOOD[1]);
  rect(g, TX + 33, GROUND - 43, 18, 11, WOOD[2]);
  [[39, -40], [40, -40], [43, -40], [44, -40], [38, -39], [39, -39], [40, -39], [41, -39], [42, -39], [43, -39], [44, -39], [45, -39], [39, -38], [40, -38], [41, -38], [42, -38], [43, -38], [44, -38], [40, -37], [41, -37], [42, -37], [43, -37], [41, -36], [42, -36]].forEach(([x, y]) =>
    px(g, TX + x, GROUND + y, '#e11d48')
  );
  rect(g, TX + 41, GROUND - 31, 2, 31, WOOD[0]);
}

/* ---------------- praia ---------------- */
function palm(g, x, P) {
  const pts = [];
  for (let k = 0; k <= 10; k++) pts.push([x + Math.sin(k / 10 * 1.4) * 26, GROUND - k * 9]);
  pts.forEach(([px0, py0], k) => {
    rect(g, px0 - 4, py0 - 9, 8, 9, k % 2 ? '#a67c52' : '#8b6340');
    rect(g, px0 - 4, py0 - 9, 2, 9, '#6b4a2f');
  });
  const [tx, ty] = pts[pts.length - 1];
  const leaf = (dx, dy, len) => {
    for (let k = 0; k < len; k++) {
      const t = k / len;
      const xx = tx + dx * k;
      const yy = ty - 6 + dy * k + t * t * 18;
      rect(g, xx - 2, yy - 1, 5, 3, P.leaf[1]);
      px(g, xx, yy - 1, P.leaf[3]);
    }
  };
  leaf(-1.4, -0.6, 26);
  leaf(1.4, -0.6, 26);
  leaf(-1.1, -0.2, 20);
  leaf(1.1, -0.2, 20);
  leaf(0.3, -0.9, 14);
  disc(g, tx - 3, ty - 2, 3, '#5b3a1f');
  disc(g, tx + 3, ty - 1, 3, '#5b3a1f');
}

/* ---------------- monta o mundo de fora ---------------- */
export function buildWorld(kind, season) {
  const P = PAL[season];
  const { c, g } = mk(OUT_W, VB + PAD);
  g.translate(0, PAD);
  const r = rng(5);
  const lights = [];
  const sc = SCENES[kind];

  if (kind === 'ilha') {
    const [a, b] = sc.island;
    const mid = (a + b) / 2;
    const half = (b - a) / 2;
    const bottom = (x) => {
      const t = (x - mid) / half;
      return GROUND + Math.round(110 * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - Math.abs(t) * 0.25));
    };
    // rocha da ilha
    for (let x = a; x < b; x++) {
      const bt = bottom(x);
      for (let y = GROUND + 6; y < bt; y++) {
        const t = (y - GROUND) / 110;
        const v = r();
        px(g, x, y, v < 0.06 ? '#a0805e' : t > 0.6 ? '#5d4330' : t > 0.3 ? '#6f5038' : '#7a5a3e');
      }
    }
    groundStrip(g, a, b, P, r, (x) => Math.min(bottom(x), GROUND + 6));
    // cipós e raízes pendurados
    for (let i = 0; i < 22; i++) {
      const x = a + 20 + r() * (b - a - 40);
      const len = 10 + r() * 30;
      const bt = bottom(x);
      for (let k = 0; k < len; k++) px(g, x + Math.sin(k * 0.3) * 1.2, bt - 2 + k, i % 3 ? P.leaf[1] : BARK[2]);
    }
    flowers(g, a + 10, b - 10, P, r, 60);
    [[a + 60, 1], [b - 70, 1.1]].forEach(([x, s]) => bush(g, x, P, s));
    rock(g, a + 150, 1.1);
    rock(g, b - 160, 0.8);
    mushroom(g, TX - 230);
    mushroom(g, TX - 222);
    fence(g, b - 34, 3);
    fence(g, a + 4, 3);
    lampPost(g, TX + 180, lights);
    drawGardenBeds(g, P);
  } else {
    const end = kind === 'praia' ? sc.sand : OUT_W;
    groundStrip(g, 0, end, P, r);
    if (kind === 'praia') {
      // areia
      for (let x = sc.sand - 20; x < OUT_W; x++) {
        const blend = x < sc.sand;
        for (let y = GROUND; y < VB; y++) {
          if (blend && r() < (sc.sand - x) / 20) continue;
          const v = r();
          px(g, x, y, v < 0.08 ? '#d9b874' : v < 0.12 ? '#fff1c7' : '#f0d595');
        }
        if (!blend && r() < 0.1) px(g, x, GROUND - 1, '#f0d595');
      }
      // mar (parte fixa; as ondas mexem no quadro)
      for (let x = sc.sea; x < OUT_W; x++) {
        const shore = Math.min(1, (x - sc.sea) / 40);
        const top = GROUND + 6 - Math.round(shore * 4);
        rect(g, x, top, 1, VB - top, shore < 0.5 ? '#5ab8de' : '#2f8fcf');
        if (r() < 0.06) px(g, x, top + 4 + r() * 30, '#8fd3f0');
      }
      palm(g, sc.sand + 90, P);
      palm(g, sc.sand + 190, P);
      // conchas e estrela-do-mar
      [[sc.sand + 40, '#fbcfe8'], [sc.sand + 140, '#fde68a'], [sc.sand + 230, '#fecaca']].forEach(([x, col]) => {
        rect(g, x, GROUND + 6, 3, 2, col);
        px(g, x + 1, GROUND + 5, col);
      });
      const sx = sc.sand + 110;
      [[0, 0], [1, 0], [-1, 0], [0, -1], [0, 1], [2, 0], [-2, 0], [0, 2]].forEach(([dx, dy]) => px(g, sx + dx, GROUND + 14 + dy, '#fb923c'));
    }
    const rightEnd = kind === 'praia' ? sc.sand - 30 : OUT_W - 40;
    flowers(g, 40, rightEnd, P, r, 150);
    for (let i = 0; i < 12; i++) {
      const x = 60 + r() * (rightEnd - 120);
      if (Math.abs(x - TX) < 260 || Math.abs(x - GARDEN_X) < 80) continue;
      bush(g, x, P, 0.8 + r() * 0.5);
    }
    for (let i = 0; i < 7; i++) {
      const x = 80 + r() * (rightEnd - 160);
      if (Math.abs(x - TX) < 240 || Math.abs(x - GARDEN_X) < 70) continue;
      rock(g, x, 0.7 + r() * 0.6);
    }
    mushroom(g, TX - 240);
    mushroom(g, TX - 232);
    mushroom(g, TX + 262);
    fence(g, TX - 420, 6);
    drawGardenBeds(g, P);
    lampPost(g, TX + 330, lights);
    // árvores menores nas pontas (o mundo "acaba" nelas)
    [60, ...(kind === 'praia' ? [] : [OUT_W - 60])].forEach((x) => {
      rect(g, x - 6, GROUND - 70, 12, 70, BARK[2]);
      rect(g, x - 6, GROUND - 70, 3, 70, BARK[1]);
      disc(g, x, GROUND - 84, 30, P.leaf[1]);
      disc(g, x - 8, GROUND - 92, 18, P.leaf[2]);
      if (P.snow) rect(g, x - 20, GROUND - 114, 34, 3, '#ffffff');
    });
  }
  mailbox(g, TX + 150);
  drawTree(g, P, lights);
  return { c, lights };
}

/* ---------------- dentro do tronco ---------------- */
// largura da sala em cada altura (o teto é arredondado como o tronco)
export const roomEdge = (y) => {
  const L = 22;
  if (y > 70) return [L, IN_W - L];
  const d = Math.round(((70 - y) / 50) ** 2 * 120);
  return [L + d, IN_W - L - d];
};

export function buildInterior(season) {
  const P = PAL[season];
  const { c, g } = mk(IN_W, VB);
  const r = rng(77);
  const lights = [];
  rect(g, 0, 0, IN_W, VB, BARK[0]);
  // parede de madeira com anéis
  for (let y = 20; y < FLOOR1; y++) {
    const [a, b] = roomEdge(y);
    if (a >= b) continue;
    for (let x = a; x < b; x++) {
      const d = Math.hypot((x - IN_W / 2) * 0.8, (y - 130) * 1.1);
      const ring = Math.round(d) % 14 === 0;
      const plank = (x - 22) % 26 === 0;
      px(g, x, y, ring ? '#c99258' : plank ? '#a56c3b' : '#b67a45');
    }
    rect(g, a - 3, y, 3, 1, BARK[1]);
    rect(g, b, y, 3, 1, BARK[1]);
  }
  // borda do teto
  for (let x = 0; x < IN_W; x++) {
    for (let y = 20; y < 70; y++) {
      const [a, b] = roomEdge(y);
      if (x >= a && x < b) {
        rect(g, x, y - 3, 1, 3, BARK[1]);
        break;
      }
    }
  }
  // chão do 1º andar
  rect(g, 0, FLOOR1, IN_W, VB - FLOOR1, WOOD[1]);
  rect(g, 0, FLOOR1, IN_W, 1, WOOD[3]);
  for (let x = 6; x < IN_W; x += 18) rect(g, x, FLOOR1 + 1, 1, VB - FLOOR1, WOOD[0]);
  for (let y = FLOOR1 + 9; y < VB; y += 9) rect(g, 0, y, IN_W, 1, shade(WOOD[1], -0.15));
  // piso do 2º andar (com o buraco da escada)
  const holeA = LADDER_X - 16;
  const holeB = LADDER_X + 16;
  const [fa, fb] = roomEdge(FLOOR2);
  for (let x = fa; x < fb; x++) {
    if (x >= holeA && x < holeB) continue;
    rect(g, x, FLOOR2, 1, 8, (x - fa) % 18 === 0 ? WOOD[0] : WOOD[1]);
    px(g, x, FLOOR2, WOOD[3]);
    rect(g, x, FLOOR2 + 8, 1, 2, BARK[1]);
  }
  // mãos-francesas
  [[fa, 1], [fb - 1, -1]].forEach(([x, dir]) => {
    for (let k = 0; k < 14; k++) rect(g, x + dir * k, FLOOR2 + 9 + k, 3 * dir, 2, WOOD[0]);
  });
  // corrimão em volta do buraco
  rect(g, holeA - 2, FLOOR2 - 18, 2, 18, WOOD[0]);
  rect(g, holeB, FLOOR2 - 18, 2, 18, WOOD[0]);
  // escada
  rect(g, LADDER_X - 11, FLOOR2 - 20, 3, FLOOR1 - FLOOR2 + 20, WOOD[0]);
  rect(g, LADDER_X + 9, FLOOR2 - 20, 3, FLOOR1 - FLOOR2 + 20, WOOD[0]);
  for (let y = FLOOR2 - 16; y < FLOOR1; y += 9) rect(g, LADDER_X - 8, y, 17, 2, WOOD[2]);

  /* ---- 1º andar ---- */
  // porta de saída
  const dx = 50;
  const dw = 15;
  const dTop = FLOOR1 - 46;
  for (let y = dTop - 3; y < FLOOR1; y++) {
    const ar = y < dTop + dw ? Math.round(Math.sqrt(Math.max(0, (dw + 3) ** 2 - (dTop + dw - y) ** 2))) : dw + 3;
    rect(g, dx - ar, y, ar * 2 + 1, 1, WOOD[0]);
  }
  for (let y = dTop; y < FLOOR1; y++) {
    const ar = y < dTop + dw ? Math.round(Math.sqrt(Math.max(0, dw ** 2 - (dTop + dw - y) ** 2))) : dw;
    for (let x = -ar; x <= ar; x++) px(g, dx + x, y, (x + dw) % 6 === 0 ? WOOD[1] : WOOD[2]);
  }
  disc(g, dx + 9, FLOOR1 - 22, 2, '#facc15');
  // tapete
  ellipse(g, 236, FLOOR1 + 2, 62, 3, '#991b1b');
  ellipse(g, 236, FLOOR1 + 2, 56, 2, '#b91c1c');
  for (let x = 186; x < 288; x += 8) px(g, x, FLOOR1 + 2, '#facc15');
  // mesa com caneca
  rect(g, 186, FLOOR1 - 24, 56, 4, WOOD[2]);
  rect(g, 186, FLOOR1 - 24, 56, 1, WOOD[3]);
  rect(g, 190, FLOOR1 - 20, 3, 20, WOOD[0]);
  rect(g, 235, FLOOR1 - 20, 3, 20, WOOD[0]);
  rect(g, 200, FLOOR1 - 31, 6, 7, '#e5e7eb');
  rect(g, 206, FLOOR1 - 29, 2, 3, '#e5e7eb');
  rect(g, 201, FLOOR1 - 30, 4, 1, '#7c2d12');
  // vaso com planta na mesa
  rect(g, 224, FLOOR1 - 30, 6, 6, '#c2410c');
  disc(g, 227, FLOOR1 - 34, 4, P.leaf[2]);
  // banquinho
  rect(g, 250, FLOOR1 - 13, 16, 3, WOOD[2]);
  rect(g, 252, FLOOR1 - 10, 2, 10, WOOD[0]);
  rect(g, 262, FLOOR1 - 10, 2, 10, WOOD[0]);
  // baú do personagem
  const cx0 = 288;
  rect(g, cx0, FLOOR1 - 24, 40, 24, '#8b5a2b');
  rect(g, cx0, FLOOR1 - 28, 40, 6, '#a0692f');
  rect(g, cx0, FLOOR1 - 28, 40, 1, '#c08040');
  rect(g, cx0, FLOOR1 - 22, 40, 2, '#4b2e14');
  [cx0 + 6, cx0 + 32].forEach((x) => rect(g, x, FLOOR1 - 28, 3, 28, '#4b2e14'));
  [[cx0, FLOOR1 - 28], [cx0 + 37, FLOOR1 - 28], [cx0, FLOOR1 - 3], [cx0 + 37, FLOOR1 - 3]].forEach(([x, y]) => rect(g, x, y, 3, 3, '#d4a017'));
  rect(g, cx0 + 17, FLOOR1 - 22, 6, 7, '#facc15');
  rect(g, cx0 + 19, FLOOR1 - 19, 2, 2, '#4b2e14');
  // relógio de pêndulo (o pêndulo mexe no quadro)
  const kx = 344;
  rect(g, kx, FLOOR1 - 66, 20, 66, '#6b3f1f');
  rect(g, kx - 1, FLOOR1 - 68, 22, 3, '#4b2e14');
  rect(g, kx + 1, FLOOR1 - 66, 2, 66, '#7c4a26');
  disc(g, kx + 10, FLOOR1 - 55, 7, '#fef3c7');
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    px(g, kx + 10 + Math.cos(a) * 6, FLOOR1 - 55 + Math.sin(a) * 6, '#78350f');
  }
  rect(g, kx + 4, FLOOR1 - 44, 12, 34, '#2a1a0c');
  // luminária pendurada embaixo do 2º andar
  rect(g, 250, FLOOR2 + 10, 1, 18, '#1f2937');
  rect(g, 245, FLOOR2 + 28, 11, 5, '#1f2937');
  rect(g, 246, FLOOR2 + 33, 9, 2, '#fde68a');
  lights.push({ x: 250, y: FLOOR2 + 34, r: 2, glow: 48 });
  // quadrinho na parede
  rect(g, 382, 150, 26, 20, WOOD[0]);
  rect(g, 384, 152, 22, 16, '#bae6fd');
  rect(g, 384, 162, 22, 6, P.grass[0]);
  rect(g, 394, 156, 2, 7, BARK[2]);
  disc(g, 395, 156, 4, P.leaf[2]);

  /* ---- 2º andar ---- */
  // estante de livros
  const sx = 52;
  rect(g, sx, FLOOR2 - 76, 56, 76, WOOD[0]);
  rect(g, sx + 3, FLOOR2 - 73, 50, 70, '#3b2412');
  const BOOK = ['#dc2626', '#2563eb', '#16a34a', '#ca8a04', '#7c3aed', '#db2777', '#0891b2', '#ea580c'];
  for (let row = 0; row < 4; row++) {
    const base = FLOOR2 - 73 + (row + 1) * 17.5;
    rect(g, sx + 3, base, 50, 2, WOOD[1]);
    let x = sx + 4;
    while (x < sx + 50) {
      const w = 3 + Math.floor(r() * 3);
      const h = 10 + Math.floor(r() * 5);
      if (x + w > sx + 52) break;
      const col = BOOK[Math.floor(r() * BOOK.length)];
      if (r() < 0.12) {
        x += w;
        continue;
      }
      rect(g, x, base - h, w, h, col);
      rect(g, x, base - h + 2, w, 1, shade(col, 0.4));
      x += w + (r() < 0.2 ? 1 : 0);
    }
  }
  // cama
  const bx = 178;
  rect(g, bx, FLOOR2 - 30, 6, 30, WOOD[0]);
  rect(g, bx + 66, FLOOR2 - 20, 6, 20, WOOD[0]);
  rect(g, bx + 4, FLOOR2 - 16, 64, 10, '#7a4a22');
  rect(g, bx + 6, FLOOR2 - 20, 60, 5, '#f3f4f6');
  rect(g, bx + 8, FLOOR2 - 26, 14, 6, '#ffffff');
  rect(g, bx + 8, FLOOR2 - 21, 14, 1, '#d1d5db');
  rect(g, bx + 22, FLOOR2 - 22, 46, 8, '#3b82f6');
  for (let x = bx + 24; x < bx + 66; x += 6) rect(g, x, FLOOR2 - 20, 3, 3, '#93c5fd');
  rect(g, bx + 22, FLOOR2 - 22, 46, 1, '#60a5fa');
  // vaso de planta
  rect(g, 268, FLOOR2 - 12, 10, 12, '#c2410c');
  rect(g, 267, FLOOR2 - 13, 12, 2, '#ea580c');
  disc(g, 273, FLOOR2 - 20, 7, P.leaf[1]);
  disc(g, 270, FLOOR2 - 24, 4, P.leaf[2]);
  // mesinha com vela
  rect(g, 336, FLOOR2 - 16, 20, 3, WOOD[2]);
  rect(g, 338, FLOOR2 - 13, 2, 13, WOOD[0]);
  rect(g, 352, FLOOR2 - 13, 2, 13, WOOD[0]);
  rect(g, 344, FLOOR2 - 23, 4, 7, '#fef3c7');
  px(g, 346, FLOOR2 - 25, '#f59e0b');
  px(g, 346, FLOOR2 - 26, '#fde047');
  lights.push({ x: 346, y: FLOOR2 - 25, r: 1, glow: 22 });
  // porta da varanda (parede direita do 2º andar)
  {
    const cx = 404;
    const w = 11;
    const top = FLOOR2 - 38;
    for (let y = top - 2; y < FLOOR2; y++) {
      const ar = y < top + w ? Math.round(Math.sqrt(Math.max(0, (w + 2) ** 2 - (top + w - y) ** 2))) : w + 2;
      rect(g, cx - ar, y, ar * 2 + 1, 1, WOOD[0]);
    }
    for (let y = top; y < FLOOR2; y++) {
      const ar = y < top + w ? Math.round(Math.sqrt(Math.max(0, w ** 2 - (top + w - y) ** 2))) : w;
      for (let x = -ar; x <= ar; x++) px(g, cx + x, y, (x + w) % 6 === 0 ? WOOD[1] : WOOD[2]);
    }
    disc(g, cx - 6, FLOOR2 - 18, 1, '#facc15');
  }
  // janela redonda (o céu dela muda de dia/noite)
  const win = { x: 314, y: FLOOR2 - 50, r: 14 };
  disc(g, win.x, win.y, win.r + 4, WOOD[0]);
  disc(g, win.x, win.y, win.r + 2, WOOD[2]);
  // lanterna no teto
  rect(g, 220, 30, 1, 22, '#1f2937');
  rect(g, 215, 52, 11, 9, '#1f2937');
  rect(g, 216, 53, 9, 7, '#fde68a');
  lights.push({ x: 220, y: 56, r: 4, glow: 52 });
  return { c, lights, win };
}

// janela do 2º andar (desenhada a cada quadro)
export function drawRoomWindow(g, win, ox, night, t) {
  const { x, y, r } = win;
  disc(g, x + ox, y, r, night ? '#16204a' : '#7cc8ff');
  if (night) {
    [[-6, -5], [4, -8], [7, 3], [-3, 6], [-9, 1]].forEach(([dx, dy], i) => {
      if (Math.sin(t * 2 + i) > -0.3) px(g, x + ox + dx, y + dy, '#ffffff');
    });
    disc(g, x + ox + 4, y - 3, 4, '#fef9c3');
    disc(g, x + ox + 6, y - 4, 3, '#16204a');
  } else {
    disc(g, x + ox - 4, y + 2, 4, '#ffffff');
    disc(g, x + ox + 1, y + 1, 5, '#ffffff');
    disc(g, x + ox - 6, y - 7, 3, '#fff7c2');
  }
  rect(g, x + ox - r, y, r * 2 + 1, 1, WOOD[0]);
  rect(g, x + ox, y - r, 1, r * 2 + 1, WOOD[0]);
}

// pêndulo do relógio
export function drawPendulum(g, ox, t) {
  const kx = 344 + ox;
  const a = Math.sin(t * 3.2) * 0.35;
  const top = FLOOR1 - 44;
  for (let k = 0; k < 24; k++) px(g, kx + 10 + Math.sin(a) * k, top + Math.cos(a) * k, '#d4a017');
  disc(g, kx + 10 + Math.sin(a) * 26, top + Math.cos(a) * 26, 3, '#facc15');
}

// luzes de noite: o mundo escurece e as janelas/lanternas acendem
export function drawNight(g, cw, lights, ox, inside, top = 0) {
  g.save();
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = inside ? '#8a80b8' : '#5866a8';
  g.fillRect(0, -top, cw, VB + top);
  g.globalCompositeOperation = 'lighter';
  lights.forEach((l) => {
    const x = l.x + ox;
    if (x < -80 || x > cw + 80) return;
    for (let k = 3; k >= 1; k--) {
      g.fillStyle = `rgba(255, 196, 90, ${0.07})`;
      g.beginPath();
      g.arc(l.round || l.w ? x + (l.w || 0) / 2 : x, l.y + (l.h || 0) / 2, (l.glow * k) / 3, 0, Math.PI * 2);
      g.fill();
    }
  });
  g.restore();
  lights.forEach((l) => {
    const x = l.x + ox;
    if (x < -40 || x > cw + 40) return;
    if (l.w) {
      rect(g, x, l.y, l.w, l.h, '#ffd76a');
      rect(g, x + 1, l.y + 1, l.w / 2 - 2, l.h / 2 - 2, '#fff1b0');
      rect(g, x + l.w / 2, l.y, 1, l.h, '#8a5a2e');
      rect(g, x, l.y + l.h / 2, l.w, 1, '#8a5a2e');
    } else if (l.round && l.r > 4) {
      disc(g, x, l.y, l.r, '#ffd76a');
      disc(g, x - 2, l.y - 2, l.r - 4, '#fff1b0');
      rect(g, x - l.r, l.y, l.r * 2 + 1, 1, '#8a5a2e');
      rect(g, x, l.y - l.r, 1, l.r * 2 + 1, '#8a5a2e');
    } else {
      disc(g, x, l.y, l.r, '#fff1b0');
    }
  });
}

// ondas do mar (praia)
export function drawWaves(g, ox, t) {
  const sea = SCENES.praia.sea;
  for (let x = sea; x < OUT_W; x += 1) {
    const sx = x + ox;
    if (sx < -2 || sx > 4000) continue;
    const shore = Math.min(1, (x - sea) / 40);
    const top = GROUND + 6 - Math.round(shore * 4);
    const w = Math.sin(x * 0.12 + t * 2.2) + Math.sin(x * 0.05 - t * 1.3);
    if (w > 1.1) px(g, sx, top - 1, '#e0f4ff');
    if (w > 0.4) px(g, sx, top, '#bfe6f7');
  }
  // espuma indo e voltando na areia
  const foam = sea - 6 + Math.round(Math.sin(t * 1.2) * 6);
  for (let k = 0; k < 14; k++) px(g, foam + k + ox, GROUND + 5 + (k % 3 === 0 ? 1 : 0), '#ffffff');
}


/* ---------------- modo desenvolvedor: camadas editadas ---------------- */
// rec = { overlay: canvas (pixels pintados), erase: canvas (pixels apagados) }
export function composeLayer(base, rec) {
  if (!base || !rec) return base;
  const { c, g } = mk(base.width, base.height);
  g.drawImage(base, 0, 0);
  if (rec.erase) {
    g.globalCompositeOperation = 'destination-out';
    g.drawImage(rec.erase, 0, 0);
    g.globalCompositeOperation = 'source-over';
  }
  if (rec.overlay) g.drawImage(rec.overlay, 0, 0);
  return c;
}
export const makeCanvas = (w, h) => mk(w, h);
