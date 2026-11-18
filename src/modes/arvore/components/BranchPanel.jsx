import { useEffect, useMemo, useRef, useState } from "react";
import { ask, inform } from "../../../shared/Dialog.jsx";
import FloatingWindow from "./FloatingWindow";
import RecordCard from "./RecordCard";
import NoteForm from "./NoteForm";
import { useArvore, useUi } from "../state/contexts";
import { ROOT_ID, PASTEL_COLORS, pointsForType } from "../lib/constants";
import { findBranch, findParentBranch, getDepth } from "../lib/tree";
import {
  getLevelItems,
  getItemName,
  isRecordAtLevel,
  locationForLevel,
  getEffectiveBranchId,
  collectNavigableItems,
  createFolder,
  createSubbranch,
  renameItem,
  setItemColor,
  deleteFolder,
  deleteBranch,
  branchDeletionScope,
  folderToSubbranch,
  subbranchToFolder,
  moveRecordsToLevel,
  reorderRecord,
} from "../lib/folders";
import { generateId, colorForId } from "../lib/ids";
import { stripHtml, recordLabel } from "../lib/html";
import { getDraggedNoteId, isNoteDrag } from "../lib/dnd";
import { sfx } from "../lib/sound";

/** Janela de um galho: notas, pastas e subgalhos. */
export default function BranchPanel({ branchId, initialPath, onNavigate, ...windowProps }) {
  const { data } = useArvore();
  const depth = getDepth(data.tree, branchId);
  const title = branchId === ROOT_ID ? "Tronco" : depth > 1 ? "Subgalho" : "Galho";
  const icon = branchId === ROOT_ID ? "🪵" : depth > 1 ? "🍃" : "🌿";

  return (
    <FloatingWindow {...windowProps} title={title} icon={icon} className="branch-panel" width={480} height={720} minWidth={340} minHeight={360}>
      <BranchPanelBody
        key={`${branchId}|${(initialPath || []).join("/")}`}
        branchId={branchId}
        initialPath={initialPath || []}
        onNavigate={onNavigate}
        onClose={windowProps.onClose}
      />
    </FloatingWindow>
  );
}

