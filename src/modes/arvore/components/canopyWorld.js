/* =========================================================
   TOPO DA COPA (a claraboia da casa leva para cá)
   Um "chão" de folhas lá em cima da árvore: banco para sentar,
   a claraboia para descer, uma toalha com luneta para olhar as
   estrelas e um varal de luzinhas.
   E o céu estrelado: muitas estrelas, via láctea, estrelas
   cadentes e 2 planetas passando (um verde com anel e um azul
   cheio de buraquinhos).
========================================================= */
import { BOT, GROUND, PAD, PAL, TILE, VH, disc, px, rect, rng, shade } from "./pixelWorld.js";

export const CANOPY_W = 900;
const VB = VH + BOT;
export const CANOPY_BOUNDS = [70, 830];
export const GRID_CANOPY = { cols: CANOPY_W / TILE, rows: (PAD + VB) / TILE, oy: PAD };
export const CANOPY_SPOTS = [
  { id: "hatch", where: "canopy", x: 450, y: GROUND, w: 34, label: "Descer pela claraboia", act: "fromCanopy" },
  { id: "bench", where: "canopy", x: 292, y: GROUND, w: 34, label: "Sentar no banco", act: "sit" },
  { id: "gaze", where: "canopy", x: 628, y: GROUND, w: 40, label: "Olhar as estrelas", act: "stargaze" }
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

export function buildCanopy(season) {
  const P = PAL[season];
  const { c, g } = mk(CANOPY_W, PAD + VB);
  g.translate(0, PAD);
  const r = rng(515);
  const lights = [];
  // massa de folhas (o "chão" lá em cima)
  const edge = (x) => {
    if (x < 70) return GROUND + Math.round(((70 - x) / 70) ** 2 * 80);
    if (x > 830) return GROUND + Math.round(((x - 830) / 70) ** 2 * 80);
    return GROUND;
  };
  for (let i = 0; i < 90; i++) {
    const x = r() * CANOPY_W;
    const y = edge(x) + 14 + r() * 90;
    disc(g, x, y, 18 + r() * 20, P.leaf[0]);
  }
  for (let i = 0; i < 70; i++) {
    const x = r() * CANOPY_W;
    const y = edge(x) + 6 + r() * 40;
    disc(g, x, y, 12 + r() * 14, P.leaf[1]);
  }
  for (let x = 0; x < CANOPY_W; x++) {
    const top = edge(x);
    rect(g, x, top, 1, 6, P.leaf[1]);
    if (r() < 0.5) px(g, x, top - 1, P.leaf[2]);
    if (r() < 0.2) px(g, x, top - 2, P.leaf[3]);
    if (P.snow) rect(g, x, top - 1, 1, 3, "#f4f9fc");
  }
  for (let i = 0; i < 500; i++) {
    const x = r() * CANOPY_W;
    const y = edge(x) + r() * 120;
    px(g, x, y, r() < 0.5 ? P.leaf[3] : P.leaf[2]);
    if (P.bloom && r() < 0.15) px(g, x + 1, y, P.bloom);
  }
  // galhinhos aparecendo
  [[120, 30], [380, 50], [700, 26]].forEach(([x, h]) => {
    for (let k = 0; k < h; k++) px(g, x + Math.round(Math.sin(k * 0.2) * 3), GROUND - k, WOOD[0]);
    disc(g, x + 2, GROUND - h - 3, 6, P.leaf[2]);
  });
  // ninho com ovinhos
  rect(g, 150, GROUND - 6, 18, 6, "#8a5a2e");
  rect(g, 149, GROUND - 7, 20, 2, "#a8743e");
  [[154, "#bae6fd"], [159, "#e0f2fe"], [164, "#bae6fd"]].forEach(([x, col]) => {
    rect(g, x, GROUND - 10, 4, 4, col);
    px(g, x + 1, GROUND - 10, "#ffffff");
  });
  // banco de tronco
  rect(g, 276, GROUND - 6, 6, 6, WOOD[0]);
  rect(g, 302, GROUND - 6, 6, 6, WOOD[0]);
  rect(g, 272, GROUND - 10, 40, 4, WOOD[2]);
  rect(g, 272, GROUND - 10, 40, 1, WOOD[3]);
  rect(g, 272, GROUND - 7, 40, 1, WOOD[1]);
  // claraboia (a janela redonda por onde se desce)
  for (let dy = -4; dy <= 4; dy++) {
    const dx = Math.round(20 * Math.sqrt(1 - (dy / 4.5) ** 2));
    rect(g, 450 - dx, GROUND - 1 + dy, dx * 2 + 1, 1, WOOD[0]);
  }
  for (let dy = -3; dy <= 3; dy++) {
    const dx = Math.round(16 * Math.sqrt(1 - (dy / 3.5) ** 2));
    rect(g, 450 - dx, GROUND - 1 + dy, dx * 2 + 1, 1, dy < 0 ? "#bfe6f7" : "#7cc4ea");
  }
  rect(g, 450, GROUND - 4, 1, 7, WOOD[1]);
  rect(g, 436, GROUND - 1, 29, 1, WOOD[1]);
  lights.push({ x: 450, y: GROUND - 1, r: 3, glow: 26 });
  // toalha xadrez e luneta
  for (let x = 0; x < 44; x++) for (let y = 0; y < 4; y++) px(g, 604 + x + y, GROUND - 2 + Math.floor(y / 2), (Math.floor(x / 4) + y) % 2 ? "#dc2626" : "#fef2f2");
  rect(g, 652, GROUND - 14, 2, 14, WOOD[0]);
  rect(g, 646, GROUND - 2, 2, 2, WOOD[0]);
  rect(g, 658, GROUND - 2, 2, 2, WOOD[0]);
  for (let k = 0; k < 4; k++) {
    px(g, 649 + Math.round(k * 0.7), GROUND - 6 + k * 1, WOOD[0]);
    px(g, 656 - Math.round(k * 0.7), GROUND - 6 + k * 1, WOOD[0]);
  }
  for (let k = 0; k < 16; k++) rect(g, 646 + k, GROUND - 16 - Math.round(k * 0.7), 3, 3, k < 4 ? "#78350f" : "#d4a017");
  rect(g, 660, GROUND - 29, 4, 4, "#facc15");
  // varal de luzinhas
  [[200, 470], [520, 760]].forEach(([a, b]) => {
    [a, b].forEach((x) => {
      rect(g, x, GROUND - 40, 3, 40, WOOD[0]);
      rect(g, x - 1, GROUND - 41, 5, 2, WOOD[1]);
    });
    for (let x = a + 2; x < b; x++) {
      const t = (x - a) / (b - a);
      const y = GROUND - 38 + Math.round(Math.sin(t * Math.PI) * 12);
      px(g, x, y, "#3f2a18");
      if ((x - a) % 18 === 9) {
        const col = ["#fde047", "#f9a8d4", "#93c5fd", "#86efac"][Math.floor((x - a) / 18) % 4];
        rect(g, x - 1, y + 1, 3, 3, col);
        lights.push({ x, y: y + 2, r: 1, glow: 10 });
      }
    }
  });
  // flores
  if (P.flower.length) for (let i = 0; i < 30; i++) px(g, 80 + r() * 740, GROUND - 1 - r() * 2, P.flower[i % P.flower.length]);
  void shade;
  return { c, lights };
}

export function canopySolid() {
  const G = GRID_CANOPY;
  const grid = new Uint8Array(G.cols * G.rows);
  const row = (y) => Math.floor((y + G.oy) / TILE);
  for (let r = row(GROUND); r < G.rows; r++) for (let c = 0; c < G.cols; c++) grid[r * G.cols + c] = 1;
  return grid;
}

/* ---------------- céu estrelado ---------------- */
let field = { key: "", c: null, stars: [] };
function starField(cw, ch) {
  const key = `${cw}x${ch}`;
  if (field.key === key) return field;
  const r = rng(77);
  const { c, g } = mk(cw * 2, ch);
  // fundo com faixas (bem escuro em cima, roxinho embaixo)
  const bands = ["#03040d", "#050817", "#070b20", "#0b0f2b", "#110f35", "#19113d", "#231545", "#2e1a4d"];
  const bh = Math.ceil(ch / bands.length);
  bands.forEach((col, i) => rect(g, 0, i * bh, cw * 2, bh, col));
  // via láctea: faixa diagonal brilhante
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 260; i++) {
    const u = r();
    const x = u * cw * 2;
    const y = ch * 0.85 - u * ch * 0.9 + (r() - 0.5) * ch * 0.25;
    g.fillStyle = `rgba(${r() < 0.5 ? "120, 90, 200" : "70, 110, 210"}, 0.05)`;
    g.beginPath();
    g.arc(x, y, 6 + r() * 14, 0, Math.PI * 2);
    g.fill();
  }
  g.globalCompositeOperation = "source-over";
  for (let i = 0; i < 3200; i++) {
    const u = r();
    const inBand = r() < 0.55;
    const x = u * cw * 2;
    const y = inBand ? ch * 0.85 - u * ch * 0.9 + (r() + r() - 1) * ch * 0.12 : r() * ch;
    const v = r();
    px(g, x, y, v < 0.6 ? "rgba(255,255,255,0.55)" : v < 0.8 ? "#c7d2fe" : v < 0.92 ? "#fde68a" : "#fbcfe8");
  }
  const stars = Array.from({ length: 60 }, () => ({ x: r(), y: r() * 0.9, ph: r() * 6, big: r() < 0.25, col: ["#ffffff", "#fef3c7", "#c7d2fe", "#fbcfe8"][Math.floor(r() * 4)] }));
  field = { key, c, stars };
  return field;
}
const hash = (n) => {
  let x = Math.imul(n ^ 0x2545f491, 0x9e3779b1);
  x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
};
function glow(g, x, y, r0, rgb, a) {
  g.save();
  g.globalCompositeOperation = "lighter";
  for (let k = 3; k >= 1; k--) {
    g.fillStyle = `rgba(${rgb}, ${a / k})`;
    g.beginPath();
    g.arc(x, y, r0 * (1 + k * 0.6), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}
function ringPlanet(g, x, y, R) {
  const ringPts = (front) => {
    for (let a = 0; a < Math.PI * 2; a += 0.02) {
      const isFront = Math.sin(a) > 0;
      if (isFront !== front) continue;
      const rx = Math.cos(a) * R * 1.9;
      const ry = Math.sin(a) * R * 0.45;
      const tx = x + rx * 0.94 - ry * 0.3;
      const ty = y + ry + rx * 0.16;
      px(g, tx, ty, "#d9f99d");
      px(g, tx, ty + 1, "#a3e635");
    }
  };
  glow(g, x, y, R, "120, 220, 120", 0.12);
  ringPts(false);
  disc(g, x, y, R, "#15803d");
  for (let k = -R; k <= R; k += 4) {
    const w = Math.round(Math.sqrt(Math.max(0, R * R - k * k)));
    rect(g, x - w, y + k, w * 2 + 1, 2, k % 8 === 0 ? "#22c55e" : "#16a34a");
  }
  disc(g, x - R * 0.35, y - R * 0.35, R * 0.35, "#4ade80");
  px(g, x - R * 0.5, y - R * 0.55, "#bbf7d0");
  ringPts(true);
}
function craterPlanet(g, x, y, R) {
  glow(g, x, y, R, "90, 150, 255", 0.14);
  disc(g, x, y, R, "#2563eb");
  disc(g, x - R * 0.2, y - R * 0.2, R * 0.82, "#3b82f6");
  [[-0.4, -0.1, 0.22], [0.3, -0.4, 0.16], [0.25, 0.35, 0.24], [-0.2, 0.45, 0.12], [0.5, 0.05, 0.1]].forEach(([dx, dy, s]) => {
    disc(g, x + dx * R, y + dy * R, Math.max(1, s * R), "#1d4ed8");
    px(g, x + dx * R - s * R * 0.5, y + dy * R - s * R * 0.5, "#93c5fd");
  });
  disc(g, x - R * 0.45, y - R * 0.45, R * 0.18, "#bfdbfe");
}

/** Céu estrelado por cima de tudo (a = 0..1 de opacidade). */
export function drawStarSky(g, cw, ch, t, a) {
  if (a <= 0) return;
  const F = starField(cw, ch);
  g.save();
  g.globalAlpha = a;
  const off = Math.floor((t * 3) % cw);
  g.drawImage(F.c, -off, 0);
  // estrelas grandes piscando
  F.stars.forEach((s) => {
    const x = Math.round(s.x * cw);
    const y = Math.round(s.y * ch);
    const tw = Math.sin(t * 2 + s.ph);
    if (tw < -0.6) return;
    px(g, x, y, s.col);
    if (s.big || tw > 0.6) {
      px(g, x - 1, y, s.col);
      px(g, x + 1, y, s.col);
      px(g, x, y - 1, s.col);
      px(g, x, y + 1, s.col);
      if (s.big && tw > 0.3) {
        px(g, x - 2, y, "rgba(255,255,255,0.5)");
        px(g, x + 2, y, "rgba(255,255,255,0.5)");
        px(g, x, y - 2, "rgba(255,255,255,0.5)");
        px(g, x, y + 2, "rgba(255,255,255,0.5)");
        glow(g, x, y, 2, "255, 255, 230", 0.08);
      }
    }
  });
  // planetas passando devagar
  const span1 = cw + 200;
  ringPlanet(g, Math.round(((t * 5) % span1) - 100), Math.round(ch * 0.32 + Math.sin(t * 0.07) * 8), Math.max(12, Math.round(ch * 0.09)));
  const span2 = cw + 160;
  craterPlanet(g, Math.round(cw + 80 - ((t * 3.4 + span2 * 0.4) % span2)), Math.round(ch * 0.66 + Math.sin(t * 0.05 + 1) * 6), Math.max(9, Math.round(ch * 0.065)));
  // estrelas cadentes
  for (let k = 0; k < 2; k++) {
    const P = 2.6 + k * 1.7;
    const s = Math.floor((t + k * 0.9) / P);
    const p = ((t + k * 0.9) % P) / 0.9;
    if (p > 1) continue;
    const sx = hash(s * 3 + k) * cw * 0.8 + cw * 0.15;
    const sy = hash(s * 7 + k) * ch * 0.4;
    const hx = sx - p * 90;
    const hy = sy + p * 45;
    for (let j = 0; j < 22; j++) {
      const f = 1 - j / 22;
      g.fillStyle = `rgba(255, 250, 220, ${f * (1 - p * 0.6)})`;
      g.fillRect(Math.round(hx + j * 2), Math.round(hy - j), 1, 1);
    }
    glow(g, hx, hy, 1.5, "255, 245, 200", 0.25 * (1 - p));
  }
  g.restore();
}
