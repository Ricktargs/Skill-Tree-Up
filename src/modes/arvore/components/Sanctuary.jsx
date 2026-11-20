/* =========================================================
   SANTUÁRIO (protótipo)
   A Árvore vira o mundo do personagem, sem cobrança nenhuma,
   tudo no traço de nanquim e aquarela.
   - 3 layouts (como num editor de vila): Terra (padrão),
     Ilha voadora e Ilha com mar, cada um com as suas coisas.
     Um fica ativo; qualquer um pode ser editado.
   - Editando: adicionar árvores, lagos, barracas, fogueiras,
     vagalumes, lanternas e terra; arrastar tudo (inclusive a
     árvore principal), mudar o tamanho e remover. Árvores,
     lagos e acampamentos se encaixam no relevo; a terra levanta
     o chão e, nas ilhas, cria chão novo onde for colocada.
   - O herói anda pelo chão (W A S D) e pula (Espaço); a câmera
     acompanha quando ele chega perto da borda.
   As informações dos galhos ficam escondidas; os dados continuam
   guardados e voltam em "Ver como Árvore".
========================================================= */
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { BASE_Y, groundY, smoothPath, treeGeometry } from "../lib/growth";
import { canopyCircles } from "../lib/canopy";
import { hashString } from "../lib/ids";
import { loadJSON, saveJSON } from "../lib/storage";
import { sfx } from "../lib/sound";
import { ForestRoots, ForestTrunks } from "./TreeArt";
import { HeroModel } from "../../../atualizacao2_0/Hero.jsx";
import { DEFAULT_HERO, normalizeHero } from "../../../atualizacao2_0/HeroModels.js";
import { readProfileValue } from "../../../atualizacao2_0/ProfileStorage.js";
import { getActiveProfileId } from "../../../shared/activeProfile.js";
import { getModeActions } from "../../../shared/modeBridge.js";
import { ask, inform } from "../../../shared/Dialog.jsx";
import { useArvore } from "../state/contexts";
import { createSubbranch, deleteBranch } from "../lib/folders";
import { colorForId, generateId } from "../lib/ids";
import { ROOT_ID } from "../lib/constants";
import { findBranch } from "../lib/tree";
import { TEXT_FEATURES } from "../lib/standby";
import { DEFAULT_LAYOUT_ITEMS } from "../lib/sanctuaryDefaults";

/* ---------------- objetos do mundo ---------------- */
export const ITEM_TYPES = {
  main: { label: "a Árvore principal", name: "Árvore principal", icon: "🌳", min: 0.6, max: 1.6, half: 260, flip: true, random: true },
  tree: { label: "a árvore", name: "Árvore", icon: "🌳", min: 0.4, max: 1.8, half: 170, flip: true, random: true },
  lake: { label: "o lago", name: "Lago", icon: "🌊", min: 0.4, max: 2.4, half: 300 },
  tent: { label: "a barraca", name: "Barraca", icon: "⛺", min: 0.6, max: 1.8, half: 80, flip: true },
  fire: { label: "a fogueira", name: "Fogueira", icon: "🔥", min: 0.6, max: 2, half: 80, flip: true },
  post: { label: "a lanterna", name: "Lanterna", icon: "🏮", min: 0.6, max: 1.8, half: 20, flip: true },
  bgtree: { label: "a árvore de fundo", name: "Árvore de fundo", icon: "🌲", min: 0.4, max: 2.2, half: 170, flip: true, random: true, bg: true },
  bgisland: { label: "a ilha de fundo", name: "Ilha voadora de fundo", icon: "🏝️", min: 0.4, max: 2.2, half: 220, flip: true, random: true, bg: true },
  fireflies: { label: "os vagalumes", name: "Vagalumes", icon: "✨", min: 0.5, max: 2.5, half: 60 },
  land: { label: "a terra", name: "Terra", icon: "⛰️", min: 0.5, max: 3, half: 170 },
  grass: { label: "o matinho", name: "Matinho", icon: "🌿", min: 0.4, max: 2.6, half: 46, flip: true, random: true },
};
export const ADDABLE = ["land", "grass", "tree", "lake", "tent", "fire", "fireflies", "post"];
export const BG_ADDABLE = ["bgtree", "bgisland"];
const isBg = (i) => Boolean(ITEM_TYPES[i.type]?.bg);
const MAIN_X = 600; // onde a árvore principal é desenhada no layout

export const LAYOUT_KINDS = {
  terra: { name: "Terra", icon: "🌄", desc: "O chão de sempre, até o horizonte" },
  voadora: { name: "Ilha voadora", icon: "☁️", desc: "Uma ilha flutuando no céu" },
  mar: { name: "Ilha com mar", icon: "🌊", desc: "Uma ilha cercada de mar" },
};

const defaultItems = (pos = {}) => [
  { id: "main", type: "main", x: MAIN_X, size: 1 },
  { id: "tent", type: "tent", x: typeof pos.tent === "number" ? pos.tent : 260, size: 1 },
  { id: "fire", type: "fire", x: typeof pos.fire === "number" ? pos.fire : 355, size: 1 },
  { id: "lake", type: "lake", x: typeof pos.lake === "number" ? pos.lake : 1160, size: 1 },
  { id: "ff1", type: "fireflies", x: 1160, h: 70, size: 1 },
  { id: "ff2", type: "fireflies", x: 420, h: 80, size: 1 },
  { id: "ff3", type: "fireflies", x: 600, h: 190, size: 1.3 },
];
// cópia nova a cada uso (para não mexer no padrão guardado)
const defaultsFor = (kind) => JSON.parse(JSON.stringify(DEFAULT_LAYOUT_ITEMS[kind] || defaultItems()));
const defaultLayouts = (terraItems) => [
  { kind: "terra", items: terraItems || defaultsFor("terra") },
  { kind: "voadora", items: defaultsFor("voadora") },
  { kind: "mar", items: defaultsFor("mar") },
];

/* ---------------- preferências (por perfil) ---------------- */
const KEY = "eu-sou-arvore-santuario";
const DEFAULT = { on: true, lanterns: true, season: "auto", active: 0, grass: true };

const cleanItems = (list) => {
  let items = Array.isArray(list) ? list.filter((i) => i && ITEM_TYPES[i.type]) : defaultItems();
  if (!items.some((i) => i.type === "main")) items = [{ id: "main", type: "main", x: MAIN_X, size: 1 }, ...items];
  return items;
};

let state = null;
const listeners = new Set();
const read = () => {
  const v = { ...DEFAULT, ...(loadJSON(KEY, null) || {}) };
  let layouts;
  if (Array.isArray(v.layouts) && v.layouts.length === 3) {
    layouts = v.layouts.map((l, i) => ({ kind: Object.keys(LAYOUT_KINDS)[i], items: cleanItems(l.items), mined: Array.isArray(l.mined) ? l.mined : [] }));
  } else {
    // versões anteriores: o que já estava decorado vai para o layout Terra; perfil novo usa o padrão
    layouts = defaultLayouts(Array.isArray(v.items) ? cleanItems(v.items) : v.pos ? defaultItems(v.pos) : undefined);
  }
  const active = [0, 1, 2].includes(v.active) ? v.active : 0;
  // com os textos em espera, a Árvore é sempre o Santuário
  return {
    on: TEXT_FEATURES ? v.on : true,
    lanterns: v.lanterns,
    season: v.season,
    grass: v.grass !== false,
    layouts,
    active,
    viewing: null,
    editing: false,
    selected: null,
    poked: null,
    branchMode: false,
    branch: null,
  };
};
const get = () => {
  if (!state) state = read();
  return state;
};
const notify = () => listeners.forEach((l) => l());
/** Muda e salva (o que está sendo visto, o lápis e a seleção não são salvos). */
export const getSanctuaryPrefs = () => get();
export function setSanctuary(patch) {
  state = { ...get(), ...patch };
  const { on, lanterns, season, layouts, active, grass } = state;
  saveJSON(KEY, { on, lanterns, season, layouts, active, grass });
  notify();
}
/** Muda sem salvar (enquanto arrasta). */
function setLive(patch) {
  state = { ...get(), ...patch };
  notify();
}
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
/** Usado pela tela da Árvore: relê ao montar (troca de perfil). */
export function useSanctuary() {
  useEffect(() => {
    state = read();
    notify();
  }, []);
  return useSyncExternalStore(subscribe, get);
}
export const useSanctuaryState = () => useSyncExternalStore(subscribe, get);
/* modo galhos: clicar na árvore principal para editar os galhos dela */
export const selectBranch = (id) => setLive({ branch: get().branch === id ? null : id });
export const exitBranchMode = () => setLive({ branchMode: false, branch: null });

/** O layout que aparece na tela: o que está sendo editado, ou o ativo. */
export const shownIndex = (s) => (s.viewing ?? s.active);
export const shownLayout = (s) => s.layouts[shownIndex(s)];

const setItems = (items, live = false) => {
  const s = get();
  const idx = shownIndex(s);
  const layouts = s.layouts.map((l, i) => (i === idx ? { ...l, items } : l));
  (live ? setLive : setSanctuary)({ layouts });
};
const currentItems = () => shownLayout(get()).items;
const resetLayout = (kind) => {
  const s = get();
  const idx = shownIndex(s);
  setSanctuary({ layouts: s.layouts.map((l, i) => (i === idx ? { ...l, items: defaultsFor(kind), mined: [] } : l)) });
};

/* ---------------- quebrar blocos (com a mão, por enquanto) ---------------- */
// batidas em andamento (não salvas) e pedacinhos voando
const dig = { hits: new Map(), bursts: [], version: 0 };
const digListeners = new Set();
const digNotify = () => {
  dig.version += 1;
  digListeners.forEach((l) => l());
};
const useDig = () =>
  useSyncExternalStore(
    (l) => {
      digListeners.add(l);
      return () => digListeners.delete(l);
    },
    () => dig.version
  );
/** Uma batida no bloco (c, r). Devolve true se quebrou. */
export function hitBlock(world, c, r) {
  const k = world.blocks.keyOf(c, r);
  const type = world.blocks.blockType(c, r);
  if (!type || world.blocks.isMined(c, r)) return false;
  const need = BLOCK_TYPES[type]?.hits || 2;
  const n = (dig.hits.get(k) || 0) + 1;
  if (n < need) {
    dig.hits.set(k, n);
    sfx.play("branch");
    digNotify();
    return false;
  }
  dig.hits.delete(k);
  const id = Date.now() + Math.random();
  dig.bursts.push({ id, c, r, type });
  setTimeout(() => {
    dig.bursts = dig.bursts.filter((b) => b.id !== id);
    digNotify();
  }, 700);
  const s = get();
  const idx = shownIndex(s);
  const layouts = s.layouts.map((l, i) => (i === idx ? { ...l, mined: [...(l.mined || []), k] } : l));
  setSanctuary({ layouts });
  sfx.play("rustle");
  digNotify();
  return true;
}
const updateItem = (id, patch, live = false) => setItems(currentItems().map((i) => (i.id === id ? { ...i, ...patch } : i)), live);
export const removeItem = (id) => {
  if (!id || id === "main") return;
  setItems(currentItems().filter((i) => i.id !== id));
  setSanctuary({ selected: null });
};
export const resizeItem = (id, factor) => {
  const it = currentItems().find((i) => i.id === id);
  if (!it) return;
  const t = ITEM_TYPES[it.type];
  updateItem(id, { size: Math.round(Math.min(t.max, Math.max(t.min, (it.size || 1) * factor)) * 100) / 100 });
};
let heroX = MAIN_X + 150; // onde o herói está (para colocar coisas novas perto dele)
export const addItem = (type) => {
  const id = `${type}_${Date.now().toString(36)}`;
  const items = currentItems();
  let x = heroX + 110;
  if (type === "tree" || type === "lake" || type === "tent" || type === "land") {
    // coisas grandes nascem no fim do chão, num espaço livre
    const right = Math.max(...items.filter((i) => i.type !== "fireflies" && !isBg(i)).map((i) => i.x + ITEM_TYPES[i.type].half * (i.size || 1)));
    x = right + ITEM_TYPES[type].half * (type === "land" ? 0.6 : 1) + 40;
  }
  if (ITEM_TYPES[type].bg) x = heroX + (Math.random() - 0.5) * 500;
  const extra = type === "fireflies" ? { h: 90 } : type === "bgisland" ? { h: 260, layer: 2 } : type === "bgtree" ? { layer: 2 } : {};
  const item = { id, type, x: Math.round(x), size: 1, ...extra };
  setItems([...items, item]);
  setSanctuary({ editing: true, selected: id });
};

/* ---------------- estações (hemisfério sul) ---------------- */
export const SEASONS = [
  { id: "auto", label: "Automática", icon: "🗓️" },
  { id: "primavera", label: "Primavera", icon: "🌸" },
  { id: "verao", label: "Verão", icon: "☀️" },
  { id: "outono", label: "Outono", icon: "🍂" },
  { id: "inverno", label: "Inverno", icon: "❄️" },
];
export function seasonOf(choice) {
  if (choice && choice !== "auto") return choice;
  const m = new Date().getMonth(); // 0 = janeiro
  if (m === 11 || m <= 1) return "verao";
  if (m <= 4) return "outono";
  if (m <= 7) return "inverno";
  return "primavera";
}

const rand = (seed) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
const LEAF_PATH = "M 0,-5 C 3.5,-2 3.5,4 0,6.5 C -3.5,4 -3.5,-2 0,-5 Z";
export const LAKE_W = 600;

