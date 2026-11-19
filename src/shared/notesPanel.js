// =========================================================
// EDITOR DE NOTAS (✏️) — aberto ou fechado, em qualquer modo
// =========================================================
import { useSyncExternalStore } from 'react';

let open = false;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export const setNotesPanelOpen = (value) => {
  const next = typeof value === 'function' ? value(open) : Boolean(value);
  if (next === open) return;
  open = next;
  emit();
};
export const toggleNotesPanel = () => setNotesPanelOpen((v) => !v);
export const isNotesPanelOpen = () => open;

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useNotesPanelOpen = () => useSyncExternalStore(subscribe, isNotesPanelOpen);
