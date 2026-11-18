/* Arrastar notas entre painéis, pastas e galhos da árvore. */
export const NOTE_DRAG_MIME = "application/x-arvore-note";

export function getDraggedNoteId(e) {
  return e.dataTransfer?.getData(NOTE_DRAG_MIME) || null;
}

export function isNoteDrag(e) {
  return Array.from(e.dataTransfer?.types || []).includes(NOTE_DRAG_MIME);
}
