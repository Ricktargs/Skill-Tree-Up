import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../arvore/App.css';
import '../arvore/ui.css';
import './neuronios.css';
import './notesPanel.css';
import { NeuronEditor } from './Editor.jsx';
import ColorPicker from './ColorPicker.jsx';
import EmojiPicker from './EmojiPicker.jsx';
import { isNeuron, plainText, tagColor, useNeuronios } from './store.js';
import { useUiTheme } from '../../shared/uiTheme.js';
import { useMode } from '../modeState.js';
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

export default function NotesPanel() {
  const store = useNeuronios();
  const { notes, folders } = store;
  const dark = useUiTheme().dark;
  const mode = useMode();
  const [activeId, setActiveId] = useState(() => readJSON(ACTIVE_KEY, null));
  const [openFolders, setOpenFolders] = useState(() => new Set(readJSON(OPEN_KEY, [])));
  const [selectedFolder, setSelectedFolder] = useState(null); // onde entram notas/pastas novas
  const [renaming, setRenaming] = useState(null); // { id, name }
  const [query, setQuery] = useState('');
  const [dragOver, setDragOver] = useState(null); // id da pasta ('root' = sem pasta)
  const [menu, setMenu] = useState(null); // botão direito: { kind: 'folder' | 'note', id, x, y }
  const dragRef = useRef(null); // { kind: 'note' | 'folder', id }

  useEffect(() => writeJSON(ACTIVE_KEY, activeId), [activeId]);
  useEffect(() => writeJSON(OPEN_KEY, [...openFolders]), [openFolders]);

  const note = activeId ? store.byId.get(activeId) : null;
  const folderIds = useMemo(() => new Set(folders.map((f) => f.id)), [folders]);
  const folderOf = (n) => (n.folderId && folderIds.has(n.folderId) ? n.folderId : null);

  // Esc fora do texto fecha o painel
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      const el = document.activeElement;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (typing || document.querySelector('.ui-dialog-backdrop, .modal-backdrop, .nr-color-pop')) return;
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

  const newNote = () => {
    const n = store.addNote({ isNeuron: false, folderId: selectedFolder, title: 'Nova nota' });
    if (selectedFolder) openPath(selectedFolder);
    sfx.play('open');
    setActiveId(n.id);
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

  // ---------- Arrastar notas e pastas para dentro de pastas ----------
  const dragProps = (kind, id) => ({
    draggable: true,
    onDragStart: (e) => {
      dragRef.current = { kind, id };
      e.dataTransfer.effectAllowed = 'move';
      try {
        e.dataTransfer.setData('text/plain', id);
      } catch {
        /* alguns navegadores não aceitam */
      }
    },
    onDragEnd: () => {
      dragRef.current = null;
      setDragOver(null);
    }
  });
  const dropProps = (folderId) => ({
    onDragOver: (e) => {
      if (!dragRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      setDragOver(folderId || 'root');
    },
    onDragLeave: () => setDragOver((d) => (d === (folderId || 'root') ? null : d)),
    onDrop: (e) => {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();
      if (d.kind === 'note') store.moveNote(d.id, folderId);
      else if (d.id !== folderId) store.moveFolder(d.id, folderId);
      if (folderId) openPath(folderId);
      sfx.play('drop');
      dragRef.current = null;
      setDragOver(null);
    }
  });

  // ---------- Itens da lista ----------
  const renderNote = (n, depth) => (
    <button
      key={n.id}
      type="button"
      className={`np-row np-note ${n.id === activeId ? 'active' : ''}`}
      style={{ '--depth': depth }}
      onClick={() => {
        sfx.play('tick');
        setActiveId(n.id);
        setSelectedFolder(folderOf(n));
      }}
      title={`${isNeuron(n) ? 'Neurônio (aparece no mapa)' : 'Nota (não aparece no mapa)'} · botão direito troca o emoji`}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ kind: 'note', id: n.id, x: e.clientX, y: e.clientY });
      }}
      {...dragProps('note', n.id)}
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
    const subFolders = folders.filter((x) => x.parentId === f.id).sort(byTitle);
    const inside = notes.filter((n) => folderOf(n) === f.id).sort(byTitle);
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
            className={`np-row np-folder ${selectedFolder === f.id ? 'selected' : ''} ${dragOver === f.id ? 'drop' : ''}`}
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
            title="Clique abre · duplo clique renomeia · botão direito muda a cor"
            {...dragProps('folder', f.id)}
            {...dropProps(f.id)}
          >
            <span className="np-caret">{isOpen ? '▾' : '▸'}</span>
            <FolderIcon color={f.color} open={isOpen} />
            <span className="np-label">{f.name}</span>
            <small className="np-count">{inside.length + subFolders.length || ''}</small>
            <span className="np-folder-actions">
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
              <div className="np-empty-folder" style={{ '--depth': depth + 1 }}>
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
  const rootFolders = folders.filter((f) => !f.parentId || !folderIds.has(f.parentId)).sort(byTitle);
  const rootNotes = notes.filter((n) => !folderOf(n)).sort(byTitle);
  const neuronCount = notes.filter(isNeuron).length;

  return (
    <aside className={`arvore-root nr-root np-panel ${dark ? 'dark-mode' : ''} ${mode === 'skills' ? 'in-skills' : ''}`} aria-label="Editor de notas">
      <div className="np-head">
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
            className={`np-tree ${dragOver === 'root' ? 'drop' : ''}`}
            {...dropProps(null)}
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
          <small className="np-tip">Arraste para organizar · duplo clique renomeia · botão direito: cor da pasta / emoji da nota</small>
        </nav>

        {/* Editor (o mesmo dos Neurônios) */}
        <section className="np-editor">
          {note ? (
            <>
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
                  setActiveId(id);
                }}
                onDelete={(n) => {
                  sfx.play('delete');
                  store.deleteNote(n.id);
                  setActiveId(null);
                }}
              />
            </>
          ) : (
            <div className="empty nr-empty">Escolha uma nota na lista ou crie uma nova.</div>
          )}
        </section>
      </div>

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
