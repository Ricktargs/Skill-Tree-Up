/* =========================================================
   HORTA (vista de cima)
   Um mapa de quadradinhos de 32 px: cerca de madeira em volta,
   2 canteiros de 4 × 6, caminho, poço (enche o regador),
   espantalho e árvores do lado de fora.
========================================================= */
import { BED_COLS, BED_ROWS, CROPS, stageOf, isWet } from "../lib/garden.js";
import { PAL, rng, shade, rect, px, disc } from "./pixelWorld.js";
import { cropSkinPath, skinImg } from "../../../shared/skins.js";

export const FT = 32;
export const FCOLS = 18;
export const FROWS = 16;
export const FW = FCOLS * FT;
export const FH = FROWS * FT;
// cerca: colunas 2 e 15, linhas 2 e 13 · porteira embaixo (colunas 8 e 9)
const FENCE = { c0: 2, c1: 15, r0: 2, r1: 13 };
export const GATE = [8, 9];
export const BEDS = [
  { c: 4, r: 5 },
  { c: 10, r: 5 }
];
export const WELL = { c: 13, r: 3, w: 2, h: 2 };
const SCARECROW = { c: 3, r: 4 };
const CRATE = { c: 11, r: 3 };
export const FARM_START = { x: 9 * FT, y: 13 * FT - 2 };

/** Índice do quadradinho de terra (0..47) ou -1. */
export function bedIndex(c, r) {
  for (let b = 0; b < BEDS.length; b++) {
    const B = BEDS[b];
    if (c >= B.c && c < B.c + BED_COLS && r >= B.r && r < B.r + BED_ROWS) return b * BED_COLS * BED_ROWS + (r - B.r) * BED_COLS + (c - B.c);
  }
  return -1;
}
export const tileOfIndex = (i) => {
  const b = Math.floor(i / (BED_COLS * BED_ROWS));
  const k = i % (BED_COLS * BED_ROWS);
  return { c: BEDS[b].c + (k % BED_COLS), r: BEDS[b].r + Math.floor(k / BED_COLS) };
};
export const isWell = (c, r) => c >= WELL.c && c < WELL.c + WELL.w && r >= WELL.r && r < WELL.r + WELL.h;
export const isGate = (c, r) => r === FENCE.r1 && GATE.includes(c);

/** Dá para andar neste quadradinho? */
export function farmSolid(c, r) {
  if (c < FENCE.c0 || c > FENCE.c1 || r < FENCE.r0 || r > FENCE.r1 + 1) return true;
  if (isGate(c, r) || r === FENCE.r1 + 1) return !GATE.includes(c);
  if (c === FENCE.c0 || c === FENCE.c1 || r === FENCE.r0 || r === FENCE.r1) return true;
  if (isWell(c, r)) return true;
  if (c === SCARECROW.c && r === SCARECROW.r) return true;
  if (c === CRATE.c && r === CRATE.r) return true;
  return false;
}

/* ---------------- desenho do mapa ---------------- */
function mk(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  return { c, g };
}
const inside = (c, r) => c > FENCE.c0 && c < FENCE.c1 && r > FENCE.r0 && r < FENCE.r1;

