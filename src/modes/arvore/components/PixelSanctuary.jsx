/* =========================================================
   SANTUÁRIO EM PIXEL ART
   O mundo inteiro em 2D, no mesmo pixel dos personagens.
   A Árvore gigante é a casa do herói: pela porta do tronco ele
   entra, sobe a escada, sai na varanda e usa o baú (Personagem),
   o relógio (Pomodoro), a estante (Notas) e a cama (dia ↔ noite).
   - O chão é feito de blocos de 4 pixels (dá para editar no
     modo desenvolvedor, junto com as texturas e os objetos).
   - Zoom: roda do mouse, pinça ou + e −.
   - Celular/tablet: botões na tela ou joystick (liga no 🕹️).
   A D / ← →  andar · Espaço pular · E interagir · ↑ porta/escada
========================================================= */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HeroModel } from "../../../atualizacao2_0/Hero.jsx";
import { DEFAULT_HERO, normalizeHero } from "../../../atualizacao2_0/HeroModels.js";
import { readProfileValue } from "../../../atualizacao2_0/ProfileStorage.js";
import { getActiveProfileId } from "../../../shared/activeProfile.js";
import { IS_TOUCH } from "../../../shared/touch.js";
import { tx, useLanguage } from "../../../i18n/index.jsx";
import { sfx } from "../lib/sound";
import { ask } from "../../../shared/Dialog.jsx";
import { imageToCanvas, loadSkinImage, sceneSkinPath } from "../../../shared/skins.js";
import { SEASONS, seasonOf, setSanctuary } from "./Sanctuary.jsx";
import TouchPad from "./TouchPad.jsx";
import PixelSceneEditor from "./PixelSceneEditor.jsx";
import { artKey, blobToCanvas, loadDevData, solidKey, spotsKey } from "./sanctuaryDevStore.js";
import { CROPS, STAGES, harvest, loadGarden, plant, progressOf, saveGarden, stageOf, tickGarden, uproot, water, waterAll, waterOf } from "../lib/garden.js";
import {
  BOT,
  FAR,
  GRID_IN,
  GRID_OUT,
  GROUND,
  IN_BOUNDS,
  IN_W,
  MID,
  OUT_W,
  PAD,
  PAL,
  SCENES,
  SCENE_IDS,
  SPOTS,
  TILE,
  TX,
  VH,
  buildFar,
  buildInterior,
  buildMid,
  buildWorld,
  composeLayer,
  defaultSolid,
  drawClouds,
  drawGardenPlants,
  drawNight,
  drawPendulum,
  drawRoomWindow,
  drawSky,
  drawWaves,
  px,
  rect
} from "./pixelWorld.js";
import "./PixelSanctuary.css";

// física em pixels de arte por segundo
const MAX_SPEED = 84;
const ACCEL = 640;
const DECEL = 820;
const AIR_CONTROL = 0.6;
const JUMP_SPEED = 232;
const GRAVITY = 720;
const FALL_MULT = 1.5;
const CUT_JUMP = 0.45;
const COYOTE = 0.1;
const BUFFER = 0.12;
const CLIMB_TIME = 0.85;
// caixa do herói (para bater nos blocos)
const HALF = 7;
const HEIGHT = 36;
const VB = VH + BOT;

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 3;
const ZOOM_KEY = "pw-zoom";
const JOY_KEY = "pw-joystick";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
const isTyping = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
const modalOpen = () => document.querySelector(".modal-backdrop, .ui-dialog-backdrop, .pwd-editor, .pw-garden");
const readLS = (k, fb) => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? fb : v;
  } catch {
    return fb;
  }
};
const writeLS = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* sem armazenamento */
  }
};

export const SKY_MODES = [
  { id: "auto", label: "Pelo relógio" },
  { id: "dia", label: "Dia" },
  { id: "noite", label: "Noite" }
];
const autoNight = () => {
  const h = new Date().getHours();
  return h >= 19 || h < 6;
};
export const isNightNow = (mode) => (mode === "noite" ? true : mode === "dia" ? false : autoNight());

const readHero = () => normalizeHero(readProfileValue("rpg_hero_v1", getActiveProfileId(), DEFAULT_HERO));

// blocos padrão + o que foi mudado no modo desenvolvedor
export function solidGrid(where, kind, rec) {
  const grid = defaultSolid(where, kind);
  if (rec && rec.diff) Object.entries(rec.diff).forEach(([i, v]) => (grid[+i] = v ? 1 : 0));
  return grid;
}
// objetos (porta, baú...) com as posições mudadas no modo desenvolvedor
export function spotsFor(kind, data) {
  return SPOTS.map((s) => {
    const rec = data[spotsKey(s.where, kind)];
    const o = rec && rec.map && rec.map[s.id];
    return o ? { ...s, x: o.x, y: o.y } : s;
  });
}