/* ---------------- blocos do terreno (estilo Terraria) ---------------- */
export const BLOCK = 40; // tamanho de um bloco (unidades do desenho)
const GRID_X0 = -4000; // a grade começa aqui (colunas alinhadas em qualquer layout)
const BLOCK_ROWS = { terra: 7, voadora: 4, mar: 5 };
// quantas batidas com a mão cada bloco aguenta
export const BLOCK_TYPES = {
  grass: { name: "Grama", hits: 2 },
  dirt: { name: "Terra", hits: 2 },
  sand: { name: "Areia", hits: 1 },
  wood: { name: "Madeira", hits: 3 },
  stone: { name: "Pedra", hits: 4 },
  cracked: { name: "Pedra rachada", hits: 2 },
  amethyst: { name: "Minério de ametista", hits: 5 },
};
const SEA = 676; // nível do mar (Ilha com mar)
const EDGE = 150; // largura da descida nas pontas das ilhas
const VOID = 2400; // "chão" fora da ilha voadora (não tem chão)
const TERRA_MIN = -1500;
const TERRA_MAX = 2900;

/* ---------------- o mundo de um layout ---------------- */
/** Chão + objetos. Nas ilhas, o chão só existe onde há coisas (ou terra). */
export function sanctuaryWorld(layout) {
  const kind = layout?.kind || "terra";
  const items = layout?.items || defaultItems();
  const lands = items.filter((i) => i.type === "land");
  // a terra levanta o relevo (um morrinho suave)
  const bump = (x) => {
    let b = 0;
    lands.forEach((l) => {
      const w = 170 * (l.size || 1);
      const d = Math.abs(x - l.x);
      if (d < w) b += 40 * (l.size || 1) * 0.5 * (1 + Math.cos((Math.PI * d) / w));
    });
    return b;
  };
  const base = (x) => groundY(x) - bump(x);

  // pedaços de chão das ilhas (juntando o que está perto)
  let segments = [];
  if (kind !== "terra") {
    const spans = items
      .filter((i) => i.type !== "fireflies" && !isBg(i))
      .map((i) => {
        const half = ITEM_TYPES[i.type].half * (i.size || 1);
        return [i.x - half - EDGE - 40, i.x + half + EDGE + 40];
      })
      .sort((a, b) => a[0] - b[0]);
    spans.forEach(([a, b]) => {
      const last = segments[segments.length - 1];
      if (last && a <= last[1] + 20) last[1] = Math.max(last[1], b);
      else segments.push([a, b]);
    });
    if (!segments.length) segments = [[MAIN_X - 500, MAIN_X + 500]];
  }
  const segOf = (x) => segments.find(([a, b]) => x >= a && x <= b);
  const nearestSeg = (x) =>
    segments.reduce((best, s) => {
      const d = x < s[0] ? s[0] - x : x > s[1] ? x - s[1] : 0;
      return !best || d < best.d ? { s, d } : best;
    }, null)?.s;

  const smoothTop = (x) => {
    if (kind === "terra") return base(x);
    const seg = segOf(x);
    if (!seg) return kind === "mar" ? SEA + 30 : VOID;
    const g = base(x);
    const e = Math.min(x - seg[0], seg[1] - x);
    if (e >= EDGE) return g;
    const t = smooth(1 - e / EDGE);
    // com mar: desce até a água; voadora: só arredonda a borda
    return kind === "mar" ? g + (SEA + 30 - g) * Math.pow(t, 1.4) : g + 46 * Math.pow(t, 2);
  };
  const walk = (x) => {
    if (kind === "terra") return { min: TERRA_MIN, max: TERRA_MAX };
    const seg = segOf(x) || nearestSeg(x);
    return { min: seg[0] + EDGE * 0.45, max: seg[1] - EDGE * 0.45 };
  };
  // Água dos lagos (mesma conta do desenho do Lago): onde o herói afunda
  const pools = items
    .filter((i) => i.type === "lake")
    .map((l) => {
      const size = l.size || 1;
      const W = LAKE_W * size;
      const a = l.x - W / 2 + W * 0.16;
      const b = l.x + W / 2 - W * 0.16;
      const step = Math.max(8, 12 * size);
      let lowest = -Infinity;
      for (let px = a; px <= b; px += step) lowest = Math.max(lowest, smoothTop(px));
      return { from: a - W * 0.02, to: b + W * 0.02, x0: l.x - W / 2, x1: l.x + W / 2, level: lowest + 8 * Math.min(1.4, size), size };
    });
  const water = (x) => pools.find((w) => x >= w.from && x <= w.to) || null;

  // ---- blocos: colunas de BLOCK de largura; o chão vira degraus ----
  const B = BLOCK;
  const colOf = (x) => Math.floor((x - GRID_X0) / B);
  const colX0 = (c) => GRID_X0 + c * B;
  const colMid = (c) => colX0(c) + B / 2;
  const range = kind === "terra" ? [[TERRA_MIN - 320, TERRA_MAX + 320]] : segments;
  const inRange = (x) => range.some(([a, b]) => x >= a && x <= b);
  const landMemo = new Map();
  const isLand = (c) => {
    if (landMemo.has(c)) return landMemo.get(c);
    const xm = colMid(c);
    const st = smoothTop(xm);
    const ok =
      inRange(xm) &&
      !water(xm) &&
      // o lago inteiro (com o barranco) fica sem blocos
      !pools.some((w) => colX0(c) + B > w.x0 && colX0(c) < w.x1) &&
      (kind === "terra" || (kind === "mar" ? st < SEA - 6 : st < VOID - 200));
    landMemo.set(c, ok);
    return ok;
  };
  const surf = (c) => Math.round(smoothTop(colMid(c)) / B) * B;
  const rowsOf = (c) => {
    const n = BLOCK_ROWS[kind] || 6;
    if (kind !== "mar") return n;
    return Math.max(1, Math.min(n, Math.floor((SEA + 30 - surf(c)) / B)));
  };
  // topo do chão: em degraus onde há blocos (as decorações apoiam aqui)
  const top = (x) => {
    const c = colOf(x);
    return isLand(c) ? surf(c) : smoothTop(x);
  };
  const mined = new Set(Array.isArray(layout?.mined) ? layout.mined : []);
  const keyOf = (c, r) => `${c},${r}`;
  // o "fim do terreno": últimas colunas à direita (onde fica a ametista)
  const lastLand = (() => {
    const [, b] = range[range.length - 1] || [0, 0];
    let c = colOf(b);
    while (c > colOf(b) - 60 && !isLand(c)) c -= 1;
    return c;
  })();
  const trees = items.filter((i) => i.type === "tree");
  const sandy = (c) => pools.some((w) => colMid(c) > w.x0 - 2.5 * B && colMid(c) < w.x1 + 2.5 * B);
  const blockType = (c, r) => {
    if (!isLand(c) || r < 0 || r >= rowsOf(c)) return null;
    const h = rand(c * 7.13 + r * 3.71 + 0.5);
    const xm = colMid(c);
    if (sandy(c) && r <= 1) return "sand";
    if (sandy(c) && r === 2 && h < 0.5) return "sand";
    // raízes viram madeira embaixo das árvores
    if (r >= 1 && r <= 3 && Math.abs(xm - main.x) < 42 * (main.size || 1)) return "wood";
    if (r >= 1 && r <= 2 && trees.some((t) => Math.abs(xm - t.x) < 24 * (t.size || 1))) return "wood";
    if (r === 0) return "grass";
    if (r <= 2) return r === 2 && h < 0.3 ? "stone" : "dirt";
    if (r >= 3 && c >= lastLand - 7 && h < 0.5) return "amethyst";
    return h < 0.18 ? "cracked" : "stone";
  };
  const isMined = (c, r) => mined.has(keyOf(c, r));
  const solid = (c, r) => Boolean(blockType(c, r)) && !isMined(c, r);
  // chão de verdade sob os pés (considera os blocos quebrados)
  const groundBlock = (x) => {
    const c = colOf(x);
    if (!isLand(c)) return null;
    const n = rowsOf(c);
    for (let r = 0; r < n; r++) if (solid(c, r)) return surf(c) + r * B;
    return surf(c) + n * B; // embaixo de tudo: rocha que não quebra
  };
  // contorno do chão em degraus (para o desenho da terra por baixo)
  const outline = (from, to, step = 25) => {
    const pts = [];
    let x = from;
    while (x <= to) {
      const c = colOf(x);
      if (isLand(c)) {
        const x1 = Math.min(colX0(c) + B, to);
        pts.push([Math.max(colX0(c), from), surf(c)], [x1, surf(c)]);
        x = colX0(c) + B + 0.001;
      } else {
        pts.push([x, smoothTop(x)]);
        x += step;
      }
    }
    return pts;
  };
  const landCols = [];
  range.forEach(([a, b]) => {
    for (let c = colOf(a); c <= colOf(b); c++) if (isLand(c)) landCols.push(c);
  });
  const main = items.find((i) => i.type === "main") || { x: MAIN_X, size: 1 };
  // o pé do tronco entra um pouco na terra: o corte no chão (GroundClip)
  // esconde o que fica enterrado, e o tronco sempre encosta no terreno
  const mainBase = top(main.x) + 14;
  const xs = segments.flat();
  return {
    kind,
    items,
    segments,
    top,
    smoothTop,
    walk,
    water,
    pools,
    main,
    blocks: { B, colOf, colX0, surf, rowsOf, blockType, isMined, solid, groundBlock, landCols, keyOf, mined },
    outline,
    xL: kind === "terra" ? TERRA_MIN : Math.min(...xs),
    xR: kind === "terra" ? TERRA_MAX : Math.max(...xs),
    mainTransform: `translate(${main.x} ${mainBase}) scale(${(main.flip ? -1 : 1) * (main.size || 1)} ${main.size || 1}) translate(${-MAIN_X} ${-BASE_Y})`,
  };
}

/* ---------------- chão de cada layout ---------------- */
const groundStrokes = (from, to, top, count = 12) => {
  const out = [];
  for (let i = 0; i < count; i++) {
    const dy = 16 + i * 22 + rand(i + 1) * 8;
    const s = from + rand(i + 3) * 120 + i * 14;
    const e = to - rand(i + 5) * 120 - i * 14;
    if (e - s < 60) continue;
    const line = [];
    for (let x = s; x <= e; x += 40) line.push([x, top(x) + dy + Math.sin(x / (70 + i * 9) + i) * (3 + i)]);
    out.push({ d: smoothPath(line), w: 0.9 + rand(i + 11) * 2, o: 0.25 + rand(i + 13) * 0.4, dash: `${100 + rand(i) * 220} ${20 + rand(i + 2) * 50} ${40 + rand(i + 4) * 100} ${15 + rand(i + 6) * 30}` });
  }
  return out;
};
const grassTufts = (from, to, top) => {
  const tufts = [];
  for (let x = from; x < to; x += 38 + rand(x) * 40) {
    const y = top(x) + 1;
    const h = 5 + rand(x + 1) * 9;
    const lean = (rand(x + 2) - 0.5) * 6;
    tufts.push(`M ${x - 3} ${y} q ${lean * 0.3} ${-h * 0.6} ${lean - 1} ${-h} M ${x} ${y} q ${lean * 0.2} ${-h * 0.8} ${lean + 1} ${-h * 1.25} M ${x + 3} ${y} q ${lean * 0.4} ${-h * 0.5} ${lean + 3} ${-h * 0.8}`);
  }
  return tufts.join(" ");
};

function Earth({ body, strokes, tufts }) {
  return (
    <>
      <path d={body} fill="url(#ground-fill)" />
      <path d={body} fill="url(#grain-dark)" opacity="0.55" />
      <path d={body} fill="url(#grain-light)" opacity="0.18" />
      <path className="grass" d={tufts} />
      {strokes.map((s, i) => (
        <path key={i} className="ground-stroke" d={s.d} style={{ strokeWidth: s.w, opacity: s.o, strokeDasharray: s.dash }} />
      ))}
    </>
  );
}

export const WorldGround = memo(function WorldGround({ world }) {
  const { kind, top, segments } = world;
  if (kind === "terra") {
    const pts = world.outline(TERRA_MIN - 1500, TERRA_MAX + 1500);
    const body = `M ${pts.map((q) => q.join(" ")).join(" L ")} L ${TERRA_MAX + 1500} 4000 L ${TERRA_MIN - 1500} 4000 Z`;
    return (
      <g className="ground" aria-hidden="true">
        <Earth body={body} strokes={groundStrokes(-1100, 2200, top, 14)} tufts={grassTufts(-700, 1950, top)} />
      </g>
    );
  }
  return (
    <g className={`sanc-island ${kind}`} aria-hidden="true">
      {kind === "mar" && <rect className="sanc-sea-deep" x={-6000} y={SEA} width={14000} height="3000" />}
      {segments.map(([a, b], si) => {
        const pts = world.outline(a, b, 20);
        const under = [];
        const w = b - a;
        // voadora: a parte de baixo é uma rocha pendurada; com mar: fica sob a água
        const depth = kind === "voadora" ? clamp(w * 0.42, 150, 420) : 190;
        for (let i = 0; i <= 14; i++) {
          const t = i / 14;
          const x = b - w * t;
          const shape = kind === "voadora" ? Math.pow(Math.sin(Math.PI * t), 0.7) : Math.sin(Math.PI * t);
          const y0 = kind === "voadora" ? top(x) + 30 : SEA + 40;
          under.push([x, y0 + shape * depth + (rand(i + 3 + si * 7) - 0.5) * (kind === "voadora" ? 34 : 20)]);
        }
        // topo em degraus (retas) + parte de baixo arredondada
        const body = `M ${pts.map((q) => q.join(" ")).join(" L ")} ${smoothPath(under).replace(/^M/, "L")} Z`;
        // raízes e cipós pendurados embaixo da ilha voadora
        const hangs =
          kind === "voadora"
            ? Array.from({ length: Math.round(w / 90) }, (_, i) => {
                const t = (i + 0.5) / Math.round(w / 90);
                const x = a + w * t;
                const yb = top(x) + 30 + Math.pow(Math.sin(Math.PI * t), 0.7) * depth * 0.92;
                const len = 20 + rand(i + si * 11) * 70;
                const sway = (rand(i + 5 + si) - 0.5) * 16;
                return `M ${x} ${yb} q ${sway} ${len / 2} ${sway * 0.4} ${len}`;
              }).join(" ")
            : "";
        return (
          <g key={si}>
            <Earth body={body} strokes={groundStrokes(a + EDGE * 0.5, b - EDGE * 0.5, top, kind === "voadora" ? 8 : 9)} tufts={grassTufts(a + EDGE * 0.6, b - EDGE * 0.6, top)} />
            {kind === "voadora" && <path className="sanc-hang" d={hangs} />}
          </g>
        );
      })}
      {kind === "mar" && (
        <>
          <rect className="sanc-sea" x={-6000} y={SEA} width={14000} height="3000" filter="url(#watercolor)" />
          <line className="sanc-sea-line" x1={-6000} y1={SEA} x2={8000} y2={SEA} />
          {Array.from({ length: 8 }, (_, i) => {
            const y = SEA + 10 + i * 22;
            const x0 = world.xL - 900 + rand(i + 21) * 300;
            const x1 = world.xR + 900 - rand(i + 23) * 300;
            return (
              <path
                key={i}
                className="sanc-wave"
                d={`M ${x0} ${y} Q ${(x0 + x1) / 2} ${y + 4} ${x1} ${y}`}
                style={{ opacity: 0.18 + rand(i + 25) * 0.3, strokeDasharray: `${60 + rand(i) * 140} ${30 + rand(i + 1) * 60}`, animationDelay: `${-i * 1.3}s` }}
              />
            );
          })}
        </>
      )}
    </g>
  );
});

