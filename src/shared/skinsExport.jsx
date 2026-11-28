// =========================================================
// EXPORTAR OS ORIGINAIS PARA public/skins/_originais
// Só existe no "npm run dev". No console do app:  __orbeExportSkins()
// Gera os desenhos atuais do código (PNG/SVG) para servir de base:
// personagens, moradores, cenários, plantas, animais, itens e ícones.
// =========================================================
import { renderToStaticMarkup } from 'react-dom/server';
import { GRID, pixelsFromHero } from '../atualizacao2_0/Hero2D.js';
import { DEFAULT_HERO, getLook, normalizeHero } from '../atualizacao2_0/HeroModels.js';
import { FISH_COLORS, buildFar, buildInterior, buildMid, buildWorld, drawFish, drawFrog, drawLily, SCENE_IDS } from '../modes/arvore/components/pixelWorld.js';
import { NPCS, VENDOR, buildShop, buildShopFront, buildVillage } from '../modes/arvore/components/villageWorld.js';
import { buildCanopy } from '../modes/arvore/components/canopyWorld.js';
import { buildFarm, drawCrop } from '../modes/arvore/components/farmWorld.js';
import { CROPS, CROP_IDS, FISH, FISH_IDS, ORBS, ORB_IDS } from '../modes/arvore/lib/garden.js';
import { APP_ICON_NAMES, appIconBody } from './AppIcon.jsx';
import { CAN_COLORS, CAN_PIXELS, CLASS_ITEM_FILE, CLASS_SKIN, EXTRA_SCENES, ICON_SKIN, LAYER_SKIN, STAGE_FILE, cropSkinPath, itemSkinPath, npcSkinPath, setSkinBypass } from './skins.js';

const write = async (path, payload) => {
  const r = await fetch('/__orbe-skins/write', { method: 'POST', body: JSON.stringify({ path, ...payload }) });
  if (!r.ok) throw new Error(`${path}: ${await r.text()}`);
};
const png = (canvas) => canvas.toDataURL('image/png');
const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { c, g };
};

const ICON_STYLE =
  '.app-ic-wash{fill:#38bdf8;opacity:.32;stroke:#38bdf8;stroke-width:.5;stroke-opacity:.55}.app-ic-ink{fill:#e5e7eb}.app-ic-back{opacity:.55}.app-ic-sand{fill:#38bdf8}.app-ic-ray{fill:none;stroke:#e5e7eb;stroke-width:1.8;stroke-linecap:round}';
const WEAPON_EMOJI = { wizard: '🪄', archer: '🏹', warrior: '⚔️', elf: '🌿' };

// personagem 50 × 57, fundo transparente
function heroPng(hero, cls) {
  const px = pixelsFromHero(cls, getLook(normalizeHero(hero), cls));
  const { c, g } = canvas(GRID.c1 - GRID.c0 + 1, GRID.r1 - GRID.r0 + 1);
  Object.entries(px).forEach(([k, col]) => {
    const [x, y] = k.split(',').map(Number);
    g.fillStyle = col;
    g.fillRect(x - GRID.c0, y - GRID.r0, 1, 1);
  });
  return png(c);
}
// emoji num quadrado 32 × 32 (ponto de partida para desenhar por cima)
function emojiPng(emoji) {
  const { c, g } = canvas(32, 32);
  g.font = '26px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(emoji, 16, 18);
  return png(c);
}

