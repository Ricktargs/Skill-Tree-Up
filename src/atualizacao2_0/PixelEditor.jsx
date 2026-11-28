// =========================================================
// 🎨 CRIADOR DE PERSONAGEM EM PIXEL ART
// Pinta célula por célula na mesma grade dos personagens 2D.
// Ferramentas: lápis, borracha, balde, conta-gotas, espelhar e molde.
// Ctrl+Z / Ctrl+Y desfazem e refazem aqui dentro (sem botões na tela).
// =========================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GRID, cellsFromPixels, pixelsFromHero, starterPixels, templatePixels } from './Hero2D.js';
import { HERO_CLASSES, getLook } from './HeroModels.js';
import { CellsSvg } from './Hero2DView.jsx';
import { ask } from '../shared/Dialog.jsx';
import { tx } from '../i18n/index.jsx';
import './PixelEditor.css';

const W = GRID.c1 - GRID.c0 + 1;
const H = GRID.r1 - GRID.r0 + 1;
const CELL = 12; // px internos do canvas por célula
const MIRROR_AXIS = 35; // c' = 35 - c (centro do molde)

const PALETTE = [
  '#0b0b0d', '#ffffff', '#e5e7eb', '#9ca3af', '#4b5563', '#1f2937',
  '#fde28f', '#e8c870', '#f1c193', '#c68642', '#6b4226', '#3d2314',
  '#4a1010', '#7f1d1d', '#dc2626', '#f97316', '#facc15', '#a3e635',
  '#16a34a', '#14532d', '#0b2530', '#0f766e', '#06b6d4', '#60a5fa',
  '#1d4ed8', '#1e3a8a', '#4c1d95', '#a855f7', '#ec4899', '#f9a8d4',
  '#3a2a1e', '#3b2c22', '#78350f', '#141a1c', '#b8c0cc', '#e6ebf2'
];

const TOOLS = [
  ['pencil', '✏️', 'Lápis'],
  ['eraser', '🧽', 'Borracha'],
  ['fill', '🪣', 'Balde'],
  ['pick', '💧', 'Conta-gotas']
];

// Portão das teclas: registrado assim que o programa carrega (antes de
// qualquer atalho). Com o criador aberto, as teclas vão só para ele.
let keyHandler = null;
if (typeof window !== 'undefined') {
  window.addEventListener(
    'keydown',
    (e) => {
      if (keyHandler) keyHandler(e);
    },
    true
  );
}

const key = (c, r) => `${c},${r}`;
const inGrid = (c, r) => c >= GRID.c0 && c <= GRID.c1 && r >= GRID.r0 && r <= GRID.r1;

