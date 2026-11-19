import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ask } from '../shared/Dialog.jsx';
import { createPortal } from 'react-dom';
import './Flashcards.css';
import { CardThumb, EMPTY_MEDIA, FaceEditor, FaceMedia, MediaBadges, SelectionMedia, VoicePicker, isImageFile, isMediaFile, materializeBulk, mediaToFields, planBulk, sideMedia, stopCardSound } from './FlashcardMedia.jsx';
import { deleteMedia } from '../shared/mediaStore.js';
import { tx, useLanguage } from '../i18n/index.jsx';
import {
  cardStatus,
  cardsFromSkill,
  intervalLabel,
  parseBulk,
  schedule,
  skillModules,
  DEFAULT_INTERVALS,
  MAX_INTERVAL_DAYS,
  DAILY_XP_CAP,
  NEW_PER_SESSION,
  NO_GROUP
} from './Flashcards.js';

const DECK_EMOJIS = ['🎴', '📘', '📗', '📕', '🧠', '💡', '🗣️', '🧪', '📐', '💻', '🎵', '🌍', '⚔️', '🏋️', '🎨', '📜'];

const RATINGS = [
  { value: 1, key: '1', label: 'Errei', cls: 'again', field: 'again' },
  { value: 2, key: '2', label: 'Difícil', cls: 'hard', field: 'hard' },
  { value: 3, key: '3', label: 'Bom', cls: 'good', field: 'good' },
  { value: 4, key: '4', label: 'Fácil', cls: 'easy', field: 'easy' }
];

// Dica do "Importar em lote" (uma linha por item)
const NL = String.fromCharCode(10);
const BULK_HINT = [
  'pergunta | resposta',
  '(ou pergunta :: resposta)',
  '',
  'O verso pode ter várias linhas e linhas em branco.',
  'Cada linha com | começa uma carta nova.',
  'Para perguntas com várias linhas, separe as cartas com ---',
  '',
  'Imagens e áudios: arraste os arquivos aqui ou use 📎.',
  'Escreva [gato.jpg] ou [miau.mp3] do lado da pergunta ou da resposta.',
  'Arquivos não citados viram cartas sozinhos (gato.jpg + gato.mp3 = uma carta).'
];

const STATUS_LABEL = { new: 'Nova', due: 'Para revisar', learning: 'Aprendendo', mastered: 'Dominada' };

// =========================================================
// MODAL
// =========================================================
export function FlashcardsModal({ fc, skills = [], playSound }) {
  useLanguage();
  const [view, setView] = useState({ name: 'home' });
  const [menu, setMenu] = useState(null); // { x, y, deckId }
  const click = (t = 'click') => playSound && playSound(t);

  // Ao abrir, sempre começa nos decks
  useEffect(() => {
    if (fc.isOpen) setView({ name: 'home' });
    setMenu(null);
  }, [fc.isOpen]);

  // Esc: fecha o menu; senão volta para os decks; nos decks, fecha
  useEffect(() => {
    fc.escapeRef.current = menu
      ? () => setMenu(null)
      : view.name === 'home'
      ? null
      : () => setView({ name: 'home' });
    return () => {
      fc.escapeRef.current = null;
    };
  }, [view.name, menu, fc.escapeRef]);

  if (!fc.isOpen) return null;

  const close = () => {
    click();
    fc.setIsOpen(false);
  };
  const skillOf = (deck) => (deck && deck.skillId ? skills.find((s) => s.id === deck.skillId) : null);
  const deckColor = (deck) => skillOf(deck)?.color || 'var(--theme-accent, #38bdf8)';

  // Deck com grupos: antes de estudar, escolhe quais grupos entram na sessão
  const startStudy = (deckId, opts = null) => {
    const deck = deckId ? fc.decks.find((d) => d.id === deckId) : null;
    if (!opts && deck && (deck.groups || []).length > 0) {
      click();
      setView({ name: 'groups', deckId });
      return;
    }
    const queue = fc.buildQueue(deckId, opts || {});
    if (queue.length === 0) return;
    click('train');
    setView({ name: 'study', deckId, queue, opts });
  };

  return (
    <div className="modal-backdrop high-z-backdrop" onClick={close}>
      <div
        className="modal-window high-z-window fc-window"
        onClick={(e) => {
          e.stopPropagation();
          if (menu) setMenu(null);
        }}
      >
        <div className="fc-header">
          <div className="fc-title">
            <h3>🎴 {tx('Flashcards')}</h3>
            <div className="fc-pills">
              <span className={`fc-pill ${fc.streak > 0 ? 'hot' : ''}`} title={tx('Dias seguidos estudando')}>
                🔥 {fc.streak} {fc.streak === 1 ? tx('dia') : tx('dias')}
              </span>
              <span className="fc-pill" title={tx('Cartas para estudar hoje')}>
                📅 {fc.totalDue} {tx('hoje')}
              </span>
              <span className="fc-pill" title={tx('XP ganho hoje com flashcards (limite diário)')}>
                ⭐ {fc.todayStats.xp || 0}/{DAILY_XP_CAP} XP
              </span>
            </div>
          </div>
          <button type="button" className="st-close" onClick={close} title={tx('Fechar (F)')}>
            ✕
          </button>
        </div>

        {view.name === 'home' && (
          <DeckHome
            fc={fc}
            skills={skills}
            click={click}
            deckColor={deckColor}
            skillOf={skillOf}
            onStudy={startStudy}
            onOpenDeck={(deckId) => {
              click();
              setView({ name: 'deck', deckId });
            }}
            onPickSkill={() => {
              click();
              setView({ name: 'fromSkill' });
            }}
            onMenu={(deckId, x, y) => {
              click();
              setMenu({ deckId, x, y });
            }}
          />
        )}

        {menu && (
          <DeckMenu
            fc={fc}
            menu={menu}
            setMenu={setMenu}
            click={click}
            onEdit={(deckId) => setView({ name: 'deck', deckId })}
            onAdd={(deckId) => setView({ name: 'deck', deckId, focusAdd: Date.now() })}
          />
        )}

        {view.name === 'fromSkill' && (
          <SkillPicker
            fc={fc}
            skills={skills}
            click={click}
            onBack={() => setView({ name: 'home' })}
            onCreated={(deckId) => setView({ name: 'deck', deckId })}
          />
        )}

        {view.name === 'deck' && (
          <DeckEditor
            key={view.deckId}
            focusAdd={view.focusAdd}
            fc={fc}
            deck={fc.decks.find((d) => d.id === view.deckId)}
            skills={skills}
            click={click}
            deckColor={deckColor}
            skillOf={skillOf}
            onBack={() => setView({ name: 'home' })}
            onStudy={() => startStudy(view.deckId)}
          />
        )}

        {view.name === 'study' && (
          <StudySession
            key={view.queue.join(',')}
            fc={fc}
            deck={fc.decks.find((d) => d.id === view.deckId) || null}
            skill={skillOf(fc.decks.find((d) => d.id === view.deckId))}
            queue={view.queue}
            color={deckColor(fc.decks.find((d) => d.id === view.deckId))}
            click={click}
            studyOpts={view.opts || {}}
            onExit={() => setView({ name: 'home' })}
            onAgain={() => startStudy(view.deckId, view.opts)}
          />
        )}

        {view.name === 'groups' && (
          <GroupChooser
            fc={fc}
            deck={fc.decks.find((d) => d.id === view.deckId)}
            color={deckColor(fc.decks.find((d) => d.id === view.deckId))}
            click={click}
            onBack={() => setView({ name: 'deck', deckId: view.deckId })}
            onStart={(opts) => startStudy(view.deckId, opts)}
          />
        )}
      </div>
    </div>
  );
}