export function buildFarm(season) {
  const P = PAL[season];
  const winter = Boolean(P.snow);
  const r = rng(404);
  const { c, g } = mk(FW, FH);
  const grassA = winter ? "#e6eef3" : season === "outono" ? "#9fa84a" : "#6db84e";
  const grassB = winter ? "#ffffff" : season === "outono" ? "#b7b85a" : "#83c95c";
  const grassD = winter ? "#c7d4dd" : season === "outono" ? "#7f8a38" : "#4f9a3c";
  const dirt = ["#d9a35c", "#c99050", "#e6b878", "#b97f42"];

  // grama em tudo
  rect(g, 0, 0, FW, FH, grassA);
  for (let i = 0; i < 2600; i++) {
    const x = r() * FW;
    const y = r() * FH;
    px(g, x, y, r() < 0.5 ? grassB : grassD);
    if (r() < 0.2) px(g, x, y - 1, grassB);
  }
  // terra dentro da cerca
  for (let row = FENCE.r0 + 1; row < FENCE.r1; row++) {
    for (let col = FENCE.c0 + 1; col < FENCE.c1; col++) {
      const x = col * FT;
      const y = row * FT;
      rect(g, x, y, FT, FT, dirt[0]);
      for (let k = 0; k < 26; k++) px(g, x + r() * FT, y + r() * FT, dirt[1 + Math.floor(r() * 3)]);
      if (r() < 0.25) {
        disc(g, x + 6 + r() * 20, y + 6 + r() * 20, 1, "#a8a29e");
      }
    }
  }
  // tufinhos de grama na terra perto da cerca
  for (let i = 0; i < 70; i++) {
    const side = Math.floor(r() * 4);
    let x;
    let y;
    if (side === 0) [x, y] = [(FENCE.c0 + 1) * FT + r() * 10, (FENCE.r0 + 1) * FT + r() * (FENCE.r1 - FENCE.r0 - 1) * FT];
    else if (side === 1) [x, y] = [FENCE.c1 * FT - r() * 10, (FENCE.r0 + 1) * FT + r() * (FENCE.r1 - FENCE.r0 - 1) * FT];
    else if (side === 2) [x, y] = [(FENCE.c0 + 1) * FT + r() * (FENCE.c1 - FENCE.c0 - 1) * FT, (FENCE.r0 + 1) * FT + r() * 8];
    else [x, y] = [(FENCE.c0 + 1) * FT + r() * (FENCE.c1 - FENCE.c0 - 1) * FT, FENCE.r1 * FT - r() * 8];
    px(g, x, y, grassD);
    px(g, x + 1, y - 1, grassA);
    px(g, x - 1, y - 1, grassA);
  }
  // caminho
  for (let row = FENCE.r0 + 1; row <= FENCE.r1; row++) {
    for (const col of GATE) {
      const x = col * FT;
      const y = row * FT;
      rect(g, x + 2, y, FT - 4, FT, "#e4b97c");
      for (let k = 0; k < 18; k++) px(g, x + 2 + r() * (FT - 4), y + r() * FT, r() < 0.5 ? "#d2a564" : "#efc98f");
    }
  }
  // canteiros: terra arada com sulcos
  BEDS.forEach((B) => {
    const x0 = B.c * FT;
    const y0 = B.r * FT;
    rect(g, x0 - 2, y0 - 2, BED_COLS * FT + 4, BED_ROWS * FT + 4, "#8a5a2e");
    for (let rr = 0; rr < BED_ROWS; rr++) {
      for (let cc = 0; cc < BED_COLS; cc++) {
        const x = x0 + cc * FT;
        const y = y0 + rr * FT;
        rect(g, x + 1, y + 1, FT - 2, FT - 2, "#7a4a24");
        rect(g, x + 1, y + 1, FT - 2, 2, "#8f5c30");
        rect(g, x + 3, y + 10, FT - 6, 2, "#5e381a");
        rect(g, x + 3, y + 21, FT - 6, 2, "#5e381a");
        for (let k = 0; k < 10; k++) px(g, x + 2 + r() * (FT - 4), y + 2 + r() * (FT - 4), r() < 0.5 ? "#6a3f1d" : "#956034");
      }
    }
  });
  // cerca de madeira (vista de cima, um pouquinho de lado)
  const post = (x, y) => {
    rect(g, x - 3, y - 14, 7, 16, "#7a4a22");
    rect(g, x - 3, y - 14, 7, 3, "#a8743e");
    rect(g, x - 3, y + 1, 7, 1, "#4b2e14");
  };
  for (let col = FENCE.c0; col <= FENCE.c1; col++) {
    const x = col * FT + FT / 2;
    // de cima
    rect(g, col * FT, FENCE.r0 * FT + 10, FT, 3, "#a8743e");
    rect(g, col * FT, FENCE.r0 * FT + 17, FT, 3, "#8a5a2e");
    post(x, FENCE.r0 * FT + 22);
    // de baixo (com a porteira aberta)
    if (!GATE.includes(col)) {
      rect(g, col * FT, FENCE.r1 * FT + 10, FT, 3, "#a8743e");
      rect(g, col * FT, FENCE.r1 * FT + 17, FT, 3, "#8a5a2e");
      post(x, FENCE.r1 * FT + 22);
    }
  }
  // postes grandes da porteira
  [GATE[0] * FT, (GATE[1] + 1) * FT].forEach((x) => {
    rect(g, x - 4, FENCE.r1 * FT - 4, 8, 28, "#6b3f1f");
    rect(g, x - 4, FENCE.r1 * FT - 4, 8, 3, "#8a5a2e");
  });
  for (let row = FENCE.r0; row <= FENCE.r1; row++) {
    [FENCE.c0, FENCE.c1].forEach((col) => {
      const x = col * FT + FT / 2;
      rect(g, x - 1, row * FT, 3, FT, "#8a5a2e");
      post(x, row * FT + 22);
    });
  }
  // poço de pedra com telhadinho
  const wx = WELL.c * FT;
  const wy = WELL.r * FT;
  const ww = WELL.w * FT;
  rect(g, wx + 6, wy + 26, ww - 12, 30, "#9ca3af");
  for (let y = 0; y < 30; y += 6) {
    for (let x = (y / 6) % 2 ? 0 : 6; x < ww - 12; x += 12) {
      rect(g, wx + 6 + x, wy + 26 + y, 11, 5, "#a8b0b9");
      rect(g, wx + 6 + x, wy + 30 + y, 11, 1, "#6b7280");
    }
  }
  disc(g, wx + ww / 2, wy + 26, (ww - 12) / 2, "#6b7280");
  disc(g, wx + ww / 2, wy + 26, (ww - 18) / 2, "#1e3a5f");
  disc(g, wx + ww / 2 - 4, wy + 24, 4, "#2b5a8a");
  rect(g, wx + 8, wy - 2, 4, 30, "#6b3f1f");
  rect(g, wx + ww - 12, wy - 2, 4, 30, "#6b3f1f");
  rect(g, wx + 4, wy - 8, ww - 8, 8, "#7c2d12");
  rect(g, wx + 4, wy - 8, ww - 8, 2, "#9a3412");
  for (let x = wx + 6; x < wx + ww - 6; x += 5) rect(g, x, wy - 6, 1, 6, "#5c1e0b");
  rect(g, wx + ww / 2, wy, 1, 14, "#374151");
  rect(g, wx + ww / 2 - 3, wy + 14, 7, 6, "#8a5a2e");
  // espantalho
  const sx = SCARECROW.c * FT + FT / 2;
  const sy = SCARECROW.r * FT + FT - 4;
  rect(g, sx - 1, sy - 30, 3, 30, "#6b3f1f");
  rect(g, sx - 12, sy - 22, 25, 3, "#6b3f1f");
  rect(g, sx - 6, sy - 24, 13, 12, "#2563eb");
  rect(g, sx - 6, sy - 18, 13, 1, "#1e40af");
  disc(g, sx, sy - 29, 5, "#f5deb3");
  px(g, sx - 2, sy - 30, "#111827");
  px(g, sx + 2, sy - 30, "#111827");
  rect(g, sx - 9, sy - 35, 19, 3, "#d4a017");
  rect(g, sx - 5, sy - 39, 11, 5, "#d4a017");
  for (let k = 0; k < 6; k++) px(g, sx - 14 + k * 5, sy - 21 + (k % 2), "#facc15");
  // caixote de madeira
  const cx = CRATE.c * FT + 4;
  const cy = CRATE.r * FT + 6;
  rect(g, cx, cy, 24, 22, "#a8743e");
  rect(g, cx, cy, 24, 3, "#c48a52");
  rect(g, cx, cy + 10, 24, 2, "#7a4a22");
  rect(g, cx, cy, 2, 22, "#7a4a22");
  rect(g, cx + 22, cy, 2, 22, "#7a4a22");
  for (let k = 0; k < 3; k++) disc(g, cx + 6 + k * 6, cy + 2, 3, k % 2 ? "#f97316" : "#be185d");
  // árvores e moitas do lado de fora
  const tree = (x, y, s = 1) => {
    disc(g, x + 2, y + 6 * s, 15 * s, "rgba(0,0,0,0.18)");
    rect(g, x - 3 * s, y, 7 * s, 16 * s, "#6b3f1f");
    disc(g, x, y - 8 * s, 17 * s, shade(P.leaf[1], 0));
    disc(g, x - 6 * s, y - 4 * s, 11 * s, P.leaf[1]);
    disc(g, x + 7 * s, y - 5 * s, 11 * s, P.leaf[1]);
    disc(g, x - 4 * s, y - 13 * s, 9 * s, P.leaf[2]);
    for (let k = 0; k < 14; k++) px(g, x - 14 * s + r() * 28 * s, y - 22 * s + r() * 24 * s, P.leaf[3]);
    if (winter) rect(g, x - 10 * s, y - 25 * s, 20 * s, 3, "#ffffff");
    if (P.bloom) for (let k = 0; k < 6; k++) px(g, x - 12 + r() * 24, y - 20 + r() * 18, P.bloom);
  };
  const bushTop = (x, y) => {
    disc(g, x, y, 9, P.leaf[1]);
    disc(g, x - 3, y - 3, 5, P.leaf[2]);
    px(g, x + 2, y - 4, P.leaf[3]);
  };
  for (let col = 0; col < FCOLS; col += 1) {
    tree(col * FT + 10 + r() * 12, 30 + r() * 10, 0.9 + r() * 0.3);
    tree(col * FT + 10 + r() * 12, FH - 12 - r() * 8, 0.9 + r() * 0.3);
  }
  for (let row = 2; row < FROWS - 1; row += 1) {
    tree(18 + r() * 12, row * FT + 10, 0.9 + r() * 0.2);
    tree(FW - 18 - r() * 12, row * FT + 10, 0.9 + r() * 0.2);
  }
  for (let i = 0; i < 10; i++) bushTop((FENCE.c0 + 1) * FT + 8, (FENCE.r0 + 2 + i) * FT + 16);
  // flores
  if (P.flower.length) {
    for (let i = 0; i < 40; i++) {
      const x = r() * FW;
      const y = r() * FH;
      const col = Math.floor(x / FT);
      const row = Math.floor(y / FT);
      if (inside(col, row)) continue;
      px(g, x, y, P.flower[Math.floor(r() * P.flower.length)]);
    }
  }
  return c;
}