export async function exportOriginalSkins() {
  const done = [];
  const put = async (path, payload) => {
    await write(`_originais/${path}`, payload);
    done.push(path);
  };
  setSkinBypass(true);
  try {
    // ----- personagens principais -----
    const hero = normalizeHero(DEFAULT_HERO);
    for (const [cls, name] of Object.entries(CLASS_SKIN)) await put(`personagens/${name}.png`, { data: heroPng(hero, cls) });
    // ----- moradores da vila e vendedor -----
    for (const n of [...NPCS, VENDOR]) await put(npcSkinPath(n.id), { data: heroPng(n.hero, n.hero.cls) });

    // ----- cenários (estação: verão) -----
    for (const kind of SCENE_IDS) {
      const layers = { world: buildWorld(kind, 'verao').c, mid: buildMid(kind, 'verao'), far: buildFar(kind, 'verao') };
      for (const [layer, cv] of Object.entries(layers)) if (cv) await put(`cenario/${kind}-${LAYER_SKIN[layer]}.png`, { data: png(cv) });
    }
    await put('cenario/casa.png', { data: png(buildInterior('verao').c) });
    await put(EXTRA_SCENES.vila, { data: png(buildVillage('verao').c) });
    await put(EXTRA_SCENES.loja, { data: png(buildShop('verao').c) });
    await put(EXTRA_SCENES.balcao, { data: png(buildShopFront()) });
    await put(EXTRA_SCENES.copa, { data: png(buildCanopy('verao').c) });
    await put(EXTRA_SCENES.horta, { data: png(buildFarm('verao')) });

    // ----- plantas: cada uma nas 4 fases (32 × 32) -----
    const fracs = [0, 0.3, 0.7, 1];
    for (const id of CROP_IDS) {
      for (let st = 0; st < STAGE_FILE.length; st++) {
        const { c, g } = canvas(32, 32);
        drawCrop(g, 0, 0, { crop: id, grown: fracs[st] * CROPS[id].grow, wetUntil: 0, last: 0 }, 0);
        await put(cropSkinPath(id, st), { data: png(c) });
      }
    }

    // ----- lago: peixes, sapo e vitórias-régias -----
    for (let i = 0; i < FISH_COLORS.length; i++) {
      const { c, g } = canvas(14, 9);
      drawFish(g, 0, [{ x: 11, y: 4, dir: 1, col: FISH_COLORS[i], big: true }]);
      await put(`animais/peixe-${i + 1}.png`, { data: png(c) });
    }
    {
      const { c, g } = canvas(11, 7);
      drawFrog(g, 5, 6, false, false);
      await put('animais/sapo.png', { data: png(c) });
      const j = canvas(11, 8);
      drawFrog(j.g, 5, 7, true, false);
      await put('animais/sapo-pulando.png', { data: png(j.c) });
      const l = canvas(28, 6);
      drawLily(l.g, 14, 4, 12, false);
      await put('animais/vitoria-regia.png', { data: png(l.c) });
      const f = canvas(28, 9);
      drawLily(f.g, 14, 7, 12, true);
      await put('animais/vitoria-regia-flor.png', { data: png(f.c) });
    }

    // ----- itens (inventário, loja e barra) -----
    for (const id of CROP_IDS) {
      await put(itemSkinPath(`crop:${id}`), { data: emojiPng(CROPS[id].icon) });
      await put(itemSkinPath(`seed:${id}`), { data: emojiPng('🌱') });
    }
    for (const cls of Object.keys(CLASS_ITEM_FILE)) await put(itemSkinPath('weapon', cls), { data: emojiPng(WEAPON_EMOJI[cls]) });
    for (const id of FISH_IDS) await put(itemSkinPath(`fish:${id}`), { data: emojiPng(FISH[id].icon) });
    await put(itemSkinPath('rod'), { data: emojiPng('🎣') });
    await put(itemSkinPath('ring'), { data: emojiPng('💍') });
    for (const id of ORB_IDS) await put(itemSkinPath(`orb:${id}`), { data: emojiPng(ORBS[id].ready ? ORBS[id].icon : '🔮') });
    {
      const { c, g } = canvas(24, 18);
      CAN_PIXELS.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          if (!CAN_COLORS[ch]) return;
          g.fillStyle = CAN_COLORS[ch];
          g.fillRect(x * 2, y * 2, 2, 2);
        })
      );
      g.fillStyle = '#60a5fa';
      g.fillRect(22, 12, 2, 2);
      await put(itemSkinPath('can'), { data: png(c) });
    }

    // ----- ícones dos botões (SVG) -----
    for (const name of APP_ICON_NAMES) {
      const body = appIconBody(name);
      const markup = renderToStaticMarkup(
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96">
          <style>{ICON_STYLE}</style>
          {body}
        </svg>
      );
      await put(`icones/${ICON_SKIN[name] || name}.svg`, { text: markup });
    }
  } finally {
    setSkinBypass(false);
  }
  return done;
}
