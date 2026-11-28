/* =========================================================
   VILA MEDIEVAL (no fim do mapa, à esquerda da casa)
   Casas de enxaimel, taverna, poço, feira, tochas e bandeirinhas.
   No meio, uma árvore com a lojinha do Seu Bartolomeu (o vendedor
   porco): ele compra a colheita e vende sementes.
   Moradores: elfos, mago, guarda, arqueira e um fazendeiro.
========================================================= */
import { BOT, FLOOR1, GROUND, IN_W, PAD, PAL, TILE, VH, disc, px, rect, rng, shade } from "./pixelWorld.js";

export const VILLAGE_W = 1600;
export const VB = VH + BOT;
export const SHOP_TREE_X = 600;
export const VILLAGE_BOUNDS = [40, VILLAGE_W - 40];
export const SHOP_BOUNDS = [34, 168];
export const GRID_VILLAGE = { cols: VILLAGE_W / TILE, rows: (PAD + VB) / TILE, oy: PAD };
export const GRID_SHOP = { cols: IN_W / TILE, rows: VB / TILE, oy: 0 };

export const VILLAGE_SPOTS = [
  { id: "home", where: "village", x: VILLAGE_W - 60, y: GROUND, w: 40, label: "Voltar para casa", act: "toHome" },
  { id: "shopdoor", where: "village", x: SHOP_TREE_X, y: GROUND, w: 36, label: "Entrar na lojinha", act: "toShop" },
  { id: "shopexit", where: "shop", x: 50, y: FLOOR1, w: 32, label: "Sair da loja", act: "fromShop" },
  { id: "vendor", where: "shop", x: 160, y: FLOOR1, w: 30, label: "Falar com o Seu Bartolomeu", act: "trade" }
];

const WOOD = ["#5a3820", "#8a5a2e", "#a8743e", "#c48a52"];
const mk = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  return { c, g };
};