/** Miniatura de um layout (para o editor de layouts). */
export function LayoutPreview({ layout }) {
  const w = sanctuaryWorld(layout);
  const x0 = w.kind === "terra" ? -200 : w.xL - 120;
  const x1 = w.kind === "terra" ? 1700 : w.xR + 120;
  const pts = [];
  if (w.kind === "terra") {
    for (let x = x0; x <= x1; x += 40) pts.push([x, w.top(x)]);
  }
  const vbY = 300;
  const vbH = 520;
  return (
    <svg className={`sanc-preview ${w.kind}`} viewBox={`${x0} ${vbY} ${x1 - x0} ${vbH}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {w.kind === "mar" && <rect className="pv-sea" x={x0 - 100} y={SEA} width={x1 - x0 + 200} height={vbH} />}
      {w.kind === "terra" && <path className="pv-ground" d={`${smoothPath(pts)} L ${x1} ${vbY + vbH} L ${x0} ${vbY + vbH} Z`} />}
      {w.kind !== "terra" &&
        w.segments.map(([a, b], i) => {
          const top = [];
          for (let x = a; x <= b; x += 30) top.push([x, w.top(x)]);
          const depth = w.kind === "voadora" ? clamp((b - a) * 0.42, 150, 420) : SEA + 200 - Math.max(...top.map((p) => p[1]));
          const mid = (a + b) / 2;
          const bottomY = w.kind === "voadora" ? Math.max(...top.map((p) => p[1])) + depth : SEA + 200;
          return <path key={i} className="pv-ground" d={`${smoothPath(top)} Q ${mid} ${bottomY} ${a} ${top[0][1]} Z`} />;
        })}
      {w.items.map((it) => {
        const y = w.top(it.x);
        const s = it.size || 1;
        if (it.type === "main") return <path key={it.id} className="pv-tree main" d={`M ${it.x} ${y} L ${it.x} ${y - 300 * s}`} />;
        if (it.type === "tree") return <path key={it.id} className="pv-tree" d={`M ${it.x} ${y} L ${it.x} ${y - 230 * s}`} />;
        if (it.type === "lake") return <ellipse key={it.id} className="pv-lake" cx={it.x} cy={y + 8} rx={250 * s} ry="18" />;
        if (it.type === "tent") return <path key={it.id} className="pv-tent" d={`M ${it.x - 55 * s} ${y} L ${it.x} ${y - 80 * s} L ${it.x + 55 * s} ${y} Z`} />;
        if (it.type === "fire") return <circle key={it.id} className="pv-fire" cx={it.x} cy={y - 14} r={16 * s} />;
        if (it.type === "post") return <path key={it.id} className="pv-post" d={`M ${it.x} ${y} L ${it.x} ${y - 70 * s}`} />;
        return null;
      })}
      {w.items
        .filter((i) => i.type === "main" || i.type === "tree")
        .map((it) => {
          const s = it.size || 1;
          const y = w.top(it.x) - (it.type === "main" ? 330 : 250) * s;
          return <circle key={`c-${it.id}`} className="pv-canopy" cx={it.x} cy={y} r={(it.type === "main" ? 150 : 110) * s} />;
        })}
    </svg>
  );
}

/* ---------------- arrastar pelo terreno (lápis) ---------------- */
/** Sorteia um desenho novo para a árvore (a principal usa o "Aleatorizar galhos"). */
export const randomizeItem = (item) => {
  if (item.type === "main") getModeActions("arvore")?.shuffle?.();
  else updateItem(item.id, { seed: Math.floor(Math.random() * 1e6) });
};

function Draggable({ item, world, children, transform, pokeAt }) {
  const { editing, selected, poked } = useSanctuaryState();
  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    if (!editing) {
      // fora do lápis: clicar numa árvore mostra a bolinha de aleatorizar
      if (item.type === "main") setLive({ branchMode: true, poked: null });
      else if (ITEM_TYPES[item.type]?.random) setLive({ poked: get().poked === item.id ? null : item.id });
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    // a camada "sanc-world" usa as mesmas coordenadas do desenho
    const layer = e.currentTarget.closest(".sanc-world") || e.currentTarget.parentNode;
    const ctm = layer.getScreenCTM();
    if (!ctm) return;
    const inv = ctm.inverse();
    const toP = (ev) => new DOMPoint(ev.clientX, ev.clientY).matrixTransform(inv);
    const p0 = toP(e);
    const grabX = p0.x - item.x;
    const h0 = item.h || 0;
    setLive({ selected: item.id });
    const move = (ev) => {
      const p = toP(ev);
      const x = Math.round(clamp(p.x - grabX, -2500, 3800));
      const patch = { x };
      if (item.type === "fireflies") patch.h = Math.round(clamp(world.top(x) - p.y, 20, 420));
      // fundo: sobe e desce livre (árvores no chão, no morro ou no céu)
      if (item.type === "bgisland") patch.h = Math.round(clamp((item.h || 260) + (p0.y - p.y), -400, 1600));
      if (item.type === "bgtree") patch.h = Math.round(clamp(h0 + (p0.y - p.y), -400, 1600));
      updateItem(item.id, patch, true);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setSanctuary({});
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  return (
    <g
      className={`sanc-drag ${editing ? "editable" : ""} ${editing && selected === item.id ? "selected" : ""}`}
      transform={transform}
      onPointerDown={onPointerDown}
    >
      {editing && <title>{`Arraste ${ITEM_TYPES[item.type].label} · Delete remove · + e − mudam o tamanho`}</title>}
      {children}
      {!editing && poked === item.id && pokeAt && (
        <g
          className="sanc-poke"
          transform={`translate(${pokeAt.x} ${pokeAt.y})`}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            randomizeItem(item);
          }}
        >
          <title>Aleatorizar esta árvore</title>
          <circle r="30" />
          <text y="10" textAnchor="middle">🎲</text>
        </g>
      )}
    </g>
  );
}

/** Mostra só o que está acima do chão (o resto fica "enterrado"). */
let clipSeq = 0;
function GroundClip({ world, x, half, children }) {
  const [id] = useState(() => `sanc-ground-clip-${++clipSeq}`);
  const pts = [];
  const from = x - half;
  const to = x + half;
  for (let px = from; px <= to; px += 12) pts.push(`${Math.round(px)},${(world.top(px) + 1).toFixed(1)}`);
  pts.push(`${Math.round(to)},${(world.top(to) + 1).toFixed(1)}`, `${Math.round(to)},-8000`, `${Math.round(from)},-8000`);
  return (
    <>
      <defs>
        <clipPath id={id} clipPathUnits="userSpaceOnUse">
          <polygon points={pts.join(" ")} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>{children}</g>
    </>
  );
}

/** Envolve o desenho da árvore principal: posição, tamanho e arrasto. */
export function MainTreeWrap({ world, children }) {
  if (!world) return children;
  const size = world.main.size || 1;
  return (
    <GroundClip world={world} x={world.main.x} half={1100 * size}>
      <Draggable item={world.main} world={world} transform={world.mainTransform} pokeAt={{ x: MAIN_X, y: BASE_Y - 250 }}>
        {children}
      </Draggable>
    </GroundClip>
  );
}

/** Raízes da árvore principal: atrás do terreno (só aparece o que sai da terra). */
export function MainTreeRoots({ world, children }) {
  return (
    <g className="sanc-main-roots" transform={world.mainTransform} aria-hidden="true">
      {children}
    </g>
  );
}

/* ---------------- blocos (estilo Terraria, traço de nanquim) ---------------- */
const BLOCK_ORDER = ["grass", "dirt", "sand", "wood", "stone", "cracked", "amethyst"];
const cell = (x, y, B) => `M ${x} ${y} h ${B} v ${B} h ${-B} Z`;
export const WorldBlocks = memo(function WorldBlocks({ world }) {
  useDig();
  const bl = world.blocks;
  const B = bl.B;
  const byType = {};
  const holes = [];
  const shade = [];
  bl.landCols.forEach((c) => {
    const x = bl.colX0(c);
    const y0 = bl.surf(c);
    const n = bl.rowsOf(c);
    for (let r = 0; r < n; r++) {
      const t = bl.blockType(c, r);
      if (!t) continue;
      const y = y0 + r * B;
      if (bl.isMined(c, r)) {
        holes.push(cell(x, y, B));
        continue;
      }
      (byType[t] = byType[t] || []).push(cell(x, y, B));
      if (r > 0) (shade[r] = shade[r] || []).push(cell(x, y, B));
    }
  });
  // rachaduras das batidas em andamento
  const cracks = [];
  dig.hits.forEach((n, k) => {
    const [c, r] = k.split(",").map(Number);
    const t = bl.blockType(c, r);
    if (!t || bl.isMined(c, r)) return;
    const need = BLOCK_TYPES[t]?.hits || 2;
    const x = bl.colX0(c);
    const y = bl.surf(c) + r * B;
    const lines = [
      `M ${x + B * 0.5} ${y + B * 0.5} l ${-B * 0.32} ${-B * 0.18} M ${x + B * 0.5} ${y + B * 0.5} l ${B * 0.28} ${-B * 0.3}`,
      `M ${x + B * 0.5} ${y + B * 0.5} l ${B * 0.3} ${B * 0.2} M ${x + B * 0.5} ${y + B * 0.5} l ${-B * 0.12} ${B * 0.38}`,
      `M ${x + B * 0.18} ${y + B * 0.32} l ${-B * 0.12} ${-B * 0.2} M ${x + B * 0.78} ${y + B * 0.2} l ${B * 0.14} ${-B * 0.12} M ${x + B * 0.8} ${y + B * 0.7} l ${B * 0.12} ${B * 0.1}`,
      `M ${x + B * 0.38} ${y + B * 0.88} l ${-B * 0.16} ${B * 0.1} M ${x + B * 0.1} ${y + B * 0.6} l ${-B * 0.08} ${B * 0.04}`,
    ];
    const stage = Math.min(lines.length, Math.ceil((n / need) * lines.length));
    cracks.push(<path key={k} className="blk-crack" d={lines.slice(0, stage).join(" ")} />);
  });
  return (
    <g className="sanc-blocks" aria-hidden="true">
      <defs>
        {/* texturas: cada bloco do tamanho de uma célula (alinhadas à grade) */}
        <pattern id="blk-grass" patternUnits="userSpaceOnUse" x={GRID_X0} y="0" width={B} height={B}>
          <rect className="bt-dirt" width={B} height={B} />
          <path className="bt-speck" d={`M ${B * 0.3} ${B * 0.62} h 2 M ${B * 0.7} ${B * 0.78} h 2 M ${B * 0.52} ${B * 0.9} h 1.5`} />
          <path className="bt-grass" d={`M 0 0 H ${B} V ${B * 0.3} q ${-B * 0.1} ${B * 0.1} ${-B * 0.2} 0 q ${-B * 0.12} ${B * 0.14} ${-B * 0.26} 0 q ${-B * 0.1} ${B * 0.12} ${-B * 0.24} 0 q ${-B * 0.1} ${B * 0.1} ${-B * 0.3} 0 Z`} />
          <path className="bt-blade" d={`M ${B * 0.15} 0 v ${-B * 0.12} M ${B * 0.45} 0 v ${-B * 0.16} M ${B * 0.78} 0 v ${-B * 0.1}`} />
        </pattern>
        <pattern id="blk-dirt" patternUnits="userSpaceOnUse" x={GRID_X0} y="0" width={B} height={B}>
          <rect className="bt-dirt" width={B} height={B} />
          <path className="bt-speck" d={`M ${B * 0.2} ${B * 0.25} h 2.5 M ${B * 0.68} ${B * 0.18} h 2 M ${B * 0.42} ${B * 0.55} h 2.5 M ${B * 0.8} ${B * 0.62} h 2 M ${B * 0.18} ${B * 0.82} h 2 M ${B * 0.6} ${B * 0.86} h 1.5`} />
          <circle className="bt-pebble" cx={B * 0.72} cy={B * 0.38} r={B * 0.06} />
        </pattern>
        <pattern id="blk-sand" patternUnits="userSpaceOnUse" x={GRID_X0} y="0" width={B} height={B}>
          <rect className="bt-sand" width={B} height={B} />
          <path className="bt-sand-dot" d={`M ${B * 0.15} ${B * 0.2} h .8 M ${B * 0.5} ${B * 0.12} h .8 M ${B * 0.82} ${B * 0.3} h .8 M ${B * 0.3} ${B * 0.5} h .8 M ${B * 0.66} ${B * 0.58} h .8 M ${B * 0.12} ${B * 0.78} h .8 M ${B * 0.48} ${B * 0.86} h .8 M ${B * 0.86} ${B * 0.8} h .8`} />
          <path className="bt-sand-wave" d={`M ${B * 0.1} ${B * 0.38} q ${B * 0.15} ${-B * 0.06} ${B * 0.3} 0 M ${B * 0.5} ${B * 0.7} q ${B * 0.15} ${-B * 0.06} ${B * 0.3} 0`} />
        </pattern>
        <pattern id="blk-wood" patternUnits="userSpaceOnUse" x={GRID_X0} y="0" width={B} height={B}>
          <rect className="bt-wood" width={B} height={B} />
          <path className="bt-plank" d={`M 0 ${B / 3} H ${B} M 0 ${(2 * B) / 3} H ${B} M ${B * 0.55} 0 V ${B / 3} M ${B * 0.25} ${B / 3} V ${(2 * B) / 3} M ${B * 0.7} ${(2 * B) / 3} V ${B}`} />
          <path className="bt-grain" d={`M ${B * 0.06} ${B * 0.16} h ${B * 0.36} M ${B * 0.62} ${B * 0.2} h ${B * 0.3} M ${B * 0.32} ${B * 0.5} h ${B * 0.5} M ${B * 0.08} ${B * 0.84} h ${B * 0.5}`} />
          <circle className="bt-knot" cx={B * 0.84} cy={B * 0.84} r={B * 0.05} />
        </pattern>
        <pattern id="blk-stone" patternUnits="userSpaceOnUse" x={GRID_X0} y="0" width={B} height={B}>
          <rect className="bt-stone" width={B} height={B} />
          <path className="bt-rock" d={`M ${B * 0.12} ${B * 0.18} q ${B * 0.16} ${-B * 0.08} ${B * 0.3} ${B * 0.04} q ${B * 0.06} ${B * 0.16} ${-B * 0.12} ${B * 0.2} q ${-B * 0.2} ${-B * 0.02} ${-B * 0.18} ${-B * 0.24} Z M ${B * 0.58} ${B * 0.52} q ${B * 0.2} ${-B * 0.06} ${B * 0.3} ${B * 0.08} q ${B * 0.02} ${B * 0.18} ${-B * 0.16} ${B * 0.2} q ${-B * 0.18} ${-B * 0.04} ${-B * 0.14} ${-B * 0.28} Z`} />
          <path className="bt-line" d={`M ${B * 0.1} ${B * 0.72} l ${B * 0.18} ${B * 0.06} M ${B * 0.66} ${B * 0.16} l ${B * 0.16} ${-B * 0.04}`} />
        </pattern>
        <pattern id="blk-cracked" patternUnits="userSpaceOnUse" x={GRID_X0} y="0" width={B} height={B}>
          <rect className="bt-stone dark" width={B} height={B} />
          <path className="bt-crackline" d={`M ${B * 0.08} ${B * 0.2} l ${B * 0.22} ${B * 0.12} l ${B * 0.08} ${B * 0.2} l ${B * 0.26} ${B * 0.06} l ${B * 0.1} ${B * 0.26} M ${B * 0.38} ${B * 0.52} l ${-B * 0.14} ${B * 0.3} M ${B * 0.64} ${B * 0.58} l ${B * 0.26} ${-B * 0.16} M ${B * 0.72} ${B * 0.1} l ${-B * 0.06} ${B * 0.2}`} />
        </pattern>
        <pattern id="blk-amethyst" patternUnits="userSpaceOnUse" x={GRID_X0} y="0" width={B} height={B}>
          <rect className="bt-stone dark" width={B} height={B} />
          <path className="bt-gem" d={`M ${B * 0.2} ${B * 0.7} l ${B * 0.08} ${-B * 0.3} l ${B * 0.1} ${B * 0.3} Z M ${B * 0.5} ${B * 0.62} l ${B * 0.1} ${-B * 0.42} l ${B * 0.12} ${B * 0.42} Z M ${B * 0.66} ${B * 0.86} l ${B * 0.06} ${-B * 0.2} l ${B * 0.08} ${B * 0.2} Z M ${B * 0.14} ${B * 0.26} l ${B * 0.06} ${-B * 0.14} l ${B * 0.06} ${B * 0.14} Z`} />
          <path className="bt-glint" d={`M ${B * 0.58} ${B * 0.28} v ${B * 0.1} M ${B * 0.27} ${B * 0.46} v ${B * 0.07}`} />
        </pattern>
      </defs>
      {holes.length > 0 && <path className="blk-hole" d={holes.join(" ")} />}
      {BLOCK_ORDER.map((t) => (byType[t] ? <path key={t} className={`blk blk-${t}`} d={byType[t].join(" ")} fill={`url(#blk-${t})`} /> : null))}
      {/* mais fundo = mais escuro (como no Terraria) */}
      {shade.map((list, r) => (list ? <path key={`s${r}`} className="blk-shade" d={list.join(" ")} style={{ opacity: Math.min(0.5, r * 0.075) }} /> : null))}
      {cracks}
      {dig.bursts.map((b) => {
        const x = bl.colX0(b.c) + B / 2;
        const y = bl.surf(b.c) + b.r * B + B / 2;
        return (
          <g key={b.id} className={`blk-burst bt-${b.type}`} transform={`translate(${x} ${y})`}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <rect key={i} className="blk-bit" x={-3} y={-3} width={6} height={6} style={{ "--bx": `${Math.cos(i * 1.05) * 26}px`, "--by": `${-14 - Math.abs(Math.sin(i * 1.7)) * 22}px` }} />
            ))}
          </g>
        );
      })}
    </g>
  );
});

