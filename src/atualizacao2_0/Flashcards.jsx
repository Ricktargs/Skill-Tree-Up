import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './Flashcards.css';
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
  NEW_PER_SESSION
} from './Flashcards.js';

const DECK_EMOJIS = ['🎴', '📘', '📗', '📕', '🧠', '💡', '🗣️', '🧪', '📐', '💻', '🎵', '🌍', '⚔️', '🏋️', '🎨', '📜'];

const RATINGS = [
  { value: 1, key: '1', label: 'Errei', cls: 'again', field: 'again' },
  { value: 2, key: '2', label: 'Difícil', cls: 'hard', field: 'hard' },
  { value: 3, key: '3', label: 'Bom', cls: 'good', field: 'good' },
  { value: 4, key: '4', label: 'Fácil', cls: 'easy', field: 'easy' }
];

const STATUS_LABEL = { new: 'Nova', due: 'Para revisar', learning: 'Aprendendo', mastered: 'Dominada' };

// =========================================================
// MODAL
// =========================================================
export function FlashcardsModal({ fc, skills = [], playSound }) {
  useLanguage();
  const [view, setView] = useState({ name: 'home' });
  const [menu, setMenu] = useState(null); // { x, y, deckId, confirm }
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

  const startStudy = (deckId) => {
    const queue = fc.buildQueue(deckId);
    if (queue.length === 0) return;
    click('train');
    setView({ name: 'study', deckId, queue });
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
              setMenu({ deckId, x, y, confirm: false });
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
            onExit={() => setView({ name: 'home' })}
            onAgain={() => startStudy(view.deckId)}
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
  const holdRef = useRef(null);
  // Celular: segurar o dedo no deck abre o mesmo menu do botão direito
  const holdHandlers = (deckId) => ({
    onTouchStart: (e) => {
      const t = e.touches[0];
      clearTimeout(holdRef.current);
      holdRef.current = setTimeout(() => {
        holdRef.current = 'fired';
        onMenu(deckId, t.clientX, t.clientY);
      }, 550);
    },
    onTouchMove: () => clearTimeout(holdRef.current),
    onTouchEnd: (e) => {
      if (holdRef.current === 'fired') e.preventDefault();
      clearTimeout(holdRef.current);
      holdRef.current = null;
    }
  });

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

      <div className="fc-deck-grid">
        {fc.decks.map((deck) => {
          const s = fc.deckSummary(deck.id);
          const skill = skillOf(deck);
          return (
            <div
              key={deck.id}
              className={`fc-deck ${deck.notify === false ? 'muted' : ''}`}
              style={{ '--fc-deck': deckColor(deck) }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMenu(deck.id, e.clientX, e.clientY);
              }}
              {...holdHandlers(deck.id)}
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
      {menu.confirm ? (
        <div className="fc-menu-confirm">
          <span>{tx('Excluir o deck e {n} carta(s)?', { n: count })}</span>
          <div>
            <button type="button" className="fc-btn small" onClick={() => setMenu({ ...menu, confirm: false })}>
              {tx('Cancelar')}
            </button>
            <button
              type="button"
              className="fc-btn small danger"
              onClick={() => {
                click('delete');
                fc.deleteDeck(deck.id);
                setMenu(null);
              }}
            >
              {tx('Excluir')}
            </button>
          </div>
        </div>
      ) : (
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
          <button type="button" role="menuitem" className="danger" onClick={() => setMenu({ ...menu, confirm: true })}>
            🗑 {tx('Excluir Flashcards')}
          </button>
        </>
      )}
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
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState('');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState('');
  const [choosingModule, setChoosingModule] = useState(false);
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
  const visible = q ? cards.filter((c) => (c.front + ' ' + c.back).toLowerCase().includes(q)) : cards;
  const flash = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 2500);
  };

  const add = () => {
    if (!front.trim() || !back.trim()) return;
    click('train');
    fc.addCards(deck.id, [{ front, back }]);
    setFront('');
    setBack('');
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
  const setIntervalDays = (field, value) => fc.updateDeck(deck.id, { intervals: { ...cfg, [field]: value } });

  return (
    <div className="fc-editor" style={{ '--fc-deck': deckColor(deck) }}>
      <div className="fc-bar">
        <button type="button" className="fc-btn ghost" onClick={onBack}>
          ← {tx('Decks')}
        </button>
        <span className="fc-bar-stats">
          {tx('{t} cartas · {m}% dominado', { t: s.total, m: s.mastery })}
        </span>
        <button type="button" className="fc-btn primary" disabled={s.toStudy === 0} onClick={onStudy}>
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
          <div className="fc-field fc-intervals">
            <span>⏱️ {tx('Tempo de repetição')}</span>
            {RATINGS.map((r) => (
              <label key={r.value} className={`fc-interval ${r.cls}`}>
                <b>{tx(r.label)}</b>
                <input
                  type="number"
                  min="0"
                  max={MAX_INTERVAL_DAYS}
                  value={cfg[r.field]}
                  onChange={(e) => setIntervalDays(r.field, e.target.value === '' ? '' : Number(e.target.value))}
                />
                <small>{cfg[r.field] === 0 ? tx('mesma sessão') : cfg[r.field] === 1 ? tx('dia') : tx('dias')}</small>
              </label>
            ))}
            <label className="fc-check">
              <input
                type="checkbox"
                checked={cfg.grow}
                onChange={(e) => {
                  click();
                  setIntervalDays('grow', e.target.checked);
                }}
              />
              {tx('Aumentar o tempo a cada acerto (repetição espaçada)')}
            </label>
            <small className="fc-interval-help">
              {cfg.grow
                ? tx('Os tempos acima valem na 1ª vez; depois, cada acerto aumenta o intervalo.')
                : tx('Os tempos ficam sempre iguais aos de cima.')}
            </small>
            <button
              type="button"
              className="fc-btn small ghost-line"
              onClick={() => {
                click();
                fc.updateDeck(deck.id, { intervals: { ...DEFAULT_INTERVALS } });
              }}
            >
              ↺ {tx('Tempos padrão')}
            </button>
          </div>

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
            {confirmDelete ? (
              <div className="fc-confirm">
                <span>{tx('Excluir o deck e {n} carta(s)?', { n: s.total })}</span>
                <button
                  type="button"
                  className="fc-btn small danger"
                  onClick={() => {
                    click('delete');
                    fc.deleteDeck(deck.id);
                    onBack();
                  }}
                >
                  {tx('Excluir')}
                </button>
                <button type="button" className="fc-btn small" onClick={() => setConfirmDelete(false)}>
                  {tx('Cancelar')}
                </button>
              </div>
            ) : (
              <button type="button" className="fc-btn small danger-ghost" onClick={() => setConfirmDelete(true)}>
                🗑 {tx('Excluir deck')}
              </button>
            )}
          </div>
        </aside>

        {/* Cartas */}
        <section className="fc-cards">
          <div className="fc-add">
            <textarea
              ref={frontRef}
              className="fc-input"
              rows={2}
              placeholder={tx('Frente (pergunta)')}
              value={front}
              onChange={(e) => setFront(e.target.value)}
              onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && add()}
            />
            <textarea
              className="fc-input"
              rows={2}
              placeholder={tx('Verso (resposta)')}
              value={back}
              onChange={(e) => setBack(e.target.value)}
              onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && add()}
            />
            <div className="fc-add-actions">
              <button type="button" className="fc-btn ghost small" onClick={() => setBulkOpen((v) => !v)}>
                📥 {tx('Importar em lote')}
              </button>
              <button type="button" className="fc-btn primary small" disabled={!front.trim() || !back.trim()} onClick={add}>
                ＋ {tx('Adicionar carta')} <kbd>Ctrl+Enter</kbd>
              </button>
            </div>
            {bulkOpen && (
              <div className="fc-bulk">
                <textarea
                  className="fc-input"
                  rows={5}
                  placeholder={tx('Uma carta por linha: frente ; verso  (também aceita TAB, " :: " ou " | ")')}
                  value={bulk}
                  onChange={(e) => setBulk(e.target.value)}
                />
                <div className="fc-add-actions">
                  <small>{tx('{n} carta(s) reconhecida(s)', { n: parseBulk(bulk).length })}</small>
                  <button
                    type="button"
                    className="fc-btn primary small"
                    disabled={parseBulk(bulk).length === 0}
                    onClick={() => {
                      const n = fc.addCards(deck.id, parseBulk(bulk));
                      click('train');
                      setBulk('');
                      setBulkOpen(false);
                      flash(tx('{n} carta(s) importada(s)', { n }));
                    }}
                  >
                    {tx('Importar')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {notice && <div className="fc-notice">{notice}</div>}

          {cards.length > 3 && (
            <input className="fc-input fc-search" placeholder={tx('Buscar nas cartas...')} value={query} onChange={(e) => setQuery(e.target.value)} />
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
                <div key={c.id} className="fc-card-row" onDoubleClick={() => setEditingId(c.id)}>
                  <div className="fc-card-text">
                    <strong>{c.front}</strong>
                    <span>{c.back}</span>
                  </div>
                  <span className={`fc-status ${cardStatus(c, fc.today)}`} title={c.due ? tx('Próxima revisão: {d}', { d: c.due }) : ''}>
                    {tx(STATUS_LABEL[cardStatus(c, fc.today)])}
                  </span>
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
  const save = () => front.trim() && back.trim() && onSave({ front: front.trim(), back: back.trim() });
  const onKey = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') save();
  };
  return (
    <div className="fc-card-row editing">
      <textarea className="fc-input" rows={2} value={front} onChange={(e) => setFront(e.target.value)} onKeyDown={onKey} autoFocus />
      <textarea className="fc-input" rows={2} value={back} onChange={(e) => setBack(e.target.value)} onKeyDown={onKey} />
      <div className="fc-add-actions">
        <button type="button" className="fc-btn small" onClick={onCancel}>
          {tx('Cancelar')}
        </button>
        <button type="button" className="fc-btn primary small" onClick={save}>
          {tx('Salvar')}
        </button>
      </div>
    </div>
  );
}

// =========================================================
// SESSÃO DE ESTUDO
// =========================================================
function StudySession({ fc, deck, skill, queue: initialQueue, color, click, onExit, onAgain }) {
  const [queue, setQueue] = useState(initialQueue);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const firstPass = useRef(new Set());

  const cardId = queue[pos];
  const card = fc.cards.find((c) => c.id === cardId);
  const done = !summary && (pos >= queue.length || !card);

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
    if (next.interval === 0 && repeats < 3) setQueue((qq) => [...qq, card.id]);
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
          {fc.buildQueue(deck ? deck.id : null).length > 0 && (
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
  const status = cardStatus(card, fc.today);

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
            <span className="fc-face-text">{card.front}</span>
            <em>{tx('Clique ou aperte Espaço para ver a resposta')}</em>
          </span>
          <span className="fc-face back">
            <small>{tx('Resposta')}</small>
            <span className="fc-face-q">{card.front}</span>
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
