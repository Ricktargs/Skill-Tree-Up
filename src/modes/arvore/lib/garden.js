/* =========================================================
   HORTA, INVENTÁRIO E MOEDAS DO SANTUÁRIO
   - 2 canteiros de 4 × 6 (48 quadradinhos).
   - 5 plantas: cenoura, batata-doce, trigo, arroz e tomate.
   - A planta só cresce com a terra molhada (rega ou chuva),
     contando mesmo com o app fechado.
   - Inventário de 20 espaços: a arma do personagem fica no 1º;
     colheitas e sementes empilham nos outros.
   - Moedas: vende a colheita e compra sementes na loja da vila.
========================================================= */
import { loadJSON, saveJSON } from "./storage";
import { rainIntervals } from "./weather.js";

const KEY = "eu-sou-arvore-canteiro";
export const BED_COLS = 4;
export const BED_ROWS = 6;
export const BED_COUNT = 2;
export const TILES = BED_COLS * BED_ROWS * BED_COUNT;
export const CAN_MAX = 30;
export const INV_SIZE = 20;
const MIN = 60 * 1000;
export const WET_MS = 15 * MIN; // quanto tempo a terra fica molhada depois de regar

// seed = preço da semente · sell = quanto a loja paga pela colheita
export const CROPS = {
  cenoura: { id: "cenoura", name: "Cenoura", icon: "🥕", grow: 10 * MIN, seed: 5, sell: 12 },
  batata: { id: "batata", name: "Batata-doce", icon: "🍠", grow: 20 * MIN, seed: 8, sell: 20 },
  trigo: { id: "trigo", name: "Trigo", icon: "🌾", grow: 15 * MIN, seed: 6, sell: 15 },
  arroz: { id: "arroz", name: "Arroz", icon: "🍚", grow: 25 * MIN, seed: 10, sell: 26 },
  tomate: { id: "tomate", name: "Tomate", icon: "🍅", grow: 30 * MIN, seed: 12, sell: 32 }
};
export const CROP_IDS = Object.keys(CROPS);

// peixes do lago: quanto mais raro, mais difícil (difficulty 0..1) e mais vale
// weight = chance relativa de morder a isca
export const FISH = {
  lambari: { id: "lambari", name: "Lambari", icon: "🐟", rarity: "Comum", color: "#9ca3af", sell: 8, weight: 44, difficulty: 0.3 },
  tilapia: { id: "tilapia", name: "Tilápia", icon: "🐟", rarity: "Comum", color: "#9ca3af", sell: 13, weight: 30, difficulty: 0.42 },
  carpa: { id: "carpa", name: "Carpa-dourada", icon: "🐠", rarity: "Incomum", color: "#22c55e", sell: 28, weight: 16, difficulty: 0.58 },
  truta: { id: "truta", name: "Truta-arco-íris", icon: "🐠", rarity: "Rara", color: "#3b82f6", sell: 55, weight: 8, difficulty: 0.74 },
  lua: { id: "lua", name: "Peixe-lua", icon: "🐡", rarity: "Lendário", color: "#f59e0b", sell: 150, weight: 2, difficulty: 0.9 }
};
export const FISH_IDS = Object.keys(FISH);
export function pickFish(rand = Math.random) {
  const total = FISH_IDS.reduce((a, id) => a + FISH[id].weight, 0);
  let r = rand() * total;
  for (const id of FISH_IDS) {
    r -= FISH[id].weight;
    if (r <= 0) return FISH[id];
  }
  return FISH.lambari;
}

// orbes de magia (vão no anel). Só o Casateleportador existe por enquanto.
export const ORBS = {
  casa: { id: "casa", name: "Orbe Casateleportador", icon: "🔮", desc: "Use com a tecla 6: leva você para a porta de casa.", ready: true },
  vento: { id: "vento", name: "Orbe ???", icon: "🔒", desc: "Ainda adormecido. O Mestre Nilson vai contar mais no futuro.", ready: false },
  brasa: { id: "brasa", name: "Orbe ???", icon: "🔒", desc: "Ainda adormecido. O Mestre Nilson vai contar mais no futuro.", ready: false }
};
export const ORB_IDS = Object.keys(ORBS);
export const STAGES = ["Semente", "Broto", "Crescendo", "Pronta para colher"];

/* ---------------- itens ---------------- */
// "weapon" · "crop:<id>" · "seed:<id>"
export function itemInfo(id) {
  if (id === "weapon") return { name: "Arma", icon: "⚔️", kind: "weapon" };
  const [kind, cid] = String(id).split(":");
  if (kind === "fish" && FISH[cid]) return { name: FISH[cid].name, icon: FISH[cid].icon, fish: FISH[cid], kind: "fish" };
  const c = CROPS[cid];
  if (!c) return { name: id, icon: "❔", kind: "other" };
  if (kind === "seed") return { name: `Semente de ${c.name.toLowerCase()}`, icon: "🌱", crop: c, kind: "seed" };
  return { name: c.name, icon: c.icon, crop: c, kind: "crop" };
}
export const countItem = (g, id) => g.inv.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0);