/* ---------------- atrás da árvore principal ---------------- */
export const SanctuaryBack = memo(function SanctuaryBack({ world, season }) {
  const order = ["land", "lake", "tree", "tent", "fire", "post", "grass"];
  const items = world.items.filter((i) => order.includes(i.type)).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  const scatter = useSanctuaryState().grass !== false;
  return (
    <g className="sanc-back">
      {season === "inverno" && <SnowCover world={world} />}
      {scatter && <ScatterGrass world={world} season={season} />}
      {items.map((it) => (
        <Draggable key={it.id} item={it} world={world} pokeAt={it.type === "tree" ? { x: it.x, y: world.top(it.x) - 230 * (it.size || 1) } : null}>
          {it.type === "lake" && <Lake x={it.x} size={it.size || 1} top={world.top} season={season} />}
          {it.type === "tree" && (
            <GroundClip world={world} x={it.x} half={420 * (it.size || 1)}>
              <g transform={it.flip ? `translate(${2 * it.x} 0) scale(-1 1)` : undefined}>
                <DecoTree id={it.id} x={it.x} size={it.size || 1} top={world.top} variant={it.seed || 0} noRoots sink />
              </g>
            </GroundClip>
          )}
          {it.type === "tent" && <Tent x={it.x} size={it.size || 1} top={world.top} dir={it.flip ? -1 : 1} />}
          {it.type === "fire" && <Fire x={it.x} size={it.size || 1} top={world.top} dir={it.flip ? -1 : 1} />}
          {it.type === "post" && <LanternPost x={it.x} size={it.size || 1} top={world.top} seed={hashString(it.id)} dir={it.flip ? -1 : 1} />}
          {it.type === "land" && <LandHandle x={it.x} size={it.size || 1} top={world.top} />}
          {it.type === "grass" && (
            <g transform={it.flip ? `translate(${2 * it.x} 0) scale(-1 1)` : undefined}>
              <Grass id={it.id} x={it.x} size={it.size || 1} top={world.top} variant={it.seed || 0} season={season} flip={it.flip} />
            </g>
          )}
        </Draggable>
      ))}
    </g>
  );
});

function SnowCover({ world }) {
  const lines = [];
  let cur = [];
  for (let x = world.xL + 20; x <= world.xR - 20; x += 30) {
    const y = world.top(x);
    if (y > 1500 || (world.kind === "mar" && y > SEA)) {
      if (cur.length > 1) lines.push(cur);
      cur = [];
    } else cur.push(`${x},${y - 1}`);
  }
  if (cur.length > 1) lines.push(cur);
  return (
    <>
      {lines.map((l, i) => (
        <polyline key={i} className="sanc-snow-cover" points={l.join(" ")} />
      ))}
    </>
  );
}

/* Lago afundado na terra: a terra acima da água é "escavada", a margem
   desce até a água e a superfície fica reta (como água de verdade). */
function Lake({ x, size, top, season }) {
  const W = LAKE_W * size;
  const x0 = x - W / 2;
  const x1 = x + W / 2;
  const a = x0 + W * 0.16;
  const b = x1 - W * 0.16;
  const step = Math.max(8, 12 * size);
  let lowest = -Infinity;
  for (let px = a; px <= b; px += step) lowest = Math.max(lowest, top(px));
  const level = lowest + 8 * Math.min(1.4, size);
  const bankY = (px) => {
    if (px <= a) return top(x0) + (level - top(x0)) * smooth((px - x0) / (a - x0));
    if (px >= b) return level + (top(x1) - level) * smooth((px - b) / (x1 - b));
    return level;
  };
  const surface = [];
  const bank = [];
  for (let px = x0; px <= x1 + 0.1; px += step) {
    surface.push([px, top(px) - 1]);
    bank.push([px, bankY(px)]);
  }
  const carve = smoothPath([...surface, ...bank.slice().reverse()], true);
  const bankLine = smoothPath(bank);
  const wa = a - W * 0.05;
  const wb = b + W * 0.05;
  const depth = 52 * Math.sqrt(size);
  const bottom = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    bottom.push([wa + (wb - wa) * t, level + depth * Math.pow(Math.sin(Math.PI * t), 0.75) + (rand(i + 5) - 0.5) * 6]);
  }
  const water = smoothPath([[wa, level], [wb, level], ...bottom.slice().reverse()], true);
  const frozen = season === "inverno";
  const strokes = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const dy = 6 + (i / 6) * (depth - 18);
    const shrink = Math.sqrt(Math.max(0, 1 - dy / depth));
    const mid = (wa + wb) / 2;
    const half = ((wb - wa) / 2) * shrink * (0.62 + rand(i + 3) * 0.28);
    const x0s = mid - half + rand(i + 7) * 30;
    const x1s = mid + half - rand(i + 9) * 30;
    return { d: `M ${x0s} ${level + dy} Q ${(x0s + x1s) / 2} ${level + dy - 2 + rand(i) * 4} ${x1s} ${level + dy}`, delay: rand(i + 11) * 4 };
  });
  return (
    <g className={`sanc-lake ${frozen ? "frozen" : ""}`}>
      <path className="sanc-carve" d={carve} />
      <path className="sanc-water" d={water} filter="url(#watercolor)" />
      <path className="sanc-water-edge" d={water} />
      <path className="sanc-bank" d={bankLine} />
      <line className="sanc-water-top" x1={wa + 6} y1={level} x2={wb - 6} y2={level} />
      {strokes.map((s, i) => (
        <path key={i} className="sanc-water-line" d={s.d} style={{ animationDelay: `${s.delay}s` }} />
      ))}
      {[-1, 1].map((side) =>
        [0, 1, 2, 3].map((i) => {
          const bx = side < 0 ? a - 6 - i * 11 : b + 6 + i * 11;
          const by = bankY(bx);
          const h = (24 + rand(side * 10 + i) * 28) * Math.min(1.3, size);
          const lean = -side * (2 + rand(i + 31) * 6);
          return (
            <g key={`${side}-${i}`} className="sanc-reed">
              <path d={`M ${bx} ${by} q ${lean / 2} ${-h / 2} ${lean} ${-h}`} />
              {i % 2 === 1 && <ellipse className="ink-fill" cx={bx + lean} cy={by - h + 5} rx="2.4" ry="7" transform={`rotate(${lean * 1.5} ${bx + lean} ${by - h + 5})`} />}
            </g>
          );
        })
      )}
    </g>
  );
}

/* Árvore igual à principal (tronco, raízes, galhos e copa), só que sem anotações */
const bezPt = (p, t) => {
  const u = 1 - t;
  return [
    u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
    u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1],
  ];
};
const DecoTree = memo(function DecoTree({ id, x, size, top, variant = 0, noRoots = false, sink = false }) {
  const seed = hashString(id) + variant;
  const t = {
    index: 0,
    x,
    // "sink": o pé entra na terra (o chão recorta), senão fica apoiado
    baseY: sink ? top(x) + 12 * size : top(x) - 14 * size,
    scale: size,
    H: 380 * size,
    baseHalf: 24 * size,
    forked: false,
    weight: 30 * size,
    branches: [],
    seed,
  };
  const geo = treeGeometry(t);
  const tree = { ...t, geo };
  const curve = geo.limbs[0].curve;
  const n = 5 + (seed % 3);
  const branches = Array.from({ length: n }, (_, i) => {
    const s = 0.3 + (i / n) * 0.55;
    const [px, py] = bezPt(curve, s);
    const side = i % 2 === 0 ? -1 : 1;
    const len = (75 + rand(seed + i) * 55) * size * (1.1 - s * 0.5);
    const ex = px + side * len;
    const ey = py - (25 + rand(seed + i + 9) * 40) * size;
    return {
      d: `M ${px} ${py} Q ${px + side * len * 0.5} ${py - 4 * size} ${ex} ${ey}`,
      w: Math.max(1.5, (6.5 - i * 0.6) * size),
      blob: canopyCircles(`${id}-${variant}-${i}`, ex, ey - 4 * size, (52 + rand(seed + i + 3) * 18) * size, 21 * size, 1, true),
    };
  });
  return (
    <g className="sanc-deco-tree">
      {!noRoots && <ForestRoots trees={[tree]} />}
      {branches.map((b, i) => (
        <path key={i} className="branch-line" filter="url(#organic-branch)" style={{ strokeWidth: `${b.w}px` }} d={b.d} />
      ))}
      <g className="canopy fx" filter="url(#watercolor)">
        <g className="blob is-sub crown">
          {(geo.crowns || []).map((c, i) => (
            <circle key={i} cx={c.cx} cy={c.cy} r={c.r} />
          ))}
        </g>
        {branches.map((b, i) => (
          <g key={i} className="blob is-main">
            {b.blob.map((c, j) => (
              <circle key={j} cx={c.cx} cy={c.cy} r={c.r} />
            ))}
          </g>
        ))}
      </g>
      <ForestTrunks trees={[tree]} selected={false} dimmed={false} events={{}} />
    </g>
  );
});

