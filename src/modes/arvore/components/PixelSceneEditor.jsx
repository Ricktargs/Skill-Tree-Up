/* =========================================================
   MODO DESENVOLVEDOR DO SANTUÁRIO
   Janela inteira para editar o cenário em pixel art:
   - Texturas: pinta qualquer pixel de qualquer camada (mundo,
     fundos e dentro da casa); seleciona, move, copia e cola.
   - Blocos: onde o personagem pisa e bate (quadradinhos de 4 px).
   - Objetos: muda de lugar a porta, o baú, a cama, a escada...
   Tudo fica guardado por perfil; "Restaurar" volta ao original.
========================================================= */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tx, useLanguage } from "../../../i18n/index.jsx";
import { ask } from "../../../shared/Dialog.jsx";
import { sfx } from "../lib/sound";
import { GRID_IN, GRID_OUT, SCENES, SPOTS, TILE, defaultSolid } from "./pixelWorld.js";
import { artKey, blobToCanvas, canvasToBlob, removeDev, saveDev, solidKey, spotsKey } from "./sanctuaryDevStore.js";
import "./PixelSceneEditor.css";

const LAYERS = [
  { id: "world", name: "Mundo (fora)", where: "out" },
  { id: "mid", name: "Fundo de perto", where: "out", bg: true },
  { id: "far", name: "Fundo de longe", where: "out", bg: true },
  { id: "house", name: "Dentro da casa", where: "in" }
];
const TOOLS = [
  { id: "pencil", icon: "✏️", name: "Lápis", key: "B" },
  { id: "eraser", icon: "🧽", name: "Borracha", key: "E" },
  { id: "restore", icon: "↺", name: "Restaurar original", key: "R" },
  { id: "fill", icon: "🪣", name: "Balde", key: "G" },
  { id: "pick", icon: "💧", name: "Conta-gotas", key: "I" },
  { id: "select", icon: "⬚", name: "Selecionar e mover", key: "M" },
  { id: "hand", icon: "✋", name: "Mover a vista", key: "H" }
];
const PALETTE = [
  "#000000", "#1f130a", "#3d2412", "#4e2f17", "#6b4423", "#7d5130", "#946238", "#a8743e",
  "#c48a52", "#e5c08a", "#f0d595", "#fff8e7", "#ffffff", "#d1d5db", "#9ca3af", "#6b7280",
  "#374151", "#1f2937", "#1b5a2c", "#26773a", "#3a9a44", "#6cc457", "#8fd86a", "#a4dc93",
  "#7a2e10", "#b4471a", "#de7424", "#f4b23e", "#facc15", "#fde68a", "#dc2626", "#f87171",
  "#f9a8d4", "#c084fc", "#7c3aed", "#2563eb", "#3b82f6", "#5bb8f5", "#8fd3fa", "#2f7fc1",
  "#0a0f2c", "#28405e", "#8d8378", "#5d4330"
];
const MAX_HISTORY = 60;
const SEASON_NAMES = { primavera: "Primavera", verao: "Verão", outono: "Outono", inverno: "Inverno" };

