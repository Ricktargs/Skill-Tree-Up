import { useState } from "react";
import { NOTE_TYPES } from "../lib/constants";
import { htmlToPlainIfSimple, plainToHtml } from "../lib/html";

/** Formulário simples de nota (criar / editar no painel ou nota rápida). */
export default function NoteForm({ initial, onOpenFull, onSave, onCancel, submitLabel, titlePlaceholder, autoFocusTitle = false }) {
  const [type, setType] = useState(initial?.type || "Ideia");
  const [title, setTitle] = useState(initial?.title || "");
  const initialPlain = htmlToPlainIfSimple(initial?.text || "");
  const richContent = initialPlain === null;
  const [text, setText] = useState(richContent ? "" : initialPlain);

  const canSave = title.trim() || (richContent ? initial?.text : text.trim());

  const submit = (e) => {
    e.preventDefault();
    if (!canSave) return;
    onSave({ type, title: title.trim(), text: richContent ? initial.text : plainToHtml(text.trim()) });
  };

  return (
    <form className="record-form" onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <label>
        Tipo
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {NOTE_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>

      <label>
        Título
        <input
          type="text"
          placeholder={titlePlaceholder || "Ex.: Ler livro sobre [foco]"}
          value={title}
          autoFocus={autoFocusTitle || !initial}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      {richContent ? (
        <div className="rich-notice">
          Esta nota tem formatação/imagens. Edite o conteúdo na janela da nota.
          {onOpenFull && (
            <button type="button" className="btn small" onClick={onOpenFull}>
              Abrir editor completo
            </button>
          )}
        </div>
      ) : (
        <label>
          Anotação
          <textarea
            placeholder="Use [palavra] para conectar com notas de outros galhos..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(e);
            }}
          />
        </label>
      )}

      <div className="form-buttons">
        <button type="button" className="cancel-button" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="save-button" disabled={!canSave}>
          {submitLabel || (initial ? "Salvar alterações" : "Salvar")}
        </button>
      </div>
    </form>
  );
}