/* Matos: cada um nasce da terra exatamente onde está (segue morros,
   rampas e a beira das ilhas). 5 tipos — o "Sortear" troca o tipo:
   capim · arbusto · samambaia · trevo com flores · junco */
export const GRASS_KINDS = ["capim", "arbusto", "samambaia", "trevo", "junco"];
const Grass = memo(function Grass({ id, x, size, top, variant = 0, season, flip, kind: forced, still = false }) {
  const seed = hashString(id) + variant;
  const kind = forced || GRASS_KINDS[seed % GRASS_KINDS.length];
  // no espelho, o chão continua o de verdade (x real = 2·x − x desenhado)
  const ground = (bx) => top(flip ? 2 * x - bx : bx);
  const half = (kind === "arbusto" ? 38 : kind === "trevo" ? 34 : kind === "junco" ? 26 : 46) * size;
  const parts = [];

  if (kind === "capim") {
    const count = Math.round((9 + (seed % 7)) * Math.sqrt(size));
    for (let i = 0; i < count; i++) {
      const r = rand(seed + i * 3.1);
      const bx = x + (r - 0.5) * 2 * half * (0.35 + 0.65 * rand(seed + i + 7));
      const by = ground(bx) + 3;
      const mid = 1 - Math.abs(bx - x) / (half + 1);
      const h = (12 + rand(seed + i + 13) * 20) * size * (0.55 + 0.45 * mid);
      const lean = (rand(seed + i + 21) - 0.5) * 16 * size;
      const w = (1.6 + rand(seed + i + 29) * 1.6) * size;
      parts.push(<path key={i} className={`sanc-blade s${i % 3}`} d={`M ${bx - w} ${by} Q ${bx + lean * 0.35} ${by - h * 0.55} ${bx + lean} ${by - h} Q ${bx + lean * 0.3 + w * 0.4} ${by - h * 0.5} ${bx + w} ${by} Z`} />);
    }
  } else if (kind === "arbusto") {
    // moita redonda: bolas de folhagem apoiadas no chão
    const n = 4 + (seed % 3);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const bx = x - half * 0.75 + t * half * 1.5 + (rand(seed + i) - 0.5) * 6 * size;
      const r = (11 + rand(seed + i + 5) * 8) * size * (0.75 + 0.25 * Math.sin(Math.PI * t));
      const by = ground(bx) + 2 - r * (0.55 + 0.25 * Math.sin(Math.PI * t));
      parts.push(<circle key={i} className={`sanc-bush s${i % 3}`} cx={bx} cy={by} r={r} />);
    }
    if (seed % 2 === 0 && season !== "inverno") {
      for (let i = 0; i < 3; i++) {
        const bx = x + (rand(seed + i + 40) - 0.5) * half * 1.1;
        parts.push(<circle key={`b${i}`} className="sanc-berry" cx={bx} cy={ground(bx) - (10 + rand(seed + i + 44) * 14) * size} r={1.8 * size} />);
      }
    }
  } else if (kind === "samambaia") {
    // folhas compridas curvadas, com folíolos dos dois lados
    const n = 5 + (seed % 3);
    const by = ground(x) + 2;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const ang = (-1.15 + t * 2.3) * (0.85 + rand(seed + i) * 0.2);
      const len = (30 + rand(seed + i + 3) * 18) * size * (1 - Math.abs(t - 0.5) * 0.5);
      const ex = x + Math.sin(ang) * len;
      const ey = by - Math.cos(ang) * len * 0.9;
      const cx = x + Math.sin(ang) * len * 0.35;
      const cy = by - len * 0.85;
      const leaflets = [];
      for (let k = 1; k <= 6; k++) {
        const u = k / 7;
        const px = (1 - u) * (1 - u) * x + 2 * (1 - u) * u * cx + u * u * ex;
        const py = (1 - u) * (1 - u) * by + 2 * (1 - u) * u * cy + u * u * ey;
        const l = (7 - k) * 1.1 * size;
        leaflets.push(`M ${px} ${py} l ${-l} ${-l * 0.45} M ${px} ${py} l ${l} ${-l * 0.45}`);
      }
      parts.push(
        <g key={i}>
          <path className="sanc-frond" d={`M ${x} ${by} Q ${cx} ${cy} ${ex} ${ey}`} />
          <path className={`sanc-leaflets s${i % 3}`} d={leaflets.join(" ")} />
        </g>
      );
    }
  } else if (kind === "trevo") {
    // tapetinho baixo de trevos com florzinhas
    const n = Math.round(10 * Math.sqrt(size));
    for (let i = 0; i < n; i++) {
      const bx = x + (rand(seed + i * 1.7) - 0.5) * 2 * half;
      const by = ground(bx) - (2 + rand(seed + i + 9) * 5) * size;
      const r = (2.6 + rand(seed + i + 3) * 1.4) * size;
      parts.push(
        <g key={i} className={`sanc-clover s${i % 3}`}>
          <circle cx={bx - r * 0.7} cy={by} r={r} />
          <circle cx={bx + r * 0.7} cy={by} r={r} />
          <circle cx={bx} cy={by - r * 0.8} r={r} />
        </g>
      );
    }
    if (season !== "inverno") {
      for (let i = 0; i < 3 + (seed % 3); i++) {
        const bx = x + (rand(seed + i + 70) - 0.5) * 1.6 * half;
        const fy = ground(bx) - (9 + rand(seed + i + 74) * 7) * size;
        parts.push(
          <g key={`f${i}`}>
            <line className="sanc-flower-stem" x1={bx} y1={ground(bx) + 1} x2={bx} y2={fy} />
            <circle className={`sanc-flower ${i % 2 ? "alt" : ""}`} cx={bx} cy={fy} r={2.3 * size} />
          </g>
        );
      }
    }
  } else {
    // junco: hastes altas e finas, algumas com a "salsicha" marrom na ponta
    const n = 5 + (seed % 4);
    for (let i = 0; i < n; i++) {
      const bx = x + (rand(seed + i * 2.3) - 0.5) * 2 * half;
      const by = ground(bx) + 3;
      const h = (34 + rand(seed + i + 11) * 26) * size;
      const lean = (rand(seed + i + 17) - 0.5) * 12 * size;
      parts.push(<path key={i} className="sanc-reed-stem" d={`M ${bx} ${by} Q ${bx + lean * 0.3} ${by - h * 0.6} ${bx + lean} ${by - h}`} style={{ strokeWidth: `${1.5 * size}px` }} />);
      if (i % 2 === 0) parts.push(<ellipse key={`c${i}`} className="sanc-cattail" cx={bx + lean * 0.8} cy={by - h * 0.82} rx={2.2 * size} ry={6 * size} transform={`rotate(${lean * 1.2} ${bx + lean * 0.8} ${by - h * 0.82})`} />);
    }
  }

  const hx = x - half - 6;
  return (
    <g className={`sanc-grass k-${kind} ${season || ""}`}>
      {!still && <rect className="sanc-grass-hit" x={hx} y={ground(x) - 46 * size} width={2 * half + 12} height={50 * size} rx={10} />}
      {parts}
    </g>
  );
});

/* Matos espalhados pela terra sozinhos (decoração, não dá para arrastar).
   Fogem da água, da barraca e da fogueira; mudam de lugar ao mudar o layout. */
const ScatterGrass = memo(function ScatterGrass({ world, season }) {
  const { kind, segments, items } = world;
  const ranges = kind === "terra" ? [[TERRA_MIN + 200, TERRA_MAX - 200]] : segments.map(([a, b]) => [a + EDGE * 0.7, b - EDGE * 0.7]);
  const busy = items
    .filter((i) => i.type === "tent" || i.type === "fire" || i.type === "lake")
    .map((i) => {
      const w = i.type === "lake" ? (LAKE_W * (i.size || 1)) / 2 + 30 : 70 * (i.size || 1);
      return [i.x - w, i.x + w];
    });
  const out = [];
  ranges.forEach(([a, b], ri) => {
    let n = 0;
    for (let x = a; x < b; x += 60 + rand(x * 0.37 + ri) * 95) {
      if (busy.some(([l, r]) => x > l && x < r)) continue;
      if (world.blocks && world.blocks.isMined(world.blocks.colOf(x), 0)) continue;
      const seed = Math.floor(x * 13.7) + ri * 97;
      const kinds = ["capim", "capim", "trevo", "arbusto", "samambaia", "junco"];
      out.push({
        id: `sg-${ri}-${n++}`,
        x,
        size: 0.42 + rand(seed + 3) * 0.38,
        kind: kinds[Math.abs(seed) % kinds.length],
        flip: rand(seed + 5) > 0.5,
      });
    }
  });
  return (
    <g className="sanc-scatter" aria-hidden="true">
      {out.map((g) => (
        <g key={g.id} transform={g.flip ? `translate(${2 * g.x} 0) scale(-1 1)` : undefined}>
          <Grass id={g.id} x={g.x} size={g.size} top={world.top} season={season} flip={g.flip} kind={g.kind} still />
        </g>
      ))}
    </g>
  );
});

/* Barraca: cada pé apoiado no chão (acompanha a inclinação) */
function Tent({ x, size, top, dir = 1 }) {
  const w = 62 * size;
  const gl = top(x - w) + 2;
  const gr = top(x + w) + 2;
  const gc = top(x) + 2;
  const peak = Math.min(gl, gr) - 86 * size;
  const outline = `M ${x - w} ${gl} L ${x} ${peak} L ${x + w} ${gr} Z`;
  const d = 18 * size;
  return (
    <g className="sanc-tent-g">
      <path className="sanc-tent" d={outline} filter="url(#watercolor)" />
      <path className="sanc-tent-line" d={outline} />
      <path className="ink-fill" d={`M ${x - d} ${top(x - d) + 2} L ${x} ${peak + 34 * size} L ${x + d} ${top(x + d) + 2} Z`} />
      <path
        className="sanc-tent-line"
        d={`M ${x} ${peak} L ${x} ${peak - 12 * size} M ${x - w} ${gl} L ${x - w - 16 * size} ${top(x - w - 16 * size) + 3} M ${x + w} ${gr} L ${x + w + 16 * size} ${top(x + w + 16 * size) + 3}`}
      />
      <path
        className="sanc-hatch"
        d={`M ${x - dir * w * 0.65} ${gc - 6} L ${x - dir * w * 0.35} ${peak + 46 * size} M ${x - dir * w * 0.48} ${gc - 4} L ${x - dir * w * 0.22} ${peak + 52 * size} M ${x + dir * w * 0.45} ${gc - 6} L ${x + dir * w * 0.22} ${peak + 52 * size}`}
      />
      <path className="sanc-flag" d={`M ${x} ${peak - 12 * size} l ${dir * 14 * size} ${4 * size} l ${-dir * 14 * size} ${5 * size} Z`} />
    </g>
  );
}

/* Fogueira: pedras e lenha seguem o relevo; tronco para sentar ao lado */
function Fire({ x, size, top, dir = 1 }) {
  const g = top(x) + 2;
  const slope = (Math.atan2(top(x + 16) - top(x - 16), 32) * 180) / Math.PI;
  const s1 = top(x + dir * 38 * size) - 4;
  const s2 = top(x + dir * 74 * size) - 4;
  return (
    <g className="sanc-fire">
      <line className="sanc-seat" x1={x + dir * 40 * size} y1={s1} x2={x + dir * 72 * size} y2={s2} style={{ strokeWidth: 11 * size }} />
      <ellipse className="sanc-fire-warm" cx={x} cy={g - 2} rx={34 * size} ry={9 * size} />
      {[-15, -7, 2, 10, 16].map((dx, i) => (
        <ellipse key={i} className="ink-fill" cx={x + dx * size} cy={top(x + dx * size) + 2 + (i % 2)} rx={(4.5 + (i % 3)) * size} ry={3.2 * size} />
      ))}
      <g transform={`translate(${x} ${g}) rotate(${slope}) scale(${size})`}>
        <rect className="ink-fill" x="-16" y="-7" width="32" height="6" rx="3" transform="rotate(-16)" />
        <rect className="ink-fill" x="-16" y="-7" width="32" height="6" rx="3" transform="rotate(16)" />
      </g>
      <g transform={`translate(${x} ${g}) scale(${size})`}>
        <g className="sanc-flame-g">
          <path className="sanc-flame outer" d="M 0 -5 C -13 -11 -10 -24 -3 -34 C -2 -27 3 -27 1 -38 C 10 -27 13 -12 0 -5 Z" filter="url(#watercolor)" />
          <path className="sanc-flame-line" d="M 0 -5 C -13 -11 -10 -24 -3 -34 C -2 -27 3 -27 1 -38 C 10 -27 13 -12 0 -5 Z" />
          <path className="sanc-flame inner" d="M 0 -7 C -5 -11 -5 -18 0 -24 C 5 -18 5 -11 0 -7 Z" />
        </g>
        {[0, 1].map((i) => (
          <path key={i} className="sanc-smoke" d={`M ${i * 4} -42 c -8 -8 8 -14 0 -22 c -8 -8 8 -14 0 -22`} style={{ animationDelay: `${i * 2.2}s` }} />
        ))}
      </g>
    </g>
  );
}

