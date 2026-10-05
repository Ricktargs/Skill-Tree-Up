import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY_LISTS = 'task_update_lists_v1';
const STORAGE_KEY_LANG = 'task_update_lang_v1';

const DEFAULT_LISTS = [
  {
    id: 'list_default',
    title: 'Geral',
    tasks: [
      { 
        id: 'task_1', 
        title: 'Estudar React e Hooks', 
        completed: false, 
        dueDate: '', 
        description: 'Rever conceitos de useState e useEffect',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      { 
        id: 'task_2', 
        title: 'Ajustar temporizador do Pomodoro', 
        completed: true, 
        dueDate: '', 
        description: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  }
];

export function useTaskUpdate() {
  const [isOpen, setIsOpen] = useState(false);

  // Estado de Idioma (Português como padrão)
  const [language, setLanguage] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LANG);
      return saved && ['pt', 'en', 'es'].includes(saved) ? saved : 'pt';
    } catch (e) {
      return 'pt';
    }
  });

  const [taskLists, setTaskLists] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LISTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map(list => ({
          ...list,
          tasks: list.tasks.map(t => ({
            ...t,
            createdAt: t.createdAt || new Date().toISOString(),
            updatedAt: t.updatedAt || new Date().toISOString()
          }))
        }));
      }
      return DEFAULT_LISTS;
    } catch (e) {
      return DEFAULT_LISTS;
    }
  });

  const [activeListId, setActiveListId] = useState(() => taskLists[0]?.id || 'list_default');

  // Histórico de Undo (Ctrl+Z) e Redo (Ctrl+Y / Ctrl+Shift+Z)
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);

  const draggedTaskIndex = useRef(null);
  const draggedListIndex = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LISTS, JSON.stringify(taskLists));
    } catch (e) {}
  }, [taskLists]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LANG, language);
    } catch (e) {}
  }, [language]);

  useEffect(() => {
    if (!taskLists.some((l) => l.id === activeListId) && taskLists.length > 0) {
      setActiveListId(taskLists[0].id);
    }
  }, [taskLists, activeListId]);

  const toggleModal = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const applyChange = useCallback((updater) => {
    setTaskLists((current) => {
      const nextState = typeof updater === 'function' ? updater(current) : updater;
      if (nextState !== current) {
        setPast((prevPast) => [...prevPast, current]);
        setFuture([]);
      }
      return nextState;
    });
  }, []);

  const undo = useCallback(() => {
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      const previous = prevPast[prevPast.length - 1];
      const newPast = prevPast.slice(0, prevPast.length - 1);

      setTaskLists((current) => {
        setFuture((prevFuture) => [current, ...prevFuture]);
        return previous;
      });

      return newPast;
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const next = prevFuture[0];
      const newFuture = prevFuture.slice(1);

      setTaskLists((current) => {
        setPast((prevPast) => [...prevPast, current]);
        return next;
      });

      return newFuture;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeElem = document.activeElement;
      const isEditingText =
        activeElem &&
        (activeElem.tagName === 'INPUT' ||
          activeElem.tagName === 'TEXTAREA' ||
          activeElem.isContentEditable);

      const keyLower = e.key ? e.key.toLowerCase() : '';
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;

      if (!isEditingText && keyLower === 't' && !isCmdOrCtrl && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        toggleModal();
        return;
      }

      if (isOpen && !isEditingText) {
        if (isCmdOrCtrl && keyLower === 'z' && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          undo();
        } else if ((isCmdOrCtrl && keyLower === 'y') || (isCmdOrCtrl && e.shiftKey && keyLower === 'z')) {
          e.preventDefault();
          e.stopPropagation();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, toggleModal, undo, redo]);

  const addList = (title) => {
    const cleanTitle = title.trim() || 'Nova Lista';
    const newList = {
      id: 'list_' + Date.now(),
      title: cleanTitle,
      tasks: []
    };
    applyChange((prev) => [...prev, newList]);
    setActiveListId(newList.id);
  };

  const removeList = (listId) => {
    if (taskLists.length <= 1) return;
    applyChange((prev) => {
      const filtered = prev.filter((l) => l.id !== listId);
      if (activeListId === listId && filtered.length > 0) {
        setActiveListId(filtered[0].id);
      }
      return filtered;
    });
  };

  const handleListDragStart = (index) => {
    draggedListIndex.current = index;
  };

  const handleListDrop = (index) => {
    if (draggedListIndex.current === null || draggedListIndex.current === index) return;

    applyChange((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(draggedListIndex.current, 1);
      updated.splice(index, 0, moved);
      return updated;
    });
    draggedListIndex.current = null;
  };

  const addTask = (title, dueDate = '', description = '') => {
    if (!title.trim()) return;
    const nowIso = new Date().toISOString();
    const newTask = {
      id: 'task_' + Date.now(),
      title: title.trim(),
      completed: false,
      dueDate,
      description: description.trim(),
      createdAt: nowIso,
      updatedAt: nowIso
    };

    applyChange((prev) =>
      prev.map((list) =>
        list.id === activeListId ? { ...list, tasks: [newTask, ...list.tasks] } : list
      )
    );
  };

  const toggleTask = (taskId) => {
    const nowIso = new Date().toISOString();
    applyChange((prev) =>
      prev.map((list) => {
        if (list.id !== activeListId) return list;
        return {
          ...list,
          tasks: list.tasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed, updatedAt: nowIso } : t))
        };
      })
    );
  };

  const updateTask = (taskId, updatedFields) => {
    const nowIso = new Date().toISOString();
    applyChange((prev) =>
      prev.map((list) => {
        if (list.id !== activeListId) return list;
        return {
          ...list,
          tasks: list.tasks.map((t) => (t.id === taskId ? { ...t, ...updatedFields, updatedAt: nowIso } : t))
        };
      })
    );
  };

  const removeTask = (taskId) => {
    applyChange((prev) =>
      prev.map((list) => {
        if (list.id !== activeListId) return list;
        return {
          ...list,
          tasks: list.tasks.filter((t) => t.id !== taskId)
        };
      })
    );
  };

  const handleTaskDragStart = (index) => {
    draggedTaskIndex.current = index;
  };

  const handleTaskDrop = (index) => {
    if (draggedTaskIndex.current === null || draggedTaskIndex.current === index) return;

    applyChange((prev) =>
      prev.map((list) => {
        if (list.id !== activeListId) return list;
        const updatedTasks = [...list.tasks];
        const [movedTask] = updatedTasks.splice(draggedTaskIndex.current, 1);
        updatedTasks.splice(index, 0, movedTask);
        return { ...list, tasks: updatedTasks };
      })
    );
    draggedTaskIndex.current = null;
  };

  const currentList = taskLists.find((l) => l.id === activeListId) || taskLists[0];

  return {
    isOpen,
    setIsOpen,
    toggleModal,
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
    undo,
    redo,
    language,
    setLanguage
  };
}