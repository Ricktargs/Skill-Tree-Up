import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// Mesmo sistema de design da Árvore (papel, nanquim e aquarela)
import '../arvore/App.css';
import '../arvore/ui.css';
import './neuronios.css';
import Graph from './Graph.jsx';
import EditorPane from './Editor.jsx';
import { THEME_KEY, plainText, tagColor, useNeuronios } from './store.js';

const isTyping = (el) =>
  el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

const readTheme = () => {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark';
  } catch (e) {
    return false;
  }
};

const useNarrow = () => {
  const [narrow, setNarrow] = useState(() => window.innerWidth < 760);
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 760);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return narrow;
};

export default function Neuronios() {
  const store = useNeuronios();
  const { notes, tags, links, view, setView } = store;
  const [dark, setDark] = useState(readTheme);
  const [openIds, setOpenIds] = useState(() => (Array.isArray(view.openIds) ? view.openIds : []));
  const [activeId, setActiveId] = useState(() => view.activeId || null);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [split, setSplit] = useState(() => (typeof view.split === 'number' ? view.split : 0.5));
  const narrow = useNarrow();
  const splitRef = useRef(null);
  const fileRef = useRef(null);
  const searchRef = useRef(null);

  const selectedTags = useMemo(() => view.tags || [], [view.tags]);
  const matchAll = Boolean(view.matchAll);
  const tagNodes = Boolean(view.tagNodes);
  const hideOrphans = Boolean(view.hideOrphans);

  // Tema compartilhado com a Árvore
  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    } catch (e) {
      // ignore
    }
  }, [dark]);

  // Abas abertas sobrevivem a trocar de modo/recarregar
  useEffect(() => {
    const valid = openIds.filter((id) => store.byId.has(id));
    if (valid.length !== openIds.length) setOpenIds(valid);
    if (activeId && !store.byId.has(activeId)) setActiveId(valid[valid.length - 1] || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.byId]);
  useEffect(() => {
    const t = setTimeout(() => setView({ openIds, activeId, split }), 400);
    return () => clearTimeout(t);
  }, [openIds, activeId, split, setView]);

  // ---------- Abrir / fechar ----------
  const open = useCallback((id, newTab = true) => {
    setOpenIds((ids) => {
      if (ids.includes(id)) return ids;
      if (!newTab && ids.length > 0) {
        // Substitui a aba ativa (como o Obsidian sem Ctrl)
        return ids.map((x) => (x === activeIdRef.current ? id : x));
      }
      return [...ids, id].slice(-10);
    });
    setActiveId(id);
  }, []);
  const activeIdRef = useRef(activeId);
  useEffect(() => {
    activeIdRef.current = activeId;
  });

  const closeTab = useCallback((id) => {
    setOpenIds((ids) => {
      const i = ids.indexOf(id);
      const next = ids.filter((x) => x !== id);
      if (activeIdRef.current === id) setActiveId(next[Math.min(i, next.length - 1)] || null);
      return next;
    });
  }, []);

  const createNeuron = useCallback(
    (fields = {}) => {
      const tagsFromFilter = selectedTags.length ? [...selectedTags] : [];
      const note = store.addNote({ tags: tagsFromFilter, ...fields });
      open(note.id, true);
      // Foca no título para já digitar o nome
      setTimeout(() => {
        const input = document.querySelector('.nr-title');
        if (input) {
          input.focus();
          input.select();
        }
      }, 60);
      return note;
    },
    [store, open, selectedTags]
  );

  const deleteNeuron = useCallback(
    (note) => {
      store.deleteNote(note.id);
      closeTab(note.id);
      setToast({ text: `“${note.title}” excluído`, note, id: Date.now() });
    },
    [store, closeTab]
  );

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------- Filtros ----------
  const toggleTag = (tag) => {
    const next = selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag];
    setView({ tags: next });
  };

  const graph = useMemo(() => {
    let visible = notes;
    if (selectedTags.length) {
      visible = visible.filter((n) =>
        matchAll ? selectedTags.every((t) => (n.tags || []).includes(t)) : selectedTags.some((t) => (n.tags || []).includes(t))
      );
    }
    const ids = new Set(visible.map((n) => n.id));
    let noteLinks = links.filter((l) => ids.has(l.source) && ids.has(l.target));
    if (hideOrphans) {
      const linked = new Set(noteLinks.flatMap((l) => [l.source, l.target]));
      visible = visible.filter((n) => linked.has(n.id) || n.id === activeId);
    }
    const nodes = visible.map((n) => ({
      id: n.id,
      label: n.title || 'Sem título',
      color: n.tags && n.tags[0] ? tagColor(n.tags[0]) : 'var(--foliage)',
      x: n.x,
      y: n.y
    }));
    if (tagNodes) {
      const used = new Set();
      visible.forEach((n) => (n.tags || []).forEach((t) => used.add(t)));
      used.forEach((t) => nodes.push({ id: `tag:${t}`, kind: 'tag', label: `#${t}`, color: tagColor(t) }));
      visible.forEach((n) =>
        (n.tags || []).forEach((t) => noteLinks.push({ source: n.id, target: `tag:${t}`, kind: 'tag', distance: 70 }))
      );
    }
    noteLinks = noteLinks.map((l) => ({ ...l }));
    return { nodes, links: noteLinks };
  }, [notes, links, selectedTags, matchAll, tagNodes, hideOrphans, activeId]);

  // Busca: destaca os neurônios encontrados (os outros ficam claros)
  const highlightIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return new Set(
      notes
        .filter((n) => (n.title || '').toLowerCase().includes(q) || plainText(n.content).toLowerCase().includes(q) || (n.tags || []).some((t) => t.includes(q)))
        .map((n) => n.id)
    );
  }, [query, notes]);

  // ---------- Teclado (só quando este modo está aberto) ----------
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (e.defaultPrevented) return;
        if (document.querySelector('.nr-root .menu.nr-settings')) return setMenuOpen(false);
        if (isTyping(document.activeElement)) return document.activeElement.blur();
        if (activeIdRef.current) return closeTab(activeIdRef.current);
        return undefined;
      }
      if (isTyping(document.activeElement) || e.ctrlKey || e.metaKey || e.altKey) return undefined;
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        createNeuron();
      } else if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      return undefined;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [createNeuron, closeTab]);

  // ---------- Divisória arrastável ----------
  const startResize = (e) => {
    e.preventDefault();
    const box = splitRef.current.getBoundingClientRect();
    const move = (ev) => setSplit(Math.min(0.75, Math.max(0.25, (box.right - ev.clientX) / box.width)));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // ---------- Exportar / importar ----------
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ app: 'neuronios', version: 1, exportedAt: new Date().toISOString(), notes }, null, 2)], {
      type: 'application/json'
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neuronios-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importJson = async (file) => {
    try {
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data) ? data : data.notes;
      if (!Array.isArray(list)) throw new Error('formato');
      let added = 0;
      list.forEach((n) => {
        if (n && n.id && !store.byId.has(n.id)) {
          store.restoreNote({ ...n, tags: Array.isArray(n.tags) ? n.tags : [], content: String(n.content || '') });
          added += 1;
        }
      });
      setToast({ text: `${added} neurônio(s) importado(s)`, id: Date.now() });
    } catch (err) {
      setToast({ text: 'Arquivo inválido', id: Date.now() });
    }
  };

  const editorOpen = openIds.length > 0;
  const showEditor = editorOpen && (!narrow || activeId);

  return (
    <div className={`arvore-root nr-root ${dark ? 'dark-mode' : ''}`}>
      <main className="tree-page nr-page">
        <header className="top-bar">
          <div className="top-left">
            <div className="menu-anchor">
              <button type="button" className="round-button" onClick={() => setMenuOpen((v) => !v)} title="Opções do mapa">
                ⚙️
              </button>
              {menuOpen && (
                <div className="menu nr-settings" onMouseLeave={() => setMenuOpen(false)}>
                  <label className="nr-switch">
                    <input type="checkbox" checked={tagNodes} onChange={(e) => setView({ tagNodes: e.target.checked })} />
                    Tags no mapa
                  </label>
                  <label className="nr-switch">
                    <input type="checkbox" checked={hideOrphans} onChange={(e) => setView({ hideOrphans: e.target.checked })} />
                    Esconder neurônios sem ligação
                  </label>
                  <hr />
                  <button type="button" onClick={exportJson}>
                    💾 Exportar neurônios
                  </button>
                  <button type="button" onClick={() => fileRef.current?.click()}>
                    📥 Importar neurônios
                  </button>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importJson(f);
                  e.target.value = '';
                }}
              />
            </div>
          </div>

          <div className="top-center">
            <h1>NEURÔNIOS</h1>
            <div className="nr-stats">
              {notes.length} {notes.length === 1 ? 'neurônio' : 'neurônios'} · {links.length} {links.length === 1 ? 'ligação' : 'ligações'}
            </div>
          </div>

          <div className="top-right">
            <button type="button" className="round-button" onClick={() => createNeuron()} title="Novo neurônio (N)">
              ＋
            </button>
            <button type="button" className="round-button" onClick={() => setDark((d) => !d)} title="Alternar tema">
              {dark ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        {store.saveError && <div className="storage-warning">⚠️ O navegador recusou salvar (espaço cheio). Exporte um backup no ⚙️.</div>}

        {/* Busca + filtro de tags */}
        <div className="nr-filters">
          <input
            ref={searchRef}
            className="search-input nr-search"
            placeholder="Buscar neurônios…  ( / )"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && highlightIds && highlightIds.size) {
                open([...highlightIds][0], true);
              }
            }}
          />
          <div className="nr-tag-filter" role="group" aria-label="Filtrar por tags">
            {tags.length === 0 && <span className="muted small">Sem tags ainda</span>}
            {tags.map(({ tag, count }) => (
              <button
                key={tag}
                type="button"
                className={`nr-filter-chip ${selectedTags.includes(tag) ? 'on' : ''}`}
                style={{ '--tag': tagColor(tag) }}
                onClick={() => toggleTag(tag)}
              >
                #{tag} <small>{count}</small>
              </button>
            ))}
          </div>
          {selectedTags.length > 1 && (
            <button type="button" className="btn small" onClick={() => setView({ matchAll: !matchAll })} title="Como combinar as tags">
              {matchAll ? 'Todas as tags' : 'Qualquer tag'}
            </button>
          )}
          {selectedTags.length > 0 && (
            <button type="button" className="btn small dashed" onClick={() => setView({ tags: [] })}>
              Limpar filtro
            </button>
          )}
        </div>

        <div
          ref={splitRef}
          className={`nr-split ${showEditor ? 'with-editor' : ''} ${narrow ? 'narrow' : ''}`}
          style={showEditor && !narrow ? { '--nr-editor': `${Math.round(split * 100)}%` } : undefined}
        >
          {!(narrow && showEditor) && (
            <Graph
              nodes={graph.nodes}
              links={graph.links}
              activeId={activeId}
              openIds={openIds}
              highlightIds={highlightIds}
              resizeKey={`${showEditor}-${split}`}
              onOpen={(id, newTab) => {
                if (id.startsWith('tag:')) return toggleTag(id.slice(4));
                return open(id, newTab || !activeId);
              }}
              onCreateAt={(x, y) => createNeuron({ x, y })}
              onSettle={store.savePositions}
            />
          )}

          {showEditor && !narrow && <div className="nr-resizer" onPointerDown={startResize} title="Arraste para redimensionar" />}

          {showEditor && (
            <EditorPane
              store={store}
              openIds={openIds}
              activeId={activeId}
              onActivate={setActiveId}
              onCloseTab={closeTab}
              onOpen={(id, newTab) => open(id, newTab)}
              onDelete={deleteNeuron}
              onBackToMap={narrow ? () => setActiveId(null) : null}
            />
          )}
        </div>

        {graph.nodes.length === 0 && !showEditor && (
          <div className="nr-empty-map">
            {notes.length === 0 ? 'Nenhum neurônio ainda. Clique em ＋ ou dê dois cliques no mapa.' : 'Nenhum neurônio com esse filtro.'}
          </div>
        )}

        {toast && (
          <div className="nr-toast" key={toast.id}>
            <span>{toast.text}</span>
            {toast.note && (
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  store.restoreNote(toast.note);
                  open(toast.note.id, true);
                  setToast(null);
                }}
              >
                Desfazer
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
