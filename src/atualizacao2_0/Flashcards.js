import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProfileStoredState } from './ProfileStorage.js';

// =========================================================
// FLASHCARDS — repetição espaçada (estilo SM-2 simplificado)
// Decks podem ser ligados a uma habilidade: herdam a cor dela,
// geram cartas a partir das metas/tarefas de cada nível e as
// sessões de estudo rendem XP na categoria da habilidade.
// =========================================================

export const STORAGE_KEY_FLASH = 'rpg_flashcards_v1';
export const NEW_PER_SESSION = 15;
export const DAILY_XP_CAP = 80;
export const MASTERED_DAYS = 21;

const EMPTY = { decks: [], cards: [], stats: { streak: 0, lastStudyDay: '', daily: {} } };

export const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ---------- Datas (fuso local) ----------
export const toDayKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const addDays = (dayKey, n) => {
  const [y, m, d] = dayKey.split('-').map(Number);
  return toDayKey(new Date(y, m - 1, d + n));
};
const dayDiff = (a, b) => {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
};

// ---------- Estado de uma carta ----------
export const isNewCard = (c) => !c.reps && !c.lastReview;
export const isDue = (c, today) => !isNewCard(c) && (!c.due || c.due <= today);
export const isMastered = (c) => (c.interval || 0) >= MASTERED_DAYS;

export const cardStatus = (c, today) => {
  if (isNewCard(c)) return 'new';
  if (isMastered(c)) return 'mastered';
  if (isDue(c, today)) return 'due';
  return 'learning';
};

// Tempos de repetição (em dias) de cada deck. 0 = repete na mesma sessão.
// `grow`: a cada acerto o intervalo aumenta (repetição espaçada); senão fica fixo.
export const DEFAULT_INTERVALS = { again: 0, hard: 1, good: 1, easy: 4, grow: true };
export const MAX_INTERVAL_DAYS = 365;

export const deckIntervals = (deck) => {
  const v = (deck && deck.intervals) || {};
  const num = (x, d) => {
    if (x === '' || x === null || x === undefined) return d;
    const n = Math.round(Number(x));
    return Number.isFinite(n) ? Math.min(MAX_INTERVAL_DAYS, Math.max(0, n)) : d;
  };
  return {
    again: num(v.again, DEFAULT_INTERVALS.again),
    hard: num(v.hard, DEFAULT_INTERVALS.hard),
    good: num(v.good, DEFAULT_INTERVALS.good),
    easy: num(v.easy, DEFAULT_INTERVALS.easy),
    grow: v.grow !== undefined ? Boolean(v.grow) : DEFAULT_INTERVALS.grow
  };
};

// Próximo agendamento para cada nota: 1 Errei · 2 Difícil · 3 Bom · 4 Fácil
export const schedule = (card, rating, cfg = DEFAULT_INTERVALS) => {
  const ease = card.ease || 2.5;
  const reps = card.reps || 0;
  const interval = card.interval || 0;
  // Primeira vez: o tempo escolhido. Depois (se `grow`), cresce a partir dele.
  const grown = (base, factor) =>
    Math.min(
      MAX_INTERVAL_DAYS,
      cfg.grow && reps > 0 && base > 0 ? Math.max(base, Math.round(Math.max(interval, 1) * factor)) : base
    );
  if (rating === 1) {
    return { interval: cfg.again, ease: Math.max(1.3, ease - 0.2), reps: 0, lapses: (card.lapses || 0) + 1 };
  }
  if (rating === 2) return { interval: grown(cfg.hard, 1.2), ease: Math.max(1.3, ease - 0.15), reps: reps + 1 };
  if (rating === 3) return { interval: grown(cfg.good, ease), ease, reps: reps + 1 };
  return { interval: grown(cfg.easy, ease * 1.3), ease: ease + 0.15, reps: reps + 1 };
};

// Rótulo curto do intervalo ("agora", "3 d", "2 sem", "1 mês")
export const intervalLabel = (days) => {
  if (!days) return '< 1 min';
  if (days < 7) return `${days} d`;
  if (days < 30) return `${Math.round(days / 7)} sem`;
  if (days < 365) return `${Math.round(days / 30)} m`;
  return `${(days / 365).toFixed(1)} a`;
};

