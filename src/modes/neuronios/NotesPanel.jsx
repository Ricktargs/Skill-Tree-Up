import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../arvore/App.css';
import '../arvore/ui.css';
import './neuronios.css';
import './notesPanel.css';
import { NeuronEditor } from './Editor.jsx';
import ColorPicker from './ColorPicker.jsx';
import EmojiPicker from './EmojiPicker.jsx';
import { PresetEditor, createFromPreset, emptyPreset, folderPaths } from './Presets.jsx';
import { isNeuron, plainText, tagColor, useNeuronios } from './store.js';
import { useUiTheme } from '../../shared/uiTheme.js';
import { setNotesPanelOpen } from '../../shared/notesPanel.js';
import { ask } from '../../shared/Dialog.jsx';
import { sfx } from '../arvore/lib/sound.js';

// =========================================================
// EDITOR DE NOTAS (✏️) — metade esquerda da tela, em qualquer modo
// Lista com pastas e subpastas guardando notas e neurônios.
// Nota nova é só nota (fora do mapa); vira neurônio ao ser ligada
// com [[ ]] ou pelo botão "Transformar em neurônio" no topo dela.
// O editor de texto é o mesmo dos Neurônios.
// =========================================================

const OPEN_KEY = 'nr-notes-open-folders';
const ACTIVE_KEY = 'nr-notes-active';
const PRESETS_OPEN_KEY = 'nr-notes-presets-open';
const readJSON = (key, fallback) => {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v ?? fallback;
  } catch {
    return fallback;
  }
};
const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* só não lembra */
  }
};

// Pasta desenhada (dá para pintar com a cor escolhida)
const FOLDER_DEFAULT = '#e8c26a';
function FolderIcon({ color, open }) {
  const c = color || FOLDER_DEFAULT;
  return (
    <svg className="np-folder-svg" viewBox="0 0 20 16" width="16" height="13" aria-hidden="true">
      <path d="M1.5 3.2c0-.9.7-1.7 1.7-1.7h4.1l1.7 1.9h7.8c.9 0 1.7.8 1.7 1.7v8.2c0 .9-.8 1.7-1.7 1.7H3.2c-1 0-1.7-.8-1.7-1.7z" fill={c} stroke="rgb(0 0 0 / 0.28)" strokeWidth="0.8" />
      {open && <path d="M2.4 6.6h16.2l-1.4 7.2H3.6z" fill="rgb(255 255 255 / 0.28)" />}
    </svg>
  );
}

const byTitle = (a, b) => (a.title || a.name || '').localeCompare(b.title || b.name || '', 'pt-BR');
// Ordem manual (arrastando); o que nunca foi arrastado fica em ordem alfabética no fim
const NO_ORDER = 1e12;
const sortItems = (a, b) =>
  (typeof a.order === 'number' ? a.order : NO_ORDER) - (typeof b.order === 'number' ? b.order : NO_ORDER) || byTitle(a, b);