function BranchPanelBody({ branchId, initialPath, onNavigate, onClose }) {
  const { data, commit, logPoints } = useArvore();
  const { openNote } = useUi();
  const { tree, foldersMap, records } = data;

  const [path, setPath] = useState(initialPath);
  const [mode, setMode] = useState("list"); // list | note | branch | rename | folder
  const [editingRecord, setEditingRecord] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [editFolders, setEditFolders] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef(null);

  const branch = findBranch(tree, branchId);
  const levelId = path.length ? path[path.length - 1] : branchId;
  const parentLevelId = path.length > 1 ? path[path.length - 2] : branchId;
  const atRoot = path.length === 0;
  const depth = getDepth(tree, branchId);
  const isSubbranchPanel = depth > 1;
  const parentBranch = findParentBranch(tree, branchId);
  const levelIsBranch = !!findBranch(tree, levelId);

  // Se a pasta atual deixou de existir (ex.: desfazer), volta para um nível válido.
  const validPath = useMemo(() => {
    const out = [];
    for (const id of path) {
      const parent = out.length ? out[out.length - 1] : branchId;
      if (!getLevelItems(tree, foldersMap, parent).some((f) => f.id === id)) break;
      out.push(id);
    }
    return out;
  }, [path, tree, foldersMap, branchId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- corrige caminho inválido após desfazer/excluir
    if (validPath.length !== path.length) setPath(validPath);
  }, [validPath, path.length]);

  // Limpa os destaques de "soltar aqui" quando o arraste termina em qualquer lugar.
  useEffect(() => {
    const clear = () => document.querySelectorAll(".drop-hover").forEach((el) => el.classList.remove("drop-hover"));
    document.addEventListener("drop", clear, true);
    document.addEventListener("dragend", clear, true);
    return () => {
      document.removeEventListener("drop", clear, true);
      document.removeEventListener("dragend", clear, true);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => !menuRef.current?.contains(e.target) && setMenuOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  const items = useMemo(() => getLevelItems(tree, foldersMap, levelId), [tree, foldersMap, levelId]);
  const levelRecords = useMemo(() => records.filter((r) => isRecordAtLevel(r, levelId)), [records, levelId]);
  const levelName = getItemName(tree, foldersMap, levelId);
  const breadcrumb = [branch?.name || "", ...path.slice(0, -1).map((id) => getItemName(tree, foldersMap, id))].join(" › ");
  const currentColor = items && !atRoot ? getLevelItems(tree, foldersMap, parentLevelId).find((f) => f.id === levelId)?.color : null;

  if (!branch) return null;

  /* ---------------- ações ---------------- */
  const resetForms = () => {
    setMode("list");
    setEditingRecord(null);
    setNameInput("");
    setMenuOpen(false);
  };

  const startNewNote = () => {
    resetForms();
    setMode("note");
  };

  const handleSaveNote = ({ type, title, text }) => {
    if (editingRecord) {
      commit((d) => ({
        ...d,
        records: d.records.map((r) =>
          r.id === editingRecord.id ? { ...r, type, title, text, updatedAt: new Date().toISOString() } : r
        ),
      }));
      sfx.play("save");
    } else {
      const loc = locationForLevel(tree, foldersMap, levelId);
      const record = { id: generateId(), ...loc, type, title, text, date: new Date().toISOString() };
      commit((d) => ({ ...d, records: [...d.records, record] }));
      logPoints(pointsForType(type), `Nota [${type}]: ${recordLabel(record, 24)}`);
    }
    resetForms();
  };

  const handleCreateSubbranch = () => {
    const name = nameInput.trim();
    if (!name) return;
    const id = generateId();
    commit((d) => createSubbranch(d, levelId, { id, name, color: colorForId(id) }));
    logPoints(15, `Galho criado: ${name}`);
    resetForms();
  };

  const handleCreateFolder = () => {
    const name = nameInput.trim();
    if (!name) return;
    const id = generateId();
    commit((d) => createFolder(d, levelId, { id, name, color: colorForId(id) }));
    sfx.play("folder");
    resetForms();
  };

  const handleRename = () => {
    const name = nameInput.trim();
    if (!name) return;
    commit((d) => renameItem(d, levelId, name));
    sfx.play("tick");
    resetForms();
  };

  const confirmDeleteFolder = async (folderId, targetLevel) => {
    const name = getItemName(tree, foldersMap, folderId);
    const node = findBranch(tree, folderId);
    const extra = node?.children?.length ? " Os subgalhos dentro dele também serão removidos." : "";
    const ok = await ask({
      title: `Excluir a pasta "${name}"?`,
      message: `As notas de dentro serão movidas para "${getItemName(tree, foldersMap, targetLevel)}".${extra}\n(Ctrl+Z desfaz)`,
      yes: "Excluir",
      danger: true,
    });
    if (!ok) return false;
    commit((d) => deleteFolder(d, folderId, targetLevel));
    sfx.play("delete");
    return true;
  };

  const handleDeleteCurrent = async () => {
    setMenuOpen(false);
    if (!atRoot) {
      if (await confirmDeleteFolder(levelId, parentLevelId)) setPath((p) => p.slice(0, -1));
      return;
    }
    if (branchId === ROOT_ID) return;
    const scope = branchDeletionScope(data, branchId);
    const sub = scope.treeIds.length - 1;
    const msg =
      `Serão apagados: ${scope.recordIds.length} nota(s)` +
      (sub ? `, ${sub} subgalho(s)` : "") +
      (scope.folderIds.length ? `, ${scope.folderIds.length} pasta(s)` : "") +
      `.\n(Ctrl+Z desfaz)`;
    if (!(await ask({ title: `Excluir o galho "${branch.name}"?`, message: msg, yes: "Excluir", danger: true }))) return;
    commit((d) => deleteBranch(d, branchId));
    sfx.play("delete");
    onClose();
  };

  const handleToggleSubbranch = () => {
    const targetId = atRoot ? branchId : levelId;
    if (findBranch(tree, targetId)) {
      const result = subbranchToFolder(data, targetId);
      if (result.error) return inform({ title: "Não foi possível", message: result.error });
      commit(() => result.data);
      sfx.play("folder");
      if (atRoot) onNavigate(result.newOwner, [targetId]);
    } else {
      commit((d) => folderToSubbranch(d, targetId));
      logPoints(15, `Pasta virou subgalho: ${getItemName(tree, foldersMap, targetId)}`);
    }
  };

  const handleDeleteRecord = async (record) => {
    if (!(await ask({ title: "Excluir a nota?", message: `"${recordLabel(record)}"\n(Ctrl+Z desfaz)`, yes: "Excluir", danger: true }))) return;
    sfx.play("delete");
    commit((d) => ({ ...d, records: d.records.filter((r) => r.id !== record.id) }));
  };

  const handleEditRecord = (record) => {
    resetForms();
    setEditingRecord(record);
    setMode("note");
  };

  const moveHere = (noteId, target = levelId) => {
    commit((d) => moveRecordsToLevel(d, [noteId], target));
    sfx.play("drop");
  };

  const onDropOnCard = (noteId, targetId, after) => {
    commit((d) => reorderRecord(d, noteId, targetId, after, levelId));
    sfx.play("rustle");
  };

  const dropZone = (target) => ({
    onDragOver: (e) => {
      if (!isNoteDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.classList.add("drop-hover");
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove("drop-hover");
    },
    onDrop: (e) => {
      e.currentTarget.classList.remove("drop-hover");
      const id = getDraggedNoteId(e);
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      moveHere(id, target);
    },
  });

  const searchItems = searchOpen ? collectNavigableItems(tree, foldersMap, branchId) : [];

  /* ---------------- render ---------------- */
  return (
    <div className="panel-body" {...dropZone(levelId)}>
      <div className="panel-heading">
        {atRoot ? (
          <h2>{branch.name}</h2>
        ) : (
          <>
            <div className="breadcrumb" title={breadcrumb}>{breadcrumb} ›</div>
            <h2>
              {levelName} {levelIsBranch && <span className="heading-leaf">🍃</span>}
            </h2>
          </>
        )}
      </div>

      <div className="panel-count">
        {levelRecords.length} {levelRecords.length === 1 ? "nota" : "notas"}
        {items.length > 0 && ` · ${items.length} ${items.length === 1 ? "pasta" : "pastas"}`}
      </div>

      <div className="panel-toolbar">
        <div className="row wrap">
          <button type="button" className="btn" onClick={startNewNote}>+ Criar nota</button>
          {(!atRoot || isSubbranchPanel) && (
            <button
              type="button"
              className={`btn small ${levelIsBranch ? "btn-primary" : ""}`}
              onClick={handleToggleSubbranch}
              title={levelIsBranch ? "Desfazer subgalho e deixar apenas como pasta" : "Transformar pasta em subgalho (aparece na árvore)"}
            >
              {levelIsBranch ? "É Subgalho 🍃" : "Virar Subgalho 🌿"}
            </button>
          )}
        </div>

        <div className="menu-anchor" ref={menuRef}>
          <button type="button" className="icon-button" onClick={() => setMenuOpen((v) => !v)} title="Opções">⚙️</button>
          {menuOpen && (
            <div className="menu">
              <button type="button" onClick={() => { resetForms(); setMode("branch"); }}>🌿 Criar subgalho</button>
              <button type="button" onClick={() => { setEditFolders((v) => !v); setMenuOpen(false); }}>
                {editFolders ? "✓ Concluir edição de pastas" : "✏️ Editar pastas"}
              </button>
              {(branchId !== ROOT_ID || !atRoot) && (
                <button type="button" onClick={() => { resetForms(); setNameInput(atRoot ? branch.name : levelName); setMode("rename"); }}>
                  ✏️ Renomear {atRoot ? "galho" : "pasta"}
                </button>
              )}
              {(branchId !== ROOT_ID || !atRoot) && (
                <button type="button" className="danger" onClick={handleDeleteCurrent}>
                  🗑️ Excluir {atRoot ? "galho" : "pasta"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {(!atRoot || (isSubbranchPanel && parentBranch)) && (
        <div className="row nav-row">
          {!atRoot ? (
            <>
              <button
                type="button"
                className="btn small"
                onClick={() => { setPath((p) => p.slice(0, -1)); setPickerOpen(false); setColorOpen(false); }}
                title="Voltar (ou arraste uma nota aqui para tirá-la desta pasta)"
                {...dropZone(parentLevelId)}
              >
                ← Voltar
              </button>
              <div className="menu-anchor">
                <button type="button" className="icon-button" onClick={() => setColorOpen((v) => !v)} title="Cor da pasta">
                  🎨
                </button>
                {colorOpen && (
                  <div className="menu color-grid">
                    {PASTEL_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`swatch ${currentColor === c ? "active" : ""}`}
                        style={{ background: c }}
                        onClick={() => { commit((d) => setItemColor(d, levelId, c, parentLevelId)); setColorOpen(false); }}
                        aria-label={`Cor ${c}`}
                      />
                    ))}
                  </div>
                )}
              </div>
              <button type="button" className="icon-button" onClick={() => setPickerOpen((v) => !v)} title="Trazer notas deste galho para esta pasta">
                ＋
              </button>
            </>
          ) : (
            <button type="button" className="btn small" onClick={() => onNavigate(parentBranch.id, [])} title={`Voltar para ${parentBranch.name}`}>
              ← {parentBranch.name}
            </button>
          )}
        </div>
      )}

      <div className="divider" />

      {mode === "rename" && (
        <NameForm label="Novo nome" value={nameInput} onChange={setNameInput} onSubmit={handleRename} onCancel={resetForms} submitLabel="Salvar" />
      )}
      {mode === "branch" && (
        <NameForm label="Nome do subgalho" placeholder="Ex.: Projetos" value={nameInput} onChange={setNameInput} onSubmit={handleCreateSubbranch} onCancel={resetForms} submitLabel="Criar" />
      )}
      {mode === "note" && (
        <NoteForm
          key={editingRecord?.id || "new"}
          initial={editingRecord}
          onOpenFull={() => { openNote(editingRecord.id); resetForms(); }}
          onSave={handleSaveNote}
          onCancel={resetForms}
        />
      )}

      {mode === "list" || mode === "folder" ? (
        <div className="panel-list">
          {editFolders && (
            <div className="edit-banner">
              <span>Modo de edição: clique no × para excluir uma pasta</span>
              <button type="button" className="btn small btn-primary" onClick={() => setEditFolders(false)}>Concluir</button>
            </div>
          )}

          <div className="folder-row">
            <button type="button" className="btn small" onClick={() => setSearchOpen((v) => !v)} title="Pesquisar subgalhos e pastas deste galho">🔍</button>
            {items.map((f) => (
              <div key={f.id} className="folder-chip-wrap">
                <button
                  type="button"
                  className={`folder-chip ${f.isSubbranch ? "is-branch" : ""}`}
                  style={{ background: f.color }}
                  onClick={() => !editFolders && setPath((p) => [...p, f.id])}
                  title={f.isSubbranch ? "Subgalho" : "Pasta"}
                  {...dropZone(f.id)}
                >
                  <span className="chip-icon">{f.isSubbranch ? "🍃" : "📁"}</span>
                  {f.name}
                </button>
                {editFolders && (
                  <button type="button" className="chip-delete" title="Excluir" onClick={() => confirmDeleteFolder(f.id, levelId)}>×</button>
                )}
              </div>
            ))}
            {mode === "folder" ? null : (
              <button type="button" className="btn small dashed" onClick={() => { resetForms(); setMode("folder"); }}>+ Pasta</button>
            )}
          </div>

          {mode === "folder" && (
            <NameForm label="Nome da nova pasta" placeholder="Ex.: Projetos rápidos" value={nameInput} onChange={setNameInput} onSubmit={handleCreateFolder} onCancel={resetForms} submitLabel="Criar" />
          )}

          {searchOpen && (
            <FolderSearch
              items={searchItems}
              onPick={(item) => { setPath(item.path); setSearchOpen(false); }}
            />
          )}

          {pickerOpen && !atRoot && (
            <NotePicker
              records={records.filter(
                (r) => !isRecordAtLevel(r, levelId) && getEffectiveBranchId(tree, foldersMap, r) === branchId
              )}
              describe={(r) => (r.folderId ? getItemName(tree, foldersMap, r.folderId) : "Raiz do galho")}
              onMove={(ids) => { commit((d) => moveRecordsToLevel(d, ids, levelId)); setPickerOpen(false); }}
              onClose={() => setPickerOpen(false)}
            />
          )}

          <div className="records-grid">
            {levelRecords.map((record) => (
              <RecordCard
                key={record.id}
                record={record}
                onOpen={(r) => openNote(r.id)}
                onEdit={handleEditRecord}
                onDelete={handleDeleteRecord}
                onDropOnCard={onDropOnCard}
              />
            ))}
            <button type="button" className="add-tile" onClick={startNewNote} title="Criar nova nota">+</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NameForm({ label, value, onChange, onSubmit, onCancel, submitLabel, placeholder }) {
  return (
    <form
      className="record-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label>
        {label}
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          autoFocus
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onCancel()}
        />
      </label>
      <div className="form-buttons">
        <button type="button" className="cancel-button" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="save-button" disabled={!value.trim()}>{submitLabel}</button>
      </div>
    </form>
  );
}

function FolderSearch({ items, onPick }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = items.filter((i) => i.name.toLowerCase().includes(q));
  return (
    <div className="inline-box">
      <input type="text" placeholder="Pesquisar pasta ou subgalho..." value={query} autoFocus onChange={(e) => setQuery(e.target.value)} />
      <div className="inline-list">
        {filtered.length === 0 ? (
          <span className="muted small">Nada encontrado.</span>
        ) : (
          filtered.map((item) => (
            <button type="button" key={item.id} className="list-item" onClick={() => onPick(item)}>
              <strong>{item.name}</strong> {item.isSubbranch ? "🍃" : "📁"}
              <span className="muted small">{item.label}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function NotePicker({ records, describe, onMove, onClose }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);
  const q = query.trim().toLowerCase();
  const list = records.filter(
    (r) => !q || (r.title || "").toLowerCase().includes(q) || stripHtml(r.text || "").toLowerCase().includes(q)
  );
  return (
    <div className="inline-box">
      <div className="row space-between">
        <strong className="small">Trazer notas para esta pasta</strong>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button>
      </div>
      <input type="text" placeholder="Pesquisar por título ou conteúdo..." value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="inline-list">
        {list.length === 0 ? (
          <span className="muted small">{q ? "Nenhuma nota encontrada." : "Nenhuma nota disponível neste galho."}</span>
        ) : (
          list.map((r) => {
            const checked = selected.includes(r.id);
            return (
              <label key={r.id} className={`check-item ${checked ? "checked" : ""}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.id] : s.filter((id) => id !== r.id)))}
                />
                <span className="ellipsis">
                  <strong>{recordLabel(r, 28)}</strong> <span className="muted small">({describe(r)})</span>
                </span>
              </label>
            );
          })
        )}
      </div>
      {list.length > 0 && (
        <button type="button" className="save-button" disabled={!selected.length} onClick={() => onMove(selected)}>
          Mover {selected.length} nota(s)
        </button>
      )}
    </div>
  );
}
