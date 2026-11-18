import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import "./ui.css";
import ArvoreProvider from "./state/ArvoreProvider";
import { UiContext, useArvore } from "./state/contexts";
import TreeCanvas from "./components/TreeCanvas";
import BranchPanel from "./components/BranchPanel";
import NoteWindow from "./components/NoteWindow";
import SearchWindow from "./components/SearchWindow";
import PointsWidget from "./components/PointsWidget";
import { QuickNoteModal, SettingsModal, RevisionsModal, InfoModal } from "./components/Dialogs";
import { ROOT_ID } from "./lib/constants";
import { findBranch, shuffleTrunkBranches } from "./lib/tree";
import { hashString } from "./lib/ids";
import { sfx, setSoundSettings, useSoundSettings } from "./lib/sound";

export default function App() {
  return (
    <ArvoreProvider>
      <AppShell />
    </ArvoreProvider>
  );
}

function isTyping(target) {
  return target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
}

function AppShell() {
  const { data, commit, undo: rawUndo, redo: rawRedo, canUndo, canRedo, darkMode, setDarkMode, showPoints, storageError } = useArvore();
  const sound = useSoundSettings();
  const undo = () => {
    if (canUndo) sfx.play("tick");
    rawUndo();
  };
  const redo = () => {
    if (canRedo) sfx.play("tick");
    rawRedo();
  };
  const [modal, setModalRaw] = useState(null); // quick | settings | revisions | info
  const setModal = (m) => {
    if (m) sfx.play("open");
    setModalRaw(m);
  };

  /* ---------------- janelas abertas ---------------- */
  const [primary, setPrimary] = useState(null); // { id, path }
  const [linked, setLinked] = useState(null);
  const [extras, setExtras] = useState([]); // ids de galhos (Shift+clique)
  const [noteIds, setNoteIds] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [order, setOrder] = useState([]); // ordem de empilhamento (último = na frente)

  const bringToFront = useCallback((key) => setOrder((o) => (o[o.length - 1] === key ? o : [...o.filter((k) => k !== key), key])), []);
  const dropKey = useCallback((key) => setOrder((o) => o.filter((k) => k !== key)), []);
  const zFor = (key) => 100 + Math.max(0, order.indexOf(key));

  const openPrimary = useCallback(
    (id, path = []) => {
      setPrimary({ id, path });
      bringToFront("primary");
    },
    [bringToFront]
  );

  const closePrimary = useCallback(() => {
    if (linked) {
      setPrimary(linked);
      setLinked(null);
      dropKey("linked");
    } else {
      setPrimary(null);
      dropKey("primary");
    }
  }, [linked, dropKey]);

  const closeLinked = useCallback(() => {
    setLinked(null);
    dropKey("linked");
  }, [dropKey]);

  const openLinkedBranch = useCallback(
    (targetId) => {
      const id = findBranch(data.tree, targetId) ? targetId : ROOT_ID;
      if (primary?.id === id) return bringToFront("primary");
      if (linked?.id === id) return bringToFront("linked");
      if (primary) {
        setLinked({ id, path: [] });
        bringToFront("linked");
      } else openPrimary(id);
    },
    [data.tree, primary, linked, bringToFront, openPrimary]
  );

  const openNote = useCallback(
    (id) => {
      sfx.play("open");
      setNoteIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
      bringToFront(`note:${id}`);
    },
    [bringToFront]
  );

  const closeNote = (id) => {
    setNoteIds((ids) => ids.filter((n) => n !== id));
    dropKey(`note:${id}`);
  };

  const closeExtra = (id) => {
    setExtras((list) => list.filter((x) => x !== id));
    dropKey(`extra:${id}`);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    dropKey("search");
  };

  const closeAll = useCallback(() => {
    setPrimary(null);
    setLinked(null);
    setExtras([]);
    setNoteIds([]);
    setSearchOpen(false);
    setOrder([]);
  }, []);

  const handleNodeClick = (id, shiftKey) => {
    if (shiftKey) {
      if (primary?.id === id) return bringToFront("primary");
      setExtras((list) => (list.includes(id) ? list : [...list, id]));
      bringToFront(`extra:${id}`);
      return;
    }
    if (primary?.id === id) closePrimary();
    else if (linked?.id === id) closeLinked();
    else openPrimary(id);
  };

  const shuffle = useCallback(() => commit((d) => ({ ...d, tree: shuffleTrunkBranches(d.tree) })), [commit]);

  /* Janelas de notas/galhos que deixaram de existir não são mostradas. */
  const visibleNotes = noteIds.map((id) => data.records.find((r) => r.id === id)).filter(Boolean);
  const branchExists = (id) => !!findBranch(data.tree, id);

  const activeIds = useMemo(
    () => new Set([primary?.id, linked?.id, ...extras].filter(Boolean)),
    [primary, linked, extras]
  );

  /* ---------------- teclado global ---------------- */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (e.defaultPrevented) return;
        if (modal) return setModal(null);
        const top = [...order].reverse().find(Boolean);
        if (!top) return;
        if (top === "primary") closePrimary();
        else if (top === "linked") closeLinked();
        else if (top === "search") closeSearch();
        else if (top.startsWith("note:")) closeNote(top.slice(5));
        else if (top.startsWith("extra:")) closeExtra(top.slice(6));
        return;
      }
      if (isTyping(e.target) || !(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      } else if (key === "m") {
        e.preventDefault();
        shuffle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const ui = useMemo(() => ({ openNote, openLinkedBranch }), [openNote, openLinkedBranch]);

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  return (
    <UiContext.Provider value={ui}>
      <div className={`arvore-root ${darkMode ? "dark-mode" : ""}`}>
      <main className="tree-page">
        <header className="top-bar">
          <div className="top-left">
            <button type="button" className="round-button" onClick={() => setModal("settings")} title="Configurações">⚙️</button>
          </div>

          <div className="top-center">
            <h1>ÁRVORE</h1>
            <div className="row center">
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  if (searchOpen) return closeSearch();
                  sfx.play("open");
                  setSearchOpen(true);
                  bringToFront("search");
                }}
                title="Pesquisar notas"
              >
                🔍
              </button>
              <button type="button" className="icon-button" onClick={() => setModal("quick")} title="Nova nota rápida (no Tronco)">📝</button>
            </div>
          </div>

          <div className="top-right">
            <button type="button" className="round-button" onClick={undo} disabled={!canUndo} title="Desfazer (Ctrl+Z)">↶</button>
            <button type="button" className="round-button" onClick={redo} disabled={!canRedo} title="Refazer (Ctrl+Y)">↷</button>
            <button
              type="button"
              className="round-button"
              onClick={() => {
                const enabled = !sound.enabled;
                setSoundSettings({ enabled });
                if (enabled) sfx.play("grow");
              }}
              title={sound.enabled ? "Desligar sons" : "Ligar sons"}
            >
              {sound.enabled ? "🔊" : "🔇"}
            </button>
            <button
              type="button"
              className="round-button"
              onClick={() => {
                sfx.play("tick");
                setDarkMode(!darkMode);
              }}
              title="Alternar tema"
            >
              {darkMode ? "☀️" : "🌙"}
            </button>
          </div>
        </header>

        {storageError && (
          <div className="storage-warning">
            ⚠️ O navegador recusou salvar as últimas alterações (espaço cheio). Exporte um backup em ⚙️ e remova imagens grandes das notas.
          </div>
        )}

        <TreeCanvas activeIds={activeIds} onNodeClick={handleNodeClick} onOpenBranch={openLinkedBranch} />

        {/* ---------------- janelas ---------------- */}
        {primary && branchExists(primary.id) && (
          <BranchPanel
            key="primary"
            branchId={primary.id}
            initialPath={primary.path}
            initialPos={{ left: Math.max(20, vw - 510), top: 70 }}
            zIndex={zFor("primary")}
            onFocus={() => bringToFront("primary")}
            onClose={closePrimary}
            onCloseAll={closeAll}
            onNavigate={(id, path) => openPrimary(id, path)}
          />
        )}

        {linked && branchExists(linked.id) && (
          <BranchPanel
            key="linked"
            branchId={linked.id}
            initialPath={linked.path}
            initialPos={{ left: 30, top: 90 }}
            zIndex={zFor("linked")}
            onFocus={() => bringToFront("linked")}
            onClose={closeLinked}
            onCloseAll={closeAll}
            onNavigate={(id, path) => setLinked({ id, path })}
          />
        )}

        {extras.filter(branchExists).map((id) => {
          const h = hashString(id);
          return (
            <BranchPanel
              key={`extra:${id}`}
              branchId={id}
              initialPos={{ left: 150 + (h % 6) * 30, top: 80 + (h % 5) * 30 }}
              zIndex={zFor(`extra:${id}`)}
              onFocus={() => bringToFront(`extra:${id}`)}
              onClose={() => closeExtra(id)}
              onCloseAll={closeAll}
              onNavigate={(newId) => {
                closeExtra(id);
                setExtras((list) => (list.includes(newId) ? list : [...list, newId]));
                bringToFront(`extra:${newId}`);
              }}
            />
          );
        })}

        {visibleNotes.map((record) => {
          const h = hashString(record.id);
          return (
            <NoteWindow
              key={record.id}
              record={record}
              initialPos={{ left: Math.max(10, Math.min(vw - 740, 200 + (h % 8) * 25)), top: Math.max(10, Math.min(vh - 580, 90 + (h % 7) * 25)) }}
              zIndex={zFor(`note:${record.id}`)}
              onFocus={() => bringToFront(`note:${record.id}`)}
              onClose={() => closeNote(record.id)}
              onCloseAll={closeAll}
            />
          );
        })}

        {searchOpen && (
          <SearchWindow
            initialPos={{ left: Math.max(20, (vw - 500) / 2), top: Math.max(20, (vh - 480) / 2) }}
            zIndex={zFor("search")}
            onFocus={() => bringToFront("search")}
            onClose={closeSearch}
            onCloseAll={closeAll}
          />
        )}

        {showPoints && <PointsWidget />}

        {/* ---------------- modais ---------------- */}
        {modal === "quick" && <QuickNoteModal onClose={() => setModal(null)} />}
        {modal === "settings" && (
          <SettingsModal
            onClose={() => setModal(null)}
            onShuffle={shuffle}
            onOpenRevisions={() => setModal("revisions")}
            onOpenInfo={() => setModal("info")}
          />
        )}
        {modal === "revisions" && <RevisionsModal onClose={() => setModal(null)} />}
        {modal === "info" && <InfoModal onClose={() => setModal(null)} />}
      </main>
      </div>
    </UiContext.Provider>
  );
}
