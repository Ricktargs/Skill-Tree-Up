import React, { useState } from 'react';

const formatDateTime = (isoString) => {
  if (!isoString) return '---';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} às ${hours}:${minutes}`;
};

const getDeadlineStatusText = (dueDateStr) => {
  if (!dueDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr + 'T00:00:00');
  
  const diffTime = due - today;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return { text: 'Vence hoje', color: '#facc15' };
  } else if (diffDays === 1) {
    return { text: 'Falta 1 dia', color: '#38bdf8' };
  } else if (diffDays > 1) {
    return { text: `Faltam ${diffDays} dias`, color: '#38bdf8' };
  } else if (diffDays === -1) {
    return { text: 'Atrasado 1 dia', color: '#f87171' };
  } else {
    return { text: `Atrasado ${Math.abs(diffDays)} dias`, color: '#f87171' };
  }
};

export function TaskModal({ taskState, playSound }) {
  const [newListTitle, setNewListTitle] = useState('');
  const [isAddingList, setIsAddingList] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [sortOrder, setSortOrder] = useState('antigos');
  const [showOnlyCompletedToday, setShowOnlyCompletedToday] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(true);
  const [showCompletedAccordion, setShowCompletedAccordion] = useState(false);
  
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDueTime, setNewDueTime] = useState('');

  if (!taskState.isOpen) return null;

  const {
    taskLists,
    activeListId,
    setActiveListId,
    addList,
    removeList,
    currentList,
    addTask,
    toggleTask,
    updateTask,
    removeTask,
    handleListDragStart,
    handleListDrop,
    handleTaskDragStart,
    handleTaskDrop,
    toggleModal
  } = taskState;

  const handleCreateListSubmit = (e) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;
    if (playSound) playSound('click');
    addList(newListTitle.trim());
    setNewListTitle('');
    setIsAddingList(false);
  };

  const handleAddTaskSubmit = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    if (playSound) playSound('train');
    addTask(newTitle.trim(), newDueDate, newDueTime, newDescription);
    setNewTitle('');
    setNewDescription('');
    setNewDueDate('');
    setNewDueTime('');
    setIsAddTaskModalOpen(false);
  };

  const getSortedTasks = (taskList) => {
    const copy = [...taskList];
    switch (sortOrder) {
      case 'az':
        return copy.sort((a, b) => a.title.localeCompare(b.title));
      case 'za':
        return copy.sort((a, b) => b.title.localeCompare(a.title));
      case 'data':
        return copy.sort((a, b) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate) - new Date(b.dueDate);
        });
      case 'ultimos':
        return copy.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      case 'antigos':
      default:
        return copy.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    }
  };

  const isCompletedInLast24Hours = (task) => {
    if (!task.completed || !task.updatedAt) return false;
    const taskDate = new Date(task.updatedAt);
    const now = new Date();
    const diffInHours = (now - taskDate) / (1000 * 60 * 60);
    return diffInHours >= 0 && diffInHours <= 24;
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const getIsDone = (task) => {
    return task.isRecurring 
      ? (task.completed && task.lastCompletedDate === todayStr) 
      : task.completed;
  };

  const renderTaskCard = (task, index) => {
    const deadlineInfo = getDeadlineStatusText(task.dueDate);
    const isDone = getIsDone(task);

    return (
      <div
        key={task.id}
        draggable
        onDragStart={() => handleTaskDragStart(index)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleTaskDrop(index);
        }}
        onClick={() => {
          if (task.isRecurring && isDone) return;
          if (playSound) playSound('click');
          toggleTask(task.id);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (playSound) playSound('click');
          setEditingTask({ ...task, monthOffset: task.monthOffset || 0 });
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '390px',
          height: '54px',
          minHeight: '54px',
          maxHeight: '54px',
          padding: '0.45rem 0.65rem',
          boxSizing: 'border-box',
          background: isDone ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.04)',
          border: isDone ? '1px solid var(--theme-accent, #38bdf8)' : '1px solid var(--theme-border, #334155)',
          boxShadow: isDone ? '0 0 12px rgba(56, 189, 248, 0.45), inset 0 0 6px rgba(56, 189, 248, 0.2)' : 'none',
          borderRadius: '7px',
          cursor: (task.isRecurring && isDone) ? 'default' : 'pointer',
          userSelect: 'none',
          overflow: 'hidden',
          transition: 'all 0.2s ease'
        }}
        title={task.isRecurring && isDone ? "Concluído hoje (travado)" : "Clique esquerdo: Concluir/Desmarcar | Botão ✏️ ou Clique direito: Editar"}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flex: 1, minWidth: 0 }}>
          <span style={{ color: isDone ? '#38bdf8' : '#64748b', fontSize: '0.85rem' }} title="Arraste para reordenar">⠿</span>
          <input
            type="checkbox"
            checked={isDone}
            onChange={() => {}}
            style={{ width: '15px', height: '15px', cursor: (task.isRecurring && isDone) ? 'default' : 'pointer', accentColor: 'var(--theme-accent, #38bdf8)', flexShrink: 0 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', flex: 1, minWidth: 0, justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: '0.88rem',
                  color: isDone ? '#38bdf8' : '#f8fafc',
                  textDecoration: isDone ? 'line-through' : 'none',
                  textShadow: isDone ? '0 0 6px rgba(56, 189, 248, 0.7)' : 'none',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontWeight: isDone ? 'bold' : '500'
                }}
              >
                {task.title}
              </span>
              
              {task.isRecurring && (
                <span style={{ 
                  fontSize: '0.68rem', 
                  background: 'rgba(56, 189, 248, 0.15)', 
                  color: '#38bdf8', 
                  border: '1px solid rgba(56, 189, 248, 0.3)', 
                  padding: '0.1rem 0.4rem', 
                  borderRadius: '6px', 
                  marginLeft: '0.5rem', 
                  whiteSpace: 'nowrap',
                  fontWeight: 'bold'
                }}>
                  🔁 {task.recurrenceCurrent || 0}/{task.recurrenceType === 'daily' ? (task.recurrenceCount || 1) : 1} {isDone ? '🔒' : ''}
                </span>
              )}
            </div>
            
            {task.description && (
              <span style={{ fontSize: '0.74rem', color: isDone ? '#7dd3fc' : '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {task.description}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, marginLeft: '0.4rem' }}>
          {task.dueDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.08)', padding: '0.12rem 0.45rem', borderRadius: '4px', fontSize: '0.72rem' }}>
              {deadlineInfo && (
                <span style={{ color: deadlineInfo.color, fontWeight: 'bold' }}>
                  ({deadlineInfo.text})
                </span>
              )}
              <span style={{ color: '#cbd5e1' }}>
                📅 {task.dueDate.split('-').reverse().join('/')}
              </span>
            </div>
          )}
          
          {/* BOTÃO DE EDITAR TAREFA */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (playSound) playSound('click');
              setEditingTask({ ...task, monthOffset: task.monthOffset || 0 });
            }}
            style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '0.85rem', padding: '0.15rem' }}
            title="Editar tarefa"
          >
            ✏️
          </button>

          {/* BOTÃO DE EXCLUIR TAREFA */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (playSound) playSound('delete');
              removeTask(task.id);
            }}
            style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.9rem', padding: '0.15rem' }}
            title="Excluir tarefa"
          >
            ✕
          </button>
        </div>
      </div>
    );
  };

  const tasks = currentList?.tasks || [];
  const sortedTasks = getSortedTasks(tasks);

  let activeTasks = sortedTasks;

  if (showOnlyCompletedToday) {
    activeTasks = sortedTasks.filter(isCompletedInLast24Hours);
  } else if (hideCompleted) {
    activeTasks = sortedTasks.filter((t) => !getIsDone(t));
  }

  const completedTasks = sortedTasks.filter((t) => getIsDone(t));

  const taskChunks = [];
  for (let i = 0; i < activeTasks.length; i += 10) {
    taskChunks.push(activeTasks.slice(i, i + 10));
  }

  const completedChunks = [];
  for (let i = 0; i < completedTasks.length; i += 10) {
    completedChunks.push(completedTasks.slice(i, i + 10));
  }

  const todayDayOfWeek = new Date().getDay();
  const baseWeekDays = [
    { label: 'D', value: 0, name: 'Domingo' },
    { label: 'S', value: 1, name: 'Segunda-feira' },
    { label: 'T', value: 2, name: 'Terça-feira' },
    { label: 'Q', value: 3, name: 'Quarta-feira' },
    { label: 'Q', value: 4, name: 'Quinta-feira' },
    { label: 'S', value: 5, name: 'Sexta-feira' },
    { label: 'S', value: 6, name: 'Sábado' }
  ];
  const orderedWeekDays = [
    ...baseWeekDays.slice(todayDayOfWeek),
    ...baseWeekDays.slice(0, todayDayOfWeek)
  ];

  const currentBaseDate = new Date();
  const monthOffset = editingTask?.monthOffset || 0;
  const targetDate = new Date(currentBaseDate.getFullYear(), currentBaseDate.getMonth() + monthOffset, 1);
  const targetMonthName = targetDate.toLocaleString('pt-BR', { month: 'long' });
  const targetYear = targetDate.getFullYear();
  const daysInTargetMonth = new Date(targetYear, targetDate.getMonth() + 1, 0).getDate();
  const monthDays = Array.from({ length: daysInTargetMonth }, (_, i) => i + 1);

  const toggleRecurrenceDay = (dayValue) => {
    if (playSound) playSound('click');
    const currentDays = editingTask.recurrenceDays || [];
    if (currentDays.includes(dayValue)) {
      setEditingTask({ ...editingTask, recurrenceDays: currentDays.filter(d => d !== dayValue) });
    } else {
      setEditingTask({ ...editingTask, recurrenceDays: [...currentDays, dayValue].sort((a,b)=>a-b) });
    }
  };

  const calculateDaysWithInterval = (count, interval, type) => {
    const pool = type === 'weekly' ? orderedWeekDays.map(d => d.value) : monthDays;
    const selected = [];
    let currentIndex = 0;

    for (let i = 0; i < count && selected.length < pool.length; i++) {
      const idx = currentIndex % pool.length;
      selected.push(pool[idx]);
      currentIndex += interval;
    }
    return selected.sort((a, b) => a - b);
  };

  const handleRecurrenceCountChange = (newCount) => {
    const count = Math.max(1, parseInt(newCount) || 1);
    const interval = editingTask.recurrenceInterval || 1;
    const type = editingTask.recurrenceType || 'weekly';

    const updatedDays = calculateDaysWithInterval(count, interval, type);

    setEditingTask({
      ...editingTask,
      recurrenceCount: count,
      recurrenceDays: updatedDays
    });
  };

  const handleRecurrenceIntervalChange = (newInterval) => {
    const interval = Math.max(1, parseInt(newInterval) || 1);
    const count = editingTask.recurrenceCount || 1;
    const type = editingTask.recurrenceType || 'weekly';

    const updatedDays = calculateDaysWithInterval(count, interval, type);

    setEditingTask({
      ...editingTask,
      recurrenceInterval: interval,
      recurrenceDays: updatedDays
    });
  };

  const handleRecurrenceTypeChange = (newType) => {
    const count = editingTask.recurrenceCount || 1;
    const interval = editingTask.recurrenceInterval || 1;
    const defaultDays = calculateDaysWithInterval(count, interval, newType);

    setEditingTask({
      ...editingTask,
      recurrenceType: newType,
      recurrenceDays: defaultDays,
      monthOffset: 0
    });
  };

  return (
    <>
      <div
        className="modal-backdrop high-z-backdrop"
        onClick={() => {
          if (playSound) playSound('click');
          toggleModal();
        }}
      >
        <div
          className="modal-window high-z-window"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '890px',
            maxWidth: '90vw',
            height: '765px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--theme-modal-bg, #0e1626)',
            border: '1px solid var(--theme-border, #1e293b)'
          }}
        >
          <div className="modal-header-row" style={{ borderBottom: '1px solid var(--theme-border, #1e293b)', paddingBottom: '0.7rem', marginBottom: '0.7rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f8fafc', fontSize: '1.15rem' }}>
              📋 Gerenciador de Checklists
            </h3>
            <button
              className="close-popup-btn"
              onClick={() => {
                if (playSound) playSound('click');
                toggleModal();
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', overflowY: 'hidden', padding: '0.2rem 0.2rem 0.7rem 0.2rem', minHeight: '50px', borderBottom: '1px solid var(--theme-border, #1e293b)', alignItems: 'center' }}>
            {taskLists.map((list, index) => {
              const isActive = list.id === activeListId;
              return (
                <div
                  key={list.id}
                  draggable
                  onDragStart={() => handleListDragStart(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleListDrop(index);
                  }}
                  onClick={() => {
                    if (playSound) playSound('click');
                    setActiveListId(list.id);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 0.85rem',
                    borderRadius: '8px',
                    background: isActive ? 'var(--theme-accent, #38bdf8)' : 'rgba(255, 255, 255, 0.05)',
                    color: isActive ? '#000' : '#f8fafc',
                    fontWeight: isActive ? 'bold' : 'normal',
                    cursor: 'pointer',
                    border: '1px solid var(--theme-border, #334155)',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>⠿ {list.title}</span>
                  <span style={{ fontSize: '0.72rem', opacity: 0.8, background: 'rgba(0,0,0,0.15)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                    {list.tasks.length}
                  </span>
                  {taskLists.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (playSound) playSound('delete');
                        removeList(list.id);
                      }}
                      style={{ background: 'transparent', border: 'none', color: isActive ? '#000' : '#f87171', cursor: 'pointer', fontSize: '0.85rem', padding: '0 0.15rem' }}
                      title="Excluir lista"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}

            {!isAddingList ? (
              <button
                type="button"
                className="confirm-button"
                style={{ padding: '0.45rem 0.8rem', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                onClick={() => {
                  if (playSound) playSound('click');
                  setIsAddingList(true);
                }}
              >
                + Nova Lista
              </button>
            ) : (
              <form onSubmit={handleCreateListSubmit} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Nome da lista..."
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  autoFocus
                  style={{ padding: '0.4rem 0.6rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--theme-border, #334155)', borderRadius: '6px', color: '#fff', fontSize: '0.82rem' }}
                />
                <button type="submit" className="confirm-button" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}>Criar</button>
                <button type="button" className="cancel-button" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} onClick={() => setIsAddingList(false)}>✕</button>
              </form>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.9rem', marginTop: '0.8rem', paddingRight: '0.3rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                className="confirm-button"
                style={{ padding: '0.55rem', fontSize: '0.88rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', flex: 1 }}
                onClick={() => {
                  if (playSound) playSound('click');
                  setNewTitle('');
                  setNewDescription('');
                  setNewDueDate('');
                  setNewDueTime('');
                  setIsAddTaskModalOpen(true);
                }}
              >
                + Tarefa
              </button>

              <select
                value={sortOrder}
                onChange={(e) => {
                  if (playSound) playSound('click');
                  setSortOrder(e.target.value);
                }}
                style={{
                  padding: '0.55rem 0.85rem',
                  fontSize: '0.82rem',
                  fontWeight: 'bold',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--theme-border, #334155)',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                  outline: 'none',
                  colorScheme: 'dark',
                  transition: 'all 0.2s ease'
                }}
                title="Ordenar tarefas"
              >
                <option value="antigos" style={{ background: '#0e1626', color: '#fff' }}>Primeiros Adicionados</option>
                <option value="ultimos" style={{ background: '#0e1626', color: '#fff' }}>Últimos Adicionados</option>
                <option value="az" style={{ background: '#0e1626', color: '#fff' }}>A - Z</option>
                <option value="za" style={{ background: '#0e1626', color: '#fff' }}>Z - A</option>
                <option value="data" style={{ background: '#0e1626', color: '#fff' }}>Data Limite</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  if (playSound) playSound('click');
                  setShowOnlyCompletedToday((prev) => !prev);
                  if (!showOnlyCompletedToday) {
                    setHideCompleted(false);
                  }
                }}
                style={{
                  padding: '0.55rem 0.85rem',
                  fontSize: '0.82rem',
                  fontWeight: 'bold',
                  borderRadius: '6px',
                  background: showOnlyCompletedToday ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  border: showOnlyCompletedToday ? '1px solid var(--theme-accent, #38bdf8)' : '1px solid var(--theme-border, #334155)',
                  color: showOnlyCompletedToday ? '#38bdf8' : '#cbd5e1',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease'
                }}
                title="Mostrar apenas tarefas concluídas nas últimas 24 horas"
              >
                Concluídos hoje
              </button>

              <button
                type="button"
                onClick={() => {
                  if (playSound) playSound('click');
                  setHideCompleted((prev) => !prev);
                  if (!hideCompleted) {
                    setShowOnlyCompletedToday(false);
                  }
                }}
                style={{
                  padding: '0.55rem 0.85rem',
                  fontSize: '0.82rem',
                  fontWeight: 'bold',
                  borderRadius: '6px',
                  background: hideCompleted ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  border: hideCompleted ? '1px solid var(--theme-accent, #38bdf8)' : '1px solid var(--theme-border, #334155)',
                  color: hideCompleted ? '#38bdf8' : '#cbd5e1',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease'
                }}
              >
                {hideCompleted ? 'Mostrando Concluídos' : 'Ocultar Concluídos'}
              </button>
            </div>

            {activeTasks.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', padding: '1.8rem 0', fontSize: '0.88rem' }}>
                {showOnlyCompletedToday
                  ? 'Nenhuma tarefa concluída nas últimas 24 horas.'
                  : 'Nenhuma tarefa nesta lista. Clique no botão acima para adicionar!'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', alignItems: 'center', width: '100%' }}>
                {taskChunks.map((chunk, chunkIndex) => (
                  <React.Fragment key={chunkIndex}>
                    {chunkIndex > 0 && (
                      <div style={{ borderTop: '1px solid var(--theme-border, #334155)', margin: '0.3rem 0', width: '100%' }} />
                    )}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateRows: 'repeat(5, auto)',
                        gridAutoFlow: 'column',
                        gridAutoColumns: '390px',
                        gap: '0.55rem',
                        alignItems: 'start',
                        justifyContent: 'center',
                        maxWidth: '100%'
                      }}
                    >
                      {chunk.map((task, subIndex) => {
                        const absoluteIndex = chunkIndex * 10 + subIndex;
                        return renderTaskCard(task, absoluteIndex);
                      })}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            )}

            {!showOnlyCompletedToday && hideCompleted && completedTasks.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%', marginTop: '0.6rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (playSound) playSound('click');
                    setShowCompletedAccordion((prev) => !prev);
                  }}
                  style={{
                    padding: '0.55rem 1rem',
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid var(--theme-accent, #38bdf8)',
                    boxShadow: '0 0 8px rgba(56, 189, 248, 0.3)',
                    borderRadius: '6px',
                    color: '#38bdf8',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    width: '100%',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {showCompletedAccordion ? '▼' : '▶'} Concluídos ({completedTasks.length})
                </button>

                {showCompletedAccordion && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', alignItems: 'center', width: '100%', paddingTop: '0.3rem' }}>
                    {completedChunks.map((chunk, chunkIndex) => (
                      <React.Fragment key={chunkIndex}>
                        {chunkIndex > 0 && (
                          <div style={{ borderTop: '1px solid var(--theme-border, #334155)', margin: '0.3rem 0', width: '100%' }} />
                        )}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateRows: 'repeat(5, auto)',
                            gridAutoFlow: 'column',
                            gridAutoColumns: '390px',
                            gap: '0.55rem',
                            alignItems: 'start',
                            justifyContent: 'center',
                            maxWidth: '100%'
                          }}
                        >
                          {chunk.map((task, subIndex) => {
                            const absoluteIndex = tasks.findIndex((t) => t.id === task.id);
                            return renderTaskCard(task, absoluteIndex);
                          })}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-actions-bar" style={{ marginTop: '1rem', borderTop: '1px solid var(--theme-border, #1e293b)', paddingTop: '0.7rem' }}>
            <button
              className="confirm-button"
              onClick={() => {
                if (playSound) playSound('click');
                toggleModal();
              }}
              style={{ width: '100%', padding: '0.55rem' }}
            >
              Concluído
            </button>
          </div>
        </div>
      </div>

      {/* JANELA DE ADICIONAR TAREFA */}
      {isAddTaskModalOpen && (
        <div className="modal-backdrop high-z-backdrop" onClick={() => setIsAddTaskModalOpen(false)}>
          <form
            className="modal-window high-z-window"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleAddTaskSubmit}
            style={{ maxWidth: '450px', width: '90vw', backgroundColor: 'var(--theme-modal-bg, #0e1626)', border: '1px solid var(--theme-border, #1e293b)' }}
          >
            <div className="modal-header-row" style={{ borderBottom: '1px solid var(--theme-border, #1e293b)', paddingBottom: '0.6rem', marginBottom: '1rem' }}>
              <h3 style={{ color: '#f8fafc', fontSize: '1.05rem' }}>✨ Adicionar Nova Tarefa</h3>
              <button type="button" className="close-popup-btn" onClick={() => setIsAddTaskModalOpen(false)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 'bold' }}>Nome da Tarefa:</label>
                <input
                  type="text"
                  placeholder="Ex: Estudar React..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--theme-border, #334155)', borderRadius: '6px', color: '#fff', fontSize: '0.88rem', marginTop: '0.25rem' }}
                  autoFocus
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 'bold' }}>Descrição (opcional):</label>
                <textarea
                  rows={3}
                  placeholder="Adicione detalhes ou notas..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--theme-border, #334155)', borderRadius: '6px', color: '#fff', fontSize: '0.88rem', marginTop: '0.25rem', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 'bold' }}>Data:</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      onClick={(e) => {
                        if (typeof e.target.showPicker === 'function') {
                          try { e.target.showPicker(); } catch (err) {}
                        }
                      }}
                      style={{ width: '100%', padding: '0.45rem 0.65rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--theme-border, #334155)', borderRadius: '6px', color: '#fff', fontSize: '0.88rem', colorScheme: 'dark', cursor: 'pointer' }}
                    />
                    {newDueDate && (
                      <button
                        type="button"
                        onClick={() => setNewDueDate('')}
                        style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: '#f87171', fontSize: '0.75rem', cursor: 'pointer', padding: '0' }}
                      >
                        Limpar data
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <input
                      type="time"
                      value={newDueTime}
                      onChange={(e) => setNewDueTime(e.target.value)}
                      onClick={(e) => {
                        if (typeof e.target.showPicker === 'function') {
                          try { e.target.showPicker(); } catch (err) {}
                        }
                      }}
                      style={{ width: '100%', padding: '0.45rem 0.65rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--theme-border, #334155)', borderRadius: '6px', color: '#fff', fontSize: '0.88rem', colorScheme: 'dark', cursor: 'pointer' }}
                    />
                    {newDueTime && (
                      <button
                        type="button"
                        onClick={() => setNewDueTime('')}
                        style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: '#f87171', fontSize: '0.75rem', cursor: 'pointer', padding: '0' }}
                      >
                        Limpar hora
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions-bar" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.1rem', borderTop: '1px solid var(--theme-border, #1e293b)', paddingTop: '0.75rem' }}>
              <button
                type="button"
                className="cancel-button"
                onClick={() => setIsAddTaskModalOpen(false)}
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="confirm-button"
                style={{ padding: '0.4rem 0.95rem', fontSize: '0.82rem', fontWeight: 'bold' }}
              >
                Adicionar Tarefa
              </button>
            </div>
          </form>
        </div>
      )}

      {/* JANELA DE EDIÇÃO DA TAREFA */}
      {editingTask && (
        <div className="modal-backdrop high-z-backdrop" onClick={() => setEditingTask(null)}>
          <div
            className="modal-window high-z-window"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '470px',
              width: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--theme-modal-bg, #0e1626)',
              border: '1px solid var(--theme-border, #1e293b)'
            }}
          >
            <div className="modal-header-row" style={{ borderBottom: '1px solid var(--theme-border, #1e293b)', paddingBottom: '0.6rem', marginBottom: '1rem', flexShrink: 0 }}>
              <h3 style={{ color: '#f8fafc', fontSize: '1.05rem' }}>✏️ Editar Tarefa</h3>
              <button className="close-popup-btn" onClick={() => setEditingTask(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', overflowY: 'auto', paddingRight: '0.4rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 'bold' }}>Nome da Tarefa:</label>
                <input
                  type="text"
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--theme-border, #334155)', borderRadius: '6px', color: '#fff', fontSize: '0.88rem', marginTop: '0.25rem' }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 'bold' }}>Descrição:</label>
                <textarea
                  rows={2}
                  value={editingTask.description || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                  placeholder="Adicione detalhes ou notas..."
                  style={{ width: '100%', padding: '0.45rem 0.65rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--theme-border, #334155)', borderRadius: '6px', color: '#fff', fontSize: '0.88rem', marginTop: '0.25rem', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 'bold' }}>Data:</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <input
                      type="date"
                      value={editingTask.dueDate || ''}
                      onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                      onClick={(e) => {
                        if (typeof e.target.showPicker === 'function') {
                          try { e.target.showPicker(); } catch (err) {}
                        }
                      }}
                      style={{ width: '100%', padding: '0.45rem 0.65rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--theme-border, #334155)', borderRadius: '6px', color: '#fff', fontSize: '0.88rem', colorScheme: 'dark', cursor: 'pointer' }}
                    />
                    {editingTask.dueDate && (
                      <button
                        type="button"
                        onClick={() => setEditingTask({ ...editingTask, dueDate: '' })}
                        style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: '#f87171', fontSize: '0.75rem', cursor: 'pointer', padding: '0' }}
                      >
                        Limpar data
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <input
                      type="time"
                      value={editingTask.dueTime || ''}
                      onChange={(e) => setEditingTask({ ...editingTask, dueTime: e.target.value })}
                      onClick={(e) => {
                        if (typeof e.target.showPicker === 'function') {
                          try { e.target.showPicker(); } catch (err) {}
                        }
                      }}
                      style={{ width: '100%', padding: '0.45rem 0.65rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--theme-border, #334155)', borderRadius: '6px', color: '#fff', fontSize: '0.88rem', colorScheme: 'dark', cursor: 'pointer' }}
                    />
                    {editingTask.dueTime && (
                      <button
                        type="button"
                        onClick={() => setEditingTask({ ...editingTask, dueTime: '' })}
                        style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: '#f87171', fontSize: '0.75rem', cursor: 'pointer', padding: '0' }}
                      >
                        Limpar hora
                      </button>
                    )}
                  </div>
                </div>
                {(() => {
                  const status = getDeadlineStatusText(editingTask.dueDate);
                  if (!status) return null;
                  return (
                    <div style={{ fontSize: '0.78rem', color: status.color, fontWeight: 'bold', marginTop: '0.35rem' }}>
                      {status.text}
                    </div>
                  );
                })()}
              </div>

              {/* === REPETIÇÃO === */}
              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 'bold' }}>Repetição / Rastreador de Hábito:</label>
                <div style={{ marginTop: '0.25rem', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--theme-border, #334155)', borderRadius: '6px', padding: '0.65rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: '#f8fafc', fontWeight: '500' }}>
                    <input
                      type="checkbox"
                      checked={editingTask.isRecurring || false}
                      onChange={(e) => setEditingTask({ 
                        ...editingTask, 
                        isRecurring: e.target.checked, 
                        recurrenceCount: editingTask.recurrenceCount || 1, 
                        recurrenceInterval: editingTask.recurrenceInterval || 1,
                        recurrenceType: editingTask.recurrenceType || 'weekly',
                        recurrenceDays: editingTask.recurrenceDays || [],
                        monthOffset: 0
                      })}
                      style={{ accentColor: '#38bdf8', width: '15px', height: '15px', cursor: 'pointer' }}
                    />
                    Ativar Repetição
                  </label>

                  {editingTask.isRecurring && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.7rem', paddingTop: '0.7rem', borderTop: '1px dashed #334155' }}>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>Período:</span>
                        <select
                          value={editingTask.recurrenceType || 'weekly'}
                          onChange={(e) => handleRecurrenceTypeChange(e.target.value)}
                          style={{ flex: 1, padding: '0.35rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#fff', fontSize: '0.85rem', colorScheme: 'dark', cursor: 'pointer' }}
                        >
                          <option value="daily">Diariamente</option>
                          <option value="weekly">Dias específicos na semana</option>
                          <option value="monthly">Dias específicos no mês</option>
                        </select>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: editingTask.recurrenceType === 'daily' ? '1fr' : '1fr 1fr', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', background: 'rgba(255,255,255,0.03)', padding: '0.4rem 0.5rem', borderRadius: '4px' }}>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            {editingTask.recurrenceType === 'daily' 
                              ? 'Vezes por dia:' 
                              : editingTask.recurrenceType === 'weekly'
                              ? 'Qtd. de dias na semana:'
                              : 'Qtd. de dias no mês:'}
                          </span>
                          <input
                            type="number"
                            min="1"
                            max={editingTask.recurrenceType === 'weekly' ? '7' : editingTask.recurrenceType === 'monthly' ? daysInTargetMonth : '999'}
                            value={editingTask.recurrenceCount || 1}
                            onChange={(e) => handleRecurrenceCountChange(e.target.value)}
                            style={{ width: '100%', padding: '0.25rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#fff', fontSize: '0.85rem', textAlign: 'center', colorScheme: 'dark' }}
                          />
                        </div>

                        {editingTask.recurrenceType !== 'daily' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', background: 'rgba(255,255,255,0.03)', padding: '0.4rem 0.5rem', borderRadius: '4px' }}>
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }} title="Pular intervalo de dias">Pular (Intervalo):</span>
                            <input
                              type="number"
                              min="1"
                              max="30"
                              value={editingTask.recurrenceInterval || 1}
                              onChange={(e) => handleRecurrenceIntervalChange(e.target.value)}
                              style={{ width: '100%', padding: '0.25rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#fff', fontSize: '0.85rem', textAlign: 'center', colorScheme: 'dark' }}
                            />
                          </div>
                        )}
                      </div>

                      {editingTask.recurrenceType === 'weekly' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.2rem' }}>
                          {orderedWeekDays.map(day => {
                            const isSelected = (editingTask.recurrenceDays || []).includes(day.value);
                            return (
                              <button
                                key={day.value}
                                type="button"
                                title={day.name}
                                onClick={() => toggleRecurrenceDay(day.value)}
                                style={{
                                  width: '32px', height: '32px',
                                  borderRadius: '50%', border: 'none', cursor: 'pointer',
                                  fontWeight: 'bold', fontSize: '0.8rem',
                                  background: isSelected ? '#38bdf8' : '#1e293b',
                                  color: isSelected ? '#000' : '#94a3b8',
                                  transition: 'all 0.2s',
                                  boxShadow: isSelected ? '0 0 8px rgba(56, 189, 248, 0.5)' : 'none'
                                }}
                              >
                                {day.label}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {editingTask.recurrenceType === 'monthly' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '0.3rem 0.5rem', borderRadius: '4px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (playSound) playSound('click');
                                setEditingTask({ ...editingTask, monthOffset: Math.max(0, (editingTask.monthOffset || 0) - 1) });
                              }}
                              style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              ◀
                            </button>
                            <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 'bold', textTransform: 'capitalize' }}>
                              📅 {targetMonthName} {targetYear}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (playSound) playSound('click');
                                setEditingTask({ ...editingTask, monthOffset: (editingTask.monthOffset || 0) + 1 });
                              }}
                              style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              ▶
                            </button>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.3rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '6px', maxHeight: '130px', overflowY: 'auto' }}>
                            {monthDays.map(day => {
                              const isSelected = (editingTask.recurrenceDays || []).includes(day);
                              return (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => toggleRecurrenceDay(day)}
                                  style={{
                                    aspectRatio: '1', width: '100%',
                                    borderRadius: '4px', border: 'none', cursor: 'pointer',
                                    fontWeight: '500', fontSize: '0.75rem',
                                    background: isSelected ? '#38bdf8' : '#1e293b',
                                    color: isSelected ? '#000' : '#94a3b8',
                                    transition: 'all 0.1s',
                                    boxShadow: isSelected ? '0 0 5px rgba(56, 189, 248, 0.4)' : 'none'
                                  }}
                                >
                                  {day}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.74rem', color: '#94a3b8', background: 'rgba(0,0,0,0.25)', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--theme-border, #334155)', marginTop: '0.4rem' }}>
                <div>📅 Criada em: <strong style={{ color: '#cbd5e1' }}>{formatDateTime(editingTask.createdAt)}</strong></div>
                <div>✏️ Última modificação: <strong style={{ color: '#cbd5e1' }}>{formatDateTime(editingTask.updatedAt)}</strong></div>
              </div>
            </div>

            <div className="modal-actions-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.1rem', borderTop: '1px solid var(--theme-border, #1e293b)', paddingTop: '0.75rem', flexShrink: 0 }}>
              <button
                type="button"
                className="delete-btn"
                onClick={() => {
                  if (playSound) playSound('delete');
                  removeTask(editingTask.id);
                  setEditingTask(null);
                }}
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}
              >
                Excluir Tarefa
              </button>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setEditingTask(null)}
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="confirm-button"
                  onClick={() => {
                    if (playSound) playSound('train');
                    updateTask(editingTask.id, {
                      title: editingTask.title.trim() || 'Tarefa sem nome',
                      description: editingTask.description,
                      dueDate: editingTask.dueDate,
                      dueTime: editingTask.dueTime,
                      isRecurring: editingTask.isRecurring,
                      recurrenceCount: editingTask.recurrenceCount,
                      recurrenceInterval: editingTask.recurrenceInterval,
                      recurrenceType: editingTask.recurrenceType,
                      recurrenceDays: editingTask.recurrenceDays,
                      recurrenceCurrent: editingTask.recurrenceCurrent || 0
                    });
                    setEditingTask(null);
                  }}
                  style={{ padding: '0.4rem 0.95rem', fontSize: '0.82rem', fontWeight: 'bold' }}
                >
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// -----------------------------------------------------------
// ALERTAS E BADGES
// -----------------------------------------------------------

export function TaskAlert({ taskState }) {
  const { tasksDue, isAlertDismissed, setIsAlertDismissed, toggleModal, isOpen } = taskState;

  if (isOpen || isAlertDismissed || (tasksDue.todayCount === 0 && tasksDue.tomorrowCount === 0)) {
    return null;
  }

  let message = "";
  if (tasksDue.todayCount > 0 && tasksDue.tomorrowCount > 0) {
    message = `Você tem ${tasksDue.todayCount} tarefa(s) para hoje e ${tasksDue.tomorrowCount} para amanhã.`;
  } else if (tasksDue.todayCount > 0) {
    message = `Você tem ${tasksDue.todayCount} tarefa(s) pendente(s) para hoje!`;
  } else {
    message = `Você tem ${tasksDue.tomorrowCount} tarefa(s) para amanhã.`;
  }

  return (
    <div 
      onClick={toggleModal}
      style={{
        backgroundColor: 'rgba(14, 22, 38, 0.95)',
        border: '1px solid #334155',
        borderLeft: '4px solid #facc15',
        color: '#f8fafc',
        padding: '0.8rem 1.2rem',
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        gap: '1.5rem',
        cursor: 'pointer',
        height: 'fit-content',
        whiteSpace: 'nowrap'
      }}
    >
      <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>🔔 {message}</span>
      <button 
        onClick={(e) => {
          e.stopPropagation(); 
          setIsAlertDismissed(true);
        }}
        title="Fechar aviso"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          fontSize: '1.1rem',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        ✕
      </button>
    </div>
  );
}

export function TaskBadge({ taskState }) {
  const { tasksDue } = taskState;
  
  if (tasksDue.todayCount === 0) return null;

  return (
    <span className="subtle-mission-badge" title={`${tasksDue.todayCount} tarefa(s) pendente(s)`}>
      {tasksDue.todayCount}
    </span>
  );
}