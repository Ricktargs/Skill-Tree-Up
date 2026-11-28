// =========================================================
// APARÊNCIA GERAL (vale para Neurônios, Árvore e Habilidades)
//   visual: 'nanquim' (papel e tinta, padrão) | 'gamificado' (visual antigo)
//   dark:   modo noturno (o botão 🌙 existe nos três modos)
// Aplicado como atributos no <html>: data-ui-theme e data-ui-dark
// =========================================================
import { useSyncExternalStore } from 'react';
import { NANQUIM_THEMES, nanquimVars, getNanquimTheme } from './nanquimThemes.js';

// O Nanquim saiu: o programa usa só o visual Gameficado
export const VISUAL_THEMES = [{ id: 'gamificado', name: 'Gameficado', desc: 'O visual de jogo original das Habilidades' }];

const DARK_KEY = 'eu-sou-arvore-theme'; // a mesma chave que a Árvore já usava
const VISUAL_KEY = 'ui_visual_theme_v1';
const NQ_KEY = 'ui_nanquim_theme_v1';
const validNq = (id) => (NANQUIM_THEMES.some((t) => t.id === id) ? id : 'classico');

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // sem armazenamento: vale só nesta aba
  }
};

let state = {
  dark: read(DARK_KEY) !== 'light', // modo noturno é o padrão
  visual: 'gamificado',
  nq: validNq(read(NQ_KEY))
};

const listeners = new Set();

const apply = () => {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.setAttribute('data-ui-theme', state.visual);
  html.setAttribute('data-ui-dark', String(state.dark));
  // Tema do Nanquim: papel, tinta e aquarela como variáveis CSS
  html.setAttribute('data-nq-theme', state.nq);
  html.setAttribute('data-nq-follow', String(Boolean(getNanquimTheme(state.nq).follow)));
  Object.entries(nanquimVars(state.nq, state.dark)).forEach(([k, v]) => html.style.setProperty(k, v));
  html.style.colorScheme = state.visual === 'gamificado' || state.dark ? 'dark' : 'light';
};
apply();

const set = (patch) => {
  state = { ...state, ...patch };
  write(DARK_KEY, state.dark ? 'dark' : 'light');
  write(VISUAL_KEY, state.visual);
  write(NQ_KEY, state.nq);
  apply();
  listeners.forEach((l) => l());
};

export const getUiTheme = () => state;
export const setDark = (dark) => set({ dark: Boolean(dark) });
export const toggleDark = () => set({ dark: !state.dark });
export const setVisual = (visual) => VISUAL_THEMES.some((t) => t.id === visual) && set({ visual });
// Escolher um tema do Nanquim já liga o estilo Nanquim
export const setNanquimTheme = (id) => set({ nq: validNq(id) });

// Desfazer/refazer (Ctrl+Z) pode mudar as chaves por baixo: relê
export const reloadUiTheme = () => {
  state = {
    dark: read(DARK_KEY) !== 'light', // modo noturno é o padrão
    visual: 'gamificado',
    nq: validNq(read(NQ_KEY))
  };
  apply();
  listeners.forEach((l) => l());
};

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const subscribeUiTheme = subscribe;
export const useUiTheme = () => useSyncExternalStore(subscribe, getUiTheme);