const mkCanvas = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
const hexOf = (r, g, b) => `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
const rgbOf = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
function crop(img, x, y, w, h) {
  const out = new ImageData(w, h);
  for (let r = 0; r < h; r++) {
    const s = ((y + r) * img.width + x) * 4;
    out.data.set(img.data.subarray(s, s + w * 4), r * w * 4);
  }
  return out;
}
function isEmpty(canvas) {
  const d = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < d.length; i += 4) if (d[i]) return false;
  return true;
}

// gate do teclado: registrado ao carregar o módulo, antes dos atalhos globais
let keyHandler = null;
if (typeof window !== "undefined") {
  const gate = (e) => {
    if (!keyHandler || !document.querySelector(".pwd-editor")) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA") && e.key !== "Escape") return;
    if (document.querySelector(".ui-dialog-backdrop")) return;
    keyHandler(e);
    e.stopImmediatePropagation();
  };
  window.addEventListener("keydown", gate, true);
  window.addEventListener("keyup", (e) => {
    if (keyHandler && document.querySelector(".pwd-editor") && keyHandler.up) keyHandler.up(e);
  }, true);
}

export default function PixelSceneEditor({ kind, season, bases, devData, onData, onClose }) {
  useLanguage();
  const viewRef = useRef(null);
  const [layerId, setLayerId] = useState("world");
  const [mode, setMode] = useState("paint"); // paint · solid · objects
  const [tool, setTool] = useState("pencil");
  const [color, setColor] = useState("#3a9a44");
  const [recent, setRecent] = useState([]);
  const [size, setSize] = useState(1);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showBlocks, setShowBlocks] = useState(false);
  const [hover, setHover] = useState(null);
  const [, setTick] = useState(0);
  const rerender = () => setTick((t) => t + 1);

  const layer = LAYERS.find((l) => l.id === layerId);
  const where = layer.where;
  const G = where === "out" ? GRID_OUT : GRID_IN;

  // camadas carregadas: { base, overlay, erase, comp, dirty }
  const works = useRef({});
  const grids = useRef({});
  const spotsWork = useRef({});
  const hist = useRef({ undo: [], redo: [] });
  const cam = useRef({ zoom: 3, x: 0, y: 0 });
  const op = useRef(null);
  const sel = useRef(null);
  const floating = useRef(null);
  const clip = useRef(null);
  const drag = useRef(null);
  const spaceDown = useRef(false);

  const layerBase = (id) => (id === "world" ? bases.world : id === "house" ? bases.house : bases[id]);

  /* ---------- carregar ---------- */
  const loadLayer = useCallback(
    async (id) => {
      if (works.current[id]) return works.current[id];
      const base = layerBase(id);
      if (!base) return null;
      const rec = devData[artKey(id, kind)];
      const overlay = await blobToCanvas(rec && rec.overlay, base.width, base.height);
      const erase = await blobToCanvas(rec && rec.erase, base.width, base.height);
      const comp = mkCanvas(base.width, base.height);
      const w = { id, base, overlay, erase, comp, og: overlay.getContext("2d"), eg: erase.getContext("2d"), cg: comp.getContext("2d"), dirty: false };
      w.cg.imageSmoothingEnabled = false;
      recompose(w, 0, 0, base.width, base.height);
      works.current[id] = w;
      return w;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bases, devData, kind]
  );
  const gridFor = (wh) => {
    if (!grids.current[wh]) {
      const def = defaultSolid(wh, kind);
      const grid = def.slice();
      const rec = devData[solidKey(wh, kind)];
      if (rec && rec.diff) Object.entries(rec.diff).forEach(([i, v]) => (grid[+i] = v ? 1 : 0));
      grids.current[wh] = { def, grid, dirty: false };
    }
    return grids.current[wh];
  };
  const spotsFor = (wh) => {
    if (!spotsWork.current[wh]) {
      const rec = devData[spotsKey(wh, kind)];
      const list = SPOTS.filter((s) => s.where === wh).map((s) => {
        const o = rec && rec.map && rec.map[s.id];
        return { ...s, x: o ? o.x : s.x, y: o ? o.y : s.y, dx: s.x, dy: s.y };
      });
      spotsWork.current[wh] = { list, dirty: false };
    }
    return spotsWork.current[wh];
  };

  // abre a camada e centraliza a vista
  useEffect(() => {
    let alive = true;
    setReady(false);
    loadLayer(layerId).then((w) => {
      if (!alive || !w) return;
      const el = viewRef.current;
      const vw = el ? el.clientWidth : 800;
      const vh = el ? el.clientHeight : 500;
      const z = layerId === "house" ? Math.max(1, Math.floor(Math.min(vw / w.base.width, vh / w.base.height))) : Math.max(1, Math.floor(vh / 260));
      const focusX = layerId === "world" ? 1000 : w.base.width / 2;
      const focusY = layerId === "house" ? w.base.height / 2 - 40 : G.oy + 130;
      cam.current = { zoom: z, x: focusX - vw / z / 2, y: focusY - vh / z / 2 };
      setReady(true);
    });
    sel.current = null;
    floating.current = null;
    if (LAYERS.find((l) => l.id === layerId).bg && mode !== "paint") setMode("paint");
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerId, loadLayer]);

  /* ---------- pixels ---------- */
  function recompose(w, x, y, ww, hh) {
    x = Math.max(0, Math.floor(x));
    y = Math.max(0, Math.floor(y));
    ww = Math.min(w.base.width - x, Math.ceil(ww));
    hh = Math.min(w.base.height - y, Math.ceil(hh));
    if (ww <= 0 || hh <= 0) return;
    const g = w.cg;
    g.clearRect(x, y, ww, hh);
    g.drawImage(w.base, x, y, ww, hh, x, y, ww, hh);
    g.globalCompositeOperation = "destination-out";
    g.drawImage(w.erase, x, y, ww, hh, x, y, ww, hh);
    g.globalCompositeOperation = "source-over";
    g.drawImage(w.overlay, x, y, ww, hh, x, y, ww, hh);
  }
  const work = () => works.current[layerId];

  const beginOp = () => {
    const w = work();
    if (!w || op.current) return;
    const W = w.base.width;
    const H = w.base.height;
    op.current = { kind: "art", layer: layerId, o: w.og.getImageData(0, 0, W, H), e: w.eg.getImageData(0, 0, W, H), box: null };
  };
  const markBox = (x, y, ww, hh) => {
    const o = op.current;
    if (!o) return;
    const b = o.box;
    o.box = b ? { x0: Math.min(b.x0, x), y0: Math.min(b.y0, y), x1: Math.max(b.x1, x + ww), y1: Math.max(b.y1, y + hh) } : { x0: x, y0: y, x1: x + ww, y1: y + hh };
  };
  const endOp = () => {
    const o = op.current;
    op.current = null;
    if (!o || !o.box) return;
    const w = works.current[o.layer];
    const x = Math.max(0, Math.floor(o.box.x0));
    const y = Math.max(0, Math.floor(o.box.y0));
    const ww = Math.min(w.base.width, Math.ceil(o.box.x1)) - x;
    const hh = Math.min(w.base.height, Math.ceil(o.box.y1)) - y;
    if (ww <= 0 || hh <= 0) return;
    pushHist({
      kind: "art",
      layer: o.layer,
      x,
      y,
      w: ww,
      h: hh,
      before: { o: crop(o.o, x, y, ww, hh), e: crop(o.e, x, y, ww, hh) },
      after: { o: w.og.getImageData(x, y, ww, hh), e: w.eg.getImageData(x, y, ww, hh) }
    });
    w.dirty = true;
    setDirty(true);
  };
  const cancelOp = () => {
    const o = op.current;
    op.current = null;
    if (!o || !o.box) return;
    const w = works.current[o.layer];
    w.og.putImageData(o.o, 0, 0);
    w.eg.putImageData(o.e, 0, 0);
    recompose(w, o.box.x0, o.box.y0, o.box.x1 - o.box.x0, o.box.y1 - o.box.y0);
  };
  const pushHist = (entry) => {
    const h = hist.current;
    h.undo.push(entry);
    if (h.undo.length > MAX_HISTORY) h.undo.shift();
    h.redo = [];
  };

  const dab = (x, y, t = tool) => {
    const w = work();
    if (!w) return;
    const s = size;
    const x0 = x - Math.floor((s - 1) / 2);
    const y0 = y - Math.floor((s - 1) / 2);
    if (t === "pencil") {
      w.og.fillStyle = color;
      w.og.fillRect(x0, y0, s, s);
    } else if (t === "eraser") {
      w.og.clearRect(x0, y0, s, s);
      w.eg.fillStyle = "#000";
      w.eg.fillRect(x0, y0, s, s);
    } else if (t === "restore") {
      w.og.clearRect(x0, y0, s, s);
      w.eg.clearRect(x0, y0, s, s);
    }
    markBox(x0, y0, s, s);
    recompose(w, x0, y0, s, s);
  };
  const line = (a, b, fn) => {
    let [x0, y0] = a;
    const [x1, y1] = b;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let i = 0; i < 4000; i++) {
      fn(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  };
  const floodFill = (x, y) => {
    const w = work();
    const W = w.base.width;
    const H = w.base.height;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const comp = w.cg.getImageData(0, 0, W, H).data;
    const i0 = (y * W + x) * 4;
    const target = [comp[i0], comp[i0 + 1], comp[i0 + 2], comp[i0 + 3]];
    const same = (i) => comp[i] === target[0] && comp[i + 1] === target[1] && comp[i + 2] === target[2] && comp[i + 3] === target[3];
    const [r, g, b] = rgbOf(color);
    if (target[3] === 255 && target[0] === r && target[1] === g && target[2] === b) return;
    beginOp();
    const ov = w.og.getImageData(0, 0, W, H);
    const seen = new Uint8Array(W * H);
    const stack = [y * W + x];
    let n = 0;
    let bx0 = x;
    let by0 = y;
    let bx1 = x;
    let by1 = y;
    while (stack.length && n < 400000) {
      const p = stack.pop();
      if (seen[p]) continue;
      seen[p] = 1;
      if (!same(p * 4)) continue;
      n++;
      ov.data[p * 4] = r;
      ov.data[p * 4 + 1] = g;
      ov.data[p * 4 + 2] = b;
      ov.data[p * 4 + 3] = 255;
      const px = p % W;
      const py = (p - px) / W;
      if (px < bx0) bx0 = px;
      if (px > bx1) bx1 = px;
      if (py < by0) by0 = py;
      if (py > by1) by1 = py;
      if (px > 0) stack.push(p - 1);
      if (px < W - 1) stack.push(p + 1);
      if (py > 0) stack.push(p - W);
      if (py < H - 1) stack.push(p + W);
    }
    w.og.putImageData(ov, 0, 0);
    markBox(bx0, by0, bx1 - bx0 + 1, by1 - by0 + 1);
    recompose(w, bx0, by0, bx1 - bx0 + 1, by1 - by0 + 1);
    endOp();
  };
  const pickColor = (x, y) => {
    const w = work();
    const d = w.cg.getImageData(x, y, 1, 1).data;
    if (!d[3]) return;
    pickSwatch(hexOf(d[0], d[1], d[2]));
    setTool("pencil");
  };
  const pickSwatch = (c) => {
    setColor(c);
    setRecent((r) => [c, ...r.filter((x) => x !== c)].slice(0, 10));
  };

  /* ---------- seleção / mover / colar ---------- */
  const liftSelection = () => {
    const w = work();
    const s = sel.current;
    if (!w || !s || floating.current) return;
    beginOp();
    const c = mkCanvas(s.w, s.h);
    c.getContext("2d").drawImage(w.comp, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
    w.og.clearRect(s.x, s.y, s.w, s.h);
    w.eg.fillStyle = "#000";
    w.eg.fillRect(s.x, s.y, s.w, s.h);
    markBox(s.x, s.y, s.w, s.h);
    recompose(w, s.x, s.y, s.w, s.h);
    floating.current = { c, x: s.x, y: s.y };
  };
  const commitFloating = () => {
    const f = floating.current;
    const w = work();
    if (!f || !w) return;
    w.og.drawImage(f.c, f.x, f.y);
    // onde a cópia tem pixel, tira o "apagado" que estava embaixo
    w.eg.globalCompositeOperation = "destination-out";
    w.eg.drawImage(f.c, f.x, f.y);
    w.eg.globalCompositeOperation = "source-over";
    markBox(f.x, f.y, f.c.width, f.c.height);
    recompose(w, f.x, f.y, f.c.width, f.c.height);
    sel.current = { x: f.x, y: f.y, w: f.c.width, h: f.c.height };
    floating.current = null;
    endOp();
  };
  const copySelection = () => {
    const w = work();
    const s = sel.current;
    if (!w || !s) return;
    const c = mkCanvas(s.w, s.h);
    c.getContext("2d").drawImage(floating.current ? floating.current.c : w.comp, floating.current ? 0 : s.x, floating.current ? 0 : s.y, s.w, s.h, 0, 0, s.w, s.h);
    clip.current = c;
    sfx.play("tick");
  };
  const paste = () => {
    const w = work();
    if (!w || !clip.current) return;
    if (floating.current) commitFloating();
    beginOp();
    const c = mkCanvas(clip.current.width, clip.current.height);
    c.getContext("2d").drawImage(clip.current, 0, 0);
    const v = cam.current;
    const el = viewRef.current;
    const x = sel.current ? sel.current.x + 8 : Math.round(v.x + el.clientWidth / v.zoom / 2 - c.width / 2);
    const y = sel.current ? sel.current.y + 8 : Math.round(v.y + el.clientHeight / v.zoom / 2 - c.height / 2);
    floating.current = { c, x, y };
    sel.current = { x, y, w: c.width, h: c.height };
    setTool("select");
    rerender();
  };
  const deleteSelection = () => {
    const w = work();
    const s = sel.current;
    if (!w || !s) return;
    if (floating.current) {
      floating.current = null;
      endOp();
      sel.current = null;
      rerender();
      return;
    }
    beginOp();
    w.og.clearRect(s.x, s.y, s.w, s.h);
    w.eg.fillStyle = "#000";
    w.eg.fillRect(s.x, s.y, s.w, s.h);
    markBox(s.x, s.y, s.w, s.h);
    recompose(w, s.x, s.y, s.w, s.h);
    endOp();
    rerender();
  };
  const finishFloating = () => {
    if (floating.current) commitFloating();
  };

  /* ---------- blocos e objetos ---------- */
  const setTile = (c, r, v, changes) => {
    const gw = gridFor(where);
    if (c < 0 || r < 0 || c >= G.cols || r >= G.rows) return;
    const i = r * G.cols + c;
    if (gw.grid[i] === v) return;
    if (!changes.has(i)) changes.set(i, gw.grid[i]);
    gw.grid[i] = v;
  };
  const tileBrush = (x, y, v, changes) => {
    const c0 = Math.floor(x / TILE);
    const r0 = Math.floor(y / TILE);
    const s = size;
    const off = Math.floor((s - 1) / 2);
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) setTile(c0 - off + dx, r0 - off + dy, v, changes);
  };
  const spotAt = (x, y) => {
    const list = spotsFor(where).list;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      const sy = s.y + G.oy;
      if (x >= s.x - s.w / 2 && x <= s.x + s.w / 2 && y >= sy - 40 && y <= sy + 4) return s;
    }
    return null;
  };

  /* ---------- desfazer ---------- */
  const applyEntry = (e, side) => {
    if (e.kind === "art") {
      const w = works.current[e.layer];
      if (!w) return;
      w.og.putImageData(e[side].o, e.x, e.y);
      w.eg.putImageData(e[side].e, e.x, e.y);
      recompose(w, e.x, e.y, e.w, e.h);
      w.dirty = true;
    } else if (e.kind === "solid") {
      const gw = grids.current[e.where];
      e.changes.forEach(([i, b, a]) => (gw.grid[i] = side === "before" ? b : a));
      gw.dirty = true;
    } else if (e.kind === "spot") {
      const sw = spotsWork.current[e.where];
      const s = sw.list.find((q) => q.id === e.id);
      Object.assign(s, e[side]);
      sw.dirty = true;
    } else if (e.kind === "reset") {
      const w = works.current[e.layer];
      w.og.putImageData(e[side].o, 0, 0);
      w.eg.putImageData(e[side].e, 0, 0);
      recompose(w, 0, 0, w.base.width, w.base.height);
      w.dirty = true;
    }
    setDirty(true);
    rerender();
  };
  const undo = () => {
    if (floating.current) {
      cancelOp();
      floating.current = null;
      rerender();
      return;
    }
    const e = hist.current.undo.pop();
    if (!e) return;
    hist.current.redo.push(e);
    applyEntry(e, "before");
  };
  const redo = () => {
    const e = hist.current.redo.pop();
    if (!e) return;
    hist.current.undo.push(e);
    applyEntry(e, "after");
  };

  /* ---------- vista ---------- */
  const toLayer = (e) => {
    const el = viewRef.current;
    const r = el.getBoundingClientRect();
    const v = cam.current;
    return { x: Math.floor((e.clientX - r.left) / v.zoom + v.x), y: Math.floor((e.clientY - r.top) / v.zoom + v.y) };
  };
  const zoomAt = (factor, cx, cy) => {
    const v = cam.current;
    const el = viewRef.current;
    const r = el.getBoundingClientRect();
    const mx = (cx ?? r.left + r.width / 2) - r.left;
    const my = (cy ?? r.top + r.height / 2) - r.top;
    const wx = mx / v.zoom + v.x;
    const wy = my / v.zoom + v.y;
    const nz = Math.min(32, Math.max(0.5, v.zoom * factor));
    cam.current = { zoom: nz, x: wx - mx / nz, y: wy - my / nz };
    rerender();
  };

  // desenha a vista
  const draw = useCallback(() => {
    const el = viewRef.current;
    const w = works.current[layerId];
    if (!el) return;
    const canvas = el.querySelector("canvas");
    const dpr = window.devicePixelRatio || 1;
    const W = el.clientWidth;
    const H = el.clientHeight;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
    }
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#12151d";
    g.fillRect(0, 0, W, H);
    if (!w) return;
    const v = cam.current;
    const z = v.zoom;
    g.setTransform(dpr * z, 0, 0, dpr * z, -v.x * z * dpr, -v.y * z * dpr);
    g.fillStyle = layerId === "house" ? "#24150a" : "#8fd3fa";
    g.fillRect(0, 0, w.base.width, w.base.height);
    g.drawImage(w.comp, 0, 0);
    const f = floating.current;
    if (f) g.drawImage(f.c, f.x, f.y);

    const x0 = Math.max(0, Math.floor(v.x));
    const y0 = Math.max(0, Math.floor(v.y));
    const x1 = Math.min(w.base.width, Math.ceil(v.x + W / z));
    const y1 = Math.min(w.base.height, Math.ceil(v.y + H / z));

    // grade de pixels de pertinho
    if (z >= 10) {
      g.strokeStyle = "rgba(0,0,0,0.14)";
      g.lineWidth = 1 / z;
      g.beginPath();
      for (let x = x0; x <= x1; x++) {
        g.moveTo(x, y0);
        g.lineTo(x, y1);
      }
      for (let y = y0; y <= y1; y++) {
        g.moveTo(x0, y);
        g.lineTo(x1, y);
      }
      g.stroke();
    }
    // blocos
    if (!layer.bg && (mode === "solid" || showBlocks)) {
      const gw = gridFor(where);
      g.fillStyle = mode === "solid" ? "rgba(239, 68, 68, 0.38)" : "rgba(239, 68, 68, 0.22)";
      const c0 = Math.floor(x0 / TILE);
      const c1 = Math.ceil(x1 / TILE);
      const r0 = Math.floor(y0 / TILE);
      const r1 = Math.ceil(y1 / TILE);
      for (let r = r0; r < Math.min(r1, G.rows); r++)
        for (let c = c0; c < Math.min(c1, G.cols); c++) if (gw.grid[r * G.cols + c]) g.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (mode === "solid" && z >= 3) {
        g.strokeStyle = "rgba(255,255,255,0.12)";
        g.lineWidth = 1 / z;
        g.beginPath();
        for (let c = c0; c <= c1; c++) {
          g.moveTo(c * TILE, r0 * TILE);
          g.lineTo(c * TILE, r1 * TILE);
        }
        for (let r = r0; r <= r1; r++) {
          g.moveTo(c0 * TILE, r * TILE);
          g.lineTo(c1 * TILE, r * TILE);
        }
        g.stroke();
      }
    }
    // objetos
    if (!layer.bg && mode === "objects") {
      spotsFor(where).list.forEach((s) => {
        const sy = s.y + G.oy;
        g.fillStyle = "rgba(250, 204, 21, 0.28)";
        g.fillRect(s.x - s.w / 2, sy - 40, s.w, 40);
        g.strokeStyle = "#facc15";
        g.lineWidth = 2 / z;
        g.strokeRect(s.x - s.w / 2, sy - 40, s.w, 40);
        g.fillStyle = "#facc15";
        g.fillRect(s.x - s.w / 2, sy - 1, s.w, 2);
        g.font = `700 ${12 / z}px system-ui, sans-serif`;
        g.textAlign = "center";
        g.fillStyle = "#111827";
        const label = tx(s.label);
        const tw = g.measureText(label).width + 8 / z;
        g.fillStyle = "rgba(17, 24, 39, 0.85)";
        g.fillRect(s.x - tw / 2, sy - 40 - 16 / z, tw, 15 / z);
        g.fillStyle = "#fde68a";
        g.fillText(label, s.x, sy - 40 - 5 / z);
      });
    }
    // seleção
    const s = sel.current;
    if (s && mode === "paint") {
      g.setLineDash([4 / z, 3 / z]);
      g.strokeStyle = "#ffffff";
      g.lineWidth = 1.5 / z;
      g.strokeRect(s.x, s.y, s.w, s.h);
      g.strokeStyle = "#111827";
      g.lineDashOffset = 3.5 / z;
      g.strokeRect(s.x, s.y, s.w, s.h);
      g.setLineDash([]);
      g.lineDashOffset = 0;
    }
    // pincel
    if (hover && mode === "paint" && ["pencil", "eraser", "restore"].includes(tool)) {
      const off = Math.floor((size - 1) / 2);
      g.strokeStyle = tool === "pencil" ? color : "#ffffff";
      g.lineWidth = 1 / z;
      g.strokeRect(hover.x - off, hover.y - off, size, size);
    }
    if (hover && mode === "solid") {
      const off = Math.floor((size - 1) / 2);
      g.strokeStyle = "#ffffff";
      g.lineWidth = 1 / z;
      g.strokeRect((Math.floor(hover.x / TILE) - off) * TILE, (Math.floor(hover.y / TILE) - off) * TILE, size * TILE, size * TILE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerId, mode, tool, color, size, hover, showBlocks, layer.bg, where]);

  // redesenha sempre que algo muda (e quando a janela muda de tamanho)
  useEffect(() => {
    draw();
  });
  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      if (e.shiftKey) {
        cam.current.x += e.deltaY / cam.current.zoom;
        rerender();
      } else zoomAt(Math.exp(-e.deltaY * 0.0018), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  /* ---------- mouse ---------- */
  const onPointerDown = (e) => {
    if (!ready) return;
    const el = viewRef.current;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* sem captura */
    }
    const p = toLayer(e);
    // mover a vista: botão do meio, espaço ou mão
    if (e.button === 1 || spaceDown.current || (mode === "paint" && tool === "hand")) {
      drag.current = { type: "pan", sx: e.clientX, sy: e.clientY, cx: cam.current.x, cy: cam.current.y };
      return;
    }
    if (e.button === 2) return;
    if (mode === "paint") {
      if (tool === "pick") return pickColor(p.x, p.y);
      if (tool === "fill") {
        finishFloating();
        floodFill(p.x, p.y);
        rerender();
        return;
      }
      if (tool === "select") {
        const s = sel.current;
        const inside = s && p.x >= s.x && p.x < s.x + s.w && p.y >= s.y && p.y < s.y + s.h;
        if (inside) {
          if (!floating.current) liftSelection();
          const f = floating.current;
          drag.current = { type: "move", sx: p.x, sy: p.y, fx: f.x, fy: f.y, alt: e.altKey };
        } else {
          finishFloating();
          drag.current = { type: "select", sx: p.x, sy: p.y };
          sel.current = { x: p.x, y: p.y, w: 1, h: 1 };
        }
        rerender();
        return;
      }
      finishFloating();
      beginOp();
      dab(p.x, p.y);
      drag.current = { type: "paint", last: [p.x, p.y] };
      rerender();
    } else if (mode === "solid") {
      const v = tool === "unblock" || e.shiftKey ? 0 : 1;
      const changes = new Map();
      tileBrush(p.x, p.y, v, changes);
      drag.current = { type: "solid", v, changes, last: [p.x, p.y] };
      rerender();
    } else if (mode === "objects") {
      const s = spotAt(p.x, p.y);
      if (s) drag.current = { type: "spot", s, sx: p.x, sy: p.y, ox: s.x, oy: s.y };
    }
  };
  const onPointerMove = (e) => {
    const p = toLayer(e);
    if (!hover || hover.x !== p.x || hover.y !== p.y) setHover(p);
    const d = drag.current;
    if (!d) return;
    if (d.type === "pan") {
      const z = cam.current.zoom;
      cam.current.x = d.cx - (e.clientX - d.sx) / z;
      cam.current.y = d.cy - (e.clientY - d.sy) / z;
      rerender();
    } else if (d.type === "paint") {
      line(d.last, [p.x, p.y], (x, y) => dab(x, y));
      d.last = [p.x, p.y];
      rerender();
    } else if (d.type === "select") {
      sel.current = { x: Math.min(d.sx, p.x), y: Math.min(d.sy, p.y), w: Math.abs(p.x - d.sx) + 1, h: Math.abs(p.y - d.sy) + 1 };
      rerender();
    } else if (d.type === "move") {
      const f = floating.current;
      if (!f) return;
      f.x = d.fx + (p.x - d.sx);
      f.y = d.fy + (p.y - d.sy);
      sel.current = { x: f.x, y: f.y, w: f.c.width, h: f.c.height };
      rerender();
    } else if (d.type === "solid") {
      line([Math.floor(d.last[0] / TILE), Math.floor(d.last[1] / TILE)], [Math.floor(p.x / TILE), Math.floor(p.y / TILE)], (c, r) => tileBrush(c * TILE, r * TILE, d.v, d.changes));
      d.last = [p.x, p.y];
      rerender();
    } else if (d.type === "spot") {
      d.s.x = Math.round(d.ox + (p.x - d.sx));
      d.s.y = Math.round((d.oy + (p.y - d.sy)) / TILE) * TILE;
      rerender();
    }
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.type === "paint") endOp();
    else if (d.type === "select") {
      if (sel.current && sel.current.w <= 1 && sel.current.h <= 1) sel.current = null;
      rerender();
    } else if (d.type === "solid" && d.changes.size) {
      const gw = gridFor(where);
      pushHist({ kind: "solid", where, changes: [...d.changes].map(([i, b]) => [i, b, gw.grid[i]]) });
      gw.dirty = true;
      setDirty(true);
    } else if (d.type === "spot" && (d.s.x !== d.ox || d.s.y !== d.oy)) {
      pushHist({ kind: "spot", where, id: d.s.id, before: { x: d.ox, y: d.oy }, after: { x: d.s.x, y: d.s.y } });
      spotsFor(where).dirty = true;
      setDirty(true);
    }
  };

  /* ---------- restaurar ---------- */
  const resetLayer = async () => {
    if (mode === "paint") {
      const w = work();
      if (!w || !(await ask({ title: tx("Restaurar esta camada?"), message: tx("Tudo o que foi pintado nela volta ao desenho original."), yes: tx("Restaurar") }))) return;
      finishFloating();
      const W = w.base.width;
      const H = w.base.height;
      const before = { o: w.og.getImageData(0, 0, W, H), e: w.eg.getImageData(0, 0, W, H) };
      w.og.clearRect(0, 0, W, H);
      w.eg.clearRect(0, 0, W, H);
      recompose(w, 0, 0, W, H);
      pushHist({ kind: "reset", layer: layerId, before, after: { o: w.og.getImageData(0, 0, W, H), e: w.eg.getImageData(0, 0, W, H) } });
      w.dirty = true;
    } else if (mode === "solid") {
      const gw = gridFor(where);
      const changes = [];
      gw.grid.forEach((v, i) => {
        if (v !== gw.def[i]) changes.push([i, v, gw.def[i]]);
      });
      changes.forEach(([i, , a]) => (gw.grid[i] = a));
      if (changes.length) pushHist({ kind: "solid", where, changes });
      gw.dirty = true;
    } else {
      const sw = spotsFor(where);
      sw.list.forEach((s) => {
        if (s.x !== s.dx || s.y !== s.dy) {
          pushHist({ kind: "spot", where, id: s.id, before: { x: s.x, y: s.y }, after: { x: s.dx, y: s.dy } });
          s.x = s.dx;
          s.y = s.dy;
        }
      });
      sw.dirty = true;
    }
    sfx.play("delete");
    setDirty(true);
    rerender();
  };

  /* ---------- salvar ---------- */
  const save = async () => {
    finishFloating();
    setSaving(true);
    const next = { ...devData };
    for (const w of Object.values(works.current)) {
      if (!w.dirty) continue;
      const key = artKey(w.id, kind);
      if (isEmpty(w.overlay) && isEmpty(w.erase)) {
        await removeDev(key);
        delete next[key];
      } else {
        const rec = { overlay: await canvasToBlob(w.overlay), erase: await canvasToBlob(w.erase) };
        await saveDev(key, rec);
        next[key] = rec;
      }
      w.dirty = false;
    }
    for (const [wh, gw] of Object.entries(grids.current)) {
      if (!gw.dirty) continue;
      const key = solidKey(wh, kind);
      const diff = {};
      gw.grid.forEach((v, i) => {
        if (v !== gw.def[i]) diff[i] = v;
      });
      if (Object.keys(diff).length) {
        await saveDev(key, { diff });
        next[key] = { diff };
      } else {
        await removeDev(key);
        delete next[key];
      }
      gw.dirty = false;
    }
    for (const [wh, sw] of Object.entries(spotsWork.current)) {
      if (!sw.dirty) continue;
      const key = spotsKey(wh, kind);
      const map = {};
      sw.list.forEach((s) => {
        if (s.x !== s.dx || s.y !== s.dy) map[s.id] = { x: s.x, y: s.y };
      });
      if (Object.keys(map).length) {
        await saveDev(key, { map });
        next[key] = { map };
      } else {
        await removeDev(key);
        delete next[key];
      }
      sw.dirty = false;
    }
    onData(next);
    setDirty(false);
    setSaving(false);
    sfx.play("save");
  };
  const close = async () => {
    if (dirty && !(await ask({ title: tx("Sair sem salvar?"), message: tx("As mudanças desta edição serão perdidas."), yes: tx("Sair"), no: tx("Continuar editando") }))) return;
    onClose();
  };

  /* ---------- teclado ---------- */
  const handlers = { undo, redo, copySelection, paste, deleteSelection, close, save, finishFloating, zoomAt };
  const hRef = useRef(handlers);
  hRef.current = handlers;
  useEffect(() => {
    const onKey = (e) => {
      const h = hRef.current;
      const k = (e.key || "").toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      if (k === " ") {
        spaceDown.current = true;
        e.preventDefault();
        return;
      }
      if (ctrl && k === "z") {
        e.preventDefault();
        if (e.shiftKey) h.redo();
        else h.undo();
      } else if (ctrl && k === "y") {
        e.preventDefault();
        h.redo();
      } else if (ctrl && k === "s") {
        e.preventDefault();
        h.save();
      } else if (ctrl && k === "c") h.copySelection();
      else if (ctrl && k === "v") h.paste();
      else if (k === "delete" || k === "backspace") h.deleteSelection();
      else if (k === "enter") h.finishFloating();
      else if (k === "escape") {
        if (floating.current || sel.current) {
          h.finishFloating();
          sel.current = null;
          rerender();
        } else h.close();
      } else if (k === "+" || k === "=") h.zoomAt(1.25);
      else if (k === "-") h.zoomAt(0.8);
      else if (k === "[") setSize((s) => Math.max(1, s / 2));
      else if (k === "]") setSize((s) => Math.min(16, s * 2));
      else if (!ctrl) {
        const t = TOOLS.find((q) => q.key.toLowerCase() === k);
        if (t) {
          setMode("paint");
          if (t.id !== "select") h.finishFloating();
          setTool(t.id);
        }
      }
      rerender();
    };
    onKey.up = (e) => {
      if (e.key === " ") spaceDown.current = false;
    };
    keyHandler = onKey;
    return () => {
      if (keyHandler === onKey) keyHandler = null;
    };
  }, []);

  const availableLayers = useMemo(() => LAYERS.filter((l) => layerBase(l.id)), [bases]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pwd-editor" onContextMenu={(e) => e.preventDefault()}>
      <header className="pwd-top">
        <strong>🛠️ {tx("Modo desenvolvedor")}</strong>
        <span className="pwd-scene">
          {tx(SCENES[kind].name)} · {tx(SEASON_NAMES[season] || season)}
        </span>
        <div className="pwd-modes">
          {[
            ["paint", "🎨", "Texturas"],
            ["solid", "🧱", "Blocos"],
            ["objects", "📦", "Objetos"]
          ].map(([id, icon, name]) => (
            <button
              key={id}
              type="button"
              className={mode === id ? "on" : ""}
              disabled={layer.bg && id !== "paint"}
              onClick={() => {
                finishFloating();
                setMode(id);
                if (id === "solid") setTool("block");
                else if (id === "paint" && !TOOLS.some((t) => t.id === tool)) setTool("pencil");
              }}
            >
              {icon} {tx(name)}
            </button>
          ))}
        </div>
        <span className="pwd-spacer" />
        <button type="button" className="pwd-btn" onClick={undo} title={tx("Desfazer (Ctrl+Z)")}>
          ↶
        </button>
        <button type="button" className="pwd-btn" onClick={redo} title={tx("Refazer (Ctrl+Y)")}>
          ↷
        </button>
        <button type="button" className="pwd-btn primary" disabled={!dirty || saving} onClick={save}>
          {saving ? tx("Salvando…") : tx("Salvar")}
        </button>
        <button type="button" className="pwd-btn" onClick={close} title={tx("Fechar (Esc)")}>
          ✕
        </button>
      </header>

      <div className="pwd-body">
        <aside className="pwd-side">
          <section>
            <h4>{tx("Camada")}</h4>
            <div className="pwd-list">
              {availableLayers.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={layerId === l.id ? "on" : ""}
                  onClick={() => {
                    finishFloating();
                    setLayerId(l.id);
                  }}
                >
                  {tx(l.name)}
                </button>
              ))}
            </div>
          </section>

          {mode === "paint" && (
            <>
              <section>
                <h4>{tx("Ferramentas")}</h4>
                <div className="pwd-tools">
                  {TOOLS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={tool === t.id ? "on" : ""}
                      title={`${tx(t.name)} (${t.key})`}
                      onClick={() => {
                        if (t.id !== "select") finishFloating();
                        setTool(t.id);
                      }}
                    >
                      <span>{t.icon}</span>
                      {tx(t.name)}
                    </button>
                  ))}
                </div>
                <div className="pwd-sizes">
                  {[1, 2, 4, 8, 16].map((s) => (
                    <button key={s} type="button" className={size === s ? "on" : ""} onClick={() => setSize(s)}>
                      {s}px
                    </button>
                  ))}
                </div>
                {tool === "select" && (
                  <p className="pwd-tip">
                    {tx("Arraste para selecionar; arraste a seleção para mover. Ctrl+C / Ctrl+V copiam e colam blocos de pixels; Delete apaga; Enter solta.")}
                  </p>
                )}
                {tool === "restore" && <p className="pwd-tip">{tx("Pinta de volta o desenho original por baixo.")}</p>}
              </section>
              <section>
                <h4>{tx("Cor")}</h4>
                <div className="pwd-current">
                  <span style={{ background: color }} />
                  <label className="pwd-custom">
                    {tx("Outra cor")}
                    <input type="color" value={color} onChange={(e) => pickSwatch(e.target.value)} />
                  </label>
                </div>
                <div className="pwd-palette">
                  {PALETTE.map((c) => (
                    <button key={c} type="button" className={color === c ? "on" : ""} style={{ background: c }} title={c} onClick={() => pickSwatch(c)} />
                  ))}
                </div>
                {recent.length > 0 && (
                  <div className="pwd-palette recent">
                    {recent.map((c) => (
                      <button key={c} type="button" style={{ background: c }} title={c} onClick={() => setColor(c)} />
                    ))}
                  </div>
                )}
              </section>
              {!layer.bg && (
                <label className="pwd-check">
                  <input type="checkbox" checked={showBlocks} onChange={(e) => setShowBlocks(e.target.checked)} />
                  {tx("Mostrar os blocos por cima")}
                </label>
              )}
            </>
          )}

          {mode === "solid" && (
            <section>
              <h4>{tx("Blocos")}</h4>
              <p className="pwd-tip">{tx("Vermelho = chão/parede: o personagem pisa e bate. Cada bloco tem 4×4 pixels. Shift apaga.")}</p>
              <div className="pwd-tools">
                <button type="button" className={tool === "block" ? "on" : ""} onClick={() => setTool("block")}>
                  <span>🧱</span>
                  {tx("Colocar bloco")}
                </button>
                <button type="button" className={tool === "unblock" ? "on" : ""} onClick={() => setTool("unblock")}>
                  <span>🧽</span>
                  {tx("Tirar bloco")}
                </button>
              </div>
              <div className="pwd-sizes">
                {[1, 2, 4, 8].map((s) => (
                  <button key={s} type="button" className={size === s ? "on" : ""} onClick={() => setSize(s)}>
                    {s}×{s}
                  </button>
                ))}
              </div>
            </section>
          )}

          {mode === "objects" && (
            <section>
              <h4>{tx("Objetos")}</h4>
              <p className="pwd-tip">{tx("Arraste as caixas amarelas para mudar onde fica cada coisa (a linha de baixo é o chão onde o personagem para). Lembre de pintar o desenho no lugar novo.")}</p>
              <ul className="pwd-objs">
                {spotsFor(where).list.map((s) => (
                  <li key={s.id}>
                    {tx(s.label)}
                    <small>
                      {Math.round(s.x)}, {Math.round(s.y)}
                    </small>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <button type="button" className="pwd-reset" onClick={resetLayer}>
            ↺ {mode === "paint" ? tx("Restaurar a camada inteira") : mode === "solid" ? tx("Restaurar os blocos") : tx("Restaurar as posições")}
          </button>
          <p className="pwd-keys">
            {tx("Roda: zoom · Espaço ou botão do meio + arrastar: mover a vista · Ctrl+Z / Ctrl+Y · Ctrl+S salva")}
          </p>
        </aside>

        <main
          ref={viewRef}
          className={`pwd-view tool-${mode === "paint" ? tool : mode}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => setHover(null)}
        >
          <canvas />
          {!ready && <div className="pwd-loading">{tx("Carregando…")}</div>}
          {hover && (
            <div className="pwd-coords">
              {hover.x}, {hover.y - G.oy} · {Math.round(cam.current.zoom * 100)}%
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
