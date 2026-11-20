// =========================================================
// "LIGAÇÕES" (ao lado do + habilidade no editor)
// Lista todas as notas e neurônios para ligar/desligar com um clique
// (o mesmo que [[ ]] no texto) e cria neurônio novo já ligado.
// =========================================================
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isNeuron } from './store.js';

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export default function LinkPicker({ notes, selfId, linkedIds, folders = [], onToggle, onCreate }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [onlyLinked, setOnlyLinked] = useState(false);
  const boxRef = useRef(null);
  const popRef = useRef(null);
  const btnRef = useRef(null);
  const inputRef = useRef(null);
  const [pos, setPos] = useState(null);
  // a lista flutua por cima de tudo (o painel do editor é estreito e cortava)
  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const w = Math.min(330, window.innerWidth - 24);
      const left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12));
      const below = window.innerHeight - r.bottom;
      const up = below < 360 && r.top > below;
      setPos({ left, width: w, ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    setTimeout(() => inputRef.current?.focus(), 30);
    const down = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target) && !(popRef.current && popRef.current.contains(e.target))) setOpen(false);
    };
    const key = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key, true);
    };
  }, [open]);

  const folderName = useMemo(() => new Map(folders.map((f) => [f.id, f.name || f.title || 'Pasta'])), [folders]);
  const list = useMemo(() => {
    const nq = norm(q.trim());
    return notes
      .filter((n) => n.id !== selfId)
      .filter((n) => !onlyLinked || linkedIds.has(n.id))
      .filter((n) => !nq || norm(n.title).includes(nq) || (n.tags || []).some((t) => norm(t).includes(nq)))
      .sort((a, b) => {
        // ligados primeiro, depois neurônios, depois por nome
        const la = linkedIds.has(a.id) ? 0 : 1;
        const lb = linkedIds.has(b.id) ? 0 : 1;
        if (la !== lb) return la - lb;
        const na = isNeuron(a) ? 0 : 1;
        const nb = isNeuron(b) ? 0 : 1;
        if (na !== nb) return na - nb;
        return (a.title || '').localeCompare(b.title || '', 'pt-BR', { sensitivity: 'base' });
      })
      .slice(0, 80);
  }, [notes, selfId, q, onlyLinked, linkedIds]);

  const exact = q.trim() && notes.some((n) => norm(n.title) === norm(q.trim()));
  const create = () => {
    const title = q.trim();
    if (!title) return;
    onCreate(title);
    setQ('');
  };

  return (
    <span className="nr-links-picker" ref={boxRef}>
      <button
        ref={btnRef}
        type="button"
        className={`nr-links-btn ${open ? 'on' : ''} ${linkedIds.size ? 'has' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Ligar este texto a outras notas e neurônios (o mesmo que [[ ]])"
      >
        🔗 Ligações{linkedIds.size ? <b>{linkedIds.size}</b> : null}
      </button>
      {open &&
        createPortal(
        <div ref={popRef} className="nr-links-pop" role="dialog" aria-label="Ligações" style={pos ? { position: 'fixed', ...pos } : { visibility: 'hidden' }}>
          <div className="nr-links-head">
            <input
              ref={inputRef}
              className="nr-links-search"
              placeholder="Buscar ou criar neurônio…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  // Enter: cria o neurônio digitado (ou liga o primeiro da lista)
                  e.preventDefault();
                  if (q.trim() && !exact) create();
                  else if (list[0]) onToggle(list[0]);
                }
              }}
            />
            <label className="nr-links-only" title="Mostrar só o que já está ligado">
              <input type="checkbox" checked={onlyLinked} onChange={() => setOnlyLinked((v) => !v)} />
              Ligados
            </label>
          </div>

          {q.trim() && !exact && (
            <button type="button" className="nr-links-create" onClick={create}>
              <span className="nr-links-plus">＋</span>
              Criar neurônio “<b>{q.trim()}</b>” e ligar
              <kbd>Enter</kbd>
            </button>
          )}

          <div className="nr-links-list">
            {list.length === 0 && <p className="nr-links-empty">{onlyLinked ? 'Nada ligado ainda.' : 'Nada encontrado.'}</p>}
            {list.map((n) => {
              const on = linkedIds.has(n.id);
              const neuron = isNeuron(n);
              return (
                <button key={n.id} type="button" className={`nr-links-item ${on ? 'on' : ''}`} onClick={() => onToggle(n)} title={on ? 'Desligar' : 'Ligar'}>
                  <span className="nr-links-check" aria-hidden="true">
                    {on ? '✓' : ''}
                  </span>
                  <span className="nr-links-emoji">{n.emoji || (neuron ? '🧠' : '📝')}</span>
                  <span className="nr-links-title">
                    {n.title || 'Sem título'}
                    {n.folderId && folderName.get(n.folderId) && <small>📁 {folderName.get(n.folderId)}</small>}
                  </span>
                  <span className={`nr-links-kind ${neuron ? 'neuron' : 'note'}`}>{neuron ? 'neurônio' : 'nota'}</span>
                </button>
              );
            })}
          </div>
          <p className="nr-links-tip">Ligar uma nota a faz virar neurônio no mapa, como o [[ ]].</p>
        </div>,
          document.body
        )}
    </span>
  );
}
