// =========================================================
// PONTE ENTRE OS MODOS E AS CONFIGURAÇÕES COMPARTILHADAS
// Cada modo (Árvore, Neurônios) publica aqui as opções e ações
// dele enquanto está aberto; as Configurações mostram a seção do
// modo atual usando essas ações.
// =========================================================
import { useSyncExternalStore } from 'react';

let actions = {};
let version = 0;
const listeners = new Set();

export function registerModeActions(mode, value) {
  actions = { ...actions, [mode]: value };
  version += 1;
  listeners.forEach((l) => l());
  return () => {
    if (actions[mode] === value) {
      const next = { ...actions };
      delete next[mode];
      actions = next;
      version += 1;
      listeners.forEach((l) => l());
    }
  };
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useModeActions(mode) {
  useSyncExternalStore(subscribe, () => version);
  return actions[mode] || null;
}

/** Lê as ações de um modo fora de um componente (ex.: ao registrar um evento). */
export function getModeActions(mode) {
  return actions[mode] || null;
}
