import { createContext, useContext } from "react";

/** Dados da árvore + ações (desfazer, pontos, tema...). */
export const ArvoreContext = createContext(null);

/** Ações de interface: abrir janelas de galhos e notas. */
export const UiContext = createContext(null);

export function useArvore() {
  const ctx = useContext(ArvoreContext);
  if (!ctx) throw new Error("useArvore precisa estar dentro de <ArvoreProvider>");
  return ctx;
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi precisa estar dentro de <UiContext.Provider>");
  return ctx;
}
