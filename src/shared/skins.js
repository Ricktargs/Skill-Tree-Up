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

// tudo o que está na pasta já começa a carregar; o jogo pega pronto (sem esperar)
const loaded = new Map();
FILES.forEach((p) => {
  if (/\.(png|webp|gif|jpe?g|svg)$/i.test(p)) loadSkinImage(p).then((img) => img && loaded.set(p, img));
});
/** A imagem da skin, se já carregou (para desenhar no canvas a cada quadro). */
let bypass = false;
/** O exportador desliga as skins para gerar os desenhos originais. */
export const setSkinBypass = (v) => (bypass = Boolean(v));
export const skinImg = (path) => (!bypass && path && loaded.get(path)) || null;
// regador em pixel art (12 × 9): # contorno · o metal · O brilho
export const CAN_PIXELS = [
  '........##..',
  '.......#..#.',
  '..#####...#.',
  '.#ooooo#..#.',
  '#.oOOOOo#.#.',
  '..oOOOOo####',
  '..oOOOOo..#.',
  '..oooooo....',
  '..######....'
];
export const CAN_COLORS = { '#': '#3f4a57', o: '#7c8b99', O: '#a9b6c2' };

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
// moradores da vila e vendedor (cada um com sua imagem; não usa a do personagem principal)
export const npcSkinPath = (id) => `personagens/moradores/${id}.png`;
// mais cenários
export const EXTRA_SCENES = {
  vila: 'cenario/vila.png',
  loja: 'cenario/loja.png',
  balcao: 'cenario/loja-balcao.png',
  copa: 'cenario/copa.png',
  horta: 'cenario/horta.png'
};
// plantas: <planta>-<fase>.png (quadradinho de 32 × 32)
export const STAGE_FILE = ['0-semente', '1-broto', '2-crescendo', '3-pronta'];
export const cropSkinPath = (crop, stage) => `plantas/${crop}-${STAGE_FILE[stage]}.png`;
// animais e lago
export const ANIMAL_SKINS = {
  fish: (i) => `animais/peixe-${i}.png`,
  frog: 'animais/sapo.png',
  frogJump: 'animais/sapo-pulando.png',
  lily: 'animais/vitoria-regia.png',
  lilyFlower: 'animais/vitoria-regia-flor.png'
};
// itens (inventário, loja e barra da horta)
export const CLASS_ITEM_FILE = { wizard: 'mago', archer: 'arqueiro', warrior: 'guerreiro', elf: 'elfa' };
export function itemSkinPath(id, cls) {
  if (id === 'weapon') return `itens/arma-${CLASS_ITEM_FILE[cls] || 'outra'}.png`;
  if (id === 'can') return 'itens/regador.png';
  if (id === 'rod') return 'itens/vara-de-pesca.png';
  if (id === 'ring') return 'itens/anel.png';
  const [kind, crop] = String(id).split(':');
  if (kind === 'orb') return `itens/orbe-${crop}.png`;
  if (kind === 'fish') return `itens/peixe-${crop}.png`;
  return kind === 'seed' ? `itens/semente-${crop}.png` : `itens/${crop}.png`;
}
export const iconSkinPath = (name) => {
  const base = ICON_SKIN[name] || name;
  return findSkin(`icones/${base}.svg`, `icones/${base}.png`, `icones/${base}.webp`);
};
