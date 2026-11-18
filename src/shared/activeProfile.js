// =========================================================
// PERFIL ATIVO (compartilhado pelos três modos)
// As Habilidades mandam no perfil (useGameData); a Árvore e os
// Neurônios só leem, para carregar os dados do perfil certo.
// =========================================================
import { useSyncExternalStore } from 'react';

const read = () => {
  try {
    return localStorage.getItem('rpg_active_profile_id') || 'profile_default';
  } catch (e) {
    return 'profile_default';
  }
};

let current = read();
const listeners = new Set();

export const getActiveProfileId = () => current;

export function publishActiveProfile(id) {
  if (!id || id === current) return;
  current = id;
  listeners.forEach((l) => l());
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useActiveProfileId = () => useSyncExternalStore(subscribe, getActiveProfileId);
