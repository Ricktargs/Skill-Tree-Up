// =========================================================
// ORGANIZAR HABILIDADES (L / O)
// Junta o antigo "Painel de Habilidades e Ocultas" com o
// "Editor de Layout e Ordem": uma lista só com todas as habilidades.
//  · arrastar pela alça ⠿ (mouse e toque), ⤒ ▲ ▼ ⤓
//  · 👁 mostrar / ocultar, ✏️ editar, ✉️ mini missões, 🗑 excluir
//  · busca + filtro (todas / visíveis / ocultas / pasta)
//  · seleção múltipla (Shift = intervalo) com ações em lote:
//    mostrar, ocultar, mover de pasta, mudar categoria, topo, fim, excluir
//  · ordenar tudo (ou só as selecionadas) por nome, nível, progresso…
// Cada ação é um passo só no Desfazer (Ctrl+Z).
// =========================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { tx } from '../i18n/index.jsx';
import { ask, askText } from '../shared/Dialog.jsx';
import './SkillsManager.css';

const catKey = (s) => (s.category || 'Geral').trim().toLowerCase();
const nameOf = (s) => String(s.title || s.name || '');
const progressOf = (s) => (s.maxLevel ? (s.level || 0) / s.maxLevel : 0);

// Mesmo agrupamento do painel quando "juntar por categoria" está ligado
function groupByCategory(list) {
  const order = [];
  const groups = {};
  list.forEach((s) => {
    const k = catKey(s);
    if (!groups[k]) {
      groups[k] = [];
      order.push(k);
    }
    groups[k].push(s);
  });
  return order.flatMap((k) => groups[k]);
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const SORTS = {
  'name-asc': { label: 'Nome (A → Z)', fn: (a, b) => collator.compare(nameOf(a), nameOf(b)) },
  'name-desc': { label: 'Nome (Z → A)', fn: (a, b) => collator.compare(nameOf(b), nameOf(a)) },
  'level-desc': { label: 'Nível (maior primeiro)', fn: (a, b) => (b.level || 0) - (a.level || 0) },
  'level-asc': { label: 'Nível (menor primeiro)', fn: (a, b) => (a.level || 0) - (b.level || 0) },
  'progress-desc': { label: 'Progresso % (mais perto do máximo)', fn: (a, b) => progressOf(b) - progressOf(a) },
  'progress-asc': { label: 'Progresso % (mais longe do máximo)', fn: (a, b) => progressOf(a) - progressOf(b) },
  category: { label: 'Categoria (A → Z)', fn: (a, b) => collator.compare(a.category || 'Geral', b.category || 'Geral') },
  folder: { label: 'Pasta (A → Z)', fn: (a, b) => collator.compare(a.folder || 'Geral', b.folder || 'Geral') },
  color: { label: 'Cor', fn: (a, b) => String(a.color || '').localeCompare(String(b.color || '')) },
  reverse: { label: 'Inverter a ordem', fn: null },
  'visible-first': { label: 'Visíveis primeiro, ocultas no fim', fn: null }
};

export default function SkillsManager({
  skills,
  hiddenSkillIds,
  folders,
  linkSkillsByCategory,
  applySkillLayout,
  onEdit,
  onMissions,
  onClose,
  playSound
}) {
  const click = (k = 'click') => playSound && playSound(k);
  const [query, setQuery] = useState('');
  const [view, setView] = useState('all'); // all | visible | hidden
  const [folder, setFolder] = useState('');
  const [selected, setSelected] = useState([]);
  const [drag, setDrag] = useState(null); // { ids, id, startY, y, at }
  const lastClicked = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);

  const hidden = useMemo(() => new Set(hiddenSkillIds), [hiddenSkillIds]);
  const order = useMemo(() => (linkSkillsByCategory ? groupByCategory(skills) : skills), [skills, linkSkillsByCategory]);
  // só as pastas que existem no Gerenciador de Pastas
  const allFolders = useMemo(() => [...new Set((folders || []).map((f) => String(f).trim()).filter(Boolean))], [folders]);
  // filtro numa pasta que foi apagada volta para "todas"
  useEffect(() => {
    if (folder && !allFolders.includes(folder)) setFolder('');
  }, [folder, allFolders]);

  const q = query.trim().toLowerCase();
  const rows = order.filter((s) => {
    if (view === 'visible' && hidden.has(s.id)) return false;
    if (view === 'hidden' && !hidden.has(s.id)) return false;
    if (folder && (s.folder || 'Geral').trim() !== folder) return false;
    if (q && !`${nameOf(s)} ${s.category || ''} ${s.folder || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const rowIds = rows.map((s) => s.id);
  const counts = { all: skills.length, hidden: skills.filter((s) => hidden.has(s.id)).length };
  counts.visible = counts.all - counts.hidden;

  // seleção some quando a habilidade some (excluída)
  useEffect(() => {
    setSelected((sel) => sel.filter((id) => skills.some((s) => s.id === id)));
  }, [skills]);

  const selSet = new Set(selected);
  const selInRows = rowIds.filter((id) => selSet.has(id));
  const allRowsSelected = rows.length > 0 && selInRows.length === rows.length;

  // ---------- aplicar ----------
  const commit = (list, hiddenList) => applySkillLayout(list, hiddenList);

  // tira "ids" da ordem e põe antes de "beforeId" (null = no fim)
  const placeBefore = (ids, beforeId) => {
    const moving = new Set(ids);
    const picked = order.filter((s) => moving.has(s.id));
    const rest = order.filter((s) => !moving.has(s.id));
    let at = beforeId ? rest.findIndex((s) => s.id === beforeId) : rest.length;
    if (at < 0) at = rest.length;
    const next = [...rest.slice(0, at), ...picked, ...rest.slice(at)];
    if (next.every((s, i) => s === order[i])) return;
    click('train');
    commit(next);
  };
  const placeAfter = (ids, afterId) => {
    const moving = new Set(ids);
    const rest = order.filter((s) => !moving.has(s.id));
    const i = rest.findIndex((s) => s.id === afterId);
    placeBefore(ids, i >= 0 && rest[i + 1] ? rest[i + 1].id : null);
  };
  const toTop = (ids) => {
    const first = order.find((s) => !ids.includes(s.id));
    placeBefore(ids, first ? first.id : null);
  };
  const toEnd = (ids) => placeBefore(ids, null);
  // um passo para cima/baixo entre as linhas que estão aparecendo
  const step = (ids, dir) => {
    const set = new Set(ids);
    const pos = rowIds.map((id, i) => (set.has(id) ? i : -1)).filter((i) => i >= 0);
    if (!pos.length) return;
    if (dir < 0) {
      const above = rowIds.slice(0, pos[0]).filter((id) => !set.has(id)).pop();
      if (above) placeBefore(ids, above);
    } else {
      const below = rowIds.slice(pos[pos.length - 1] + 1).find((id) => !set.has(id));
      if (below) placeAfter(ids, below);
    }
  };

  const setHidden = (ids, hide) => {
    const next = new Set(hidden);
    ids.forEach((id) => (hide ? next.add(id) : next.delete(id)));
    click(hide ? 'click' : 'train');
    commit(null, [...next]);
  };
  const patchSkills = (ids, patch) => {
    const set = new Set(ids);
    click('train');
    commit(skills.map((s) => (set.has(s.id) ? { ...s, ...patch } : s)));
  };
  const remove = async (ids) => {
    if (!ids.length) return;
    const names = skills.filter((s) => ids.includes(s.id)).map(nameOf);
    const ok = await ask({
      title: ids.length === 1 ? tx('Excluir "{n}"?', { n: names[0] }) : tx('Excluir {n} habilidade(s)?', { n: ids.length }),
      message: tx('As habilidades selecionadas serão apagadas. Dá para voltar com Ctrl+Z.'),
      yes: tx('Excluir'),
      danger: true
    });
    if (!ok) return;
    playSound && playSound('delete');
    const set = new Set(ids);
    commit(
      skills.filter((s) => !set.has(s.id)),
      hiddenSkillIds.filter((id) => !set.has(id))
    );
    setSelected((sel) => sel.filter((id) => !set.has(id)));
  };
  const askCategory = async (ids) => {
    const first = skills.find((s) => s.id === ids[0]);
    const value = await askText({
      title: tx('Categoria de {n} habilidade(s)', { n: ids.length }),
      message: tx('Habilidades com a mesma categoria ficam ligadas no painel.'),
      value: (first && first.category) || 'Geral'
    });
    if (value === null || value === undefined) return;
    const v = String(value).trim() || 'Geral';
    patchSkills(ids, { category: v });
  };

  const sortBy = (key) => {
    const sort = SORTS[key];
    if (!sort) return;
    // com seleção: ordena só as selecionadas, nos lugares que elas ocupam
    const onlySel = selected.length > 1;
    const set = new Set(onlySel ? selected : order.map((s) => s.id));
    const slots = order.map((s, i) => (set.has(s.id) ? i : -1)).filter((i) => i >= 0);
    let items = slots.map((i) => order[i]);
    if (key === 'reverse') items = items.reverse();
    else if (key === 'visible-first') items = [...items.filter((s) => !hidden.has(s.id)), ...items.filter((s) => hidden.has(s.id))];
    else items = [...items].sort(sort.fn);
    const next = [...order];
    slots.forEach((slot, k) => {
      next[slot] = items[k];
    });
    // ordenar por categoria com "juntar por categoria" ligado: precisa da ordem crua
    if (next.every((s, i) => s === order[i])) return;
    click('train');
    commit(next);
  };

  // ---------- seleção ----------
  const toggleSel = (id, e) => {
    click();
    if (e && e.shiftKey && lastClicked.current && rowIds.includes(lastClicked.current)) {
      const a = rowIds.indexOf(lastClicked.current);
      const b = rowIds.indexOf(id);
      const range = rowIds.slice(Math.min(a, b), Math.max(a, b) + 1);
      setSelected((sel) => [...new Set([...sel, ...range])]);
    } else {
      setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));
    }
    lastClicked.current = id;
  };
  const toggleAll = () => {
    click();
    setSelected((sel) => (allRowsSelected ? sel.filter((id) => !rowIds.includes(id)) : [...new Set([...sel, ...rowIds])]));
  };
  // ação de uma linha: se ela está selecionada, vale para todas as selecionadas
  const idsFor = (id) => (selSet.has(id) && selected.length > 1 ? order.map((s) => s.id).filter((x) => selSet.has(x)) : [id]);

  // ---------- arrastar (mouse e toque) ----------
  const rowRects = useRef([]);
  const scrollTimer = useRef(null);
  // posições medidas dentro da lista (não mudam quando ela rola)
  const contentY = (y) => {
    const list = listRef.current;
    return list ? y - list.getBoundingClientRect().top + list.scrollTop : y;
  };
  const insertionAt = (y) => {
    const rects = rowRects.current;
    const cy = contentY(y);
    let at = rects.length;
    for (let i = 0; i < rects.length; i += 1) {
      if (cy < rects[i].top + rects[i].height / 2) {
        at = i;
        break;
      }
    }
    return at;
  };
  const measure = () => {
    const els = listRef.current ? [...listRef.current.querySelectorAll('[data-sm-row]')] : [];
    rowRects.current = els.map((el) => ({ top: el.offsetTop, height: el.offsetHeight }));
  };
  const startDrag = (e, id) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* sem captura: os eventos ainda chegam pela lista */
    }
    measure();
    const ids = idsFor(id);
    setDrag({ ids, id, startY: e.clientY, y: e.clientY, scroll0: listRef.current?.scrollTop || 0, at: rowIds.indexOf(id) });
  };
  const moveDrag = (e) => {
    if (!drag) return;
    const list = listRef.current;
    const y = e.clientY;
    // perto da borda: rola a lista
    clearInterval(scrollTimer.current);
    if (list) {
      const r = list.getBoundingClientRect();
      const edge = 46;
      const dir = y < r.top + edge ? -1 : y > r.bottom - edge ? 1 : 0;
      if (dir) {
        scrollTimer.current = setInterval(() => {
          list.scrollTop += dir * 12;
          setDrag((d) => (d ? { ...d, at: insertionAt(y) } : d));
        }, 16);
      }
    }
    setDrag((d) => (d ? { ...d, y, at: insertionAt(y) } : d));
  };
  const endDrag = () => {
    clearInterval(scrollTimer.current);
    if (!drag) return;
    const { ids, at } = drag;
    setDrag(null);
    const set = new Set(ids);
    // primeira linha não arrastada a partir da posição de soltar
    const before = rowIds.slice(at).find((id) => !set.has(id));
    if (before) placeBefore(ids, before);
    else {
      const last = rowIds.filter((id) => !set.has(id)).pop();
      if (last) placeAfter(ids, last);
    }
  };
  useEffect(() => () => clearInterval(scrollTimer.current), []);

  // ---------- teclado ----------
  const onKeyDown = (e) => {
    const inField = e.target.closest('input, textarea, select');
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      e.stopPropagation();
      searchRef.current?.focus();
      return;
    }
    if (inField) {
      // as letras do campo de busca não abrem atalhos do programa
      if (e.key !== 'Escape') e.stopPropagation();
      return;
    }
    if (mod && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      e.stopPropagation();
      setSelected([...new Set([...selected, ...rowIds])]);
    } else if (selected.length && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      e.stopPropagation();
      const ids = order.map((s) => s.id).filter((x) => selSet.has(x));
      if (mod) (e.key === 'ArrowUp' ? toTop : toEnd)(ids);
      else step(ids, e.key === 'ArrowUp' ? -1 : 1);
    } else if (selected.length && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      e.stopPropagation();
      remove(order.map((s) => s.id).filter((x) => selSet.has(x)));
    } else if (selected.length && e.key.toLowerCase() === 'h' && !mod) {
      e.preventDefault();
      e.stopPropagation();
      const ids = [...selected];
      setHidden(ids, !ids.every((id) => hidden.has(id)));
    }
  };

  const selOrdered = order.map((s) => s.id).filter((x) => selSet.has(x));
  const selAllHidden = selOrdered.length > 0 && selOrdered.every((id) => hidden.has(id));
  const filtering = Boolean(q || folder || view !== 'all');

  // posição da linha de soltar
  let dropLineTop = null;
  if (drag && rowRects.current.length) {
    const r = rowRects.current;
    const last = r[r.length - 1];
    dropLineTop = (drag.at < r.length ? r[drag.at].top : last.top + last.height) - 3;
  }

  return (
    <div className="modal-backdrop" onClick={() => (click(), onClose())}>
      <div className="modal-window sm-window" onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="sm-header">
          <div>
            <h3>{tx('Organizar habilidades')}</h3>
            <p>{tx('Ordem, ocultas, pastas e edição num lugar só. Arraste pela alça ⠿.')}</p>
          </div>
          <button type="button" className="sm-close" onClick={() => (click(), onClose())} aria-label={tx('Fechar')}>
            ×
          </button>
        </div>

        {/* ---------- busca e filtros ---------- */}
        <div className="sm-toolbar">
          <input
            ref={searchRef}
            className="sm-search"
            type="search"
            placeholder={tx('Buscar por nome, categoria ou pasta…')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="sm-tabs" role="tablist">
            {[
              ['all', tx('Todas')],
              ['visible', tx('Visíveis')],
              ['hidden', tx('Ocultas')]
            ].map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={view === k} className={view === k ? 'on' : ''} onClick={() => (click(), setView(k))}>
                {label} <b>{counts[k]}</b>
              </button>
            ))}
          </div>
          <select className="sm-select" value={folder} onChange={(e) => setFolder(e.target.value)} title={tx('Filtrar por pasta')}>
            <option value="">📁 {tx('Todas as pastas')}</option>
            {allFolders.map((f) => (
              <option key={f} value={f}>
                📁 {f}
              </option>
            ))}
          </select>
          <select
            className="sm-select"
            value=""
            onChange={(e) => {
              sortBy(e.target.value);
              e.target.value = '';
            }}
            title={tx('Ordenar a lista inteira (ou só as selecionadas)')}
          >
            <option value="">{selected.length > 1 ? tx('Ordenar selecionadas…') : tx('Ordenar tudo…')}</option>
            {Object.entries(SORTS).map(([k, s]) => (
              <option key={k} value={k}>
                {tx(s.label)}
              </option>
            ))}
          </select>
        </div>

        {/* ---------- ações em lote ---------- */}
        <div className={`sm-batch ${selected.length ? 'on' : ''}`}>
          <label className="sm-check-all" title={tx('Selecionar todas as que estão aparecendo (Ctrl+A)')}>
            <input type="checkbox" checked={allRowsSelected} ref={(el) => el && (el.indeterminate = !allRowsSelected && selInRows.length > 0)} onChange={toggleAll} />
            <span>{selected.length ? tx('{n} selecionada(s)', { n: selected.length }) : tx('Selecionar')}</span>
          </label>
          {selected.length > 0 && (
            <>
              <button type="button" onClick={() => setHidden(selOrdered, !selAllHidden)} title="H">
                {selAllHidden ? `👁 ${tx('Mostrar')}` : `🙈 ${tx('Ocultar')}`}
              </button>
              <select
                className="sm-select small"
                value=""
                onChange={(e) => {
                  if (e.target.value) patchSkills(selOrdered, { folder: e.target.value });
                  e.target.value = '';
                }}
                title={tx('Mover para a pasta')}
              >
                <option value="">📁 {tx('Mover para…')}</option>
                {allFolders.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => askCategory(selOrdered)}>
                🏷 {tx('Categoria')}
              </button>
              <button type="button" onClick={() => toTop(selOrdered)} title={tx('Para o topo (Ctrl+Alt+↑)')}>
                ⤒ {tx('Topo')}
              </button>
              <button type="button" onClick={() => toEnd(selOrdered)} title={tx('Para o fim (Ctrl+Alt+↓)')}>
                ⤓ {tx('Fim')}
              </button>
              <button type="button" className="danger" onClick={() => remove(selOrdered)} title="Delete">
                🗑 {tx('Excluir')}
              </button>
              <button type="button" className="ghost" onClick={() => (click(), setSelected([]))}>
                {tx('Limpar')}
              </button>
            </>
          )}
        </div>

        {linkSkillsByCategory && (
          <p className="sm-note">🔗 {tx('"Juntar por categoria" está ligado: habilidades da mesma categoria ficam sempre juntas, na posição da primeira.')}</p>
        )}

        {/* ---------- lista ---------- */}
        <div ref={listRef} className={`sm-list ${drag ? 'dragging' : ''}`} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
          {rows.length === 0 && (
            <p className="sm-empty">{filtering ? tx('Nada encontrado com esse filtro.') : tx('Nenhuma habilidade ainda.')}</p>
          )}
          {rows.map((s, i) => {
            const isHidden = hidden.has(s.id);
            const isSel = selSet.has(s.id);
            const isMax = (s.level || 0) >= (s.maxLevel || 0) && s.maxLevel > 0;
            const color = s.color || '#3b82f6';
            const sameNext = rows[i + 1] && catKey(rows[i + 1]) === catKey(s);
            const dragging = drag && drag.ids.includes(s.id);
            const lifted = drag && drag.id === s.id;
            const ids = idsFor(s.id);
            return (
              <div
                key={s.id}
                data-sm-row
                className={`sm-row ${isHidden ? 'is-hidden' : ''} ${isSel ? 'is-sel' : ''} ${dragging ? 'is-drag' : ''} ${lifted ? 'is-lifted' : ''} ${sameNext ? 'same-next' : ''} ${isMax ? 'is-max' : ''}`}
                style={{
                  '--sm-color': color,
                  ...(lifted ? { transform: `translateY(${drag.y - drag.startY + ((listRef.current?.scrollTop || 0) - drag.scroll0)}px)` } : null)
                }}
                onClick={(e) => {
                  // clique na linha (fora dos botões) seleciona
                  if (e.target.closest('button, input, select, .sm-handle')) return;
                  toggleSel(s.id, e);
                }}
                onDoubleClick={(e) => {
                  if (e.target.closest('button, input, select')) return;
                  click();
                  onEdit(s);
                }}
              >
                <input type="checkbox" className="sm-check" checked={isSel} onChange={() => {}} onClick={(e) => toggleSel(s.id, e)} aria-label={tx('Selecionar')} />
                <span
                  className="sm-handle"
                  data-no-hold
                  onPointerDown={(e) => startDrag(e, s.id)}
                  title={isSel && selected.length > 1 ? tx('Arrastar as {n} selecionadas', { n: selected.length }) : tx('Arrastar para mudar a ordem')}
                >
                  ⠿
                </span>
                <span className="sm-num">{order.indexOf(s) + 1}</span>
                <span className="sm-dot" />
                <span className="sm-info">
                  <span className="sm-name">
                    {nameOf(s) || tx('Sem nome')}
                    {isHidden && <em className="sm-tag">{tx('Oculta')}</em>}
                    {isMax && <em className="sm-tag gold">{tx('Máx.')}</em>}
                  </span>
                  <span className="sm-meta">
                    🏷 {s.category || 'Geral'} · 📁 {s.folder || 'Geral'}
                  </span>
                </span>
                <span className="sm-level" title={`${s.level || 0} / ${s.maxLevel || 0}`}>
                  <span className="sm-bar">
                    <i style={{ width: `${Math.round(progressOf(s) * 100)}%` }} />
                  </span>
                  <small>
                    {tx('Lvl')} {s.level || 0}/{s.maxLevel || 0}
                  </small>
                </span>
                <span className="sm-actions">
                  <span className="sm-move">
                    <button type="button" onClick={() => toTop(ids)} disabled={i === 0 && ids.length === 1} title={tx('Mover para o topo')}>
                      ⤒
                    </button>
                    <button type="button" onClick={() => step(ids, -1)} disabled={i === 0} title={tx('Mover para cima')}>
                      ▲
                    </button>
                    <button type="button" onClick={() => step(ids, 1)} disabled={i === rows.length - 1} title={tx('Mover para baixo')}>
                      ▼
                    </button>
                    <button type="button" onClick={() => toEnd(ids)} disabled={i === rows.length - 1 && ids.length === 1} title={tx('Mover para o fim')}>
                      ⤓
                    </button>
                  </span>
                  <button
                    type="button"
                    className={`sm-eye ${isHidden ? 'off' : ''}`}
                    onClick={() => setHidden(ids, !isHidden)}
                    title={isHidden ? tx('Mostrar no painel') : tx('Ocultar do painel')}
                  >
                    {isHidden ? '🙈' : '👁'}
                  </button>
                  <button type="button" onClick={() => (click(), onEdit(s))} title={tx('Editar habilidade')}>
                    ✏️
                  </button>
                  <button type="button" onClick={() => (click(), onMissions(s))} title={tx('Gerenciar Mini Missões')}>
                    ✉️
                  </button>
                  <button type="button" className="danger" onClick={() => remove(ids)} title={tx('Excluir')}>
                    🗑
                  </button>
                </span>
              </div>
            );
          })}
          {drag && dropLineTop !== null && <div className="sm-drop-line" style={{ top: dropLineTop }} />}
        </div>

        <div className="sm-footer">
          <small>{tx('Dica: Shift seleciona um intervalo · Alt+↑/↓ move · H oculta · Delete exclui · duplo clique edita · Ctrl+Z desfaz')}</small>
          <button type="button" className="confirm-button" onClick={() => (click(), onClose())}>
            {tx('Concluído')}
          </button>
        </div>
      </div>
    </div>
  );
}