// ---------- Módulos/cursos de uma habilidade ----------
// O "Principal" usa os campos default* (ou os da própria habilidade quando
// ele é o módulo aberto); os outros ficam em `skill.modules`.
export const skillModules = (skill) => {
  if (!skill) return [];
  const mainActive = !skill.activeModuleId || skill.activeModuleId === 'default';
  const pick = (activeVal, savedVal) => (mainActive ? activeVal : savedVal !== undefined ? savedVal : activeVal) || {};
  const main = {
    id: 'default',
    name: null,
    level: mainActive ? skill.level : skill.defaultLevel ?? 0,
    maxLevel: mainActive ? skill.maxLevel : skill.defaultMaxLevel ?? 10,
    levelDescriptions: pick(skill.levelDescriptions, skill.defaultLevelDescriptions),
    levelTasks: pick(skill.levelTasks, skill.defaultLevelTasks),
    levelInfos: pick(skill.levelInfos, skill.defaultLevelInfos),
    miniMissions: skill.miniMissions || []
  };
  const others = (Array.isArray(skill.modules) ? skill.modules : [])
    .filter((m) => m && m.id)
    .map((m) => {
      const active = skill.activeModuleId === m.id;
      return {
        id: m.id,
        name: m.name || 'Módulo',
        level: m.level || 0,
        maxLevel: m.maxLevel || 10,
        levelDescriptions: (active ? skill.levelDescriptions : m.levelDescriptions) || {},
        levelTasks: (active ? skill.levelTasks : m.levelTasks) || {},
        levelInfos: (active ? skill.levelInfos : m.levelInfos) || {},
        miniMissions: []
      };
    });
  return [main, ...others];
};

// ---------- Cartas geradas a partir de um módulo da habilidade ----------
const plainTx = (t, v) => (v ? t.replace(/\{(\w+)\}/g, (_, k) => v[k]) : t);
export const cardsFromSkill = (skill, tx = plainTx, moduleId = 'default') => {
  if (!skill) return [];
  const mods = skillModules(skill);
  const mod = mods.find((m) => m.id === moduleId) || mods[0];
  const title = mod.name ? `${skill.title || ''} · ${mod.name}` : skill.title || '';
  const out = [];
  const levels = new Set([
    ...Object.keys(mod.levelDescriptions || {}),
    ...Object.keys(mod.levelInfos || {}),
    ...Object.keys(mod.levelTasks || {})
  ]);
  [...levels]
    .map(Number)
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b)
    .forEach((lvl) => {
      const desc = (mod.levelDescriptions || {})[lvl];
      const info = (mod.levelInfos || {})[lvl];
      const tasks = ((mod.levelTasks || {})[lvl] || [])
        .map((t) => (typeof t === 'string' ? t : t && t.text) || '')
        .filter((t) => t.trim());
      if (desc && String(desc).trim()) {
        out.push({ front: tx('{skill} · Nível {n}: qual é a meta?', { skill: title, n: lvl }), back: String(desc).trim() });
      }
      if (info && String(info).trim()) {
        out.push({ front: tx('{skill} · Nível {n}: o que você precisa saber?', { skill: title, n: lvl }), back: String(info).trim() });
      }
      if (tasks.length > 0) {
        out.push({
          front: tx('{skill} · Nível {n}: quais são as tarefas?', { skill: title, n: lvl }),
          back: tasks.map((t) => `• ${t.trim()}`).join('\n')
        });
      }
    });
  (mod.miniMissions || [])
    .map((m) => String(m || '').trim())
    .filter(Boolean)
    .forEach((m, i) => {
      out.push({ front: tx('{skill} · Missão rápida {n}: o que fazer?', { skill: title, n: i + 1 }), back: m });
    });
  return out;
};

// "frente ; verso" (ou TAB, " :: ", " | ") — uma carta por linha
export const parseBulk = (text) =>
  String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const sep = ['\t', ' :: ', ' ; ', ';', ' | '].find((s) => line.includes(s));
      if (!sep) return null;
      const i = line.indexOf(sep);
      const front = line.slice(0, i).trim();
      const back = line.slice(i + sep.length).trim().replace(/\\n/g, '\n');
      return front && back ? { front, back } : null;
    })
    .filter(Boolean);

const sanitize = (raw) => {
  const v = raw && typeof raw === 'object' ? raw : {};
  return {
    decks: Array.isArray(v.decks) ? v.decks.filter((d) => d && d.id) : [],
    cards: Array.isArray(v.cards) ? v.cards.filter((c) => c && c.id && c.deckId) : [],
    stats: {
      streak: Number(v.stats?.streak) || 0,
      lastStudyDay: v.stats?.lastStudyDay || '',
      daily: v.stats?.daily && typeof v.stats.daily === 'object' ? v.stats.daily : {}
    }
  };
};

