// =========================================================
// SKINS (pasta public/skins)
// Uma imagem colocada lá substitui o desenho feito pelo código.
// Sem a imagem, continua o desenho original. Veja o LEIA-ME.txt.
//   personagens/mago.png · arqueiro.png · guerreiro.png · elfa.png
//   cenario/<campo|ilha|praia>-mundo.png · -fundo-perto.png · -fundo-longe.png
//   cenario/casa.png
//   icones/<nome>.png ou .svg
// =========================================================
import { useEffect, useState } from 'react';
import FILES, { STAMP } from 'virtual:orbe-skins';

const set = new Set(FILES);
export const SKIN_FILES = FILES;

export const hasSkin = (path) => set.has(path);
export const skinUrl = (path) => `./skins/${path}?v=${STAMP}`;
/** O primeiro dos caminhos que existe na pasta (ex.: .png ou .svg). */
export const findSkin = (...paths) => paths.find((p) => set.has(p)) || null;

const cache = new Map();
/** Carrega a imagem (ou null se não existir / der erro). */
export function loadSkinImage(path) {
  if (!path || !set.has(path)) return Promise.resolve(null);
  if (!cache.has(path)) {
    cache.set(
      path,
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = skinUrl(path);
      })
    );
  }
  return cache.get(path);
}

/** Imagem → tela (canvas) do tamanho dela. */
export function imageToCanvas(img, w, h) {
  const c = document.createElement('canvas');
  c.width = w || img.naturalWidth;
  c.height = h || img.naturalHeight;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0);
  return c;
}

const pixelCache = new Map();
/** Imagem de personagem → { "c,r": "#rrggbb" } (a partir do canto do quadro). */
export async function loadSkinPixels(path, c0, r0) {
  if (pixelCache.has(path)) return pixelCache.get(path);
  const img = await loadSkinImage(path);
  let out = null;
  if (img) {
    const c = imageToCanvas(img);
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    out = {};
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        if (d[i + 3] < 128) continue;
        out[`${x + c0},${y + r0}`] = `#${((1 << 24) | (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]).toString(16).slice(1)}`;
      }
    }
  }
  pixelCache.set(path, out);
  return out;
}

/** Hook: pixels de uma skin de personagem (null enquanto carrega ou se não tiver). */
export function useSkinPixels(path, c0, r0) {
  const [px, setPx] = useState(() => (path && pixelCache.has(path) ? pixelCache.get(path) : null));
  useEffect(() => {
    let alive = true;
    if (!path || !set.has(path)) {
      setPx(null);
      return undefined;
    }
    loadSkinPixels(path, c0, r0).then((v) => alive && setPx(v));
    return () => {
      alive = false;
    };
  }, [path, c0, r0]);
  return px;
}

// nomes dos arquivos
export const CLASS_SKIN = { wizard: 'mago', archer: 'arqueiro', warrior: 'guerreiro', elf: 'elfa' };
export const heroSkinPath = (cls) => (CLASS_SKIN[cls] ? `personagens/${CLASS_SKIN[cls]}.png` : null);
export const LAYER_SKIN = { world: 'mundo', mid: 'fundo-perto', far: 'fundo-longe' };
export const sceneSkinPath = (kind, layer) => (layer === 'house' ? 'cenario/casa.png' : `cenario/${kind}-${LAYER_SKIN[layer]}.png`);
export const ICON_SKIN = {
  profile: 'perfil',
  pomodoro: 'pomodoro',
  missions: 'missoes',
  missionsDone: 'missoes-feitas',
  organize: 'organizar',
  moon: 'lua',
  sun: 'sol',
  settings: 'configuracoes',
  theme: 'tema',
  tasks: 'tarefas',
  notes: 'notas',
  flashcards: 'flashcards'
};
export const iconSkinPath = (name) => {
  const base = ICON_SKIN[name] || name;
  return findSkin(`icones/${base}.svg`, `icones/${base}.png`, `icones/${base}.webp`);
};