export default function NotesPanel() {
  const store = useNeuronios();
  const { notes, folders } = store;
  const dark = useUiTheme().dark;
  const [activeId, setActiveId] = useState(() => readJSON(ACTIVE_KEY, null));
  const [openFolders, setOpenFolders] = useState(() => new Set(readJSON(OPEN_KEY, [])));
  const [selectedFolder, setSelectedFolder] = useState(null); // onde entram notas/pastas novas
  const [renaming, setRenaming] = useState(null); // { id, name }
  const [query, setQuery] = useState('');
  const [dropAt, setDropAt] = useState(null); // onde vai cair: { kind, id, where: 'before' | 'after' | 'inside' | 'root' }
  const [draggingId, setDraggingId] = useState(null);
  const [presetsOpen, setPresetsOpen] = useState(() => readJSON(PRESETS_OPEN_KEY, true));
  const [presetEdit, setPresetEdit] = useState(null); // presset aberto na janela
  const hoverOpenRef = useRef({ id: null, timer: null }); // abre a pasta ao segurar o arrasto em cima
  const [menu, setMenu] = useState(null); // botão direito: { kind: 'folder' | 'note', id, x, y }
  const dragRef = useRef(null); // { kind: 'note' | 'folder', id }

  useEffect(() => writeJSON(ACTIVE_KEY, activeId), [activeId]);
  useEffect(() => writeJSON(OPEN_KEY, [...openFolders]), [openFolders]);
  useEffect(() => writeJSON(PRESETS_OPEN_KEY, presetsOpen), [presetsOpen]);

  // Celular: tela cheia; no retrato mostra a lista OU a nota (com "‹ Notas" para voltar)
  const [phoneView, setPhoneView] = useState(() => (readJSON(ACTIVE_KEY, null) ? 'note' : 'list'));
  const openNote = (id) => {
    setActiveId(id);
    setPhoneView('note');
  };

  // A busca dos Neurônios pode pedir para abrir uma nota aqui
  useEffect(() => {
    const on = (e) => {
      if (!e.detail || !e.detail.id) return;
      setActiveId(e.detail.id);
      setPhoneView('note');
    };
    window.addEventListener('np-open-note', on);
    return () => window.removeEventListener('np-open-note', on);
  }, []);

  const note = activeId ? store.byId.get(activeId) : null;
  const folderIds = useMemo(() => new Set(folders.map((f) => f.id)), [folders]);
  const folderOf = (n) => (n.folderId && folderIds.has(n.folderId) ? n.folderId : null);

  // Esc fora do texto fecha o painel
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      const el = document.activeElement;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (typing || document.querySelector('.ui-dialog-backdrop, .modal-backdrop, .nr-color-pop, .np-preset-backdrop')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setNotesPanelOpen(false);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, []);

  const toggleFolder = (id) =>
    setOpenFolders((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const openPath = (folderId) =>
    setOpenFolders((s) => {
      const next = new Set(s);
      let f = folders.find((x) => x.id === folderId);
      while (f) {
        next.add(f.id);
        f = folders.find((x) => x.id === f.parentId);
      }
      return next;
    });

  // A nota aberta sempre fica visível na lista (abre as pastas dela)
  const activeFolder = note ? folderOf(note) : null;
  useEffect(() => {
    if (!activeFolder) return;
    setOpenFolders((s) => {
      const next = new Set(s);
      let f = folders.find((x) => x.id === activeFolder);
      let changed = false;
      while (f) {
        if (!next.has(f.id)) {
          next.add(f.id);
          changed = true;
        }
        f = folders.find((x) => x.id === f.parentId);
      }
      return changed ? next : s;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando muda a nota/pasta aberta
  }, [activeId, activeFolder]);

  // ---------- Pressets ----------
  const applyPreset = (preset) => {
    const n = createFromPreset(store, preset);
    sfx.play('open');
    setQuery('');
    if (n.folderId) openPath(n.folderId);
    if (preset.openAfter !== false) openNote(n.id);
  };
  const removePreset = async (preset) => {
    const ok = await ask({
      title: `Excluir o presset “${preset.name}”?`,
      message: 'As notas já criadas com ele continuam onde estão.',
      yes: 'Excluir presset',
      danger: true
    });
    if (!ok) return;
    sfx.play('delete');
    store.deletePreset(preset.id);
    setPresetEdit(null);
  };
  const paths = useMemo(() => folderPaths(folders), [folders]);
  const pathOf = (id) => (paths.find((x) => x.id === id) || {}).label || '';

  const newNote = () => {
    const n = store.addNote({ isNeuron: false, folderId: selectedFolder, title: 'Nova nota' });
    if (selectedFolder) openPath(selectedFolder);
    sfx.play('open');
    openNote(n.id);
  };
  const newFolder = () => {
    const f = store.addFolder('Nova pasta', selectedFolder);
    if (selectedFolder) openPath(selectedFolder);
    sfx.play('folder');
    setRenaming({ id: f.id, name: f.name });
  };
  const removeFolder = async (f) => {
    const ok = await ask({
      title: `Excluir a pasta “${f.name}”?`,
      message: 'Nada é apagado: as notas e pastas de dentro sobem um nível.',
      yes: 'Excluir pasta',
      danger: true
    });
    if (!ok) return;
    sfx.play('delete');
    store.deleteFolder(f.id);
    if (selectedFolder === f.id) setSelectedFolder(null);
  };

  // ---------- Arrastar: mover para pastas e mudar a ordem ----------
  // Em cima de uma pasta: borda de cima/baixo = antes/depois, meio = dentro.
  // Em cima de uma nota: metade de cima = antes, de baixo = depois.
  const parentOfFolder = (f) => (f && f.parentId && folderIds.has(f.parentId) ? f.parentId : null);
  const childrenOf = (kind, parentId) =>
    kind === 'folder'
      ? folders.filter((f) => parentOfFolder(f) === (parentId || null)).sort(sortItems)
      : notes.filter((n) => folderOf(n) === (parentId || null)).sort(sortItems);
  // "folderId" está dentro de "ancestorId" (ou é ela)?
  const isWithin = (folderId, ancestorId) => {
    let cur = folderId;
    let guard = 0;
    while (cur && guard++ < 50) {
      if (cur === ancestorId) return true;
      cur = parentOfFolder(folders.find((f) => f.id === cur));
    }
    return false;
  };

  const stopHoverOpen = () => {
    clearTimeout(hoverOpenRef.current.timer);
    hoverOpenRef.current = { id: null, timer: null };
  };
  const endDrag = () => {
    dragRef.current = null;
    stopHoverOpen();
    setDraggingId(null);
    setDropAt(null);
  };
  const sameDrop = (a, b) => a && b && a.kind === b.kind && a.id === b.id && a.where === b.where;
  const showDrop = (t) => setDropAt((cur) => (sameDrop(cur, t) ? cur : t));

  const targetFor = (e, kind, id) => {
    const d = dragRef.current;
    if (!d) return null;
    const box = e.currentTarget.getBoundingClientRect();
    const r = (e.clientY - box.top) / Math.max(1, box.height);
    let t;
    if (kind === 'folder') {
      if (d.kind === 'note') t = { kind, id, where: 'inside' };
      else t = { kind, id, where: r < 0.28 ? 'before' : r > 0.72 ? 'after' : 'inside' };
    } else if (d.kind === 'note') {
      if (d.id === id) return null;
      t = { kind, id, where: r < 0.5 ? 'before' : 'after' };
    } else {
      // pasta solta em cima de uma nota: vai para a pasta dessa nota
      const fid = folderOf(store.byId.get(id) || {});
      t = fid ? { kind: 'folder', id: fid, where: 'inside' } : { kind: 'root', id: null, where: 'root' };
    }
    // pasta não entra nela mesma nem nas de dentro dela
    if (d.kind === 'folder') {
      const parent = t.where === 'inside' ? t.id : t.where === 'root' ? null : parentOfFolder(folders.find((f) => f.id === t.id));
      if (t.id === d.id || (parent && isWithin(parent, d.id))) return null;
    }
    return t;
  };

  const place = (d, t) => {
    let parent = null;
    if (t.where === 'inside') parent = t.id;
    else if (t.where !== 'root') parent = t.kind === 'folder' ? parentOfFolder(folders.find((f) => f.id === t.id)) : folderOf(store.byId.get(t.id) || {});
    const ids = childrenOf(d.kind, parent)
      .map((x) => x.id)
      .filter((x) => x !== d.id);
    let idx = ids.length;
    if ((t.where === 'before' || t.where === 'after') && t.kind === d.kind) {
      const i = ids.indexOf(t.id);
      if (i >= 0) idx = t.where === 'before' ? i : i + 1;
    }
    ids.splice(idx, 0, d.id);
    store.arrange(d.kind, d.id, parent, ids);
    if (parent) openPath(parent);
    sfx.play('drop');
  };

  const dragProps = (kind, id) => ({
    draggable: renaming ? renaming.id !== id : true,
    onDragStart: (e) => {
      e.stopPropagation();
      dragRef.current = { kind, id };
      e.dataTransfer.effectAllowed = 'move';
      try {
        e.dataTransfer.setData('text/plain', id);
      } catch {
        /* alguns navegadores não aceitam */
      }
      // deixa o navegador tirar a "foto" da linha antes de apagá-la
      requestAnimationFrame(() => setDraggingId(id));
    },
    onDragEnd: endDrag
  });
  const rowDropProps = (kind, id) => ({
    onDragOver: (e) => {
      if (!dragRef.current) return;
      const t = targetFor(e, kind, id);
      e.stopPropagation();
      if (!t) {
        e.dataTransfer.dropEffect = 'none';
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      showDrop(t);
      // segurando em cima de uma pasta fechada: ela abre sozinha
      if (kind === 'folder' && t.where === 'inside' && !openFolders.has(id)) {
        if (hoverOpenRef.current.id !== id) {
          stopHoverOpen();
          hoverOpenRef.current = {
            id,
            timer: setTimeout(() => {
              setOpenFolders((s) => new Set(s).add(id));
              sfx.play('tick');
            }, 600)
          };
        }
      } else if (hoverOpenRef.current.id) stopHoverOpen();
    },
    onDrop: (e) => {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();
      const t = targetFor(e, kind, id);
      if (t) place(d, t);
      endDrag();
    }
  });
  // Pasta vazia (texto "arraste para cá") e espaço livre da lista
  const insideDropProps = (folderId) => ({
    onDragOver: (e) => {
      const d = dragRef.current;
      if (!d) return;
      e.stopPropagation();
      if (d.kind === 'folder' && folderId && isWithin(folderId, d.id)) return;
      e.preventDefault();
      showDrop(folderId ? { kind: 'folder', id: folderId, where: 'inside' } : { kind: 'root', id: null, where: 'root' });
      if (hoverOpenRef.current.id) stopHoverOpen();
    },
    onDrop: (e) => {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();
      if (!(d.kind === 'folder' && folderId && isWithin(folderId, d.id))) {
        place(d, folderId ? { kind: 'folder', id: folderId, where: 'inside' } : { kind: 'root', id: null, where: 'root' });
      }
      endDrag();
    }
  });
  const dropClass = (kind, id) => {
    if (!dropAt || dropAt.kind !== kind || dropAt.id !== id) return '';
    return dropAt.where === 'inside' ? 'drop' : `drop-${dropAt.where}`;
  };

  // ---------- Itens da lista ----------
  const renderNote = (n, depth) => (
    <button
      key={n.id}
      type="button"
      className={`np-row np-note ${n.id === activeId ? 'active' : ''} ${dropClass('note', n.id)} ${draggingId === n.id ? 'dragging' : ''}`}
      style={{ '--depth': depth }}
      onClick={() => {
        sfx.play('tick');
        openNote(n.id);
        setSelectedFolder(folderOf(n));
      }}
      title={`${isNeuron(n) ? 'Neurônio (aparece no mapa)' : 'Nota (não aparece no mapa)'} · botão direito troca o emoji`}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ kind: 'note', id: n.id, x: e.clientX, y: e.clientY });
      }}
      {...dragProps('note', n.id)}
      {...rowDropProps('note', n.id)}
    >
      {n.emoji ? (
        <span className="np-ico">{n.emoji}</span>
      ) : isNeuron(n) ? (
        <i className="np-dot" style={{ background: n.color || (n.tags?.[0] ? tagColor(n.tags[0]) : 'var(--foliage)') }} />
      ) : (
        <span className="np-ico">📝</span>
      )}
      <span className="np-label">{n.title || 'Sem título'}</span>
      {isNeuron(n) && <small className="np-kind">🧠</small>}
    </button>
  );

  const renderFolder = (f, depth) => {
    const isOpen = openFolders.has(f.id);
    const subFolders = childrenOf('folder', f.id);
    const inside = childrenOf('note', f.id);
    return (
      <div className="np-folder-wrap" key={f.id}>
        {renaming && renaming.id === f.id ? (
          <input
            className="search-input np-rename"
            style={{ '--depth': depth }}
            autoFocus
            value={renaming.name}
            onChange={(e) => setRenaming({ id: f.id, name: e.target.value })}
            onFocus={(e) => e.target.select()}
            onBlur={() => {
              store.renameFolder(f.id, renaming.name);
              setRenaming(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                e.stopPropagation();
                setRenaming(null);
              }
            }}
          />
        ) : (
          <div
            className={`np-row np-folder ${selectedFolder === f.id ? 'selected' : ''} ${dropClass('folder', f.id)} ${draggingId === f.id ? 'dragging' : ''}`}
            style={{ '--depth': depth }}
            role="button"
            tabIndex={0}
            onClick={() => {
              toggleFolder(f.id);
              setSelectedFolder(f.id);
            }}
            onDoubleClick={() => setRenaming({ id: f.id, name: f.name })}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ kind: 'folder', id: f.id, x: e.clientX, y: e.clientY });
            }}
            title="Clique abre · duplo clique renomeia · botão direito: cor e virar neurônio"
            {...dragProps('folder', f.id)}
            {...rowDropProps('folder', f.id)}
          >
            <span className="np-caret">{isOpen ? '▾' : '▸'}</span>
            <FolderIcon color={f.color} open={isOpen} />
            <span className="np-label">{f.name}</span>
            {f.neuronId && (
              <span className="np-folder-neuron" title="Esta pasta é um neurônio (aparece no mapa)">
                🧠
              </span>
            )}
            <small className="np-count">{inside.length + subFolders.length || ''}</small>
            <span className="np-folder-actions">
              <button
                type="button"
                title={f.neuronId ? 'Tirar a pasta do mapa' : 'Virar neurônio (a pasta aparece no mapa ligada às notas)'}
                onClick={(e) => {
                  e.stopPropagation();
                  if (f.neuronId) store.folderUnNeuron(f.id);
                  else store.folderToNeuron(f.id);
                  sfx.play(f.neuronId ? 'tick' : 'branch');
                }}
              >
                {f.neuronId ? '⊘' : '🧠'}
              </button>
              <button
                type="button"
                title="Renomear"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenaming({ id: f.id, name: f.name });
                }}
              >
                ✎
              </button>
              <button
                type="button"
                title="Excluir pasta"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFolder(f);
                }}
              >
                🗑
              </button>
            </span>
          </div>
        )}
        {isOpen && (
          <div className="np-children">
            {subFolders.map((sf) => (
              renderFolder(sf, depth + 1)
            ))}
            {inside.map((n) => (
              renderNote(n, depth + 1)
            ))}
            {!subFolders.length && !inside.length && (
              <div className="np-empty-folder" style={{ '--depth': depth + 1 }} {...insideDropProps(f.id)}>
                Pasta vazia — arraste notas para cá
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const q = query.trim().toLowerCase();
  const found = q
    ? notes.filter((n) => (n.title || '').toLowerCase().includes(q) || plainText(n.content).toLowerCase().includes(q)).sort(byTitle)
    : null;
  const rootFolders = childrenOf('folder', null);
  const rootNotes = childrenOf('note', null);
  const presets = store.presets || [];
  const neuronCount = notes.filter(isNeuron).length;

  return (
    <aside className={`arvore-root nr-root np-panel np-view-${note ? phoneView : 'list'} ${dark ? 'dark-mode' : ''}`} aria-label="Editor de notas">
      <div className="np-head">
        {note && phoneView === 'note' && (
          <button type="button" className="np-back" onClick={() => setPhoneView('list')} aria-label="Voltar para a lista de notas">
            ‹ Notas
          </button>
        )}
        <h2>✏️ Notas</h2>
        <small>
          {notes.length - neuronCount} nota(s) · {neuronCount} neurônio(s)
        </small>
        <button type="button" className="nr-window-close" onClick={() => setNotesPanelOpen(false)} title="Fechar (Esc)" aria-label="Fechar">
          ✕
        </button>
      </div>

      <div className="np-body">
        {/* Lista com pastas */}
        <nav className="np-side">
          <div className="np-actions">
            <button type="button" className="btn small btn-primary" onClick={newNote} title="Nova nota (não aparece no mapa)">
              ＋ Nota
            </button>
            <button type="button" className="btn small" onClick={newFolder} title="Nova pasta">
              ＋ Pasta
            </button>
          </div>
          <div className="np-presets">
            <button type="button" className="np-presets-toggle" onClick={() => setPresetsOpen((v) => !v)} aria-expanded={presetsOpen}>
              <span className="np-caret">{presetsOpen ? '▾' : '▸'}</span>
              <span className="np-label">📋 Pressets</span>
              <small className="np-count">{presets.length || ''}</small>
            </button>
            {presetsOpen && (
              <div className="np-presets-list">
                {presets.map((ps) => (
                  <div className="np-preset-item" key={ps.id}>
                    <button
                      type="button"
                      className="np-preset-use"
                      onClick={() => applyPreset(ps)}
                      title={`Criar nota “${ps.name}”${ps.folderId && pathOf(ps.folderId) ? ` em ${pathOf(ps.folderId)}` : ''}`}
                    >
                      <span className="np-ico">{ps.emoji || '📋'}</span>
                      <span className="np-label">{ps.name}</span>
                      {ps.folderId && pathOf(ps.folderId) && <small className="np-preset-dest">📁 {pathOf(ps.folderId).split(' / ').pop()}</small>}
                    </button>
                    <button type="button" className="np-preset-edit" onClick={() => setPresetEdit(ps)} title="Editar presset">
                      ✎
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="np-preset-new"
                  onClick={() => setPresetEdit({ ...emptyPreset(), folderId: selectedFolder && folderIds.has(selectedFolder) ? selectedFolder : null })}
                >
                  ＋ Novo presset
                </button>
              </div>
            )}
          </div>
          <input className="search-input np-search" placeholder="Buscar notas…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {selectedFolder && folderIds.has(selectedFolder) && !q && (
            <div className="np-where">
              Novas vão para <b>{folders.find((f) => f.id === selectedFolder)?.name}</b>
              <button type="button" onClick={() => setSelectedFolder(null)} title="Criar fora das pastas">
                ×
              </button>
            </div>
          )}
          <div
            className={`np-tree ${dropAt && dropAt.where === 'root' ? 'drop' : ''}`}
            {...insideDropProps(null)}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setDropAt(null);
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedFolder(null);
            }}
          >
            {found ? (
              found.length ? (
                found.map((n) => renderNote(n, 0))
              ) : (
                <div className="np-empty-folder">Nada encontrado.</div>
              )
            ) : (
              <>
                {rootFolders.map((f) => (
                  renderFolder(f, 0)
                ))}
                {rootNotes.map((n) => (
                  renderNote(n, 0)
                ))}
                {!rootFolders.length && !rootNotes.length && <div className="np-empty-folder">Nenhuma nota ainda.</div>}
              </>
            )}
          </div>
          <small className="np-tip">Arraste para mover e mudar a ordem (segure em cima da pasta para abrir) · duplo clique renomeia · botão direito: cor da pasta / emoji da nota</small>
        </nav>

        {/* Editor (o mesmo dos Neurônios) */}
        <section className="np-editor">
          {note ? (
            <>
              <div className="np-note-folder">
                <span>📁</span>
                <select
                  className="np-move-select"
                  value={folderOf(note) || ''}
                  onChange={(e) => {
                    const target = e.target.value || null;
                    const ids = childrenOf('note', target)
                      .map((x) => x.id)
                      .filter((x) => x !== note.id);
                    store.arrange('note', note.id, target, [note.id, ...ids]);
                    if (target) openPath(target);
                    sfx.play('drop');
                  }}
                  title="Mover esta nota para outra pasta"
                >
                  <option value="">Sem pasta</option>
                  {paths.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={`np-neuron-bar ${isNeuron(note) ? 'is-neuron' : ''}`}>
                {isNeuron(note) ? (
                  <>
                    <span>🧠 É um neurônio — aparece no mapa</span>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => {
                        sfx.play('tick');
                        store.setNeuron(note.id, false);
                      }}
                    >
                      Deixar só como nota
                    </button>
                  </>
                ) : (
                  <>
                    <span>📝 Só nota — ligue com [[ ]] ou transforme para ir ao mapa</span>
                    <button
                      type="button"
                      className="btn small btn-primary"
                      onClick={() => {
                        sfx.play('grow');
                        store.setNeuron(note.id, true);
                      }}
                    >
                      🧠 Transformar em neurônio
                    </button>
                  </>
                )}
              </div>
              <NeuronEditor
                key={note.id}
                note={note}
                store={store}
                onOpen={(id) => {
                  sfx.play('open');
                  openNote(id);
                }}
                onDelete={(n) => {
                  sfx.play('delete');
                  store.deleteNote(n.id);
                  setActiveId(null);
                  setPhoneView('list');
                }}
              />
            </>
          ) : (
            <div className="empty nr-empty">Escolha uma nota na lista ou crie uma nova.</div>
          )}
        </section>
      </div>

      {presetEdit && (
        <PresetEditor
          key={presetEdit.id || 'new'}
          preset={presetEdit}
          folders={folders}
          onClose={() => setPresetEdit(null)}
          onDelete={removePreset}
          onSave={(ps) => {
            store.savePreset(ps);
            sfx.play('grow');
            setPresetEdit(null);
            setPresetsOpen(true);
          }}
        />
      )}
      {menu && menu.kind === 'folder' && (
        <ColorPicker
          x={menu.x}
          y={menu.y}
          title="Cor da pasta"
          value={(folders.find((f) => f.id === menu.id) || {}).color || FOLDER_DEFAULT}
          onPick={(c) => {
            sfx.play('tick');
            store.updateFolder(menu.id, { color: c });
          }}
          onReset={() => {
            sfx.play('tick');
            store.updateFolder(menu.id, { color: null });
            setMenu(null);
          }}
          resetLabel="Cor padrão"
          onClose={() => setMenu(null)}
          extra={(() => {
            const f = folders.find((x) => x.id === menu.id);
            const on = Boolean(f && f.neuronId);
            return (
              <button
                type="button"
                className={`np-folder-neuron-btn ${on ? 'on' : ''}`}
                onClick={() => {
                  if (on) store.folderUnNeuron(menu.id);
                  else store.folderToNeuron(menu.id);
                  sfx.play(on ? 'tick' : 'branch');
                  setMenu(null);
                }}
                title={on ? 'O neurônio da pasta sai do mapa (as notas continuam)' : 'A pasta aparece no mapa, ligada às notas de dentro'}
              >
                {on ? 'Tirar a pasta do mapa' : '🧠 Virar neurônio'}
              </button>
            );
          })()}
        />
      )}
      {menu && menu.kind === 'note' && (
        <EmojiPicker
          x={menu.x}
          y={menu.y}
          title="Emoji da nota"
          value={(store.byId.get(menu.id) || {}).emoji}
          onPick={(em) => {
            sfx.play('tick');
            store.updateNote(menu.id, { emoji: em });
            setMenu(null);
          }}
          onReset={() => {
            sfx.play('tick');
            store.updateNote(menu.id, { emoji: null });
            setMenu(null);
          }}
          resetLabel="Sem emoji"
          onClose={() => setMenu(null)}
        />
      )}
    </aside>
  );
}