/* ---------------- peças ---------------- */
function cobble(g, x0, x1, r) {
  for (let x = x0; x < x1; x += 7) {
    for (let y = GROUND; y < GROUND + 6; y += 3) {
      const ox = (y / 3) % 2 ? 3 : 0;
      rect(g, x + ox, y, 6, 2, r() < 0.5 ? "#9ca3af" : "#a8a29e");
      px(g, x + ox, y, "#d6d3d1");
    }
  }
}
function torchPost(g, x, lights) {
  rect(g, x, GROUND - 34, 3, 34, WOOD[0]);
  rect(g, x - 3, GROUND - 38, 9, 4, "#374151");
  rect(g, x - 2, GROUND - 43, 7, 5, "#f59e0b");
  rect(g, x - 1, GROUND - 47, 5, 4, "#fbbf24");
  px(g, x + 1, GROUND - 48, "#fde68a");
  lights.push({ x: x + 1, y: GROUND - 43, r: 3, glow: 34 });
}
// casa de enxaimel (paredes claras com vigas de madeira e telhado)
function house(g, x, w, h, roof, lights, r, opt = {}) {
  const top = GROUND - h;
  // fundação de pedra
  rect(g, x - 2, GROUND - 8, w + 4, 8, "#78716c");
  for (let k = 0; k < w + 4; k += 6) rect(g, x - 2 + k, GROUND - 8 + ((k / 6) % 2) * 3, 5, 2, "#a8a29e");
  // parede
  rect(g, x, top, w, h - 8, "#efe4c8");
  for (let k = 0; k < 60; k++) px(g, x + r() * w, top + r() * (h - 8), "#e2d3b0");
  // vigas
  rect(g, x, top, w, 3, WOOD[0]);
  rect(g, x, top + Math.round((h - 8) / 2), w, 3, WOOD[0]);
  rect(g, x, GROUND - 11, w, 3, WOOD[0]);
  for (let k = 0; k <= w - 3; k += Math.round(w / 3)) rect(g, x + k, top, 3, h - 8, WOOD[0]);
  rect(g, x + w - 3, top, 3, h - 8, WOOD[0]);
  // diagonais
  for (let k = 0; k < (h - 8) / 2 - 3; k++) {
    px(g, x + 4 + k, top + 3 + k, WOOD[0]);
    px(g, x + w - 5 - k, top + 3 + k, WOOD[0]);
  }
  // janelas com venezianas
  const win = (wx, wy) => {
    rect(g, wx - 2, wy - 1, 16, 14, WOOD[0]);
    rect(g, wx, wy, 12, 12, "#2d3f5b");
    rect(g, wx + 5, wy, 2, 12, WOOD[0]);
    rect(g, wx, wy + 5, 12, 2, WOOD[0]);
    rect(g, wx - 6, wy, 4, 12, "#7c2d12");
    rect(g, wx + 14, wy, 4, 12, "#7c2d12");
    rect(g, wx - 1, wy + 12, 14, 2, WOOD[2]);
    lights.push({ x: wx, y: wy, w: 12, h: 12, glow: 18 });
    if (opt.flowers) for (let k = 0; k < 5; k++) disc(g, wx + 1 + k * 3, wy + 12, 1, ["#f472b6", "#facc15", "#f87171"][k % 3]);
  };
  win(x + 12, top + 10);
  if (w > 70) win(x + w - 26, top + 10);
  if (h > 80) win(x + Math.round(w / 2) - 6, top + Math.round((h - 8) / 2) + 8);
  // porta
  const dx = opt.doorX ?? x + Math.round(w / 2) - 9;
  rect(g, dx - 2, GROUND - 32, 22, 24, WOOD[0]);
  rect(g, dx, GROUND - 30, 18, 22, WOOD[2]);
  for (let k = 3; k < 18; k += 5) rect(g, dx + k, GROUND - 30, 1, 22, WOOD[1]);
  px(g, dx + 14, GROUND - 19, "#facc15");
  // telhado
  const over = 8;
  const rh = Math.round(w * 0.42);
  for (let y = 0; y < rh; y++) {
    const half = Math.round(((y + 1) / rh) * (w / 2 + over));
    rect(g, x + w / 2 - half, top - rh + y, half * 2, 1, (y % 4) === 3 ? shade(roof, -0.25) : y % 8 < 4 ? roof : shade(roof, 0.08));
  }
  rect(g, x - over, top - 1, w + over * 2, 2, shade(roof, -0.35));
  // chaminé
  if (opt.chimney) {
    rect(g, x + w - 22, top - rh - 6, 9, Math.round(rh * 0.6), "#78716c");
    rect(g, x + w - 23, top - rh - 8, 11, 3, "#57534e");
  }
  return { top, rh };
}
function well(g, x) {
  rect(g, x - 14, GROUND - 16, 29, 16, "#9ca3af");
  for (let y = 0; y < 16; y += 4) for (let k = (y / 4) % 2 ? 0 : 4; k < 29; k += 8) rect(g, x - 14 + k, GROUND - 16 + y, 7, 3, "#a8b0b9");
  rect(g, x - 15, GROUND - 18, 31, 3, "#6b7280");
  rect(g, x - 12, GROUND - 44, 3, 28, WOOD[0]);
  rect(g, x + 10, GROUND - 44, 3, 28, WOOD[0]);
  for (let y = 0; y < 10; y++) rect(g, x - 18 + Math.round(y * 0.4), GROUND - 54 + y, 37 - Math.round(y * 0.8), 1, y % 3 ? "#7c2d12" : "#9a3412");
  rect(g, x, GROUND - 44, 1, 14, "#374151");
  rect(g, x - 3, GROUND - 30, 7, 6, WOOD[1]);
}
function stall(g, x, P) {
  rect(g, x - 30, GROUND - 40, 3, 40, WOOD[0]);
  rect(g, x + 28, GROUND - 40, 3, 40, WOOD[0]);
  for (let k = 0; k < 62; k++) rect(g, x - 32 + k, GROUND - 46 + (k % 10 < 5 ? 0 : 1), 1, 8, Math.floor(k / 8) % 2 ? "#ffffff" : "#dc2626");
  for (let k = 0; k < 62; k += 8) rect(g, x - 32 + k, GROUND - 38, 8, 3, Math.floor(k / 8) % 2 ? "#e5e7eb" : "#b91c1c");
  rect(g, x - 28, GROUND - 16, 57, 4, WOOD[2]);
  rect(g, x - 26, GROUND - 12, 53, 12, WOOD[1]);
  // caixotes de verdura
  [[-24, "#f97316"], [-8, "#dc2626"], [8, "#eab308"]].forEach(([dx, col]) => {
    rect(g, x + dx, GROUND - 22, 14, 6, WOOD[3]);
    for (let k = 0; k < 4; k++) disc(g, x + dx + 2 + k * 3, GROUND - 23, 2, col);
  });
  disc(g, x + 18, GROUND - 24, 3, P.leaf[2]);
}
function bunting(g, x0, x1, y, r) {
  const cols = ["#dc2626", "#facc15", "#2563eb", "#16a34a", "#f472b6"];
  for (let x = x0; x < x1; x++) {
    const t = (x - x0) / (x1 - x0);
    px(g, x, y + Math.round(Math.sin(t * Math.PI) * 10), "#3f2a18");
  }
  for (let x = x0 + 6; x < x1 - 4; x += 10) {
    const t = (x - x0) / (x1 - x0);
    const yy = y + Math.round(Math.sin(t * Math.PI) * 10) + 1;
    const col = cols[Math.floor(r() * cols.length)];
    for (let k = 0; k < 5; k++) rect(g, x - 2 + Math.floor(k / 2), yy + k, 5 - k, 1, col);
  }
}
// árvore da lojinha (menor que a casa, com placa)
function shopTree(g, x, P, lights) {
  const BARK = ["#3d2412", "#4e2f17", "#6b4423", "#7d5130", "#946238"];
  for (let y = GROUND - 150; y < GROUND; y++) {
    const hw = Math.round(34 + Math.max(0, (y - (GROUND - 30)) / 30) ** 2 * 22);
    for (let k = -hw; k <= hw; k++) {
      const u = (k + hw) / (2 * hw);
      px(g, x + k, y, u < 0.1 ? BARK[0] : u < 0.3 ? BARK[3] : u < 0.45 ? BARK[4] : u < 0.85 ? BARK[3] : BARK[1]);
    }
  }
  for (let i = 0; i < 9; i++) {
    const cx = x - 90 + i * 22;
    disc(g, cx, GROUND - 176 + (i % 3) * 8, 34, P.leaf[0]);
  }
  for (let i = 0; i < 9; i++) disc(g, x - 90 + i * 22, GROUND - 182 + (i % 3) * 8, 28, P.leaf[1]);
  for (let i = 0; i < 6; i++) disc(g, x - 70 + i * 28, GROUND - 192 + (i % 2) * 6, 16, P.leaf[2]);
  if (P.snow) for (let i = 0; i < 9; i++) rect(g, x - 110 + i * 22, GROUND - 212 + (i % 3) * 8, 26, 3, "#ffffff");
  // porta
  for (let y = GROUND - 40; y < GROUND; y++) {
    const ar = y < GROUND - 26 ? Math.round(Math.sqrt(Math.max(0, 14 ** 2 - (GROUND - 26 - y) ** 2))) : 14;
    rect(g, x - ar, y, ar * 2 + 1, 1, y % 5 ? WOOD[2] : WOOD[1]);
  }
  px(g, x + 9, GROUND - 18, "#facc15");
  // placa: moeda e cenoura
  rect(g, x - 34, GROUND - 74, 68, 2, "#374151");
  rect(g, x - 28, GROUND - 72, 2, 6, "#374151");
  rect(g, x + 26, GROUND - 72, 2, 6, "#374151");
  rect(g, x - 32, GROUND - 66, 64, 20, WOOD[1]);
  rect(g, x - 31, GROUND - 65, 62, 18, WOOD[2]);
  disc(g, x - 14, GROUND - 56, 6, "#facc15");
  disc(g, x - 14, GROUND - 56, 4, "#eab308");
  px(g, x - 14, GROUND - 56, "#fde68a");
  [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [1, 2], [1, 3]].forEach(([dx, dy]) => px(g, x + 6 + dx, GROUND - 58 + dy, "#f97316"));
  [[1, -1], [2, -2], [0, -2]].forEach(([dx, dy]) => px(g, x + 6 + dx, GROUND - 58 + dy, "#22c55e"));
  // lanternas
  [-24, 24].forEach((dx) => {
    rect(g, x + dx - 2, GROUND - 46, 5, 7, "#1f2937");
    rect(g, x + dx - 1, GROUND - 45, 3, 5, "#fde68a");
    lights.push({ x: x + dx, y: GROUND - 43, r: 2, glow: 24 });
  });
}
function bushRow(g, x, P, r) {
  for (let k = 0; k < 4; k++) {
    disc(g, x + k * 9, GROUND - 6, 7, P.leaf[1]);
    disc(g, x + k * 9 - 2, GROUND - 9, 4, P.leaf[2]);
  }
  if (P.flower.length) for (let k = 0; k < 6; k++) px(g, x + r() * 30, GROUND - 6 - r() * 8, P.flower[k % P.flower.length]);
}

