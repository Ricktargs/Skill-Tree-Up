import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// Mesmo sistema de design da Árvore (papel, nanquim e aquarela)
import '../arvore/App.css';
import '../arvore/ui.css';
import './neuronios.css';
import Graph from './Graph.jsx';
import EditorPane from './Editor.jsx';
import ColorPicker from './ColorPicker.jsx';
import SearchBox from './SearchBox.jsx';
import { openNoteInPanel } from '../../shared/notesPanel.js';
import { DEFAULT_FORCES, FORCE_LIMITS, glowColor, glowSize, loadForces, richness, saveForces } from './forces.js';
import { isNeuron, plainText, tagColor, useNeuronios } from './store.js';
import { useUiTheme } from '../../shared/uiTheme.js';
import { registerModeActions } from '../../shared/modeBridge.js';
// mesmos sons do Santuário (respeitam "Efeitos sonoros" nas Configurações)
import { sfx } from '../arvore/lib/sound.js';

const isTyping = (el) =>
  el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

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
  // Modo noturno é o mesmo dos três modos (botão 🌙 das ferramentas)
  const dark = useUiTheme().dark;
  const [openIds, setOpenIds] = useState(() => (Array.isArray(view.openIds) ? view.openIds : []));
  const [activeId, setActiveId] = useState(() => view.activeId || null);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState(null);
  const [tagPick, setTagPick] = useState(null); // { tag, x, y } — cor de uma tag
  // Painel "Mapa/Neuro": forças do mapa (embaixo do + Neurônio)
  const [forces, setForces] = useState(loadForces);
  const [mapOpen, setMapOpen] = useState(false);
  useEffect(() => saveForces(forces), [forces]);
  const [split, setSplit] = useState(() => (typeof view.split === 'number' ? view.split : 0.5));
  const narrow = useNarrow();
  const splitRef = useRef(null);
  const searchRef = useRef(null);

  const selectedTags = useMemo(() => view.tags || [], [view.tags]);
  const matchAll = Boolean(view.matchAll);
  const tagNodes = Boolean(view.tagNodes);
  const hideOrphans = Boolean(view.hideOrphans);

  // Opções do mapa aparecem nas Configurações padrão
  useEffect(
    () => registerModeActions('neuronios', { tagNodes, hideOrphans, setView, createNeuron: () => createNeuronRef.current() }),
    [tagNodes, hideOrphans, setView]
  );

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
    sfx.play('open');
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
    sfx.play('close');
    setOpenIds((ids) => {
      const i = ids.indexOf(id);
      const next = ids.filter((x) => x !== id);
      if (activeIdRef.current === id) setActiveId(next[Math.min(i, next.length - 1)] || null);
      return next;
    });
  }, []);

  // X do canto da janela: fecha todas as abas e volta ao mapa
  const closeAll = useCallback(() => {
    sfx.play('close');
    setOpenIds([]);
    setActiveId(null);
  }, []);

  const createNeuronRef = useRef(() => {});
  const createNeuron = useCallback(
    (fields = {}) => {
      const tagsFromFilter = selectedTags.length ? [...selectedTags] : [];
      const note = store.addNote({ tags: tagsFromFilter, ...fields });
      sfx.play('grow');
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
  useEffect(() => {
    createNeuronRef.current = createNeuron;
  });

  const deleteNeuron = useCallback(
    (note) => {
      store.deleteNote(note.id);
      sfx.play('delete');
      closeTab(note.id);
      setToast({ text: `“${note.title}” excluído`, note, id: Date.now() });
    },
    [store, closeTab]
  );

  // Delete com neurônios selecionados no mapa
  const deleteMany = useCallback(
    (ids) => {
      const notesById = new Map(notes.map((n) => [n.id, n]));
      const list = ids.map((id) => notesById.get(id)).filter(Boolean);
      if (!list.length) return;
      store.deleteNotes(list.map((n) => n.id));
      sfx.play('delete');
      list.forEach((n) => closeTab(n.id));
      setToast({
        text: list.length === 1 ? `“${list[0].title}” excluído` : `${list.length} neurônios excluídos`,
        notes: list,
        id: Date.now()
      });
    },
    [notes, store, closeTab]
  );

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------- Filtros ----------
  const toggleTag = (tag) => {
    sfx.play('tick');
    const next = selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag];
    setView({ tags: next });
  };

  const graph = useMemo(() => {
    // Notas do editor geral que ainda não são neurônios ficam fora do mapa
    let visible = notes.filter(isNeuron);
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
    const degreeOf = new Map();
    links.forEach((l) => {
      degreeOf.set(l.source, (degreeOf.get(l.source) || 0) + 1);
      degreeOf.set(l.target, (degreeOf.get(l.target) || 0) + 1);
    });
    const nodes = visible.map((n) => {
      const base = n.color || (n.tags && n.tags[0] ? tagColor(n.tags[0]) : 'var(--foliage)');
      const html = n.content || '';
      const pagesHtml = Object.values(n.pages || {})
        .map((pg) => pg.content || '')
        .join(' ');
      const words = (plainText(html) + ' ' + plainText(pagesHtml)).split(/\s+/).filter(Boolean).length;
      const t = richness({
        words,
        links: degreeOf.get(n.id) || 0,
        pages: Object.keys(n.pages || {}).length,
        images: ((html + pagesHtml).match(/<img\b/gi) || []).length
      });
      return {
        id: n.id,
        label: n.title || 'Sem título',
        color: glowColor(base, t),
        glow: glowSize(t),
        x: n.x,
        y: n.y
      };
    });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as cores das tags mudam o desenho
  }, [notes, links, selectedTags, matchAll, tagNodes, hideOrphans, activeId, store.view.tagColors]);

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
        // Esc com o seletor de cor aberto só fecha o seletor
        if (document.querySelector('.nr-color-pop')) return;
        if (isTyping(document.activeElement)) return document.activeElement.blur();
        if (activeIdRef.current) return closeTab(activeIdRef.current);
        return undefined;
      }
      if (isTyping(document.activeElement) || e.ctrlKey || e.metaKey || e.altKey) return undefined;
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        createNeuron();
      } else if (e.key === '/' || e.key === ' ') {
        // "/" ou Espaço: buscar neurônio
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

  const editorOpen = openIds.length > 0;
  const showEditor = editorOpen && (!narrow || activeId);

  return (
    <div className={`arvore-root nr-root ${dark ? 'dark-mode' : ''}`}>
      <main className="tree-page nr-page">
        <header className="top-bar">
          {/* Configurações, noturno e ferramentas ficam nos botões padrão do programa */}
          <div className="top-left" />

          <div className="top-center">
            <h1>NEURÔNIOS</h1>
            <div className="nr-stats">
              {notes.filter(isNeuron).length} {notes.filter(isNeuron).length === 1 ? 'neurônio' : 'neurônios'} · {links.length} {links.length === 1 ? 'ligação' : 'ligações'}
            </div>
          </div>

          <div className="top-right" />
        </header>

        {store.saveError && <div className="storage-warning">⚠️ O navegador recusou salvar (espaço cheio). Exporte um backup no ⚙️.</div>}

        {/* Busca + filtro de tags */}
        <div className="nr-filters">
          <div className="nr-new-col">
            <button type="button" className="btn small btn-primary nr-new" onClick={() => createNeuron()} title="Novo neurônio (N)">
              ＋ Neurônio
            </button>
            <button
              type="button"
              className={`btn small nr-mapneuro ${mapOpen ? 'on' : ''}`}
              onClick={() => {
                sfx.play('tick');
                setMapOpen((v) => !v);
              }}
              title="Forças do mapa"
            >
              ⚙ Mapa/Neuro
            </button>
            {mapOpen && (
              <div className="nr-forces-panel">
                {[
                  ['center', 'Força central', 'Puxa os neurônios soltos para o meio'],
                  ['repel', 'Força de repulsão', 'Quanto os neurônios se empurram'],
                  ['link', 'Força das ligações', 'Quanto as ligações puxam os ligados'],
                  ['distance', 'Distância das ligações', 'Tamanho de cada fio']
                ].map(([k, label, hint]) => {
                  const [min, max, stepV] = FORCE_LIMITS[k];
                  return (
                    <label key={k} className="nr-force" title={hint}>
                      <span>{label}</span>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={stepV}
                        value={forces[k]}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setForces((f) => ({ ...f, [k]: v }));
                        }}
                      />
                    </label>
                  );
                })}
                <button
                  type="button"
                  className="btn small"
                  onClick={() => {
                    sfx.play('tick');
                    setForces({ ...DEFAULT_FORCES });
                  }}
                >
                  ↺ Restaurar padrão
                </button>
              </div>
            )}
          </div>
          <SearchBox
            inputRef={searchRef}
            query={query}
            setQuery={setQuery}
            store={store}
            onPickNeuron={(id) => open(id, true)}
            onPickNote={(id) => {
              sfx.play('open');
              openNoteInPanel(id);
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
                onContextMenu={(e) => {
                  e.preventDefault();
                  setTagPick({ tag, x: e.clientX, y: e.clientY });
                }}
                title="Clique para filtrar · botão direito para mudar a cor"
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
              onDeleteMany={deleteMany}
              forces={forces}
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
              onCloseAll={closeAll}
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

        {tagPick && (
          <ColorPicker
            x={tagPick.x}
            y={tagPick.y}
            title={`Cor da tag #${tagPick.tag}`}
            value={tagColor(tagPick.tag)}
            onPick={(c) => {
              sfx.play('tick');
              store.setTagColor(tagPick.tag, c);
            }}
            onReset={() => {
              sfx.play('tick');
              store.setTagColor(tagPick.tag, null);
              setTagPick(null);
            }}
            resetLabel="Cor automática"
            onClose={() => setTagPick(null)}
          />
        )}

        {toast && (
          <div className="nr-toast" key={toast.id}>
            <span>{toast.text}</span>
            {toast.notes && (
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  store.restoreNotes(toast.notes);
                  sfx.play('save');
                  setToast(null);
                }}
              >
                Desfazer
              </button>
            )}
            {toast.note && (
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  store.restoreNote(toast.note);
                  sfx.play('save');
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
