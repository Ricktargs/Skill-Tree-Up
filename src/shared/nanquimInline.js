// =========================================================
// NANQUIM PARA CORES "INLINE" (style={{ ... }} no código das Habilidades)
// Um observador traduz essas cores enquanto o Nanquim está ligado e
// devolve as originais ao voltar para o Gameficado.
// =========================================================
import { getUiTheme, subscribeUiTheme } from './uiTheme.js';
import { mapValue, roleOf } from './nanquimColors.js';

// Onde traduzir (o resto do programa já nasce no Nanquim)
const SCOPE = '.app-screen, .fc-menu';
// Onde NÃO traduzir: cores escolhidas pelo usuário e prévias de tema
const KEEP =
  '.th-window, .cd-window, .hm-swatches, .hm-swatch-caption, .color-selector, .color-dot, .chip-color-dot, .deck-chips-flex, .vx-model, .fc-deck-strip, .fc-tile-color, .theme-preview, [data-keep-colors]';

const records = new Map(); // elemento -> { original, mapped }
let active = false;
let observer = null;

const readMap = (el) => {
  const m = {};
  for (let i = 0; i < el.style.length; i += 1) {
    const p = el.style[i];
    m[p] = [el.style.getPropertyValue(p), el.style.getPropertyPriority(p)];
  }
  return m;
};

const inScope = (el) => el.closest && el.closest(SCOPE) && !el.closest(KEEP);

function processEl(el) {
  if (!(el instanceof HTMLElement) || !el.hasAttribute('style') || !inScope(el)) return;
  const cur = readMap(el);
  const rec = records.get(el);
  // Recupera o "original": o que não mudou desde a nossa tradução volta ao valor antigo
  const original = {};
  let same = Boolean(rec);
  Object.keys(cur).forEach((p) => {
    const mappedBefore = rec && rec.mapped[p];
    if (rec && mappedBefore && mappedBefore[0] === cur[p][0] && p in rec.original) original[p] = rec.original[p];
    else {
      original[p] = cur[p];
      same = false;
    }
  });
  if (same && rec && Object.keys(rec.mapped).length === Object.keys(cur).length) return;

  Object.keys(original).forEach((p) => {
    const role = roleOf(p);
    if (!role) return;
    const [value, priority] = original[p];
    // As cores viram variáveis do tema: trocar tema/noturno não exige refazer
    const next = mapValue(value, role);
    if (next !== el.style.getPropertyValue(p)) el.style.setProperty(p, next, priority);
  });
  records.set(el, { original, mapped: readMap(el) });
}

const scan = (root) => {
  if (!(root instanceof Element)) return;
  if (root.hasAttribute('style')) processEl(root);
  root.querySelectorAll('[style]').forEach(processEl);
};

function restoreAll() {
  records.forEach((rec, el) => {
    if (!el.isConnected) return;
    Object.entries(rec.original).forEach(([p, [value, priority]]) => {
      if (roleOf(p)) el.style.setProperty(p, value, priority);
    });
  });
  records.clear();
}

function start() {
  active = true;
  scan(document.body);
  observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      if (m.type === 'attributes') processEl(m.target);
      else m.addedNodes.forEach(scan);
    });
    // Limpa elementos que saíram da tela
    if (records.size > 4000) records.forEach((_, el) => !el.isConnected && records.delete(el));
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
}

function stop() {
  active = false;
  if (observer) observer.disconnect();
  observer = null;
  restoreAll();
}

function sync() {
  // Nanquim ou modo claro: as cores escritas no código também são traduzidas
  const ui = getUiTheme();
  const want = ui.visual === 'nanquim' || !ui.dark;
  if (want && !active) start();
  else if (!want && active) stop();
}

let installed = false;
export function installNanquimInline() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  const go = () => {
    sync();
    subscribeUiTheme(sync);
  };
  if (document.body) go();
  else document.addEventListener('DOMContentLoaded', go, { once: true });
}
