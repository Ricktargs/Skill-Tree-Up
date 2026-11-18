import { memo } from "react";
import RichText from "./RichText";
import { NOTE_DRAG_MIME, getDraggedNoteId, isNoteDrag } from "../lib/dnd";
import { typeKey } from "../lib/constants";

/** Cartão compacto de nota dentro do painel do galho. */
function RecordCard({ record, onOpen, onEdit, onDelete, onDropOnCard }) {
  return (
    <article
      className="record-card"
      data-type={typeKey(record.type)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(NOTE_DRAG_MIME, record.id);
        e.dataTransfer.setData("text/plain", record.title || "nota");
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (isNoteDrag(e)) e.preventDefault();
      }}
      onDrop={(e) => {
        const id = getDraggedNoteId(e);
        if (!id) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        onDropOnCard(id, record.id, e.clientY - rect.top > rect.height / 2);
      }}
      onDoubleClick={() => onOpen(record)}
    >
      <span className="drag-handle" title="Arraste para reordenar ou mover">⋮⋮</span>
      <button type="button" className="icon-button card-maximize" onClick={() => onOpen(record)} title="Abrir nota em janela">
        🗖
      </button>

      <div className="record-card-body">
        <span className="type-pill" data-type={typeKey(record.type)}>{record.type || "Ideia"}</span>
        {record.title && <RichText as="h3" className="clamp-2" text={record.title} recordId={record.id} plain />}
        {record.text && <RichText as="p" className="clamp-2 record-preview" text={record.text} recordId={record.id} plain />}
      </div>

      <div className="record-actions">
        <button type="button" onClick={() => onOpen(record)} title="Abrir e editar na janela">✏️</button>
        <button type="button" onClick={() => onEdit(record)} title="Editar tipo, título e texto aqui no painel">⚙️</button>
        <button type="button" onClick={() => onDelete(record)} title="Excluir nota">🗑️</button>
      </div>
    </article>
  );
}

export default memo(RecordCard);
