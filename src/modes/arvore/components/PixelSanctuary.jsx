/* =========================================================
   SANTUÁRIO EM PIXEL ART
   O mundo inteiro em 2D, no mesmo pixel dos personagens.
   A Árvore gigante é a casa do herói: pela porta do tronco ele
   entra, sobe a escada, sai na varanda e usa o baú (Personagem),
   o relógio (Pomodoro), a estante (Notas) e a cama (dia ↔ noite).
   - Ao lado: lago fundo (dá para nadar e mergulhar) com
     vitórias-régias e um sapinho; e a horta, que abre uma
     fazenda vista de cima com 2 canteiros de 4 × 6.
   - O chão é feito de blocos de 4 pixels (modo desenvolvedor).
   - Mouse: arrastar move a vista · roda dá zoom (até 600%).
   - Celular/tablet: botões na tela ou joystick (liga no 🕹️).
   A D / ← → andar · Espaço pular/nadar · 1 interagir · ↑ porta/escada
   Na horta: WASD andar · 1 colher/sair · 2 plantar · 3 regar · Q semente
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
import { CAN_COLORS, CAN_PIXELS, EXTRA_SCENES, imageToCanvas, itemSkinPath, loadSkinImage, npcSkinPath, sceneSkinPath, skinImg, skinUrl, hasSkin } from "../../../shared/skins.js";
import { SEASONS, seasonOf, setSanctuary } from "./Sanctuary.jsx";
import TouchPad from "./TouchPad.jsx";
import PixelSceneEditor from "./PixelSceneEditor.jsx";
import { artKey, blobToCanvas, loadDevData, solidKey, spotsKey } from "./sanctuaryDevStore.js";
import { CAN_MAX, CROPS, CROP_IDS, FISH, FISH_IDS, INV_SIZE, ORBS, ORB_IDS, addFish, buySeed, equipRing, giveOrb, pickFish, sellItem, countItem, harvestAt, isWet, itemInfo, loadGarden, moveSlot, nextSeed, plantAt, refillCan, saveGarden, sell, stageOf, tickGarden, waterAt } from "../lib/garden.js";
import { WEATHER_TEXT, weatherAt } from "../lib/weather.js";
import { classFor } from "../../../atualizacao2_0/HeroModels.js";
import { FARM_START, FH, FT, FW, bedIndex, buildFarm, drawCrop, drawSoilState, farmSolid, isGate, isWell, tileOfIndex } from "./farmWorld.js";
import { CANOPY_BOUNDS, CANOPY_SPOTS, CANOPY_W, GRID_CANOPY, buildCanopy, canopySolid, drawStarSky } from "./canopyWorld.js";
import {
  GRID_SHOP,
  GRID_VILLAGE,
  NPCS,
  SHOP_BOUNDS,
  SHOP_TREE_X,
  VENDOR,
  VILLAGE_BOUNDS,
  VILLAGE_SPOTS,
  VILLAGE_W,
  buildShop,
  buildShopFront,
  buildVillage,
  shopSolid,
  villageSolid
} from "./villageWorld.js";
import {
  BOT,
  FAR,
  GRID_IN,
  GRID_OUT,
  GROUND,
  IN_BOUNDS,
  IN_W,
  LAKE_SURF,
  LILIES,
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
  drawFish,
  makeFish,
  updateFish,
  drawGardenPlants,
  drawLakeFront,
  drawNight,
  drawPendulum,
  drawRoomWindow,
  drawSky,
  drawWaves,
  lakeOf,
  lilyX,
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
// nadando
const SWIM_STROKE = 125;
const SWIM_SINK = 38;
const SWIM_SPEED = 0.55;
// horta (vista de cima)
const FARM_SPEED = 80;
const FOOT = 9;
// caixa do herói (para bater nos blocos)
const HALF = 7;
const HEIGHT = 36;
const VB = VH + BOT;

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 6;
const ZOOM_KEY = "pw-zoom";
const JOY_KEY = "pw-joystick";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
const isTyping = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
const modalOpen = () => document.querySelector(".modal-backdrop, .ui-dialog-backdrop, .pwd-editor, .pw-inv, .pw-shop");
const FLOOR1_SHOP = 212 - 18; // o vendedor fica num degrau atrás do balcão
const WEAPON_ICON = { wizard: "🪄", archer: "🏹", warrior: "⚔️", elf: "🌿" };
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

// onde o personagem estava ao sair do Santuário (vila e loja não contam)
const PLACE_KEY = "pw-last-place";
const KEEP_PLACES = ["out", "in", "farm", "canopy"];
function readPlace() {
  try {
    const v = JSON.parse(localStorage.getItem(PLACE_KEY));
    return v && KEEP_PLACES.includes(v.where) ? v : null;
  } catch {
    return null;
  }
}
function savePlace(p) {
  try {
    if (!KEEP_PLACES.includes(p.where)) localStorage.removeItem(PLACE_KEY);
    else localStorage.setItem(PLACE_KEY, JSON.stringify({ where: p.where, x: Math.round(p.x), y: Math.round(p.y), fx: Math.round(p.fx), fy: Math.round(p.fy), fdir: p.fdir, face: p.face }));
  } catch {
    /* sem armazenamento */
  }
}

// abertura "de cinema"
const CINE = {
  santuario: { title: "Santuário", sub: "Sua casa na árvore gigante. Plante na horta, nade no lago, suba até a copa para ver as estrelas e siga o caminho da esquerda até a vila." },
  vila: { title: "Vila Folhaverde", sub: "Elfos, magos e vizinhos amigáveis. Na árvore do meio fica a lojinha do Seu Bartolomeu." }
};

const readHero = () => normalizeHero(readProfileValue("rpg_hero_v1", getActiveProfileId(), DEFAULT_HERO));

// blocos padrão + o que foi mudado no modo desenvolvedor
export function solidGrid(where, kind, rec) {
  const grid = defaultSolid(where, kind);
  if (rec && rec.diff) Object.entries(rec.diff).forEach(([i, v]) => (grid[+i] = v ? 1 : 0));
  return grid;
}
// objetos (porta, baú...) com as posições mudadas no modo desenvolvedor
export function spotsFor(kind, data) {
  const list = SPOTS.map((s) => {
    const rec = data[spotsKey(s.where, kind)];
    const o = rec && rec.map && rec.map[s.id];
    return o ? { ...s, x: o.x, y: o.y } : s;
  });
  // caminho para a vila: no fim do mapa, à esquerda
  const left = SCENES[kind].bounds[0];
  return [...list, { id: "toVillage", where: "out", x: left + 14, y: GROUND, w: 40, label: "Ir para a vila", act: "toVillage" }, ...VILLAGE_SPOTS, ...CANOPY_SPOTS];
}

const FACE = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const FARM_REACH = 3; // o mouse alcança até 3 quadradinhos do personagem
// distância do personagem até o meio do quadradinho (justo mesmo parado na divisa)
const farmInReach = (c, r, p) => Math.abs((c + 0.5) * 32 - p.fx) <= (FARM_REACH + 0.6) * 32 && Math.abs((r + 0.5) * 32 - (p.fy - 4)) <= (FARM_REACH + 0.6) * 32;
const TOOLS = [
  { id: "hand", key: "1", icon: "", label: "Colher / usar" },
  { id: "seed", key: "2", icon: "🌱", label: "Plantar" },
  { id: "can", key: "3", icon: "💧", label: "Regador" }
];

