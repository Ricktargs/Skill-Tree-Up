import React, { useState, useEffect, useRef } from 'react';
import { tx, getLocale } from '../i18n/index.jsx';
import './TaskUpdate.css';
import {
  toDateKey,
  parseDateKey,
  getDueInfo,
  isTaskDone,
  isCompletedToday,
  isRecurringDueOn,
  recurrenceProgress,
  recurrenceTarget
} from './TaskUpdate.js';

// Nomes dos dias vêm do próprio navegador, no idioma escolhido (0 = domingo)
const weekdayName = (value, style) =>
  new Intl.DateTimeFormat(getLocale(), { weekday: style }).format(new Date(2023, 0, 1 + value)).replace('.', '');
const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6].map((value) => ({
  value,
  get short() {
    return weekdayName(value, 'narrow');
  },
  get name() {
    return weekdayName(value, 'short');
  }
}));

const SORT_OPTIONS = [
  { value: 'manual', label: 'Ordem manual' },
  { value: 'due', label: 'Prazo' },
  { value: 'az', label: 'A – Z' },
  { value: 'recent', label: 'Mais recentes' }
];

const formatDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(getLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatShortDate = (dateKey) => {
  const d = parseDateKey(dateKey);
  if (!d) return '';
  return d.toLocaleDateString(getLocale(), { day: '2-digit', month: 'short' }).replace('.', '');
};

const addDays = (dateKey, n) => {
  const d = parseDateKey(dateKey);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
};

// Texto do prazo exibido no chip da tarefa
const dueLabel = (task, info) => {
  if (!info) return null;
  const time = task.dueTime ? ` · ${task.dueTime}` : '';
  switch (info.status) {
    case 'overdue':
      return info.diff < 0 ? tx('Atrasada {n}d', { n: Math.abs(info.diff) }) : `${tx('Atrasada')}${time}`;
    case 'today':
      return `${tx('Hoje')}${time}`;
    case 'tomorrow':
      return `${tx('Amanhã')}${time}`;
    default:
      return `${formatShortDate(task.dueDate)}${time}`;
  }
};

// Momento exato do prazo (sem horário = fim do dia)
const dueMoment = (task) => {
  const d = parseDateKey(task.dueDate);
  if (!d) return null;
  if (task.dueTime) {
    const [h, m] = task.dueTime.split(':').map(Number);
    d.setHours(h || 0, m || 0, 0, 0);
  } else d.setHours(23, 59, 59, 999);
  return d;
};

// Quando foi concluída (tarefas antigas não têm completedAt; usa a última modificação)
const completionDate = (task) => {
  const iso = task.completedAt || task.updatedAt;
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d.getTime()) ? d : null;
};

// Prazo de uma tarefa já concluída: fica "travado" no momento da conclusão
const doneDueChip = (task) => {
  const due = dueMoment(task);
  const at = completionDate(task);
  if (!due || !at) return null;
  const lateMs = at - due;
  if (lateMs <= 0) return { cls: 'ontime', text: `✓ ${tx('No prazo')} · ${formatShortDate(task.dueDate)}` };
  const hours = Math.floor(lateMs / 3600000);
  const days = Math.floor(hours / 24);
  const late = days >= 1 ? `${days}d` : hours >= 1 ? `${hours}h` : `${Math.max(1, Math.round(lateMs / 60000))}min`;
  return { cls: 'late', text: `✓ ${tx('Concluída com {late} de atraso', { late })}` };
};

// Resumo da repetição: "Todo dia", "Seg, Qua, Sex", "Dia 5 e 20"...
const recurrenceLabel = (task) => {
  if (!task.isRecurring) return null;
  const days = task.recurrenceDays || [];
  if (task.recurrenceType === 'weekly') {
    if (days.length === 0 || days.length === 7) return tx('Todo dia');
    return WEEK_DAYS.filter((d) => days.includes(d.value)).map((d) => d.name).join(', ');
  }
  if (task.recurrenceType === 'monthly') {
    if (days.length === 0) return tx('Todo dia');
    const sorted = [...days].sort((a, b) => a - b);
    return tx('Dia {list}', { list: sorted.join(', ') });
  }
  const n = recurrenceTarget(task);
  return n > 1 ? `${tx('Todo dia')} · ${n}x` : tx('Todo dia');
};

