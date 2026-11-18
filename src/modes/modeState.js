// =========================================================
// MODO ATIVO DO PROGRAMA: Neurônios · Santuário · Habilidades
// Fora do React para que os atalhos de cada projeto possam
// perguntar rapidamente "estou no meu modo?".
// =========================================================
import { useSyncExternalStore } from 'react';

export const MODES = [
  { id: 'neuronios', name: 'Neurônios', title: 'Neurônios' },
  { id: 'arvore', name: 'Santuário', title: 'Santuário' }, // o id continua 'arvore' (dados salvos)
  { id: 'skills', name: 'Habilidades', title: 'Habilidades' }
];

const STORAGE_KEY = 'app_active_mode_v1';
const DEFAULT_MODE = 'skills';

const read = () => {
  try {
    let v = localStorage.getItem(STORAGE_KEY);
    if (v === 'mente') v = 'neuronios'; // nome antigo do modo
    return MODES.some((m) => m.id === v) ? v : DEFAULT_MODE;
  } catch (e) {
    return DEFAULT_MODE;
  }
};

let current = read();
const listeners = new Set();

export const getMode = () => current;
export const isSkillsMode = () => current === 'skills';

export function setMode(id) {
  if (!MODES.some((m) => m.id === id) || id === current) return;
  current = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch (e) {
    // sem armazenamento: o modo vale só nesta aba
  }
  listeners.forEach((l) => l());
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useMode = () => useSyncExternalStore(subscribe, getMode);
