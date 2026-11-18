import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useArvore } from "../state/contexts";
import { ROOT_ID } from "../lib/constants";
import { canSwapNodes, countDescendants, findBranch, getAncestorIds, isDescendant, swapNodes } from "../lib/tree";
import { getEffectiveBranchId, moveRecordsToLevel } from "../lib/folders";
import { applyOffsets, createBranchPath, createCipoPath, createLayout, extractCipos, ROOT_POS } from "../lib/layout";
import { hashString } from "../lib/ids";
import { getDraggedNoteId, isNoteDrag } from "../lib/dnd";
import { sfx } from "../lib/sound";
import { canopyCircles } from "../lib/canopy";
import { TreeDefs, Ground, ForestRoots, ForestTrunks } from "./TreeArt";
import { refuseExtraTrees, useGrowthPermissions } from "../lib/growthPermissions";
import { BranchHandles, BranchLanterns, BranchTools, MainTreeWrap, SanctuaryBack, SanctuaryBackdrop, selectBranch, SanctuaryFront, SanctuaryHero, SanctuaryPanel, WorldGround, sanctuaryWorld, seasonOf, shownLayout, useSanctuary } from "./Sanctuary.jsx";

const HOLD_MS = 1500;
const DRAG_THRESHOLD = 6;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3.5;

function isTyping(target) {
  return target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
}

function capturePointer(el, pointerId) {
  try {
    el?.setPointerCapture(pointerId);
  } catch {
    /* ponteiro já liberado */
  }
}

