// =========================================================
// TUTORIAL — aberto ou fechado (pode ser chamado de qualquer lugar)
// =========================================================
import { useSyncExternalStore } from 'react';

let open = false;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export const startTutorial = () => {
  open = true;
  emit();
};
export const stopTutorial = () => {
  open = false;
  emit();
};
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useTutorialOpen = () => useSyncExternalStore(subscribe, () => open);
