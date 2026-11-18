/* =========================================================
   PERSISTÊNCIA
   - Dados principais: localStorage (mesmas chaves da versão anterior)
   - Pontos de restauração diários: IndexedDB (eram grandes demais
     para o localStorage e estouravam a cota de ~5MB)
========================================================= */
import { STORAGE_KEYS, REVISION_DAYS } from "./constants";

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

/** Retorna false se o navegador recusar (ex.: cota cheia). */
export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[Eu Sou Árvore] Falha ao salvar "${key}":`, err);
    return false;
  }
}

export function loadString(key, fallback = null) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveString(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* preferência sem importância */
  }
}

/* ---------------- IndexedDB (revisões) ---------------- */
const DB_NAME = "eu-sou-arvore";
const STORE = "revisions";
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB indisponível"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "dateKey" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        const result = fn(store);
        t.oncomplete = () => resolve(result && "result" in result ? result.result : undefined);
        t.onerror = () => reject(t.error);
      })
  );
}

let migrated = false;
async function migrateLegacyRevisions() {
  if (migrated) return;
  migrated = true;
  const legacy = loadJSON(STORAGE_KEYS.revisions, null);
  if (!Array.isArray(legacy) || legacy.length === 0) return;
  await tx("readwrite", (store) => {
    legacy.forEach((rev) => rev && rev.dateKey && store.put(rev));
  });
  try {
    localStorage.removeItem(STORAGE_KEYS.revisions);
  } catch {
    /* ignore */
  }
}

export async function listRevisions() {
  try {
    await migrateLegacyRevisions();
    const all = await tx("readonly", (store) => store.getAll());
    const cutoff = Date.now() - REVISION_DAYS * 24 * 60 * 60 * 1000;
    return (all || []).filter((r) => r.timestamp >= cutoff).sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    console.warn("[Eu Sou Árvore] Revisões indisponíveis:", err);
    return [];
  }
}

export async function saveDailyRevision(data) {
  try {
    await migrateLegacyRevisions();
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const dateKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const cutoff = Date.now() - REVISION_DAYS * 24 * 60 * 60 * 1000;
    await tx("readwrite", (store) => {
      store.put({
        id: dateKey,
        dateKey,
        timestamp: Date.now(),
        dateLabel: now.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        tree: data.tree,
        records: data.records,
        offsets: data.offsets,
        foldersMap: data.foldersMap,
      });
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) return;
        if (cursor.value.timestamp < cutoff) cursor.delete();
        cursor.continue();
      };
    });
  } catch (err) {
    console.warn("[Eu Sou Árvore] Não foi possível salvar o ponto de restauração:", err);
  }
}