export default function PixelEditor({ initial, hero, onSave, onCancel, onDelete, playSound, lockedName = null }) {
  // novo: já vem com o molde, pele clara e olhos (para orientar)
  const [pixels, setPixels] = useState(() => ({ ...(initial && initial.pixels ? initial.pixels : starterPixels()) }));
  const [name, setName] = useState(lockedName || (initial && initial.name) || tx('Meu personagem'));
  const [tool, setTool] = useState('pencil');
  const [color, setColor] = useState('#fde28f');
  const [recent, setRecent] = useState([]);
  const [size, setSize] = useState(1);
  const [mirror, setMirror] = useState(false);
  const [guide, setGuide] = useState(true);
  const [hover, setHover] = useState(null);
  const canvasRef = useRef(null);
  const pixelsRef = useRef(pixels);
  pixelsRef.current = pixels;
  const past = useRef([]);
  const future = useRef([]);
  const stroke = useRef(null);
  const dirty = useRef(false);
  const guidePixels = useMemo(() => templatePixels(), []);
  const click = (t = 'click') => playSound && playSound(t);

  // ---------- desenho do quadro ----------
  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    // xadrez = transparente
    for (let r = 0; r < H; r++)
      for (let c = 0; c < W; c++) {
        ctx.fillStyle = (r + c) % 2 ? '#2a3140' : '#252b38';
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    // molde de guia, bem clarinho
    if (guide) {
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      Object.keys(guidePixels).forEach((k) => {
        const [c, r] = k.split(',').map(Number);
        ctx.fillRect((c - GRID.c0) * CELL, (r - GRID.r0) * CELL, CELL, CELL);
      });
    }
    Object.entries(pixelsRef.current).forEach(([k, col]) => {
      const [c, r] = k.split(',').map(Number);
      ctx.fillStyle = col;
      ctx.fillRect((c - GRID.c0) * CELL, (r - GRID.r0) * CELL, CELL, CELL);
    });
    // linhas da grade
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= W; c++) {
      ctx.moveTo(c * CELL + 0.5, 0);
      ctx.lineTo(c * CELL + 0.5, H * CELL);
    }
    for (let r = 0; r <= H; r++) {
      ctx.moveTo(0, r * CELL + 0.5);
      ctx.lineTo(W * CELL, r * CELL + 0.5);
    }
    ctx.stroke();
    if (mirror) {
      ctx.strokeStyle = 'rgba(56,189,248,0.55)';
      ctx.setLineDash([4, 4]);
      const x = (MIRROR_AXIS / 2 - GRID.c0 + 0.5) * CELL;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H * CELL);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (hover) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect((hover.c - GRID.c0) * CELL + 1, (hover.r - GRID.r0) * CELL + 1, CELL * size - 2, CELL * size - 2);
    }
  }, [guide, guidePixels, mirror, hover, size]);
  useEffect(draw, [draw, pixels]);

  // ---------- histórico (Ctrl+Z / Ctrl+Y) ----------
  const snapshot = () => {
    past.current.push(pixelsRef.current);
    if (past.current.length > 80) past.current.shift();
    future.current = [];
    dirty.current = true;
  };
  const undo = () => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(pixelsRef.current);
    setPixels(prev);
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(pixelsRef.current);
    setPixels(next);
  };

  // ---------- pintar ----------
  const cellAt = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * W) + GRID.c0;
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * H) + GRID.r0;
    return { c, r };
  };
  const paintCells = (list, value) => {
    setPixels((prev) => {
      const next = { ...prev };
      list.forEach(([c, r]) => {
        const targets = [[c, r]];
        if (mirror) targets.push([MIRROR_AXIS - c, r]);
        targets.forEach(([x, y]) => {
          for (let dy = 0; dy < size; dy++)
            for (let dx = 0; dx < size; dx++) {
              const cx = x + (mirror && x !== c ? -dx : dx);
              const cy = y + dy;
              if (!inGrid(cx, cy)) continue;
              if (value) next[key(cx, cy)] = value;
              else delete next[key(cx, cy)];
            }
        });
      });
      return next;
    });
  };
  const lineCells = (a, b) => {
    const out = [];
    let { c: x0, r: y0 } = a;
    const { c: x1, r: y1 } = b;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 400; guard++) {
      out.push([x0, y0]);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return out;
  };
  const floodFill = (start, value) => {
    const src = pixelsRef.current;
    const target = src[key(start.c, start.r)] || null;
    if (target === (value || null)) return;
    const next = { ...src };
    const stack = [[start.c, start.r]];
    const seen = new Set();
    while (stack.length) {
      const [c, r] = stack.pop();
      const k = key(c, r);
      if (seen.has(k) || !inGrid(c, r)) continue;
      seen.add(k);
      if ((src[k] || null) !== target) continue;
      if (value) next[k] = value;
      else delete next[k];
      stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
    }
    setPixels(next);
  };
  const pickColor = (col) => {
    setColor(col);
    setRecent((r) => [col, ...r.filter((x) => x !== col)].slice(0, 8));
  };

  const onDown = (e) => {
    if (e.button !== undefined && e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* sem captura */
    }
    const cell = cellAt(e);
    if (!inGrid(cell.c, cell.r)) return;
    // botão direito = borracha rápida
    const erase = e.button === 2 || tool === 'eraser';
    if (tool === 'pick') {
      const col = pixelsRef.current[key(cell.c, cell.r)];
      if (col) pickColor(col);
      setTool('pencil');
      return;
    }
    snapshot();
    if (tool === 'fill' && !erase) {
      floodFill(cell, color);
      return;
    }
    stroke.current = { last: cell, erase };
    paintCells([[cell.c, cell.r]], erase ? null : color);
  };
  const onMove = (e) => {
    const cell = cellAt(e);
    setHover(inGrid(cell.c, cell.r) ? cell : null);
    const st = stroke.current;
    if (!st) return;
    if (cell.c === st.last.c && cell.r === st.last.r) return;
    paintCells(lineCells(st.last, cell), st.erase ? null : color);
    st.last = cell;
  };
  const onUp = () => {
    stroke.current = null;
  };

  // ---------- teclado: desfazer/refazer aqui dentro e nada vaza para o programa ----------
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  useEffect(() => {
    const onKey = (e) => {
      const typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
      const mod = e.ctrlKey || e.metaKey;
      const k = (e.key || '').toLowerCase();
      if (mod && !typing && (k === 'z' || k === 'y')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (k === 'y' || e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        tryClose();
        return;
      }
      // atalhos do programa (N, E, L, R, F, espaço, setas...) não disparam enquanto desenha
      if (!typing) {
        e.stopImmediatePropagation();
        const map = { b: 'pencil', p: 'pencil', e: 'eraser', g: 'fill', i: 'pick' };
        if (!mod && map[k]) setTool(map[k]);
      } else if (!mod) {
        // digitando o nome: só não deixa os atalhos de uma tecla do programa agirem
        e.stopImmediatePropagation();
      }
    };
    keyHandler = onKey;
    return () => {
      if (keyHandler === onKey) keyHandler = null;
    };
  });

  const tryClose = async () => {
    if (dirty.current && !(await ask({ title: tx('Sair sem salvar?'), message: tx('O desenho não salvo será perdido.'), yes: tx('Sair'), danger: true }))) return;
    onCancelRef.current();
  };

  const startFrom = async (kind) => {
    if (Object.keys(pixelsRef.current).length && !(await ask({ title: tx('Trocar o desenho?'), message: tx('O que está no quadro agora será substituído.'), yes: tx('Trocar') }))) return;
    click();
    snapshot();
    if (kind === 'empty') setPixels({});
    else if (kind === 'template') setPixels(templatePixels());
    else if (kind === 'starter') setPixels(starterPixels());
    else setPixels(pixelsFromHero(kind, getLook(hero, kind)));
  };

  const flipAll = () => {
    click();
    snapshot();
    const next = {};
    Object.entries(pixelsRef.current).forEach(([k, col]) => {
      const [c, r] = k.split(',').map(Number);
      if (inGrid(MIRROR_AXIS - c, r)) next[key(MIRROR_AXIS - c, r)] = col;
    });
    setPixels(next);
  };

  const previewCells = useMemo(() => cellsFromPixels(pixels), [pixels]);
  const empty = Object.keys(pixels).length === 0;

  return createPortal(
    <div className="modal-backdrop high-z-backdrop px-backdrop" onClick={(e) => e.target === e.currentTarget && tryClose()}>
      <div className="modal-window px-window" role="dialog" aria-label={tx('Criador de personagem')}>
        <header className="px-head">
          <span className="px-title">🎨 {tx('Criador de personagem')}</span>
          {lockedName ? (
            <span className="px-name locked">{lockedName}</span>
          ) : (
            <input className="px-name" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder={tx('Nome do personagem')} />
          )}
          <button type="button" className="px-x" onClick={tryClose} title={tx('Fechar (Esc)')}>
            ✕
          </button>
        </header>

        <div className="px-body">
          <div className="px-board">
            <canvas
              ref={canvasRef}
              width={W * CELL}
              height={H * CELL}
              className={`px-canvas tool-${tool}`}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onPointerLeave={() => setHover(null)}
              onContextMenu={(e) => e.preventDefault()}
            />
            <p className="px-tip">
              {tx('Botão direito apaga · Ctrl+Z desfaz · Ctrl+Y refaz')}
            </p>
          </div>

          <aside className="px-side">
            <section>
              <h4>{tx('Ferramentas')}</h4>
              <div className="px-tools">
                {TOOLS.map(([id, icon, label]) => (
                  <button key={id} type="button" className={tool === id ? 'on' : ''} onClick={() => { click(); setTool(id); }} title={tx(label)}>
                    <span>{icon}</span>
                    {tx(label)}
                  </button>
                ))}
              </div>
              <div className="px-toggles">
                <button type="button" className={size === 2 ? 'on' : ''} onClick={() => setSize((s) => (s === 1 ? 2 : 1))}>
                  {size === 2 ? '⬛ 2×2' : '▪️ 1×1'}
                </button>
                <button type="button" className={mirror ? 'on' : ''} onClick={() => setMirror((m) => !m)} title={tx('Pinta dos dois lados ao mesmo tempo')}>
                  🪞 {tx('Espelhar')}
                </button>
                <button type="button" className={guide ? 'on' : ''} onClick={() => setGuide((g) => !g)} title={tx('Mostra o contorno do molde por baixo')}>
                  📐 {tx('Molde')}
                </button>
              </div>
            </section>

            <section>
              <h4>{tx('Cores')}</h4>
              <div className="px-current">
                <span style={{ background: color }} />
                <label className="px-custom" title={tx('Qualquer cor')}>
                  <input type="color" value={color} onChange={(e) => pickColor(e.target.value)} />
                  ＋ {tx('Outra cor')}
                </label>
              </div>
              <div className="px-palette">
                {PALETTE.map((col) => (
                  <button
                    key={col}
                    type="button"
                    className={color === col ? 'on' : ''}
                    style={{ background: col }}
                    onClick={() => {
                      pickColor(col);
                      if (tool === 'eraser' || tool === 'pick') setTool('pencil');
                    }}
                    aria-label={col}
                  />
                ))}
              </div>
              {recent.length > 0 && (
                <div className="px-palette recent">
                  {recent.map((col) => (
                    <button key={col} type="button" className={color === col ? 'on' : ''} style={{ background: col }} onClick={() => setColor(col)} aria-label={col} />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h4>{tx('Começar de')}</h4>
              <div className="px-starts">
                <button type="button" onClick={() => startFrom('empty')}>{tx('Vazio')}</button>
                <button type="button" onClick={() => startFrom('template')}>{tx('Só o molde')}</button>
                <button type="button" onClick={() => startFrom('starter')}>{tx('Pele e olhos')}</button>
                {HERO_CLASSES.map((c) => (
                  <button key={c.id} type="button" onClick={() => startFrom(c.id)}>
                    {tx(c.name)}
                  </button>
                ))}
                <button type="button" onClick={flipAll}>↔ {tx('Virar desenho')}</button>
              </div>
            </section>

            <section className="px-preview-box">
              <h4>{tx('Prévia')}</h4>
              <div className="px-preview h2d-model pose-walk">
                <div className="px-preview-inner">
                  <CellsSvg cells={previewCells} />
                </div>
              </div>
            </section>
          </aside>
        </div>

        <footer className="px-foot">
          {onDelete && (
            <button
              type="button"
              className="px-del"
              onClick={async () => {
                if (await ask({ title: tx('Excluir personagem?'), message: name, yes: tx('Excluir'), danger: true })) onDelete();
              }}
            >
              🗑 {tx('Excluir')}
            </button>
          )}
          <span className="px-spacer" />
          <button type="button" className="px-btn" onClick={tryClose}>
            {tx('Cancelar')}
          </button>
          <button
            type="button"
            className="px-btn primary"
            disabled={empty}
            onClick={() => {
              click('train');
              onSave({ name: name.trim() || tx('Meu personagem'), pixels });
            }}
          >
            ✓ {tx('Salvar personagem')}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