export default function PixelSanctuary({ prefs }) {
  useLanguage();
  const kind = SCENES[prefs.scene] ? prefs.scene : "campo";
  const season = seasonOf(prefs.season);
  const night = isNightNow(prefs.night);

  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const heroRef = useRef(null);
  const promptRef = useRef(null);
  const view = useRef({ s: 3, cw: 400, ch: VH, cam: 0, top: 0 });
  const keys = useRef(new Set());
  const parts = useRef([]);
  const spotRef = useRef(null);
  const nightRef = useRef(night);
  nightRef.current = night;
  const zoomRef = useRef(clamp(parseFloat(readLS(ZOOM_KEY, "1")) || 1, ZOOM_MIN, ZOOM_MAX));
  const fitRef = useRef(() => {});

  const [hero, setHero] = useState(readHero);
  const [where, setWhere] = useState("out");
  const [pose, setPose] = useState("idle");
  const [facing, setFacing] = useState(1);
  const [spot, setSpot] = useState(null);
  const [fade, setFade] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const [panel, setPanel] = useState(false);
  const [editor, setEditor] = useState(false);
  const [zoomBadge, setZoomBadge] = useState(null);
  const [joy, setJoy] = useState(() => IS_TOUCH && readLS(JOY_KEY, "0") === "1");
  const [devData, setDevData] = useState({});
  const [layers, setLayers] = useState(null);
  // canteiro
  const [garden, setGardenState] = useState(() => tickGarden(loadGarden()));
  const [gardenOpen, setGardenOpen] = useState(false);
  const gardenRef = useRef(garden);
  gardenRef.current = garden;
  const updateGarden = useCallback((fn) => {
    setGardenState((g) => {
      const next = fn(tickGarden(g));
      saveGarden(next);
      return next;
    });
  }, []);
  // o tempo passa: atualiza o crescimento a cada segundo
  useEffect(() => {
    const id = setInterval(() => setGardenState((g) => tickGarden(g)), 1000);
    const save = () => saveGarden(tickGarden(gardenRef.current));
    window.addEventListener("beforeunload", save);
    return () => {
      clearInterval(id);
      window.removeEventListener("beforeunload", save);
      save();
    };
  }, []);

  const st = useRef(null);
  if (!st.current) {
    st.current = { where: "out", x: TX + 112, y: GROUND, vx: 0, vy: 0, air: false, coyote: 0, buffer: 0, climb: null, busy: false, face: 1, pose: "idle", analog: 0 };
  }

  /* ---------- desenhos ---------- */
  // base (desenhada pelo código), refeita só quando muda o cenário ou a estação
  const bases = useMemo(() => {
    const world = buildWorld(kind, season);
    const house = buildInterior(season);
    return { far: buildFar(kind, season), mid: buildMid(kind, season), world: world.c, worldLights: world.lights, house: house.c, houseLights: house.lights, win: house.win };
  }, [kind, season]);

  // skins da pasta public/skins/cenario substituem o desenho do código
  const [skinBases, setSkinBases] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const pick = async (layer, base) => {
        if (!base) return base;
        const img = await loadSkinImage(sceneSkinPath(kind, layer));
        return img ? imageToCanvas(img, base.width, base.height) : base;
      };
      const [far, mid, world, house] = await Promise.all([pick("far", bases.far), pick("mid", bases.mid), pick("world", bases.world), pick("house", bases.house)]);
      if (alive) setSkinBases({ ...bases, far, mid, world, house });
    })();
    return () => {
      alive = false;
    };
  }, [bases, kind]);

  // edições do modo desenvolvedor
  useEffect(() => {
    let alive = true;
    loadDevData().then((d) => alive && setDevData(d));
    return () => {
      alive = false;
    };
  }, []);

  // base (código ou skin) + edições = o que aparece no jogo
  useEffect(() => {
    if (!skinBases) return undefined;
    const bases = skinBases;
    let alive = true;
    (async () => {
      const apply = async (layer, base) => {
        if (!base) return base;
        const rec = devData[artKey(layer, kind)];
        if (!rec) return base;
        const overlay = await blobToCanvas(rec.overlay, base.width, base.height);
        const erase = await blobToCanvas(rec.erase, base.width, base.height);
        return composeLayer(base, { overlay, erase });
      };
      const [far, mid, world, house] = await Promise.all([apply("far", bases.far), apply("mid", bases.mid), apply("world", bases.world), apply("house", bases.house)]);
      if (alive) setLayers({ far, mid, world, house, worldLights: bases.worldLights, houseLights: bases.houseLights, win: bases.win });
    })();
    return () => {
      alive = false;
    };
  }, [skinBases, devData, kind]);

  const grids = useMemo(() => ({ out: solidGrid("out", kind, devData[solidKey("out", kind)]), in: solidGrid("in", kind, devData[solidKey("in", kind)]) }), [kind, devData]);
  const spots = useMemo(() => spotsFor(kind, devData), [kind, devData]);

  const artRef = useRef({});
  artRef.current = { layers, kind, season, grids, spots };
  // personagem atualizado quando muda no menu
  useEffect(() => {
    const onHero = (e) => setHero(normalizeHero(e.detail || readHero()));
    window.addEventListener("orbe-hero-changed", onHero);
    return () => window.removeEventListener("orbe-hero-changed", onHero);
  }, []);

  // mudou de cenário: o herói volta para a porta de casa
  const firstKind = useRef(true);
  useEffect(() => {
    if (firstKind.current) {
      firstKind.current = false;
      return;
    }
    const p = st.current;
    if (p.where === "out") {
      const door = artRef.current.spots.find((s) => s.id === "door");
      p.x = door.x + 40;
      p.y = door.y;
      p.vy = 0;
      view.current.snap = true;
    }
  }, [kind]);

  /* ---------- tamanho da tela e zoom ---------- */
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return undefined;
    const fit = () => {
      const r = wrap.getBoundingClientRect();
      if (!r.width || !r.height) return;
      // tela em pé (celular): mostra pelo menos ~300 pixels de largura
      const base = Math.max(1, Math.min(r.height / VH, r.width / 300));
      const s = base * zoomRef.current;
      const cw = Math.ceil(r.width / s);
      const ch = Math.ceil(r.height / s);
      view.current.s = s;
      view.current.cw = cw;
      view.current.ch = ch;
      view.current.snap = true;
      canvas.width = cw;
      canvas.height = ch;
      canvas.style.width = `${cw * s}px`;
      canvas.style.height = `${ch * s}px`;
      wrap.style.setProperty("--pw-s", String(s));
    };
    fitRef.current = fit;
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  const badgeTimer = useRef(0);
  const setZoom = useCallback((z) => {
    const next = clamp(z, ZOOM_MIN, ZOOM_MAX);
    if (Math.abs(next - zoomRef.current) < 0.001) return;
    zoomRef.current = next;
    writeLS(ZOOM_KEY, String(next.toFixed(2)));
    fitRef.current();
    setZoomBadge(Math.round(next * 100));
    clearTimeout(badgeTimer.current);
    badgeTimer.current = setTimeout(() => setZoomBadge(null), 900);
  }, []);

  // roda do mouse e pinça
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const onWheel = (e) => {
      if (e.target.closest && e.target.closest(".pw-panel")) return;
      e.preventDefault();
      setZoom(zoomRef.current * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
    };
    const touches = new Map();
    let pinch = null;
    const onDown = (e) => {
      if (e.pointerType !== "touch") return;
      if (e.target.closest && e.target.closest(".pw-joy, .sanc-pad, .pw-panel, button")) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: zoomRef.current };
      }
    };
    const onMove = (e) => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && touches.size === 2) {
        const [a, b] = [...touches.values()];
        setZoom((pinch.z * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d);
      }
    };
    const onUp = (e) => {
      touches.delete(e.pointerId);
      if (touches.size < 2) pinch = null;
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    wrap.addEventListener("pointerdown", onDown);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerup", onUp);
    wrap.addEventListener("pointercancel", onUp);
    return () => {
      wrap.removeEventListener("wheel", onWheel);
      wrap.removeEventListener("pointerdown", onDown);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerup", onUp);
      wrap.removeEventListener("pointercancel", onUp);
    };
  }, [setZoom]);

  // joystick: limpa os botões de baixo
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("pw-joy-on", joy);
    return () => html.classList.remove("pw-joy-on");
  }, [joy]);

  /* ---------- ações ---------- */
  const transition = useCallback((fn) => {
    const p = st.current;
    p.busy = true;
    setFade(true);
    setTimeout(() => {
      fn(p, artRef.current.spots);
      p.vx = 0;
      p.vy = 0;
      p.air = false;
      setWhere(p.where);
      view.current.snap = true;
      setFade(false);
      setTimeout(() => {
        p.busy = false;
      }, 120);
    }, 260);
  }, []);

  const act = useCallback(
    (s) => {
      const p = st.current;
      if (!s || p.busy || p.climb) return;
      const find = (list, id) => list.find((q) => q.id === id);
      switch (s.act) {
        case "enter":
          sfx.play("open");
          transition((q, list) => {
            const t = find(list, "exit");
            q.where = "in";
            q.x = t.x + 32;
            q.y = t.y;
            q.face = 1;
          });
          break;
        case "exit":
          sfx.play("close");
          transition((q, list) => {
            const t = find(list, "door");
            q.where = "out";
            q.x = t.x;
            q.y = t.y;
            q.face = 1;
          });
          break;
        case "deckOut":
          sfx.play("open");
          transition((q, list) => {
            const t = find(list, "deckdoor");
            q.where = "out";
            q.x = t.x + 16;
            q.y = t.y;
            q.face = 1;
          });
          break;
        case "deckIn":
          sfx.play("close");
          transition((q, list) => {
            const t = find(list, "deck");
            q.where = "in";
            q.x = t.x - 10;
            q.y = t.y;
            q.face = -1;
          });
          break;
        case "up":
        case "down": {
          sfx.play("branch");
          const other = find(artRef.current.spots, s.act === "up" ? "down" : "up");
          p.x = s.x;
          p.vx = 0;
          p.vy = 0;
          p.climb = { y0: p.y, y1: other.y, t: 0 };
          break;
        }
        case "garden":
          sfx.play("rustle");
          keys.current.clear();
          p.analog = 0;
          setGardenOpen(true);
          break;
        case "hero":
          sfx.play("open");
          window.dispatchEvent(new Event("orbe-open-hero-menu"));
          break;
        case "notes":
          sfx.play("folder");
          window.dispatchEvent(new Event("orbe-open-notes"));
          break;
        case "pomodoro":
          sfx.play("tick");
          window.dispatchEvent(new Event("orbe-open-pomodoro"));
          break;
        case "sleep": {
          p.busy = true;
          sfx.play("hold");
          setSleeping(true);
          setTimeout(() => {
            setSanctuary({ night: nightRef.current ? "dia" : "noite" });
          }, 900);
          setTimeout(() => {
            setSleeping(false);
            p.busy = false;
          }, 2000);
          break;
        }
        default:
      }
    },
    [transition]
  );
  const actRef = useRef(act);
  actRef.current = act;
  const UPISH = ["up", "enter", "exit", "deckIn", "deckOut", "garden"];
  const jump = () => {
    st.current.buffer = BUFFER;
  };
  const upAction = () => {
    const s = spotRef.current;
    if (s && UPISH.includes(s.act)) actRef.current(s);
    else jump();
  };
  const downAction = () => {
    const s = spotRef.current;
    if (s && s.act === "down") actRef.current(s);
  };

  /* ---------- teclado ---------- */
  useEffect(() => {
    const blocked = (e) => e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || isTyping(document.activeElement) || modalOpen();
    const onDown = (e) => {
      if (blocked(e)) return;
      const raw = (e.key || "").toLowerCase();
      const s = spotRef.current;
      if (raw === "e") {
        // perto de algo: interage; longe de tudo, o E segue abrindo as notas
        if (!s) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat) actRef.current(s);
        return;
      }
      if (raw === "w" || raw === "arrowup") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat) upAction();
        return;
      }
      if (raw === "s" || raw === "arrowdown") {
        if (s && s.act === "down") {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (!e.repeat) downAction();
        }
        return;
      }
      if (raw === "+" || raw === "=" || raw === "-" || raw === "0") {
        e.preventDefault();
        e.stopImmediatePropagation();
        setZoom(raw === "0" ? 1 : zoomRef.current * (raw === "-" ? 1 / 1.2 : 1.2));
        return;
      }
      const k = { a: "a", d: "d", arrowleft: "a", arrowright: "d" }[raw];
      if (k) {
        e.preventDefault();
        e.stopImmediatePropagation();
        keys.current.add(k);
        return;
      }
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat) jump();
      }
    };
    const onUp = (e) => {
      const raw = (e.key || "").toLowerCase();
      const k = { a: "a", d: "d", arrowleft: "a", arrowright: "d" }[raw];
      if (k) keys.current.delete(k);
      if ((e.key === " " || e.code === "Space" || raw === "w" || raw === "arrowup") && st.current.vy < 0) st.current.vy *= CUT_JUMP;
    };
    const clear = () => keys.current.clear();
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", onDown, true);
      window.removeEventListener("keyup", onUp, true);
      window.removeEventListener("blur", clear);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setZoom]);

  // janela de cenário (L ou o botão de layout)
  useEffect(() => {
    const toggle = () => {
      if (document.querySelector(".pwd-editor")) return;
      setPanel((v) => !v);
    };
    window.addEventListener("orbe-sanctuary-layout", toggle);
    return () => window.removeEventListener("orbe-sanctuary-layout", toggle);
  }, []);
  useEffect(() => {
    if (!panel || editor) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape" || modalOpen()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setPanel(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [panel, editor]);

  /* ---------- laço do jogo ---------- */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const gridOf = (p) => (p.where === "out" ? [artRef.current.grids.out, GRID_OUT] : [artRef.current.grids.in, GRID_IN]);
    const boxHits = (p, x, y) => {
      const [grid, G] = gridOf(p);
      const c0 = Math.floor((x - HALF) / TILE);
      const c1 = Math.floor((x + HALF - 0.001) / TILE);
      const r0 = Math.floor((y - HEIGHT + G.oy) / TILE);
      const r1 = Math.floor((y - 0.001 + G.oy) / TILE);
      for (let r = r0; r <= r1; r++) {
        if (r < 0) continue;
        if (r >= G.rows) return true;
        for (let c = c0; c <= c1; c++) {
          if (c < 0 || c >= G.cols) return true;
          if (grid[r * G.cols + c]) return true;
        }
      }
      return false;
    };
    const boundsOf = (p) => (p.where === "out" ? SCENES[artRef.current.kind].bounds : IN_BOUNDS);

    const update = (dt) => {
      const p = st.current;
      if (modalOpen()) keys.current.clear();
      if (p.climb) {
        p.climb.t += dt / CLIMB_TIME;
        const k = Math.min(1, p.climb.t);
        p.y = p.climb.y0 + (p.climb.y1 - p.climb.y0) * k;
        if (k >= 1) {
          p.y = p.climb.y1;
          p.climb = null;
        }
        return;
      }
      const G = gridOf(p)[1];
      // ficou preso dentro de blocos (editados por cima dele): sobe até sair
      if (boxHits(p, p.x, p.y)) {
        let up = 0;
        while (up < 96 && boxHits(p, p.x, p.y - up)) up += 1;
        p.y -= up;
        p.vy = 0;
      }
      let dir =p.busy ? 0 : (keys.current.has("d") ? 1 : 0) - (keys.current.has("a") ? 1 : 0);
      let speed = MAX_SPEED;
      if (!dir && !p.busy && p.analog) {
        dir = Math.sign(p.analog);
        speed = MAX_SPEED * Math.min(1, Math.abs(p.analog));
      }
      const ctl = p.air ? AIR_CONTROL : 1;
      p.vx = dir ? approach(p.vx, dir * speed, ACCEL * ctl * dt) : approach(p.vx, 0, DECEL * ctl * dt);
      if (dir) p.face = dir;

      // anda para os lados (sobe degraus de 1 bloco)
      const dx = p.vx * dt;
      const nx = Math.max(1, Math.ceil(Math.abs(dx)));
      for (let i = 0; i < nx; i++) {
        const tx = p.x + dx / nx;
        if (!boxHits(p, tx, p.y)) p.x = tx;
        else if (!p.air && !boxHits(p, tx, p.y - TILE)) {
          p.x = tx;
          p.y -= TILE;
        } else {
          p.vx = 0;
          break;
        }
      }
      const [a, b] = boundsOf(p);
      if (p.x < a || p.x > b) {
        p.x = clamp(p.x, a, b);
        p.vx = 0;
      }

      // pulo e gravidade
      const grounded = boxHits(p, p.x, p.y + 0.5);
      p.buffer -= dt;
      p.coyote = grounded ? COYOTE : p.coyote - dt;
      if (!p.busy && p.buffer > 0 && p.coyote > 0) {
        p.vy = -JUMP_SPEED;
        p.coyote = 0;
        p.buffer = 0;
      }
      if (!grounded || p.vy < 0) {
        p.vy += GRAVITY * (p.vy > 0 ? FALL_MULT : 1) * dt;
        const dy = p.vy * dt;
        const ny = Math.max(1, Math.ceil(Math.abs(dy)));
        for (let i = 0; i < ny; i++) {
          const ty = p.y + dy / ny;
          if (boxHits(p, p.x, ty)) {
            if (dy > 0) p.y = Math.floor((ty + G.oy) / TILE) * TILE - G.oy;
            p.vy = 0;
            break;
          }
          p.y = ty;
        }
      } else p.vy = 0;
      p.air = !boxHits(p, p.x, p.y + 0.5);
      // caiu do mundo: volta para a porta
      if (p.y > VB + 60) {
        const door = artRef.current.spots.find((s) => s.id === (p.where === "out" ? "door" : "exit"));
        p.x = door.x + 30;
        p.y = door.y;
        p.vy = 0;
      }
    };

    const particles = (dt, t, cam, cw) => {
      const list = parts.current;
      const { kind: k, season: se } = artRef.current;
      const p = st.current;
      const isNight = nightRef.current;
      const out = p.where === "out";
      if (out && list.length < 60) {
        if (se === "inverno" && Math.random() < dt * 30) list.push({ type: "snow", x: cam + Math.random() * cw, y: -4 - Math.random() * PAD, vx: -4 + Math.random() * 8, vy: 14 + Math.random() * 12, ph: Math.random() * 6 });
        if ((se === "outono" || se === "primavera") && Math.random() < dt * 3) {
          list.push({ type: se === "outono" ? "leaf" : "petal", x: TX - 420 + Math.random() * 840, y: 30 + Math.random() * 50, vx: -6 + Math.random() * 4, vy: 10 + Math.random() * 8, ph: Math.random() * 6, c: Math.random() < 0.5 ? 2 : 3 });
        }
        if (isNight && se !== "inverno" && list.filter((q) => q.type === "fly").length < 14 && Math.random() < dt * 4) {
          list.push({ type: "fly", x: cam + Math.random() * cw, y: 120 + Math.random() * 70, vx: 0, vy: 0, ph: Math.random() * 6, life: 8 + Math.random() * 6 });
        }
      }
      if (!out && list.length < 14 && Math.random() < dt * 1.2) {
        list.push({ type: "dust", x: 40 + Math.random() * (IN_W - 80), y: 40 + Math.random() * 160, vx: 2 - Math.random() * 4, vy: -1 - Math.random() * 2, ph: Math.random() * 6, life: 5 + Math.random() * 4 });
      }
      for (let i = list.length - 1; i >= 0; i--) {
        const q = list[i];
        q.ph += dt;
        if (q.type === "fly") {
          q.x += Math.sin(q.ph * 1.3) * 10 * dt;
          q.y += Math.cos(q.ph * 0.9) * 7 * dt;
        } else if (q.type === "dust") {
          q.x += q.vx * dt;
          q.y += q.vy * dt;
        } else {
          q.x += (q.vx + Math.sin(q.ph * 2) * 10) * dt;
          q.y += q.vy * dt;
        }
        if (q.life !== undefined) q.life -= dt;
        const dead = q.life !== undefined ? q.life <= 0 : q.y > (k === "ilha" ? VB : GROUND + 3);
        if (dead || (out && q.type === "dust") || (!out && q.type !== "dust")) list.splice(i, 1);
      }
      return list;
    };

    const drawParts = (g, list, ox, t, afterNight) => {
      const P = PAL[artRef.current.season];
      list.forEach((q) => {
        const x = Math.round(q.x + ox);
        const y = Math.round(q.y);
        if (q.type === "fly") {
          if (!afterNight) return;
          if (Math.sin(t * 3 + q.ph * 4) > -0.2) {
            px(g, x, y, "#fff59d");
            px(g, x + 1, y, "#fde047");
          }
          return;
        }
        if (afterNight) return;
        if (q.type === "snow") px(g, x, y, "#ffffff");
        else if (q.type === "dust") px(g, x, y, "rgba(255, 236, 180, 0.7)");
        else if (q.type === "petal") {
          px(g, x, y, P.bloom || "#f9a8d4");
          px(g, x + 1, y, "#fbcfe8");
        } else {
          px(g, x, y, P.leaf[q.c]);
          px(g, x + (Math.sin(q.ph * 3) > 0 ? 1 : -1), y, P.leaf[q.c]);
        }
      });
    };

    const render = (t) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const g = canvas.getContext("2d");
      g.imageSmoothingEnabled = false;
      const v = view.current;
      const { cw, ch } = v;
      const p = st.current;
      const out = p.where === "out";
      const worldW = out ? OUT_W : IN_W;
      // câmera: o herói perto do meio, sem passar das bordas
      const target = worldW <= cw ? (worldW - cw) / 2 : clamp(p.x - cw / 2, 0, worldW - cw);
      // de pertinho (zoom) a câmera também sobe e desce com o herói
      const topTarget = ch >= VH ? Math.round((ch - VH) * 0.62) : clamp(Math.round(ch * 0.62 - p.y), ch - VB, PAD);
      if (v.snap) {
        v.cam = target;
        v.top = topTarget;
        v.snap = false;
      } else {
        v.cam += (target - v.cam) * 0.14;
        v.top += (topTarget - v.top) * 0.14;
      }
      const cam = Math.round(v.cam);
      const top = Math.round(v.top);
      const ox = -cam;
      const isNight = nightRef.current;
      const L = artRef.current.layers;
      const list = particles(1 / 60, t, cam, cw);

      if (out) {
        drawSky(g, cw, isNight, t, VH + top);
        rect(g, 0, VH + top, cw, ch, "#5e3a1d");
      } else rect(g, 0, 0, cw, ch, "#24150a");
      g.save();
      g.translate(0, top);
      if (L && out) {
        drawClouds(g, cw, cam, isNight, t);
        if (L.far) g.drawImage(L.far, Math.round(-900 - cam * FAR), -PAD);
        if (L.mid) g.drawImage(L.mid, Math.round(-900 - cam * MID), -PAD);
        g.drawImage(L.world, ox, -PAD);
        if (artRef.current.kind === "praia") drawWaves(g, ox, t);
        const now = Date.now();
        drawGardenPlants(
          g,
          ox,
          gardenRef.current.beds.map((b) => (b ? { crop: b.crop, stage: stageOf(b), wet: waterOf(b, now) > 0 } : null)),
          t
        );
        drawParts(g, list, ox, t, false);
        if (isNight) drawNight(g, cw, L.worldLights, ox, false, top);
      } else if (L) {
        g.drawImage(L.house, ox, 0);
        drawRoomWindow(g, L.win, ox, isNight, t);
        drawPendulum(g, ox, t);
        drawParts(g, list, ox, t, false);
        if (isNight) drawNight(g, cw, L.houseLights, ox, true, top);
      }
      drawParts(g, list, ox, t, true);
      g.restore();

      // herói (HTML por cima)
      const heroEl = heroRef.current;
      if (heroEl) {
        heroEl.style.transform = `translate(${((Math.round(p.x) + ox) * v.s).toFixed(1)}px, ${((Math.round(p.y) + top) * v.s).toFixed(1)}px)`;
        const sp = Math.min(1, Math.abs(p.vx) / MAX_SPEED);
        heroEl.style.setProperty("--walk-dur", `${(0.5 - sp * 0.16).toFixed(3)}s`);
      }
      const nextPose = p.climb ? "climb" : p.air ? "jump" : Math.abs(p.vx) > 6 ? "walk" : "idle";
      if (nextPose !== p.pose) {
        p.pose = nextPose;
        setPose(nextPose);
      }
      setFacing((f) => (f === p.face ? f : p.face));

      // o que dá para usar aqui
      const s =
        p.busy || p.climb || p.air
          ? null
          : artRef.current.spots.find((q) => q.where === p.where && Math.abs(p.x - q.x) < q.w / 2 + 6 && Math.abs(p.y - q.y) < 6) || null;
      if (s !== spotRef.current) {
        spotRef.current = s;
        window.__orbeSanctuarySpot = s;
        setSpot(s);
      }
      const pr = promptRef.current;
      if (pr && s) pr.style.transform = `translate(${((s.x + ox) * v.s).toFixed(1)}px, ${((s.y - 66 + top) * v.s).toFixed(1)}px)`;
    };

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!document.querySelector(".pwd-editor")) {
        update(dt);
        render(now / 1000);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.__orbeSanctuarySpot = null;
    };
  }, []);

  const hint = spot ? null : where === "out" ? tx("Vá até a porta da árvore para entrar em casa") : tx("Explore a casa: baú, relógio, estante, cama e varanda");
  const keyFor = (s) => (UPISH.includes(s.act) ? "E / ↑" : s.act === "down" ? "E / ↓" : "E");

  return (
    <div ref={wrapRef} className={`pw-wrap ${night ? "is-night" : ""}`} onPointerDown={(e) => e.stopPropagation()}>
      <canvas ref={canvasRef} className="pw-canvas" />

      <div ref={heroRef} className={`pw-hero ${night ? "night" : ""} ${where === "in" ? "inside" : ""}`}>
        <HeroModel hero={hero} pose={pose === "climb" ? "walk" : pose === "idle" ? null : pose} flip={facing < 0} />
      </div>

      {spot && (
        <button ref={promptRef} type="button" className="pw-prompt" onClick={() => act(spot)}>
          <kbd>{keyFor(spot)}</kbd>
          {tx(spot.label)}
        </button>
      )}

      {hint && !IS_TOUCH && (
        <div className="pw-hint">
          <span>{hint}</span>
          <span className="pw-keys">
            <kbd>A</kbd>
            <kbd>D</kbd> {tx("andar")} · <kbd>{tx("Espaço")}</kbd> {tx("pular")} · <kbd>E</kbd> {tx("interagir")} · <kbd>+</kbd>
            <kbd>−</kbd> {tx("zoom")} · <kbd>L</kbd> {tx("cenário")}
          </span>
        </div>
      )}

      {zoomBadge !== null && <div className="pw-zoom-badge">{zoomBadge}%</div>}

      <div className={`pw-fade ${fade ? "on" : ""}`} />
      <div className={`pw-sleep ${sleeping ? "on" : ""}`}>
        <span>Z</span>
        <span>z</span>
        <span>z</span>
      </div>

      {panel && (
        <div className="pw-panel" onPointerDown={(e) => e.stopPropagation()}>
          <div className="pw-panel-head">
            <strong>{tx("Cenário")}</strong>
            <button type="button" onClick={() => setPanel(false)} title={tx("Fechar (Esc)")}>
              ✕
            </button>
          </div>
          <div className="pw-scenes">
            {SCENE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={kind === id ? "on" : ""}
                onClick={() => {
                  sfx.play("rustle");
                  setSanctuary({ scene: id });
                }}
              >
                <ScenePreview id={id} season={season} night={night} />
                <b>{tx(SCENES[id].name)}</b>
                <small>{tx(SCENES[id].desc)}</small>
              </button>
            ))}
          </div>
          <p className="pw-sub">{tx("Estação")}</p>
          <div className="pw-chips">
            {SEASONS.map((s) => (
              <button key={s.id} type="button" className={(prefs.season || "auto") === s.id ? "on" : ""} onClick={() => setSanctuary({ season: s.id })}>
                {tx(s.label)}
              </button>
            ))}
          </div>
          <p className="pw-sub">{tx("Céu")}</p>
          <div className="pw-chips">
            {SKY_MODES.map((s) => (
              <button key={s.id} type="button" className={(prefs.night || "auto") === s.id ? "on" : ""} onClick={() => setSanctuary({ night: s.id })}>
                {tx(s.label)}
              </button>
            ))}
          </div>
          <p className="pw-sub">{tx("Zoom")}</p>
          <div className="pw-chips">
            {[0.75, 1, 1.5, 2].map((z) => (
              <button key={z} type="button" className={Math.abs(zoomRef.current - z) < 0.01 ? "on" : ""} onClick={() => setZoom(z)}>
                {Math.round(z * 100)}%
              </button>
            ))}
          </div>
          <button
            type="button"
            className="pw-dev-btn"
            onClick={() => {
              sfx.play("open");
              setEditor(true);
            }}
          >
            <span>🛠️</span>
            <span>
              <b>{tx("Modo desenvolvedor")}</b>
              <small>{tx("Editar texturas, blocos e objetos de todo o cenário em pixel art")}</small>
            </span>
          </button>
          <p className="pw-tip">{tx("Dormir na cama também troca entre dia e noite.")}</p>
        </div>
      )}

      {gardenOpen && <GardenPanel garden={garden} update={updateGarden} onClose={() => setGardenOpen(false)} />}

      {IS_TOUCH && (
        <button
          type="button"
          className={`pw-joy-toggle ${joy ? "on" : ""}`}
          title={joy ? tx("Voltar aos botões") : tx("Usar joystick")}
          onClick={() => {
            const next = !joy;
            setJoy(next);
            writeLS(JOY_KEY, next ? "1" : "0");
            st.current.analog = 0;
          }}
        >
          🕹️
        </button>
      )}
      {IS_TOUCH && !joy && <TouchPad action />}
      {IS_TOUCH && joy && (
        <Joystick
          onAxis={(x) => {
            st.current.analog = x;
          }}
          onUp={upAction}
          onDown={downAction}
          onJump={jump}
          onAct={() => spotRef.current && actRef.current(spotRef.current)}
          hasSpot={Boolean(spot)}
        />
      )}

      {editor &&
        createPortal(
          <PixelSceneEditor
            kind={kind}
            season={season}
            bases={skinBases || bases}
            devData={devData}
            onData={setDevData}
            onClose={() => setEditor(false)}
          />,
          document.body
        )}
    </div>
  );
}