/* ---------------- a vila ---------------- */
export function buildVillage(season) {
  const P = PAL[season];
  const { c, g } = mk(VILLAGE_W, PAD + VB);
  g.translate(0, PAD);
  const r = rng(808);
  const lights = [];
  // chão: grama, terra e calçada de pedra
  for (let x = 0; x < VILLAGE_W; x++) {
    rect(g, x, GROUND, 1, VB - GROUND, "#7a4b26");
    rect(g, x, GROUND, 1, 3, P.grass[0]);
    if (r() < 0.3) px(g, x, GROUND - 1, P.grass[0]);
    for (let y = GROUND + 8; y < VB; y += 3) if (r() < 0.06) px(g, x, y, r() < 0.5 ? "#5e3a1d" : "#93603a");
  }
  cobble(g, 90, VILLAGE_W - 90, r);
  // floresta nas pontas
  [20, 60, VILLAGE_W - 30].forEach((x) => {
    rect(g, x - 5, GROUND - 60, 10, 60, "#4e2f17");
    disc(g, x, GROUND - 74, 26, P.leaf[1]);
    disc(g, x - 6, GROUND - 82, 16, P.leaf[2]);
  });
  // casas
  house(g, 130, 96, 78, "#9a3412", lights, r, { chimney: true, flowers: true });
  house(g, 300, 84, 96, "#7c2d12", lights, r, { flowers: true });
  shopTree(g, SHOP_TREE_X, P, lights);
  well(g, 760);
  stall(g, 870, P);
  house(g, 960, 110, 90, "#854d0e", lights, r, { chimney: true });
  // taverna (placa com caneca)
  const tav = house(g, 1150, 130, 104, "#7f1d1d", lights, r, { chimney: true, flowers: true });
  rect(g, 1148, GROUND - 70, 2, 14, "#374151");
  rect(g, 1136, GROUND - 58, 26, 18, WOOD[1]);
  rect(g, 1137, GROUND - 57, 24, 16, WOOD[2]);
  rect(g, 1143, GROUND - 54, 9, 10, "#facc15");
  rect(g, 1152, GROUND - 52, 3, 5, "#facc15");
  rect(g, 1143, GROUND - 55, 9, 2, "#fffbeb");
  void tav;
  house(g, 1360, 80, 74, "#9a3412", lights, r, {});
  // tochas e bandeirinhas
  [250, 460, 700, 1080, 1320, 1480].forEach((x) => torchPost(g, x, lights));
  bunting(g, 226, 300, GROUND - 120, r);
  bunting(g, 1070, 1150, GROUND - 130, r);
  bushRow(g, 240, P, r);
  bushRow(g, 1460, P, r);
  // placa "→ casa"
  const sx = VILLAGE_W - 90;
  rect(g, sx, GROUND - 26, 3, 26, WOOD[0]);
  rect(g, sx - 10, GROUND - 34, 26, 10, WOOD[2]);
  for (let k = 0; k < 4; k++) px(g, sx + 16 + k, GROUND - 30 + (k > 1 ? 3 - k : k) - 1, WOOD[2]);
  // casinha de árvore pintada na placa
  disc(g, sx + 2, GROUND - 30, 3, "#166534");
  if (P.snow) for (let x = 0; x < VILLAGE_W; x += 2) px(g, x, GROUND, "#ffffff");
  return { c, lights };
}

