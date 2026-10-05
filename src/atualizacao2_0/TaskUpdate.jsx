import React, { useState } from 'react';

// Função auxiliar para formatar data e hora
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

// Função auxiliar para calcular dias restantes ou atraso
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

  // Estado para ordenação (padrão: "antigos" - Primeiros Adicionados)
  const [sortOrder, setSortOrder] = useState('antigos');

  // Estado para o filtro de concluídos hoje (últimas 24 horas)
  const [showOnlyCompletedToday, setShowOnlyCompletedToday] = useState(false);

  // Estado para ocultar/mostrar concluídos e accordion
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showCompletedAccordion, setShowCompletedAccordion] = useState(false);

  // Estados para o modal de nova tarefa
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDueDate, setNewDueDate] = useState('');

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
    playSound('click');
    addList(newListTitle.trim());
    setNewListTitle('');
    setIsAddingList(false);
  };

  const handleAddTaskSubmit = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    playSound('train');
    addTask(newTitle.trim(), newDueDate, newDescription);
    setNewTitle('');
    setNewDescription('');
    setNewDueDate('');
    setIsAddTaskModalOpen(false);
  };

  // Função para ordenar tarefas
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
        // Correção aqui: comparação real entre a.createdAt e b.createdAt
        return copy.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    }
  };

  // Função para verificar se a tarefa foi concluída nas últimas 24 horas
  const isCompletedInLast24Hours = (task) => {
    if (!task.completed || !task.updatedAt) return false;
    const taskDate = new Date(task.updatedAt);
    const now = new Date();
    const diffInHours = (now - taskDate) / (1000 * 60 * 60);
    return diffInHours >= 0 && diffInHours <= 24;
  };

  // Renderizador de card de tarefa individual
  const renderTaskCard = (task, index) => {
    const deadlineInfo = getDeadlineStatusText(task.dueDate);
    const isCompleted = task.completed;

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
          playSound('click');
          toggleTask(task.id);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          playSound('click');
          setEditingTask({ ...task });
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
          background: isCompleted ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.04)',
          border: isCompleted ? '1px solid var(--theme-accent, #38bdf8)' : '1px solid var(--theme-border, #334155)',
          boxShadow: isCompleted
            ? '0 0 12px rgba(56, 189, 248, 0.45), inset 0 0 6px rgba(56, 189, 248, 0.2)'
            : 'none',
          borderRadius: '7px',
          cursor: 'pointer',
          userSelect: 'none',
          overflow: 'hidden',
          transition: 'all 0.2s ease'
        }}
        title="Clique esquerdo: Concluir | Clique direito: Editar"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flex: 1, minWidth: 0 }}>
          <span style={{ color: isCompleted ? '#38bdf8' : '#64748b', fontSize: '0.85rem' }} title="Arraste para reordenar">⠿</span>
          <input
            type="checkbox"
            checked={isCompleted}
            onChange={() => {}}
            style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--theme-accent, #38bdf8)', flexShrink: 0 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', flex: 1, minWidth: 0, justifyContent: 'center' }}>
            <span
              style={{
                fontSize: '0.88rem',
                color: isCompleted ? '#38bdf8' : '#f8fafc',
                textDecoration: isCompleted ? 'line-through' : 'none',
                textShadow: isCompleted ? '0 0 6px rgba(56, 189, 248, 0.7)' : 'none',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontWeight: isCompleted ? 'bold' : '500'
              }}
            >
              {task.title}
            </span>
            {task.description && (
              <span style={{ fontSize: '0.74rem', color: isCompleted ? '#7dd3fc' : '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {task.description}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, marginLeft: '0.4rem' }}>
          {task.dueDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.08)', padding: '0.12rem 0.45rem', borderRadius: '4px', fontSize: '0.72rem' }}>
              {deadlineInfo && (
                <span style={{ color: deadlineInfo.color, fontWeight: 'bold' }}>
                  ({deadlineInfo.text})
                </span>
              )}
              <span style={{ color: '#cbd5e1' }}>📅 {task.dueDate.split('-').reverse().join('/')}</span>
            </div>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              playSound('delete');
              removeTask(task.id);
            }}
            style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.9rem', padding: '0.1rem' }}
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

  // Aplicação dos Filtros
  let activeTasks = sortedTasks;

  if (showOnlyCompletedToday) {
    activeTasks = sortedTasks.filter(isCompletedInLast24Hours);
  } else if (hideCompleted) {
    activeTasks = sortedTasks.filter((t) => !t.completed);
  }

  const completedTasks = sortedTasks.filter((t) => t.completed);

  // Divide as tarefas visíveis em blocos de 10
  const taskChunks = [];
  for (let i = 0; i < activeTasks.length; i += 10) {
    taskChunks.push(activeTasks.slice(i, i + 10));
  }

  // Chunks para as tarefas no botão "Concluídos"
  const completedChunks = [];
  for (let i = 0; i < completedTasks.length; i += 10) {
    completedChunks.push(completedTasks.slice(i, i + 10));
  }

  return (
    <>
      <div
        className="modal-backdrop high-z-backdrop"
        onClick={() => {
          playSound('click');
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
          {/* Cabeçalho */}
          <div className="modal-header-row" style={{ borderBottom: '1px solid var(--theme-border, #1e293b)', paddingBottom: '0.7rem', marginBottom: '0.7rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f8fafc', fontSize: '1.15rem' }}>
              📋 Gerenciador de Checklists
            </h3>
            <button
              className="close-popup-btn"
              onClick={() => {
                playSound('click');
                toggleModal();
              }}
            >
              ✕
            </button>
          </div>

          {/* Barra de Listas */}
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
                    playSound('click');
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
                        playSound('delete');
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
                  playSound('click');
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

          {/* Conteúdo de Tarefas */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.9rem', marginTop: '0.8rem', paddingRight: '0.3rem' }}>
            
            {/* Linha de Ações */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                className="confirm-button"
                style={{ padding: '0.55rem', fontSize: '0.88rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', flex: 1 }}
                onClick={() => {
                  playSound('click');
                  setNewTitle('');
                  setNewDescription('');
                  setNewDueDate('');
                  setIsAddTaskModalOpen(true);
                }}
              >
                + Tarefa
              </button>

              {/* Menu Suspenso de Ordenação */}
              <select
                value={sortOrder}
                onChange={(e) => {
                  playSound('click');
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

              {/* Botão Concluídos hoje */}
              <button
                type="button"
                onClick={() => {
                  playSound('click');
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

              {/* Botão Ocultar/Mostrar Concluídos */}
              <button
                type="button"
                onClick={() => {
                  playSound('click');
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

            {/* Listagem de Tarefas Principais */}
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

            {/* Accordion de tarefas concluídas no final quando oculto */}
            {!showOnlyCompletedToday && hideCompleted && completedTasks.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%', marginTop: '0.6rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    playSound('click');
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

          {/* Rodapé */}
          <div className="modal-actions-bar" style={{ marginTop: '1rem', borderTop: '1px solid var(--theme-border, #1e293b)', paddingTop: '0.7rem' }}>
            <button
              className="confirm-button"
              onClick={() => {
                playSound('click');
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
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 'bold' }}>Data Limite (Prazo):</label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  onClick={(e) => {
                    if (typeof e.target.showPicker === 'function') {
                      try { e.target.showPicker(); } catch (err) {}
                    }
                  }}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--theme-border, #334155)', borderRadius: '6px', color: '#fff', fontSize: '0.88rem', marginTop: '0.25rem', colorScheme: 'dark', cursor: 'pointer' }}
                />
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

      {/* JANELA DE EDIÇÃO DA TAREFA (CLIQUE DIREITO) */}
      {editingTask && (
        <div className="modal-backdrop high-z-backdrop" onClick={() => setEditingTask(null)}>
          <div
            className="modal-window high-z-window"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '470px',
              width: '90vw',
              backgroundColor: 'var(--theme-modal-bg, #0e1626)',
              border: '1px solid var(--theme-border, #1e293b)'
            }}
          >
            <div className="modal-header-row" style={{ borderBottom: '1px solid var(--theme-border, #1e293b)', paddingBottom: '0.6rem', marginBottom: '1rem' }}>
              <h3 style={{ color: '#f8fafc', fontSize: '1.05rem' }}>✏️ Editar Tarefa</h3>
              <button className="close-popup-btn" onClick={() => setEditingTask(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
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
                  rows={3}
                  value={editingTask.description || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                  placeholder="Adicione detalhes ou notas..."
                  style={{ width: '100%', padding: '0.45rem 0.65rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--theme-border, #334155)', borderRadius: '6px', color: '#fff', fontSize: '0.88rem', marginTop: '0.25rem', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 'bold' }}>Data Limite (Prazo):</label>
                <input
                  type="date"
                  value={editingTask.dueDate || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                  onClick={(e) => {
                    if (typeof e.target.showPicker === 'function') {
                      try { e.target.showPicker(); } catch (err) {}
                    }
                  }}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--theme-border, #334155)', borderRadius: '6px', color: '#fff', fontSize: '0.88rem', marginTop: '0.25rem', colorScheme: 'dark', cursor: 'pointer' }}
                />
                {(() => {
                  const status = getDeadlineStatusText(editingTask.dueDate);
                  if (!status) return null;
                  return (
                    <div style={{ fontSize: '0.78rem', color: status.color, fontWeight: 'bold', marginTop: '0.25rem' }}>
                      {status.text}
                    </div>
                  );
                })()}
              </div>

              {/* Informações de Criação e Última Modificação */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.74rem', color: '#94a3b8', background: 'rgba(0,0,0,0.25)', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--theme-border, #334155)' }}>
                <div>📅 Criada em: <strong style={{ color: '#cbd5e1' }}>{formatDateTime(editingTask.createdAt)}</strong></div>
                <div>✏️ Última modificação: <strong style={{ color: '#cbd5e1' }}>{formatDateTime(editingTask.updatedAt)}</strong></div>
              </div>
            </div>

            <div className="modal-actions-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.1rem', borderTop: '1px solid var(--theme-border, #1e293b)', paddingTop: '0.75rem' }}>
              <button
                type="button"
                className="delete-btn"
                onClick={() => {
                  playSound('delete');
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
                    playSound('train');
                    updateTask(editingTask.id, {
                      title: editingTask.title.trim() || 'Tarefa sem nome',
                      description: editingTask.description,
                      dueDate: editingTask.dueDate
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