const validItem = (id) => {
  const [kind, cid] = String(id).split(":");
  return (kind === "fish" && FISH[cid]) || ((kind === "crop" || kind === "seed") && CROPS[cid]);
};
export function addItem(g, id, n = 1) {
  const inv = g.inv.slice();
  let left = n;
  const stack = inv.findIndex((s) => s && s.id === id);
  if (stack >= 0) {
    inv[stack] = { ...inv[stack], n: inv[stack].n + left };
    left = 0;
  } else {
    const empty = inv.findIndex((s) => !s);
    if (empty >= 0) {
      inv[empty] = { id, n: left };
      left = 0;
    }
  }
  if (left > 0) return { g, ok: false, msg: "Inventário cheio (20 espaços)" };
  return { g: { ...g, inv }, ok: true };
}
export function removeItem(g, id, n = 1) {
  if (countItem(g, id) < n) return { g, ok: false };
  let left = n;
  const inv = g.inv.map((s) => {
    if (!s || s.id !== id || left <= 0) return s;
    const take = Math.min(left, s.n);
    left -= take;
    return s.n - take > 0 ? { ...s, n: s.n - take } : null;
  });
  return { g: { ...g, inv }, ok: true };
}
export function moveSlot(g, from, to) {
  if (from === to) return g;
  const inv = g.inv.slice();
  const a = inv[from];
  const b = inv[to];
  if (a && b && a.id === b.id) {
    inv[to] = { ...b, n: a.n + b.n };
    inv[from] = null;
  } else {
    inv[to] = a;
    inv[from] = b;
  }
  return { ...g, inv };
}

/* ---------------- carregar / salvar ---------------- */
const cleanTile = (b) => (b && CROPS[b.crop] ? { crop: b.crop, grown: +b.grown || 0, wetUntil: +b.wetUntil || 0, last: +b.last || Date.now() } : null);
const starterInv = () => {
  const inv = Array.from({ length: INV_SIZE }, () => null);
  inv[0] = { id: "seed:cenoura", n: 6 };
  inv[1] = { id: "seed:trigo", n: 4 };
  return inv;
};
const empty = () => ({ tiles: Array.from({ length: TILES }, () => null), inv: starterInv(), coins: 30, can: CAN_MAX, seed: "cenoura", orbs: {}, ring: null });

export function loadGarden() {
  const v = loadJSON(KEY, null);
  if (!v) return empty();
  let out = empty();
  const list = Array.isArray(v.tiles) ? v.tiles : Array.isArray(v.beds) ? v.beds : [];
  list.slice(0, TILES).forEach((b, i) => (out.tiles[i] = cleanTile(b)));
  out.can = Number.isFinite(+v.can) ? Math.max(0, Math.min(CAN_MAX, +v.can)) : CAN_MAX;
  out.seed = CROPS[v.seed] ? v.seed : "cenoura";
  out.coins = Number.isFinite(+v.coins) ? Math.max(0, Math.floor(+v.coins)) : 30;
  if (Array.isArray(v.inv)) {
    out.inv = Array.from({ length: INV_SIZE }, (_, i) => {
      const s = v.inv[i];
      return s && s.id && validItem(s.id) && s.n > 0 ? { id: s.id, n: Math.floor(s.n) } : null;
    });
  } else if (v.bag) {
    // versão antiga: o que foi colhido vai para o inventário
    Object.entries(v.bag).forEach(([cid, n]) => {
      if (CROPS[cid] && n > 0) out = addItem(out, `crop:${cid}`, Math.floor(n)).g;
    });
  }
  out.orbs = v.orbs && typeof v.orbs === "object" ? Object.fromEntries(ORB_IDS.filter((id) => v.orbs[id]).map((id) => [id, true])) : {};
  out.ring = v.ring && out.orbs[v.ring] ? v.ring : null;
  out.fishLog = v.fishLog && typeof v.fishLog === "object" ? v.fishLog : {};
  return out;
}
export const saveGarden = (g) => saveJSON(KEY, g);

/* ---------------- anel e orbes ---------------- */
export const giveOrb = (g, id) => ({ g: { ...g, orbs: { ...g.orbs, [id]: true }, ring: g.ring || id }, ok: true });
export const equipRing = (g, id) => (id && !g.orbs[id] ? { g, ok: false } : { g: { ...g, ring: id }, ok: true });
export function addFish(g, fishId) {
  const r = addItem(g, `fish:${fishId}`, 1);
  if (!r.ok) return r;
  const log = { ...(g.fishLog || {}) };
  log[fishId] = (log[fishId] || 0) + 1;
  return { g: { ...r.g, fishLog: log }, ok: true };
}

