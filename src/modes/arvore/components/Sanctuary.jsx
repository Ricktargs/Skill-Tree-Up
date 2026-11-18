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
};
export const ADDABLE = ["land", "tree", "lake", "tent", "fire", "fireflies", "post"];
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
const DEFAULT = { on: true, lanterns: true, season: "auto", active: 0 };

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
    layouts = v.layouts.map((l, i) => ({ kind: Object.keys(LAYOUT_KINDS)[i], items: cleanItems(l.items) }));
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
export function setSanctuary(patch) {
  state = { ...get(), ...patch };
  const { on, lanterns, season, layouts, active } = state;
  saveJSON(KEY, { on, lanterns, season, layouts, active });
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

  const top = (x) => {
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
  const main = items.find((i) => i.type === "main") || { x: MAIN_X, size: 1 };
  const mainBase = top(main.x) - 16;
  const xs = segments.flat();
  return {
    kind,
    items,
    segments,
    top,
    walk,
    main,
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
    const pts = [];
    for (let x = TERRA_MIN - 1500; x <= TERRA_MAX + 1500; x += 25) pts.push([x, top(x)]);
    const body = `${smoothPath(pts)} L ${TERRA_MAX + 1500} 4000 L ${TERRA_MIN - 1500} 4000 Z`;
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
        const pts = [];
        for (let x = a; x <= b + 0.1; x += 20) pts.push([x, top(x)]);
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
        const body = smoothPath([...pts, ...under], true);
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
    setLive({ selected: item.id });
    const move = (ev) => {
      const p = toP(ev);
      const x = Math.round(clamp(p.x - grabX, -2500, 3800));
      const patch = { x };
      if (item.type === "fireflies") patch.h = Math.round(clamp(world.top(x) - p.y, 20, 420));
      if (item.type === "bgisland") patch.h = Math.round(clamp(groundY(x) - p.y, 40, 700));
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

/** Envolve o desenho da árvore principal: posição, tamanho e arrasto. */
export function MainTreeWrap({ world, children }) {
  if (!world) return children;
  return (
    <Draggable item={world.main} world={world} transform={world.mainTransform} pokeAt={{ x: MAIN_X, y: BASE_Y - 250 }}>
      {children}
    </Draggable>
  );
}

/* ---------------- atrás da árvore principal ---------------- */
export const SanctuaryBack = memo(function SanctuaryBack({ world, season }) {
  const order = ["land", "lake", "tree", "tent", "fire", "post"];
  const items = world.items.filter((i) => order.includes(i.type)).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  return (
    <g className="sanc-back">
      {season === "inverno" && <SnowCover world={world} />}
      {items.map((it) => (
        <Draggable key={it.id} item={it} world={world} pokeAt={it.type === "tree" ? { x: it.x, y: world.top(it.x) - 230 * (it.size || 1) } : null}>
          {it.type === "lake" && <Lake x={it.x} size={it.size || 1} top={world.top} season={season} />}
          {it.type === "tree" && (
            <g transform={it.flip ? `translate(${2 * it.x} 0) scale(-1 1)` : undefined}>
              <DecoTree id={it.id} x={it.x} size={it.size || 1} top={world.top} variant={it.seed || 0} />
            </g>
          )}
          {it.type === "tent" && <Tent x={it.x} size={it.size || 1} top={world.top} dir={it.flip ? -1 : 1} />}
          {it.type === "fire" && <Fire x={it.x} size={it.size || 1} top={world.top} dir={it.flip ? -1 : 1} />}
          {it.type === "post" && <LanternPost x={it.x} size={it.size || 1} top={world.top} seed={hashString(it.id)} dir={it.flip ? -1 : 1} />}
          {it.type === "land" && <LandHandle x={it.x} size={it.size || 1} top={world.top} />}
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
const DecoTree = memo(function DecoTree({ id, x, size, top, variant = 0, noRoots = false }) {
  const seed = hashString(id) + variant;
  const t = {
    index: 0,
    x,
    baseY: top(x) - 14 * size,
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
        // anda mais devagar que a cena quando a câmera se move
        const ox = (-view.x * (1 - k)) / (view.zoom || 1);
        const oy = (-view.y * (1 - k) * 0.6) / (view.zoom || 1);
        return (
          <g key={L} transform={`translate(${ox} ${oy})`}>
            <g transform={baseTransform} className={`sanc-world sanc-bg l${L}`}>
              {list.map((it) => {
                const size = (it.size || 1) * LAYER_SCALE[L];
                const mirror = it.flip ? `translate(${2 * it.x} 0) scale(-1 1)` : undefined;
                if (it.type === "bgtree") {
                  const base = groundY(it.x) + 26 - (L - 1) * 30;
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
const SPEED = 190; // unidades do desenho por segundo
const DEPTH_SPEED = 70;
const JUMP_SPEED = 300;
const GRAVITY = 980;
const DEPTH_MIN = -16;
const DEPTH_MAX = 30;

const isTyping = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

export function SanctuaryHero({ groupRef, containerRef, world, onPan }) {
  const { editing } = useSanctuaryState();
  const boxRef = useRef(null);
  const [startX] = useState(() => {
    const fire = world.items.find((i) => i.type === "fire");
    const x = fire ? fire.x + 62 : world.main.x + 160;
    const b = world.walk(x);
    return clamp(x, b.min, b.max);
  });
  const pos = useRef({ x: startX, z: 0, jump: 0, vy: 0 });
  const keys = useRef(new Set());
  const raf = useRef(0);
  const last = useRef(0);
  const [facing, setFacing] = useState(0); // -1 esquerda · 0 de frente · 1 direita
  const [walking, setWalking] = useState(false);
  const [hero] = useState(() => normalizeHero(readProfileValue("rpg_hero_v1", getActiveProfileId(), DEFAULT_HERO)));
  const worldRef = useRef(world);
  const panRef = useRef(onPan);
  useEffect(() => {
    worldRef.current = world;
    panRef.current = onPan;
  });

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
      heroX = p.x;
      const ground = w.top(p.x) + 4 + p.z;
      const pt = new DOMPoint(p.x, ground - p.jump).matrixTransform(ctm);
      const r = wrap.getBoundingClientRect();
      const sx = pt.x - r.left;
      const sy = pt.y - r.top;
      box.style.left = `${sx}px`;
      box.style.top = `${sy}px`;
      box.style.setProperty("--sanc-hero-size", String(Math.max(0.3, ctm.a * 0.95 * (1 + p.z * 0.006))));
      box.style.zIndex = p.z > 8 ? "4" : "3";
      // câmera acompanha quando ele chega perto da borda da tela
      if (follow && panRef.current) {
        const mx = r.width * 0.2;
        const my = r.height * 0.2;
        const dx = sx < mx ? mx - sx : sx > r.width - mx ? r.width - mx - sx : 0;
        const dy = sy < my ? my - sy : sy > r.height - my ? r.height - my - sy : 0;
        if (dx || dy) panRef.current(dx, dy);
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

  // Laço de movimento: roda só enquanto alguma tecla está apertada ou ele está no ar
  const loopRef = useRef(null);
  const loop = useCallback(
    (t) => {
      const dt = Math.min(0.05, (t - (last.current || t)) / 1000);
      last.current = t;
      const k = keys.current;
      const p = pos.current;
      const dx = (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0);
      const dz = (k.has("s") ? 1 : 0) - (k.has("w") ? 1 : 0);
      const b = worldRef.current.walk(p.x);
      p.x = clamp(p.x + dx * SPEED * dt, b.min, b.max);
      p.z = clamp(p.z + dz * DEPTH_SPEED * dt, DEPTH_MIN, DEPTH_MAX);
      if (p.jump > 0 || p.vy > 0) {
        p.vy -= GRAVITY * dt;
        p.jump = Math.max(0, p.jump + p.vy * dt);
        if (p.jump === 0) p.vy = 0;
      }
      place(true);
      if (dx !== 0 || dz !== 0 || p.jump > 0 || p.vy > 0) {
        raf.current = requestAnimationFrame(loopRef.current);
      } else {
        raf.current = 0;
        last.current = 0;
      }
    },
    [place]
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

  const jump = useCallback(() => {
    const p = pos.current;
    if (p.jump > 0.5) return; // só pula do chão
    p.vy = JUMP_SPEED;
    p.jump = 0.01;
    kick();
  }, [kick]);

  // Teclado: só no Santuário, fora de campos de texto, janelas e do lápis
  useEffect(() => {
    const MOVE = ["w", "a", "s", "d"];
    const refreshPose = () => {
      const k = keys.current;
      const dx = (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0);
      if (dx !== 0) setFacing(dx);
      setWalking(MOVE.some((m) => k.has(m)));
    };
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
      const key = (e.key || "").toLowerCase();
      if (MOVE.includes(key)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!keys.current.has(key)) {
          keys.current.add(key);
          refreshPose();
          kick();
        }
      } else if (e.key === " " || e.code === "Space") {
        // Espaço pula (no Santuário não centraliza a tela)
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat) jump();
      }
    };
    const onUp = (e) => {
      const key = (e.key || "").toLowerCase();
      if (keys.current.delete(key)) refreshPose();
    };
    const clear = () => {
      keys.current.clear();
      refreshPose();
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
  }, [kick, jump]);

  // virado para o lado em que anda; parado, olha um pouco para a frente
  const rotation = walking ? facing * 70 : facing * 25 - (facing === 0 ? 22 : 0);

  return (
    <div
      ref={boxRef}
      className={`sanc-hero ${walking ? "walking" : ""} ${editing ? "is-editing" : ""}`}
      title="W A S D para andar · Espaço para pular"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={jump}
    >
      <HeroModel hero={hero} rotation={rotation} size={1} />
    </div>
  );
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
  const { data, commit, logPoints } = useArvore();
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
    logPoints(15, "Galho criado");
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
  const layouts = s.layouts.map((l, i) => (i === index ? { ...l, items: cleanItems(data.items) } : l));
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
        <div className="sanc-panel-body">
          <div className="sanc-decor-head">
            <button type="button" className="sanc-link" onClick={finishEditing}>
              ← Layouts
            </button>
            <span>
              Editando: {editingKind.icon} {editingKind.name}
            </span>
          </div>

          <div className="sanc-panel-sub">Adicionar</div>
          <div className="sanc-chips">
            {ADDABLE.map((t) => (
              <button key={t} type="button" className="sanc-chip add" onClick={() => addItem(t)} title={t === "land" ? "Levanta o chão e, nas ilhas, cria chão novo" : "Adicionar"}>
                {ITEM_TYPES[t].icon} {ITEM_TYPES[t].name}
              </button>
            ))}
          </div>

          <div className="sanc-panel-sub">Fundo (em camadas)</div>
          <div className="sanc-chips">
            {BG_ADDABLE.map((t) => (
              <button key={t} type="button" className="sanc-chip add" onClick={() => addItem(t)}>
                {ITEM_TYPES[t].icon} {ITEM_TYPES[t].name}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`sanc-pencil ${prefs.editing ? "on" : ""}`}
            onClick={() => setSanctuary({ editing: !prefs.editing, selected: null })}
            title="Arrastar, mudar o tamanho e remover"
          >
            ✏️ {prefs.editing ? "Mover e editar: ligado" : "Mover e editar"}
          </button>

          {prefs.editing && (
            <div className="sanc-selected">
              {selected ? (
                <>
                  <div className="sanc-selected-name">
                    {type.icon} {type.name}
                  </div>
                  <label className="sanc-size">
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
                  {ITEM_TYPES[selected.type].bg && (
                    <div className="sanc-layer-row">
                      <span>Camada</span>
                      {[1, 2, 3].map((L) => (
                        <button key={L} type="button" className={`sanc-chip ${(selected.layer || 2) === L ? "on" : ""}`} onClick={() => updateItem(selected.id, { layer: L })} title={L === 1 ? "Mais perto e mais escura" : L === 3 ? "Mais longe e mais clara" : "No meio"}>
                          {L === 1 ? "Perto" : L === 2 ? "Meio" : "Longe"}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="sanc-item-actions">
                    {ITEM_TYPES[selected.type].flip && (
                      <button type="button" className="sanc-remove" onClick={() => updateItem(selected.id, { flip: !selected.flip })} title="Espelhar para o outro lado">
                        ↔ Virar
                      </button>
                    )}
                    {ITEM_TYPES[selected.type].random && (
                      <button type="button" className="sanc-remove" onClick={() => randomizeItem(selected)} title="Sortear outro desenho">
                        🎲 Aleatorizar
                      </button>
                    )}
                    {selected.type !== "main" && (
                      <button type="button" className="sanc-remove" onClick={() => removeItem(selected.id)}>
                        🗑 Remover
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="sanc-panel-hint">Clique em algo para selecionar. Arraste para mover.</div>
              )}
              <div className="sanc-panel-hint small">
                <kbd>Delete</kbd> remove · <kbd>+</kbd> <kbd>−</kbd> tamanho · <kbd>Esc</kbd> solta
              </div>
            </div>
          )}

          <div className="sanc-panel-sub">Enfeites</div>
          <div className="sanc-chips">
            <button type="button" className={`sanc-chip ${prefs.lanterns ? "on" : ""}`} onClick={() => setSanctuary({ lanterns: !prefs.lanterns })}>
              🏮 Lanternas nos galhos
            </button>
          </div>

          <div className="sanc-panel-sub">Estação</div>
          <div className="sanc-chips">
            {SEASONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`sanc-chip ${prefs.season === s.id ? "on" : ""}`}
                onClick={() => setSanctuary({ season: s.id })}
                title={s.id === "auto" ? `Segue o calendário (agora: ${SEASONS.find((x) => x.id === current)?.label})` : undefined}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>

          <div className="sanc-panel-hint">
            🎮 <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> anda · <kbd>Espaço</kbd> pula (com o lápis desligado)
          </div>
          <button type="button" className="sanc-back-btn" onClick={() => setItems(defaultsFor(layout.kind))}>
            ↺ Voltar este layout ao começo
          </button>
          <button type="button" className="sanc-action edit wide" onClick={finishEditing}>
            ✓ Pronto
          </button>
        </div>
      )}

      {prefs.editing && view !== "decor" && <div className="sanc-edit-hint">✏️ Arraste o que quiser · Delete remove · + − tamanho</div>}
      <button type="button" className="sanc-toggle-btn" onClick={() => (view === "closed" ? openLayouts() : close())} aria-expanded={view !== "closed"}>
        {view === "closed" ? "🗺️ Layout" : "✕ Fechar"}
      </button>
    </div>
  );
}
