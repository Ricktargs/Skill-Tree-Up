/* =========================================================
   CANTEIRO DO SANTUÁRIO
   4 canteirinhos ao lado da casa. Planta cenoura ou batata-doce,
   rega e colhe. A planta só cresce enquanto a terra está molhada
   (cada rega dura um tempo), contando mesmo com o app fechado.
========================================================= */
import { loadJSON, saveJSON } from "./storage";

const KEY = "eu-sou-arvore-canteiro";
export const BEDS = 4;
const MIN = 60 * 1000;
export const WET_MS = 15 * MIN; // quanto tempo a terra fica molhada depois de regar

export const CROPS = {
  cenoura: { id: "cenoura", name: "Cenoura", icon: "🥕", grow: 10 * MIN },
  batata: { id: "batata", name: "Batata-doce", icon: "🍠", grow: 20 * MIN }
};
export const STAGES = ["Semente", "Broto", "Crescendo", "Pronta para colher"];

const empty = () => ({ beds: Array.from({ length: BEDS }, () => null), bag: { cenoura: 0, batata: 0 } });

export function loadGarden() {
  const v = loadJSON(KEY, null);
  if (!v || !Array.isArray(v.beds)) return empty();
  const beds = Array.from({ length: BEDS }, (_, i) => {
    const b = v.beds[i];
    return b && CROPS[b.crop] ? { crop: b.crop, grown: +b.grown || 0, wetUntil: +b.wetUntil || 0, last: +b.last || Date.now() } : null;
  });
  return { beds, bag: { cenoura: +(v.bag && v.bag.cenoura) || 0, batata: +(v.bag && v.bag.batata) || 0 } };
}
export const saveGarden = (g) => saveJSON(KEY, g);

/** Soma o crescimento até agora (só o tempo com a terra molhada). */
export function tickGarden(g, now = Date.now()) {
  let changed = false;
  const beds = g.beds.map((b) => {
    if (!b) return b;
    const until = Math.min(now, b.wetUntil);
    let grown = b.grown;
    if (until > b.last) grown = Math.min(CROPS[b.crop].grow, grown + (until - b.last));
    if (grown !== b.grown || b.last !== now) changed = true;
    return { ...b, grown, last: now };
  });
  return changed ? { ...g, beds } : g;
}

export const progressOf = (b) => (b ? Math.min(1, b.grown / CROPS[b.crop].grow) : 0);
export const stageOf = (b) => {
  const p = progressOf(b);
  return p >= 1 ? 3 : p >= 0.6 ? 2 : p >= 0.2 ? 1 : 0;
};
export const waterOf = (b, now = Date.now()) => (b ? Math.max(0, Math.min(1, (b.wetUntil - now) / WET_MS)) : 0);

export function plant(g, i, crop) {
  const now = Date.now();
  const beds = g.beds.slice();
  beds[i] = { crop, grown: 0, wetUntil: 0, last: now };
  return { ...g, beds };
}
export function water(g, i) {
  const now = Date.now();
  const t = tickGarden(g, now);
  const beds = t.beds.slice();
  if (!beds[i]) return t;
  beds[i] = { ...beds[i], wetUntil: now + WET_MS, last: now };
  return { ...t, beds };
}
export function waterAll(g) {
  let out = g;
  g.beds.forEach((b, i) => {
    if (b && stageOf(b) < 3) out = water(out, i);
  });
  return out;
}
export function harvest(g, i) {
  const b = g.beds[i];
  if (!b || stageOf(b) < 3) return g;
  const beds = g.beds.slice();
  beds[i] = null;
  return { ...g, beds, bag: { ...g.bag, [b.crop]: (g.bag[b.crop] || 0) + 1 } };
}
export function uproot(g, i) {
  const beds = g.beds.slice();
  beds[i] = null;
  return { ...g, beds };
}