export default function PixelSanctuary({ prefs }) {
  useLanguage();
  const kind = SCENES[prefs.scene] ? prefs.scene : "campo";
  const season = seasonOf(prefs.season);
  const night = isNightNow(prefs.night);

  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const frontRef = useRef(null);
  const heroRef = useRef(null);
  const promptRef = useRef(null);
  const view = useRef({ s: 3, cw: 400, ch: VH, cam: 0, top: 0, panX: 0, panY: 0 });
  const keys = useRef(new Set());
  const parts = useRef([]);
  const spotRef = useRef(null);
  const nightRef = useRef(night);
  nightRef.current = night;
  const zoomRef = useRef(clamp(parseFloat(readLS(ZOOM_KEY, "1")) || 1, ZOOM_MIN, ZOOM_MAX));
  const fitRef = useRef(() => {});
  const frog = useRef({ pad: 2, x: 0, y: LAKE_SURF - 1, air: false, next: 3, jump: null, croak: false, croakAt: 5 });
  const splashes = useRef([]);
  const hoverTile = useRef(null);
  const fishRef = useRef({ key: null, list: [] });

  const [hero, setHero] = useState(readHero);
  const startPlace = useRef(undefined);
  if (startPlace.current === undefined) startPlace.current = readPlace();
  const [where, setWhere] = useState(() => (startPlace.current ? startPlace.current.where : "out"));
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
  const [tool, setTool] = useState("hand");
  const [toast, setToast] = useState(null);
  const [cine, setCine] = useState(() => ({ ...CINE.santuario, id: Date.now() }));
  const cineRef = useRef(cine);
  cineRef.current = cine;
  const [hintOn, setHintOn] = useState(true);
  const [dragging, setDragging] = useState(false);
  const toastTimer = useRef(0);
  const say = useCallback((text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  // clima (sorteado a cada 3 horas de verdade)
  const seasonRef = useRef(season);
  seasonRef.current = season;
  const [weather, setWeather] = useState(() => weatherAt(Date.now(), season));
  const weatherRef = useRef(weather);
  weatherRef.current = weather;
  useEffect(() => {
    const upd = () => setWeather((w) => {
      const n = weatherAt(Date.now(), seasonRef.current);
      return w.slot === n.slot && w.rain === n.rain && w.snow === n.snow && w.wind === n.wind ? w : n;
    });
    upd();
    const id = setInterval(upd, 15000);
    return () => clearInterval(id);
  }, [season]);

  // inventário (4), loja e conversas
  const [invOpen, setInvOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [bubble, setBubble] = useState(null); // { npc, text }
  const bubbleRef = useRef(null);
  const npcRefs = useRef({});
  const npcState = useRef(null);
  if (!npcState.current) {
    npcState.current = Object.fromEntries(NPCS.map((n, i) => [n.id, { x: n.x0 + ((n.x1 - n.x0) * ((i * 37) % 10)) / 10, dir: i % 2 ? 1 : -1, wait: 0, moving: false }]));
  }
  const [npcPose, setNpcPose] = useState({});
  bubbleRef.current = bubble;
  useEffect(() => {
    if (!bubble) return undefined;
    const id = setTimeout(() => setBubble(null), Math.max(200, bubble.until - Date.now()));
    return () => clearTimeout(id);
  }, [bubble]);

  // horta
  const [garden, setGardenState] = useState(() => tickGarden(loadGarden(), Date.now(), season));
  const gardenRef = useRef(garden);
  gardenRef.current = garden;
  // o tempo passa: atualiza o crescimento a cada segundo
  useEffect(() => {
    const id = setInterval(() => setGardenState((g) => tickGarden(g, Date.now(), seasonRef.current)), 1000);
    const save = () => saveGarden(tickGarden(gardenRef.current, Date.now(), seasonRef.current));
    window.addEventListener("beforeunload", save);
    return () => {
      clearInterval(id);
      window.removeEventListener("beforeunload", save);
      save();
    };
  }, []);

  const st = useRef(null);
  if (!st.current) {
    st.current = { where: "out", x: TX + 112, y: GROUND, vx: 0, vy: 0, air: false, swim: false, coyote: 0, buffer: 0, climb: null, busy: false, face: 1, pose: "idle", analog: 0, analogY: 0, fx: FARM_START.x, fy: FARM_START.y, fdir: "up", moving: false };
    const sp = startPlace.current;
    if (sp) Object.assign(st.current, { where: sp.where, x: sp.x, y: sp.y - 2, fx: sp.fx || FARM_START.x, fy: sp.fy || FARM_START.y, fdir: sp.fdir || "up", face: sp.face || 1 });
  }

  /* ---------- desenhos ---------- */
  // base (desenhada pelo código), refeita só quando muda o cenário ou a estação
  const bases = useMemo(() => {
    const world = buildWorld(kind, season);
    const house = buildInterior(season);
    return { far: buildFar(kind, season), mid: buildMid(kind, season), world: world.c, worldLights: world.lights, house: house.c, houseLights: house.lights, win: house.win };
  }, [kind, season]);
  const farmArt = useMemo(() => buildFarm(season), [season]);
  // vila e lojinha (o fundo da vila é sempre a floresta)
  const villageArt = useMemo(() => {
    const v = buildVillage(season);
    const sh = buildShop(season);
    return { far: buildFar("campo", season), mid: buildMid("campo", season), world: v.c, lights: v.lights, shop: sh.c, shopLights: sh.lights, shopFront: buildShopFront() };
  }, [season]);
  const villageGrids = useMemo(() => ({ village: villageSolid(), shop: shopSolid(), canopy: canopySolid() }), []);
  // topo da copa
  const canopyArt = useMemo(() => buildCanopy(season), [season]);
  const [sitting, setSitting] = useState(false);
  const [gazing, setGazing] = useState(false);
  const gaze = useRef({ k: 0, target: 0 });
  // pesca: idle · charge (medindo a força) · cast · wait · bite (!) · game (minigame)
  const fishing = useRef({ phase: "idle" });
  const reelHold = useRef(false);
  const [fishGame, setFishGame] = useState(null);
  const fishEls = useRef({});
  const orbCd = useRef(0);
  const [orbFlash, setOrbFlash] = useState(0);

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
    const b0 = skinBases;
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
      const [far, mid, world, house] = await Promise.all([apply("far", b0.far), apply("mid", b0.mid), apply("world", b0.world), apply("house", b0.house)]);
      if (alive) setLayers({ far, mid, world, house, worldLights: b0.worldLights, houseLights: b0.houseLights, win: b0.win });
    })();
    return () => {
      alive = false;
    };
  }, [skinBases, devData, kind]);

  const grids = useMemo(() => ({ out: solidGrid("out", kind, devData[solidKey("out", kind)]), in: solidGrid("in", kind, devData[solidKey("in", kind)]) }), [kind, devData]);
  const spots = useMemo(() => spotsFor(kind, devData), [kind, devData]);

  const artRef = useRef({});
  artRef.current = { layers, kind, season, grids, spots, farmArt, lake: lakeOf(kind), villageArt, villageGrids, canopyArt };

  useEffect(() => {
    const save = () => savePlace(st.current);
    const id = setInterval(save, 5000);
    window.addEventListener("beforeunload", save);
    return () => {
      clearInterval(id);
      window.removeEventListener("beforeunload", save);
      save();
    };
  }, []);

  useEffect(() => {
    if (!cine) return undefined;
    const end = () => setCine(null);
    const id = setTimeout(end, 4800);
    const onKey = (e) => {
      if (document.querySelector(".modal-backdrop, .ui-dialog-backdrop")) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      end();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(id);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [cine]);
  // a dica do topo some em 3 segundos (volta ao mudar de lugar)
  useEffect(() => {
    setHintOn(true);
    const id = setTimeout(() => setHintOn(false), 3000);
    return () => clearTimeout(id);
  }, [where]);

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

  /* ---------- câmera ---------- */
  // onde a câmera quer ficar (sem o arrasto do mouse)
  const camBase = (p, v) => {
    const { cw, ch } = v;
    if (p.where === "farm") {
      const cam = FW <= cw ? (FW - cw) / 2 : clamp(p.fx - cw / 2, 0, FW - cw);
      const camY = FH <= ch ? (FH - ch) / 2 : clamp(p.fy - 24 - ch / 2, 0, FH - ch);
      return { cam, top: -camY };
    }
    const worldW = p.where === "out" ? OUT_W : p.where === "village" ? VILLAGE_W : p.where === "canopy" ? CANOPY_W : IN_W;
    const cam = worldW <= cw ? (worldW - cw) / 2 : clamp(p.x - cw / 2, 0, worldW - cw);
    let top = ch >= VH ? Math.round((ch - VH) * 0.62) : Math.round(ch * 0.62 - p.y);
    // sempre com o herói à vista (mergulhando no lago, na varanda...)
    if (p.y + top > ch - 14) top = ch - 14 - p.y;
    if (p.y - 48 + top < 6) top = 54 - p.y;
    return { cam, top: clamp(top, ch - VB, PAD) };
  };
  const camClamp = (p, v, cam, top) => {
    const { cw, ch } = v;
    if (p.where === "farm") {
      const camY = -top;
      return {
        cam: FW <= cw ? (FW - cw) / 2 : clamp(cam, -40, FW - cw + 40),
        top: -(FH <= ch ? (FH - ch) / 2 : clamp(camY, -40, FH - ch + 40))
      };
    }
    const worldW = p.where === "out" ? OUT_W : p.where === "village" ? VILLAGE_W : p.where === "canopy" ? CANOPY_W : IN_W;
    return {
      cam: worldW <= cw ? (worldW - cw) / 2 : clamp(cam, 0, worldW - cw),
      top: clamp(top, Math.min(ch - VB, 0), PAD)
    };
  };
  const camRef = useRef({ camBase, camClamp });
  camRef.current = { camBase, camClamp };

  /* ---------- tamanho da tela e zoom ---------- */
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const front = frontRef.current;
    if (!wrap || !canvas || !front) return undefined;
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
      [canvas, front].forEach((c) => {
        c.width = cw;
        c.height = ch;
        c.style.width = `${cw * s}px`;
        c.style.height = `${ch * s}px`;
      });
      wrap.style.setProperty("--pw-s", String(s));
    };
    fitRef.current = fit;
    view.current.snap = true;
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  const badgeTimer = useRef(0);
  // zoom: mantém parado o ponto que está embaixo do mouse (ou o meio da tela)
  const setZoom = useCallback((z, mx, my) => {
    const next = clamp(z, ZOOM_MIN, ZOOM_MAX);
    if (Math.abs(next - zoomRef.current) < 0.001) return;
    const v = view.current;
    const p = st.current;
    const ax = mx ?? (v.cw * v.s) / 2;
    const ay = my ?? (v.ch * v.s) / 2;
    const wx = v.cam + ax / v.s;
    const wy = ay / v.s - v.top;
    zoomRef.current = next;
    writeLS(ZOOM_KEY, String(next.toFixed(2)));
    fitRef.current();
    const T = camRef.current.camBase(p, v);
    const want = camRef.current.camClamp(p, v, wx - ax / v.s, ay / v.s - wy);
    v.cam = want.cam;
    v.top = want.top;
    v.panX = want.cam - T.cam;
    v.panY = T.top - want.top;
    setZoomBadge(Math.round(next * 100));
    clearTimeout(badgeTimer.current);
    badgeTimer.current = setTimeout(() => setZoomBadge(null), 900);
  }, []);

  /* ---------- horta: ações ---------- */
  const updateGarden = useCallback((fn) => {
    const res = fn(tickGarden(gardenRef.current, Date.now(), seasonRef.current));
    if (res.g !== gardenRef.current) {
      gardenRef.current = res.g;
      setGardenState(res.g);
      saveGarden(res.g);
    }
    return res;
  }, []);

  const transition = useCallback((fn) => {
    const p = st.current;
    p.busy = true;
    setFade(true);
    setTimeout(() => {
      fn(p, artRef.current.spots);
      p.vx = 0;
      p.vy = 0;
      p.air = false;
      p.swim = false;
      setWhere(p.where);
      view.current.panX = 0;
      view.current.panY = 0;
      view.current.snap = true;
      setFade(false);
      setTimeout(() => {
        p.busy = false;
      }, 120);
    }, 260);
  }, []);

  const leaveFarm = useCallback(() => {
    const p = st.current;
    if (p.busy) return;
    sfx.play("close");
    transition((q, list) => {
      const t = list.find((s) => s.id === "garden");
      q.where = "out";
      q.x = t.x;
      q.y = t.y;
      q.face = 1;
    });
  }, [transition]);

  // usa a ferramenta num quadradinho da horta
  const farmUse = useCallback(
    (toolId, c, r) => {
      const idx = bedIndex(c, r);
      if (toolId === "hand") {
        if (isGate(c, r) || r > 13) return leaveFarm();
        if (idx >= 0) {
          const res = updateGarden((g) => harvestAt(g, idx));
          if (res.ok) {
            sfx.play("save");
            say(`${CROPS[res.crop].icon} ${tx("Colheu")} ${tx(CROPS[res.crop].name).toLowerCase()}!`);
          } else if (res.msg) say(tx(res.msg));
          else say(tx("Terra vazia: plante com o 2"));
          return;
        }
        if (isWell(c, r)) return say(tx("Encha o regador com o 3"));
        return;
      }
      if (toolId === "seed") {
        if (idx < 0) return say(tx("Plante na terra arada dos canteiros"));
        const res = updateGarden((g) => plantAt(g, idx));
        if (res.ok) sfx.play("grow");
        else if (res.msg) say(tx(res.msg));
        return;
      }
      if (toolId === "can") {
        if (isWell(c, r)) {
          updateGarden((g) => ({ g: refillCan(g), ok: true }));
          sfx.play("drop");
          return say(`💧 ${tx("Regador cheio!")}`);
        }
        if (idx < 0) return say(tx("Regue a terra dos canteiros (ou encha no poço)"));
        const res = updateGarden((g) => waterAt(g, idx, seasonRef.current));
        if (res.ok) {
          sfx.play("drop");
          const now = performance.now() / 1000;
          for (let k = 0; k < 8; k++) splashes.current.push({ x: c * FT + 8 + Math.random() * 16, y: r * FT + 10 + Math.random() * 10, vy: -20 - Math.random() * 25, vx: -10 + Math.random() * 20, t0: now });
        } else if (res.msg) say(tx(res.msg));
      }
    },
    [leaveFarm, say, updateGarden]
  );
  const farmTarget = () => {
    const p = st.current;
    const c = Math.floor(p.fx / FT);
    const r = Math.floor((p.fy - 4) / FT);
    const [dx, dy] = FACE[p.fdir] || FACE.down;
    return { c: c + dx, r: r + dy };
  };
  const farmKey = (toolId) => {
    setTool(toolId);
    const tgt = farmTarget();
    farmUse(toolId, tgt.c, tgt.r);
  };
  const farmKeyRef = useRef(farmKey);
  farmKeyRef.current = farmKey;

  // roda do mouse, arrastar a vista e pinça
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const ui = (e) => e.target.closest && e.target.closest(".pw-panel, .pw-joy, .sanc-pad, .pw-hotbar, .pw-joy-toggle, .pw-fishgame, .pw-inv, .pw-shop, button");
    const onWheel = (e) => {
      if (ui(e)) return;
      e.preventDefault();
      const r = wrap.getBoundingClientRect();
      setZoom(zoomRef.current * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX - r.left, e.clientY - r.top);
    };
    const touches = new Map();
    let pinch = null;
    let drag = null;
    const onDown = (e) => {
      if (ui(e)) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        const r = wrap.getBoundingClientRect();
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: zoomRef.current, cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top };
        drag = null;
        return;
      }
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
    };
    const onMove = (e) => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && touches.size === 2) {
        const [a, b] = [...touches.values()];
        setZoom((pinch.z * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d, pinch.cx, pinch.cy);
        return;
      }
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 5) return;
      if (!drag.moved) {
        drag.moved = true;
        setDragging(true);
      }
      drag.x = e.clientX;
      drag.y = e.clientY;
      const v = view.current;
      v.panX -= dx / v.s;
      v.panY -= dy / v.s;
    };
    const onUp = (e) => {
      touches.delete(e.pointerId);
      if (touches.size < 2) pinch = null;
      if (drag && drag.id === e.pointerId) {
        // clique sem arrastar na horta: usa a ferramenta no quadradinho
        if (!drag.moved && st.current.where === "farm") {
          const v = view.current;
          const r = wrap.getBoundingClientRect();
          const wx = v.cam + (e.clientX - r.left) / v.s;
          const wy = (e.clientY - r.top) / v.s - v.top;
          const c = Math.floor(wx / FT);
          const row = Math.floor(wy / FT);
          const p = st.current;
          const pc = Math.floor(p.fx / FT);
          const pr = Math.floor((p.fy - 4) / FT);
          if (farmInReach(c, row, p)) {
            if (c !== pc || row !== pr) p.fdir = Math.abs(c - pc) >= Math.abs(row - pr) ? (c > pc ? "right" : "left") : row > pr ? "down" : "up";
            if (p.fdir === "left") p.face = -1;
            if (p.fdir === "right") p.face = 1;
            farmToolRef.current(c, row);
          } else say(tx("Chegue mais perto"));
        }
        drag = null;
        setDragging(false);
      }
    };
    const onHover = (e) => {
      if (st.current.where !== "farm") return;
      const v = view.current;
      const r = wrap.getBoundingClientRect();
      hoverTile.current = { c: Math.floor((v.cam + (e.clientX - r.left) / v.s) / FT), r: Math.floor(((e.clientY - r.top) / v.s - v.top) / FT) };
    };
    const onLeave = () => (hoverTile.current = null);
    wrap.addEventListener("pointermove", onHover);
    wrap.addEventListener("pointerleave", onLeave);
    const onDbl = (e) => {
      if (ui(e)) return;
      view.current.panX = 0;
      view.current.panY = 0;
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    wrap.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    wrap.addEventListener("dblclick", onDbl);
    return () => {
      wrap.removeEventListener("wheel", onWheel);
      wrap.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      wrap.removeEventListener("dblclick", onDbl);
      wrap.removeEventListener("pointermove", onHover);
      wrap.removeEventListener("pointerleave", onLeave);
    };
  }, [setZoom, say]);
  const farmToolRef = useRef(() => {});
  farmToolRef.current = (c, r) => farmUse(tool, c, r);

  // joystick: limpa os botões de baixo
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("pw-joy-on", joy);
    return () => html.classList.remove("pw-joy-on");
  }, [joy]);

  /* ---------- ações (fora e dentro de casa) ---------- */
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
        case "toCanopy":
          sfx.play("branch");
          transition((q) => {
            q.where = "canopy";
            q.x = 474;
            q.y = GROUND;
            q.face = 1;
          });
          break;
        case "fromCanopy":
          sfx.play("branch");
          p.sitting = false;
          setSitting(false);
          transition((q) => {
            q.where = "in";
            q.x = 366;
            q.y = 120;
            q.face = -1;
          });
          break;
        case "sit":
          if (p.sitting) {
            p.sitting = false;
            setSitting(false);
          } else {
            sfx.play("tick");
            p.sitting = true;
            p.x = s.x;
            p.vx = 0;
            p.face = 1;
            setSitting(true);
          }
          break;
        case "stargaze":
          sfx.play("open");
          keys.current.clear();
          gaze.current.target = 1;
          setGazing(true);
          break;
        case "toVillage":
          sfx.play("rustle");
          transition((q) => {
            q.where = "village";
            q.x = VILLAGE_W - 100;
            q.y = GROUND;
            q.face = -1;
            setCine({ ...CINE.vila, id: Date.now() });
          });
          break;
        case "toHome":
          sfx.play("rustle");
          transition((q) => {
            q.where = "out";
            q.x = SCENES[artRef.current.kind].bounds[0] + 40;
            q.y = GROUND;
            q.face = 1;
          });
          break;
        case "toShop":
          sfx.play("open");
          transition((q) => {
            q.where = "shop";
            q.x = 82;
            q.y = 212;
            q.face = 1;
          });
          break;
        case "fromShop":
          sfx.play("close");
          transition((q) => {
            q.where = "village";
            q.x = SHOP_TREE_X;
            q.y = GROUND;
            q.face = 1;
          });
          break;
        case "trade":
          sfx.play("open");
          keys.current.clear();
          setBubble({ npc: VENDOR.id, text: VENDOR.lines[Math.floor(Math.random() * VENDOR.lines.length)], until: Date.now() + 3200 });
          setShopOpen(true);
          break;
        case "talk": {
          const n = s.npc;
          sfx.play("tick");
          if (n.id === "nilson") {
            const g = gardenRef.current;
            if (!g.orbs || !g.orbs.casa) {
              updateGarden((g2) => giveOrb(g2, "casa"));
              sfx.play("grow");
              setBubble({ npc: n.id, text: "Tome, jovem: o Orbe Casateleportador! Já coloquei no seu anel. Aperte 6 para voltar para casa.", until: Date.now() + 5200 });
              say(`🔮 ${tx("Você ganhou o Orbe Casateleportador!")}`);
              break;
            }
            if (Math.random() < 0.4) {
              setBubble({ npc: n.id, text: "Os outros dois orbes ainda dormem... volte no futuro.", until: Date.now() + 3800 });
              break;
            }
          }
          setBubble({ npc: n.id, text: n.lines[Math.floor(Math.random() * n.lines.length)], until: Date.now() + 3500 });
          break;
        }
        case "farm":
          sfx.play("rustle");
          keys.current.clear();
          transition((q) => {
            q.where = "farm";
            q.fx = FARM_START.x;
            q.fy = FARM_START.y;
            q.fdir = "up";
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

  /* ---------- pesca ---------- */
  const canFish = () => {
    const p = st.current;
    const L = artRef.current.lake;
    return p.where === "out" && L && !p.swim && !p.air && !p.climb && Math.abs(p.y - GROUND) < 6 && p.x > L.x0 - 70 && p.x < L.x1 + 70;
  };
  const startFishGame = () => {
    const F = fishing.current;
    fishing.current = { ...F, phase: "game", barY: 0, barV: 0, fishY: 0.15, target: 0.5, nextT: 0, progress: 0.3 };
    reelHold.current = true;
    sfx.play("open");
    setFishGame({ fish: F.fish });
  };
  const fishPress = () => {
    const F = fishing.current;
    const now = performance.now() / 1000;
    if (F.phase === "idle") {
      if (!canFish()) return say(tx("Vá até a beira do lago para pescar (5)"));
      keys.current.clear();
      fishing.current = { phase: "charge", t0: now };
      return;
    }
    if (F.phase === "bite") return startFishGame();
    if (F.phase === "wait" || F.phase === "cast") {
      fishing.current = { phase: "idle" };
      return say(tx("Você recolheu a linha"));
    }
    if (F.phase === "game") reelHold.current = true;
  };
  const fishRelease = () => {
    const F = fishing.current;
    reelHold.current = false;
    if (F.phase !== "charge") return;
    const now = performance.now() / 1000;
    const power = 0.5 - 0.5 * Math.cos((now - F.t0) * 3.4);
    const p = st.current;
    const L = artRef.current.lake;
    const dir = p.x < (L.x0 + L.x1) / 2 ? 1 : -1;
    p.face = dir;
    const bx = p.x + dir * (24 + power * 200);
    if (bx < L.x0 + 6 || bx > L.x1 - 6) {
      fishing.current = { phase: "idle" };
      return say(tx(power < 0.5 ? "Fraco demais: o anzol caiu na terra" : "Longe demais!"));
    }
    sfx.play("rustle");
    fishing.current = { phase: "cast", t0: now, bx, power };
  };
  const fishApi = useRef({});
  fishApi.current = { press: fishPress, release: fishRelease };

  /* ---------- orbe Casateleportador (tecla 6) ---------- */
  const useOrb = () => {
    const g = gardenRef.current;
    if (!g.orbs || !g.orbs.casa) return say(tx("Você ainda não tem orbes: fale com o Mestre Nilson na vila"));
    if (g.ring !== "casa") return say(tx("Coloque o Orbe Casateleportador no anel (inventário, 4)"));
    const now = Date.now();
    if (now < orbCd.current) return say(`${tx("O orbe está recarregando")}… ${Math.ceil((orbCd.current - now) / 1000)}s`);
    orbCd.current = now + 8000;
    fishing.current = { phase: "idle" };
    setFishGame(null);
    gaze.current.target = 0;
    setGazing(false);
    st.current.sitting = false;
    setSitting(false);
    sfx.play("grow");
    setOrbFlash(now);
    transition((q, list) => {
      const door = list.find((x) => x.id === "door");
      q.where = "out";
      q.x = door.x + 24;
      q.y = door.y;
      q.face = 1;
    });
    say(`🔮 ${tx("Casateleportador!")}`);
  };
  const useOrbRef = useRef(useOrb);
  useOrbRef.current = useOrb;
  const UPISH = ["up", "enter", "exit", "deckIn", "deckOut", "farm", "toCanopy"];
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
  const press1 = () => {
    if (st.current.where === "farm") farmKeyRef.current("hand");
    else if (spotRef.current) actRef.current(spotRef.current);
  };

  /* ---------- teclado ---------- */
  useEffect(() => {
    const blocked = (e) => e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || isTyping(document.activeElement) || modalOpen();
    const MOVE = { a: "a", d: "d", arrowleft: "a", arrowright: "d", w: "w", s: "s", arrowup: "w", arrowdown: "s" };
    const onDown = (e) => {
      if (blocked(e)) return;
      const raw = (e.key || "").toLowerCase();
      const farm = st.current.where === "farm";
      const stop = () => {
        e.preventDefault();
        e.stopImmediatePropagation();
      };
      if (raw === "+" || raw === "=" || raw === "-" || raw === "0") {
        stop();
        setZoom(raw === "0" ? 1 : zoomRef.current * (raw === "-" ? 1 / 1.25 : 1.25));
        return;
      }
      // 6: orbe do anel (em qualquer lugar do Santuário)
      if (raw === "6" || e.code === "Digit6" || e.code === "Numpad6") {
        stop();
        if (!e.repeat) useOrbRef.current();
        return;
      }
      // pesca: 5 mede a força e lança; no "!" aperta para fisgar; no minigame segura
      const fishPhase = fishing.current.phase;
      if (raw === "5" || e.code === "Digit5" || e.code === "Numpad5") {
        stop();
        if (!e.repeat) fishApi.current.press();
        return;
      }
      if (fishPhase === "game" && (e.key === " " || e.code === "Space" || raw === "1")) {
        stop();
        reelHold.current = true;
        return;
      }
      if (fishPhase === "bite" && (e.key === " " || e.code === "Space" || raw === "1")) {
        stop();
        fishApi.current.press();
        return;
      }
      if (gaze.current.target === 1) {
        if (["1", "escape", " ", "a", "d", "w", "s", "arrowleft", "arrowright", "arrowup", "arrowdown"].includes(raw) || e.code === "Digit1") {
          stop();
          gaze.current.target = 0;
          setGazing(false);
        }
        return;
      }
      if (raw === "4" || e.code === "Digit4" || e.code === "Numpad4") {
        stop();
        if (!e.repeat) {
          keys.current.clear();
          sfx.play("open");
          setInvOpen(true);
        }
        return;
      }
      if (farm) {
        if (["1", "2", "3"].includes(raw) || ["Digit1", "Digit2", "Digit3", "Numpad1", "Numpad2", "Numpad3"].includes(e.code)) {
          stop();
          if (!e.repeat) farmKeyRef.current(TOOLS[(+raw || +e.code.slice(-1)) - 1].id);
          return;
        }
        if (raw === "q" || raw === "tab") {
          stop();
          if (!e.repeat) {
            const res = updateGarden((g) => ({ g: nextSeed(g), ok: true }));
            sfx.play("tick");
            setTool("seed");
            say(`${CROPS[res.g.seed].icon} ${tx("Semente")}: ${tx(CROPS[res.g.seed].name)}`);
          }
          return;
        }
        if (raw === "escape") {
          stop();
          leaveFarm();
          return;
        }
        if (MOVE[raw]) {
          stop();
          keys.current.add(MOVE[raw]);
        }
        return;
      }
      const s = spotRef.current;
      if (raw === "1" || e.code === "Digit1" || e.code === "Numpad1") {
        // perto de algo: interage
        if (!s) return;
        stop();
        if (!e.repeat) actRef.current(s);
        return;
      }
      if (raw === "w" || raw === "arrowup") {
        stop();
        if (!e.repeat) upAction();
        return;
      }
      if (raw === "s" || raw === "arrowdown") {
        if (s && s.act === "down") {
          stop();
          if (!e.repeat) downAction();
        }
        return;
      }
      const k = { a: "a", d: "d", arrowleft: "a", arrowright: "d" }[raw];
      if (k) {
        stop();
        keys.current.add(k);
        return;
      }
      if (e.key === " " || e.code === "Space") {
        stop();
        if (!e.repeat) jump();
      }
    };
    const onUp = (e) => {
      const raw = (e.key || "").toLowerCase();
      const k = MOVE[raw];
      if (k) keys.current.delete(k);
      if (raw === "5" || e.code === "Digit5" || e.code === "Numpad5") fishApi.current.release();
      if (e.key === " " || e.code === "Space" || raw === "1") reelHold.current = false;
      if (st.current.where !== "farm" && (e.key === " " || e.code === "Space" || raw === "w" || raw === "arrowup") && st.current.vy < 0 && !st.current.swim) st.current.vy *= CUT_JUMP;
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
  }, [setZoom, leaveFarm, say, updateGarden]);

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

    const gridOf = (p) =>
      p.where === "out"
        ? [artRef.current.grids.out, GRID_OUT]
        : p.where === "village"
          ? [artRef.current.villageGrids.village, GRID_VILLAGE]
          : p.where === "shop"
            ? [artRef.current.villageGrids.shop, GRID_SHOP]
            : p.where === "canopy"
              ? [artRef.current.villageGrids.canopy, GRID_CANOPY]
              : [artRef.current.grids.in, GRID_IN];
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
    const boundsOf = (p) => (p.where === "out" ? SCENES[artRef.current.kind].bounds : p.where === "village" ? VILLAGE_BOUNDS : p.where === "shop" ? SHOP_BOUNDS : p.where === "canopy" ? CANOPY_BOUNDS : IN_BOUNDS);

    // horta (vista de cima): anda nas 4 direções e bate na cerca, no poço...
    const farmHits = (x, y) => {
      const pts = [
        [x - FOOT, y - 8],
        [x + FOOT, y - 8],
        [x - FOOT, y - 1],
        [x + FOOT, y - 1]
      ];
      return pts.some(([px0, py0]) => farmSolid(Math.floor(px0 / FT), Math.floor(py0 / FT)));
    };
    const updateFarm = (dt) => {
      const p = st.current;
      let dx = p.busy ? 0 : (keys.current.has("d") ? 1 : 0) - (keys.current.has("a") ? 1 : 0);
      let dy = p.busy ? 0 : (keys.current.has("s") ? 1 : 0) - (keys.current.has("w") ? 1 : 0);
      if (!dx && !dy && !p.busy && (p.analog || p.analogY)) {
        dx = p.analog;
        dy = p.analogY;
      }
      const len = Math.hypot(dx, dy);
      p.moving = len > 0.05;
      if (!p.moving) return;
      const k = (FARM_SPEED * dt * Math.min(1, len)) / len;
      const mx = dx * k;
      const my = dy * k;
      if (Math.abs(dx) >= Math.abs(dy)) {
        p.fdir = dx > 0 ? "right" : "left";
        p.face = dx > 0 ? 1 : -1;
      } else p.fdir = dy > 0 ? "down" : "up";
      if (!farmHits(p.fx + mx, p.fy)) p.fx += mx;
      if (!farmHits(p.fx, p.fy + my)) p.fy += my;
      // saiu pela porteira
      if (p.fy > 14 * FT - 6) leaveFarmRef.current();
    };

    const update = (dt) => {
      const p = st.current;
      if (modalOpen()) keys.current.clear();
      updateNpcs(dt);
      updateFishing(dt);
      if (p.where === "farm") return updateFarm(dt);
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
      if (gaze.current.target === 1 || gaze.current.k > 0.02) {
        keys.current.clear();
        p.buffer = 0;
      }
      if (p.sitting) {
        const wants = keys.current.size > 0 || p.buffer > 0 || p.analog;
        if (!wants) return;
        p.sitting = false;
        setSitting(false);
      }
      // ficou preso dentro de blocos (editados por cima dele): sobe até sair
      if (boxHits(p, p.x, p.y)) {
        let up = 0;
        while (up < 96 && boxHits(p, p.x, p.y - up)) up += 1;
        p.y -= up;
        p.vy = 0;
      }
      const L = p.where === "out" ? artRef.current.lake : null;
      p.swim = Boolean(L && p.x > L.x0 && p.x < L.x1 && p.y > LAKE_SURF + 3);
      let dir = p.busy ? 0 : (keys.current.has("d") ? 1 : 0) - (keys.current.has("a") ? 1 : 0);
      let speed = MAX_SPEED * (p.swim ? SWIM_SPEED : 1);
      if (!dir && !p.busy && p.analog) {
        dir = Math.sign(p.analog);
        speed *= Math.min(1, Math.abs(p.analog));
      }
      const ctl = p.air && !p.swim ? AIR_CONTROL : 1;
      p.vx = dir ? approach(p.vx, dir * speed, ACCEL * ctl * dt) : approach(p.vx, 0, DECEL * ctl * dt);
      if (dir) p.face = dir;

      // anda para os lados (sobe degraus de 1 bloco)
      const dx = p.vx * dt;
      const nx = Math.max(1, Math.ceil(Math.abs(dx)));
      for (let i = 0; i < nx; i++) {
        const tx0 = p.x + dx / nx;
        if (!boxHits(p, tx0, p.y)) {
          p.x = tx0;
          continue;
        }
        // sobe degrau de 1 bloco; nadando perto da margem, sobe até 4 (sai da água)
        let stepped = false;
        const maxStep = p.swim ? TILE * 4 : TILE;
        if (!p.air || p.swim) {
          for (let h = TILE; h <= maxStep; h += TILE) {
            if (!boxHits(p, tx0, p.y - h)) {
              p.x = tx0;
              p.y -= h;
              stepped = true;
              break;
            }
          }
        }
        if (!stepped) {
          p.vx = 0;
          break;
        }
      }
      const [a, b] = boundsOf(p);
      if (p.x < a || p.x > b) {
        p.x = clamp(p.x, a, b);
        p.vx = 0;
      }

      // pulo, nado e gravidade
      const grounded = boxHits(p, p.x, p.y + 0.5);
      p.buffer -= dt;
      p.coyote = grounded ? COYOTE : p.coyote - dt;
      if (p.swim) {
        // na água: afunda devagar; Espaço dá uma braçada para cima
        if (!p.busy && p.buffer > 0) {
          p.vy = -SWIM_STROKE;
          p.buffer = 0;
        }
        p.vy = Math.min(SWIM_SINK, p.vy + GRAVITY * 0.22 * dt);
      } else if (!p.busy && p.buffer > 0 && p.coyote > 0) {
        p.vy = -JUMP_SPEED;
        p.coyote = 0;
        p.buffer = 0;
      }
      if (!grounded || p.vy < 0) {
        if (!p.swim) p.vy += GRAVITY * (p.vy > 0 ? FALL_MULT : 1) * dt;
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
        const door = artRef.current.spots.find((s) => s.id === ({ out: "door", village: "home", shop: "shopexit" }[p.where] || "exit"));
        p.x = door.x + 30;
        p.y = door.y;
        p.vy = 0;
      }
    };

    // partículas: neve, folhas (com vento no outono), pétalas, chuva, vagalumes e poeira
    const particles = (dt, t, cam, cw) => {
      const list = parts.current;
      const { kind: k, season: se } = artRef.current;
      const p = st.current;
      const W = weatherRef.current;
      const isNight = nightRef.current;
      const outdoor = p.where === "out" || p.where === "village" || p.where === "farm";
      const farm = p.where === "farm";
      const { ch } = view.current;
      const max = W.rain ? 420 : 90;
      if (outdoor && list.length < max) {
        if (W.snow && Math.random() < dt * 34) list.push({ type: "snow", x: cam + Math.random() * cw, y: farm ? -view.current.top - 4 : -4 - Math.random() * PAD, vx: -4 + Math.random() * 8, vy: 14 + Math.random() * 12, ph: Math.random() * 6 });
        if (W.rain) {
          for (let k2 = 0; k2 < 7; k2++) {
            list.push({ type: "rain", x: cam + Math.random() * (cw + 60), y: -view.current.top - Math.random() * 30, vx: -50, vy: 300 + Math.random() * 60, ph: 0, life: farm ? ch / 300 + 0.3 : undefined });
          }
        }
        if (W.wind && Math.random() < dt * 9) {
          // vento de folhas atravessando a tela
          list.push({ type: "wind", x: cam - 10, y: (farm ? -view.current.top : 0) + Math.random() * (farm ? ch : 190), vx: 70 + Math.random() * 50, vy: 6 + Math.random() * 10, ph: Math.random() * 6, c: Math.random() < 0.5 ? 2 : 3, life: (cw + 40) / 80 });
        } else if (!farm && (se === "outono" || se === "primavera") && Math.random() < dt * (se === "outono" ? 1.2 : 2.5)) {
          list.push({ type: se === "outono" ? "leaf" : "petal", x: (p.where === "village" ? cam + Math.random() * cw : TX - 420 + Math.random() * 840), y: 30 + Math.random() * 50, vx: -6 + Math.random() * 4, vy: 10 + Math.random() * 8, ph: Math.random() * 6, c: Math.random() < 0.5 ? 2 : 3 });
        }
        if (!farm && isNight && !W.snow && !W.rain && list.filter((q) => q.type === "fly").length < 14 && Math.random() < dt * 4) {
          list.push({ type: "fly", x: cam + Math.random() * cw, y: 120 + Math.random() * 70, vx: 0, vy: 0, ph: Math.random() * 6, life: 8 + Math.random() * 6 });
        }
      }
      const indoor = p.where === "in" || p.where === "shop";
      if (indoor && list.length < 14 && Math.random() < dt * 1.2) {
        list.push({ type: "dust", x: 40 + Math.random() * (IN_W - 80), y: 40 + Math.random() * 160, vx: 2 - Math.random() * 4, vy: -1 - Math.random() * 2, ph: Math.random() * 6, life: 5 + Math.random() * 4 });
      }
      for (let i = list.length - 1; i >= 0; i--) {
        const q = list[i];
        q.ph += dt;
        if (q.type === "fly") {
          q.x += Math.sin(q.ph * 1.3) * 10 * dt;
          q.y += Math.cos(q.ph * 0.9) * 7 * dt;
        } else if (q.type === "dust" || q.type === "rain") {
          q.x += q.vx * dt;
          q.y += q.vy * dt;
        } else if (q.type === "wind") {
          q.x += q.vx * dt;
          q.y += (q.vy + Math.sin(q.ph * 4) * 22) * dt;
        } else {
          q.x += (q.vx + Math.sin(q.ph * 2) * 10) * dt;
          q.y += q.vy * dt;
        }
        if (q.life !== undefined) q.life -= dt;
        const floor = farm ? Infinity : k === "ilha" && p.where === "out" ? VB : GROUND + 3;
        const dead = q.life !== undefined ? q.life <= 0 : q.y > floor;
        const wrong = indoor ? q.type !== "dust" : q.type === "dust";
        if (dead || wrong) {
          // pinguinho de chuva respingando no chão
          if (q.type === "rain" && !farm && q.y > floor && list.length < max + 40) list.push({ type: "splash", x: q.x, y: GROUND - 1, vx: 0, vy: 0, ph: 0, life: 0.15 });
          list.splice(i, 1);
        }
      }
      return list;
    };

    const drawParts = (g, list, ox, t, afterNight, oy = 0) => {
      const P = PAL[artRef.current.season];
      list.forEach((q) => {
        const x = Math.round(q.x + ox);
        const y = Math.round(q.y + oy);
        if (q.type === "fly") {
          if (!afterNight) return;
          if (Math.sin(t * 3 + q.ph * 4) > -0.2) {
            px(g, x, y, "#fff59d");
            px(g, x + 1, y, "#fde047");
          }
          return;
        }
        // chuva por cima de tudo (depois do céu cinza e da noite)
        if ((q.type === "rain" || q.type === "splash") !== afterNight) return;
        if (q.type === "rain") {
          px(g, x, y, "#dbeafe");
          px(g, x, y - 1, "#bfdbfe");
          px(g, x - 1, y - 2, "#93b4d8");
          px(g, x - 1, y - 3, "#93b4d8");
          px(g, x - 1, y - 4, "rgba(147, 180, 216, 0.5)");
        } else if (q.type === "splash") {
          px(g, x - 1, y, "rgba(220, 235, 250, 0.8)");
          px(g, x + 1, y, "rgba(220, 235, 250, 0.8)");
        } else if (q.type === "snow") px(g, x, y, "#ffffff");
        else if (q.type === "dust") px(g, x, y, "rgba(255, 236, 180, 0.7)");
        else if (q.type === "petal") {
          px(g, x, y, P.bloom || "#f9a8d4");
          px(g, x + 1, y, "#fbcfe8");
        } else {
          const col = q.type === "wind" ? ["#c2410c", "#ea580c", "#f59e0b", "#b45309"][Math.floor(q.ph * 3) % 4] : P.leaf[q.c];
          px(g, x, y, col);
          px(g, x + (Math.sin(q.ph * 3) > 0 ? 1 : -1), y, col);
          if (q.type === "wind") {
            px(g, x, y + 1, col);
            px(g, x + 1, y - (Math.sin(q.ph * 5) > 0 ? 1 : 0), col);
          }
        }
      });
    };
    // chuva escurece o céu e o mundo um pouquinho
    const rainTint = (g, cw, ch) => {
      if (!weatherRef.current.rain) return;
      g.save();
      g.globalCompositeOperation = "multiply";
      g.fillStyle = "#b4bccb";
      g.fillRect(-1, -1, cw + 2, ch + 2);
      g.restore();
    };

    // pesca: espera, mordida e o minigame da barra
    const updateFishing = (dt) => {
      const F = fishing.current;
      if (F.phase === "idle") return;
      const p = st.current;
      const now = performance.now() / 1000;
      const end = (msg, sound) => {
        fishing.current = { phase: "idle" };
        reelHold.current = false;
        setFishGame(null);
        if (sound) sfx.play(sound);
        if (msg) say(msg);
      };
      if (p.where !== "out") return end();
      if (F.phase === "charge" || F.phase === "game") keys.current.clear();
      else if (keys.current.size || p.buffer > 0 || p.analog) return end(tx("Você recolheu a linha"));
      if (F.phase === "cast" && now - F.t0 > 0.55) {
        F.phase = "wait";
        F.biteAt = now + 1.4 + Math.random() * 4.6;
      } else if (F.phase === "wait" && now > F.biteAt) {
        F.phase = "bite";
        F.biteUntil = now + 0.95;
        F.fish = pickFish();
        sfx.play("tick");
      } else if (F.phase === "bite" && now > F.biteUntil) {
        end(tx("O peixe escapou..."));
      } else if (F.phase === "game") {
        const d = F.fish.difficulty;
        const size = 0.32 - d * 0.14;
        F.barV = clamp(F.barV + (reelHold.current ? 2.8 : -2.4) * dt, -1.6, 1.6);
        F.barY += F.barV * dt;
        if (F.barY < 0) {
          F.barY = 0;
          F.barV *= -0.35;
        }
        if (F.barY > 1 - size) {
          F.barY = 1 - size;
          F.barV = 0;
        }
        if (now > F.nextT) {
          F.target = Math.random();
          F.nextT = now + (1.3 - d * 0.9) * (0.5 + Math.random());
        }
        if (Math.random() < dt * d * 1.6) F.target = Math.random();
        F.fishY = clamp(F.fishY + (F.target - F.fishY) * Math.min(1, dt * (1 + d * 5)), 0, 1);
        const inside = F.fishY >= F.barY - 0.02 && F.fishY <= F.barY + size + 0.02;
        F.progress += (inside ? 0.3 : -(0.16 + d * 0.16)) * dt;
        const E = fishEls.current;
        if (E.bar) {
          E.bar.style.bottom = `${(F.barY * 100).toFixed(1)}%`;
          E.bar.style.height = `${(size * 100).toFixed(1)}%`;
          E.bar.classList.toggle("in", inside);
        }
        if (E.fish) E.fish.style.bottom = `calc(${(F.fishY * 100).toFixed(1)}% - 11px)`;
        if (E.prog) E.prog.style.height = `${(clamp(F.progress, 0, 1) * 100).toFixed(1)}%`;
        if (F.progress >= 1) {
          const fish = F.fish;
          const r = updateGarden((g) => addFish(g, fish.id));
          end(r.ok ? `${fish.icon} ${tx("Pescou")}: ${tx(fish.name)} (${tx(fish.rarity)})!` : tx(r.msg), r.ok ? "save" : null);
        } else if (F.progress <= 0) end(tx("O peixe fugiu!"), "close");
      }
    };

    // moradores da vila: andam de um lado para o outro e param para conversar
    const updateNpcs = (dt) => {
      const p = st.current;
      if (p.where !== "village") return;
      const talking = bubbleRef.current && bubbleRef.current.until > Date.now() ? bubbleRef.current.npc : null;
      const changes = {};
      NPCS.forEach((n) => {
        const s = npcState.current[n.id];
        let moving = false;
        if (talking === n.id) {
          s.dir = p.x < s.x ? -1 : 1;
        } else if (s.wait > 0) s.wait -= dt;
        else {
          s.x += s.dir * n.speed * dt;
          moving = true;
          if (s.x < n.x0 || s.x > n.x1) {
            s.x = clamp(s.x, n.x0, n.x1);
            s.dir *= -1;
            s.wait = 1 + Math.random() * 2.5;
          } else if (Math.random() < dt * 0.15) s.wait = 1 + Math.random() * 2;
        }
        if (s.moving !== moving || s.lastDir !== s.dir) {
          s.moving = moving;
          s.lastDir = s.dir;
          changes[n.id] = { walk: moving, left: s.dir < 0 };
        }
      });
      if (Object.keys(changes).length) setNpcPose((o) => ({ ...o, ...changes }));
    };

    // sapinho: fica numa vitória-régia, coaxa e pula para outra de vez em quando
    const updateFrog = (t, L) => {
      const f = frog.current;
      if (!L) return null;
      if (f.jump) {
        const k = Math.min(1, (t - f.jump.t0) / f.jump.dur);
        f.x = f.jump.x0 + (f.jump.x1 - f.jump.x0) * k;
        f.y = LAKE_SURF - 2 - Math.sin(Math.PI * k) * 22;
        f.air = true;
        if (k >= 1) {
          f.jump = null;
          f.air = false;
          f.pad = f.jump_to;
          f.next = t + 3 + Math.random() * 5;
        }
      } else {
        f.x = lilyX(L, f.pad);
        f.y = LAKE_SURF - 2;
        if (f.next < 1) f.next = t + 2;
        f.croak = Math.sin(t * 9) > 0 && (t % 6) < 0.8;
        if (t > f.next) {
          let to = f.pad;
          while (to === f.pad) to = Math.floor(Math.random() * LILIES.length);
          f.jump_to = to;
          f.jump = { t0: t, dur: 0.75, x0: f.x, x1: lilyX(L, to) };
        }
      }
      return f;
    };

    const render = (t) => {
      const canvas = canvasRef.current;
      const front = frontRef.current;
      if (!canvas || !front) return;
      const g = canvas.getContext("2d");
      const gf = front.getContext("2d");
      g.imageSmoothingEnabled = false;
      gf.imageSmoothingEnabled = false;
      const v = view.current;
      const { cw, ch } = v;
      const p = st.current;
      const where0 = p.where;
      const moving = where0 === "farm" ? p.moving : Math.abs(p.vx) > 5 || Math.abs(p.vy) > 5;
      // andou: a vista volta devagar para o herói
      if (cineRef.current && v.cinePan !== cineRef.current.id) {
        // começa olhando um pouco para o lado e para o céu
        v.cinePan = cineRef.current.id;
        v.panX = -Math.min(160, v.cw * 0.35);
        v.panY = -Math.min(28, v.ch * 0.1);
      }
      if (cineRef.current) {
        v.panX *= 0.985;
        v.panY *= 0.985;
      }
      if (moving) {
        v.panX *= 0.9;
        v.panY *= 0.9;
        if (Math.abs(v.panX) < 0.5) v.panX = 0;
        if (Math.abs(v.panY) < 0.5) v.panY = 0;
      }
      const T = camRef.current.camBase(p, v);
      const want = camRef.current.camClamp(p, v, T.cam + v.panX, T.top - v.panY);
      if (v.snap) {
        v.cam = want.cam;
        v.top = want.top;
        v.snap = false;
      } else {
        v.cam += (want.cam - v.cam) * 0.16;
        v.top += (want.top - v.top) * 0.16;
      }
      // olhar as estrelas: a câmera sobe devagar para o céu
      const gz = gaze.current;
      gz.k = gz.target ? Math.min(1, gz.k + 0.006) : Math.max(0, gz.k - 0.012);
      const ease = gz.k * gz.k * (3 - 2 * gz.k);
      const cam = Math.round(v.cam);
      const top = Math.round(v.top + ease * ch * 1.3);
      const ox = -cam;
      const isNight = nightRef.current;
      const L = artRef.current.layers;
      gf.clearRect(0, 0, cw, ch);

      if (where0 === "farm") {
        renderFarm(g, gf, cam, top, t, isNight);
        const list = particles(1 / 60, t, cam, cw);
        rainTint(g, cw, ch);
        drawParts(gf, list, ox, t, false, top);
      } else {
        const list = particles(1 / 60, t, cam, cw);
        const out = where0 === "out";
        const outdoor = out || where0 === "village" || where0 === "canopy";
        if (outdoor) {
          drawSky(g, cw, isNight, t, VH + top);
          rect(g, 0, VH + top, cw, ch, "#5e3a1d");
        } else rect(g, 0, 0, cw, ch, "#24150a");
        g.save();
        g.translate(0, top);
        const V = artRef.current.villageArt;
        const raining = weatherRef.current.rain;
        if (L && out) {
          drawClouds(g, cw, cam, isNight, t);
          if (L.far) g.drawImage(L.far, Math.round(-900 - cam * FAR), -PAD);
          if (L.mid) g.drawImage(L.mid, Math.round(-900 - cam * MID), -PAD);
          g.drawImage(L.world, ox, -PAD);
          // peixes no lago (a água da frente passa por cima deles)
          const lk = artRef.current.lake;
          if (lk) {
            if (fishRef.current.key !== artRef.current.kind) fishRef.current = { key: artRef.current.kind, list: makeFish(lk, Math.round((lk.x1 - lk.x0) / 70)) };
            updateFish(fishRef.current.list, lk, 1 / 60, t);
            drawFish(g, ox, fishRef.current.list);
          }
          if (artRef.current.kind === "praia") drawWaves(g, ox, t);
          const now = Date.now();
          const tiles = gardenRef.current.tiles;
          const slots = [...tiles.slice(0, 6), ...tiles.slice(24, 30)].map((b) => (b ? { crop: b.crop, stage: stageOf(b), wet: isWet(b, now, raining) } : null));
          drawGardenPlants(g, ox, slots, t);
          drawParts(g, list, ox, t, false);
          rainTint(g, cw, ch);
          if (isNight) drawNight(g, cw, L.worldLights, ox, false, top);
        } else if (where0 === "village") {
          drawClouds(g, cw, cam, isNight, t);
          g.drawImage(V.far, Math.round(-900 - cam * FAR), -PAD);
          g.drawImage(V.mid, Math.round(-900 - cam * MID), -PAD);
          g.drawImage(skinImg(EXTRA_SCENES.vila) || V.world, ox, -PAD);
          drawParts(g, list, ox, t, false);
          rainTint(g, cw, ch);
          if (isNight) drawNight(g, cw, V.lights, ox, false, top);
        } else if (where0 === "canopy") {
          const C = artRef.current.canopyArt;
          drawClouds(g, cw, cam, isNight, t);
          // lá de cima a floresta fica bem lá embaixo
          if (L && L.far) g.drawImage(L.far, Math.round(-900 - cam * FAR * 0.5), -PAD + 120);
          g.drawImage(skinImg(EXTRA_SCENES.copa) || C.c, ox, -PAD);
          drawParts(g, list, ox, t, false);
          rainTint(g, cw, ch);
          if (isNight) drawNight(g, cw, C.lights, ox, false, top);
        } else if (where0 === "shop") {
          g.drawImage(skinImg(EXTRA_SCENES.loja) || V.shop, ox, 0);
          drawParts(g, list, ox, t, false);
          if (isNight) drawNight(g, cw, V.shopLights, ox, true, top);
        } else if (L) {
          g.drawImage(L.house, ox, 0);
          drawRoomWindow(g, L.win, ox, isNight, t);
          drawPendulum(g, ox, t);
          drawParts(g, list, ox, t, false);
          if (isNight) drawNight(g, cw, L.houseLights, ox, true, top);
        }
        drawParts(g, list, ox, t, true);
        g.restore();
        // por cima do herói: a água do lago, as vitórias-régias e o sapo
        const lake = out ? artRef.current.lake : null;
        if (lake) {
          gf.save();
          gf.translate(0, top);
          drawLakeFront(gf, ox, lake, t, updateFrog(t, lake), isNight);
          const F = fishing.current;
          if (F.phase !== "idle") {
            const face = p.face || 1;
            const hx2 = Math.round(p.x) + ox;
            const hy2 = Math.round(p.y);
            const tipX = hx2 + face * 20;
            const tipY = hy2 - 46;
            for (let k = 0; k < 24; k++) px(gf, hx2 + face * Math.round(3 + k * 0.72), hy2 - 21 - k, k < 6 ? "#5a3820" : "#a8743e");
            if (F.phase === "charge") {
              const pw = 0.5 - 0.5 * Math.cos((t - F.t0) * 3.4);
              rect(gf, hx2 - face * 18 - 2, hy2 - 54, 5, 28, "#1f130a");
              rect(gf, hx2 - face * 18 - 1, hy2 - 27 - Math.round(pw * 26), 3, Math.round(pw * 26), pw > 0.72 ? "#22c55e" : pw > 0.4 ? "#facc15" : "#ef4444");
            } else {
              let bx = F.bx + ox;
              let by = LAKE_SURF - 1;
              if (F.phase === "cast") {
                const k = Math.min(1, (t - F.t0) / 0.55);
                bx = tipX + (F.bx + ox - tipX) * k;
                by = tipY + (LAKE_SURF - 1 - tipY) * k - Math.sin(Math.PI * k) * 42;
              } else if (F.phase === "bite" || F.phase === "game") by += Math.sin(t * 25) > 0 ? 2 : 0;
              else by += Math.sin(t * 2) > 0.6 ? 1 : 0;
              for (let k = 0; k <= 48; k++) {
                const f = k / 48;
                px(gf, tipX + (bx - tipX) * f, tipY + (by - tipY) * f + Math.sin(Math.PI * f) * (F.phase === "game" ? 2 : 9), "rgba(240, 240, 240, 0.75)");
              }
              rect(gf, bx - 1, by - 2, 3, 2, "#ef4444");
              rect(gf, bx - 1, by, 3, 1, "#ffffff");
              if (F.phase === "bite") {
                rect(gf, hx2 - 3, hy2 - 76, 7, 12, "#1f130a");
                rect(gf, hx2 - 2, hy2 - 75, 5, 8, "#facc15");
                rect(gf, hx2 - 3, hy2 - 62, 7, 6, "#1f130a");
                rect(gf, hx2 - 2, hy2 - 61, 5, 4, "#facc15");
              }
            }
          }
          // pingos de chuva fazendo rodinhas no lago
          if (raining) {
            for (let k = 0; k < 6; k++) {
              const rx = lake.x0 + ((Math.floor(t * 7) * 53 + k * 97) % (lake.x1 - lake.x0));
              px(gf, rx + ox - 1, LAKE_SURF, "#e0f2fe");
              px(gf, rx + ox + 1, LAKE_SURF, "#e0f2fe");
            }
          }
          gf.restore();
        }
        // balcão da loja na frente do vendedor
        if (where0 === "shop") gf.drawImage(skinImg(EXTRA_SCENES.balcao) || V.shopFront, ox, top);
      }

      // céu estrelado por cima de tudo
      if (ease > 0.01) drawStarSky(gf, cw, ch, t, Math.min(1, ease * 1.15));

      // luz do cenário nos personagens: perto de tocha, poste, janela ou lustre fica mais claro
      const sceneLights =
        !isNight || !L
          ? null
          : where0 === "out"
            ? L.worldLights
            : where0 === "in"
              ? L.houseLights
              : where0 === "village"
                ? artRef.current.villageArt.lights
                : where0 === "shop"
                  ? artRef.current.villageArt.shopLights
                  : where0 === "canopy"
                    ? artRef.current.canopyArt.lights
                    : null;
      const litAt = (x, y) => {
        if (!sceneLights) return 0;
        let best = 0;
        sceneLights.forEach((l) => {
          const lx = l.w ? l.x + l.w / 2 : l.x;
          const ly = l.h ? l.y + l.h / 2 : l.y;
          const R = (l.glow || 20) * 2.3 + 12;
          const d = Math.hypot(lx - x, ly - y);
          if (d < R) best = Math.max(best, (1 - d / R) ** 1.2 * (l.w ? 0.75 : 1));
        });
        return Math.min(1, best);
      };

      // moradores e vendedor (HTML) + balão de fala
      const V2 = artRef.current.villageArt;
      void V2;
      NPCS.forEach((n) => {
        const el = npcRefs.current[n.id];
        if (!el) return;
        const ns = npcState.current[n.id];
        el.style.transform = `translate(${((Math.round(ns.x) + ox) * v.s).toFixed(1)}px, ${((GROUND + top) * v.s).toFixed(1)}px)`;
        el.style.setProperty("--pw-lit", litAt(ns.x, GROUND - 20).toFixed(2));
      });
      const vEl = npcRefs.current[VENDOR.id];
      if (vEl) {
        vEl.style.transform = `translate(${((VENDOR.x + ox) * v.s).toFixed(1)}px, ${((FLOOR1_SHOP + top) * v.s).toFixed(1)}px)`;
        vEl.style.setProperty("--pw-lit", litAt(VENDOR.x, FLOOR1_SHOP - 20).toFixed(2));
      }
      const bub = bubbleRef.current;
      const bEl = document.querySelector(".pw-wrap .pw-bubble");
      if (bub && bEl) {
        const bx = bub.npc === VENDOR.id ? VENDOR.x : npcState.current[bub.npc] ? npcState.current[bub.npc].x : 0;
        const byy = bub.npc === VENDOR.id ? FLOOR1_SHOP : GROUND;
        bEl.style.transform = `translate(${((bx + ox) * v.s).toFixed(1)}px, ${((byy - 62 + top) * v.s).toFixed(1)}px)`;
      }

      // herói (HTML por cima)
      const heroEl = heroRef.current;
      const hx = where0 === "farm" ? p.fx : p.x;
      const hy = where0 === "farm" ? p.fy : p.y;
      if (heroEl) {
        heroEl.style.transform = `translate(${((Math.round(hx) + ox) * v.s).toFixed(1)}px, ${((Math.round(hy) + top) * v.s).toFixed(1)}px)`;
        const sp = where0 === "farm" ? (p.moving ? 1 : 0) : Math.min(1, Math.abs(p.vx) / MAX_SPEED);
        heroEl.style.setProperty("--walk-dur", `${(0.5 - sp * 0.16).toFixed(3)}s`);
        heroEl.classList.toggle("swimming", Boolean(p.swim));
        heroEl.classList.toggle("sitting", Boolean(p.sitting));
        heroEl.style.setProperty("--pw-lit", where0 === "farm" ? "0" : litAt(hx, hy - 20).toFixed(2));
        heroEl.style.opacity = String(Math.max(0, 1 - ease * 1.4));
      }
      const nextPose =
        where0 === "farm" ? (p.moving ? "walk" : "idle") : p.climb ? "climb" : p.swim ? "walk" : p.air ? "jump" : Math.abs(p.vx) > 6 ? "walk" : "idle";
      if (nextPose !== p.pose) {
        p.pose = nextPose;
        setPose(nextPose);
      }
      setFacing((f) => (f === p.face ? f : p.face));

      // o que dá para usar aqui
      const s =
        where0 === "farm" || p.busy || p.climb || p.air || gz.k > 0.02
          ? null
          : artRef.current.spots.find((q) => q.where === p.where && Math.abs(p.x - q.x) < q.w / 2 + 6 && Math.abs(p.y - q.y) < 6) || npcSpotNear(p);
      if (s !== spotRef.current) {
        spotRef.current = s;
        setSpot(s);
      }
      const pr = promptRef.current;
      if (pr && s) pr.style.transform = `translate(${((s.x + ox) * v.s).toFixed(1)}px, ${((s.y - 66 + top) * v.s).toFixed(1)}px)`;
    };

    // morador perto (para conversar com o 1)
    const npcSpots = Object.fromEntries(NPCS.map((n) => [n.id, { id: `npc:${n.id}`, where: "village", x: 0, y: GROUND, w: 30, label: `Conversar com ${n.name}`, act: "talk", npc: n }]));
    const npcSpotNear = (p) => {
      if (p.where !== "village" || Math.abs(p.y - GROUND) > 6) return null;
      let best = null;
      NPCS.forEach((n) => {
        const ns = npcState.current[n.id];
        const d = Math.abs(ns.x - p.x);
        if (d < 22 && (!best || d < best.d)) best = { d, s: npcSpots[n.id], x: ns.x };
      });
      if (!best) return null;
      best.s.x = best.x;
      return best.s;
    };

    // a horta vista de cima
    const renderFarm = (g, gf, cam, top, t, isNight) => {
      const { cw, ch } = view.current;
      const p = st.current;
      const ox = -cam;
      rect(g, 0, 0, cw, ch, "#4f8a3a");
      g.drawImage(skinImg(EXTRA_SCENES.horta) || artRef.current.farmArt, ox, top);
      const now = Date.now();
      const tiles = gardenRef.current.tiles;
      const heroRow = Math.floor((p.fy - 4) / FT);
      tiles.forEach((tile, i) => {
        if (!tile) return;
        const { c, r } = tileOfIndex(i);
        const x = c * FT + ox;
        const y = r * FT + top;
        if (x < -FT || x > cw || y < -FT * 2 || y > ch) return;
        drawSoilState(g, x, y, tile, now, t, weatherRef.current.rain);
        // plantas mais embaixo que o herói ficam na frente dele
        drawCrop(r > heroRow ? gf : g, x, y, tile, t);
      });
      // quadradinho alvo
      const c = Math.floor(p.fx / FT);
      const r = Math.floor((p.fy - 4) / FT);
      const [dx, dy] = FACE[p.fdir] || FACE.down;
      const tc = c + dx;
      const tr = r + dy;
      const x = tc * FT + ox;
      const y = tr * FT + top;
      const ok = bedIndex(tc, tr) >= 0 || isWell(tc, tr) || isGate(tc, tr);
      const col = ok ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.35)";
      [
        [x, y, 6, 2],
        [x, y, 2, 6],
        [x + FT - 6, y, 6, 2],
        [x + FT - 2, y, 2, 6],
        [x, y + FT - 2, 6, 2],
        [x, y + FT - 6, 2, 6],
        [x + FT - 6, y + FT - 2, 6, 2],
        [x + FT - 2, y + FT - 6, 2, 6]
      ].forEach(([a, b, w, h]) => rect(gf, a, b, w, h, col));
      // quadradinho embaixo do mouse (até 3 de distância): amarelo
      const ht = hoverTile.current;
      if (ht && farmInReach(ht.c, ht.r, p) && (ht.c !== tc || ht.r !== tr)) {
        const hx = ht.c * FT + ox;
        const hy = ht.r * FT + top;
        if (bedIndex(ht.c, ht.r) >= 0 || isWell(ht.c, ht.r)) {
          gf.fillStyle = "rgba(253, 224, 71, 0.16)";
          gf.fillRect(hx + 1, hy + 1, FT - 2, FT - 2);
          [[hx, hy, FT, 1], [hx, hy + FT - 1, FT, 1], [hx, hy, 1, FT], [hx + FT - 1, hy, 1, FT]].forEach(([a, b, w, h]) => rect(gf, a, b, w, h, "rgba(253, 224, 71, 0.85)"));
        }
      }
      // gotinhas da rega
      const tNow = performance.now() / 1000;
      splashes.current = splashes.current.filter((d) => tNow - d.t0 < 0.5);
      splashes.current.forEach((d) => {
        const k = tNow - d.t0;
        px(gf, d.x + d.vx * k + ox, d.y + d.vy * k + 60 * k * k + top, "#93c5fd");
      });
      if (isNight) {
        g.save();
        g.globalCompositeOperation = "multiply";
        g.fillStyle = "#5866a8";
        g.fillRect(0, 0, cw, ch);
        g.restore();
        gf.save();
        gf.globalCompositeOperation = "source-atop";
        gf.fillStyle = "rgba(30, 40, 90, 0.45)";
        gf.fillRect(0, 0, cw, ch);
        gf.restore();
      }
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
    return () => cancelAnimationFrame(raf);
  }, []);
  const leaveFarmRef = useRef(leaveFarm);
  leaveFarmRef.current = leaveFarm;

  const inFarm = where === "farm";
  const HINTS = {
    out: "Vá até a porta da árvore para entrar em casa (a vila fica no fim do caminho, à esquerda)",
    in: "Explore a casa: baú, relógio, estante, cama e varanda",
    village: "Converse com os moradores (1) e visite a lojinha na árvore",
    shop: "Fale com o Seu Bartolomeu no balcão para vender e comprar",
    canopy: "No topo da copa: sente no banco ou deite na toalha para olhar as estrelas"
  };
  const hint = spot || inFarm ? null : tx(HINTS[where] || HINTS.out);
  const keyFor = (s) => (UPISH.includes(s.act) ? "1 / ↑" : s.act === "down" ? "1 / ↓" : "1");
  const seedCrop = CROPS[garden.seed] || CROPS.cenoura;

  return (
    <div ref={wrapRef} className={`pw-wrap ${night ? "is-night" : ""} ${dragging ? "dragging" : ""} ${inFarm ? "in-farm" : ""}`} onPointerDown={(e) => e.stopPropagation()}>
      <canvas ref={canvasRef} className="pw-canvas" />

      {where === "village" &&
        NPCS.map((n) => (
          <div key={n.id} ref={(el) => (npcRefs.current[n.id] = el)} className={`pw-hero pw-npc ${night ? "night" : ""}`}>
            <HeroModel hero={n.hero} cls={n.hero.cls} skinPath={npcSkinPath(n.id)} pose={npcPose[n.id] && npcPose[n.id].walk ? "walk" : null} flip={Boolean(npcPose[n.id] && npcPose[n.id].left)} />
            <span className="pw-npc-name">{n.name}</span>
          </div>
        ))}
      {where === "shop" && (
        <div ref={(el) => (npcRefs.current[VENDOR.id] = el)} className={`pw-hero pw-npc ${night ? "night inside" : ""}`}>
          <HeroModel hero={VENDOR.hero} cls={VENDOR.hero.cls} skinPath={npcSkinPath(VENDOR.id)} flip />
          <span className="pw-npc-name">{VENDOR.name}</span>
        </div>
      )}

      <div ref={heroRef} className={`pw-hero ${night ? "night" : ""} ${where === "in" || where === "shop" ? "inside" : ""}`}>
        <HeroModel hero={hero} pose={pose === "climb" ? "walk" : pose === "idle" ? null : pose} flip={facing < 0} />
      </div>

      <canvas ref={frontRef} className="pw-canvas pw-front" />

      {spot && !(bubble && spot.npc && spot.npc.id === bubble.npc) && (
        <button ref={promptRef} type="button" className="pw-prompt" onClick={() => act(spot)}>
          <kbd>{keyFor(spot)}</kbd>
          {spot.act === "sit" && sitting ? tx("Levantar") : tx(spot.label)}
        </button>
      )}

      {hint && hintOn && !cine && !IS_TOUCH && !gazing && (
        <div className="pw-hint">
          <span>{hint}</span>
          <span className="pw-keys">
            <kbd>A</kbd>
            <kbd>D</kbd> {tx("andar")} · <kbd>{tx("Espaço")}</kbd> {tx("pular/nadar")} · <kbd>1</kbd> {tx("interagir")} · <kbd>4</kbd> {tx("inventário")} · <kbd>5</kbd> {tx("pescar")} · <kbd>6</kbd> {tx("orbe")} · {tx("arraste com o mouse")} · <kbd>+</kbd>
            <kbd>−</kbd> {tx("zoom")} · <kbd>L</kbd> {tx("cenário")}
          </span>
        </div>
      )}

      {inFarm && (
        <>
          <div className="pw-farm-top">
            <b>🌾 {tx("Horta")}</b>
            <span>🪙 {garden.coins}</span>
            {CROP_IDS.filter((id) => countItem(garden, `crop:${id}`) > 0).map((id) => (
              <span key={id}>
                {CROPS[id].icon} {countItem(garden, `crop:${id}`)}
              </span>
            ))}
          </div>
          {!IS_TOUCH && hintOn && (
            <div className="pw-hint pw-farm-hint">
              <span className="pw-keys">
                <kbd>W</kbd>
                <kbd>A</kbd>
                <kbd>S</kbd>
                <kbd>D</kbd> {tx("andar")} · <kbd>1</kbd> {tx("colher")} · <kbd>2</kbd> {tx("plantar")} · <kbd>3</kbd> {tx("regar / encher no poço")} · <kbd>Q</kbd> {tx("trocar semente")} · <kbd>4</kbd> {tx("inventário")} · <kbd>Esc</kbd> {tx("sair")}
              </span>
            </div>
          )}
          <div className="pw-hotbar" onPointerDown={(e) => e.stopPropagation()}>
            {TOOLS.map((tl) => (
              <button
                key={tl.id}
                type="button"
                className={`pw-slot ${tool === tl.id ? "on" : ""}`}
                onClick={() => {
                  if (tl.id === "seed" && tool === "seed") {
                    updateGarden((g) => ({ g: nextSeed(g), ok: true }));
                    sfx.play("tick");
                  }
                  setTool(tl.id);
                }}
                title={tl.id === "seed" ? tx("Clique de novo para trocar a semente") : tx(tl.label)}
              >
                <kbd>{tl.key}</kbd>
                {tl.id === "seed" ? (
                  <ItemIcon id={`seed:${seedCrop.id}`} fallback={<span className="pw-slot-icon">{seedCrop.icon}</span>} />
                ) : tl.id === "can" ? (
                  <ItemIcon id="can" fallback={<CanIcon />} />
                ) : null}
                <small>{tl.id === "seed" ? tx(seedCrop.name) : tx(tl.label)}</small>
                {tl.id === "seed" && <span className="pw-slot-count">{countItem(garden, `seed:${garden.seed}`)}</span>}
                {tl.id === "can" && (
                  <span className="pw-can">
                    <span style={{ width: `${(garden.can / CAN_MAX) * 100}%` }} />
                  </span>
                )}
              </button>
            ))}
            <button type="button" className="pw-slot" onClick={() => setInvOpen(true)} title={tx("Inventário (4)")}>
              <kbd>4</kbd>
              <small>{tx("Inventário")}</small>
            </button>
          </div>
        </>
      )}

      {bubble && <div className="pw-bubble">{tx(bubble.text)}</div>}
      {fishGame && (
        <div
          className="pw-fishgame"
          onPointerDown={(e) => {
            e.stopPropagation();
            reelHold.current = true;
          }}
          onPointerUp={() => (reelHold.current = false)}
          onPointerLeave={() => (reelHold.current = false)}
        >
          <div className="pw-fg-frame">
            <div className="pw-fg-water">
              <div ref={(el) => (fishEls.current.bar = el)} className="pw-fg-bar" />
              <div ref={(el) => (fishEls.current.fish = el)} className="pw-fg-fish">
                <ItemIcon id={`fish:${fishGame.fish.id}`} fallback={fishGame.fish.icon} />
              </div>
            </div>
            <div className="pw-fg-prog">
              <div ref={(el) => (fishEls.current.prog = el)} />
            </div>
          </div>
          <b style={{ color: fishGame.fish.color }}>{tx(fishGame.fish.rarity)}</b>
          <small>{tx("Segure 5, Espaço ou o mouse")}</small>
        </div>
      )}
      {orbFlash > 0 && <div key={orbFlash} className="pw-orbflash" />}
      {cine && (
        <div key={cine.id} className="pw-cine" onPointerDown={(e) => { e.stopPropagation(); setCine(null); }}>
          <div className="pw-cine-bar top" />
          <div className="pw-cine-text">
            <small>✦ ✦ ✦</small>
            <h2>{tx(cine.title)}</h2>
            <p>{tx(cine.sub)}</p>
          </div>
          <div className="pw-cine-bar bottom" />
        </div>
      )}
      {gazing && (
        <button
          type="button"
          className="pw-gaze-caption"
          onClick={() => {
            gaze.current.target = 0;
            setGazing(false);
          }}
        >
          {tx("Olhando as estrelas")} · <kbd>1</kbd> / <kbd>Esc</kbd> {tx("para voltar")}
        </button>
      )}
      {toast && <div className="pw-toast">{toast}</div>}
      {invOpen && <InventoryPanel garden={garden} hero={hero} update={updateGarden} onClose={() => setInvOpen(false)} />}
      {shopOpen && <ShopPanel garden={garden} update={updateGarden} onClose={() => setShopOpen(false)} />}
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
          <p className="pw-sub">{tx("Clima agora")}</p>
          <p className="pw-weather">
            {tx(WEATHER_TEXT(weather))} · {tx("muda às")} {new Date(weather.until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="pw-sub">{tx("Zoom")}</p>
          <div className="pw-chips">
            {[0.75, 1, 1.5, 2, 3, 4].map((z) => (
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
          <p className="pw-tip">{tx("Arraste a tela com o mouse para olhar em volta (duplo clique volta). Dormir na cama troca entre dia e noite.")}</p>
        </div>
      )}

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
            st.current.analogY = 0;
          }}
        >
          🕹️
        </button>
      )}
      {IS_TOUCH && (
        <button type="button" className="pw-joy-toggle pw-bag-btn" title={tx("Inventário")} onClick={() => setInvOpen(true)}>
          4
        </button>
      )}
      {IS_TOUCH && !joy && (
        <TouchPad
          full
          buttons={
            inFarm
              ? [
                  { k: "1", code: "Digit1", label: "1" },
                  { k: "2", code: "Digit2", label: "2" },
                  { k: "3", code: "Digit3", label: "3" }
                ]
              : [
                  { k: "1", code: "Digit1", label: "1" },
                  { k: "5", code: "Digit5", label: "5" },
                  { k: "6", code: "Digit6", label: "6" },
                  { k: " ", label: "⤒", big: true }
                ]
          }
        />
      )}
      {IS_TOUCH && joy && (
        <Joystick
          farm={inFarm}
          onAxis={(x, y) => {
            st.current.analog = x;
            st.current.analogY = inFarm ? y : 0;
          }}
          onUp={() => !inFarm && upAction()}
          onDown={() => !inFarm && downAction()}
          buttons={
            inFarm
              ? [
                  { label: "1", ready: true, press: () => farmKeyRef.current("hand") },
                  { label: "2", ready: true, press: () => farmKeyRef.current("seed") },
                  { label: "3", ready: true, press: () => farmKeyRef.current("can") }
                ]
              : [
                  { label: "1", ready: Boolean(spot), press: press1 },
                  { label: "5", ready: true, press: () => (fishing.current.phase === "game" ? (reelHold.current = true) : fishApi.current.press()), release: () => fishApi.current.release() },
                  { label: "6", ready: Boolean(garden.ring), press: () => useOrbRef.current() },
                  { label: "⤒", big: true, ready: true, press: () => (fishing.current.phase === "game" ? (reelHold.current = true) : jump()), release: () => (reelHold.current = false) }
                ]
          }
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

/* ---------- ícone de item: skin da pasta (itens/...) ou o emoji/desenho ---------- */
function ItemIcon({ id, cls, fallback, className = "" }) {
  const path = itemSkinPath(id, cls);
  if (hasSkin(path)) return <img className={`pw-item-img ${className}`} src={skinUrl(path)} alt="" draggable={false} />;
  return fallback;
}

/* ---------- regador em pixel art (não existe emoji de regador) ---------- */
function CanIcon() {
  const P = CAN_PIXELS;
  const col = CAN_COLORS;
  return (
    <svg className="pw-can-icon" viewBox="0 0 12 9" shapeRendering="crispEdges" aria-hidden="true">
      {P.flatMap((row, y) => [...row].map((ch, x) => (col[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={col[ch]} /> : null)))}
      <rect x="11" y="6" width="1" height="1" fill="#60a5fa" />
      <rect x="11" y="8" width="1" height="1" fill="#93c5fd" />
    </svg>
  );
}

/* ---------- janelas: inventário e lojinha ---------- */
function usePanelKeys(keysToClose, onClose) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    const onKey = (e) => {
      const k = (e.key || "").toLowerCase();
      if (document.querySelector(".ui-dialog-backdrop")) return;
      if (!keysToClose.includes(k) && !(k === "escape")) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      sfx.play("close");
      ref.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function InventoryPanel({ garden, hero, update, onClose }) {
  useLanguage();
  usePanelKeys(["4", "i"], onClose);
  const [sel, setSel] = useState("tool:weapon");
  const dragFrom = useRef(null);
  const heroClass = classFor(hero, hero.cls);
  const ringOrb = garden.ring ? ORBS[garden.ring] : null;
  // espaços fixos: arma da classe, regador, vara de pesca e anel (com orbe)
  const TOOLS_FIXED = [
    { id: "weapon", name: heroClass.itemName || "Arma", icon: <ItemIcon id="weapon" cls={hero.cls} fallback={<span className="pw-inv-icon">{WEAPON_ICON[hero.cls] || "🗡️"}</span>} /> },
    { id: "can", name: "Regador", icon: <ItemIcon id="can" fallback={<CanIcon />} />, n: `${garden.can}/${CAN_MAX}` },
    { id: "rod", name: "Vara de pesca", icon: <ItemIcon id="rod" fallback={<span className="pw-inv-icon">🎣</span>} /> },
    {
      id: "ring",
      name: "Anel",
      icon: <ItemIcon id={ringOrb ? `orb:${ringOrb.id}` : "ring"} fallback={<span className="pw-inv-icon">{ringOrb ? ringOrb.icon : "💍"}</span>} />
    }
  ];
  const isTool = String(sel).startsWith("tool:");
  const toolId = isTool ? sel.slice(5) : null;
  const slot = isTool ? null : garden.inv[sel];
  const info = slot ? itemInfo(slot.id) : null;

  return (
    <div className="pw-inv" onPointerDown={(e) => e.stopPropagation()}>
      <div className="pw-inv-box">
        <div className="pw-panel-head">
          <strong>{tx("Inventário")}</strong>
          <span className="pw-coins">🪙 {garden.coins}</span>
          <button type="button" onClick={onClose} title={tx("Fechar (4 / Esc)")}>
            ✕
          </button>
        </div>
        <div className="pw-inv-main">
          <div className="pw-inv-hero">
            <div className="pw-inv-hero-stage">
              <HeroModel hero={hero} cls={hero.cls} />
            </div>
            <b>{tx(heroClass.name)}</b>
            <div className="pw-inv-tools">
              {TOOLS_FIXED.map((t) => (
                <button key={t.id} type="button" className={`pw-inv-slot tool ${sel === `tool:${t.id}` ? "on" : ""}`} title={tx(t.name)} onClick={() => setSel(`tool:${t.id}`)}>
                  {t.icon}
                  {t.id === "ring" && ringOrb && <span className="pw-inv-key">6</span>}
                  {t.id === "rod" && <span className="pw-inv-key">5</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="pw-inv-grid">
            {garden.inv.slice(0, INV_SIZE).map((s, i) => {
              const it = s ? itemInfo(s.id) : null;
              return (
                <button
                  key={i}
                  type="button"
                  className={`pw-inv-slot ${sel === i ? "on" : ""}`}
                  draggable={Boolean(it)}
                  onDragStart={() => (dragFrom.current = i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    const from = dragFrom.current;
                    dragFrom.current = null;
                    if (from === null || from === i) return;
                    update((g) => ({ g: moveSlot(g, from, i), ok: true }));
                    setSel(i);
                  }}
                  onClick={() => setSel(i)}
                  title={it ? tx(it.name) : ""}
                >
                  {it && (
                    <ItemIcon
                      id={s.id}
                      cls={hero.cls}
                      fallback={
                        <>
                          <span className="pw-inv-icon">{it.icon}</span>
                          {it.kind === "seed" && <span className="pw-inv-badge">{it.crop.icon}</span>}
                        </>
                      }
                    />
                  )}
                  {it && it.kind === "fish" && <span className="pw-inv-rarity" style={{ background: it.fish.color }} />}
                  {s && s.n > 1 && <span className="pw-inv-n">{s.n}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="pw-inv-info">
          {isTool && toolId === "weapon" && (
            <>
              <b>{tx(heroClass.itemName || "Arma")}</b>
              <small>{tx("A arma do seu personagem. Muda junto com a classe.")}</small>
            </>
          )}
          {isTool && toolId === "can" && (
            <>
              <b>{tx("Regador")}</b>
              <small>
                {tx("Água")}: {garden.can}/{CAN_MAX}. {tx("Na horta: 3 rega; no poço: 3 enche.")}
              </small>
            </>
          )}
          {isTool && toolId === "rod" && (
            <>
              <b>{tx("Vara de pesca")}</b>
              <small>{tx("Na beira do lago: segure 5 para medir a força e solte para lançar. Quando aparecer o \"!\", aperte 5 e segure para manter o peixe dentro da barra verde.")}</small>
            </>
          )}
          {isTool && toolId === "ring" && (
            <>
              <b>{tx("Anel")}</b>
              <small>{tx("Coloque um orbe de magia no anel. Orbes são ganhos com o Mestre Nilson, na vila.")}</small>
              <div className="pw-orbs">
                {ORB_IDS.map((id) => {
                  const o = ORBS[id];
                  const have = Boolean(garden.orbs && garden.orbs[id]);
                  const locked = !o.ready;
                  return (
                    <div key={id} className={`pw-orb ${have ? "have" : ""} ${locked ? "locked" : ""} ${garden.ring === id ? "on" : ""}`}>
                      <span className="pw-orb-icon">
                        <ItemIcon id={`orb:${id}`} fallback={locked ? "🔒" : o.icon} />
                      </span>
                      <span className="pw-orb-name">
                        <b>{locked ? tx("Orbe bloqueado") : tx(o.name)}</b>
                        <small>{tx(o.desc)}</small>
                      </span>
                      {!locked && have && (
                        <button
                          type="button"
                          className="pw-btn-wood"
                          onClick={() => {
                            update((g) => equipRing(g, garden.ring === id ? null : id));
                            sfx.play("tick");
                          }}
                        >
                          {garden.ring === id ? tx("Tirar") : tx("Colocar")}
                        </button>
                      )}
                      {!locked && !have && <small className="pw-orb-tip">{tx("Fale com o Mestre Nilson")}</small>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {!isTool &&
            (info ? (
              <>
                <b>
                  {info.icon} {tx(info.name)} {slot ? ` × ${slot.n}` : ""}
                </b>
                {info.kind === "crop" && (
                  <small>
                    {tx("Venda na lojinha da vila (Seu Bartolomeu)")}: 🪙 {info.crop.sell} {tx("cada")}
                  </small>
                )}
                {info.kind === "fish" && (
                  <small>
                    <span className="pw-rarity" style={{ color: info.fish.color }}>
                      ● {tx(info.fish.rarity)}
                    </span>{" "}
                    · {tx("Vale")} 🪙 {info.fish.sell} {tx("na lojinha da vila")}
                  </small>
                )}
                {info.kind === "seed" && (
                  <>
                    <small>
                      {tx("Cresce em")} {Math.round(info.crop.grow / 60000)} min {tx("com a terra molhada")}.
                    </small>
                    <button
                      type="button"
                      className="pw-btn-wood"
                      onClick={() => {
                        update((g) => ({ g: { ...g, seed: info.crop.id }, ok: true }));
                        sfx.play("tick");
                      }}
                    >
                      {garden.seed === info.crop.id ? `✔ ${tx("Semente escolhida para plantar")}` : `🌱 ${tx("Escolher para plantar (2)")}`}
                    </button>
                  </>
                )}
              </>
            ) : (
              <small>{tx("Espaço vazio. Arraste os itens para organizar.")}</small>
            ))}
        </div>
      </div>
    </div>
  );
}

function ShopPanel({ garden, update, onClose }) {
  useLanguage();
  usePanelKeys(["1"], onClose);
  const [tab, setTab] = useState("vender");
  const [msg, setMsg] = useState(null);
  const run = (fn, okText) => {
    const r = update(fn);
    if (r.ok) {
      sfx.play("save");
      setMsg(okText);
    } else setMsg(tx(r.msg || "Não deu"));
  };
  return (
    <div className="pw-shop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="pw-shop-box">
        <div className="pw-panel-head">
          <strong>🐷 {tx("Lojinha do Seu Bartolomeu")}</strong>
          <span className="pw-coins">🪙 {garden.coins}</span>
          <button type="button" onClick={onClose} title={tx("Fechar (Esc)")}>
            ✕
          </button>
        </div>
        <div className="pw-shop-who">
          <div className="pw-shop-portrait">
            <HeroModel hero={VENDOR.hero} cls={VENDOR.hero.cls} skinPath={npcSkinPath(VENDOR.id)} size={0.6} />
          </div>
          <p>{msg || tx("Oinc! Trouxe verdura fresquinha? Também tenho sementes boas, preço justo!")}</p>
        </div>
        <div className="pw-chips pw-shop-tabs">
          <button type="button" className={tab === "vender" ? "on" : ""} onClick={() => setTab("vender")}>
            🧺 {tx("Vender colheita e peixes")}
          </button>
          <button type="button" className={tab === "comprar" ? "on" : ""} onClick={() => setTab("comprar")}>
            🌱 {tx("Comprar sementes")}
          </button>
        </div>
        <div className="pw-shop-list">
          {tab === "vender" &&
            FISH_IDS.filter((id) => countItem(garden, `fish:${id}`) > 0).map((id) => {
              const f = FISH[id];
              const have = countItem(garden, `fish:${id}`);
              return (
                <div key={id} className="pw-shop-row">
                  <span className="pw-shop-icon">
                    <ItemIcon id={`fish:${id}`} fallback={f.icon} />
                  </span>
                  <span className="pw-shop-name">
                    <b>
                      {tx(f.name)} <span className="pw-rarity" style={{ color: f.color }}>● {tx(f.rarity)}</span>
                    </b>
                    <small>
                      {tx("Você tem")} {have} · 🪙 {f.sell} {tx("cada")}
                    </small>
                  </span>
                  <button type="button" onClick={() => run((g) => sellItem(g, `fish:${id}`, 1), `+🪙 ${f.sell}! ${tx("Que peixão, oinc!")}`)}>
                    {tx("Vender 1")}
                  </button>
                  <button type="button" disabled={have < 2} onClick={() => run((g) => sellItem(g, `fish:${id}`, have), `+🪙 ${f.sell * have}! ${tx("Oinc oinc!")}`)}>
                    {tx("Tudo")}
                  </button>
                </div>
              );
            })}
          {CROP_IDS.map((id) => {
            const c = CROPS[id];
            if (tab === "vender") {
              const have = countItem(garden, `crop:${id}`);
              return (
                <div key={id} className={`pw-shop-row ${have ? "" : "dim"}`}>
                  <span className="pw-shop-icon">
                    <ItemIcon id={`crop:${id}`} fallback={c.icon} />
                  </span>
                  <span className="pw-shop-name">
                    <b>{tx(c.name)}</b>
                    <small>
                      {tx("Você tem")} {have} · 🪙 {c.sell} {tx("cada")}
                    </small>
                  </span>
                  <button type="button" disabled={!have} onClick={() => run((g) => sell(g, id, 1), `+🪙 ${c.sell}! ${tx("Oinc, obrigado!")}`)}>
                    {tx("Vender 1")}
                  </button>
                  <button type="button" disabled={have < 2} onClick={() => run((g) => sell(g, id, have), `+🪙 ${c.sell * have}! ${tx("Que colheita!")}`)}>
                    {tx("Tudo")}
                  </button>
                </div>
              );
            }
            const seeds = countItem(garden, `seed:${id}`);
            return (
              <div key={id} className={`pw-shop-row ${garden.coins >= c.seed ? "" : "dim"}`}>
                <span className="pw-shop-icon">
                  <ItemIcon id={`seed:${id}`} fallback="🌱" />
                </span>
                <span className="pw-shop-name">
                  <b>
                    {tx("Semente de")} {tx(c.name).toLowerCase()} {c.icon}
                  </b>
                  <small>
                    🪙 {c.seed} · {Math.round(c.grow / 60000)} min · {tx("vende por")} 🪙 {c.sell} · {tx("você tem")} {seeds}
                  </small>
                </span>
                <button type="button" disabled={garden.coins < c.seed} onClick={() => run((g) => buySeed(g, id, 1), `${tx("Semente de")} ${tx(c.name).toLowerCase()}! ${tx("Boa plantação!")}`)}>
                  {tx("Comprar 1")}
                </button>
                <button type="button" disabled={garden.coins < c.seed * 5} onClick={() => run((g) => buySeed(g, id, 5), `5 ${tx("sementes")}! ${tx("Oinc!")}`)}>
                  {tx("5")}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- joystick (celular/tablet) ---------- */
function Joystick({ farm, onAxis, onUp, onDown, buttons }) {
  const baseRef = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  const R = 52;
  const release = () => {
    drag.current = null;
    setKnob({ x: 0, y: 0 });
    onAxis(0, 0);
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
          const ay = y / R;
          onAxis(Math.abs(ax) < 0.18 ? 0 : ax, Math.abs(ay) < 0.18 ? 0 : ay);
          if (farm) return;
          // empurrar para cima/baixo: porta e escada (para cima sem nada perto: pula)
          if (ay < -0.7 && !d.up) {
            d.up = true;
            onUp();
          } else if (ay > -0.4) d.up = false;
          if (ay > 0.7 && !d.down) {
            d.down = true;
            onDown();
          } else if (ay < 0.4) d.down = false;
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
      >
        <span className="pw-joy-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <div className="pw-joy-actions">
        {buttons.map((b) => (
          <button
            key={b.label}
            type="button"
            className={`pw-joy-btn ${b.big ? "jump" : "act"} ${b.ready ? "ready" : ""}`}
            onPointerDown={(e) => {
              e.preventDefault();
              b.press();
            }}
            onPointerUp={() => b.release && b.release()}
            onPointerCancel={() => b.release && b.release()}
          >
            {b.label}
          </button>
        ))}
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