// =========================================================
// HOOK
// =========================================================
export function useFlashcards(profileId, { onReward } = {}) {
  const [rawData, setRawData] = useProfileStoredState(STORAGE_KEY_FLASH, profileId, EMPTY);
  const data = useMemo(() => sanitize(rawData), [rawData]);
  const [isOpen, setIsOpen] = useState(false);
  const [today, setToday] = useState(() => toDayKey());

  // Virada do dia
  useEffect(() => {
    const refresh = () => setToday(toDayKey());
    const id = setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const update = useCallback((fn) => setRawData((prev) => fn(sanitize(prev))), [setRawData]);
  const toggleModal = useCallback(() => setIsOpen((v) => !v), []);

  // A tela aberta (estudo, editor...) registra aqui o que fazer com Esc e com as teclas
  const escapeRef = useRef(null);
  const keyRef = useRef(null);
  const openRef = useRef(isOpen);
  useEffect(() => {
    openRef.current = isOpen;
  });

  // Registrado antes do atalho global do App: consegue consumir as teclas
  useEffect(() => {
    const onKey = (e) => {
      // Ferramenta compartilhada: vale nos três modos
      const el = document.activeElement;
      const editing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      const key = e.key ? e.key.toLowerCase() : '';
      const mod = e.ctrlKey || e.metaKey || e.altKey;

      if (openRef.current && e.key === 'Escape') {
        // Uma janela por cima (ex.: confirmação) fecha primeiro
        e.preventDefault();
        e.stopImmediatePropagation();
        if (editing) el.blur();
        else if (escapeRef.current) escapeRef.current();
        else setIsOpen(false);
        return;
      }

      if (!openRef.current) {
        if (!editing && !mod && key === 'f' && !document.querySelector('.modal-backdrop')) {
          e.preventDefault();
          e.stopImmediatePropagation();
          setIsOpen(true);
        }
        return;
      }

      if (editing) return;
      if (keyRef.current && keyRef.current(e)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (!mod && key === 'f') {
        e.preventDefault();
        e.stopImmediatePropagation();
        setIsOpen(false);
        return;
      }
      // Atalhos de letra/Espaço do app não abrem janelas por baixo
      if (!mod && (key.length === 1 || key === ' ')) e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, []);

  // ---------- Decks ----------
  const addDeck = (fields = {}) => {
    const deck = {
      id: uid('deck'),
      name: (fields.name || '').trim() || 'Novo deck',
      emoji: fields.emoji || '🎴',
      skillId: fields.skillId || null,
      moduleId: fields.moduleId || null,
      notify: true,
      intervals: { ...DEFAULT_INTERVALS },
      createdAt: new Date().toISOString()
    };
    const cards = (fields.cards || []).map((c) => newCard(deck.id, c));
    update((d) => ({ ...d, decks: [...d.decks, deck], cards: [...d.cards, ...cards] }));
    return deck.id;
  };

  const updateDeck = (deckId, fields) =>
    update((d) => ({ ...d, decks: d.decks.map((x) => (x.id === deckId ? { ...x, ...fields } : x)) }));

  const deleteDeck = (deckId) =>
    update((d) => ({ ...d, decks: d.decks.filter((x) => x.id !== deckId), cards: d.cards.filter((c) => c.deckId !== deckId) }));

  // ---------- Cartas ----------
  const newCard = (deckId, { front, back }) => ({
    id: uid('card'),
    deckId,
    front: String(front || '').trim(),
    back: String(back || '').trim(),
    createdAt: new Date().toISOString(),
    due: '',
    interval: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    lastReview: null
  });

  const addCards = (deckId, list) => {
    const clean = (list || []).filter((c) => String(c.front || '').trim() && String(c.back || '').trim());
    if (clean.length === 0) return 0;
    update((d) => ({ ...d, cards: [...d.cards, ...clean.map((c) => newCard(deckId, c))] }));
    return clean.length;
  };

  const updateCard = (cardId, fields) =>
    update((d) => ({ ...d, cards: d.cards.map((c) => (c.id === cardId ? { ...c, ...fields } : c)) }));

  const deleteCard = (cardId) => update((d) => ({ ...d, cards: d.cards.filter((c) => c.id !== cardId) }));

  const resetDeckProgress = (deckId) =>
    update((d) => ({
      ...d,
      cards: d.cards.map((c) =>
        c.deckId === deckId ? { ...c, due: '', interval: 0, ease: 2.5, reps: 0, lapses: 0, lastReview: null } : c
      )
    }));

  // ---------- Estudo ----------
  const reviewCard = (cardId, rating) => {
    const day = toDayKey();
    update((d) => {
      const cards = d.cards.map((c) => {
        if (c.id !== cardId) return c;
        const next = schedule(c, rating, deckIntervals(d.decks.find((x) => x.id === c.deckId)));
        return { ...c, ...next, due: addDays(day, next.interval), lastReview: new Date().toISOString() };
      });
      // Sequência de dias estudando
      let { streak, lastStudyDay } = d.stats;
      if (lastStudyDay !== day) {
        streak = lastStudyDay && dayDiff(lastStudyDay, day) === 1 ? streak + 1 : 1;
        lastStudyDay = day;
      }
      const todayStats = d.stats.daily[day] || { reviews: 0, correct: 0, xp: 0 };
      const daily = {
        ...d.stats.daily,
        [day]: { ...todayStats, reviews: todayStats.reviews + 1, correct: todayStats.correct + (rating >= 3 ? 1 : 0) }
      };
      // Guarda só os últimos 60 dias
      const keys = Object.keys(daily).sort();
      keys.slice(0, Math.max(0, keys.length - 60)).forEach((k) => delete daily[k]);
      return { ...d, cards, stats: { ...d.stats, streak, lastStudyDay, daily } };
    });
  };

  // XP ao terminar uma sessão (com teto diário para não virar "farm")
  const finishSession = ({ results, deck, skill }) => {
    const day = toDayKey();
    const earned = results.reduce((n, r) => n + (r === 1 ? 0 : r === 2 ? 1 : 2), 0) + (results.length >= 5 ? 5 : 0);
    const already = (data.stats.daily[day] && data.stats.daily[day].xp) || 0;
    const xp = Math.max(0, Math.min(earned, DAILY_XP_CAP - already));
    if (xp > 0) {
      update((d) => {
        const t = d.stats.daily[day] || { reviews: 0, correct: 0, xp: 0 };
        return { ...d, stats: { ...d.stats, daily: { ...d.stats.daily, [day]: { ...t, xp: (t.xp || 0) + xp } } } };
      });
      if (onReward) onReward(xp, deck, skill);
    }
    return { xp, capped: xp < earned };
  };

  // ---------- Resumos ----------
  const deckSummary = useCallback(
    (deckId) => {
      const cards = data.cards.filter((c) => !deckId || c.deckId === deckId);
      const fresh = cards.filter(isNewCard).length;
      const due = cards.filter((c) => isDue(c, today)).length;
      const mastered = cards.filter(isMastered).length;
      return {
        total: cards.length,
        fresh,
        due,
        mastered,
        toStudy: due + Math.min(fresh, NEW_PER_SESSION),
        mastery: cards.length ? Math.round((mastered / cards.length) * 100) : 0
      };
    },
    [data.cards, today]
  );

  // Fila de estudo: revisões vencidas primeiro, depois novas (limitadas)
  const buildQueue = (deckId) => {
    const pool = data.cards.filter((c) => !deckId || c.deckId === deckId);
    const due = pool.filter((c) => isDue(c, today)).sort((a, b) => (a.due || '').localeCompare(b.due || ''));
    const fresh = pool.filter(isNewCard).slice(0, NEW_PER_SESSION);
    return [...due, ...fresh].map((c) => c.id);
  };

  const totalDue = deckSummary(null).toStudy;
  // Contador do ícone na tela inicial: só decks com a notificação ativa
  const badgeDue = data.decks
    .filter((dk) => dk.notify !== false)
    .reduce((n, dk) => n + deckSummary(dk.id).toStudy, 0);
  const intervalsOf = (deckId) => deckIntervals(data.decks.find((x) => x.id === deckId));
  const todayStats = data.stats.daily[today] || { reviews: 0, correct: 0, xp: 0 };
  // A sequência só vale se estudou hoje ou ontem
  const streak =
    data.stats.lastStudyDay && dayDiff(data.stats.lastStudyDay, today) <= 1 ? data.stats.streak : 0;

  return {
    isOpen,
    setIsOpen,
    toggleModal,
    escapeRef,
    keyRef,
    today,
    decks: data.decks,
    cards: data.cards,
    stats: data.stats,
    todayStats,
    streak,
    totalDue,
    badgeDue,
    intervalsOf,
    addDeck,
    updateDeck,
    deleteDeck,
    addCards,
    updateCard,
    deleteCard,
    resetDeckProgress,
    reviewCard,
    finishSession,
    deckSummary,
    buildQueue
  };
}
