// =========================================================
// DEPÓSITO DE MÍDIA (imagens e áudios dos flashcards)
// Fica no IndexedDB do navegador/app — aguenta arquivos grandes.
// (O localStorage, onde ficam as cartas, só tem ~5 MB.)
// A carta guarda só o id ("md_…"); aqui fica o arquivo.
// =========================================================
import { useEffect, useState } from 'react';

const DB_NAME = 'orbe-media';
const STORE = 'files';
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Sem IndexedDB'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

const tx = async (mode, fn) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const out = fn(store);
    t.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
};

const newId = () => `md_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export async function putMedia(blob) {
  const id = newId();
  await tx('readwrite', (s) => s.put(blob, id));
  return id;
}

const urlCache = new Map(); // id -> objectURL
export async function getMediaUrl(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  const blob = await tx('readonly', (s) => s.get(id));
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

export async function deleteMedia(ids) {
  const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
  if (!list.length) return;
  list.forEach((id) => {
    const url = urlCache.get(id);
    if (url) URL.revokeObjectURL(url);
    urlCache.delete(id);
  });
  try {
    await tx('readwrite', (s) => list.forEach((id) => s.delete(id)));
  } catch {
    /* sem banco: nada a limpar */
  }
}

// <img src={useMediaUrl(id)} />
export function useMediaUrl(id) {
  const [url, setUrl] = useState(() => (id && urlCache.get(id)) || null);
  useEffect(() => {
    let alive = true;
    if (!id) {
      setUrl(null);
      return undefined;
    }
    getMediaUrl(id)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [id]);
  return url;
}

// Imagem: diminui para no máximo 1280px e salva em JPEG/PNG leve
export async function shrinkImage(file, max = 1280) {
  if (!file || !/^image\//.test(file.type) || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size < 400 * 1024) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    return await new Promise((res) => c.toBlob((b) => res(b || file), type, 0.85));
  } catch {
    return file;
  }
}
