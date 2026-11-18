import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// =========================================================
// MAPA DE NEURÔNIOS — grafo com forças (estilo Obsidian)
// Repulsão entre nós, molas nas ligações e leve puxão ao centro.
// Rolar = zoom · arrastar o fundo = mover · arrastar nó = reposicionar
// =========================================================

const LINK_DISTANCE = 95;
const REPULSION = 2600;
const SPRING = 0.035;
const CENTER = 0.006;
const DAMPING = 0.58;

export default function Graph({ nodes, links, activeId, openIds, onOpen, onCreateAt, onSettle, highlightIds, resizeKey }) {
  const svgRef = useRef(null);
  const sim = useRef(new Map()); // id -> { x, y, vx, vy, fixed }
  const alpha = useRef(1);
  const raf = useRef(0);
  const [, setFrame] = useState(0);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hover, setHover] = useState(null);
  const drag = useRef(null); // { id?, pan?, sx, sy, moved }
  const settledRef = useRef(false);
  const onSettleRef = useRef(onSettle);
  useEffect(() => {
    onSettleRef.current = onSettle;
  });

  // ---------- Tamanho da área ----------
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(100, r.width), h: Math.max(100, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [resizeKey]);

  // ---------- Vizinhos ----------
  const neighbors = useMemo(() => {
    const m = new Map();
    nodes.forEach((n) => m.set(n.id, new Set()));
    links.forEach((l) => {
      if (m.has(l.source) && m.has(l.target)) {
        m.get(l.source).add(l.target);
        m.get(l.target).add(l.source);
      }
    });
    return m;
  }, [nodes, links]);

  // ---------- Simulação ----------
  const step = useCallback(() => {
    const pos = sim.current;
    const list = nodes.map((n) => pos.get(n.id)).filter(Boolean);
    const a = alpha.current;
    // Repulsão
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const p = list[i];
        const q = list[j];
        let dx = q.x - p.x;
        let dy = q.y - p.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          d2 = 1;
        }
        if (d2 > 250000) continue;
        const f = (REPULSION / d2) * a;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        p.vx -= fx;
        p.vy -= fy;
        q.vx += fx;
        q.vy += fy;
      }
    }
    // Molas das ligações
    links.forEach((l) => {
      const p = pos.get(l.source);
      const q = pos.get(l.target);
      if (!p || !q) return;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - (l.distance || LINK_DISTANCE)) * SPRING * a;
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      p.vx += fx;
      p.vy += fy;
      q.vx -= fx;
      q.vy -= fy;
    });
    // Centro + movimento
    list.forEach((p) => {
      p.vx -= p.x * CENTER * a;
      p.vy -= p.y * CENTER * a;
      if (p.fixed) {
        p.vx = 0;
        p.vy = 0;
        return;
      }
      p.vx *= DAMPING;
      p.vy *= DAMPING;
      p.x += Math.max(-30, Math.min(30, p.vx));
      p.y += Math.max(-30, Math.min(30, p.vy));
    });
    alpha.current = Math.max(0, a - 0.012);
  }, [nodes, links]);

  const run = useCallback(() => {
    cancelAnimationFrame(raf.current);
    settledRef.current = false;
    const loop = () => {
      step();
      setFrame((f) => (f + 1) % 1e6);
      if (alpha.current > 0.004 || drag.current?.id) {
        raf.current = requestAnimationFrame(loop);
      } else if (!settledRef.current) {
        settledRef.current = true;
        // Guarda as posições quando o mapa assenta
        const out = {};
        sim.current.forEach((p, id) => {
          out[id] = { x: Math.round(p.x), y: Math.round(p.y) };
        });
        if (onSettleRef.current) onSettleRef.current(out);
      }
    };
    raf.current = requestAnimationFrame(loop);
  }, [step]);

  const reheat = useCallback(
    (value = 0.5) => {
      alpha.current = Math.max(alpha.current, value);
      run();
    },
    [run]
  );

  // Novos nós entram perto de um vizinho (ou da posição salva)
  const nodeKey = nodes.map((n) => n.id).join('|');
  const linkKey = links.map((l) => `${l.source}>${l.target}`).join('|');
  useEffect(() => {
    const pos = sim.current;
    let added = 0;
    nodes.forEach((n) => {
      if (pos.has(n.id)) return;
      added += 1;
      const near = [...(neighbors.get(n.id) || [])].map((id) => pos.get(id)).find(Boolean);
      const base = typeof n.x === 'number' && typeof n.y === 'number' ? { x: n.x, y: n.y } : near || { x: 0, y: 0 };
      const jitter = typeof n.x === 'number' ? 0 : 60;
      pos.set(n.id, {
        x: base.x + (Math.random() - 0.5) * jitter,
        y: base.y + (Math.random() - 0.5) * jitter,
        vx: 0,
        vy: 0,
        fixed: false
      });
    });
    reheat(added > 0 && added === nodes.length && nodes.every((n) => typeof n.x === 'number') ? 0.15 : 0.6);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeKey, linkKey]);

  // ---------- Coordenadas ----------
  const toGraph = (clientX, clientY) => {
    const r = svgRef.current.getBoundingClientRect();
    return {
      x: (clientX - r.left - size.w / 2 - view.x) / view.k,
      y: (clientY - r.top - size.h / 2 - view.y) / view.k
    };
  };

  const fit = useCallback(() => {
    const list = nodes.map((n) => sim.current.get(n.id)).filter(Boolean);
    if (list.length === 0) return setView({ x: 0, y: 0, k: 1 });
    const xs = list.map((p) => p.x);
    const ys = list.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const k = Math.max(0.25, Math.min(2, Math.min((size.w - 120) / (maxX - minX + 1), (size.h - 140) / (maxY - minY + 1))));
    setView({ x: -((minX + maxX) / 2) * k, y: -((minY + maxY) / 2) * k, k });
    return undefined;
  }, [nodes, size]);

  // Enquadra uma vez quando o mapa abre
  const fittedRef = useRef(false);
  useEffect(() => {
    if (fittedRef.current || nodes.length === 0) return undefined;
    const t = setTimeout(() => {
      fittedRef.current = true;
      fit();
    }, 450);
    return () => clearTimeout(t);
  }, [nodes.length, fit]);

  // ---------- Zoom (roda do mouse, com passivo desligado) ----------
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left - r.width / 2;
      const my = e.clientY - r.top - r.height / 2;
      setView((v) => {
        const k = Math.max(0.2, Math.min(3.5, v.k * Math.exp(-e.deltaY * 0.0015)));
        const f = k / v.k;
        return { k, x: mx - (mx - v.x) * f, y: my - (my - v.y) * f };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ---------- Arrastar ----------
  const onPointerDown = (e, id) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    svgRef.current.setPointerCapture(e.pointerId);
    if (id) {
      const p = sim.current.get(id);
      const g = toGraph(e.clientX, e.clientY);
      drag.current = { id, sx: e.clientX, sy: e.clientY, ox: g.x - p.x, oy: g.y - p.y, moved: false };
      p.fixed = true;
    } else {
      drag.current = { pan: true, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
    }
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4) d.moved = true;
    if (d.pan) {
      setView((v) => ({ ...v, x: d.vx + (e.clientX - d.sx), y: d.vy + (e.clientY - d.sy) }));
    } else if (d.moved) {
      const p = sim.current.get(d.id);
      const g = toGraph(e.clientX, e.clientY);
      p.x = g.x - d.ox;
      p.y = g.y - d.oy;
      reheat(0.25);
    }
  };

  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.id) {
      const p = sim.current.get(d.id);
      if (p) p.fixed = false;
      if (!d.moved) onOpen(d.id, e.ctrlKey || e.metaKey || e.shiftKey);
      else reheat(0.2);
    }
  };

  // ---------- Desenho ----------
  const degree = (id) => (neighbors.get(id) || new Set()).size;
  const radius = (n) => (n.kind === 'tag' ? 5 : 6 + Math.min(12, degree(n.id) * 1.8));
  // Passar o mouse destaca os vizinhos (e esmaece o resto); o neurônio aberto só acende os fios dele
  const focus = hover;
  const focusSet = focus ? new Set([focus, ...(neighbors.get(focus) || [])]) : null;
  const litFrom = hover || activeId;
  const openSet = new Set(openIds || []);
  const showAllLabels = view.k >= 0.75;

  return (
    <div className="nr-graph">
      <svg
        ref={svgRef}
        className="nr-svg"
        onPointerDown={(e) => onPointerDown(e, null)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(e) => {
          if (e.target !== svgRef.current && !e.target.classList.contains('nr-bg')) return;
          const g = toGraph(e.clientX, e.clientY);
          onCreateAt(g.x, g.y);
        }}
      >
        <rect className="nr-bg" x="0" y="0" width={size.w} height={size.h} fill="transparent" />
        <g transform={`translate(${size.w / 2 + view.x} ${size.h / 2 + view.y}) scale(${view.k})`}>
          {links.map((l) => {
            const p = sim.current.get(l.source);
            const q = sim.current.get(l.target);
            if (!p || !q) return null;
            const lit = litFrom && (l.source === litFrom || l.target === litFrom);
            return (
              <line
                key={`${l.source}>${l.target}`}
                className={`nr-link ${l.kind === 'tag' ? 'is-tag' : ''} ${lit ? 'lit' : ''} ${focusSet && !lit ? 'dim' : ''}`}
                x1={p.x}
                y1={p.y}
                x2={q.x}
                y2={q.y}
              />
            );
          })}
          {nodes.map((n) => {
            const p = sim.current.get(n.id);
            if (!p) return null;
            const r = radius(n);
            const dim = (focusSet && !focusSet.has(n.id)) || (highlightIds && !highlightIds.has(n.id));
            const isActive = n.id === activeId;
            const label =
              showAllLabels || (focusSet && focusSet.has(n.id)) || isActive || r > 13 || (activeId && (neighbors.get(activeId) || new Set()).has(n.id));
            return (
              <g
                key={n.id}
                className={`nr-node ${n.kind === 'tag' ? 'is-tag' : ''} ${isActive ? 'active' : ''} ${openSet.has(n.id) ? 'open' : ''} ${dim ? 'dim' : ''}`}
                transform={`translate(${p.x} ${p.y})`}
                onPointerDown={(e) => onPointerDown(e, n.id)}
                onPointerEnter={() => setHover(n.id)}
                onPointerLeave={() => setHover((h) => (h === n.id ? null : h))}
              >
                {isActive && <circle className="nr-halo" r={r + 7} />}
                <circle className="nr-dot" r={r} style={{ '--nr-c': n.color }} />
                {label && (
                  <text className="nr-label" y={r + 13} textAnchor="middle" style={{ fontSize: `${Math.max(9, 11.5 / Math.sqrt(view.k))}px` }}>
                    {n.label.length > 34 ? `${n.label.slice(0, 32)}…` : n.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="nr-graph-tools">
        <button type="button" className="round-button" onClick={() => setView((v) => ({ ...v, k: Math.min(3.5, v.k * 1.25) }))} title="Aproximar">
          +
        </button>
        <button type="button" className="round-button" onClick={() => setView((v) => ({ ...v, k: Math.max(0.2, v.k / 1.25) }))} title="Afastar">
          −
        </button>
        <button type="button" className="round-button" onClick={fit} title="Enquadrar tudo">
          ⤢
        </button>
        <button
          type="button"
          className="round-button"
          onClick={() => {
            sim.current.forEach((p) => {
              p.x += (Math.random() - 0.5) * 80;
              p.y += (Math.random() - 0.5) * 80;
            });
            reheat(1);
          }}
          title="Reorganizar o mapa"
        >
          ↻
        </button>
      </div>
    </div>
  );
}