// Ordenação "Prazo": atrasadas primeiro, depois por data/hora, sem data no fim
const dueSortValue = (task) => {
  if (!task.dueDate) return Number.MAX_SAFE_INTEGER;
  const d = parseDateKey(task.dueDate);
  if (task.dueTime) {
    const [h, m] = task.dueTime.split(':').map(Number);
    d.setHours(h || 0, m || 0);
  } else d.setHours(23, 59);
  return d.getTime();
};

const sortTasks = (tasks, sort) => {
  const copy = [...tasks];
  if (sort === 'az') return copy.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  if (sort === 'recent') return copy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (sort === 'due') return copy.sort((a, b) => dueSortValue(a) - dueSortValue(b));
  return copy;
};

// =========================================================
// LINHA DE TAREFA
// =========================================================
function TaskRow({ task, todayKey, draggable, dragState, onToggle, onEdit, onDelete, onMove, playSound }) {
  // `draggable` = pode reordenar; arrastar para outra lista funciona sempre
  const done = isTaskDone(task, todayKey);
  // Pendente: prazo em relação a agora. Concluída: prazo congelado na conclusão.
  const info = task.isRecurring || done ? null : getDueInfo(task, todayKey);
  const doneChip = !task.isRecurring && done && task.dueDate ? doneDueChip(task) : null;
  const target = recurrenceTarget(task);
  const progress = task.isRecurring ? recurrenceProgress(task, todayKey) : 0;
  const notToday = task.isRecurring && !isRecurringDueOn(task, todayKey) && !done;
  const isDragOver = dragState.overId === task.id && dragState.draggingId !== task.id;

  return (
    <div
      className={`ck-task ${done ? 'done' : ''} ${info?.status === 'overdue' && !done ? 'overdue' : ''} ${notToday ? 'dim' : ''} ${isDragOver ? 'drag-over' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        try {
          e.dataTransfer.setData('text/plain', task.title);
        } catch (err) {
          // alguns navegadores não aceitam dados no arraste
        }
        dragState.setDraggingId(task.id);
      }}
      onDragOver={(e) => {
        if (!draggable) return;
        e.preventDefault();
        dragState.setOverId(task.id);
      }}
      onDragEnd={() => {
        dragState.setDraggingId(null);
        dragState.setOverId(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onMove(dragState.draggingId, task.id);
        dragState.setDraggingId(null);
        dragState.setOverId(null);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onEdit(task);
      }}
    >
      <span className="ck-handle" title={draggable ? tx('Arraste para reordenar ou solte numa lista para mover') : tx('Arraste até uma lista para mover')}>⠿</span>

      <button
        type="button"
        className={`ck-check ${done ? 'checked' : ''} ${target > 1 && progress > 0 && !done ? 'partial' : ''}`}
        onClick={() => {
          if (playSound) playSound(done ? 'click' : 'train');
          onToggle(task.id);
        }}
        title={done ? tx("Desmarcar") : target > 1 ? tx('Marcar ({p}/{t} hoje)', { p: progress, t: target }) : tx("Concluir")}
        style={target > 1 && !done ? { '--ck-progress': `${(progress / target) * 360}deg` } : undefined}
      >
        {done ? '✓' : target > 1 && progress > 0 ? progress : ''}
      </button>

      <div className="ck-task-body" onClick={() => onEdit(task)} title={tx("Clique para editar")}>
        <span className="ck-task-title">{task.title}</span>
        {task.description && <span className="ck-task-desc">{task.description}</span>}
        {(info || doneChip || task.isRecurring) && (
          <div className="ck-chips">
            {info && <span className={`ck-chip due ${info.status}`}>📅 {dueLabel(task, info)}</span>}
            {doneChip && <span className={`ck-chip done-due ${doneChip.cls}`}>{doneChip.text}</span>}
            {task.isRecurring && (
              <span className="ck-chip repeat">
                🔁 {recurrenceLabel(task)}
                {target > 1 && ` · ${progress}/${target}`}
              </span>
            )}
            {notToday && <span className="ck-chip muted">{tx("Não é hoje")}</span>}
          </div>
        )}
      </div>

      <div className="ck-task-actions">
        <button type="button" className="ck-icon-btn" onClick={() => onEdit(task)} title={tx("Editar")}>
          ✏️
        </button>
        <button
          type="button"
          className="ck-icon-btn danger"
          onClick={() => {
            if (playSound) playSound('delete');
            onDelete(task.id);
          }}
          title={tx("Excluir")}
        >
          🗑
        </button>
      </div>
    </div>
  );
}

// =========================================================
// EDITOR DE TAREFA (criar com detalhes ou editar)
// =========================================================
function TaskEditor({ initial, isNew, todayKey, onSave, onDelete, onClose, playSound, lists = [], listId = null }) {
  const [targetListId, setTargetListId] = useState(listId);
  const [draft, setDraft] = useState(() => ({
    title: '',
    description: '',
    dueDate: '',
    dueTime: '',
    isRecurring: false,
    recurrenceType: 'daily',
    recurrenceCount: 1,
    recurrenceDays: [],
    ...initial
  }));
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const set = (fields) => setDraft((d) => ({ ...d, ...fields }));
  const click = () => playSound && playSound('click');

  const save = () => {
    if (!draft.title.trim()) {
      titleRef.current?.focus();
      return;
    }
    if (playSound) playSound('train');
    onSave({
      title: draft.title.trim(),
      description: (draft.description || '').trim(),
      dueDate: draft.isRecurring ? '' : draft.dueDate,
      dueTime: draft.isRecurring ? '' : draft.dueTime,
      isRecurring: draft.isRecurring,
      recurrenceType: draft.recurrenceType,
      recurrenceCount: Math.max(1, parseInt(draft.recurrenceCount, 10) || 1),
      recurrenceDays: draft.recurrenceType === 'daily' ? [] : draft.recurrenceDays,
      listId: targetListId
    });
  };

  const toggleDay = (value) => {
    click();
    const days = draft.recurrenceDays || [];
    set({ recurrenceDays: days.includes(value) ? days.filter((d) => d !== value) : [...days, value].sort((a, b) => a - b) });
  };

  const setRepeat = (type) => {
    click();
    if (type === 'none') return set({ isRecurring: false });
    const keepDays = draft.isRecurring && draft.recurrenceType === type;
    const today = parseDateKey(todayKey);
    set({
      isRecurring: true,
      recurrenceType: type,
      recurrenceDays: keepDays
        ? draft.recurrenceDays
        : type === 'weekly'
        ? [today.getDay()]
        : type === 'monthly'
        ? [today.getDate()]
        : []
    });
  };

  const repeatMode = draft.isRecurring ? draft.recurrenceType : 'none';
  const dueInfo = !draft.isRecurring && draft.dueDate ? getDueInfo(draft, todayKey) : null;

  const quickDates = [
    { label: 'Hoje', value: todayKey },
    { label: 'Amanhã', value: addDays(todayKey, 1) },
    { label: 'Em 1 semana', value: addDays(todayKey, 7) }
  ];

  return (
    <div className="modal-backdrop ck-editor-backdrop" onClick={onClose}>
      <div
        className="modal-window ck-editor"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            save();
          }
        }}
      >
        <div className="ck-header">
          <h3>{isNew ? tx("✨ Nova tarefa") : tx("✏️ Editar tarefa")}</h3>
          <button type="button" className="ck-icon-btn close" onClick={onClose} title={tx("Fechar (Esc)")}>
            ✕
          </button>
        </div>

        <div className="ck-editor-body">
          <input
            ref={titleRef}
            className="ck-input ck-title-input"
            type="text"
            placeholder={tx("Nome da tarefa")}
            value={draft.title}
            onChange={(e) => set({ title: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && !e.ctrlKey && !e.metaKey && save()}
          />
          <textarea
            className="ck-input"
            rows={3}
            placeholder={tx("Descrição ou notas (opcional)")}
            value={draft.description || ''}
            onChange={(e) => set({ description: e.target.value })}
          />

          {/* Mover para outra lista (também dá para arrastar a tarefa até a lista) */}
          {!isNew && lists.length > 1 && (
            <div className="ck-field">
              <span className="ck-label">{tx('Lista')}</span>
              <select
                className="ck-input"
                value={targetListId || ''}
                onChange={(e) => {
                  click();
                  setTargetListId(e.target.value);
                }}
              >
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {tx(l.title)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Repetição */}
          <div className="ck-field">
            <span className="ck-label">{tx("Repetir")}</span>
            <div className="ck-segmented">
              {[
                ['none', 'Não'],
                ['daily', 'Diária'],
                ['weekly', 'Semanal'],
                ['monthly', 'Mensal']
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={repeatMode === value ? 'active' : ''}
                  onClick={() => setRepeat(value)}
                >
                  {tx(label)}
                </button>
              ))}
            </div>

            {repeatMode === 'daily' && (
              <div className="ck-inline">
                <span>{tx("Vezes por dia")}</span>
                <div className="ck-stepper">
                  <button type="button" onClick={() => set({ recurrenceCount: Math.max(1, (draft.recurrenceCount || 1) - 1) })}>
                    −
                  </button>
                  <span>{draft.recurrenceCount || 1}</span>
                  <button type="button" onClick={() => set({ recurrenceCount: Math.min(20, (draft.recurrenceCount || 1) + 1) })}>
                    +
                  </button>
                </div>
              </div>
            )}

            {repeatMode === 'weekly' && (
              <div className="ck-weekdays">
                {WEEK_DAYS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    className={(draft.recurrenceDays || []).includes(d.value) ? 'active' : ''}
                    onClick={() => toggleDay(d.value)}
                    title={d.name}
                  >
                    {d.short}
                  </button>
                ))}
              </div>
            )}

            {repeatMode === 'monthly' && (
              <div className="ck-monthdays">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <button
                    key={day}
                    type="button"
                    className={(draft.recurrenceDays || []).includes(day) ? 'active' : ''}
                    onClick={() => toggleDay(day)}
                  >
                    {day}
                  </button>
                ))}
                <small>{tx("Dias 29–31 caem no último dia em meses mais curtos.")}</small>
              </div>
            )}

            {draft.isRecurring && (
              <small className="ck-hint">
                🔁 {recurrenceLabel({ ...draft, recurrenceCount: draft.recurrenceCount || 1 })}{' '}{tx("— a marcação zera sozinha a cada dia.")}
              </small>
            )}
          </div>

          {/* Prazo (só para tarefas que não repetem) */}
          {!draft.isRecurring && (
            <div className="ck-field">
              <span className="ck-label">{tx("Prazo")}</span>
              <div className="ck-chips">
                {quickDates.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    className={`ck-chip pick ${draft.dueDate === q.value ? 'active' : ''}`}
                    onClick={() => {
                      click();
                      set({ dueDate: q.value });
                    }}
                  >
                    {q.label}
                  </button>
                ))}
                {draft.dueDate && (
                  <button
                    type="button"
                    className="ck-chip pick clear"
                    onClick={() => {
                      click();
                      set({ dueDate: '', dueTime: '' });
                    }}
                  >
                    {tx("Sem prazo")}
                  </button>
                )}
              </div>
              <div className="ck-date-row">
                <input
                  className="ck-input"
                  type="date"
                  value={draft.dueDate || ''}
                  onChange={(e) => set({ dueDate: e.target.value })}
                />
                <input
                  className="ck-input"
                  type="time"
                  value={draft.dueTime || ''}
                  disabled={!draft.dueDate}
                  onChange={(e) => set({ dueTime: e.target.value })}
                  title={draft.dueDate ? tx("Horário (opcional)") : tx("Escolha uma data primeiro")}
                />
              </div>
              {dueInfo && <span className={`ck-due-preview ${dueInfo.status}`}>{dueLabel(draft, dueInfo)}</span>}
            </div>
          )}

          {!isNew && (
            <div className="ck-meta">
              <span>{tx("Criada em")}{' '}{formatDateTime(initial.createdAt)}</span>
              <span>{tx("Modificada em")}{' '}{formatDateTime(initial.updatedAt)}</span>
            </div>
          )}
        </div>

        <div className="ck-editor-footer">
          {!isNew ? (
            <button
              type="button"
              className="ck-btn danger"
              onClick={() => {
                if (playSound) playSound('delete');
                onDelete();
              }}
            >
              {tx("🗑 Excluir")}
            </button>
          ) : (
            <span className="ck-hint">{tx("Ctrl+Enter para salvar")}</span>
          )}
          <div className="ck-footer-actions">
            <button type="button" className="ck-btn ghost" onClick={onClose}>
              {tx("Cancelar")}
            </button>
            <button type="button" className="ck-btn primary" onClick={save} disabled={!draft.title.trim()}>
              {isNew ? tx("Adicionar") : tx("Salvar")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================
// MODAL PRINCIPAL
// =========================================================
export function TaskModal({ taskState, playSound }) {
  const {
    isOpen,
    taskLists,
    activeListId,
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
    moveTaskToList,
    undo,
    toast,
    dismissToast,
    view,
    setView,
    todayKey,
    toggleModal
  } = taskState;

  const [quickTitle, setQuickTitle] = useState('');
  const [editor, setEditor] = useState(null); // { task, isNew }
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [renamingListId, setRenamingListId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [draggingId, setDraggingId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [draggingListId, setDraggingListId] = useState(null);
  const [taskDropListId, setTaskDropListId] = useState(null);

  // Esc fecha primeiro o editor (se aberto) e só depois o modal
  const { escapeRef } = taskState;
  useEffect(() => {
    escapeRef.current = editor ? () => setEditor(null) : null;
  }, [editor, escapeRef]);

  if (!isOpen) return null;

  const click = (type = 'click') => playSound && playSound(type);
  const close = () => {
    click();
    toggleModal();
  };

  const tasks = currentList?.tasks || [];
  const doneTasks = tasks.filter((t) => isTaskDone(t, todayKey));
  const pendingTasks = tasks.filter((t) => !isTaskDone(t, todayKey));

  // "Hoje": o que vence hoje, está atrasado, repete hoje ou foi concluído hoje
  const isForToday = (t) => {
    if (t.isRecurring) return isRecurringDueOn(t, todayKey) || isCompletedToday(t, todayKey);
    if (isCompletedToday(t, todayKey)) return true;
    if (t.completed) return false;
    const info = getDueInfo(t, todayKey);
    return info && (info.status === 'today' || info.status === 'overdue');
  };
  const todayTasks = tasks.filter(isForToday);

  let visible;
  if (view.filter === 'today') visible = todayTasks;
  else if (view.filter === 'all') visible = tasks;
  else visible = pendingTasks;

  // Pendentes primeiro; concluídas descem (exceto em ordem manual da aba "Todas")
  visible = sortTasks(visible, view.sort);
  if (view.filter !== 'pending') {
    visible = [...visible.filter((t) => !isTaskDone(t, todayKey)), ...visible.filter((t) => isTaskDone(t, todayKey))];
  }
  const completedSection = view.filter === 'pending' ? sortTasks(doneTasks, view.sort) : [];
  const canDrag = view.sort === 'manual';

  const dragState = { draggingId, overId, setDraggingId, setOverId };

  const submitQuickAdd = (e) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    click('train');
    addTask(quickTitle);
    setQuickTitle('');
  };

  const openNewWithDetails = () => {
    click();
    setEditor({ task: { title: quickTitle }, isNew: true });
    setQuickTitle('');
  };

  const listStats = (list) => {
    const total = list.tasks.length;
    const done = list.tasks.filter((t) => isTaskDone(t, todayKey)).length;
    return { total, done, pending: total - done };
  };

  const current = currentList ? listStats(currentList) : { total: 0, done: 0, pending: 0 };

  const renderRow = (task) => (
    <TaskRow
      key={task.id}
      task={task}
      todayKey={todayKey}
      draggable={canDrag}
      dragState={dragState}
      playSound={playSound}
      onToggle={toggleTask}
      onEdit={(t) => {
        click();
        setEditor({ task: t, isNew: false });
      }}
      onDelete={removeTask}
      onMove={moveTask}
    />
  );

  const emptyText =
    view.filter === 'today'
      ? 'Nada para hoje nesta lista. 🎉'
      : view.filter === 'pending' && tasks.length > 0
      ? 'Tudo concluído por aqui! 🎉'
      : 'Lista vazia. Digite acima para adicionar a primeira tarefa.';

  return (
    <>
      <div className="modal-backdrop high-z-backdrop" onClick={close}>
        <div className="modal-window ck-window high-z-window" onClick={(e) => e.stopPropagation()}>
          {/* Cabeçalho */}
          <div className="ck-header">
            <h3>{tx("📋 Checklists")}</h3>
            <div className="ck-header-actions">
              <button type="button" className="ck-icon-btn close" onClick={close} title={tx("Fechar (T)")}>
                ✕
              </button>
            </div>
          </div>

          <div className="ck-body">
            {/* Listas */}
            <aside className="ck-sidebar">
              <span className="ck-side-title">{tx("Listas")}</span>
              <div className="ck-lists">
                {taskLists.map((list) => {
                  const stats = listStats(list);
                  const active = list.id === activeListId;
                  const isTaskTarget = Boolean(draggingId) && !active;
                  return (
                    <div
                      key={list.id}
                      className={`ck-list-item ${active ? 'active' : ''} ${isTaskTarget ? 'task-target' : ''} ${
                        isTaskTarget && taskDropListId === list.id ? 'task-drop' : ''
                      }`}
                      draggable
                      onDragStart={() => setDraggingListId(list.id)}
                      onDragOver={(e) => {
                        if (draggingId && active) return; // a tarefa já está nesta lista
                        e.preventDefault();
                        if (draggingId) setTaskDropListId(list.id);
                      }}
                      onDragLeave={() => setTaskDropListId((cur) => (cur === list.id ? null : cur))}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggingId) {
                          if (moveTaskToList(draggingId, list.id)) click('train');
                          setDraggingId(null);
                          setOverId(null);
                          setTaskDropListId(null);
                          return;
                        }
                        moveList(draggingListId, list.id);
                        setDraggingListId(null);
                      }}
                      onDragEnd={() => setDraggingListId(null)}
                      onClick={() => {
                        if (!active) click();
                        setActiveListId(list.id);
                      }}
                      title={tx('{p} pendente(s) de {t}', { p: stats.pending, t: stats.total })}
                    >
                      <span className="ck-list-name">{tx(list.title)}</span>
                      {stats.pending > 0 && <span className="ck-count">{stats.pending}</span>}
                      <span className="ck-list-bar" style={{ width: `${stats.total ? (stats.done / stats.total) * 100 : 0}%` }} />
                    </div>
                  );
                })}
              </div>

              {isAddingList ? (
                <form
                  className="ck-new-list"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newListTitle.trim()) return;
                    click();
                    addList(newListTitle);
                    setNewListTitle('');
                    setIsAddingList(false);
                  }}
                >
                  <input
                    className="ck-input"
                    autoFocus
                    placeholder={tx("Nome da lista")}
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setIsAddingList(false)}
                    onBlur={() => !newListTitle.trim() && setIsAddingList(false)}
                  />
                </form>
              ) : (
                <button
                  type="button"
                  className="ck-add-list"
                  onClick={() => {
                    click();
                    setIsAddingList(true);
                  }}
                >
                  {tx("＋ Nova lista")}
                </button>
              )}
            </aside>

            {/* Lista ativa */}
            <section className="ck-main">
              <div className="ck-list-head">
                {renamingListId === currentList?.id ? (
                  <form
                    className="ck-rename"
                    onSubmit={(e) => {
                      e.preventDefault();
                      renameList(currentList.id, renameValue);
                      setRenamingListId(null);
                    }}
                  >
                    <input
                      className="ck-input"
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => {
                        renameList(currentList.id, renameValue);
                        setRenamingListId(null);
                      }}
                      onKeyDown={(e) => e.key === 'Escape' && setRenamingListId(null)}
                    />
                  </form>
                ) : (
                  <h4
                    className="ck-list-title"
                    onDoubleClick={() => {
                      setRenameValue(currentList.title);
                      setRenamingListId(currentList.id);
                    }}
                    title={tx("Clique duas vezes para renomear")}
                  >
                    {tx(currentList?.title)}
                  </h4>
                )}
                <div className="ck-list-actions">
                  <button
                    type="button"
                    className="ck-icon-btn"
                    title={tx("Renomear lista")}
                    onClick={() => {
                      click();
                      setRenameValue(currentList.title);
                      setRenamingListId(currentList.id);
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className="ck-icon-btn danger"
                    title={taskLists.length > 1 ? tx("Excluir lista (dá para desfazer)") : tx("Não dá para excluir a única lista")}
                    disabled={taskLists.length <= 1}
                    onClick={() => {
                      click('delete');
                      removeList(currentList.id);
                    }}
                  >
                    🗑
                  </button>
                </div>
              </div>

              <div className="ck-progress">
                <div className="ck-progress-track">
                  <div className="ck-progress-fill" style={{ width: `${current.total ? (current.done / current.total) * 100 : 0}%` }} />
                </div>
                <span>
                  {tx('{done} de {total} concluída(s)', { done: current.done, total: current.total })}
                </span>
              </div>

              {/* Adição rápida */}
              <form className="ck-quick-add" onSubmit={submitQuickAdd}>
                <span className="ck-quick-plus">＋</span>
                <input
                  type="text"
                  placeholder={tx("Adicionar tarefa e apertar Enter…")}
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                />
                <button type="button" className="ck-quick-details" onClick={openNewWithDetails} title={tx("Adicionar com prazo, descrição ou repetição")}>
                  {tx("⚙ Detalhes")}
                </button>
              </form>

              {/* Filtros */}
              <div className="ck-toolbar">
                <div className="ck-segmented">
                  {[
                    ['pending', 'Pendentes', pendingTasks.length],
                    ['today', 'Hoje', todayTasks.filter((t) => !isTaskDone(t, todayKey)).length],
                    ['all', 'Todas', tasks.length]
                  ].map(([value, label, count]) => (
                    <button
                      key={value}
                      type="button"
                      className={view.filter === value ? 'active' : ''}
                      onClick={() => {
                        click();
                        setView((v) => ({ ...v, filter: value }));
                      }}
                    >
                      {tx(label)}
                      <span className="ck-seg-count">{count}</span>
                    </button>
                  ))}
                </div>
                <select
                  className="ck-select"
                  value={view.sort}
                  onChange={(e) => {
                    click();
                    setView((v) => ({ ...v, sort: e.target.value }));
                  }}
                  title={tx("Ordenar")}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      ↕ {tx(o.label)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tarefas */}
              <div className="ck-tasks">
                {visible.length === 0 ? <div className="ck-empty">{emptyText}</div> : visible.map(renderRow)}

                {completedSection.length > 0 && (
                  <div className="ck-completed">
                    <div className="ck-completed-head">
                      <button
                        type="button"
                        className="ck-completed-toggle"
                        onClick={() => {
                          click();
                          setView((v) => ({ ...v, showCompleted: !v.showCompleted }));
                        }}
                      >
                        <span className={`ck-caret ${view.showCompleted ? 'open' : ''}`}>▸</span>
                        {tx("Concluídas (")}{completedSection.length})
                      </button>
                      {view.showCompleted && completedSection.some((t) => !t.isRecurring) && (
                        <button
                          type="button"
                          className="ck-link-btn"
                          onClick={() => {
                            click('delete');
                            clearCompleted();
                          }}
                          title={tx("Remove as tarefas concluídas que não repetem")}
                        >
                          {tx("Limpar concluídas")}
                        </button>
                      )}
                    </div>
                    {view.showCompleted && completedSection.map(renderRow)}
                  </div>
                )}
              </div>
            </section>
          </div>

          {toast && (
            <div className="ck-toast" key={toast.id}>
              <span>{toast.message}</span>
              <button
                type="button"
                onClick={() => {
                  click();
                  undo();
                }}
              >
                {tx("Desfazer")}
              </button>
              <button type="button" className="ck-toast-close" onClick={dismissToast} title={tx("Fechar")}>
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {editor && (
        <TaskEditor
          initial={editor.task}
          isNew={editor.isNew}
          todayKey={todayKey}
          playSound={playSound}
          lists={taskLists}
          listId={currentList?.id}
          onClose={() => setEditor(null)}
          onSave={({ listId, ...fields }) => {
            if (editor.isNew) addTask(fields.title, fields);
            else if (listId && listId !== currentList?.id) moveTaskToList(editor.task.id, listId, fields);
            else updateTask(editor.task.id, fields);
            setEditor(null);
          }}
          onDelete={() => {
            removeTask(editor.task.id);
            setEditor(null);
          }}
        />
      )}
    </>
  );
}

// =========================================================
// ALERTA E BADGE
// =========================================================
export function TaskAlert({ taskState }) {
  const { tasksDue, isAlertDismissed, setIsAlertDismissed, toggleModal, isOpen } = taskState;
  const { overdueCount, todayCount, tomorrowCount } = tasksDue;

  if (isOpen || isAlertDismissed || overdueCount + todayCount + tomorrowCount === 0) return null;

  const parts = [];
  if (overdueCount > 0) parts.push(`${overdueCount} atrasada${overdueCount > 1 ? 's' : ''}`);
  if (todayCount > 0) parts.push(`${todayCount} para hoje`);
  if (tomorrowCount > 0) parts.push(`${tomorrowCount} para amanhã`);

  return (
    <div className={`ck-alert ${overdueCount > 0 ? 'overdue' : todayCount > 0 ? 'today' : ''}`} onClick={toggleModal} title={tx("Abrir checklists")}>
      <span>{tx("📋 Tarefas:")}{' '}{parts.join(' · ')}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsAlertDismissed(true);
        }}
        title={tx("Fechar aviso")}
      >
        ✕
      </button>
    </div>
  );
}

export function TaskBadge({ taskState }) {
  const { overdueCount, todayCount } = taskState.tasksDue;
  const count = overdueCount + todayCount;
  if (count === 0) return null;

  return (
    <span
      className={`subtle-mission-badge ${overdueCount > 0 ? 'ck-badge-overdue' : ''}`}
      title={`${overdueCount > 0 ? `${overdueCount} atrasada(s), ` : ''}${todayCount} para hoje`}
    >
      {count}
    </span>
  );
}