/* Lanterna num poste de madeira fincado no chão */
function LanternPost({ x, size, top, seed, dir = 1 }) {
  const g = top(x) + 2;
  const h = 64 * size;
  const arm = 16 * size * dir;
  return (
    <g className="sanc-post">
      <line className="sanc-post-pole" x1={x} y1={g} x2={x} y2={g - h} style={{ strokeWidth: 3.5 * size }} />
      <line className="sanc-post-pole" x1={x} y1={g - h + 3} x2={x + arm} y2={g - h + 3} style={{ strokeWidth: 2.5 * size }} />
      <g transform={`translate(${x + arm} ${g - h + 3}) scale(${size})`}>
        <g className="sanc-lantern-sway" style={{ animationDelay: `${-rand(seed) * 4}s` }}>
          <line x1="0" y1="0" x2="0" y2="8" className="sanc-lantern-string" />
          <circle className="sanc-lantern-glow" cx="0" cy="17" r="16" />
          <rect className="sanc-lantern-cap" x="-5" y="8" width="10" height="3" rx="1" />
          <rect className="sanc-lantern-body" x="-6.5" y="11" width="13" height="14" rx="4" />
          <rect className="sanc-lantern-cap" x="-4" y="25" width="8" height="2.5" rx="1" />
        </g>
      </g>
    </g>
  );
}

/* Lanternas penduradas nos galhos da árvore principal */
export const BranchLanterns = memo(function BranchLanterns({ nodes, dims, show }) {
  if (!show) return null;
  const main = nodes.filter((n) => n.depth === 1);
  const pick = (list) => list.filter((_, i) => i % 2 === 0).slice(0, 3);
  const list = [...pick(main.filter((n) => n.x < MAIN_X)), ...pick(main.filter((n) => n.x >= MAIN_X))].map((n, i) => {
    const d = dims.get(n.branch.id) || { rx: 60, ry: 22 };
    return { x: n.x + (rand(i + 1) - 0.5) * d.rx * 0.6, y: n.y + d.ry * 0.7, len: 16 + rand(i + 4) * 16, delay: rand(i + 8) * 3 };
  });
  return (
    <g className="sanc-branch-lanterns">
      {list.map((l, i) => (
        <g key={i} transform={`translate(${l.x} ${l.y})`}>
          <g className="sanc-lantern-sway" style={{ animationDelay: `${-l.delay}s` }}>
            <line x1="0" y1="0" x2="0" y2={l.len} className="sanc-lantern-string" />
            <circle className="sanc-lantern-glow" cx="0" cy={l.len + 9} r="16" />
            <rect className="sanc-lantern-cap" x="-5" y={l.len} width="10" height="3" rx="1" />
            <rect className="sanc-lantern-body" x="-6.5" y={l.len + 3} width="13" height="14" rx="4" />
            <rect className="sanc-lantern-cap" x="-4" y={l.len + 17} width="8" height="2.5" rx="1" />
          </g>
        </g>
      ))}
    </g>
  );
});


/* ---------------- fundo: árvores e ilhas em camadas (paralaxe) ---------------- */
// Camada 1 (mais perto, mais escura) até 3 (mais longe, mais clara e lenta).
const LAYER_SPEED = { 1: 0.78, 2: 0.58, 3: 0.38 };
const LAYER_SCALE = { 1: 0.85, 2: 0.66, 3: 0.5 };

export const SanctuaryBackdrop = memo(function SanctuaryBackdrop({ world, view, baseTransform }) {
  const bg = world.items.filter(isBg);
  if (!bg.length) return null;
  return (
    <g className="sanc-backdrop">
      {[3, 2, 1].map((L) => {
        const list = bg.filter((i) => (i.layer || 2) === L);
        if (!list.length) return null;
        const k = LAYER_SPEED[L];
        // Anda mais devagar que a cena quando a câmera se move. A conta usa o
        // CENTRO da câmera (e não o canto da tela): no zoom o centro quase não
        // muda, então as camadas do fundo ficam no lugar em vez de "fugir".
        // (600, 350) = centro da tela; na vista inicial fica tudo igual a antes.
        const z = view.zoom || 1;
        const cx = (600 - view.x) / z;
        const cy = (350 - view.y) / z;
        const ox = (cx - 600) * (1 - k);
        const oy = (cy - 350) * (1 - k) * 0.6;
        return (
          <g key={L} transform={`translate(${ox} ${oy})`}>
            <g transform={baseTransform} className={`sanc-world sanc-bg l${L}`}>
              {list.map((it) => {
                const size = (it.size || 1) * LAYER_SCALE[L];
                const mirror = it.flip ? `translate(${2 * it.x} 0) scale(-1 1)` : undefined;
                if (it.type === "bgtree") {
                  const base = groundY(it.x) + 26 - (L - 1) * 30 - (it.h || 0);
                  return (
                    <Draggable key={it.id} item={it} world={world} pokeAt={{ x: it.x, y: base - 220 * size }}>
                      <g transform={mirror}>
                        <ellipse className="sanc-bg-hill" cx={it.x} cy={base + 4} rx={170 * size} ry={34 * size} />
                        <DecoTree id={it.id} x={it.x} size={size} top={() => base} variant={it.seed || 0} noRoots />
                      </g>
                    </Draggable>
                  );
                }
                const y = groundY(it.x) - (it.h || 260);
                return (
                  <Draggable key={it.id} item={it} world={world} pokeAt={{ x: it.x, y: y - 150 * size }}>
                    <g transform={mirror}>
                      <BgIsland id={it.id} x={it.x} y={y} size={size} variant={it.seed || 0} />
                    </g>
                  </Draggable>
                );
              })}
            </g>
          </g>
        );
      })}
    </g>
  );
});

/* Ilha voadora de fundo: rocha pendurada com árvores em cima */
const BgIsland = memo(function BgIsland({ id, x, y, size, variant }) {
  const seed = hashString(id) + variant;
  const w = 220 * size;
  const topPts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    topPts.push([x - w + 2 * w * t, y - Math.sin(Math.PI * t) * 10 * size + (rand(seed + i) - 0.5) * 6 * size]);
  }
  const under = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    under.push([x + w - 2 * w * t, y + 16 * size + Math.pow(Math.sin(Math.PI * t), 0.65) * w * 0.85 + (rand(seed + i + 30) - 0.5) * 26 * size]);
  }
  const body = smoothPath([...topPts, ...under], true);
  const n = 1 + (seed % 3);
  const trees = Array.from({ length: n }, (_, i) => {
    const tx = x + (n === 1 ? 0 : (i / (n - 1) - 0.5) * w * 1.1) + (rand(seed + i + 50) - 0.5) * 30 * size;
    return { id: `${id}-t${i}`, x: tx, size: size * (0.42 + rand(seed + i + 60) * 0.2) };
  });
  return (
    <g className="sanc-bg-island">
      <path className="sanc-bg-body" d={body} />
      {trees.map((t) => (
        <DecoTree key={t.id} id={t.id} x={t.x} size={t.size} top={() => y + 4} variant={variant} noRoots />
      ))}
    </g>
  );
});

/* ---------------- na frente: vagalumes e estação ---------------- */
export const SanctuaryFront = memo(function SanctuaryFront({ world, season }) {
  const swarms = world.items.filter((i) => i.type === "fireflies");
  const main = world.main;
  const mainTop = world.top(main.x) - 470 * (main.size || 1);
  const kind = season === "primavera" ? "petal" : season === "outono" ? "leaf" : season === "inverno" ? "snow" : null;
  const particles = kind
    ? Array.from({ length: kind === "snow" ? 40 : 12 }, (_, i) => ({
        x: kind === "snow" ? world.xL + rand(i + 71) * (world.xR - world.xL) : main.x + (rand(i + 71) - 0.5) * 520 * (main.size || 1),
        y: kind === "snow" ? mainTop - 160 : mainTop + 60 + rand(i + 81) * 160,
        fall: kind === "snow" ? 760 : 380 * (main.size || 1),
        dur: (kind === "snow" ? 9 : 8) + rand(i + 91) * 6,
        delay: -rand(i + 101) * 14,
        sway: 18 + rand(i + 111) * 30,
      }))
    : [];
  return (
    <g className="sanc-front">
      {particles.map((p, i) => (
        <g key={`p${i}`} transform={`translate(${p.x} ${p.y})`}>
          <g className={`sanc-fall ${kind}`} style={{ "--fall": `${p.fall}px`, "--sway": `${p.sway}px`, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }}>
            {kind === "snow" ? <circle r={1.6 + (i % 3) * 0.7} /> : <path className="leaf" d={LEAF_PATH} transform="scale(0.85)" />}
          </g>
        </g>
      ))}
      {swarms.map((sw) => (
        <Draggable key={sw.id} item={sw} world={world}>
          <Fireflies x={sw.x} y={world.top(sw.x) - (sw.h || 80)} size={sw.size || 1} seed={hashString(sw.id)} count={season === "verao" ? 11 : 8} />
        </Draggable>
      ))}
    </g>
  );
});

function Fireflies({ x, y, size, seed, count }) {
  const spread = 70 * size;
  return (
    <g className="sanc-swarm">
      {/* área para agarrar com o lápis */}
      <circle className="sanc-swarm-handle" cx={x} cy={y} r={spread * 0.9} />
      {Array.from({ length: Math.round(count * Math.sqrt(size)) }, (_, i) => (
        <g key={i} transform={`translate(${x + (rand(seed + i) - 0.5) * spread * 2} ${y + (rand(seed + i + 40) - 0.5) * spread * 1.2})`}>
          <circle
            className="sanc-firefly"
            r="2"
            style={{
              "--dx": `${(rand(seed + i + 51) - 0.5) * 50}px`,
              "--dy": `${(rand(seed + i + 61) - 0.5) * 34}px`,
              animationDuration: `${5 + rand(seed + i + 31) * 6}s, ${2 + (i % 4) * 0.6}s`,
              animationDelay: `${-rand(seed + i + 41) * 8}s, ${-rand(seed + i + 42) * 3}s`,
            }}
          />
        </g>
      ))}
    </g>
  );
}

/* ---------------- o herói (anda com W A S D, pula com Espaço) ---------------- */
// Movimento com aceleração e freio (nada de começar/parar no seco),
// gravidade de verdade (cai de beiradas e degraus) e pulo que fica mais
// alto segurando o Espaço. Braços e pernas balançam no ritmo do passo.
const MAX_SPEED = 205; // unidades do desenho por segundo
const ACCEL = 1500; // ganho de velocidade no chão
const DECEL = 1900; // freio ao soltar
const AIR_CONTROL = 0.55; // no ar dá para corrigir, mas menos
const DEPTH_SPEED = 80;
const JUMP_SPEED = 480; // passa por cima de 2 blocos
const GRAVITY = 1250;
const FALL_MULT = 1.55; // cai mais rápido do que sobe (pulo mais "gostoso")
const CUT_JUMP = 0.45; // soltou o Espaço subindo: o pulo encurta
const COYOTE = 0.1; // ainda pula logo depois de sair da beirada
const BUFFER = 0.12; // apertou um pouquinho antes de tocar o chão: pula ao tocar
const STICK = 14; // descidas pequenas grudam no chão (rampas), maiores viram queda
const WADE = 20; // quanto o herói afunda na água (unidades do desenho)
const WATER_SPEED = 0.6; // na água anda mais devagar
const DEPTH_MIN = -16;
const DEPTH_MAX = 30;

const isTyping = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
// teclado numérico (e os números de cima, para quem não tem)
const DIG_KEYS = { Numpad2: "down", Digit2: "down", Numpad4: "left", Numpad6: "right", Numpad8: "up" };
const approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));