export function villageSolid() {
  const G = GRID_VILLAGE;
  const grid = new Uint8Array(G.cols * G.rows);
  const row = (y) => Math.floor((y + G.oy) / TILE);
  for (let r = row(GROUND); r < G.rows; r++) for (let c = 0; c < G.cols; c++) grid[r * G.cols + c] = 1;
  return grid;
}

/* ---------------- dentro da lojinha ---------------- */
export function buildShop(season) {
  const P = PAL[season];
  const { c, g } = mk(IN_W, VB);
  const r = rng(909);
  const lights = [];
  rect(g, 0, 0, IN_W, VB, "#3d2412");
  for (let y = 40; y < FLOOR1; y++) {
    const inset = y < 90 ? Math.round(((90 - y) / 50) ** 2 * 140) : 0;
    for (let x = 22 + inset; x < IN_W - 22 - inset; x++) {
      const ring = Math.round(Math.hypot((x - 220) * 0.8, (y - 130) * 1.1)) % 14 === 0;
      px(g, x, y, ring ? "#c99258" : (x - 22) % 26 === 0 ? "#a56c3b" : "#b67a45");
    }
  }
  rect(g, 0, FLOOR1, IN_W, VB - FLOOR1, WOOD[1]);
  rect(g, 0, FLOOR1, IN_W, 1, WOOD[3]);
  for (let x = 6; x < IN_W; x += 18) rect(g, x, FLOOR1 + 1, 1, VB - FLOOR1, WOOD[0]);
  // porta de saída
  for (let y = FLOOR1 - 46; y < FLOOR1; y++) {
    const ar = y < FLOOR1 - 31 ? Math.round(Math.sqrt(Math.max(0, 15 ** 2 - (FLOOR1 - 31 - y) ** 2))) : 15;
    rect(g, 50 - ar, y, ar * 2 + 1, 1, y % 6 ? WOOD[2] : WOOD[1]);
  }
  px(g, 59, FLOOR1 - 22, "#facc15");
  // prateleiras atrás do balcão com potes, sacos de semente e verduras
  for (let s = 0; s < 3; s++) {
    const y = 96 + s * 30;
    rect(g, 196, y, 200, 3, WOOD[0]);
    for (let x = 202; x < 390; x += 13) {
      const kind = Math.floor(r() * 4);
      if (kind === 0) {
        rect(g, x, y - 12, 9, 12, "#d6c7a1");
        rect(g, x + 1, y - 14, 7, 2, "#a8825a");
        disc(g, x + 4, y - 6, 2, ["#f97316", "#dc2626", "#eab308", "#16a34a"][Math.floor(r() * 4)]);
      } else if (kind === 1) {
        rect(g, x, y - 11, 9, 11, "#9ca3af");
        rect(g, x + 1, y - 10, 7, 8, ["#fca5a5", "#fde68a", "#bbf7d0"][Math.floor(r() * 3)]);
        rect(g, x + 2, y - 13, 5, 2, "#6b7280");
      } else if (kind === 2) {
        for (let k = 0; k < 3; k++) disc(g, x + 2 + k * 3, y - 3, 2, ["#f97316", "#dc2626", "#be185d"][Math.floor(r() * 3)]);
      } else {
        rect(g, x + 2, y - 14, 4, 14, "#eab308");
        rect(g, x + 1, y - 16, 6, 3, "#fde68a");
      }
    }
  }
  // cestos no chão
  [[300, "#f97316"], [338, "#dc2626"], [376, "#eab308"]].forEach(([x, col]) => {
    rect(g, x, FLOOR1 - 14, 26, 14, "#a16207");
    for (let k = 0; k < 26; k += 4) rect(g, x + k, FLOOR1 - 14, 2, 14, "#854d0e");
    for (let k = 0; k < 6; k++) disc(g, x + 3 + k * 4, FLOOR1 - 15, 2, col);
  });
  // estandarte com moeda
  rect(g, 120, 60, 30, 2, WOOD[0]);
  rect(g, 123, 62, 24, 30, "#166534");
  for (let k = 0; k < 6; k++) rect(g, 123 + k * 2, 92 + k, 24 - k * 4, 1, "#166534");
  disc(g, 135, 76, 7, "#facc15");
  disc(g, 135, 76, 5, "#eab308");
  // lustre de velas
  rect(g, 260, 40, 1, 20, "#374151");
  rect(g, 248, 60, 25, 2, "#374151");
  [-11, 0, 11].forEach((dx) => {
    rect(g, 260 + dx - 1, 55, 3, 5, "#f5e6c8");
    px(g, 260 + dx, 54, "#fde047");
    lights.push({ x: 260 + dx, y: 54, r: 1, glow: 34 });
  });
  void P;
  return { c, lights };
}
// balcão (desenhado por cima do vendedor)
export function buildShopFront() {
  const { c, g } = mk(IN_W, VB);
  const x = 176;
  rect(g, x, FLOOR1 - 28, 150, 28, WOOD[1]);
  rect(g, x - 3, FLOOR1 - 31, 156, 4, WOOD[2]);
  rect(g, x - 3, FLOOR1 - 31, 156, 1, WOOD[3]);
  for (let k = 8; k < 150; k += 24) rect(g, x + k, FLOOR1 - 26, 16, 20, WOOD[0]);
  for (let k = 8; k < 150; k += 24) rect(g, x + k + 1, FLOOR1 - 25, 14, 18, "#7a4a22");
  // balança e moedas no balcão
  rect(g, x + 100, FLOOR1 - 44, 2, 13, "#9ca3af");
  rect(g, x + 90, FLOOR1 - 44, 22, 2, "#9ca3af");
  rect(g, x + 88, FLOOR1 - 40, 7, 2, "#d4a017");
  rect(g, x + 107, FLOOR1 - 38, 7, 2, "#d4a017");
  [0, 3, 6].forEach((k) => rect(g, x + 30 + k, FLOOR1 - 33 - (k % 2), 3, 2, "#facc15"));
  return c;
}
export function shopSolid() {
  const G = GRID_SHOP;
  const grid = new Uint8Array(G.cols * G.rows);
  for (let r = Math.floor(FLOOR1 / TILE); r < G.rows; r++) for (let c = 0; c < G.cols; c++) grid[r * G.cols + c] = 1;
  for (let r = 0; r < G.rows; r++) {
    for (let c = 0; c < 6; c++) grid[r * G.cols + c] = 1;
    for (let c = 44; c < G.cols; c++) grid[r * G.cols + c] = 1;
  }
  return grid;
}

