// =========================================================
// EXPORTAR OS ORIGINAIS PARA public/skins/_originais
// Só existe no "npm run dev". No console do app:  __orbeExportSkins()
// Gera os desenhos atuais do código como PNG/SVG para servir de base.
// =========================================================
import { renderToStaticMarkup } from 'react-dom/server';
import { GRID, pixelsFromHero } from '../atualizacao2_0/Hero2D.js';
import { DEFAULT_HERO, getLook, normalizeHero } from '../atualizacao2_0/HeroModels.js';
import { buildFar, buildInterior, buildMid, buildWorld, SCENE_IDS } from '../modes/arvore/components/pixelWorld.js';
import { APP_ICON_NAMES, appIconBody } from './AppIcon.jsx';
import { CLASS_SKIN, ICON_SKIN, LAYER_SKIN } from './skins.js';

const write = async (path, payload) => {
  const r = await fetch('/__orbe-skins/write', { method: 'POST', body: JSON.stringify({ path, ...payload }) });
  if (!r.ok) throw new Error(`${path}: ${await r.text()}`);
};
const png = (canvas) => canvas.toDataURL('image/png');

const ICON_STYLE =
  '.app-ic-wash{fill:#38bdf8;opacity:.32;stroke:#38bdf8;stroke-width:.5;stroke-opacity:.55}.app-ic-ink{fill:#e5e7eb}.app-ic-back{opacity:.55}.app-ic-sand{fill:#38bdf8}.app-ic-ray{fill:none;stroke:#e5e7eb;stroke-width:1.8;stroke-linecap:round}';

export async function exportOriginalSkins() {
  const done = [];
  // personagens: 50×57, fundo transparente
  const hero = normalizeHero(DEFAULT_HERO);
  for (const [cls, name] of Object.entries(CLASS_SKIN)) {
    const px = pixelsFromHero(cls, getLook(hero, cls));
    const c = document.createElement('canvas');
    c.width = GRID.c1 - GRID.c0 + 1;
    c.height = GRID.r1 - GRID.r0 + 1;
    const g = c.getContext('2d');
    Object.entries(px).forEach(([k, col]) => {
      const [x, y] = k.split(',').map(Number);
      g.fillStyle = col;
      g.fillRect(x - GRID.c0, y - GRID.r0, 1, 1);
    });
    await write(`_originais/personagens/${name}.png`, { data: png(c) });
    done.push(`personagens/${name}.png`);
  }
  // cenário (estação: verão)
  for (const kind of SCENE_IDS) {
    const layers = { world: buildWorld(kind, 'verao').c, mid: buildMid(kind, 'verao'), far: buildFar(kind, 'verao') };
    for (const [layer, canvas] of Object.entries(layers)) {
      if (!canvas) continue;
      const path = `cenario/${kind}-${LAYER_SKIN[layer]}.png`;
      await write(`_originais/${path}`, { data: png(canvas) });
      done.push(path);
    }
  }
  await write('_originais/cenario/casa.png', { data: png(buildInterior('verao').c) });
  done.push('cenario/casa.png');
  // ícones (SVG)
  for (const name of APP_ICON_NAMES) {
    const body = appIconBody(name);
    const markup = renderToStaticMarkup(
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96">
        <style>{ICON_STYLE}</style>
        {body}
      </svg>
    );
    const path = `icones/${ICON_SKIN[name] || name}.svg`;
    await write(`_originais/${path}`, { text: markup });
    done.push(path);
  }
  return done;
}
