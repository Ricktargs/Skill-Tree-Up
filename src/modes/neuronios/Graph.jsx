import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sfx } from '../arvore/lib/sound.js';
import { DEFAULT_FORCES } from './forces.js';

// =========================================================
// MAPA DE NEURÔNIOS — grafo com forças (estilo Obsidian)
// Repulsão entre nós, molas nas ligações e leve puxão ao centro.
// Rolar = zoom · arrastar o fundo = mover · arrastar nó = reposicionar
// Shift + arrastar o fundo = caixa de seleção · Delete = excluir os selecionados
// V = nova arrumação aleatória (ligados juntos, ninguém sobreposto)
// =========================================================


// Número estável por neurônio (ritmo da flutuação)
const floatSeed = (id) => {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
};
const DAMPING = 0.58;

// Distância mínima entre dois neurônios (para nunca ficarem sobrepostos)
const MIN_GAP = 46;

// Último enquadramento do mapa: ao fechar a janela do neurônio (no celular o mapa
// some e volta), o mapa reaparece igual, sem zoom que ninguém pediu
let lastView = null;

const shuffled = (arr) => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export default function Graph({ nodes, links, activeId, openIds, onOpen, onCreateAt, onSettle, onDeleteMany, highlightIds, resizeKey, forces = DEFAULT_FORCES }) {
  const svgRef = useRef(null);
  const sim = useRef(new Map()); // id -> { x, y, vx, vy, fixed }
  const alpha = useRef(1);
  const raf = useRef(0);
  const [, setFrame] = useState(0);
  const [view, setView] = useState(() => lastView || { x: 0, y: 0, k: 1 });
  // As forças vêm do painel "Mapa/Neuro" (fica embaixo do + Neurônio)
  const forcesRef = useRef(forces);
  const forcesKey = `${forces.center}|${forces.repel}|${forces.link}|${forces.distance}`;
  const firstForces = useRef(true);
  useEffect(() => {
    lastView = view;
  }, [view]);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hover, setHover] = useState(null);
  const drag = useRef(null); // { id?, pan?, box?, sx, sy, moved }
  const [selected, setSelected] = useState(() => new Set());
  const [box, setBox] = useState(null); // retângulo de seleção (coordenadas da tela, dentro do svg)
  const onDeleteRef = useRef(onDeleteMany);
  const selectedRef = useRef(selected);
  useEffect(() => {
    onDeleteRef.current = onDeleteMany;
    selectedRef.current = selected;
  });

  // Neurônios que somem do mapa saem da seleção
  const idsKey = nodes.map((n) => n.id).join('|');
  useEffect(() => {
    const ids = new Set(nodes.map((n) => n.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- só limpa ids que deixaram de existir
    setSelected((s) => {
      const next = new Set([...s].filter((id) => ids.has(id)));
      return next.size === s.size ? s : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  // Delete / Backspace: exclui os selecionados · Esc: limpa a seleção
  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement;
      const editing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (editing || !selectedRef.current.size || document.querySelector('.ui-dialog-backdrop, .modal-backdrop')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        const ids = [...selectedRef.current];
        setSelected(new Set());
        if (onDeleteRef.current) onDeleteRef.current(ids);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setSelected(new Set());
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, []);
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
    const F = forcesRef.current;
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
        const f = (F.repel / d2) * a;
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
      const f = (d - (l.distance || F.distance)) * F.link * a;
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      p.vx += fx;
      p.vy += fy;
      q.vx -= fx;
      q.vy -= fy;
    });
    // Colisão: nenhum neurônio fica em cima de outro
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const p = list[i];
        const q = list[j];
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        if (d >= MIN_GAP) continue;
        const push = (MIN_GAP - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        if (!p.fixed) {
          p.x -= ux * push;
          p.y -= uy * push;
        }
        if (!q.fixed) {
          q.x += ux * push;
          q.y += uy * push;
        }
      }
    }
    // Centro + movimento
    list.forEach((p) => {
      p.vx -= p.x * F.center * a;
      p.vy -= p.y * F.center * a;
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

  useEffect(() => {
    forcesRef.current = forces;
    if (firstForces.current) {
      firstForces.current = false;
      return;
    }
    reheat(0.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forcesKey]);

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
    // Mapa novo (ninguém com posição salva): já nasce em galhos, sem embolar
    if (added > 2 && added === nodes.length && nodes.every((n) => typeof n.x !== 'number')) {
      shuffleRef.current(false);
      return () => cancelAnimationFrame(raf.current);
    }
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
    const k = Math.max(0.25, Math.min(1, Math.min((size.w - 120) / (maxX - minX + 1), (size.h - 140) / (maxY - minY + 1))));
    setView({ x: -((minX + maxX) / 2) * k, y: -((minY + maxY) / 2) * k, k });
    return undefined;
  }, [nodes, size]);

  // ---------- V: nova arrumação aleatória ----------
  // Cada grupo de neurônios ligados vai para um lugar sorteado (perto dos outros,
  // sem encostar) e, dentro do grupo, cada um nasce ao lado de quem está ligado a ele.
  // Depois as forças do mapa terminam de ajeitar: ligados bem perto, soltos só perto.
  const shuffleLayout = useCallback((withSound = true) => {
    const pos = sim.current;
    const ids = nodes.map((n) => n.id).filter((id) => pos.has(id));
    if (ids.length < 2) return;

    // Grupos ligados (componentes), descobertos a partir de pontos sorteados
    const seen = new Set();
    const comps = [];
    shuffled(ids).forEach((start) => {
      if (seen.has(start)) return;
      const tree = [{ id: start, parent: null }];
      seen.add(start);
      for (let k = 0; k < tree.length; k += 1) {
        shuffled([...(neighbors.get(tree[k].id) || [])]).forEach((nb) => {
          if (seen.has(nb) || !pos.has(nb)) return;
          seen.add(nb);
          tree.push({ id: nb, parent: tree[k].id });
        });
      }
      comps.push(tree);
    });

    // Lugar de cada grupo: espiral a partir do centro, sem invadir outro grupo
    const placed = [];
    comps.forEach((tree) => {
      const dist = forcesRef.current.distance;
      const R = tree.length === 1 ? MIN_GAP * 0.6 : dist * Math.sqrt(tree.length) * 0.75 + 20;
      const gap = 30;
      let cx = 0;
      let cy = 0;
      for (let attempt = 0; attempt < 600; attempt += 1) {
        const dist = attempt * 6;
        const ang = Math.random() * Math.PI * 2;
        const x = Math.cos(ang) * dist;
        const y = Math.sin(ang) * dist;
        if (placed.every((c) => Math.hypot(c.x - x, c.y - y) >= c.r + R + gap)) {
          cx = x;
          cy = y;
          break;
        }
      }
      placed.push({ x: cx, y: cy, r: R });

      // Dentro do grupo: galhos crescendo para fora (como uma teia/constelação).
      // Cada filho sai na direção oposta a quem veio antes, abrindo em leque.
      const at = new Map();
      const dir = new Map(); // ângulo do galho que chegou em cada neurônio
      const kids = new Map();
      tree.forEach((t) => {
        if (t.parent) kids.set(t.parent, [...(kids.get(t.parent) || []), t.id]);
      });
      tree.forEach((t) => {
        if (!t.parent) {
          at.set(t.id, { x: cx, y: cy });
          return;
        }
        const parent = at.get(t.parent);
        const siblings = kids.get(t.parent);
        const i = siblings.indexOf(t.id);
        const n = siblings.length;
        const root = !tree.find((x) => x.id === t.parent).parent;
        // raiz: espalha em volta toda; resto: leque de até ~150° para fora
        const base = root ? Math.random() * Math.PI * 2 : dir.get(t.parent);
        const spread = root ? Math.PI * 2 : Math.min(Math.PI * 0.85, 0.55 * n);
        const ang = root
          ? base + (i / n) * spread
          : base + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread) + (Math.random() - 0.5) * 0.25;
        dir.set(t.id, ang);
        const len = dist * (0.9 + Math.random() * 0.25);
        at.set(t.id, { x: parent.x + Math.cos(ang) * len, y: parent.y + Math.sin(ang) * len });
      });
      at.forEach((xy, id) => {
        const p = pos.get(id);
        p.x = xy.x;
        p.y = xy.y;
        p.vx = 0;
        p.vy = 0;
        p.fixed = false;
      });
    });

    if (withSound) sfx.play('rustle');
    reheat(1);
  }, [nodes, neighbors, reheat]);

  const shuffleRef = useRef(shuffleLayout);
  useEffect(() => {
    shuffleRef.current = shuffleLayout;
  });
  useEffect(() => {
    const onKey = (e) => {
      if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || (e.key || '').toLowerCase() !== 'v') return;
      const el = document.activeElement;
      const editing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (editing || document.querySelector('.ui-dialog-backdrop, .modal-backdrop')) return;
      e.preventDefault();
      e.stopPropagation();
      // Sem zoom: o mapa fica onde está, só os neurônios se rearrumam
      shuffleRef.current();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, []);

  // Enquadra uma vez quando o mapa abre (só afasta, nunca aproxima).
  // Se o mapa já foi visto nesta sessão, volta exatamente como estava.
  const fittedRef = useRef(Boolean(lastView));
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
    try {
      svgRef.current.setPointerCapture(e.pointerId);
    } catch {
      // ponteiro sem captura (ex.: caneta/toque já solto): segue sem capturar
    }
    if (id) {
      const p = sim.current.get(id);
      const g = toGraph(e.clientX, e.clientY);
      // Arrastar um selecionado leva todos os selecionados juntos
      const group = selected.has(id)
        ? [...selected].filter((sid) => sid !== id && sim.current.get(sid)).map((sid) => {
            const q = sim.current.get(sid);
            q.fixed = true;
            return { id: sid, dx: q.x - p.x, dy: q.y - p.y };
          })
        : [];
      drag.current = { id, sx: e.clientX, sy: e.clientY, ox: g.x - p.x, oy: g.y - p.y, moved: false, group };
      p.fixed = true;
    } else if (e.shiftKey) {
      const r = svgRef.current.getBoundingClientRect();
      drag.current = { box: true, sx: e.clientX, sy: e.clientY, left: r.left, top: r.top, base: e.ctrlKey || e.metaKey ? new Set(selected) : new Set(), moved: false };
      setBox({ x: e.clientX - r.left, y: e.clientY - r.top, w: 0, h: 0 });
    } else {
      drag.current = { pan: true, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
    }
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4) d.moved = true;
    if (d.box) {
      // Vai selecionando enquanto arrasta
      const x0 = Math.min(d.sx, e.clientX);
      const y0 = Math.min(d.sy, e.clientY);
      const x1 = Math.max(d.sx, e.clientX);
      const y1 = Math.max(d.sy, e.clientY);
      setBox({ x: x0 - d.left, y: y0 - d.top, w: x1 - x0, h: y1 - y0 });
      const a = toGraph(x0, y0);
      const b = toGraph(x1, y1);
      const next = new Set(d.base);
      nodes.forEach((n) => {
        if (n.kind === 'tag') return;
        const p = sim.current.get(n.id);
        if (p && p.x >= a.x && p.x <= b.x && p.y >= a.y && p.y <= b.y) next.add(n.id);
      });
      setSelected(next);
    } else if (d.pan) {
      setView((v) => ({ ...v, x: d.vx + (e.clientX - d.sx), y: d.vy + (e.clientY - d.sy) }));
    } else if (d.moved) {
      const p = sim.current.get(d.id);
      const g = toGraph(e.clientX, e.clientY);
      p.x = g.x - d.ox;
      p.y = g.y - d.oy;
      (d.group || []).forEach((m) => {
        const q = sim.current.get(m.id);
        if (q) {
          q.x = p.x + m.dx;
          q.y = p.y + m.dy;
        }
      });
      reheat(0.25);
    }
  };

  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.box) {
      setBox(null);
      if (selectedRef.current.size) sfx.play('tick');
      return;
    }
    // Clique simples no fundo limpa a seleção
    if (d.pan && !d.moved) setSelected((s) => (s.size ? new Set() : s));
    if (d.id) {
      const p = sim.current.get(d.id);
      if (p) p.fixed = false;
      (d.group || []).forEach((m) => {
        const q = sim.current.get(m.id);
        if (q) q.fixed = false;
      });
      if (!d.moved) onOpen(d.id, e.ctrlKey || e.metaKey || e.shiftKey);
      else {
        sfx.play('drop');
        reheat(0.2);
      }
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
        data-pinch-zoom="0.0015"
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
                className={`nr-node ${n.kind === 'tag' ? 'is-tag' : ''} ${isActive ? 'active' : ''} ${openSet.has(n.id) ? 'open' : ''} ${selected.has(n.id) ? 'selected' : ''} ${dim ? 'dim' : ''}`}
                transform={`translate(${p.x} ${p.y})`}
                onPointerDown={(e) => onPointerDown(e, n.id)}
                onPointerEnter={() => setHover(n.id)}
                onPointerLeave={() => setHover((h) => (h === n.id ? null : h))}
              >
                {/* flutua um pouquinho, cada um no seu ritmo */}
                <g className="nr-float" style={{ animationDuration: `${5 + (floatSeed(n.id) % 40) / 10}s`, animationDelay: `${-(floatSeed(n.id) % 50) / 10}s` }}>
                  {isActive && <circle className="nr-halo" r={r + 7} />}
                  {selected.has(n.id) && <circle className="nr-select-ring" r={r + 5} />}
                  <circle
                    className="nr-dot"
                    r={r}
                    style={{
                      '--nr-c': n.color,
                      ...(n.glow ? { filter: `drop-shadow(0 0 ${n.glow.toFixed(1)}px ${n.color})` } : null)
                    }}
                  />
                  {label && (
                    <text className="nr-label" y={r + 13} textAnchor="middle" style={{ fontSize: `${Math.max(9, 11.5 / Math.sqrt(view.k))}px` }}>
                      {n.label.length > 34 ? `${n.label.slice(0, 32)}…` : n.label}
                    </text>
                  )}
                </g>
              </g>
            );
          })}
        </g>
        {box && <rect className="nr-select-box" x={box.x} y={box.y} width={box.w} height={box.h} rx="4" />}
      </svg>
      {selected.size > 0 && (
        <div className="nr-select-hint">
          {selected.size === 1 ? '1 neurônio selecionado' : `${selected.size} neurônios selecionados`} · <kbd>Delete</kbd> exclui · <kbd>Esc</kbd> limpa
        </div>
      )}

    </div>
  );
}