// =========================================================
// DECKS
// =========================================================
function DeckHome({ fc, skills, click, deckColor, skillOf, onStudy, onOpenDeck, onPickSkill, onMenu }) {
  const total = fc.deckSummary(null);

  // ---------- Ordem dos decks ----------
  const sortedDecks = useMemo(() => {
    const list = [...fc.decks];
    if (fc.deckSort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    else if (fc.deckSort === 'study') list.sort((a, b) => fc.deckSummary(b.id).toStudy - fc.deckSummary(a.id).toStudy);
    else if (fc.deckSort === 'recent') list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return list;
  }, [fc]);

  // ---------- Segurar e arrastar para reorganizar ----------
  // Segura ~0,35 s sem mexer → o deck "solta" e segue o ponteiro; ao soltar, fica no novo lugar.
  // No celular, segurar e soltar sem arrastar abre o menu (como antes).
  const [drag, setDrag] = useState(null); // { id, x, y, offX, offY, w, order }
  const dragRef = useRef(null);
  const pressRef = useRef(null); // { id, x, y, type, timer, armed, moved }
  const suppressClick = useRef(false);

  useEffect(() => {
    const move = (e) => {
      const p = pressRef.current;
      if (!p) return;
      const dist = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      if (!p.armed) {
        if (dist > 8) {
          clearTimeout(p.timer);
          pressRef.current = null;
        }
        return;
      }
      if (dist > 6) p.moved = true;
      const d = dragRef.current;
      if (!d) return;
      let order = d.order;
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const target = under && under.closest('[data-deck-id]');
      const overId = target && target.getAttribute('data-deck-id');
      if (overId && overId !== d.id) {
        const from = order.indexOf(d.id);
        const to = order.indexOf(overId);
        if (from >= 0 && to >= 0) {
          order = [...order];
          order.splice(from, 1);
          order.splice(to, 0, d.id);
        }
      }
      const next = { ...d, x: e.clientX, y: e.clientY, order };
      dragRef.current = next;
      setDrag(next);
    };
    const up = () => {
      const p = pressRef.current;
      pressRef.current = null;
      if (!p) return;
      clearTimeout(p.timer);
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!p.armed) return;
      suppressClick.current = true;
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      if (d && p.moved) {
        const before = sortedDecks.map((x) => x.id).join('|');
        if (d.order.join('|') !== before) {
          fc.setDeckOrder(d.order);
          if (fc.deckSort !== 'manual') fc.setDeckSort('manual');
          click('drop');
        }
      } else if (p.type === 'touch') {
        onMenu(p.id, p.x, p.y);
      }
    };
    // Enquanto arrasta no celular, a tela não rola
    const blockScroll = (e) => {
      if (dragRef.current) e.preventDefault();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('touchmove', blockScroll, { passive: false });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('touchmove', blockScroll);
    };
  }, [sortedDecks, fc, click, onMenu]);

  useEffect(() => () => clearTimeout(pressRef.current?.timer), []);

  const pressHandlers = (deckId) => ({
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      const el = e.currentTarget;
      const x = e.clientX;
      const y = e.clientY;
      const press = { id: deckId, x, y, type: e.pointerType, armed: false, moved: false };
      press.timer = setTimeout(() => {
        if (pressRef.current !== press) return;
        press.armed = true;
        const r = el.getBoundingClientRect();
        const next = { id: deckId, x, y, offX: x - r.left, offY: y - r.top, w: r.width, order: sortedDecks.map((d) => d.id) };
        dragRef.current = next;
        setDrag(next);
        if (navigator.vibrate) navigator.vibrate(12);
        click('tick');
      }, 350);
      pressRef.current = press;
    },
    onClickCapture: (e) => {
      // O clique que termina um arraste não abre o deck
      if (suppressClick.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  });

  const shownDecks = drag ? drag.order.map((id) => fc.decks.find((d) => d.id === id)).filter(Boolean) : sortedDecks;
  const draggedDeck = drag ? fc.decks.find((d) => d.id === drag.id) : null;

  return (
    <div className="fc-scroll">
      <div className="fc-hero">
        <div>
          <strong>
            {fc.decks.length === 0
              ? tx('Crie seu primeiro deck para começar')
              : total.toStudy > 0
              ? tx('{n} carta(s) esperando por você hoje', { n: total.toStudy })
              : tx('Tudo revisado por hoje! 🎉')}
          </strong>
          <span>
            {tx('{t} cartas · {m} dominadas · {r} revisões hoje', {
              t: total.total,
              m: total.mastered,
              r: fc.todayStats.reviews || 0
            })}
          </span>
        </div>
        <button type="button" className="fc-btn primary" disabled={total.toStudy === 0} onClick={() => onStudy(null)}>
          ▶ {tx('Estudar tudo')}
        </button>
      </div>

      {fc.decks.length > 1 && (
        <div className="fc-order">
          <span>{tx('Ordem')}</span>
          <select
            className="fc-input fc-order-select"
            value={fc.deckSort}
            onChange={(e) => {
              click();
              fc.setDeckSort(e.target.value);
            }}
          >
            <option value="manual">{tx('Personalizada (arraste)')}</option>
            <option value="name">{tx('Nome (A–Z)')}</option>
            <option value="study">{tx('Mais cartas para estudar')}</option>
            <option value="recent">{tx('Mais recentes')}</option>
          </select>
          <small>{tx('Segure um deck e arraste para mudar o lugar dele.')}</small>
        </div>
      )}

      <div className={`fc-deck-grid ${drag ? 'is-dragging' : ''}`}>
        {shownDecks.map((deck) => {
          const s = fc.deckSummary(deck.id);
          const skill = skillOf(deck);
          return (
            <div
              key={deck.id}
              data-deck-id={deck.id}
              className={`fc-deck ${deck.notify === false ? 'muted' : ''} ${drag && drag.id === deck.id ? 'drag-src' : ''}`}
              style={{ '--fc-deck': deckColor(deck) }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // segurar no celular também dispara isso: aí quem decide é o arraste
                if (pressRef.current) return;
                onMenu(deck.id, e.clientX, e.clientY);
              }}
              {...pressHandlers(deck.id)}
            >
              <button type="button" className="fc-deck-main" onClick={() => onOpenDeck(deck.id)} title={tx('Abrir deck')}>
                <span className="fc-deck-emoji">
                  {deck.emoji || '🎴'}
                  {deck.notify === false && (
                    <small className="fc-muted-icon" title={tx('Notificação desativada')}>
                      🔕
                    </small>
                  )}
                </span>
                <span className="fc-deck-name">{deck.name}</span>
                {skill ? (
                  <span className="fc-skill-chip">
                    <i style={{ background: skill.color }} />
                    {skill.title}
                    {deck.moduleId && deck.moduleId !== 'default'
                      ? ` · ${skillModules(skill).find((m) => m.id === deck.moduleId)?.name || tx('Módulo removido')}`
                      : ''}{' '}
                    · {tx('Nv.')}{' '}
                    {(skillModules(skill).find((m) => m.id === (deck.moduleId || 'default')) || {}).level ?? skill.level ?? 0}
                  </span>
                ) : deck.skillId ? (
                  <span className="fc-skill-chip muted">{tx('Habilidade removida')}</span>
                ) : null}
                <span className="fc-deck-counts">
                  <b className="new">{s.fresh}</b> {tx('novas')} · <b className="due">{s.due}</b> {tx('revisar')} ·{' '}
                  {s.total} {tx('total')}
                </span>
                <span className="fc-mastery" title={tx('{p}% dominado', { p: s.mastery })}>
                  <span style={{ width: `${s.mastery}%` }} />
                </span>
              </button>
              <button
                type="button"
                className="fc-deck-study"
                disabled={s.toStudy === 0}
                onClick={() => onStudy(deck.id)}
                title={s.toStudy === 0 ? tx('Nada para estudar agora') : tx('Estudar')}
              >
                {s.toStudy > 0 ? `▶ ${s.toStudy}` : '✓'}
              </button>
            </div>
          );
        })}

        <div className="fc-deck fc-deck-new">
          <button
            type="button"
            onClick={() => {
              click('train');
              const id = fc.addDeck({ name: tx('Novo deck') });
              onOpenDeck(id);
            }}
          >
            <span>＋</span>
            {tx('Deck vazio')}
          </button>
          <button type="button" onClick={onPickSkill} disabled={skills.length === 0}>
            <span>⚡</span>
            {tx('A partir de uma habilidade')}
          </button>
        </div>
      </div>

      {fc.decks.length > 0 && (
        <p className="fc-help">{tx('Dica: botão direito (ou segurar) num deck para editar, adicionar cartas, excluir ou desligar a notificação.')}</p>
      )}

      {/* Deck "flutuando" embaixo do ponteiro enquanto arrasta */}
      {drag &&
        draggedDeck &&
        createPortal(
          <div
            className="fc-deck-ghost"
            style={{ left: drag.x - drag.offX, top: drag.y - drag.offY, width: drag.w, '--fc-deck': deckColor(draggedDeck) }}
          >
            <span className="fc-deck-emoji">{draggedDeck.emoji || '🎴'}</span>
            <span className="fc-deck-name">{draggedDeck.name}</span>
          </div>,
          document.body
        )}

      {fc.decks.length === 0 && (
        <p className="fc-help">
          {tx('Dica: ligue um deck a uma habilidade e as cartas são geradas a partir das metas e tarefas de cada nível. Estudar rende XP!')}
        </p>
      )}
    </div>
  );
}

