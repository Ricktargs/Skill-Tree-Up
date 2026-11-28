/* =========================================================
   MODO DESENVOLVEDOR DO SANTUÁRIO — onde as edições ficam
   Guardado no IndexedDB (as imagens são grandes demais para o
   localStorage), separado por perfil.
   Chaves:
     art:out:<cena>:world|mid|far · art:in:house  → { overlay: Blob, erase: Blob }
     solid:out:<cena> · solid:in                   → { diff: { índice: 0|1 } }
     spots:out:<cena> · spots:in                   → { map: { id: {x, y} } }
========================================================= */
import { getActiveProfileId } from "../../../shared/activeProfile.js";

const DB = "orbe-sanctuary-dev";
const STORE = "records";
let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
  return dbPromise;
}

const prefix = () => `${getActiveProfileId() || "default"}|`;

function tx(mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const st = t.objectStore(STORE);
        const out = fn(st);
        t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : undefined);
        t.onerror = () => reject(t.error);
      })
  );
}

/** Todas as edições do perfil atual: { chave: valor } */
export async function loadDevData() {
  try {
    const p = prefix();
    const db = await open();
    return await new Promise((resolve) => {
      const out = {};
      const t = db.transaction(STORE, "readonly");
      const req = t.objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) return;
        if (String(cur.key).startsWith(p)) out[String(cur.key).slice(p.length)] = cur.value;
        cur.continue();
      };
      t.oncomplete = () => resolve(out);
      t.onerror = () => resolve(out);
    });
  } catch {
    return {};
  }
}

export function saveDev(key, value) {
  return tx("readwrite", (st) => st.put(value, prefix() + key)).catch(() => {});
}
export function removeDev(key) {
  return tx("readwrite", (st) => st.delete(prefix() + key)).catch(() => {});
}

export const canvasToBlob = (c) => new Promise((resolve) => c.toBlob((b) => resolve(b), "image/png"));
export async function blobToCanvas(blob, w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  if (!blob) return c;
  try {
    const bmp = await createImageBitmap(blob);
    c.getContext("2d").drawImage(bmp, 0, 0);
  } catch {
    /* imagem estragada: fica vazia */
  }
  return c;
}

export const artKey = (layer, kind) => (layer === "house" ? "art:in:house" : `art:out:${kind}:${layer}`);
export const solidKey = (where, kind) => (where === "in" ? "solid:in" : `solid:out:${kind}`);
export const spotsKey = (where, kind) => (where === "in" ? "spots:in" : `spots:out:${kind}`);
