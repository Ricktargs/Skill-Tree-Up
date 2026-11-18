import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ask, askText } from "../../../shared/Dialog.jsx";
import { createPortal } from "react-dom";
import { portalRoot } from "../lib/portal";
import FloatingWindow from "./FloatingWindow";
import RichText from "./RichText";
import ColorPicker from "./ColorPicker";
import ImageEditorModal from "./ImageEditorModal";
import { useArvore } from "../state/contexts";
import { FEELINGS, NOTE_TYPES, typeKey } from "../lib/constants";
import { getEffectiveBranchId, getItemName } from "../lib/folders";
import { noteToHtml, sanitizeHtml, stripHtml, recordLabel, downscaleImage, readFileAsDataUrl } from "../lib/html";
import { sfx } from "../lib/sound";

function formatDate(value, withTime = false) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return withTime
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : d.toLocaleDateString("pt-BR");
}

/** Janela flutuante de uma nota (visualizar e editar com texto rico). */
export default function NoteWindow({ record, ...windowProps }) {
  const { data } = useArvore();
  const branchName = getItemName(data.tree, data.foldersMap, getEffectiveBranchId(data.tree, data.foldersMap, record));
  return (
    <FloatingWindow {...windowProps} title={`Nota · ${branchName}`} icon="📝" className="note-window" width={720} height={560} minWidth={360} minHeight={320}>
      <NoteBody record={record} />
    </FloatingWindow>
  );
}