// Menu do botão direito num deck
function DeckMenu({ fc, menu, setMenu, click, onEdit, onAdd }) {
  const deck = fc.decks.find((d) => d.id === menu.deckId);
  if (!deck) return null;
  const notifyOn = deck.notify !== false;
  const count = fc.cards.filter((c) => c.deckId === deck.id).length;
  // Mantém o menu dentro da tela
  const x = Math.min(menu.x, window.innerWidth - 240);
  const y = Math.min(menu.y, window.innerHeight - 230);

  // Portal: fica fora da janela (que tem animação/transform) e não é cortado
  return createPortal(
    <div className="fc-menu custom-context-menu" style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()} role="menu">
      <div className="fc-menu-title">
        {deck.emoji || '🎴'} {deck.name}
      </div>
      <>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              click();
              setMenu(null);
              onEdit(deck.id);
            }}
          >
            ✏️ {tx('Editar Flashcards')}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              click();
              setMenu(null);
              onAdd(deck.id);
            }}
          >
            ➕ {tx('Adicionar Flashcards')}
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={notifyOn}
            onClick={() => {
              click();
              fc.updateDeck(deck.id, { notify: !notifyOn });
            }}
            title={tx('Desativada, o deck não conta no ícone da tela inicial')}
          >
            {notifyOn ? '🔔' : '🔕'} {tx('Notificação')}
            <span className={`fc-switch ${notifyOn ? 'on' : ''}`}>{notifyOn ? tx('Ativa') : tx('Desativada')}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={async () => {
              setMenu(null);
              const ok = await ask({
                title: tx('Excluir “{name}”?', { name: deck.name }),
                message: tx('O deck e {n} carta(s) serão apagados.', { n: count }),
                yes: tx('Excluir'),
                danger: true
              });
              if (!ok) return;
              click('delete');
              fc.deleteDeck(deck.id);
            }}
          >
            🗑 {tx('Excluir Flashcards')}
          </button>
      </>
    </div>,
    document.body
  );
}