/* ---------------- moradores ---------------- */
const npcHero = (cls, look) => ({ cls, looks2d: { [cls]: look }, stats: {}, customs: [] });
export const NPCS = [
  {
    id: "fuba",
    name: "Velho Fubá",
    hero: npcHero("archer", { hat: null, headgear: false, item: false, hair: "#d1d5db", hairStyle: "careca", beard: "curta", outfit: "#65a30d", outfit2: "#3f6212", shirt: "#fef3c7", pants: "#713f12" }),
    x0: 90,
    x1: 280,
    speed: 18,
    lines: ["Plante na chuva que a terra agradece!", "Batata-doce é paciente, mas vale a pena.", "No meu tempo o trigo era desse tamanho!"]
  },
  {
    id: "velara",
    name: "Velara",
    hero: npcHero("elf", { hair: "#fef3c7", outfit: "#0f766e", outfit2: "#134e4a" }),
    x0: 300,
    x1: 480,
    speed: 22,
    lines: ["As árvores daqui cantam à noite, sabia?", "Que bom te ver pela vila!", "Dizem que o sapo do seu lago é mágico."]
  },
  {
    id: "nilson",
    name: "Mestre Nilson",
    hero: npcHero("wizard", { outfit: "#1e3a8a", outfit2: "#172554", trim: "#93c5fd", hair: "#9ca3af" }),
    x0: 700,
    x1: 820,
    speed: 12,
    lines: ["Um bom hábito vale mais que mil feitiços.", "O poço guarda segredos... e água, claro.", "Hmm, cheiro de chuva no ar."]
  },
  {
    id: "elina",
    name: "Elina",
    hero: npcHero("archer", { hair: "#7c2d12", hairStyle: "rabo", outfit: "#7f1d1d", outfit2: "#450a0a", blush: true, eyes: "cilios", mouth: "leve" }),
    x0: 830,
    x1: 960,
    speed: 26,
    lines: ["Os tomates da feira acabaram cedo hoje!", "O Seu Bartolomeu paga bem por arroz.", "Vou treinar minha mira no bosque."]
  },
  {
    id: "thalion",
    name: "Thalion",
    hero: npcHero("elf", { hair: "#1f2937", hairStyle: "curto", mouth: "leve", eyes: "grande", blush: false, hat: null, headgear: false, outfit: "#4338ca", outfit2: "#312e81" }),
    x0: 980,
    x1: 1130,
    speed: 20,
    lines: ["A taverna tem a melhor sopa de cenoura.", "Já visitou a feira hoje?", "O outono aqui é o mais bonito do reino."]
  },
  {
    id: "bruno",
    name: "Guarda Bruno",
    hero: npcHero("warrior", { outfit: "#334155", trim: "#e5e7eb" }),
    x0: 1200,
    x1: 1480,
    speed: 16,
    lines: ["Tudo em ordem na vila!", "Cuidado com os patos do lago.", "Passe bem, viajante."]
  }
];
export const VENDOR = {
  id: "bartolomeu",
  name: "Seu Bartolomeu",
  x: 260,
  hero: npcHero("warrior", {
    skin: "#f6a5b0",
    hat: null,
    headgear: false,
    item: false,
    ears: "porco",
    mouth: "focinho",
    eyes: "pequeno",
    hairStyle: "careca",
    beard: "nenhuma",
    outfit: "#7c4a22",
    outfit2: "#5a3820",
    shirt: "#e8dcc0",
    pants: "#3b2416",
    trim: "#d4a017",
    blush: true
  }),
  lines: ["Oinc! Bem-vindo à lojinha!", "Verdura fresquinha? Eu compro!", "Sementes boas, preço justo. Oinc!"]
};