/* ---------- janela do canteiro ---------- */
const fmtTime = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return m ? `${m}min ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
};
function GardenPanel({ garden, update, onClose }) {
  const [picking, setPicking] = useState(null); // canteiro escolhendo o que plantar
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e) => {
      const k = (e.key || "").toLowerCase();
      if (k !== "escape" && k !== "e") return;
      if (document.querySelector(".ui-dialog-backdrop")) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      sfx.play("close");
      closeRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  const now = Date.now();
  const thirsty = garden.beds.some((b) => b && stageOf(b) < 3 && waterOf(b, now) < 0.35);

  return (
    <div className="pw-garden" onPointerDown={(e) => e.stopPropagation()}>
      <div className="pw-garden-box">
        <div className="pw-panel-head">
          <strong>🌱 {tx("Canteiro")}</strong>
          <button type="button" onClick={onClose} title={tx("Fechar (Esc)")}>
            ✕
          </button>
        </div>
        <div className="pw-bag">
          <span>{tx("Colhido")}:</span>
          {Object.values(CROPS).map((c) => (
            <b key={c.id}>
              {c.icon} {garden.bag[c.id] || 0}
            </b>
          ))}
          {thirsty && (
            <button
              type="button"
              className="pw-water-all"
              onClick={() => {
                sfx.play("drop");
                update((g) => waterAll(g));
              }}
            >
              💧 {tx("Aguar tudo")}
            </button>
          )}
        </div>
        <div className="pw-beds">
          {garden.beds.map((b, i) => {
            if (!b) {
              return (
                <div key={i} className="pw-bed empty">
                  <div className="pw-bed-soil">{picking === i ? "" : "·  ·  ·"}</div>
                  {picking === i ? (
                    <div className="pw-bed-pick">
                      {Object.values(CROPS).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            sfx.play("grow");
                            update((g) => plant(g, i, c.id));
                            setPicking(null);
                          }}
                        >
                          {c.icon} {tx(c.name)}
                          <small>{Math.round(c.grow / 60000)} min</small>
                        </button>
                      ))}
                      <button type="button" className="ghost" onClick={() => setPicking(null)}>
                        {tx("Cancelar")}
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="pw-bed-main" onClick={() => setPicking(i)}>
                      🌱 {tx("Plantar")}
                    </button>
                  )}
                </div>
              );
            }
            const crop = CROPS[b.crop];
            const stage = stageOf(b);
            const prog = progressOf(b);
            const wet = waterOf(b, now);
            const left = crop.grow - b.grown;
            const ready = stage === 3;
            return (
              <div key={i} className={`pw-bed stage-${stage} ${ready ? "ready" : ""}`}>
                <div className="pw-bed-top">
                  <span className="pw-bed-icon">{ready ? crop.icon : ["🫘", "🌱", "🌿"][stage]}</span>
                  <span>
                    <b>{tx(crop.name)}</b>
                    <small>{tx(STAGES[stage])}</small>
                  </span>
                </div>
                <div className="pw-meter grow" title={tx("Crescimento")}>
                  <span style={{ width: `${prog * 100}%` }} />
                </div>
                {!ready && (
                  <>
                    <div className="pw-meter water" title={tx("Água")}>
                      <span style={{ width: `${wet * 100}%` }} />
                    </div>
                    <small className="pw-bed-note">
                      {wet > 0 ? `${tx("Cresce mais")} ${fmtTime(Math.min(left, b.wetUntil - now))} · ${tx("falta")} ${fmtTime(left)}` : tx("Terra seca: regue para crescer")}
                    </small>
                  </>
                )}
                {ready ? (
                  <button
                    type="button"
                    className="pw-bed-main harvest"
                    onClick={() => {
                      sfx.play("save");
                      update((g) => harvest(g, i));
                    }}
                  >
                    🧺 {tx("Colher")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`pw-bed-main ${wet < 0.35 ? "thirsty" : ""}`}
                    onClick={() => {
                      sfx.play("drop");
                      update((g) => water(g, i));
                    }}
                  >
                    💧 {tx("Aguar")}
                  </button>
                )}
                {!ready && (
                  <button
                    type="button"
                    className="pw-bed-x"
                    title={tx("Arrancar")}
                    onClick={async () => {
                      if (!(await ask({ title: tx("Arrancar a planta?"), message: tx("Ela sai do canteiro sem dar colheita."), yes: tx("Arrancar") }))) return;
                      sfx.play("delete");
                      update((g) => uproot(g, i));
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="pw-tip">{tx("As plantas só crescem com a terra molhada. Cada rega dura 15 minutos, mesmo com o app fechado.")}</p>
      </div>
    </div>
  );
}

/* ---------- joystick (celular/tablet) ---------- */
function Joystick({ onAxis, onUp, onDown, onJump, onAct, hasSpot }) {
  const baseRef = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  const R = 52;
  const release = () => {
    drag.current = null;
    setKnob({ x: 0, y: 0 });
    onAxis(0);
  };
  return (
    <div className="pw-joy" onPointerDown={(e) => e.stopPropagation()}>
      <div
        ref={baseRef}
        className="pw-joy-base"
        onPointerDown={(e) => {
          e.preventDefault();
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* sem captura */
          }
          const r = baseRef.current.getBoundingClientRect();
          drag.current = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, up: false, down: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          let x = e.clientX - d.cx;
          let y = e.clientY - d.cy;
          const len = Math.hypot(x, y);
          if (len > R) {
            x = (x / len) * R;
            y = (y / len) * R;
          }
          setKnob({ x, y });
          const ax = x / R;
          onAxis(Math.abs(ax) < 0.18 ? 0 : ax);
          // empurrar para cima/baixo: porta e escada (para cima sem nada perto: pula)
          if (y / R < -0.7 && !d.up) {
            d.up = true;
            onUp();
          } else if (y / R > -0.4) d.up = false;
          if (y / R > 0.7 && !d.down) {
            d.down = true;
            onDown();
          } else if (y / R < 0.4) d.down = false;
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
      >
        <span className="pw-joy-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <div className="pw-joy-actions">
        <button
          type="button"
          className={`pw-joy-btn act ${hasSpot ? "ready" : ""}`}
          onPointerDown={(e) => {
            e.preventDefault();
            onAct();
          }}
        >
          E
        </button>
        <button
          type="button"
          className="pw-joy-btn jump"
          onPointerDown={(e) => {
            e.preventDefault();
            onJump();
          }}
        >
          ⤒
        </button>
      </div>
    </div>
  );
}

// miniatura do cenário (pedacinho do mundo em volta da casa)
function ScenePreview({ id, season, night }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    const w = 300;
    c.width = w;
    c.height = VH;
    const far = buildFar(id, season);
    const mid = buildMid(id, season);
    const { c: world, lights } = buildWorld(id, season);
    const focus = id === "praia" ? SCENES.praia.sand + 60 : id === "ilha" ? 1260 : TX + 120;
    const cam = focus - w / 2;
    drawSky(g, w, night, 0);
    g.drawImage(far, Math.round(-900 - cam * FAR), -PAD);
    if (mid) g.drawImage(mid, Math.round(-900 - cam * MID), -PAD);
    g.drawImage(world, -cam, -PAD);
    if (night) drawNight(g, w, lights, -cam, false);
  }, [id, season, night]);
  return <canvas ref={ref} className="pw-preview" />;
}
