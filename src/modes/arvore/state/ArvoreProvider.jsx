import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ArvoreContext } from "./contexts";
import { INITIAL_TREE, STORAGE_KEYS, MAX_UNDO } from "../lib/constants";
import { computePoints } from "../lib/points";
import { loadJSON, saveJSON, loadString, saveString, saveDailyRevision } from "../lib/storage";
import { cloneDeep, isValidTree } from "../lib/tree";
import { repairData } from "../lib/folders";
import { generateId } from "../lib/ids";
import { sfx } from "../lib/sound";

function loadInitialData() {
  const savedTree = loadJSON(STORAGE_KEYS.tree, null);
  const records = loadJSON(STORAGE_KEYS.records, []);
  const offsets = loadJSON(STORAGE_KEYS.offsets, {});
  const foldersMap = loadJSON(STORAGE_KEYS.folders, {});
  return repairData({
    tree: isValidTree(savedTree) ? savedTree : cloneDeep(INITIAL_TREE),
    records: Array.isArray(records) ? records.filter((r) => r && r.id) : [],
    offsets: offsets && typeof offsets === "object" ? offsets : {},
    foldersMap: foldersMap && typeof foldersMap === "object" ? foldersMap : {},
  });
}

function historyReducer(state, action) {
  switch (action.type) {
    case "commit": {
      const result = action.fn(state.data);
      if (!result || result === state.data) return state;
      const next = repairData(result);
      return {
        data: next,
        past: [...state.past, state.data].slice(-MAX_UNDO),
        future: [],
      };
    }
    case "undo": {
      if (!state.past.length) return state;
      return {
        data: state.past[state.past.length - 1],
        past: state.past.slice(0, -1),
        future: [state.data, ...state.future],
      };
    }
    case "redo": {
      if (!state.future.length) return state;
      return {
        data: state.future[0],
        past: [...state.past, state.data],
        future: state.future.slice(1),
      };
    }
    default:
      return state;
  }
}

export default function ArvoreProvider({ children }) {
  const [state, dispatch] = useReducer(historyReducer, undefined, () => ({
    data: loadInitialData(),
    past: [],
    future: [],
  }));
  const { data } = state;

  const [darkMode, setDarkMode] = useState(() => loadString(STORAGE_KEYS.theme) === "dark");
  const [showPoints, setShowPoints] = useState(() => loadString(STORAGE_KEYS.showPoints) !== "false");
  const [storageError, setStorageError] = useState(false);
  const [pointsLog, setPointsLog] = useState(() => {
    const saved = loadJSON(STORAGE_KEYS.pointsLog, []);
    return Array.isArray(saved)
      ? saved.map((item) => ({ ...item, descricao: item.descricao || "Registro de evolução anterior" }))
      : [];
  });

  /* ---------- Persistência (só grava o que mudou) ---------- */
  const savedRef = useRef({});
  useEffect(() => {
    const parts = [
      ["tree", STORAGE_KEYS.tree],
      ["records", STORAGE_KEYS.records],
      ["offsets", STORAGE_KEYS.offsets],
      ["foldersMap", STORAGE_KEYS.folders],
    ];
    let ok = true;
    for (const [field, key] of parts) {
      if (savedRef.current[field] === data[field]) continue;
      if (saveJSON(key, data[field])) savedRef.current[field] = data[field];
      else ok = false;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reflete o resultado de um sistema externo (localStorage)
    setStorageError(!ok);
  }, [data]);

  /* ---------- Ponto de restauração diário (IndexedDB) ---------- */
  useEffect(() => {
    const t = setTimeout(() => saveDailyRevision(data), 2000);
    return () => clearTimeout(t);
  }, [data]);

  useEffect(() => {
    saveString(STORAGE_KEYS.theme, darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => saveString(STORAGE_KEYS.showPoints, String(showPoints)), [showPoints]);
  useEffect(() => {
    saveJSON(STORAGE_KEYS.pointsLog, pointsLog);
  }, [pointsLog]);

  const points = useMemo(() => computePoints(data), [data]);
  const pointsRef = useRef(points);
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  const commit = useCallback((fn) => dispatch({ type: "commit", fn }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);

  const logPoints = useCallback((pts, descricao) => {
    if (!pts) return;
    sfx.play("grow");
    setPointsLog((log) => [
      {
        id: generateId(),
        pontos: pts,
        total: pointsRef.current + pts,
        descricao,
        data: new Date().toLocaleString("pt-BR"),
      },
      ...log,
    ]);
  }, []);

  const value = useMemo(
    () => ({
      data,
      commit,
      undo,
      redo,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      darkMode,
      setDarkMode,
      showPoints,
      setShowPoints,
      points,
      pointsLog,
      setPointsLog,
      logPoints,
      storageError,
    }),
    [data, commit, undo, redo, state.past.length, state.future.length, darkMode, showPoints, points, pointsLog, logPoints, storageError]
  );

  return <ArvoreContext.Provider value={value}>{children}</ArvoreContext.Provider>;
}
