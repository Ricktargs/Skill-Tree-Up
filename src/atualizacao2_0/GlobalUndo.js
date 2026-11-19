// =========================================================
// DESFAZER / REFAZER GLOBAL (Ctrl+Z / Ctrl+Y)
// ---------------------------------------------------------
// Tudo o que o app decide guardar passa pelo localStorage. Este módulo
// observa essas gravações, junta as que acontecem quase juntas em uma
// única "ação" e mantém uma linha do tempo só, para o programa inteiro:
// habilidades, missões, tarefas, herói, temas, pastas, pomodoro, perfis...
// Ao desfazer, os valores anteriores voltam para o armazenamento e os
// hooks que ouvem `useUndoRestore` recarregam o próprio estado.
// =========================================================
import { useEffect, useRef, useSyncExternalStore } from 'react';

const HISTORY_LIMIT = 100;
const GROUP_MS = 450; // gravações dentro desse intervalo viram uma ação só
const STARTUP_MS = 2000; // ignora migrações e o sorteio automático ao abrir
const SETTLE_MS = 700; // depois de desfazer, os hooks regravam o que recarregaram

// Coisas que não são decisões do usuário (relógio, posição de janelas, controle interno)
const IGNORED = [
  /^pomodoro_runtime/,
  /^last_daily_missions_reset_day$/,
  /__claimed_by/,
  /^task_update_view_v1/,
  /^debug/i,
  /^app_active_mode/,
  /^eu-sou-arvore/,
  // preferências de aparência dos Neurônios (forças do mapa, cor do lápis/marca-texto)
  /^nr-/,
  // boas-vindas / tutorial já vistos
  /^orbe-welcome/
];

// Timers extras: só a configuração conta (iniciar/pausar/tocar não entra no histórico)
const TIMER_RUNTIME_FIELDS = ['endAt', 'totalSeconds', 'isAlarmRinging', 'isActive', 'remaining'];
const COMPARATORS = {
  pomodoro_extra_timers_v1: (raw) => {
    try {
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return raw;
      return JSON.stringify(
        list.map((t) => {
          const copy = { ...t };
          TIMER_RUNTIME_FIELDS.forEach((f) => delete copy[f]);
          return copy;
        })
      );
    } catch (e) {
      return raw;
    }
  }
};

const past = [];
let future = [];
let pending = null;
let pendingTimer = null;
let suppressUntil = Date.now() + STARTUP_MS;
let installed = false;
let version = 0;
const listeners = new Set();

const notify = () => {
  version += 1;
  listeners.forEach((l) => l());
};

const isTracked = (key) => typeof key === 'string' && !IGNORED.some((re) => re.test(key));

// Neurônios: mexer no mapa (posição) ou abrir/fechar abas não é uma "ação" para desfazer
const neuroniosComparable = (raw) => {
  try {
    const v = JSON.parse(raw);
    return JSON.stringify({
      notes: (v.notes || []).map((n) => {
        const copy = { ...n };
        delete copy.x;
        delete copy.y;
        return copy;
      }),
      folders: v.folders || [],
      presets: v.presets || [],
      tagColors: (v.view && v.view.tagColors) || {}
    });
  } catch (e) {
    return raw;
  }
};
const PATTERN_COMPARATORS = [[/^neuronios-v1/, neuroniosComparable]];

const sameValue = (key, a, b) => {
  if (a === b) return true;
  const cmp = COMPARATORS[key] || (PATTERN_COMPARATORS.find(([re]) => re.test(key)) || [])[1];
  if (cmp && a !== null && b !== null) return cmp(a) === cmp(b);
  return false;
};

const closePending = () => {
  clearTimeout(pendingTimer);
  pendingTimer = null;
  if (!pending) return;
  const entry = pending;
  pending = null;
  const keys = Object.keys(entry.before).filter((k) => !sameValue(k, entry.before[k], entry.after[k]));
  if (keys.length === 0) return;
  const before = {};
  const after = {};
  keys.forEach((k) => {
    before[k] = entry.before[k];
    after[k] = entry.after[k];
  });
  past.push({ before, after, at: entry.at });
  if (past.length > HISTORY_LIMIT) past.shift();
  future = [];
  notify();
};

let rawGet = null;
let rawSet = null;
let rawRemove = null;

const track = (key, newValue) => {
  if (Date.now() < suppressUntil || !isTracked(key)) return;
  const oldValue = rawGet.call(window.localStorage, key);
  if (sameValue(key, oldValue, newValue)) return;
  if (!pending) pending = { before: {}, after: {}, at: Date.now() };
  if (!(key in pending.before)) pending.before[key] = oldValue;
  pending.after[key] = newValue;
  clearTimeout(pendingTimer);
  pendingTimer = setTimeout(closePending, GROUP_MS);
};

export function installGlobalUndo() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const proto = Object.getPrototypeOf(window.localStorage);
  rawGet = proto.getItem;
  rawSet = proto.setItem;
  rawRemove = proto.removeItem;

  proto.setItem = function setItem(key, value) {
    if (this === window.localStorage) track(String(key), String(value));
    return rawSet.call(this, key, value);
  };
  proto.removeItem = function removeItem(key) {
    if (this === window.localStorage) track(String(key), null);
    return rawRemove.call(this, key);
  };
}

const applyValues = (values) => {
  suppressUntil = Date.now() + SETTLE_MS;
  Object.entries(values).forEach(([key, value]) => {
    try {
      if (value === null) rawRemove.call(window.localStorage, key);
      else rawSet.call(window.localStorage, key, value);
    } catch (e) {}
  });
  window.dispatchEvent(new CustomEvent('rpg-undo-restore', { detail: { keys: Object.keys(values) } }));
};

const toast = (kind) => window.dispatchEvent(new CustomEvent('rpg-undo-toast', { detail: { kind, id: Date.now() } }));

export function globalUndo() {
  closePending();
  const entry = past.pop();
  if (!entry) return false;
  future.unshift(entry);
  applyValues(entry.before);
  notify();
  toast('undo');
  return true;
}

export function globalRedo() {
  closePending();
  const entry = future.shift();
  if (!entry) return false;
  past.push(entry);
  applyValues(entry.after);
  notify();
  toast('redo');
  return true;
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getVersion = () => version;

// Estado para botões de desfazer/refazer em qualquer janela
export function useGlobalUndo() {
  useSyncExternalStore(subscribe, getVersion);
  return {
    canUndo: past.length > 0 || Boolean(pending),
    canRedo: future.length > 0 && !pending,
    undo: globalUndo,
    redo: globalRedo
  };
}

// Recarrega o estado de um hook quando algum dos seus valores salvos é desfeito/refeito.
// `match` recebe a chave do armazenamento e diz se ela pertence a esse hook.
export function useUndoRestore(match, reload) {
  const ref = useRef({ match, reload });
  useEffect(() => {
    ref.current = { match, reload };
  });
  useEffect(() => {
    const onRestore = (e) => {
      const keys = e.detail?.keys || [];
      const hit = keys.filter((k) => ref.current.match(k));
      if (hit.length > 0) ref.current.reload(hit);
    };
    window.addEventListener('rpg-undo-restore', onRestore);
    return () => window.removeEventListener('rpg-undo-restore', onRestore);
  }, []);
}