/** Retorna funções estáveis que sempre chamam a versão mais recente. */
function useStableHandlers(handlers) {
  const ref = useRef(handlers);
  useLayoutEffect(() => {
    ref.current = handlers;
  });
  return useMemo(() => {
    const out = {};
    for (const key of Object.keys(handlers)) out[key] = (...args) => ref.current[key](...args);
    return out;
    // as chaves não mudam entre renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Área da árvore: desenho, zoom, arrastar galhos, troca e soltar notas. */
export default function TreeCanvas({ activeIds, onNodeClick, onOpenBranch }) {
  const { data, commit } = useArvore();
  const { tree, records, offsets, foldersMap } = data;

  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState(null);
  const [drag, setDrag] = useState(null);
  const [swapSourceId, setSwapSourceId] = useState(null);
  const [shakingId, setShakingId] = useState(null);
  const [badgeVisible, setBadgeVisible] = useState(false);
  const [panning, setPanning] = useState(false);

  const workspaceRef = useRef(null);
  const svgRef = useRef(null);
  const treeGroupRef = useRef(null);
  const pointerRef = useRef(null);
  const holdTimer = useRef(null);
  const badgeTimer = useRef(null);
  const noteHoverTimer = useRef(null);
  const lastSpace = useRef(0);

  /* ---------------- layout ---------------- */
  // Notas e texto por galho: é o que faz a árvore (e as raízes) crescerem
  const info = useMemo(() => {
    const map = new Map();
    for (const r of records) {
      const id = getEffectiveBranchId(tree, foldersMap, r);
      const cur = map.get(id) || { notes: 0, chars: 0 };
      cur.notes += 1;
      cur.chars += String(r.text || "").replace(/<[^>]+>/g, "").length + String(r.title || "").length;
      map.set(id, cur);
    }
    return map;
  }, [records, tree, foldersMap]);
  const [growth] = useGrowthPermissions();
  // Santuário (protótipo): o mundo do personagem, sem as informações dos galhos
  const sanc = useSanctuary();
  // só o que muda o desenho; posições e o lápis ficam dentro do Santuário (arrastar não redesenha a árvore)
  const sanctuary = useMemo(() => (sanc.on ? { lanterns: sanc.lanterns } : null), [sanc.on, sanc.lanterns]);
  // a ilha e tudo o que está nela (árvores, lagos, acampamentos...)
  const shown = shownLayout(sanc);
  const world = useMemo(() => (sanc.on ? sanctuaryWorld(shown) : null), [sanc.on, shown]);
  const season = seasonOf(sanc.season);
  // câmera segue o herói quando ele chega perto da borda da tela
  const panBy = useCallback((dx, dy) => {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return;
    setView((v) => ({ ...v, x: v.x + dx / ctm.a, y: v.y + dy / ctm.d }));
  }, []);
  const sancOn = Boolean(sanc.on);
  const base = useMemo(() => createLayout(tree, { info, growth, sanctuary: sancOn }), [tree, info, growth, sancOn]);
  const placed = useMemo(() => applyOffsets(base, tree, offsets, drag), [base, tree, offsets, drag]);
  const noteCounts = useMemo(() => {
    const map = new Map();
    for (const r of records) {
      const id = getEffectiveBranchId(tree, foldersMap, r);
      map.set(id, (map.get(id) || 0) + 1);
    }
    return map;
  }, [records, tree, foldersMap]);
  const cipos = useMemo(() => extractCipos(records, tree, foldersMap), [records, tree, foldersMap]);

  const showBadge = useCallback(() => {
    setBadgeVisible(true);
    clearTimeout(badgeTimer.current);
    badgeTimer.current = setTimeout(() => setBadgeVisible(false), 1500);
  }, []);

  const resetView = useCallback(() => {
    setView({ zoom: 1, x: 0, y: 0 });
    showBadge();
  }, [showBadge]);

  /* ---------------- zoom (roda do mouse) ---------------- */
  useEffect(() => {
    const el = workspaceRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      const svg = svgRef.current;
      const ctm = svg?.getScreenCTM();
      if (!ctm) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const m = pt.matrixTransform(ctm.inverse());
      const factor = Math.exp(-Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * 0.0005);
      setView((v) => {
        const zoom = Math.min(Math.max(v.zoom * factor, MIN_ZOOM), MAX_ZOOM);
        const r = zoom / v.zoom;
        return { zoom, x: m.x - (m.x - v.x) * r, y: m.y - (m.y - v.y) * r };
      });
      showBadge();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      clearTimeout(badgeTimer.current);
      clearTimeout(holdTimer.current);
      clearTimeout(noteHoverTimer.current);
    };
  }, [showBadge]);

  /* ---------------- teclado ---------------- */
  useEffect(() => {
    const onKey = (e) => {
      if (isTyping(e.target)) return;
      if (e.key === "Escape" && swapSourceId) {
        e.preventDefault();
        setSwapSourceId(null);
      }
      if (e.key === " " && !e.repeat) {
        e.preventDefault();
        const now = Date.now();
        if (now - lastSpace.current < 350) resetView();
        lastSpace.current = now;
      }
    };
    // captura: roda antes do Esc global que fecha janelas
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [swapSourceId, resetView]);

  /* ---------------- ponteiro: arrastar galhos e mover a vista ---------------- */
  const toTreeLocal = (clientX, clientY) => {
    const g = treeGroupRef.current;
    const ctm = g?.getScreenCTM();
    if (!ctm) return null;
    const pt = svgRef.current.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(ctm.inverse());
  };

  const clearHold = () => {
    clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const handleClickNode = (id, shiftKey) => {
    if (swapSourceId) {
      if (id !== swapSourceId && canSwapNodes(tree, swapSourceId, id)) {
        const a = swapSourceId;
        commit((d) => {
          const o = { ...d.offsets };
          const oa = o[a];
          const ob = o[id];
          if (ob) o[a] = ob; else delete o[a];
          if (oa) o[id] = oa; else delete o[id];
          return { ...d, tree: swapNodes(d.tree, a, id), offsets: o };
        });
        sfx.play("swap");
      } else sfx.play("tick");
      setSwapSourceId(null);
      return;
    }
    setShakingId(id);
    setTimeout(() => setShakingId((s) => (s === id ? null : s)), 400);
    sfx.play("branch");
    if (sancOn) {
      selectBranch(id);
      return;
    }
    onNodeClick(id, shiftKey);
  };

  const onNodePointerDown = (id, e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    capturePointer(workspaceRef.current, e.pointerId);
    const local = toTreeLocal(e.clientX, e.clientY);
    pointerRef.current = {
      kind: "node",
      id,
      shift: e.shiftKey,
      startClient: { x: e.clientX, y: e.clientY },
      startLocal: local,
      moved: false,
      holdFired: false,
    };
    if (id !== ROOT_ID && !swapSourceId) {
      clearHold();
      holdTimer.current = setTimeout(() => {
        const p = pointerRef.current;
        if (p && p.id === id && !p.moved) {
          p.holdFired = true;
          setDrag(null);
          setSwapSourceId(id);
          sfx.play("hold");
        }
      }, HOLD_MS);
    }
  };

  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    capturePointer(workspaceRef.current, e.pointerId);
    pointerRef.current = { kind: "pan", startClient: { x: e.clientX, y: e.clientY }, startView: view };
    setPanning(true);
  };

  const handlePointerMove = (e) => {
    const p = pointerRef.current;
    if (!p) return;
    const dist = Math.hypot(e.clientX - p.startClient.x, e.clientY - p.startClient.y);

    if (p.kind === "pan") {
      const ctm = svgRef.current?.getScreenCTM();
      if (!ctm) return;
      setView({
        ...p.startView,
        x: p.startView.x + (e.clientX - p.startClient.x) / ctm.a,
        y: p.startView.y + (e.clientY - p.startClient.y) / ctm.d,
      });
      return;
    }

    if (p.holdFired || p.id === ROOT_ID || swapSourceId) return;
    if (!p.moved && dist < DRAG_THRESHOLD) return;
    if (!p.moved) {
      p.moved = true;
      clearHold();
    }
    const local = toTreeLocal(e.clientX, e.clientY);
    // no Santuário a árvore pode estar maior/menor ou virada: converte o arrasto
    const fx = world ? (world.main.flip ? -1 : 1) / (world.main.size || 1) : 1;
    const fy = world ? 1 / (world.main.size || 1) : 1;
    if (local && p.startLocal) setDrag({ id: p.id, dx: (local.x - p.startLocal.x) * fx, dy: (local.y - p.startLocal.y) * fy });
  };

  const handlePointerUp = () => {
    const p = pointerRef.current;
    pointerRef.current = null;
    clearHold();
    setPanning(false);
    if (!p || p.kind !== "node") return;
    if (p.holdFired) return;
    if (p.moved && drag && drag.id === p.id) {
      const { id, dx, dy } = drag;
      commit((d) => {
        const prev = d.offsets[id] || { x: 0, y: 0 };
        return { ...d, offsets: { ...d.offsets, [id]: { x: prev.x + dx, y: prev.y + dy } } };
      });
      setDrag(null);
      sfx.play("rustle");
      return;
    }
    setDrag(null);
    if (!p.moved) handleClickNode(p.id, p.shift);
  };

  /* ---------------- soltar notas nos galhos ---------------- */
  const cancelNoteHover = () => {
    clearTimeout(noteHoverTimer.current);
    noteHoverTimer.current = null;
  };

  const handlers = useStableHandlers({
    nodePointerDown: onNodePointerDown,
    hover: (id) => setHoveredId(id),
    dragOver: (id, e) => {
      if (!isNoteDrag(e)) return;
      e.preventDefault();
      if (noteHoverTimer.current) return;
      noteHoverTimer.current = setTimeout(() => {
        noteHoverTimer.current = null;
        onOpenBranch(id);
      }, 1000);
    },
    dragLeave: cancelNoteHover,
    drop: (id, e) => {
      cancelNoteHover();
      const noteId = getDraggedNoteId(e);
      if (!noteId) return;
      e.preventDefault();
      commit((d) => moveRecordsToLevel(d, [noteId], id));
      sfx.play("drop");
      setShakingId(id);
      setTimeout(() => setShakingId((s) => (s === id ? null : s)), 400);
    },
  });

  return (
    <div
      ref={workspaceRef}
      className={`workspace ${panning ? "dragging" : ""} ${swapSourceId ? "swap-mode" : ""} ${sanctuary ? `is-sanctuary season-${season}` : ""} ${sanctuary && sanc.editing ? "is-editing" : ""}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {swapSourceId && (
        <div className="swap-banner" onPointerDown={(e) => e.stopPropagation()}>
          <span>
            <strong>Modo de troca:</strong> clique em outro galho para trocar de lugar com <strong>{findBranch(tree, swapSourceId)?.name}</strong>.
          </span>
          <button type="button" className="btn small" onClick={() => setSwapSourceId(null)}>Cancelar</button>
        </div>
      )}

      <div className="tree-container">
        <svg ref={svgRef} className="tree-svg" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid meet">
          <TreeDefs />

          <Clouds />

          <g transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
            {world && <SanctuaryBackdrop world={world} view={view} baseTransform={base.transform} />}
            <g transform={base.transform} ref={treeGroupRef} className="sanc-world">
              <TreeScene
                tree={tree}
                placed={placed}
                dims={base.dims}
                trees={base.trees}
                noteCounts={noteCounts}
                cipos={cipos}
                hoveredId={hoveredId}
                swapSourceId={swapSourceId}
                activeIds={activeIds}
                shakingId={shakingId}
                dragId={drag?.id}
                handlers={handlers}
                sanctuary={sanctuary}
                world={world}
                season={season}
                branchMode={Boolean(sanc.branchMode && !sanc.editing)}
                branchSel={sanc.branch}
              />
            </g>
          </g>
        </svg>
      </div>

      {sanctuary && (
        <SanctuaryHero key={shown.kind} groupRef={treeGroupRef} containerRef={workspaceRef} world={world} onPan={panBy} />
      )}
      <SanctuaryPanel prefs={sanc} />
      {sanctuary && <BranchTools />}

      <div className={`zoom-badge ${badgeVisible ? "visible" : ""}`}>{Math.round(view.zoom * 100)}%</div>
    </div>
  );
}

const Clouds = memo(function Clouds() {
  const shapes = [
    "M 10,40 Q 25,20 50,28 Q 75,15 105,25 Q 130,18 150,32 Q 165,28 175,40 Q 180,50 165,55 L 15,55 Q 5,50 10,40 Z",
    "M 10,40 Q 30,18 60,26 Q 90,12 120,22 Q 145,15 160,35 Q 170,48 150,55 L 20,55 Q 5,48 10,40 Z",
    "M 15,38 Q 35,22 65,28 Q 85,18 115,26 Q 135,20 155,36 Q 165,48 145,55 L 18,55 Q 5,46 15,38 Z",
    "M 12,42 Q 28,24 52,30 Q 72,16 98,24 Q 120,18 138,34 Q 150,46 135,54 L 16,54 Q 4,48 12,42 Z",
    "M 20,45 Q 40,20 80,30 Q 110,10 150,25 Q 185,15 210,38 Q 225,52 200,60 L 25,60 Q 8,52 20,45 Z",
    "M 10,38 Q 22,22 45,26 Q 65,16 85,24 Q 105,18 120,32 Q 130,44 118,52 L 14,52 Q 4,46 10,38 Z",
  ];
  return (
    <g className="clouds-layer" aria-hidden="true">
      {shapes.map((d, i) => (
        <g key={i} className={`cloud cloud-${i + 1}`}>
          <path d={d} />
        </g>
      ))}
    </g>
  );
});

const LEAF_PATH = "M 0,-5 C 3.5,-2 3.5,4 0,6.5 C -3.5,4 -3.5,-2 0,-5 Z";

const TreeScene = memo(function TreeScene({
  tree,
  placed,
  dims,
  trees,
  noteCounts,
  cipos,
  hoveredId,
  swapSourceId,
  activeIds,
  shakingId,
  dragId,
  handlers,
  sanctuary,
  world,
  season,
  branchMode,
  branchSel,
}) {
  const hoveredPath = hoveredId ? getAncestorIds(tree, hoveredId) || [] : [];
  const hoveredNode = hoveredId ? findBranch(tree, hoveredId) : null;

  const nodeOpacity = (id) => {
    if (swapSourceId) {
      if (id === swapSourceId) return 1;
      return canSwapNodes(tree, swapSourceId, id) ? 0.9 : 0.25;
    }
    if (!hoveredId || id === hoveredId) return 1;
    if (hoveredId === ROOT_ID) return id === ROOT_ID ? 1 : 0.3;
    if (hoveredPath.length === 2) {
      if (isDescendant(hoveredNode, id)) return 0.45;
      return id === ROOT_ID ? 0.6 : 0.15;
    }
    if (hoveredPath.includes(id)) return 0.6;
    if (isDescendant(hoveredNode, id)) return 0.5;
    return 0.15;
  };

  const linkOpacity = (targetId) => {
    if (!hoveredId) return 1;
    if (targetId === hoveredId) return 1;
    if (hoveredPath.includes(targetId)) return 0.7;
    return Math.min(nodeOpacity(targetId), 0.4);
  };

  const rootDims = dims.get(ROOT_ID) || { rx: 38, ry: 38 };
  const descCount = (id) => countDescendants(findBranch(tree, id));
  const trunkBonus = Math.min(32, Math.pow(countDescendants(tree), 0.65) * 2.2);

  const nodeEvents = (id) => ({
    onPointerDown: (e) => handlers.nodePointerDown(id, e),
    onPointerEnter: () => handlers.hover(id),
    onPointerLeave: () => handlers.hover(null),
    onDragOver: (e) => handlers.dragOver(id, e),
    onDragLeave: handlers.dragLeave,
    onDrop: (e) => handlers.drop(id, e),
  });
  // No Santuário os galhos não abrem painéis: é só cenário
  const trunkEvents = sanctuary ? {} : nodeEvents(ROOT_ID);

  return (
    <>
      {sanctuary ? <WorldGround world={world} /> : <Ground />}
      {sanctuary && <SanctuaryBack world={world} season={season} />}
      <MainTreeWrap world={sanctuary ? world : null}>
      <ForestRoots trees={trees} />

      {placed.links.map((link) => {
        const stroke =
          link.depth === 0
            ? Math.min(14, 5 + Math.min(4, descCount(link.targetId) * 0.8) + trunkBonus * 0.1)
            : Math.max(1, Math.max(1.5, 3.5 - link.depth * 0.5));
        const count = noteCounts.get(link.targetId) || 0;
        const opacity = linkOpacity(link.targetId);
        const { parent, child } = link;
        const dx = child.x - parent.x;
        const dy = child.y - parent.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const leafCount = Math.max(2, Math.min(30, count * 2 + 2));
        const idHash = hashString(link.targetId);
        const leaves = [];
        for (let i = 0; i < leafCount; i++) {
          const seed = (i + 1) * 123.456 + (link.targetId.charCodeAt(0) || 1) * 17;
          const t = 0.2 + (i / (leafCount + 1)) * 0.6;
          const off = (2 + (i % 3) * 2) * (i % 2 === 0 ? 1 : -1);
          leaves.push(
            <path
              key={i}
              className="leaf"
              d={LEAF_PATH}
              opacity={opacity * 0.9}
              transform={`translate(${parent.x + dx * t + nx * off}, ${parent.y + dy * t + ny * off}) rotate(${Math.floor(Math.abs(Math.sin(seed)) * 360)}) scale(${0.6 + Math.abs(Math.sin(seed * 2.5)) * 0.4})`}
            />
          );
        }
        const falling = idHash % 3 === 0 && count >= 1 && count <= 4;
        const branchD = createBranchPath(parent, child);
        return (
          <g key={`link-${link.targetId}`}>
            <path
              className={link.depth === 0 ? "branch-line" : "child-line"}
              filter="url(#organic-branch)"
              style={{ strokeWidth: `${stroke.toFixed(1)}px`, opacity }}
              d={branchD}
            />
            {link.depth <= 1 && stroke > 3 && (
              <path
                className="branch-grain"
                d={branchD}
                style={{ strokeWidth: `${Math.max(0.6, stroke * 0.11).toFixed(2)}px`, opacity: opacity * 0.8, strokeDashoffset: idHash % 40 }}
              />
            )}
            {leaves}
            {falling && (
              <g className="falling-leaf" transform={`translate(${parent.x + dx * 0.5}, ${parent.y + dy * 0.5})`} style={{ animationDelay: `${idHash % 5}s` }}>
                <path className="leaf" d={LEAF_PATH} transform="scale(0.85)" />
              </g>
            )}
          </g>
        );
      })}

      <g className="canopy fx" filter="url(#watercolor)">
        {/* copa do topo de cada tronco */}
        {trees.map((t) => (
          <g key={`crown-${t.index}`} className="blob is-sub crown" style={{ opacity: hoveredId && hoveredId !== ROOT_ID ? 0.45 : 1 }}>
            {(t.geo.crowns || []).map((c, i) => (
              <circle key={i} cx={c.cx} cy={c.cy} r={c.r} />
            ))}
          </g>
        ))}
        {placed.nodes
          .filter((n) => n.branch.id !== ROOT_ID)
          .map((node) => {
            const { id } = node.branch;
            const isMain = node.depth === 1;
            const d = dims.get(id) || { rx: isMain ? 70 : 45, ry: isMain ? 25 : 18 };
            const circles = canopyCircles(id, node.x, node.y, d.rx, d.ry, noteCounts.get(id) || 0, isMain);
            const cls = activeIds.has(id) || hoveredId === id || swapSourceId === id ? "is-active" : isMain ? "is-main" : "is-sub";
            return (
              <g key={id} className={`blob ${cls}`} style={{ opacity: nodeOpacity(id) }}>
                {circles.map((c, i) => (
                  <circle key={i} cx={c.cx} cy={c.cy} r={c.r} />
                ))}
              </g>
            );
          })}
      </g>

      <ForestTrunks trees={trees} selected={activeIds.has(ROOT_ID)} dimmed={Boolean(hoveredId && hoveredId !== ROOT_ID)} events={trunkEvents} onSideTreeMenu={sanctuary ? undefined : () => refuseExtraTrees()} />
      {sanctuary && <BranchLanterns nodes={placed.nodes} dims={dims} show={sanctuary.lanterns} />}
      {sanctuary && branchMode && <BranchHandles nodes={placed.nodes} dims={dims} events={nodeEvents} selected={branchSel} />}
      </MainTreeWrap>
      {sanctuary && <SanctuaryFront world={world} season={season} />}
      {!sanctuary && (
      <>
      <g className={`tree-node root-node ${activeIds.has(ROOT_ID) ? "selected" : ""} ${shakingId === ROOT_ID ? "shaking" : ""}`} style={{ opacity: nodeOpacity(ROOT_ID) }} {...nodeEvents(ROOT_ID)}>
        <circle className="main-circle" cx={ROOT_POS.x} cy={ROOT_POS.y} r={rootDims.rx} />
        <text className="main-text" x={ROOT_POS.x} y={ROOT_POS.y + 6} textAnchor="middle">
          {tree.name || "EU"}
        </text>
      </g>

      {cipos.map((c) => {
        const p1 = placed.pos.get(c.fromId);
        const p2 = placed.pos.get(c.toId);
        if (!p1 || !p2) return null;
        const opacity = hoveredId ? (hoveredId === c.fromId || hoveredId === c.toId ? 0.9 : 0.15) : 0.7;
        return (
          <path key={`cipo-${c.fromId}-${c.toId}`} className="cipo-line" d={createCipoPath(p1, p2)} style={{ opacity }}>
            <title>{`Cipó: [${c.tag}]`}</title>
          </path>
        );
      })}

      {placed.nodes
        .filter((n) => n.branch.id !== ROOT_ID)
        .map((node) => {
          const { id, name } = node.branch;
          const isMain = node.depth === 1;
          const d = dims.get(id) || { rx: isMain ? 70 : 45, ry: isMain ? 25 : 18 };
          const fontSize = Math.max(9, Math.min(13, d.ry * 0.55));
          const classes = [
            "tree-node",
            isMain ? "branch-group" : "child-group",
            activeIds.has(id) ? "selected" : "",
            shakingId === id ? "shaking" : "",
            dragId === id ? "is-dragging" : "",
            swapSourceId && id === swapSourceId ? "swap-source" : "",
            swapSourceId && canSwapNodes(tree, swapSourceId, id) ? "swap-target" : "",
          ].join(" ");
          return (
            <g key={id} className={classes} style={{ opacity: nodeOpacity(id) }} {...nodeEvents(id)}>
              <title>{`${name} • ${noteCounts.get(id) || 0} nota(s)`}</title>
              <ellipse className="hit-area" cx={node.x} cy={node.y} rx={d.rx + 6} ry={d.ry + 6} />
              <ellipse className={isMain ? "branch-node" : "child-node"} cx={node.x} cy={node.y} rx={d.rx} ry={d.ry} />
              <text className={isMain ? "branch-text" : "child-text"} x={node.x} y={node.y + 4} textAnchor="middle" style={{ fontSize }}>
                {name}
              </text>
            </g>
          );
        })}
      </>
      )}
    </>
  );
});
