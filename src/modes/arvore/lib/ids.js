import { PASTEL_COLORS } from "./constants";

export function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "id_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
}

export function hashString(str) {
  let hash = 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Cor pastel determinística para um id. */
export function colorForId(id) {
  if (!id) return PASTEL_COLORS[0];
  return PASTEL_COLORS[hashString(id) % PASTEL_COLORS.length];
}
