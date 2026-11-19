// =========================================================
// ONDE O ORBE-G ESTÁ RODANDO + ATUALIZAÇÃO
//   'windows' / 'mac' / 'linux' → app de PC (Electron)
//   'android'                   → app de celular (Capacitor)
//   'web'                       → navegador (site no Vercel ou index.html)
// Cada um se atualiza do seu jeito:
//   Windows: baixa e reinstala sozinho (electron-updater)
//   Mac / Android: baixa o instalador novo do GitHub
//   Site: recarrega a página com a versão nova publicada
// =========================================================
import { useSyncExternalStore } from 'react';
import { desktop, isDesktopApp, openLink } from './desktop.js';
import { ask, inform } from './Dialog.jsx';

/* global __APP_VERSION__, __BUILD_ID__ */
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

const REPO = 'Ricktargs/Skill-Tree-Up';
const RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const DL = `https://github.com/${REPO}/releases/latest/download`;
export const DOWNLOADS = {
  windows: { label: 'Windows', icon: '🪟', file: 'ORBE-G-Instalador.exe', url: `${DL}/ORBE-G-Instalador.exe` },
  mac: { label: 'Mac', icon: '🍎', file: 'ORBE-G-Mac.dmg', url: `${DL}/ORBE-G-Mac.dmg` },
  android: { label: 'Android', icon: '🤖', file: 'ORBE-G-Android.apk', url: `${DL}/ORBE-G-Android.apk` },
  // iPhone: a Apple só deixa instalar fora da App Store pela Tela de Início (Safari)
  iphone: { label: 'iPhone', icon: '📱', file: 'Tela de Início (Safari)', url: null }
};
export const SITE_URL = 'https://skill-tree-up.vercel.app';
const UA = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
const IS_IOS = /iphone|ipad|ipod/i.test(UA) || (/macintosh/i.test(UA) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
// Aberto pelo ícone da Tela de Início do iPhone
export const IS_IOS_HOME = IS_IOS && typeof window !== 'undefined' && (window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches));
export const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;

const capacitor = typeof window !== 'undefined' ? window.Capacitor : null;
const isAndroidApp = Boolean(capacitor && capacitor.isNativePlatform && capacitor.isNativePlatform() && capacitor.getPlatform() === 'android');

export const PLATFORM = isDesktopApp
  ? { win32: 'windows', darwin: 'mac' }[desktop.platform] || 'linux'
  : isAndroidApp
    ? 'android'
    : 'web';

export const PLATFORM_LABEL = {
  windows: 'App para Windows',
  mac: 'App para Mac',
  linux: 'App para Linux',
  android: 'App para Android',
  web: IS_IOS_HOME ? 'App do iPhone (Tela de Início)' : 'Navegador (site)'
}[PLATFORM];

// Sistema de quem está no site (para destacar o download certo)
export const visitorSystem = (() => {
  if (PLATFORM !== 'web') return PLATFORM;
  const ua = UA;
  if (IS_IOS) return 'iphone';
  if (/android/i.test(ua)) return 'android';
  if (/mac os x|macintosh/i.test(ua) && !/iphone|ipad/i.test(ua)) return 'mac';
  if (/windows/i.test(ua)) return 'windows';
  return null;
})();

// 1.2.10 > 1.2.9
const newer = (a, b) => {
  const pa = String(a || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
};

// ---------- Estado ----------
// status: idle | checking | none | available | downloading | ready | error
let state = { status: 'idle', version: null, progress: 0, checkedAt: null };
const listeners = new Set();
const set = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useUpdate = () => useSyncExternalStore(subscribe, () => state);
export const hasUpdate = (s = state) => s.status === 'available' || s.status === 'ready';

const selfUpdating = PLATFORM === 'windows' && desktop && desktop.installUpdate;

async function checkGithub() {
  const r = await fetch(RELEASE_API, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } });
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  const rel = await r.json();
  const latest = String(rel.tag_name || '').replace(/^v/i, '');
  return newer(latest, APP_VERSION) ? latest : null;
}

