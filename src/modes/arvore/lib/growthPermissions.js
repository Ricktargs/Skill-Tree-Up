/* =========================================================
   PERMISSÕES DE CRESCIMENTO DA ÁRVORE (por perfil)
   fork:          true / false / null (ainda não perguntado)
   trees:         quantas árvores novas ao lado estão liberadas
   declinedTrees: a pessoa preferiu que a árvore cresça só sozinha
   As duas opções começam desligadas e a Árvore nunca pergunta
   sozinha: a pergunta (Sim / Não) aparece só ao ligar nas Configurações.
========================================================= */
import { useEffect, useSyncExternalStore } from "react";
import { loadJSON, saveJSON } from "./storage";
import { ask } from "../../../shared/Dialog.jsx";
import { tx } from "../../../i18n/index.jsx";
import { registerModeActions } from "../../../shared/modeBridge.js";

const KEY = "eu-sou-arvore-growth";
const DEFAULT = { fork: false, trees: 0, declinedTrees: true };

let state = null;
const listeners = new Set();

const read = () => {
  const v = loadJSON(KEY, null);
  return v && typeof v === "object" ? { ...DEFAULT, ...v } : { ...DEFAULT };
};

const get = () => {
  if (!state) state = read();
  return state;
};

export function setGrowth(patch) {
  state = { ...get(), ...patch };
  saveJSON(KEY, state);
  listeners.forEach((l) => l());
}

/** Relê do armazenamento (troca de perfil / Ctrl+Z). */
export function reloadGrowth() {
  state = read();
  listeners.forEach((l) => l());
}

/**
 * Recusa ter mais de uma árvore. Se já havia árvores ao lado, pergunta antes
 * e devolve os galhos delas para a árvore principal, junto dos outros.
 */
export async function refuseExtraTrees() {
  const cur = get();
  if ((cur.trees || 0) > 0) {
    const ok = await ask({
      icon: "🌳",
      title: tx("Voltar a ser uma árvore só?"),
      message:
        tx("Os galhos das árvores ao lado voltam para a árvore principal, junto dos outros. Nenhum galho ou anotação é apagado.\n\nDepois disso, a Árvore não vai mais perguntar sobre árvores novas (dá para liberar de novo nas Configurações)."),
      yes: tx("Juntar numa só"),
      no: tx("Cancelar"),
    });
    if (!ok) return false;
  }
  setGrowth({ trees: 0, declinedTrees: true });
  return true;
}

/** Ligar "Dividir o tronco": confirma antes. */
export async function askFork() {
  const ok = await ask({
    icon: "🌳",
    title: tx("Dividir o tronco?"),
    message:
      tx("Quando a Árvore tiver muitos galhos, o tronco se divide em dois, com um nascendo de dentro do outro.\n\nDá para desligar quando quiser nas Configurações."),
    yes: tx("Pode dividir"),
    no: tx("Manter um tronco só"),
  });
  setGrowth({ fork: ok });
  return ok;
}

/** Ligar "Árvores novas ao lado": confirma antes. */
export async function askTrees() {
  const ok = await ask({
    icon: "🌱",
    title: tx("Árvores novas ao lado?"),
    message:
      tx("Quando a Árvore ficar grande demais, os galhos mais novos crescem numa árvore ao lado, ligada pelas raízes.\n\nDá para desligar quando quiser: os galhos voltam para a árvore principal."),
    yes: tx("Pode crescer"),
    no: tx("Só a mesma árvore"),
  });
  setGrowth(ok ? { trees: 99, declinedTrees: false } : { trees: 0, declinedTrees: true });
  return ok;
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useGrowthPermissions() {
  // A Árvore é montada de novo a cada perfil: relê ao montar
  useEffect(() => {
    reloadGrowth();
  }, []);
  const value = useSyncExternalStore(subscribe, get);

  // Opções nas Configurações (seção Árvore)
  useEffect(
    () =>
      registerModeActions("arvoreGrowth", {
        fork: value.fork,
        allowTrees: !value.declinedTrees && value.trees > 0,
        extraTrees: !value.declinedTrees && value.trees > 0,
        // Desativadas por padrão; ao ligar, pergunta antes
        setFork: (v) => (v ? askFork() : setGrowth({ fork: false })),
        setAllowTrees: (v) => (v ? askTrees() : refuseExtraTrees()),
        mergeTrees: refuseExtraTrees,
      }),
    [value]
  );
  return [value, setGrowth];
}