/* ---------------- plantas (mudam com o tempo) ---------------- */
// x, y = canto do quadradinho já na tela
export function drawSoilState(g, x, y, tile, now, t, raining = false) {
  if (!isWet(tile, now, raining)) return;
  g.fillStyle = "rgba(40, 20, 5, 0.42)";
  g.fillRect(x + 1, y + 1, FT - 2, FT - 2);
  if (Math.sin(t * 2 + x * 0.1 + y * 0.07) > 0.5) {
    px(g, x + 8, y + 15, "#93c5fd");
    px(g, x + 22, y + 6, "#93c5fd");
  }
}
// folhinha oval (com brilho em cima)
function leaf(g, x, y, w, h, col, hi) {
  for (let r = 0; r < h; r++) {
    const k = 1 - Math.abs((r - (h - 1) / 2) / (h / 2));
    const ww = Math.max(1, Math.round(w * (0.45 + 0.55 * k)));
    rect(g, x + Math.round((w - ww) / 2), y + r, ww, 1, col);
  }
  if (hi) rect(g, x + Math.round(w / 2) - 1, y, Math.max(1, Math.round(w / 3)), 1, hi);
}
function blob(g, x, y, r, col) {
  disc(g, x, y, r, col);
}
// raminho fino (de baixo para cima, curvando)
function stem(g, x, y, h, bend, col, t, k = 0) {
  for (let i = 0; i < h; i++) {
    const f = i / h;
    px(g, x + Math.round(bend * f * f + Math.sin(t * 1.4 + k) * f * 0.8), y - i, col);
  }
  return [x + Math.round(bend + Math.sin(t * 1.4 + k) * 0.8), y - h];
}

