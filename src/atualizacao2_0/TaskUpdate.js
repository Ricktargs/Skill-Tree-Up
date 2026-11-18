import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { globalUndo, globalRedo, useGlobalUndo, useUndoRestore } from './GlobalUndo.js';
import { tx } from '../i18n/index.jsx';
import { readProfileValue, writeProfileValue, useProfileStoredState } from './ProfileStorage.js';

// Mesmas chaves de antes: os dados salvos e o backup continuam compatíveis
const STORAGE_KEY_LISTS = 'task_update_lists_v1';
const STORAGE_KEY_LANG = 'task_update_lang_v1';
const STORAGE_KEY_VIEW = 'task_update_view_v1';

const HISTORY_LIMIT = 60;

const DEFAULT_LISTS = [{ id: 'list_default', title: 'Geral', tasks: [] }];

// ---------- Datas (sempre no fuso local) ----------
// Antes usava toISOString(), que é UTC: no Brasil o "dia" virava às 21h.
export const toDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const parseDateKey = (key) => {
  if (!key) return null;
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

export const daysBetween = (fromKey, toKey) => {
  const a = parseDateKey(fromKey);
  const b = parseDateKey(toKey);
  if (!a || !b) return null;
  return Math.round((b - a) / 86400000);
};

const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// ---------- Recorrência ----------
// daily   → todo dia, `recurrenceCount` vezes por dia
// weekly  → nos dias da semana em `recurrenceDays` (0 = domingo)
// monthly → nos dias do mês em `recurrenceDays` (31 vira o último dia em meses curtos)
export const isRecurringDueOn = (task, dateKey) => {
  if (!task.isRecurring) return false;
  const date = parseDateKey(dateKey);
  if (!date) return false;
  const days = task.recurrenceDays || [];
  if (task.recurrenceType === 'weekly') return days.length === 0 || days.includes(date.getDay());
  if (task.recurrenceType === 'monthly') {
    if (days.length === 0) return true;
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return days.some((d) => Math.min(d, lastDay) === date.getDate());
  }
  return true;
};

export const recurrenceTarget = (task) => (task.recurrenceType === 'daily' ? Math.max(1, task.recurrenceCount || 1) : 1);

// Progresso de hoje: zera sozinho quando o dia muda, sem precisar mexer nos dados salvos
export const recurrenceProgress = (task, todayKey) =>
  task.lastCompletedDate === todayKey ? Math.min(task.recurrenceCurrent || 0, recurrenceTarget(task)) : 0;

export const isTaskDone = (task, todayKey) =>
  task.isRecurring ? recurrenceProgress(task, todayKey) >= recurrenceTarget(task) : Boolean(task.completed);

// Data em que a tarefa foi concluída (para o filtro "Hoje")
const completedOn = (task) => {
  if (task.isRecurring) return task.lastCompletedDate || null;
  if (!task.completed) return null;
  if (task.completedAt) return toDateKey(new Date(task.completedAt));
  return task.updatedAt ? toDateKey(new Date(task.updatedAt)) : null;
};

export const isCompletedToday = (task, todayKey) => isTaskDone(task, todayKey) && completedOn(task) === todayKey;

// Situação do prazo: overdue / today / tomorrow / soon / later
export const getDueInfo = (task, todayKey, now = new Date()) => {
  if (!task.dueDate) return null;
  const diff = daysBetween(todayKey, task.dueDate);
  if (diff === null) return null;
  let status;
  if (diff < 0) status = 'overdue';
  else if (diff === 0) {
    status = 'today';
    if (task.dueTime) {
      const [h, m] = task.dueTime.split(':').map(Number);
      const due = parseDateKey(task.dueDate);
      due.setHours(h || 0, m || 0, 0, 0);
      if (now > due) status = 'overdue';
    }
  } else if (diff === 1) status = 'tomorrow';
  else if (diff <= 7) status = 'soon';
  else status = 'later';
  return { diff, status };
};

const normalizeTask = (t) => {
  const nowIso = new Date().toISOString();
  return {
    id: t.id || uid('task'),
    title: t.title || 'Tarefa sem nome',
    description: t.description || '',
    completed: Boolean(t.completed),
    completedAt: t.completedAt || null,
    dueDate: t.dueDate || '',
    dueTime: t.dueTime || '',
    createdAt: t.createdAt || nowIso,
    updatedAt: t.updatedAt || nowIso,
    isRecurring: Boolean(t.isRecurring),
    recurrenceType: t.recurrenceType || 'daily',
    recurrenceCount: Math.max(1, parseInt(t.recurrenceCount, 10) || 1),
    recurrenceInterval: t.recurrenceInterval || 1,
    recurrenceDays: Array.isArray(t.recurrenceDays) ? t.recurrenceDays : [],
    recurrenceCurrent: t.recurrenceCurrent || 0,
    lastCompletedDate: t.lastCompletedDate || null
  };
};

// Cada perfil tem as próprias listas (antes eram as mesmas para todos)
const loadLists = (profileId) => {
  try {
    const saved = readProfileValue(STORAGE_KEY_LISTS, profileId, null);
    if (!Array.isArray(saved) || saved.length === 0) return DEFAULT_LISTS;
    return saved.map((list) => ({
      id: list.id || uid('list'),
      title: list.title || 'Lista',
      tasks: Array.isArray(list.tasks) ? list.tasks.map(normalizeTask) : []
    }));
  } catch (e) {
    return DEFAULT_LISTS;
  }
};

const DEFAULT_VIEW = { filter: 'pending', sort: 'manual', showCompleted: false };
const sanitizeView = (raw) => {
  try {
    const v = raw || {};
    return {
      filter: ['pending', 'today', 'all'].includes(v.filter) ? v.filter : 'pending',
      sort: ['manual', 'due', 'az', 'recent'].includes(v.sort) ? v.sort : 'manual',
      showCompleted: Boolean(v.showCompleted)
    };
  } catch (e) {
    return { filter: 'pending', sort: 'manual', showCompleted: false };
  }
};

export function useTaskUpdate(profileId) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);

  const [language, setLanguage] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LANG);
      return saved && ['pt', 'en', 'es'].includes(saved) ? saved : 'pt';
    } catch (e) {
      return 'pt';
    }
  });

  // Histórico de desfazer/refazer num único estado (sem setState dentro de setState)
  // `pid` = perfil dono destas listas; ao trocar de perfil, carrega as dele
  const [history, setHistory] = useState(() => ({ pid: profileId, past: [], present: loadLists(profileId), future: [] }));
  let effectiveHistory = history;
  if (history.pid !== profileId) {
    effectiveHistory = { pid: profileId, past: [], present: loadLists(profileId), future: [] };
    setHistory(effectiveHistory);
  }
  const taskLists = effectiveHistory.present;

  const [activeListId, setActiveListId] = useState(() => history.present[0]?.id || 'list_default');
  const [rawView, setView] = useProfileStoredState(STORAGE_KEY_VIEW, profileId, DEFAULT_VIEW);
  const view = sanitizeView(rawView);

  // "Hoje" no fuso local; atualiza sozinho na virada do dia
  const [todayKey, setTodayKey] = useState(() => toDateKey());
  useEffect(() => {
    const refresh = () => setTodayKey(toDateKey());
    const interval = setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  // Aviso de "desfazer" depois de excluir algo
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const showToast = useCallback((message) => {
    clearTimeout(toastTimerRef.current);
    setToast({ message, id: Date.now() });
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  }, []);
  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  useEffect(() => {
    writeProfileValue(STORAGE_KEY_LISTS, history.pid, history.present);
  }, [history.pid, history.present]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LANG, language);
    } catch (e) {}
  }, [language]);

  // Se a lista ativa sumir (excluída ou desfeita), volta para a primeira
  const resolvedActiveId = taskLists.some((l) => l.id === activeListId) ? activeListId : taskLists[0]?.id;
  const currentList = taskLists.find((l) => l.id === resolvedActiveId) || taskLists[0];

  const applyChange = useCallback((updater) => {
    setHistory((h) => {
      const next = updater(h.present);
      if (next === h.present) return h;
      return { ...h, past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: [] };
    });
  }, []);

  // Desfazer/refazer agora é o global do programa (vale para qualquer ação)
  const globalHistory = useGlobalUndo();
  const undo = useCallback(() => {
    globalUndo();
    setToast(null);
  }, []);
  const redo = useCallback(() => globalRedo(), []);
  const { canUndo, canRedo } = globalHistory;

  // Quando o Ctrl+Z global devolve as listas, recarrega daqui
  useUndoRestore(
    (k) => k === `${STORAGE_KEY_LISTS}__${effectiveHistory.pid}`,
    () => setHistory((h) => ({ ...h, past: [], future: [], present: loadLists(h.pid) }))
  );

  const toggleModal = useCallback(() => setIsOpen((prev) => !prev), []);

  // Função que fecha o editor de tarefa aberto (definida pelo modal)
  const escapeRef = useRef(null);

  // Este listener é registrado antes do atalho global do App, então consegue
  // "consumir" teclas enquanto o modal está aberto (stopImmediatePropagation).
  useEffect(() => {
    const handleKeyDown = (e) => {
      const el = document.activeElement;
      const isEditingText =
        el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      const key = e.key ? e.key.toLowerCase() : '';
      const mod = e.ctrlKey || e.metaKey;

      if (isOpen && e.key === 'Escape') {
        // Antes o Esc abria as Configurações por cima do Checklist
        e.preventDefault();
        e.stopImmediatePropagation();
        if (escapeRef.current) escapeRef.current();
        else if (isEditingText) el.blur();
        else setIsOpen(false);
        return;
      }

      if (!isEditingText && key === 't' && !mod && !e.altKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        toggleModal();
        return;
      }

      if (!isOpen || isEditingText) return;

      if (mod && key === 'z' && !e.shiftKey) {
        // Sem isso, o Ctrl+Z também desfazia mudanças nas habilidades
        e.preventDefault();
        e.stopImmediatePropagation();
        undo();
      } else if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        e.stopImmediatePropagation();
        redo();
      } else if (!mod && !e.altKey && key.length === 1) {
        // Atalhos de letra do app (C, P, M, Espaço...) não abrem outras janelas por baixo
        e.stopImmediatePropagation();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, toggleModal, undo, redo]);

  // ---------- Listas ----------
  const addList = (title) => {
    const newList = { id: uid('list'), title: (title || '').trim() || 'Nova lista', tasks: [] };
    applyChange((prev) => [...prev, newList]);
    setActiveListId(newList.id);
  };

  const renameList = (listId, title) => {
    const clean = (title || '').trim();
    if (!clean) return;
    applyChange((prev) => prev.map((l) => (l.id === listId ? { ...l, title: clean } : l)));
  };

  const removeList = (listId) => {
    if (taskLists.length <= 1) return;
    const list = taskLists.find((l) => l.id === listId);
    applyChange((prev) => prev.filter((l) => l.id !== listId));
    if (list) showToast(tx('Lista “{name}” excluída', { name: list.title }));
  };

  const moveList = (fromId, toId) => {
    if (!fromId || fromId === toId) return;
    applyChange((prev) => {
      const from = prev.findIndex((l) => l.id === fromId);
      const to = prev.findIndex((l) => l.id === toId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  // ---------- Tarefas (sempre pelo id, nunca pela posição na tela) ----------
  const updateTasksOfList = (listId, fn) =>
    applyChange((prev) => prev.map((l) => (l.id === listId ? { ...l, tasks: fn(l.tasks) } : l)));

  const addTask = (title, extra = {}) => {
    const clean = (title || '').trim();
    if (!clean || !currentList) return;
    const nowIso = new Date().toISOString();
    const task = normalizeTask({ ...extra, id: uid('task'), title: clean, createdAt: nowIso, updatedAt: nowIso });
    updateTasksOfList(currentList.id, (tasks) => [...tasks, task]);
  };

  const toggleTask = (taskId) => {
    if (!currentList) return;
    const nowIso = new Date().toISOString();
    updateTasksOfList(currentList.id, (tasks) =>
      tasks.map((t) => {
        if (t.id !== taskId) return t;
        if (t.isRecurring) {
          const target = recurrenceTarget(t);
          const progress = recurrenceProgress(t, todayKey);
          // Concluída hoje → clicar de novo desmarca (antes ficava travada)
          const nextProgress = progress >= target ? 0 : progress + 1;
          return {
            ...t,
            recurrenceCurrent: nextProgress,
            completed: nextProgress >= target,
            lastCompletedDate: nextProgress > 0 ? todayKey : null,
            updatedAt: nowIso
          };
        }
        const completed = !t.completed;
        return {
          ...t,
          completed,
          completedAt: completed ? nowIso : null,
          lastCompletedDate: completed ? todayKey : null,
          updatedAt: nowIso
        };
      })
    );
  };

  const updateTask = (taskId, fields) => {
    if (!currentList) return;
    const nowIso = new Date().toISOString();
    updateTasksOfList(currentList.id, (tasks) =>
      tasks.map((t) => (t.id === taskId ? normalizeTask({ ...t, ...fields, updatedAt: nowIso }) : t))
    );
  };

  const removeTask = (taskId) => {
    if (!currentList) return;
    const task = currentList.tasks.find((t) => t.id === taskId);
    updateTasksOfList(currentList.id, (tasks) => tasks.filter((t) => t.id !== taskId));
    if (task) showToast(tx('Tarefa “{name}” excluída', { name: task.title }));
  };

  const clearCompleted = () => {
    if (!currentList) return;
    const count = currentList.tasks.filter((t) => !t.isRecurring && t.completed).length;
    if (count === 0) return;
    updateTasksOfList(currentList.id, (tasks) => tasks.filter((t) => t.isRecurring || !t.completed));
    showToast(tx('{n} tarefa(s) concluída(s) removida(s)', { n: count }));
  };

  const moveTask = (fromId, toId) => {
    if (!currentList || !fromId || fromId === toId) return;
    updateTasksOfList(currentList.id, (tasks) => {
      const from = tasks.findIndex((t) => t.id === fromId);
      const to = tasks.findIndex((t) => t.id === toId);
      if (from < 0 || to < 0) return tasks;
      const next = [...tasks];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  // ---------- Resumo para o alerta e o badge ----------
  const tasksDue = useMemo(() => {
    let overdueCount = 0;
    let todayCount = 0;
    let tomorrowCount = 0;
    const now = new Date();
    taskLists.forEach((list) =>
      list.tasks.forEach((task) => {
        if (task.isRecurring) {
          if (isRecurringDueOn(task, todayKey) && !isTaskDone(task, todayKey)) todayCount++;
          return;
        }
        if (task.completed) return;
        const info = getDueInfo(task, todayKey, now);
        if (!info) return;
        if (info.status === 'overdue') overdueCount++;
        else if (info.status === 'today') todayCount++;
        else if (info.status === 'tomorrow') tomorrowCount++;
      })
    );
    return { overdueCount, todayCount, tomorrowCount };
  }, [taskLists, todayKey]);

  return {
    isOpen,
    setIsOpen,
    toggleModal,
    taskLists,
    activeListId: resolvedActiveId,
    setActiveListId,
    currentList,
    addList,
    renameList,
    removeList,
    moveList,
    addTask,
    toggleTask,
    updateTask,
    removeTask,
    clearCompleted,
    moveTask,
    undo,
    redo,
    canUndo,
    canRedo,
    escapeRef,
    toast,
    dismissToast: () => setToast(null),
    view,
    setView,
    todayKey,
    language,
    setLanguage,
    tasksDue,
    isAlertDismissed,
    setIsAlertDismissed
  };
}
