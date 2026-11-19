import React, { useMemo, useState } from 'react';
import { isNeuron, plainText, tagColor } from './store.js';
import { folderPaths } from './Presets.jsx';

// =========================================================
// BUSCA DOS NEURÔNIOS — ao clicar desce uma lista com notas e
// neurônios encontrados, mais os relacionados (ligados por [[ ]]).
// Neurônio abre no mapa; nota abre no editor de notas (✒️).
// =========================================================

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

// Texto da nota com espaço entre parágrafos (para o trecho mostrado)
const textOf = (html) => plainText(String(html || '').replace(/></g, '> <'));

const snippetOf = (text, q) => {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (!q) return t.slice(0, 80);
  const i = norm(t).indexOf(q);
  if (i < 0) return t.slice(0, 80);
  const start = Math.max(0, i - 30);
  return `${start > 0 ? '…' : ''}${t.slice(start, i + q.length + 50)}`;
};

// Destaca o pedaço buscado (ignorando acentos)
function Marked({ text, q }) {
  if (!q) return text;
  const i = norm(text).indexOf(q);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export default function SearchBox({ inputRef, query, setQuery, store, onPickNeuron, onPickNote }) {
  const { notes, links, folders } = store;
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const q = norm(query.trim());

  const paths = useMemo(() => new Map(folderPaths(folders).map((f) => [f.id, f.label])), [folders]);
  const neighbors = useMemo(() => {
    const m = new Map();
    const add = (a, b) => {
      if (!m.has(a)) m.set(a, new Set());
      m.get(a).add(b);
    };
    links.forEach((l) => {
      add(l.source, l.target);
      add(l.target, l.source);
    });
    return m;
  }, [links]);

  const sections = useMemo(() => {
    const recent = (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    if (!q) return [{ title: 'Recentes', items: [...notes].sort(recent).slice(0, 8) }];
    const scored = [];
    notes.forEach((n) => {
      const title = norm(n.title);
      let score = -1;
      if (title.startsWith(q)) score = 0;
      else if (title.includes(q)) score = 1;
      else if ((n.tags || []).some((t) => norm(t).includes(q))) score = 2;
      else if (norm(plainText(n.content)).includes(q)) score = 3;
      if (score >= 0) scored.push([score, n]);
    });
    scored.sort((a, b) => a[0] - b[0] || recent(a[1], b[1]));
    const found = scored.slice(0, 12).map(([, n]) => n);
    const foundIds = new Set(scored.map(([, n]) => n.id));
    const related = [];
    const seen = new Set();
    found.slice(0, 5).forEach((n) =>
      (neighbors.get(n.id) || []).forEach((id) => {
        if (foundIds.has(id) || seen.has(id)) return;
        seen.add(id);
        const r = store.byId.get(id);
        if (r) related.push({ ...r, via: n.title });
      })
    );
    const out = [{ title: `Encontrados (${scored.length})`, items: found }];
    if (related.length) out.push({ title: 'Relacionados', items: related.slice(0, 6) });
    return out;
  }, [q, notes, neighbors, store.byId]);

  const flat = sections.flatMap((s) => s.items);
  const current = Math.min(sel, Math.max(0, flat.length - 1));

  const pick = (n) => {
    if (!n) return;
    setOpen(false);
    inputRef.current?.blur();
    if (isNeuron(n)) onPickNeuron(n.id);
    else onPickNote(n.id);
  };

  let idx = -1;
  return (
    <div className="nr-search-wrap">
      <input
        ref={inputRef}
        className="search-input nr-search"
        placeholder="Buscar neurônios e notas…  ( / ou Espaço )"
        value={query}
        onFocus={() => {
          setOpen(true);
          setSel(0);
        }}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setSel(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setSel((s) => Math.min(flat.length - 1, s + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSel((s) => Math.max(0, s - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            pick(flat[current]);
          }
        }}
        role="combobox"
        aria-expanded={open}
        aria-controls="nr-search-list"
        aria-autocomplete="list"
      />
      {open && (
        <div className="nr-search-drop" id="nr-search-list" role="listbox" onMouseDown={(e) => e.preventDefault()}>
          {flat.length === 0 && <div className="nr-sd-empty">Nada encontrado para “{query.trim()}”.</div>}
          {sections.map((s) =>
            s.items.length ? (
              <div className="nr-sd-section" key={s.title}>
                <div className="nr-sd-title">{s.title}</div>
                {s.items.map((n) => {
                  idx += 1;
                  const i = idx;
                  const neuron = isNeuron(n);
                  const folder = n.folderId && paths.get(n.folderId);
                  const snip = snippetOf(textOf(n.content), q);
                  return (
                    <button
                      key={`${s.title}-${n.id}`}
                      type="button"
                      role="option"
                      aria-selected={i === current}
                      className={`nr-sd-item ${i === current ? 'on' : ''}`}
                      onMouseEnter={() => setSel(i)}
                      onClick={() => pick(n)}
                    >
                      <span className="nr-sd-ico">
                        {n.emoji ? (
                          n.emoji
                        ) : neuron ? (
                          <i className="nr-sd-dot" style={{ background: n.color || (n.tags?.[0] ? tagColor(n.tags[0]) : 'var(--foliage)') }} />
                        ) : (
                          '📝'
                        )}
                      </span>
                      <span className="nr-sd-main">
                        <span className="nr-sd-name">
                          <Marked text={n.title || 'Sem título'} q={q} />
                        </span>
                        {(snip || folder || n.via) && (
                          <small className="nr-sd-sub">
                            {n.via ? `ligado a “${n.via}”` : folder ? `📁 ${folder}` : ''}
                            {(n.via || folder) && snip ? ' · ' : ''}
                            {snip && <Marked text={snip} q={q} />}
                          </small>
                        )}
                      </span>
                      <span className={`nr-sd-kind ${neuron ? 'is-neuron' : ''}`}>{neuron ? '🧠 Neurônio' : '📝 Nota'}</span>
                    </button>
                  );
                })}
              </div>
            ) : null
          )}
          <div className="nr-sd-foot">↑ ↓ escolher · Enter abre · neurônio abre no mapa, nota abre no editor ✒️</div>
        </div>
      )}
    </div>
  );
}