export function drawCrop(g, x, y, tile, t) {
  const stage = stageOf(tile);
  const crop = tile.crop;
  // skin da pasta: plantas/<planta>-<fase>.png (32 × 32, ocupa o quadradinho)
  const img = skinImg(cropSkinPath(crop, stage));
  if (img) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    g.drawImage(img, Math.round(x + (FT - w) / 2), Math.round(y + FT - h));
    return;
  }
  const cx = x + 16;
  const by = y + 27;
  // sombrinha no chão
  if (stage > 0) {
    g.fillStyle = "rgba(40, 20, 5, 0.25)";
    g.fillRect(cx - (stage === 3 ? 10 : 6), by - 1, stage === 3 ? 21 : 13, 3);
  }
  if (stage === 0) {
    rect(g, cx - 6, by - 3, 13, 4, "#5e381a");
    rect(g, cx - 5, by - 4, 11, 1, "#7a4a24");
    [[-3, -3], [0, -4], [3, -3]].forEach(([dx, dy]) => {
      px(g, cx + dx, by + dy, "#e8cf98");
      px(g, cx + dx + 1, by + dy, "#c4a072");
    });
    return;
  }
  const sw = (k) => Math.sin(t * 1.5 + x * 0.07 + y * 0.05 + k);

  if (crop === "cenoura") {
    const h = stage === 1 ? 5 : stage === 2 ? 13 : 19;
    const n = stage === 1 ? 2 : stage === 2 ? 4 : 6;
    for (let i = 0; i < n; i++) {
      const bend = (i - (n - 1) / 2) * (stage === 3 ? 3.2 : 2.4);
      const hh = h - (i % 2) * 3;
      const [tx0, ty0] = stem(g, cx, by - 2, hh, bend, "#16a34a", t, i);
      // folhas rendadas ao longo do raminho
      for (let k = 3; k < hh; k += 3) {
        const f = k / hh;
        const xx = cx + Math.round(bend * f * f);
        px(g, xx - 1, by - 2 - k, "#4ade80");
        px(g, xx + 1, by - 3 - k, "#4ade80");
        if (stage > 1) px(g, xx - 2, by - 3 - k, "#86efac");
      }
      px(g, tx0, ty0, "#86efac");
    }
    if (stage === 3) {
      // cenoura aparecendo
      rect(g, cx - 5, by - 3, 11, 5, "#f97316");
      rect(g, cx - 4, by + 2, 9, 2, "#ea580c");
      rect(g, cx - 4, by - 3, 9, 1, "#fdba74");
      px(g, cx - 2, by, "#c2410c");
      px(g, cx + 2, by - 1, "#c2410c");
    }
  } else if (crop === "batata") {
    const spread = stage === 1 ? 4 : stage === 2 ? 10 : 14;
    const leaves = stage === 1 ? 2 : stage === 2 ? 5 : 9;
    for (let i = 0; i < leaves; i++) {
      const a = (i / leaves) * Math.PI - Math.PI;
      const r = spread * (0.5 + 0.5 * ((i * 37) % 10) / 10);
      const lx = cx + Math.round(Math.cos(a) * r) - 3;
      const ly = by - 4 + Math.round(Math.sin(a) * r * 0.75) - (stage === 3 ? 4 : 2) + Math.round(sw(i) * 0.6);
      leaf(g, lx, ly, stage === 1 ? 4 : 7, stage === 1 ? 3 : 6, i % 2 ? "#15803d" : "#166534", "#22c55e");
      px(g, lx + 3, ly + 5, "#9d174d");
    }
    if (stage === 3) {
      [[-7, 0], [4, 1]].forEach(([dx, dy]) => {
        rect(g, cx + dx, by - 2 + dy, 7, 4, "#be185d");
        rect(g, cx + dx + 1, by - 2 + dy, 5, 1, "#f472b6");
        px(g, cx + dx + 2, by + dy, "#831843");
      });
    }
  } else if (crop === "trigo") {
    const h = stage === 1 ? 6 : stage === 2 ? 16 : 24;
    const n = stage === 1 ? 3 : 7;
    const gold = stage === 3;
    for (let i = 0; i < n; i++) {
      const bend = (i - (n - 1) / 2) * 1.6;
      const hh = h - (i % 3) * 2;
      const [tx0, ty0] = stem(g, cx + (i - (n - 1) / 2), by - 1, hh, bend, gold ? "#ca8a04" : "#65a30d", t, i * 0.7);
      if (stage >= 2) {
        // espiga
        for (let k = 0; k < (gold ? 7 : 4); k++) {
          px(g, tx0 - 1, ty0 + k, gold ? (k % 2 ? "#eab308" : "#fde68a") : "#84cc16");
          px(g, tx0 + 1, ty0 + k, gold ? (k % 2 ? "#fde68a" : "#eab308") : "#a3e635");
        }
        if (gold) {
          px(g, tx0 - 2, ty0 - 2, "#fef3c7");
          px(g, tx0 + 2, ty0 - 2, "#fef3c7");
          px(g, tx0, ty0 - 3, "#fef3c7");
        }
      }
      if (i % 2 === 0) px(g, cx + bend * 0.4 - 2, by - 5 - (i % 3), gold ? "#a16207" : "#4d7c0f");
    }
  } else if (crop === "arroz") {
    const h = stage === 1 ? 6 : stage === 2 ? 14 : 19;
    const n = stage === 1 ? 4 : 9;
    for (let i = 0; i < n; i++) {
      const bend = (i - (n - 1) / 2) * 2.2;
      const [tx0, ty0] = stem(g, cx, by - 1, h - (i % 2) * 3, bend, i % 2 ? "#22c55e" : "#16a34a", t, i);
      px(g, tx0, ty0, "#86efac");
      if (stage === 3 && i % 2 === 0) {
        // cacho de grãos pendurado
        const dir = bend >= 0 ? 1 : -1;
        for (let k = 0; k < 6; k++) {
          px(g, tx0 + dir * Math.round(k * 0.6), ty0 + k, k % 2 ? "#fde68a" : "#fef3c7");
          px(g, tx0 + dir * (Math.round(k * 0.6) + 1), ty0 + k + 1, "#e7d38a");
        }
      }
    }
    // água rasa do arrozal
    rect(g, cx - 8, by, 17, 2, "rgba(96, 165, 250, 0.45)");
  } else if (crop === "tomate") {
    const h = stage === 1 ? 7 : stage === 2 ? 17 : 24;
    // estaca de madeira
    rect(g, cx + 4, by - h - 2, 2, h + 2, "#8a5a2e");
    rect(g, cx + 4, by - h - 2, 2, 1, "#a8743e");
    const leaves = stage === 1 ? 2 : stage === 2 ? 6 : 9;
    for (let i = 0; i < leaves; i++) {
      const ly = by - 3 - Math.round((i / leaves) * h);
      const lx = cx + (i % 2 ? 1 : -7) + Math.round(sw(i) * 0.6);
      leaf(g, lx, ly - 3, 7, 5, i % 3 ? "#16a34a" : "#15803d", "#4ade80");
    }
    stem(g, cx, by - 1, h, 0, "#166534", t, 1);
    if (stage === 2) {
      [[-4, -8], [3, -12], [-2, -14]].forEach(([dx, dy]) => {
        px(g, cx + dx, by + dy, "#facc15");
        px(g, cx + dx + 1, by + dy, "#fde047");
      });
    }
    if (stage === 3) {
      [[-5, -6], [3, -9], [-3, -14], [4, -17], [-6, -19]].forEach(([dx, dy]) => {
        blob(g, cx + dx, by + dy, 2, "#dc2626");
        px(g, cx + dx - 1, by + dy - 1, "#fca5a5");
        px(g, cx + dx, by + dy - 3, "#16a34a");
      });
    }
  }

  if (stage === 3 && Math.sin(t * 4 + x + y) > 0.8) {
    px(g, cx + 8, by - 22, "#fef08a");
    px(g, cx + 8, by - 23, "#ffffff");
    px(g, cx + 7, by - 22, "#ffffff");
  }
}

export const cropName = (tile) => (tile ? CROPS[tile.crop].name : "");