function NoteBody({ record }) {
  const { commit } = useArvore();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(record.title || "");
  const [type, setType] = useState(record.type || "Ideia");
  const [charCount, setCharCount] = useState(() => stripHtml(record.text || "").length);
  const [selectedImg, setSelectedImg] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [editingImgSrc, setEditingImgSrc] = useState(null);
  const [feelingOpen, setFeelingOpen] = useState(false);

  const editorRef = useRef(null);
  const fileRef = useRef(null);
  const savedRange = useRef(null);
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const lastSnapshot = useRef(0);
  const feelingRef = useRef(null);

  const feeling = record.feeling || "";
  const feelingObj = FEELINGS.find((f) => f.emoji === feeling || f.label === feeling || `${f.emoji} ${f.label}` === feeling);

  /* Preenche o editor ao entrar no modo de edição. */
  useLayoutEffect(() => {
    if (!isEditing || !editorRef.current) return;
    const initial = noteToHtml(record.text || "");
    editorRef.current.innerHTML = initial;
    undoStack.current = [initial];
    redoStack.current = [];
    editorRef.current.focus();
    // só ao entrar em edição: o conteúdo do editor é controlado pelo DOM
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  useEffect(() => {
    if (!feelingOpen) return;
    const close = (e) => !feelingRef.current?.contains(e.target) && setFeelingOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [feelingOpen]);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = (e) => !e.target.closest(".img-context-menu") && setCtxMenu(null);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [ctxMenu]);

  const updateRecord = (patch) =>
    commit((d) => ({
      ...d,
      records: d.records.map((r) => (r.id === record.id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r)),
    }));

  /* ---------------- histórico local do editor ---------------- */
  const snapshot = (force = false) => {
    const html = editorRef.current?.innerHTML ?? "";
    const stack = undoStack.current;
    const now = Date.now();
    if (stack[stack.length - 1] === html) return;
    if (!force && now - lastSnapshot.current < 600 && stack.length) return;
    stack.push(html);
    if (stack.length > 100) stack.shift();
    redoStack.current = [];
    lastSnapshot.current = now;
  };

  const restoreHtml = (html) => {
    editorRef.current.innerHTML = html;
    setSelectedImg(null);
    setCharCount(stripHtml(html).length);
  };

  const editorUndo = () => {
    const current = editorRef.current.innerHTML;
    const stack = undoStack.current;
    while (stack.length && stack[stack.length - 1] === current) stack.pop();
    if (!stack.length) {
      stack.push(current);
      return;
    }
    redoStack.current.push(current);
    restoreHtml(stack[stack.length - 1]);
  };

  const editorRedo = () => {
    const next = redoStack.current.pop();
    if (next === undefined) return;
    undoStack.current.push(editorRef.current.innerHTML);
    restoreHtml(next);
  };

  /* ---------------- seleção / comandos ---------------- */
  const rememberSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && editorRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    if (savedRange.current) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  const exec = (command, value = null) => {
    snapshot(true);
    restoreSelection();
    document.execCommand("styleWithCSS", false, true);
    document.execCommand(command, false, value);
    rememberSelection();
    snapshot(true);
    setCharCount(stripHtml(editorRef.current.innerHTML).length);
  };

  const changeFontSize = (delta) => {
    restoreSelection();
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    snapshot(true);
    let parent = range.commonAncestorContainer;
    if (parent.nodeType === 3) parent = parent.parentNode;
    const current = parseFloat(window.getComputedStyle(parent).fontSize) || 14;
    const span = document.createElement("span");
    span.style.fontSize = `${Math.max(9, Math.min(48, Math.round(current + delta)))}px`;
    span.appendChild(range.extractContents());
    range.insertNode(span);
    sel.removeAllRanges();
    const r = document.createRange();
    r.selectNodeContents(span);
    sel.addRange(r);
    rememberSelection();
    snapshot(true);
  };

  /* ---------------- imagens ---------------- */
  const insertImage = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const src = await downscaleImage(await readFileAsDataUrl(file));
    snapshot(true);
    restoreSelection();
    document.execCommand(
      "insertHTML",
      false,
      `<img src="${src}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 12px auto; display: block;" />`
    );
    rememberSelection();
    snapshot(true);
  };

  const mutateImage = (fn) => {
    if (!selectedImg) return;
    snapshot(true);
    fn(selectedImg);
    snapshot(true);
    setCtxMenu(null);
  };

  const alignImage = (position) =>
    mutateImage((img) => {
      Object.assign(img.style, { position: "", left: "", top: "", float: "none", cursor: "" });
      img.removeAttribute("title");
      if (position === "left") Object.assign(img.style, { display: "block", margin: "12px auto 12px 0" });
      if (position === "center") Object.assign(img.style, { display: "block", margin: "12px auto" });
      if (position === "right") Object.assign(img.style, { display: "block", margin: "12px 0 12px auto" });
      if (position === "float-left") Object.assign(img.style, { display: "inline-block", float: "left", margin: "0 12px 12px 0" });
      if (position === "float-right") Object.assign(img.style, { display: "inline-block", float: "right", margin: "0 0 12px 12px" });
      if (position === "free") {
        Object.assign(img.style, { display: "inline-block", position: "relative", cursor: "move" });
        img.title = "Arraste para posicionar livremente";
      }
    });

  const resizeImage = (width) => mutateImage((img) => (img.style.width = width));

  const customResize = async () => {
    const value = await askText({
      title: "Largura da imagem",
      message: "Exemplos: 300px, 50%",
      value: selectedImg?.style.width || "100%",
    });
    if (value && /^\d+(\.\d+)?(px|%|vw|em|rem)$/.test(value.trim())) resizeImage(value.trim());
    else setCtxMenu(null);
  };

  const removeImage = () =>
    mutateImage((img) => {
      img.remove();
      setSelectedImg(null);
    });

  const handleEditorPointerDown = (e) => {
    const img = e.target.tagName === "IMG" ? e.target : null;
    if (!img || e.button !== 0 || img.style.position !== "relative") return;
    e.preventDefault();
    snapshot(true);
    const start = { x: e.clientX, y: e.clientY, left: parseFloat(img.style.left) || 0, top: parseFloat(img.style.top) || 0 };
    const move = (ev) => {
      img.style.left = `${start.left + ev.clientX - start.x}px`;
      img.style.top = `${start.top + ev.clientY - start.y}px`;
    };
    const up = () => {
      snapshot(true);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* ---------------- salvar / cancelar ---------------- */
  const save = () => {
    const html = sanitizeHtml(editorRef.current?.innerHTML || "");
    const isEmpty = !stripHtml(html).trim() && !/<img/i.test(html);
    updateRecord({ title: title.trim(), type, text: isEmpty ? "" : html });
    sfx.play("save");
    setIsEditing(false);
    setSelectedImg(null);
  };

  const cancel = async () => {
    const changed = editorRef.current && editorRef.current.innerHTML !== noteToHtml(record.text || "");
    if ((changed || title !== (record.title || "")) && !(await ask({ title: "Descartar as alterações?", yes: "Descartar", no: "Continuar editando", danger: true }))) return;
    setTitle(record.title || "");
    setType(record.type || "Ideia");
    setCharCount(stripHtml(record.text || "").length);
    setIsEditing(false);
    setSelectedImg(null);
  };

  const remove = async () => {
    if (!(await ask({ title: "Excluir a nota?", message: `"${recordLabel(record)}"\n(Ctrl+Z desfaz)`, yes: "Excluir", danger: true }))) return;
    sfx.play("delete");
    commit((d) => ({ ...d, records: d.records.filter((r) => r.id !== record.id) }));
  };

  const noFocus = (e) => e.preventDefault();

  /* ---------------- render ---------------- */
  return (
    <div className="note-body">
      <input
        type="file"
        ref={fileRef}
        accept="image/*"
        hidden
        onChange={(e) => {
          insertImage(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="note-heading">
        {isEditing ? (
          <>
            <select className="type-select" value={type} onChange={(e) => setType(e.target.value)}>
              {NOTE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input className="title-input" type="text" value={title} placeholder="Título da nota..." onChange={(e) => setTitle(e.target.value)} />
          </>
        ) : (
          <>
            <div className="type-pill" data-type={typeKey(record.type)}>{record.type || "Anotação"}</div>
            {record.title && <RichText as="h2" text={record.title} recordId={record.id} />}
          </>
        )}
        <hr />
      </div>

      {isEditing ? (
        <div className="editor-wrap">
          <div className="toolbar" onMouseDown={(e) => e.target.closest("button") && noFocus(e)}>
            {selectedImg ? (
              <>
                <button type="button" className="tool" onClick={() => setEditingImgSrc(selectedImg.src)}>✏️ Desenhar / Cortar</button>
                <span className="toolbar-sep" />
                <button type="button" className="tool" onClick={() => alignImage("left")} title="Esquerda">⬅️</button>
                <button type="button" className="tool" onClick={() => alignImage("center")} title="Centro">🎯</button>
                <button type="button" className="tool" onClick={() => alignImage("right")} title="Direita">➡️</button>
                <span className="toolbar-sep" />
                <button type="button" className="tool" onClick={() => resizeImage("100%")}>100%</button>
                <button type="button" className="tool" onClick={() => resizeImage("50%")}>50%</button>
                <span className="toolbar-sep" />
                <button type="button" className="tool danger" onClick={removeImage}>❌ Remover</button>
                <button type="button" className="tool push-right" onClick={() => setSelectedImg(null)}>✔️ Texto</button>
              </>
            ) : (
              <>
                <button type="button" className="tool" onClick={() => exec("bold")} title="Negrito (Ctrl+B)"><b>B</b></button>
                <button type="button" className="tool" onClick={() => exec("italic")} title="Itálico (Ctrl+I)"><i>I</i></button>
                <button type="button" className="tool" onClick={() => exec("underline")} title="Sublinhado (Ctrl+U)"><u>U</u></button>
                <button type="button" className="tool" onClick={() => exec("strikeThrough")} title="Tachado"><s>S</s></button>
                <span className="toolbar-sep" />
                <button type="button" className="tool" onClick={() => changeFontSize(-2)} title="Diminuir fonte">A-</button>
                <button type="button" className="tool" onClick={() => changeFontSize(2)} title="Aumentar fonte">A+</button>
                <select
                  className="tool"
                  defaultValue=""
                  title="Fonte"
                  onChange={(e) => {
                    exec("fontName", e.target.value || "Arial, sans-serif");
                    e.target.value = "";
                  }}
                >
                  <option value="">🔤 Fonte</option>
                  <option value="Arial">Arial</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Verdana">Verdana</option>
                </select>
                <select
                  className="tool"
                  defaultValue=""
                  title="Alinhamento"
                  onChange={(e) => {
                    if (e.target.value) exec(e.target.value);
                    e.target.value = "";
                  }}
                >
                  <option value="">📐 Alinhar</option>
                  <option value="justifyLeft">⬅️ Esquerda</option>
                  <option value="justifyCenter">🎯 Centro</option>
                  <option value="justifyRight">➡️ Direita</option>
                  <option value="justifyFull">↔️ Justificado</option>
                </select>
                <button type="button" className="tool" onClick={() => exec("insertUnorderedList")} title="Lista">• Lista</button>
                <span className="toolbar-sep" />
                <button type="button" className="tool" onClick={editorUndo} title="Desfazer (Ctrl+Z)">↶</button>
                <button type="button" className="tool" onClick={editorRedo} title="Refazer (Ctrl+Y)">↷</button>
                <span className="toolbar-sep" />
                <button type="button" className="tool btn-primary" onClick={() => fileRef.current?.click()} title="Inserir imagem (também dá para colar ou arrastar)">
                  📷 Imagem
                </button>
                <ColorPicker label="Cor" icon="🎨" keepFocus onPick={(c) => exec("foreColor", c)} title="Cor do texto" />
                <ColorPicker label="Realce" icon="🖌️" keepFocus onPick={(c) => exec("hiliteColor", c)} title="Cor de realce" />
              </>
            )}
          </div>

          <div
            ref={editorRef}
            className="editor"
            contentEditable
            suppressContentEditableWarning
            spellCheck
            onInput={() => {
              snapshot();
              setCharCount(stripHtml(editorRef.current.innerHTML).length);
            }}
            onKeyUp={rememberSelection}
            onMouseUp={rememberSelection}
            onBlur={rememberSelection}
            onKeyDown={(e) => {
              if (!(e.ctrlKey || e.metaKey)) return;
              const key = e.key.toLowerCase();
              if (key === "z" && !e.shiftKey) {
                e.preventDefault();
                editorUndo();
              } else if (key === "y" || (key === "z" && e.shiftKey)) {
                e.preventDefault();
                editorRedo();
              } else if (key === "s") {
                e.preventDefault();
                save();
              }
            }}
            onClick={(e) => setSelectedImg(e.target.tagName === "IMG" ? e.target : null)}
            onContextMenu={(e) => {
              if (e.target.tagName !== "IMG") return;
              e.preventDefault();
              setSelectedImg(e.target);
              setCtxMenu({ x: e.clientX, y: e.clientY, sub: null });
            }}
            onPointerDown={handleEditorPointerDown}
            onPaste={(e) => {
              const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
              if (item) {
                e.preventDefault();
                insertImage(item.getAsFile());
                return;
              }
              // cola texto sem a formatação de outros sites
              const text = e.clipboardData?.getData("text/plain");
              if (text != null && e.clipboardData?.types.includes("text/html")) {
                e.preventDefault();
                snapshot(true);
                document.execCommand("insertText", false, text);
              }
            }}
            onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
            onDrop={(e) => {
              const file = e.dataTransfer.files?.[0];
              if (file?.type.startsWith("image/")) {
                e.preventDefault();
                insertImage(file);
              }
            }}
          />
        </div>
      ) : (
        <div className="note-content" onDoubleClick={() => setIsEditing(true)} title="Clique duas vezes para editar">
          {record.text ? <RichText text={record.text} recordId={record.id} /> : <span className="muted">Nota sem conteúdo…</span>}
        </div>
      )}

      <div className="note-meta">
        <div className="row wrap small muted">
          <span title={`Horário: ${formatDate(record.date, true)}`}>
            Criado em: <strong>{formatDate(record.date)}</strong>
          </span>
          {record.updatedAt && (
            <span title={`Horário: ${formatDate(record.updatedAt, true)}`}>
              • Editado em: <strong>{formatDate(record.updatedAt)}</strong>
            </span>
          )}
          <span>
            • Caracteres: <strong>{charCount}</strong>
          </span>
        </div>

        <div className="menu-anchor row small" ref={feelingRef}>
          <span className="muted">sentindo:</span>
          <button type="button" className={`feeling-button ${feeling ? "set" : ""}`} onClick={() => setFeelingOpen((v) => !v)}>
            {feelingObj ? `${feelingObj.emoji} ${feelingObj.label}` : feeling || <span className="muted">+ selecionar</span>}
          </button>
          {feelingOpen && (
            <div className="menu feeling-grid up">
              {FEELINGS.map((f) => (
                <button
                  key={f.emoji}
                  type="button"
                  title={f.label}
                  className={feeling === f.emoji ? "active" : ""}
                  onClick={() => {
                    updateRecord({ feeling: feeling === f.emoji ? "" : f.emoji });
                    setFeelingOpen(false);
                  }}
                >
                  {f.emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="form-buttons">
        {isEditing ? (
          <>
            <button type="button" className="cancel-button" onClick={cancel}>✖️ Cancelar</button>
            <button type="button" className="save-button primary" onClick={save} title="Ctrl+S">💾 Salvar</button>
          </>
        ) : (
          <>
            <button type="button" className="cancel-button" onClick={() => setIsEditing(true)}>✏️ Editar</button>
            <button type="button" className="cancel-button" onClick={remove}>🗑️ Excluir</button>
          </>
        )}
      </div>

      {ctxMenu &&
        createPortal(
          <div className="menu img-context-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
            <div className="submenu-anchor" onMouseEnter={() => setCtxMenu((m) => ({ ...m, sub: "size" }))}>
              <button type="button" className="strong">📐 Tamanho ▸</button>
              {ctxMenu.sub === "size" && (
                <div className="menu submenu">
                  <button type="button" onClick={() => resizeImage("100%")}>🔍 100%</button>
                  <button type="button" onClick={() => resizeImage("75%")}>📏 75%</button>
                  <button type="button" onClick={() => resizeImage("50%")}>📐 50%</button>
                  <button type="button" onClick={() => resizeImage("25%")}>🔎 25%</button>
                  <hr />
                  <button type="button" onClick={customResize}>✏️ Personalizado…</button>
                </div>
              )}
            </div>
            <div className="submenu-anchor" onMouseEnter={() => setCtxMenu((m) => ({ ...m, sub: "move" }))}>
              <button type="button" className="strong">✋ Posição ▸</button>
              {ctxMenu.sub === "move" && (
                <div className="menu submenu">
                  <button type="button" onClick={() => alignImage("center")}>🎯 Centralizar</button>
                  <button type="button" onClick={() => alignImage("left")}>⬅️ Esquerda</button>
                  <button type="button" onClick={() => alignImage("right")}>➡️ Direita</button>
                  <hr />
                  <button type="button" onClick={() => alignImage("float-left")}>📄 Texto à direita</button>
                  <button type="button" onClick={() => alignImage("float-right")}>📄 Texto à esquerda</button>
                  <hr />
                  <button type="button" onClick={() => alignImage("free")}>✋ Livre (arrastar)</button>
                </div>
              )}
            </div>
            <button type="button" className="strong" onMouseEnter={() => setCtxMenu((m) => ({ ...m, sub: null }))} onClick={() => { setEditingImgSrc(selectedImg?.src); setCtxMenu(null); }}>
              ✏️ Desenhar / Cortar
            </button>
            <hr />
            <button type="button" className="danger strong" onMouseEnter={() => setCtxMenu((m) => ({ ...m, sub: null }))} onClick={removeImage}>
              ❌ Excluir imagem
            </button>
          </div>,
          portalRoot()
        )}

      {editingImgSrc && (
        <ImageEditorModal
          imgSrc={editingImgSrc}
          onClose={() => setEditingImgSrc(null)}
          onSave={async (src) => {
            const out = await downscaleImage(src);
            mutateImage((img) => (img.src = out));
          }}
        />
      )}
    </div>
  );
}