async function checkWeb() {
  if (import.meta.env.DEV || BUILD_ID === 'dev') return null; // rodando com "npm run dev"
  if (window.location.protocol === 'file:') return null; // aberto pelo index.html (sem servidor)
  const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) return null;
  let v = null;
  try {
    v = await r.json();
  } catch {
    return null;
  }
  return v && v.buildId && v.buildId !== BUILD_ID ? v.version || 'nova' : null;
}

export async function checkForUpdate() {
  if (state.status === 'checking' || state.status === 'downloading') return state;
  set({ status: 'checking' });
  try {
    if (selfUpdating) {
      const s = await desktop.checkUpdate();
      if (!s || s.status === 'unsupported') set({ status: 'none', checkedAt: Date.now() });
      else if (s.status !== 'checking') set({ ...s, checkedAt: Date.now() });
      return state;
    }
    const v = PLATFORM === 'web' ? await checkWeb() : await checkGithub();
    set({ status: v ? 'available' : 'none', version: v, checkedAt: Date.now() });
  } catch (e) {
    set({ status: 'error', error: String((e && e.message) || e), checkedAt: Date.now() });
  }
  return state;
}

// Clicou em "Atualizar"
export function installUpdate() {
  if (PLATFORM === 'web') {
    window.location.reload();
    return;
  }
  if (selfUpdating) {
    set({ status: 'downloading', progress: 0 });
    desktop.installUpdate();
    return;
  }
  const d = DOWNLOADS[PLATFORM];
  if (!d) return openLink(RELEASES_PAGE);
  if (PLATFORM === 'android') {
    // abre no navegador do celular, que baixa o APK novo e oferece instalar por cima
    window.location.href = d.url;
  } else openLink(d.url);
}

// Como instalar no iPhone (pelo Safari, sem App Store)
export async function showIphoneHelp() {
  const inSafari = IS_IOS && !/crios|fxios|edgios/i.test(UA);
  const steps = [
    'No iPhone o ORBE-G é instalado direto do site: ganha ícone na Tela de Início, abre em tela cheia como app e se atualiza sozinho.',
    '',
    `1. Abra no Safari: ${SITE_URL.replace('https://', '')}`,
    '2. Toque em Compartilhar (o quadrado com a seta ↑).',
    '3. Toque em “Adicionar à Tela de Início” e depois em “Adicionar”.'
  ].join('\n');
  if (IS_IOS_HOME) {
    await inform({ title: '📱 Você já está no app do iPhone', message: 'Este ORBE-G já foi instalado pela Tela de Início. As atualizações chegam sozinhas.' });
    return;
  }
  if (inSafari) {
    await inform({ title: '📱 Instalar no iPhone', message: steps });
    return;
  }
  const copy = await ask({ title: '📱 Instalar no iPhone', message: steps, yes: 'Copiar link do site', no: 'Fechar' });
  if (!copy) return;
  try {
    await navigator.clipboard.writeText(SITE_URL);
    await inform({ title: 'Link copiado!', message: `Cole no Safari do iPhone: ${SITE_URL}` });
  } catch {
    await inform({ title: 'Link do site', message: SITE_URL });
  }
}

// Botão de download de um sistema (iPhone mostra o passo a passo)
export function downloadFor(id) {
  if (id === 'iphone') return showIphoneHelp();
  const d = DOWNLOADS[id];
  return d && d.url ? openDownload(d.url) : openDownload(RELEASES_PAGE);
}

// Abre um link de download (no Android o navegador do celular cuida do arquivo)
export function openDownload(url) {
  if (PLATFORM === 'android') window.location.href = url;
  else openLink(url);
}

// Só no "npm run dev": permite simular uma atualização para testar a tela
if (import.meta.env.DEV && typeof window !== 'undefined') window.__orbeUpdateTest = (patch) => set(patch);

// ---------- Começa a vigiar ----------
let started = false;
export function startUpdateWatch() {
  if (started || typeof window === 'undefined') return;
  started = true;
  if (selfUpdating && desktop.onUpdateState) {
    desktop.onUpdateState((s) => set(s));
  }
  const every = PLATFORM === 'web' ? 30 * 60 * 1000 : 6 * 60 * 60 * 1000;
  setTimeout(checkForUpdate, 10000);
  setInterval(() => {
    if (!hasUpdate()) checkForUpdate();
  }, every);
}