/* ---------------- crescimento ---------------- */
// soma do tempo com a terra molhada (rega OU chuva) entre "last" e agora
function wetTime(b, now, rains) {
  const a0 = b.last;
  const a1 = Math.min(now, b.wetUntil);
  let total = Math.max(0, a1 - a0);
  rains.forEach(([s, e]) => {
    const s1 = Math.max(s, b.last);
    const e1 = Math.min(e, now);
    if (e1 <= s1) return;
    const os = Math.max(s1, a0);
    const oe = Math.min(e1, a1);
    total += e1 - s1 - Math.max(0, oe - os);
  });
  return total;
}
export function tickGarden(g, now = Date.now(), season = "verao") {
  let changed = false;
  const oldest = g.tiles.reduce((m, b) => (b ? Math.min(m, b.last) : m), now);
  const rains = rainIntervals(oldest, now, season);
  const tiles = g.tiles.map((b) => {
    if (!b) return b;
    const grown = Math.min(CROPS[b.crop].grow, b.grown + wetTime(b, now, rains));
    if (grown === b.grown && b.last === now) return b;
    changed = true;
    return { ...b, grown, last: now };
  });
  return changed ? { ...g, tiles } : g;
}

export const progressOf = (b) => (b ? Math.min(1, b.grown / CROPS[b.crop].grow) : 0);
export const stageOf = (b) => {
  const p = progressOf(b);
  return p >= 1 ? 3 : p >= 0.6 ? 2 : p >= 0.2 ? 1 : 0;
};
export const isWet = (b, now = Date.now(), raining = false) => Boolean(b && (raining || b.wetUntil > now));

const setTile = (g, i, v) => {
  const tiles = g.tiles.slice();
  tiles[i] = v;
  return { ...g, tiles };
};

/* ---------------- ações (cada uma devolve { g, ok, msg }) ---------------- */
export function plantAt(g, i) {
  if (i < 0 || i >= TILES) return { g, ok: false };
  if (g.tiles[i]) return { g, ok: false, msg: "Já tem planta aqui" };
  const seedId = `seed:${g.seed}`;
  if (countItem(g, seedId) <= 0) return { g, ok: false, msg: `Sem sementes de ${CROPS[g.seed].name.toLowerCase()}: compre na loja da vila` };
  const used = removeItem(g, seedId, 1).g;
  return { g: setTile(used, i, { crop: g.seed, grown: 0, wetUntil: 0, last: Date.now() }), ok: true };
}
export function waterAt(g, i, season) {
  if (i < 0 || i >= TILES) return { g, ok: false };
  const b = g.tiles[i];
  if (!b) return { g, ok: false, msg: "Plante algo aqui antes de regar" };
  if (stageOf(b) === 3) return { g, ok: false, msg: "Já está pronta: colha com o 1" };
  if (g.can <= 0) return { g, ok: false, msg: "Regador vazio: encha no poço (3 no poço)" };
  const now = Date.now();
  const t = tickGarden(g, now, season);
  const next = setTile(t, i, { ...t.tiles[i], wetUntil: now + WET_MS, last: now });
  return { g: { ...next, can: g.can - 1 }, ok: true };
}
export function harvestAt(g, i) {
  const b = g.tiles[i];
  if (!b) return { g, ok: false };
  if (stageOf(b) < 3) return { g, ok: false, msg: `${CROPS[b.crop].name}: ainda crescendo` };
  const added = addItem(g, `crop:${b.crop}`, 1);
  if (!added.ok) return { g, ok: false, msg: added.msg };
  let next = setTile(added.g, i, null);
  // às vezes a planta dá uma semente de volta
  let bonus = false;
  if (Math.random() < 0.3) {
    const s = addItem(next, `seed:${b.crop}`, 1);
    if (s.ok) {
      next = s.g;
      bonus = true;
    }
  }
  return { g: next, ok: true, crop: b.crop, bonus };
}
export const refillCan = (g) => ({ ...g, can: CAN_MAX });
/** Próxima semente que a pessoa tem (ou a próxima da lista, se não tiver nenhuma). */
export const nextSeed = (g) => {
  const owned = CROP_IDS.filter((id) => countItem(g, `seed:${id}`) > 0);
  const list = owned.length ? owned : CROP_IDS;
  const i = list.indexOf(g.seed);
  return { ...g, seed: list[(i + 1) % list.length] };
};

/* ---------------- loja ---------------- */
export function sell(g, cropId, n = 1) {
  return sellItem(g, `crop:${cropId}`, n);
}
export const priceOf = (itemId) => {
  const [kind, cid] = String(itemId).split(":");
  return kind === "fish" ? (FISH[cid] ? FISH[cid].sell : 0) : CROPS[cid] ? CROPS[cid].sell : 0;
};
export function sellItem(g, itemId, n = 1) {
  const r = removeItem(g, itemId, n);
  if (!r.ok) return { g, ok: false, msg: "Você não tem isso para vender" };
  return { g: { ...r.g, coins: g.coins + priceOf(itemId) * n }, ok: true };
}
export function buySeed(g, cropId, n = 1) {
  const price = CROPS[cropId].seed * n;
  if (g.coins < price) return { g, ok: false, msg: "Moedas insuficientes" };
  const r = addItem(g, `seed:${cropId}`, n);
  if (!r.ok) return r;
  return { g: { ...r.g, coins: g.coins - price }, ok: true };
}