// Lista de módulos/cursos de uma habilidade, com quantas cartas cada um gera
function ModuleChooser({ skill, selected, onPick, existingFronts = null }) {
  return (
    <div className="fc-modules">
      {skillModules(skill).map((m) => {
        const all = cardsFromSkill(skill, tx, m.id);
        const n = existingFronts ? all.filter((c) => !existingFronts.has(c.front.trim())).length : all.length;
        return (
          <button
            key={m.id}
            type="button"
            className={`fc-module ${selected === m.id ? 'active' : ''}`}
            onClick={() => onPick(m.id, all)}
          >
            <span className="fc-module-name">
              {m.name || tx('Principal')}
              <small>
                {tx('Nv.')} {m.level || 0}/{m.maxLevel || 10}
              </small>
            </span>
            <span className="fc-module-count">
              {existingFronts ? tx('{n} nova(s)', { n }) : tx('{n} carta(s)', { n })}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// =========================================================
// NOVO DECK A PARTIR DE UMA HABILIDADE
// =========================================================
function SkillPicker({ fc, skills, click, onBack, onCreated }) {
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState(null); // habilidade com mais de um módulo
  const list = skills.filter((s) => (s.title || '').toLowerCase().includes(query.trim().toLowerCase()));

  const createFrom = (skill, moduleId, cards) => {
    const existing = fc.decks.find((d) => d.skillId === skill.id && (d.moduleId || 'default') === moduleId);
    if (existing) {
      click();
      onCreated(existing.id);
      return;
    }
    const mod = skillModules(skill).find((m) => m.id === moduleId);
    click('train');
    const id = fc.addDeck({
      name: mod && mod.name ? `${skill.title} · ${mod.name}` : skill.title,
      emoji: '📘',
      skillId: skill.id,
      moduleId,
      cards
    });
    onCreated(id);
  };

  if (chosen) {
    return (
      <div className="fc-scroll">
        <div className="fc-bar">
          <button type="button" className="fc-btn ghost" onClick={() => setChosen(null)}>
            ← {tx('Habilidades')}
          </button>
          <strong>{tx('De qual módulo/curso de “{s}”?', { s: chosen.title })}</strong>
        </div>
        <p className="fc-help">{tx('Cada módulo tem as próprias metas e tarefas, então as cartas mudam de um para outro.')}</p>
        <ModuleChooser skill={chosen} onPick={(moduleId, cards) => createFrom(chosen, moduleId, cards)} />
      </div>
    );
  }

  return (
    <div className="fc-scroll">
      <div className="fc-bar">
        <button type="button" className="fc-btn ghost" onClick={onBack}>
          ← {tx('Decks')}
        </button>
        <strong>{tx('Escolha a habilidade')}</strong>
        <input className="fc-input fc-search" placeholder={tx('Buscar...')} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <p className="fc-help">{tx('As metas, detalhes e tarefas de cada nível viram cartas. Você pode editar ou adicionar mais depois.')}</p>
      <div className="fc-skill-list">
        {list.map((skill) => {
          const mods = skillModules(skill);
          const generated = cardsFromSkill(skill, tx, 'default');
          const existing = mods.length === 1 ? fc.decks.find((d) => d.skillId === skill.id) : null;
          return (
            <button
              key={skill.id}
              type="button"
              className="fc-skill-row"
              style={{ '--fc-deck': skill.color || 'var(--theme-accent)' }}
              onClick={() => {
                if (mods.length > 1) {
                  click();
                  setChosen(skill);
                  return;
                }
                createFrom(skill, 'default', generated);
              }}
            >
              <i />
              <span className="fc-skill-row-name">
                {skill.title}
                <small>
                  {skill.category || 'Geral'} · {tx('Nv.')} {skill.level || 0}/{skill.maxLevel || 10}
                </small>
              </span>
              <span className="fc-skill-row-count">
                {mods.length > 1
                  ? tx('{n} módulos', { n: mods.length })
                  : existing
                  ? tx('Abrir deck')
                  : tx('{n} carta(s)', { n: generated.length })}
              </span>
            </button>
          );
        })}
        {list.length === 0 && <p className="fc-help">{tx('Nenhuma habilidade encontrada.')}</p>}
      </div>
    </div>
  );
}

// =========================================================
// EDITOR DO DECK
// =========================================================
function DeckEditor({ fc, deck, skills, click, deckColor, skillOf, onBack, onStudy, focusAdd }) {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  // imagem / áudio / voz de cada lado da carta nova
  const [frontMedia, setFrontMedia] = useState(EMPTY_MEDIA);
  const [backMedia, setBackMedia] = useState(EMPTY_MEDIA);
  const createdMedia = useRef(new Set()); // arquivos novos ainda não salvos numa carta
  useEffect(
    () => () => {
      // saiu sem adicionar: apaga os arquivos que ficaram soltos
      deleteMedia([...createdMedia.current]);
    },
    []
  );
  const frontOk = Boolean(front.trim() || frontMedia.img || frontMedia.audio);
  const backOk = Boolean(back.trim() || backMedia.img || backMedia.audio);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState('');
  const [bulkFiles, setBulkFiles] = useState([]); // imagens e áudios do lote
  const [bulkVoice, setBulkVoice] = useState({ front: '', frontLang: '', back: '', backLang: '' });
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkDrag, setBulkDrag] = useState(false);
  const bulkFileRef = useRef(null);
  const bulkTextRef = useRef(null);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [notice, setNotice] = useState('');
  const [choosingModule, setChoosingModule] = useState(false);
  // Selecionador de cartas para montar grupos (Grupo 1, Grupo 2...)
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [pickN, setPickN] = useState('10');
  const [groupFilter, setGroupFilter] = useState('all');
  const [renaming, setRenaming] = useState(null); // { id, name }
  const [intervalsOpen, setIntervalsOpen] = useState(false);
  const frontRef = useRef(null);

  // "Adicionar Flashcards" pelo menu: já foca no campo da frente
  useEffect(() => {
    if (focusAdd) frontRef.current?.focus();
  }, [focusAdd]);

  const cards = useMemo(() => (deck ? fc.cards.filter((c) => c.deckId === deck.id) : []), [fc.cards, deck]);
  if (!deck) {
    return (
      <div className="fc-scroll">
        <button type="button" className="fc-btn ghost" onClick={onBack}>
          ← {tx('Decks')}
        </button>
      </div>
    );
  }

  const s = fc.deckSummary(deck.id);
  const skill = skillOf(deck);
  const q = query.trim().toLowerCase();
  const groups = deck.groups || [];
  const groupIds = new Set(groups.map((g) => g.id));
  const groupKey = (c) => (c.groupId && groupIds.has(c.groupId) ? c.groupId : NO_GROUP);
  const groupName = (id) => groups.find((g) => g.id === id)?.name || '';
  const filterKey = groupFilter === 'all' || groupFilter === NO_GROUP || groupIds.has(groupFilter) ? groupFilter : 'all';
  const inFilter = filterKey === 'all' ? cards : cards.filter((c) => groupKey(c) === filterKey);
  const visible = q ? inFilter.filter((c) => (c.front + ' ' + c.back).toLowerCase().includes(q)) : inFilter;
  const ungroupedCount = cards.filter((c) => groupKey(c) === NO_GROUP).length;

  // ---------- Importar em lote (texto + imagens + áudios) ----------
  const bulkPlan = planBulk(parseBulk(bulk), bulkFiles);
  const addBulkFiles = (files, insertToken = false) => {
    const list = [...(files || [])].filter(isMediaFile);
    if (!list.length) return;
    // nomes repetidos (ex.: "image.png" colado) ganham número
    const names = new Set(bulkFiles.map((f) => f.name.toLowerCase()));
    const fixed = list.map((f) => {
      let name = f.name || (isImageFile(f) ? 'imagem.png' : 'audio.webm');
      const dot = name.lastIndexOf('.');
      const stem = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : '';
      let k = 2;
      while (names.has(name.toLowerCase())) name = `${stem}-${k++}${ext}`;
      names.add(name.toLowerCase());
      return name === f.name ? f : new File([f], name, { type: f.type });
    });
    if (insertToken && bulkTextRef.current) {
      const el = bulkTextRef.current;
      const at = el.selectionStart ?? bulk.length;
      const token = fixed.map((f) => `[${f.name}]`).join(' ');
      setBulk(`${bulk.slice(0, at)}${token}${bulk.slice(at)}`);
    }
    setBulkFiles([...bulkFiles, ...fixed]);
  };
  const importBulk = async () => {
    if (!bulkPlan.cards.length || bulkBusy) return;
    setBulkBusy(true);
    try {
      const ready = await materializeBulk(bulkPlan, bulkVoice);
      const n = fc.addCards(deck.id, ready);
      click('train');
      setBulk('');
      setBulkFiles([]);
      setBulkOpen(false);
      flash(tx('{n} carta(s) importada(s)', { n }));
    } catch {
      flash(tx('Não deu para guardar os arquivos.'));
    }
    setBulkBusy(false);
  };

  const toggleSelect = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // Pré-seleciona N cartas da lista (primeiro as que ainda não têm grupo)
  const preselect = () => {
    const n = Math.max(1, Math.min(999, parseInt(pickN, 10) || 0));
    const free = visible.filter((c) => groupKey(c) === NO_GROUP);
    const rest = visible.filter((c) => groupKey(c) !== NO_GROUP);
    click();
    setSelected(new Set([...free, ...rest].slice(0, n).map((c) => c.id)));
  };
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const createGroup = () => {
    if (selected.size === 0) return;
    const id = fc.addGroup(deck.id, [...selected]);
    click('train');
    flash(tx('{n} carta(s) no novo grupo', { n: selected.size }));
    stopSelecting();
    setGroupFilter(id);
  };
  const moveSelected = (target) => {
    if (selected.size === 0 || !target) return;
    fc.setCardsGroup([...selected], target === NO_GROUP ? null : target);
    click('drop');
    flash(
      target === NO_GROUP
        ? tx('{n} carta(s) tirada(s) do grupo', { n: selected.size })
        : tx('{n} carta(s) movida(s) para {g}', { n: selected.size, g: groupName(target) })
    );
    stopSelecting();
  };
  const removeGroup = async (g) => {
    const n = cards.filter((c) => c.groupId === g.id).length;
    const ok = await ask({
      title: tx('Excluir o “{name}”?', { name: g.name }),
      message: tx('As {n} carta(s) dele continuam no deck, só ficam sem grupo.', { n }),
      yes: tx('Excluir grupo'),
      danger: true
    });
    if (!ok) return;
    click('delete');
    fc.deleteGroup(deck.id, g.id);
    if (filterKey === g.id) setGroupFilter('all');
  };
  const flash = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 2500);
  };

  const add = () => {
    if (!frontOk || !backOk) return;
    click('train');
    fc.addCards(deck.id, [{ front, back, ...mediaToFields('front', frontMedia), ...mediaToFields('back', backMedia) }]);
    createdMedia.current.clear(); // agora pertencem à carta
    setFront('');
    setBack('');
    // mantém a escolha de voz para a próxima carta; imagem e áudio recomeçam
    setFrontMedia((m) => ({ ...EMPTY_MEDIA, voice: m.voice, lang: m.lang }));
    setBackMedia((m) => ({ ...EMPTY_MEDIA, voice: m.voice, lang: m.lang }));
    frontRef.current?.focus();
  };

  const knownFronts = new Set(cards.map((c) => c.front.trim()));
  const generateFrom = (moduleId, generated) => {
    const fresh = generated.filter((c) => !knownFronts.has(c.front.trim()));
    const n = fc.addCards(deck.id, fresh);
    if (moduleId !== (deck.moduleId || 'default')) fc.updateDeck(deck.id, { moduleId });
    click(n ? 'train' : 'click');
    setChoosingModule(false);
    flash(n ? tx('{n} carta(s) nova(s) da habilidade', { n }) : tx('Nada novo nesse módulo por enquanto'));
  };
  const syncFromSkill = () => {
    if (!skill) return;
    // Com vários módulos/cursos, pergunta de qual deles gerar
    if (skillModules(skill).length > 1) {
      click();
      setChoosingModule((v) => !v);
      return;
    }
    generateFrom('default', cardsFromSkill(skill, tx, 'default'));
  };

  const linkedModule = skill ? skillModules(skill).find((m) => m.id === (deck.moduleId || 'default')) : null;
  const cfg = fc.intervalsOf(deck.id);

  return (
    <div className="fc-editor" style={{ '--fc-deck': deckColor(deck) }}>
      <div className="fc-bar">
        <button type="button" className="fc-btn ghost" onClick={onBack}>
          ← {tx('Decks')}
        </button>
        <span className="fc-bar-stats">
          {tx('{t} cartas · {m}% dominado', { t: s.total, m: s.mastery })}
        </span>
        <button type="button" className="fc-btn primary" disabled={s.toStudy === 0 && groups.length === 0} onClick={onStudy}>
          ▶ {tx('Estudar')} {s.toStudy > 0 ? `(${s.toStudy})` : ''}
        </button>
      </div>

      <div className="fc-editor-body">
        {/* Configurações do deck */}
        <aside className="fc-side">
          <label className="fc-field">
            <span>{tx('Nome do deck')}</span>
            <input className="fc-input" value={deck.name} maxLength={40} onChange={(e) => fc.updateDeck(deck.id, { name: e.target.value })} />
          </label>
          <div className="fc-field">
            <span>{tx('Ícone')}</span>
            <div className="fc-emojis">
              {DECK_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  className={deck.emoji === em ? 'active' : ''}
                  onClick={() => {
                    click();
                    fc.updateDeck(deck.id, { emoji: em });
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
          <label className="fc-field">
            <span>{tx('Habilidade ligada')}</span>
            <select
              className="fc-input"
              value={deck.skillId || ''}
              onChange={(e) => {
                click();
                fc.updateDeck(deck.id, { skillId: e.target.value || null });
              }}
            >
              <option value="">{tx('Nenhuma')}</option>
              {skills.map((sk) => (
                <option key={sk.id} value={sk.id}>
                  {sk.title}
                </option>
              ))}
            </select>
          </label>
          {skill && (
            <div className="fc-linked">
              <span>
                <i style={{ background: skill.color }} /> {skill.title}
                {linkedModule && linkedModule.id !== 'default' ? ` · ${linkedModule.name}` : ''} · {tx('Nv.')}{' '}
                {linkedModule ? linkedModule.level || 0 : skill.level || 0}/{linkedModule ? linkedModule.maxLevel || 10 : skill.maxLevel || 10}
              </span>
              <small>{tx('O XP das sessões vai para a categoria “{c}”.', { c: skill.category || 'Geral' })}</small>
              <button type="button" className="fc-btn small" onClick={syncFromSkill}>
                ⚡ {tx('Gerar cartas da habilidade')}
              </button>
              {choosingModule && (
                <>
                  <small>{tx('De qual módulo/curso?')}</small>
                  <ModuleChooser
                    skill={skill}
                    selected={deck.moduleId || 'default'}
                    existingFronts={knownFronts}
                    onPick={generateFrom}
                  />
                </>
              )}
            </div>
          )}

          {/* Tempo de repetição de cada resposta */}
          {/* Fica fechado: só um resumo; os detalhes abrem numa janela grande */}
          <button
            type="button"
            className="fc-intervals-open"
            onClick={() => {
              click();
              setIntervalsOpen(true);
            }}
            title={tx('Ajustar o tempo de repetição')}
          >
            <span className="fc-intervals-title">⏱️ {tx('Tempo de repetição')}</span>
            <span className="fc-intervals-sum">
              {RATINGS.map((r) => (
                <i key={r.value} className={r.cls}>
                  {tx(r.label)} · {intervalLabel(cfg[r.field])}
                </i>
              ))}
            </span>
            <small>{cfg.grow ? tx('Aumenta a cada acerto') : tx('Tempo fixo')} · {tx('Clique para ajustar')}</small>
          </button>
          {intervalsOpen && (
            <IntervalsWindow
              fc={fc}
              deck={deck}
              click={click}
              onSave={(intervals, intervalUnits) => fc.updateDeck(deck.id, { intervals, intervalUnits })}
              onClose={() => setIntervalsOpen(false)}
            />
          )}

          <div className="fc-side-actions">
            <button
              type="button"
              className="fc-btn small"
              disabled={s.total === 0}
              onClick={() => {
                click('delete');
                fc.resetDeckProgress(deck.id);
                flash(tx('Progresso do deck zerado'));
              }}
            >
              ↺ {tx('Zerar progresso')}
            </button>
            <button
              type="button"
              className="fc-btn small danger-ghost"
              onClick={async () => {
                const ok = await ask({
                  title: tx('Excluir “{name}”?', { name: deck.name }),
                  message: tx('O deck e {n} carta(s) serão apagados.', { n: s.total }),
                  yes: tx('Excluir'),
                  danger: true
                });
                if (!ok) return;
                click('delete');
                fc.deleteDeck(deck.id);
                onBack();
              }}
            >
              🗑 {tx('Excluir deck')}
            </button>
          </div>
        </aside>

        {/* Cartas */}
        <section className="fc-cards">
          <div className="fc-add">
            <FaceEditor
              inputRef={frontRef}
              placeholder={tx('Frente (pergunta)')}
              text={front}
              onText={setFront}
              media={frontMedia}
              onMedia={setFrontMedia}
              created={createdMedia}
              onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && add()}
            />
            <FaceEditor
              placeholder={tx('Verso (resposta)')}
              text={back}
              onText={setBack}
              media={backMedia}
              onMedia={setBackMedia}
              created={createdMedia}
              onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && add()}
            />
            <div className="fc-add-actions">
              <button type="button" className="fc-btn ghost small" onClick={() => setBulkOpen((v) => !v)}>
                📥 {tx('Importar em lote')}
              </button>
              <button type="button" className="fc-btn primary small" disabled={!frontOk || !backOk} onClick={add}>
                ＋ {tx('Adicionar carta')} <kbd>Ctrl+Enter</kbd>
              </button>
            </div>
            {bulkOpen && (
              <div
                className={`fc-bulk ${bulkDrag ? 'drag-over' : ''}`}
                onDragOver={(e) => {
                  if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
                  e.preventDefault();
                  setBulkDrag(true);
                }}
                onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setBulkDrag(false)}
                onDrop={(e) => {
                  if (!e.dataTransfer?.files?.length) return;
                  e.preventDefault();
                  setBulkDrag(false);
                  addBulkFiles(e.dataTransfer.files);
                }}
              >
                <textarea
                  ref={bulkTextRef}
                  className="fc-input"
                  rows={8}
                  placeholder={BULK_HINT.map((l) => (l ? tx(l) : '')).join(NL)}
                  value={bulk}
                  onChange={(e) => setBulk(e.target.value)}
                  onPaste={(e) => {
                    const files = [...(e.clipboardData?.files || [])].filter(isMediaFile);
                    if (!files.length) return;
                    e.preventDefault();
                    addBulkFiles(files, true); // colou uma imagem: entra no texto como [nome]
                  }}
                />
                <div className="fc-bulk-files">
                  <button type="button" className="fcm-tool" onClick={() => bulkFileRef.current?.click()} disabled={bulkBusy}>
                    📎 {tx('Imagens e áudios')}
                  </button>
                  {bulkFiles.map((f) => (
                    <span key={f.name} className={`fc-bulk-file ${bulkPlan.used.has(f) ? 'used' : ''}`} title={bulkPlan.used.has(f) ? tx('Citado no texto') : tx('Vira uma carta sozinho')}>
                      {isImageFile(f) ? '🖼' : '🎵'} {f.name}
                      <button
                        type="button"
                        onClick={() => setBulkFiles((prev) => prev.filter((x) => x !== f))}
                        aria-label={tx('Tirar')}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  {bulkFiles.length > 1 && (
                    <button type="button" className="fcm-tool" onClick={() => setBulkFiles([])}>
                      {tx('Tirar todos')}
                    </button>
                  )}
                  <input
                    ref={bulkFileRef}
                    type="file"
                    accept="image/*,audio/*"
                    multiple
                    hidden
                    onChange={(e) => (addBulkFiles(e.target.files), (e.target.value = ''))}
                  />
                </div>
                <div className="fc-bulk-voice">
                  <span>🗣 {tx('Pergunta')}</span>
                  <VoicePicker
                    voice={bulkVoice.front}
                    lang={bulkVoice.frontLang}
                    onChange={({ voice, lang }) => setBulkVoice((v) => ({ ...v, front: voice, frontLang: lang }))}
                  />
                  <span>🗣 {tx('Resposta')}</span>
                  <VoicePicker
                    voice={bulkVoice.back}
                    lang={bulkVoice.backLang}
                    onChange={({ voice, lang }) => setBulkVoice((v) => ({ ...v, back: voice, backLang: lang }))}
                  />
                </div>
                <div className="fc-add-actions">
                  <small>
                    {tx('{n} carta(s) reconhecida(s)', { n: bulkPlan.cards.length })}
                    {bulkFiles.length > 0 && ` · ${tx('{f} arquivo(s)', { f: bulkFiles.length })}`}
                  </small>
                  <button type="button" className="fc-btn primary small" disabled={bulkPlan.cards.length === 0 || bulkBusy} onClick={importBulk}>
                    {bulkBusy ? tx('Importando…') : tx('Importar')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {notice && <div className="fc-notice">{notice}</div>}

          {cards.length > 0 && (
            <div className="fc-list-tools">
              {cards.length > 3 && (
                <input className="fc-input fc-search" placeholder={tx('Buscar nas cartas...')} value={query} onChange={(e) => setQuery(e.target.value)} />
              )}
              <button
                type="button"
                className={`fc-btn small fc-select-btn ${selecting ? 'active' : ''}`}
                onClick={() => {
                  click();
                  if (selecting) stopSelecting();
                  else setSelecting(true);
                }}
                title={tx('Selecionar cartas para montar grupos (etapas) de estudo')}
              >
                ☑ {selecting ? tx('Cancelar seleção') : tx('Selecionar etapas')}
              </button>
            </div>
          )}

          {selecting && (
            <div className="fc-select-bar">
              <div className="fc-select-row">
                <span>{tx('Pré-selecionar')}</span>
                <input
                  className="fc-input fc-pick-n"
                  type="number"
                  min="1"
                  max="999"
                  value={pickN}
                  onChange={(e) => setPickN(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && preselect()}
                />
                <span>{tx('cartas')}</span>
                <button type="button" className="fc-btn small" onClick={preselect}>
                  {tx('Aplicar')}
                </button>
                <span className="fc-select-hint">{tx('ou clique nas cartas para escolher uma a uma')}</span>
              </div>
              <div className="fc-select-row">
                <b className="fc-select-count">{tx('{n} selecionada(s)', { n: selected.size })}</b>
                <button
                  type="button"
                  className="fc-btn small"
                  onClick={() => {
                    click();
                    setSelected(new Set(visible.map((c) => c.id)));
                  }}
                >
                  {tx('Todas')}
                </button>
                <button
                  type="button"
                  className="fc-btn small"
                  disabled={selected.size === 0}
                  onClick={() => {
                    click();
                    setSelected(new Set());
                  }}
                >
                  {tx('Limpar')}
                </button>
                <span className="fc-select-spacer" />
                {groups.length > 0 && (
                  <select
                    className="fc-input fc-move-select"
                    value=""
                    disabled={selected.size === 0}
                    onChange={(e) => moveSelected(e.target.value)}
                  >
                    <option value="">{tx('Mover para…')}</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                    <option value={NO_GROUP}>{tx('Sem grupo')}</option>
                  </select>
                )}
                <button type="button" className="fc-btn primary small" disabled={selected.size === 0} onClick={createGroup}>
                  ＋ {tx('Criar grupo')}
                </button>
              </div>
              {selected.size > 0 && (
                <SelectionMedia cards={cards.filter((c) => selected.has(c.id))} onUpdate={fc.updateCard} click={click} flash={flash} />
              )}
            </div>
          )}

          {groups.length > 0 && (
            <div className="fc-group-chips">
              <button
                type="button"
                className={filterKey === 'all' ? 'active' : ''}
                onClick={() => {
                  click();
                  setGroupFilter('all');
                }}
              >
                {tx('Todas')} <span>{cards.length}</span>
              </button>
              {groups.map((g) =>
                renaming && renaming.id === g.id ? (
                  <input
                    key={g.id}
                    className="fc-input fc-group-rename"
                    value={renaming.name}
                    maxLength={30}
                    autoFocus
                    onChange={(e) => setRenaming({ id: g.id, name: e.target.value })}
                    onBlur={() => {
                      fc.renameGroup(deck.id, g.id, renaming.name);
                      setRenaming(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                  />
                ) : (
                  <span key={g.id} className={`fc-group-chip ${filterKey === g.id ? 'active' : ''}`}>
                    <button
                      type="button"
                      onClick={() => {
                        click();
                        setGroupFilter(g.id);
                      }}
                      onDoubleClick={() => setRenaming({ id: g.id, name: g.name })}
                      title={tx('Clique para ver · duplo clique para renomear')}
                    >
                      {g.name} <span>{cards.filter((c) => c.groupId === g.id).length}</span>
                    </button>
                    <button type="button" className="fc-group-x" onClick={() => removeGroup(g)} title={tx('Excluir grupo')}>
                      ×
                    </button>
                  </span>
                )
              )}
              {ungroupedCount > 0 && (
                <button
                  type="button"
                  className={filterKey === NO_GROUP ? 'active' : ''}
                  onClick={() => {
                    click();
                    setGroupFilter(NO_GROUP);
                  }}
                >
                  {tx('Sem grupo')} <span>{ungroupedCount}</span>
                </button>
              )}
            </div>
          )}

          <div className="fc-card-list">
            {visible.map((c) =>
              editingId === c.id ? (
                <CardEditRow
                  key={c.id}
                  card={c}
                  onSave={(fields) => {
                    click();
                    fc.updateCard(c.id, fields);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div
                  key={c.id}
                  className={`fc-card-row ${selecting ? 'selectable' : ''} ${selected.has(c.id) ? 'selected' : ''}`}
                  onClick={
                    selecting
                      ? () => {
                          click();
                          toggleSelect(c.id);
                        }
                      : undefined
                  }
                  onDoubleClick={selecting ? undefined : () => setEditingId(c.id)}
                >
                  {selecting && <span className={`fc-check ${selected.has(c.id) ? 'on' : ''}`}>{selected.has(c.id) ? '✓' : ''}</span>}
                  <CardThumb card={c} />
                  <div className="fc-card-text">
                    <strong>{c.front || (c.frontImg ? `🖼 ${tx('Imagem')}` : `🎵 ${tx('Áudio')}`)}</strong>
                    <span>{c.back || (c.backImg ? `🖼 ${tx('Imagem')}` : `🎵 ${tx('Áudio')}`)}</span>
                  </div>
                  <MediaBadges card={c} />
                  {filterKey === 'all' && groupKey(c) !== NO_GROUP && <span className="fc-group-tag">{groupName(c.groupId)}</span>}
                  <span className={`fc-status ${cardStatus(c, fc.today, fc.now)}`} title={c.due ? tx('Próxima revisão: {d}', { d: c.due }) : ''}>
                    {tx(STATUS_LABEL[cardStatus(c, fc.today, fc.now)])}
                  </span>
                  {!selecting && (
                    <div className="fc-row-actions">
                      <button type="button" onClick={() => setEditingId(c.id)} title={tx('Editar')}>
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          click('delete');
                          fc.deleteCard(c.id);
                        }}
                        title={tx('Excluir carta')}
                      >
                        🗑
                      </button>
                    </div>
                  )}
                </div>
              )
            )}
            {cards.length === 0 && <p className="fc-help">{tx('Nenhuma carta ainda. Adicione acima ou importe em lote.')}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function CardEditRow({ card, onSave, onCancel }) {
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [frontMedia, setFrontMedia] = useState(() => sideMedia(card, 'front'));
  const [backMedia, setBackMedia] = useState(() => sideMedia(card, 'back'));
  const created = useRef(new Set());
  const frontOk = Boolean(front.trim() || frontMedia.img || frontMedia.audio);
  const backOk = Boolean(back.trim() || backMedia.img || backMedia.audio);
  const save = () => {
    if (!frontOk || !backOk) return;
    // arquivos antigos que foram trocados/tirados saem do aparelho
    const kept = new Set([frontMedia.img, frontMedia.audio, backMedia.img, backMedia.audio].filter(Boolean));
    deleteMedia([card.frontImg, card.frontAudio, card.backImg, card.backAudio].filter((id) => id && !kept.has(id)));
    created.current.clear();
    onSave({ front: front.trim(), back: back.trim(), ...mediaToFields('front', frontMedia), ...mediaToFields('back', backMedia) });
  };
  const cancel = () => {
    deleteMedia([...created.current]);
    created.current.clear();
    onCancel();
  };
  const onKey = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') save();
  };
  return (
    <div className="fc-card-row editing">
      <FaceEditor label={tx('Pergunta')} text={front} onText={setFront} media={frontMedia} onMedia={setFrontMedia} created={created} onKeyDown={onKey} autoFocus />
      <FaceEditor label={tx('Resposta')} text={back} onText={setBack} media={backMedia} onMedia={setBackMedia} created={created} onKeyDown={onKey} />
      <div className="fc-add-actions">
        <button type="button" className="fc-btn small" onClick={cancel}>
          {tx('Cancelar')}
        </button>
        <button type="button" className="fc-btn primary small" onClick={save} disabled={!frontOk || !backOk}>
          {tx('Salvar')}
        </button>
      </div>
    </div>
  );
}

// =========================================================
// JANELA: TEMPO DE REPETIÇÃO (minutos, horas, dias...)
// =========================================================
const UNITS = [
  { id: 'min', label: 'minutos', days: 1 / 1440 },
  { id: 'h', label: 'horas', days: 1 / 24 },
  { id: 'd', label: 'dias', days: 1 },
  { id: 'sem', label: 'semanas', days: 7 },
  { id: 'mes', label: 'meses', days: 30 }
];
const unitOf = (id) => UNITS.find((u) => u.id === id) || UNITS[2];
// Melhor unidade para mostrar um valor salvo em dias
const guessUnit = (days) => {
  if (!days) return 'min';
  if (days < 1 / 24) return 'min';
  if (days < 1) return Number.isInteger(Math.round(days * 1440) / 60) ? 'h' : 'min';
  if (days % 30 === 0) return 'mes';
  if (days % 7 === 0) return 'sem';
  return 'd';
};
const round2 = (n) => Math.round(n * 100) / 100;

const INTERVAL_PRESETS = [
  {
    id: 'padrao',
    label: 'Padrão',
    desc: 'Errei na hora, depois 1 dia, 1 dia e 4 dias',
    values: { again: [0, 'min'], hard: [1, 'd'], good: [1, 'd'], easy: [4, 'd'] },
    grow: true
  },
  {
    id: 'intensivo',
    label: 'Intensivo',
    desc: 'Para decorar hoje: minutos e horas',
    values: { again: [1, 'min'], hard: [10, 'min'], good: [1, 'h'], easy: [4, 'h'] },
    grow: true
  },
  {
    id: 'longo',
    label: 'Revisão longa',
    desc: 'Para manter o que já sabe: dias e semanas',
    values: { again: [10, 'min'], hard: [2, 'd'], good: [1, 'sem'], easy: [1, 'mes'] },
    grow: true
  }
];

function IntervalsWindow({ fc, deck, click, onSave, onClose }) {
  const cfg = fc.intervalsOf(deck.id);
  const savedUnits = deck.intervalUnits || {};
  const [draft, setDraft] = useState(() => {
    const out = {};
    RATINGS.forEach((r) => {
      const u = unitOf(savedUnits[r.field] || guessUnit(cfg[r.field]));
      out[r.field] = { value: String(round2(cfg[r.field] / u.days)), unit: u.id };
    });
    return out;
  });
  const [grow, setGrow] = useState(cfg.grow);

  // Esc fecha só esta janela
  useEffect(() => {
    const prev = fc.escapeRef.current;
    fc.escapeRef.current = onClose;
    return () => {
      fc.escapeRef.current = prev;
    };
  }, [fc.escapeRef, onClose]);

  const toDays = (field) => {
    const d = draft[field];
    const n = Number(String(d.value).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(MAX_INTERVAL_DAYS, Math.round(n * unitOf(d.unit).days * 1440) / 1440);
  };
  const preview = { again: toDays('again'), hard: toDays('hard'), good: toDays('good'), easy: toDays('easy'), grow };

  // Como fica se você acertar ("Bom") várias vezes seguidas
  const growth = (() => {
    let card = { reps: 0, interval: 0, ease: 2.5 };
    const steps = [];
    for (let i = 0; i < 6; i += 1) {
      const next = schedule(card, 3, preview);
      steps.push(intervalLabel(next.interval));
      card = { ...card, ...next };
    }
    return steps;
  })();

  const set = (field, part, value) => setDraft((d) => ({ ...d, [field]: { ...d[field], [part]: value } }));
  const applyPreset = (p) => {
    click();
    const out = {};
    Object.entries(p.values).forEach(([field, [value, unit]]) => {
      out[field] = { value: String(value), unit };
    });
    setDraft(out);
    setGrow(p.grow);
  };
  const save = () => {
    click('train');
    const units = {};
    RATINGS.forEach((r) => {
      units[r.field] = draft[r.field].unit;
    });
    onSave({ again: preview.again, hard: preview.hard, good: preview.good, easy: preview.easy, grow }, units);
    onClose();
  };

  return createPortal(
    <div
      className="fc-iv-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="fc-iv-window" role="dialog" aria-label={tx('Tempo de repetição')} style={{ '--fc-deck': 'var(--theme-accent, #38bdf8)' }}>
        <div className="fc-iv-head">
          <div>
            <h3>⏱️ {tx('Tempo de repetição')}</h3>
            <small>
              {deck.emoji || '🎴'} {deck.name}
            </small>
          </div>
          <button type="button" className="st-close" onClick={onClose} title={tx('Fechar (Esc)')}>
            ✕
          </button>
        </div>

        <p className="fc-iv-help">
          {tx('Depois de responder uma carta, ela volta para revisão depois desse tempo. Use minutos e horas para decorar no mesmo dia, ou dias e semanas para revisar com calma.')}
        </p>

        <div className="fc-iv-presets">
          {INTERVAL_PRESETS.map((p) => (
            <button key={p.id} type="button" className="fc-iv-preset" onClick={() => applyPreset(p)}>
              <b>{tx(p.label)}</b>
              <small>{tx(p.desc)}</small>
            </button>
          ))}
        </div>

        <div className="fc-iv-rows">
          {RATINGS.map((r) => (
            <div key={r.value} className={`fc-iv-row ${r.cls}`}>
              <span className="fc-iv-label">
                <kbd>{r.key}</kbd> {tx(r.label)}
              </span>
              <input
                className="fc-input fc-iv-num"
                type="number"
                min="0"
                step="any"
                value={draft[r.field].value}
                onChange={(e) => set(r.field, 'value', e.target.value)}
              />
              <select className="fc-input fc-iv-unit" value={draft[r.field].unit} onChange={(e) => set(r.field, 'unit', e.target.value)}>
                {UNITS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {tx(u.label)}
                  </option>
                ))}
              </select>
              <span className="fc-iv-result">
                {preview[r.field] === 0 ? tx('repete na mesma sessão') : tx('volta em {t}', { t: intervalLabel(preview[r.field]) })}
              </span>
            </div>
          ))}
        </div>

        <label className="fc-iv-grow">
          <input
            type="checkbox"
            checked={grow}
            onChange={(e) => {
              click();
              setGrow(e.target.checked);
            }}
          />
          <span>
            <b>{tx('Aumentar o tempo a cada acerto (repetição espaçada)')}</b>
            <small>
              {grow
                ? tx('Os tempos acima valem na 1ª vez; depois, cada acerto aumenta o intervalo.')
                : tx('Os tempos ficam sempre iguais aos de cima.')}
            </small>
          </span>
        </label>

        <div className="fc-iv-growth">
          <span>{tx('Acertando ("Bom") várias vezes seguidas:')}</span>
          <div>
            {growth.map((g, i) => (
              <i key={i}>{g}</i>
            ))}
          </div>
        </div>

        <div className="fc-iv-actions">
          <button
            type="button"
            className="fc-btn small ghost-line"
            onClick={() => applyPreset({ values: { again: [0, 'min'], hard: [1, 'd'], good: [1, 'd'], easy: [4, 'd'] }, grow: DEFAULT_INTERVALS.grow })}
          >
            ↺ {tx('Tempos padrão')}
          </button>
          <span className="fc-select-spacer" />
          <button type="button" className="fc-btn" onClick={onClose}>
            {tx('Cancelar')}
          </button>
          <button type="button" className="fc-btn primary" onClick={save}>
            {tx('Salvar')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// =========================================================
// ESCOLHER GRUPOS ANTES DE ESTUDAR
// =========================================================
function GroupChooser({ fc, deck, color, click, onBack, onStart }) {
  const groups = (deck && deck.groups) || [];
  const cards = deck ? fc.cards.filter((c) => c.deckId === deck.id) : [];
  const known = new Set(groups.map((g) => g.id));
  const keyOf = (c) => (c.groupId && known.has(c.groupId) ? c.groupId : NO_GROUP);
  const ungrouped = cards.filter((c) => keyOf(c) === NO_GROUP).length;
  const options = [
    ...groups.map((g) => ({ id: g.id, name: g.name })),
    ...(ungrouped > 0 ? [{ id: NO_GROUP, name: tx('Sem grupo') }] : [])
  ];
  // Lembra a última escolha deste deck
  const [picked, setPicked] = useState(() => {
    const last = Array.isArray(deck?.studyGroups) ? deck.studyGroups.filter((id) => options.some((o) => o.id === id)) : [];
    return new Set(last.length ? last : options.map((o) => o.id));
  });
  const [all, setAll] = useState(Boolean(deck?.studyAll));
  const [shuffle, setShuffle] = useState(Boolean(deck?.studyShuffle));

  if (!deck) return null;
  const ids = [...picked];
  const queueSize = ids.length ? fc.buildQueue(deck.id, { groups: ids, all }).length : 0;
  const toggle = (id) => {
    click();
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const start = () => {
    if (!queueSize) return;
    fc.updateDeck(deck.id, { studyGroups: ids, studyAll: all, studyShuffle: shuffle });
    onStart({ groups: ids, all, shuffle });
  };

  return (
    <div className="fc-scroll fc-groups-pick" style={{ '--fc-deck': color }}>
      <div className="fc-bar">
        <button type="button" className="fc-btn ghost" onClick={onBack}>
          ← {deck.emoji || '🎴'} {deck.name}
        </button>
      </div>
      <h4 className="fc-pick-title">{tx('Quais grupos você quer estudar agora?')}</h4>
      <div className="fc-pick-list">
        {options.map((o) => {
          const inGroup = cards.filter((c) => keyOf(c) === o.id);
          const toStudy = fc.buildQueue(deck.id, { groups: [o.id] }).length;
          return (
            <label key={o.id} className={`fc-pick-row ${picked.has(o.id) ? 'on' : ''}`}>
              <input type="checkbox" checked={picked.has(o.id)} onChange={() => toggle(o.id)} />
              <span className="fc-pick-name">{o.name}</span>
              <span className="fc-pick-count">
                {tx('{s} para estudar · {t} cartas', { s: toStudy, t: inGroup.length })}
              </span>
            </label>
          );
        })}
      </div>
      <div className="fc-pick-quick">
        <button type="button" className="fc-btn small" onClick={() => { click(); setPicked(new Set(options.map((o) => o.id))); }}>
          {tx('Todos')}
        </button>
        <button type="button" className="fc-btn small" onClick={() => { click(); setPicked(new Set()); }}>
          {tx('Nenhum')}
        </button>
      </div>
      <div className="fc-pick-opts">
      <label className="fc-pick-all">
        <input type="checkbox" checked={all} onChange={(e) => { click(); setAll(e.target.checked); }} />
        <span>
          <b>{tx('Treino livre')}</b>
          <small>{tx('Estuda todas as cartas dos grupos, mesmo as que ainda não chegaram no dia de revisar.')}</small>
        </span>
      </label>
      <label className="fc-pick-all">
        <input
          type="checkbox"
          checked={shuffle}
          onChange={(e) => {
            click();
            setShuffle(e.target.checked);
          }}
        />
        <span>
          <b>{tx('Seguir cartões de forma aleatória')}</b>
          <small>{tx('As cartas aparecem embaralhadas, e não na ordem da lista (1ª, 2ª, 3ª...).')}</small>
        </span>
      </label>
      </div>
      <button type="button" className="fc-btn primary fc-pick-start" disabled={!queueSize} onClick={start}>
        ▶ {queueSize ? tx('Estudar {n} carta(s)', { n: queueSize }) : tx('Nada para estudar nesses grupos')}
      </button>
    </div>
  );
}

// =========================================================
// SESSÃO DE ESTUDO
// =========================================================
function StudySession({ fc, deck, skill, queue: initialQueue, color, click, onExit, onAgain, studyOpts = {} }) {
  const [queue, setQueue] = useState(initialQueue);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const firstPass = useRef(new Set());

  const cardId = queue[pos];
  const card = fc.cards.find((c) => c.id === cardId);
  const done = !summary && (pos >= queue.length || !card);
  // trocar de carta (ou sair) para o áudio/voz que estava tocando
  useEffect(() => stopCardSound, [cardId]);

  // Fim da sessão: calcula o XP uma única vez
  useEffect(() => {
    if (!done || summary) return;
    const deckName = deck ? deck.name : tx('Todos os decks');
    const res = fc.finishSession({ results, deck: deckName, skill });
    setSummary({ ...res, results });
    click('train');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const rate = (value) => {
    if (!card || !flipped) return;
    click(value === 1 ? 'delete' : 'click');
    fc.reviewCard(card.id, value);
    // Só a primeira resposta de cada carta conta para o resultado
    if (!firstPass.current.has(card.id)) {
      firstPass.current.add(card.id);
      setResults((r) => [...r, value]);
    }
    // Tempo 0 (ex.: Errei): a carta volta no fim da fila (no máximo 3 vezes)
    const repeats = queue.filter((id) => id === card.id).length;
    const next = schedule(card, value, fc.intervalsOf(card.deckId));
    // (tempos curtos, até 10 min, também voltam ainda nesta sessão)
    if ((next.interval === 0 || next.interval * 1440 <= 10) && repeats < 3) setQueue((qq) => [...qq, card.id]);
    setFlipped(false);
    setPos((p) => p + 1);
  };

  // Teclas: Espaço/Enter vira · 1-4 avalia
  useEffect(() => {
    fc.keyRef.current = (e) => {
      if (summary) {
        if (e.key === 'Enter') {
          onExit();
          return true;
        }
        return false;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        if (!flipped) {
          click();
          setFlipped(true);
        } else rate(3);
        return true;
      }
      const r = RATINGS.find((x) => x.key === e.key);
      if (r && flipped) {
        rate(r.value);
        return true;
      }
      return false;
    };
    return () => {
      fc.keyRef.current = null;
    };
  });

  if (summary) {
    const total = summary.results.length;
    const right = summary.results.filter((r) => r >= 3).length;
    const pct = total ? Math.round((right / total) * 100) : 0;
    return (
      <div className="fc-summary" style={{ '--fc-deck': color }}>
        <div className="fc-summary-badge">{pct >= 80 ? '🏆' : pct >= 50 ? '💪' : '📚'}</div>
        <h4>{tx('Sessão concluída!')}</h4>
        <div className="fc-summary-grid">
          <div>
            <b>{total}</b>
            <span>{tx('cartas')}</span>
          </div>
          <div>
            <b>{pct}%</b>
            <span>{tx('acertos')}</span>
          </div>
          <div>
            <b>+{summary.xp}</b>
            <span>XP</span>
          </div>
          <div>
            <b>🔥 {fc.streak}</b>
            <span>{fc.streak === 1 ? tx('dia') : tx('dias')}</span>
          </div>
        </div>
        {skill && summary.xp > 0 && (
          <p className="fc-help">{tx('XP somado em “{c}” por estudar {s}.', { c: skill.category || 'Geral', s: skill.title })}</p>
        )}
        {summary.capped && <p className="fc-help">{tx('Você atingiu o limite de XP de flashcards de hoje.')}</p>}
        <div className="fc-summary-actions">
          <button type="button" className="fc-btn" onClick={onExit}>
            ← {tx('Voltar aos decks')}
          </button>
          {fc.buildQueue(deck ? deck.id : null, studyOpts).length > 0 && (
            <button type="button" className="fc-btn primary" onClick={onAgain}>
              ▶ {tx('Continuar estudando')}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!card) return null;

  const progress = Math.min(100, Math.round((pos / queue.length) * 100));
  const status = cardStatus(card, fc.today, fc.now);

  return (
    <div className="fc-study" style={{ '--fc-deck': color }}>
      <div className="fc-bar">
        <button type="button" className="fc-btn ghost" onClick={onExit}>
          ← {tx('Sair')}
        </button>
        <div className="fc-progress">
          <span style={{ width: `${progress}%` }} />
        </div>
        <span className="fc-bar-stats">
          {pos + 1}/{queue.length}
        </span>
      </div>

      <div className="fc-study-meta">
        <span>
          {deck ? `${deck.emoji || '🎴'} ${deck.name}` : `🎴 ${tx('Todos os decks')}`}
          {skill && (
            <em>
              <i style={{ background: skill.color }} /> {skill.title}
            </em>
          )}
        </span>
        <span className={`fc-status ${status}`}>{tx(STATUS_LABEL[status])}</span>
      </div>

      <button
        type="button"
        className={`fc-flip ${flipped ? 'flipped' : ''}`}
        onClick={() => {
          if (!flipped) {
            click();
            setFlipped(true);
          }
        }}
        aria-label={flipped ? tx('Resposta') : tx('Mostrar resposta')}
      >
        <span className="fc-flip-inner">
          <span className="fc-face front">
            <small>{tx('Pergunta')}</small>
            <FaceMedia card={card} side="front" active={!flipped} />
            <span className="fc-face-text">{card.front}</span>
            <em>{tx('Clique ou aperte Espaço para ver a resposta')}</em>
          </span>
          <span className="fc-face back">
            <small>{tx('Resposta')}</small>
            <span className="fc-face-q">{card.front}</span>
            <FaceMedia card={card} side="back" active={flipped} />
            <span className="fc-face-text">{card.back}</span>
          </span>
        </span>
      </button>

      <div className={`fc-ratings ${flipped ? 'show' : ''}`}>
        {flipped ? (
          RATINGS.map((r) => (
            <button key={r.value} type="button" className={`fc-rate ${r.cls}`} onClick={() => rate(r.value)}>
              <b>{tx(r.label)}</b>
              <small>{intervalLabel(schedule(card, r.value, fc.intervalsOf(card.deckId)).interval)}</small>
              <kbd>{r.key}</kbd>
            </button>
          ))
        ) : (
          <button
            type="button"
            className="fc-btn primary wide"
            onClick={() => {
              click();
              setFlipped(true);
            }}
          >
            {tx('Mostrar resposta')} <kbd>{tx('Espaço')}</kbd>
          </button>
        )}
      </div>
      <p className="fc-help center">
        {tx('Até {n} cartas novas por sessão · errou? ela volta no fim da fila', { n: NEW_PER_SESSION })}
      </p>
    </div>
  );
}