export function SanctuaryHero({ groupRef, containerRef, world, onPan }) {
  const { editing } = useSanctuaryState();
  const boxRef = useRef(null);
  const [startX] = useState(() => {
    const fire = world.items.find((i) => i.type === "fire");
    const x = fire ? fire.x + 62 : world.main.x + 160;
    const b = world.walk(x);
    return clamp(x, b.min, b.max);
  });
  // y = altura dos pés no desenho (cresce para baixo); air = está no ar
  const pos = useRef({ x: startX, z: 0, y: world.top(startX) + 4, vx: 0, vy: 0, air: false, coyote: 0, buffer: 0 });
  const keys = useRef(new Set());
  const raf = useRef(0);
  const last = useRef(0);
  const [facing, setFacing] = useState(0); // -1 esquerda · 0 de frente · 1 direita
  const [pose, setPose] = useState("idle"); // idle · walk · jump
  const poseRef = useRef({ pose: "idle", facing: 0 });
  const [hero] = useState(() => normalizeHero(readProfileValue("rpg_hero_v1", getActiveProfileId(), DEFAULT_HERO)));
  const worldRef = useRef(world);
  const panRef = useRef(onPan);
  useEffect(() => {
    worldRef.current = world;
    panRef.current = onPan;
  });

  // chão sob os pés: na água é o fundo raso (nível da água + um pouco)
  const groundAt = (x) => {
    const w = worldRef.current;
    const pool = w.water && w.water(x);
    if (pool) return pool.level + WADE * Math.min(1.3, pool.size);
    const gb = w.blocks && w.blocks.groundBlock(x);
    return gb != null ? gb + 2 : w.top(x) + 4;
  };

  // Posição na tela a partir da posição no desenho (acompanha zoom e arrasto)
  const place = useCallback(
    (follow = false) => {
      const g = groupRef.current;
      const box = boxRef.current;
      const wrap = containerRef.current;
      if (!g || !box || !wrap) return;
      const ctm = g.getScreenCTM();
      if (!ctm) return;
      const w = worldRef.current;
      const p = pos.current;
      const wb = w.walk(p.x);
      p.x = clamp(p.x, wb.min, wb.max);
      // chão mudou por baixo (layout editado, terra nova): não fica enterrado
      const ground = groundAt(p.x);
      if (!p.air || (p.vy >= 0 && p.y > ground)) {
        p.y = ground;
        p.air = false;
      }
      heroX = p.x;
      const pt = new DOMPoint(p.x, p.y + p.z).matrixTransform(ctm);
      const r = wrap.getBoundingClientRect();
      const sx = pt.x - r.left;
      const sy = pt.y - r.top;
      box.style.left = `${sx}px`;
      box.style.top = `${sy}px`;
      box.style.setProperty("--sanc-hero-size", String(Math.max(0.3, ctm.a * 0.95 * (1 + p.z * 0.006))));
      // na água: corta o que fica abaixo da superfície e mostra a ondinha
      const pool = w.water && w.water(p.x);
      const under = pool ? Math.max(0, p.y - pool.level) : 0;
      box.classList.toggle("in-water", under > 2);
      box.style.setProperty("--wade", `${(under * ctm.a).toFixed(1)}px`);
      // passo mais rápido quando corre mais
      const speed = Math.min(1, Math.abs(p.vx) / MAX_SPEED);
      box.style.setProperty("--walk-dur", `${(0.52 - speed * 0.2).toFixed(3)}s`);
      box.style.zIndex = p.z > 8 ? "4" : "3";
      // câmera acompanha quando ele chega perto da borda da tela
      if (follow && panRef.current) {
        const mx = r.width * 0.22;
        const my = r.height * 0.2;
        const dx = sx < mx ? mx - sx : sx > r.width - mx ? r.width - mx - sx : 0;
        const dy = sy < my ? my - sy : sy > r.height - my ? r.height - my - sy : 0;
        // segue suave (sem tranco)
        if (dx || dy) panRef.current(dx * 0.35, dy * 0.35);
      }
    },
    [groupRef, containerRef]
  );

  useLayoutEffect(() => {
    place(false);
  });

  useEffect(() => {
    const onResize = () => place(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [place]);

  // só troca o desenho quando a pose ou o lado mudam (não a cada quadro)
  const setLook = useCallback((nextPose, nextFacing) => {
    const cur = poseRef.current;
    if (cur.pose !== nextPose) {
      cur.pose = nextPose;
      setPose(nextPose);
    }
    if (nextFacing !== undefined && cur.facing !== nextFacing) {
      cur.facing = nextFacing;
      setFacing(nextFacing);
    }
  }, []);

  // Laço de movimento: roda enquanto há tecla, velocidade ou ele está no ar
  const loopRef = useRef(null);
  const loop = useCallback(
    (t) => {
      const dt = Math.min(0.04, (t - (last.current || t)) / 1000);
      last.current = t;
      const k = keys.current;
      const p = pos.current;
      const inX = (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0);
      const inZ = (k.has("s") ? 1 : 0) - (k.has("w") ? 1 : 0);

      // ---- andar: acelera, freia e vira com suavidade ----
      const control = p.air ? AIR_CONTROL : 1;
      const wet = worldRef.current.water && worldRef.current.water(p.x);
      const top = MAX_SPEED * (wet && !p.air ? WATER_SPEED : 1);
      if (inX) {
        const turning = Math.sign(p.vx) && Math.sign(p.vx) !== inX;
        p.vx = approach(p.vx, inX * top, (turning ? DECEL : ACCEL) * control * dt);
      } else {
        p.vx = approach(p.vx, 0, DECEL * control * dt);
      }
      p.z = clamp(p.z + inZ * DEPTH_SPEED * dt, DEPTH_MIN, DEPTH_MAX);

      const w = worldRef.current;
      const b = w.walk(p.x);
      let nx = clamp(p.x + p.vx * dt, b.min, b.max);
      if (nx === b.min || nx === b.max) p.vx = 0; // bateu na ponta
      // parede de blocos: sobe sozinho 1 bloco; mais alto que isso, só pulando
      if (p.vx) {
        const probe = nx + Math.sign(p.vx) * 12;
        const ahead = groundAt(probe);
        const limit = p.air ? 3 : BLOCK * 1.05;
        if (ahead < p.y - limit) {
          nx = p.x;
          p.vx = 0;
        }
      }
      const before = groundAt(p.x);
      p.x = nx;
      const ground = groundAt(p.x);

      // ---- gravidade ----
      if (!p.air) {
        const drop = ground - before; // > 0: o chão desceu
        if (drop > STICK) {
          p.air = true; // saiu de um degrau: começa a cair
          p.vy = 0;
          p.coyote = COYOTE;
        } else {
          p.y = ground; // rampa / subida: acompanha o chão
        }
      }
      if (p.air) {
        p.coyote = Math.max(0, p.coyote - dt);
        const g = p.vy < 0 ? GRAVITY : GRAVITY * FALL_MULT; // vy < 0 = subindo
        p.vy += g * dt;
        p.y += p.vy * dt;
        // só pousa caindo (no começo do pulo ele ainda está na altura do chão)
        if (p.vy >= 0 && p.y >= ground) {
          p.y = ground;
          p.vy = 0;
          p.air = false;
          if (p.buffer > 0) startJump(p);
        }
      }
      p.buffer = Math.max(0, p.buffer - dt);

      place(true);
      const moving = Math.abs(p.vx) > 12 || inZ !== 0;
      setLook(p.air ? "jump" : moving ? "walk" : "idle", inX || (Math.abs(p.vx) > 12 ? Math.sign(p.vx) : undefined));

      if (inX || inZ || Math.abs(p.vx) > 0.5 || p.air || p.buffer > 0) {
        raf.current = requestAnimationFrame(loopRef.current);
      } else {
        p.vx = 0;
        raf.current = 0;
        last.current = 0;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- groundAt lê sempre worldRef
    [place, setLook]
  );
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  const kick = useCallback(() => {
    if (!raf.current && loopRef.current) {
      last.current = 0;
      raf.current = requestAnimationFrame(loopRef.current);
    }
  }, []);

  // bater no bloco ao lado/embaixo (segurar a tecla continua batendo)
  const lastDig = useRef(0);
  const digTowards = useCallback((dir) => {
    const now = performance.now();
    if (now - lastDig.current < 170) return;
    lastDig.current = now;
    const w = worldRef.current;
    const bl = w.blocks;
    if (!bl) return;
    const p = pos.current;
    const c0 = bl.colOf(p.x);
    const rowAt = (c, y) => Math.floor((y - bl.surf(c)) / bl.B);
    let targets = [];
    if (dir === "down") targets = [[c0, rowAt(c0, p.y - 2 + 1)]];
    else if (dir === "up") targets = [[c0, rowAt(c0, p.y - BLOCK * 3.2)]];
    else {
      const c = c0 + (dir === "left" ? -1 : 1);
      // na altura da cintura, depois da cabeça, depois do pé
      targets = [[c, rowAt(c, p.y - BLOCK * 0.5)], [c, rowAt(c, p.y - BLOCK * 1.5)], [c, rowAt(c, p.y + 2)]];
      setLook(poseRef.current.pose, dir === "left" ? -1 : 1);
    }
    const hit = targets.find(([c, r]) => bl.solid(c, r));
    if (!hit) return;
    hitBlock(w, hit[0], hit[1]);
    // quebrou embaixo: o chão some e ele cai
    kick();
  }, [kick, setLook]);

  const jump = useCallback(() => {
    const p = pos.current;
    if (!p.air || p.coyote > 0) startJump(p);
    else p.buffer = BUFFER; // ainda no ar: guarda o pulo para quando tocar o chão
    kick();
  }, [kick]);

  // Teclado: só no Santuário, fora de campos de texto, janelas e do lápis
  useEffect(() => {
    const MOVE = ["w", "a", "s", "d"];
    const blocked = (e) =>
      get().editing ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      isTyping(e.target) ||
      isTyping(document.activeElement) ||
      document.querySelector(".modal-backdrop, .ui-dialog-backdrop");
    const onDown = (e) => {
      if (blocked(e)) return;
      const raw = (e.key || "").toLowerCase();
      const key = MOVE.includes(raw) ? raw : null;
      if (key) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!keys.current.has(key)) {
          keys.current.add(key);
          kick();
        }
      } else if (e.key === " " || e.code === "Space") {
        // Espaço pula (no Santuário não centraliza a tela)
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat) jump();
      } else if (DIG_KEYS[e.code]) {
        // teclado numérico: 2 cava embaixo · 4/6 quebra dos lados · 8 em cima
        e.preventDefault();
        e.stopImmediatePropagation();
        digTowards(DIG_KEYS[e.code]);
      }
    };
    const onUp = (e) => {
      const key = (e.key || "").toLowerCase();
      if (keys.current.delete(key)) kick();
      // soltou o Espaço ainda subindo: pulo mais baixo
      if ((e.key === " " || e.code === "Space") && pos.current.vy < 0) pos.current.vy *= CUT_JUMP;
    };
    const clear = () => {
      keys.current.clear();
      kick();
    };
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", onDown, true);
      window.removeEventListener("keyup", onUp, true);
      window.removeEventListener("blur", clear);
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [kick, jump, digTowards]);

  // virado para o lado em que anda; parado, olha um pouco para a frente
  const moving = pose === "walk" || pose === "jump";
  const rotation = moving && facing ? facing * 70 : facing * 25 - (facing === 0 ? 22 : 0);

  return (
    <div
      ref={boxRef}
      className={`sanc-hero pose-${pose} ${pose === "walk" ? "walking" : ""} ${editing ? "is-editing" : ""}`}
      title="W A S D para andar · Espaço para pular"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={jump}
    >
      <HeroModel hero={hero} rotation={rotation} size={1} limbs pose={pose} />
      <span className="sanc-ripple" aria-hidden="true" />
    </div>
  );
}

function startJump(p) {
  p.vy = -JUMP_SPEED;
  p.air = true;
  p.coyote = 0;
  p.buffer = 0;
}


/* Terra: um morrinho que levanta o chão (com o lápis, aparece o contorno para agarrar) */
function LandHandle({ x, size, top }) {
  const w = 170 * size;
  const pts = [];
  for (let px = x - w; px <= x + w + 0.1; px += 12) pts.push([px, top(px)]);
  const d = `${smoothPath(pts)} L ${x + w} ${top(x + w) + 26} L ${x - w} ${top(x - w) + 26} Z`;
  return <path className="sanc-land-handle" d={d} />;
}


/* ---------------- modo galhos (árvore principal) ---------------- */
/** Bolinhas nas pontas dos galhos: arrastar move, clicar seleciona, segurar troca de lugar. */
export const BranchHandles = memo(function BranchHandles({ nodes, dims, events, selected }) {
  return (
    <g className="sanc-branch-handles">
      {nodes
        .filter((n) => n.branch.id !== ROOT_ID)
        .map((n) => {
          const d = dims.get(n.branch.id) || { ry: 20 };
          const r = n.depth === 1 ? 13 : 10;
          return (
            <g key={n.branch.id} className={`sanc-branch-handle ${selected === n.branch.id ? "selected" : ""} ${n.depth === 1 ? "main" : "sub"}`} {...events(n.branch.id)}>
              <circle className="hit" cx={n.x} cy={n.y} r={Math.max(r + 10, d.ry * 0.8)} />
              <circle className="dot" cx={n.x} cy={n.y} r={r} />
            </g>
          );
        })}
    </g>
  );
});

/** Barra do modo galhos: adicionar, remover, aleatorizar. Sem nomes nem notas. */
export function BranchTools() {
  const { data, commit } = useArvore();
  const { branchMode, branch, editing } = useSanctuaryState();
  const tree = data.tree;
  const sel = branch ? findBranch(tree, branch) : null;

  useEffect(() => {
    if (branch && !sel) setLive({ branch: null });
  }, [branch, sel]);

  useEffect(() => {
    if (!branchMode) return undefined;
    const onKey = (e) => {
      if (isTyping(e.target) || document.querySelector(".modal-backdrop, .ui-dialog-backdrop")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (get().branch) setLive({ branch: null });
        else exitBranchMode();
      } else if ((e.key === "Delete" || e.key === "Backspace") && get().branch) {
        e.preventDefault();
        e.stopImmediatePropagation();
        removeSelected();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  if (!branchMode || editing) return null;

  const countBranches = (node) => (node.children || []).reduce((n, c) => n + 1 + countBranches(c), 0);
  const add = (parentId) => {
    const id = generateId();
    const name = `Galho ${countBranches(tree) + 1}`;
    commit((d) => createSubbranch(d, parentId, { id, name, color: colorForId(id) }));
    sfx.play("grow");
    setLive({ branch: id });
  };
  async function removeSelected() {
    const id = get().branch;
    if (!id || id === ROOT_ID) return;
    const node = findBranch(tree, id);
    const subs = node ? countBranches(node) : 0;
    const ok = await ask({
      icon: "🌿",
      title: "Remover este galho?",
      message: subs ? `Os ${subs} galho(s) que saem dele também saem.\n\nCtrl+Z desfaz.` : "Ctrl+Z desfaz.",
      yes: "Remover",
      no: "Cancelar",
      danger: true,
    });
    if (!ok) return;
    commit((d) => deleteBranch(d, id));
    setLive({ branch: null });
  }

  return (
    <div className="sanc-branch-bar" onPointerDown={(e) => e.stopPropagation()} title="Clique numa bolinha para selecionar · arraste para mover · segure para trocar de lugar · Esc sai">
      <span className="sanc-branch-title">🌿 Galhos</span>
      <button type="button" onClick={() => add(ROOT_ID)} title="Um galho novo saindo do tronco">
        + Galho
      </button>
      <button type="button" disabled={!sel} onClick={() => sel && add(sel.id)} title={sel ? "Um galho saindo do galho selecionado" : "Selecione um galho primeiro"}>
        + Galho nele
      </button>
      <button type="button" disabled={!sel} onClick={removeSelected} title={sel ? "Remover o galho selecionado" : "Selecione um galho primeiro"}>
        🗑 Remover
      </button>
      <button type="button" onClick={() => getModeActions("arvore")?.shuffle?.()} title="Embaralhar os galhos e redesenhar a árvore (Ctrl+M)">
        🎲 Aleatorizar
      </button>
      <button type="button" className="done" onClick={exitBranchMode}>
        ✓ Pronto
      </button>
      <span className="sanc-branch-hint">Clique numa bolinha para selecionar · arraste para mover · segure para trocar de lugar · Esc sai</span>
    </div>
  );
}

/* ---------------- baixador de layout (exportar / importar) ---------------- */
const LAYOUT_FILE = "santuario-layout";
export function exportLayout(index) {
  const s = get();
  const layout = s.layouts[index];
  const payload = { app: LAYOUT_FILE, version: 1, kind: layout.kind, exportedAt: new Date().toISOString(), items: layout.items };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${LAYOUT_FILE}-${layout.kind}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export async function importLayout(index, file) {
  let data = null;
  try {
    data = JSON.parse(await file.text());
  } catch {
    data = null;
  }
  if (!data || data.app !== LAYOUT_FILE || !Array.isArray(data.items)) {
    await inform({ title: "Arquivo não reconhecido", message: "Escolha um arquivo de layout exportado pelo Santuário (.json)." });
    return;
  }
  const s = get();
  const target = LAYOUT_KINDS[s.layouts[index].kind];
  const from = LAYOUT_KINDS[data.kind]?.name;
  const ok = await ask({
    icon: "🗺️",
    title: `Importar para "${target.name}"?`,
    message: `As decorações deste layout serão trocadas pelas do arquivo${from && from !== target.name ? ` (feito em "${from}")` : ""}.\n\nDá para exportar antes, se quiser guardar o atual.`,
    yes: "Importar",
    no: "Cancelar",
  });
  if (!ok) return;
  const layouts = s.layouts.map((l, i) => (i === index ? { ...l, items: cleanItems(data.items), mined: [] } : l));
  setSanctuary({ layouts, viewing: index === s.active ? null : index, selected: null });
}

/* ---------------- painel "Layout" (editor de layouts + decorar) ---------------- */
export function SanctuaryPanel({ prefs }) {
  const [view, setView] = useState("closed"); // closed · layouts · decor
  const [slot, setSlot] = useState(prefs.active);
  const layout = shownLayout(prefs);
  const selected = prefs.selected ? layout.items.find((i) => i.id === prefs.selected) : null;

  // Clicar fora de uma árvore esconde a bolinha de aleatorizar
  useEffect(() => {
    const onDown = (e) => {
      if (get().poked && !(e.target.closest && e.target.closest(".sanc-drag, .sanc-poke"))) setLive({ poked: null });
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, []);

  // Com o lápis: Delete remove o selecionado, + e − mudam o tamanho, Esc solta
  useEffect(() => {
    if (!prefs.on || !prefs.editing) return undefined;
    const onKey = (e) => {
      if (isTyping(e.target) || document.querySelector(".modal-backdrop, .ui-dialog-backdrop")) return;
      const id = get().selected;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        setSanctuary(id ? { selected: null } : { editing: false });
      } else if (!id) {
        return;
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        e.stopImmediatePropagation();
        removeItem(id);
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        e.stopImmediatePropagation();
        resizeItem(id, 1.1);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        e.stopImmediatePropagation();
        resizeItem(id, 1 / 1.1);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [prefs.on, prefs.editing]);

  if (!prefs.on) {
    return (
      <div className="sanc-panel collapsed" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" className="sanc-toggle-btn" onClick={() => setSanctuary({ on: true, editing: false, viewing: null })} title="Ver o mundo do personagem">
          🏕️ Santuário
        </button>
      </div>
    );
  }

  const openLayouts = () => {
    setSlot(prefs.viewing ?? prefs.active);
    setView("layouts");
  };
  const finishEditing = () => {
    setSanctuary({ editing: false, selected: null, viewing: null });
    setView("layouts");
  };
  const close = () => {
    setSanctuary({ editing: false, selected: null, viewing: null });
    setView("closed");
  };
  const current = seasonOf(prefs.season);
  const type = selected ? ITEM_TYPES[selected.type] : null;
  const editingKind = LAYOUT_KINDS[layout.kind];

  return (
    <div className={`sanc-panel ${view !== "closed" ? "open" : ""}`} onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
      {view === "layouts" && (
        <div className="sanc-panel-body sanc-layouts">
          <div className="sanc-panel-title">Editor de layout</div>
          <div className="sanc-slots">
            {prefs.layouts.map((l, i) => {
              const k = LAYOUT_KINDS[l.kind];
              return (
                <button
                  key={l.kind}
                  type="button"
                  className={`sanc-slot ${slot === i ? "picked" : ""} ${prefs.active === i ? "is-active" : ""}`}
                  onClick={() => {
                    setSlot(i);
                    // ver o layout escolhido na tela (sem mudar o ativo)
                    setSanctuary({ viewing: i === prefs.active ? null : i, selected: null });
                  }}
                  onDoubleClick={() => {
                    setSlot(i);
                    setSanctuary({ viewing: i, editing: true, selected: null });
                    setView("decor");
                  }}
                >
                  <LayoutPreview layout={l} />
                  <span className="sanc-slot-name">
                    {k.icon} {k.name}
                  </span>
                  {prefs.active === i && <span className="sanc-slot-active">Ativo</span>}
                </button>
              );
            })}
          </div>
          <div className="sanc-transfer">
            <span>Baixador de layout · {LAYOUT_KINDS[prefs.layouts[slot].kind].name}</span>
            <div className="sanc-transfer-row">
              <button type="button" className="sanc-action" onClick={() => exportLayout(slot)} title="Baixar este layout num arquivo">
                ⬇ Exportar
              </button>
              <label className="sanc-action" title="Carregar um layout de um arquivo">
                ⬆ Importar
                <input
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files && e.target.files[0];
                    e.target.value = "";
                    if (f) importLayout(slot, f);
                  }}
                />
              </label>
            </div>
          </div>
          <div className="sanc-slot-actions">
            <button
              type="button"
              className="sanc-action edit"
              onClick={() => {
                setSanctuary({ viewing: slot, editing: true, selected: null });
                setView("decor");
              }}
            >
              ✏️ Editar layout
            </button>
            <button
              type="button"
              className="sanc-action"
              disabled={prefs.active === slot}
              onClick={() => setSanctuary({ active: slot, viewing: null })}
            >
              {prefs.active === slot ? "✓ Ativo" : "Definir como ativo"}
            </button>
          </div>
          {TEXT_FEATURES && (
            <button type="button" className="sanc-back-btn" onClick={() => setSanctuary({ on: false, editing: false, selected: null, viewing: null })}>
              🌳 Ver como Árvore (galhos e notas)
            </button>
          )}
        </div>
      )}

      {view === "decor" && (
        <div className="sanc-panel-body sanc-decor">
          <div className="sd-head">
            <button type="button" className="sd-back" onClick={finishEditing} title="Voltar aos layouts">
              ←
            </button>
            <div className="sd-title">
              <small>Decorando</small>
              <b>
                {editingKind.icon} {editingKind.name}
              </b>
            </div>
            <button type="button" className="sd-done" onClick={finishEditing}>
              ✓ Pronto
            </button>
          </div>

          <label className={`sd-switch ${prefs.editing ? "on" : ""}`} title="Com isto ligado você arrasta, muda o tamanho e remove">
            <span>✏️ Mover e editar</span>
            <input type="checkbox" checked={Boolean(prefs.editing)} onChange={() => setSanctuary({ editing: !prefs.editing, selected: null })} />
            <i aria-hidden="true" />
          </label>

          <div className="sd-scroll">
            {prefs.editing && (
              <div className={`sd-card ${selected ? "has" : ""}`}>
                {selected ? (
                  <>
                    <div className="sd-card-head">
                      <span className="sd-ico big">{type.icon}</span>
                      <b>{type.name}</b>
                      <button type="button" className="sd-x" onClick={() => setSanctuary({ selected: null })} title="Soltar (Esc)">
                        ✕
                      </button>
                    </div>
                    <label className="sd-size">
                      <span>Tamanho</span>
                      <input
                        type="range"
                        min={type.min}
                        max={type.max}
                        step="0.05"
                        value={selected.size || 1}
                        onChange={(e) => updateItem(selected.id, { size: Number(e.target.value) })}
                      />
                      <b>{Math.round((selected.size || 1) * 100)}%</b>
                    </label>
                    {type.bg && (
                      <div className="sd-seg" role="group" aria-label="Camada">
                        {[1, 2, 3].map((L) => (
                          <button
                            key={L}
                            type="button"
                            className={(selected.layer || 2) === L ? "on" : ""}
                            onClick={() => updateItem(selected.id, { layer: L })}
                            title={L === 1 ? "Mais perto e mais escura" : L === 3 ? "Mais longe e mais clara" : "No meio"}
                          >
                            {L === 1 ? "Perto" : L === 2 ? "Meio" : "Longe"}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="sd-actions">
                      {type.flip && (
                        <button type="button" onClick={() => updateItem(selected.id, { flip: !selected.flip })} title="Espelhar para o outro lado">
                          ↔ Virar
                        </button>
                      )}
                      {type.random && (
                        <button type="button" onClick={() => randomizeItem(selected)} title="Sortear outro desenho">
                          🎲 Sortear
                        </button>
                      )}
                      {selected.type !== "main" && (
                        <button type="button" className="danger" onClick={() => removeItem(selected.id)} title="Remover (Delete)">
                          🗑 Remover
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="sd-empty">Clique em algo no mundo para editar. Arraste para mover.</div>
                )}
              </div>
            )}

            <div className="sd-label">No chão</div>
            <div className="sd-grid">
              {ADDABLE.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="sd-tile"
                  onClick={() => addItem(t)}
                  title={t === "land" ? "Levanta o chão e, nas ilhas, cria chão novo" : t === "grass" ? "Tufos que nascem da terra (seguem o relevo)" : `Adicionar ${ITEM_TYPES[t].label}`}
                >
                  <span className="sd-ico">{ITEM_TYPES[t].icon}</span>
                  <span>{ITEM_TYPES[t].name}</span>
                </button>
              ))}
            </div>

            <div className="sd-label">Fundo (em camadas)</div>
            <div className="sd-grid two">
              {BG_ADDABLE.map((t) => (
                <button key={t} type="button" className="sd-tile" onClick={() => addItem(t)} title={`Adicionar ${ITEM_TYPES[t].label} — arraste para qualquer lugar`}>
                  <span className="sd-ico">{ITEM_TYPES[t].icon}</span>
                  <span>{ITEM_TYPES[t].name}</span>
                </button>
              ))}
            </div>

            <div className="sd-label">Ambiente</div>
            <label className={`sd-switch small ${prefs.lanterns ? "on" : ""}`}>
              <span>🏮 Lanternas nos galhos</span>
              <input type="checkbox" checked={Boolean(prefs.lanterns)} onChange={() => setSanctuary({ lanterns: !prefs.lanterns })} />
              <i aria-hidden="true" />
            </label>
            <label className={`sd-switch small ${prefs.grass !== false ? "on" : ""}`} title="Capim, moitas, samambaias, trevos e juncos espalhados pela terra">
              <span>🌿 Matos espalhados pela terra</span>
              <input type="checkbox" checked={prefs.grass !== false} onChange={() => setSanctuary({ grass: prefs.grass === false })} />
              <i aria-hidden="true" />
            </label>
            <div className="sd-seasons" role="group" aria-label="Estação">
              {SEASONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={prefs.season === s.id ? "on" : ""}
                  onClick={() => setSanctuary({ season: s.id })}
                  title={s.id === "auto" ? `Segue o calendário (agora: ${SEASONS.find((x) => x.id === current)?.label})` : s.label}
                >
                  <span>{s.icon}</span>
                  <small>{s.id === "auto" ? "Auto" : s.label}</small>
                </button>
              ))}
            </div>

            <div className="sd-keys">
              <span><kbd>Delete</kbd> remove</span>
              <span><kbd>+</kbd><kbd>−</kbd> tamanho</span>
              <span><kbd>Esc</kbd> solta</span>
              <span><kbd>WASD</kbd> anda · <kbd>Espaço</kbd> pula</span>
              <span><kbd>2</kbd> cava (teclado numérico) · <kbd>4</kbd><kbd>6</kbd> lados · <kbd>8</kbd> em cima</span>
            </div>
            <button type="button" className="sd-reset" onClick={() => resetLayout(layout.kind)}>
              ↺ Voltar este layout ao começo
            </button>
          </div>
        </div>
      )}

      {prefs.editing && view !== "decor" && <div className="sanc-edit-hint">✏️ Arraste o que quiser · Delete remove · + − tamanho</div>}
      <button type="button" className="sanc-toggle-btn" onClick={() => (view === "closed" ? openLayouts() : close())} aria-expanded={view !== "closed"}>
        {view === "closed" ? "🗺️ Layout" : "✕ Fechar"}
      </button>
    </div>
  );
}
