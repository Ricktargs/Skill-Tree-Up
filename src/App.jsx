import React, { useState, useEffect, useRef } from 'react';
import { useGameData, PRESET_DECKS, getXpNeededForLevel } from './hooks/useGameData';
import EmojiPicker from 'emoji-picker-react';
import confetti from 'canvas-confetti';
import './App.css';
import './SetMobileGrande.css';
import './SetMobilePequeno.css';
import { EditMissionsModal } from './EditMissionsModal.jsx';
import { usePomodoro, PomodoroModal, PomodoroWidget } from './atualizacao2_0/Update_2.jsx';
import { useTaskUpdate } from './atualizacao2_0/TaskUpdate.js';
import { useLanguage, UpIdiomaModal } from './atualizacao2_0/UpIdioma.jsx';
import { TaskModal, TaskAlert, TaskBadge } from './atualizacao2_0/TaskUpdate.jsx';

const THEME_PRESETS = [
  { id: 'cyberpunk', name: 'Cyberpunk', bg: 'radial-gradient(circle at 50% 30%, #111827 0%, #080c14 100%)', modalBg: '#0e1626', border: '#1e293b', color: '#38bdf8', boxBg: '#131e32' },
  { id: 'slate', name: 'Cinza Rochoso', bg: 'radial-gradient(circle at 50% 30%, #1e293b 0%, #0f172a 100%)', modalBg: '#182232', border: '#334155', color: '#94a3b8', boxBg: '#1e293b' },
  { id: 'emerald', name: 'Floresta de Esmeralda', bg: 'radial-gradient(circle at 50% 30%, #064e3b 0%, #022c22 100%)', modalBg: '#03382c', border: '#065f46', color: '#34d399', boxBg: '#043e30' },
  { id: 'sunset', name: 'Noite Roxa', bg: 'radial-gradient(circle at 50% 30%, #4c1d95 0%, #0f0728 100%)', modalBg: '#210d43', border: '#5b21b6', color: '#c084fc', boxBg: '#28114f' },
  { id: 'crimson', name: 'Abismo Escarlate', bg: 'radial-gradient(circle at 50% 30%, #450a0a 0%, #180303 100%)', modalBg: '#280606', border: '#7f1d1d', color: '#f87171', boxBg: '#2d0808' },
  { id: 'deepblue', name: 'Azul Profundo', bg: 'radial-gradient(circle at 50% 30%, #172554 0%, #080e24 100%)', modalBg: '#0f1b3d', border: '#1e3a8a', color: '#60a5fa', boxBg: '#111e47' },
  { id: 'volcano', name: 'Vulcânico', bg: 'radial-gradient(circle at 50% 30%, #431407 0%, #180502 100%)', modalBg: '#260b04', border: '#7c2d12', color: '#fb923c', boxBg: '#331107' },
  { id: 'gold', name: 'Aurora Dourada', bg: 'radial-gradient(circle at 50% 30%, #422006 0%, #1a0c02 100%)', modalBg: '#281303', border: '#78350f', color: '#facc15', boxBg: '#331b07' },
  { id: 'mystic', name: 'Névoa Mística', bg: 'radial-gradient(circle at 50% 30%, #311042 0%, #12041a 100%)', modalBg: '#1e0a29', border: '#581c87', color: '#e879f9', boxBg: '#270d35' },
  { id: 'neonpink', name: 'Rosa Neon', bg: 'radial-gradient(circle at 50% 30%, #500724 0%, #1f020e 100%)', modalBg: '#320417', border: '#831843', color: '#f472b6', boxBg: '#3b081e' },
  { id: 'ocean', name: 'Oceano Noturno', bg: 'radial-gradient(circle at 50% 30%, #083344 0%, #02121a 100%)', modalBg: '#04212d', border: '#164e63', color: '#22d3ee', boxBg: '#062a38' },
  { id: 'silver', name: 'Prata Cyber', bg: 'radial-gradient(circle at 50% 30%, #27272a 0%, #09090b 100%)', modalBg: '#18181b', border: '#3f3f46', color: '#e4e4e7', boxBg: '#1f1f23' }
];

const LEVEL_PRESETS = [5, 10, 15, 20, 25, 30, 40, 50, 80, 100];

const playSound = (type) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(550, now);
      osc.frequency.exponentialRampToValueAtTime(350, now + 0.04);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'train') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554.37, now + 0.07);
      osc.frequency.setValueAtTime(659.25, now + 0.14);
      osc.frequency.setValueAtTime(880, now + 0.21);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'delete') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.15);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'error') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(130, now);
      osc.frequency.setValueAtTime(95, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    }
  } catch (e) {}
};

const getRankTitle = (lvl) => {
  if (lvl < 40) return 'Aprendiz I';
  if (lvl < 80) return 'Aprendiz II';
  if (lvl < 120) return 'Aprendiz III';
  if (lvl < 160) return 'Intermediário I';
  if (lvl < 200) return 'Intermediário II';
  if (lvl < 240) return 'Intermediário III';
  if (lvl < 280) return 'Especialista I';
  if (lvl < 320) return 'Especialista II';
  if (lvl < 360) return 'Especialista III';
  if (lvl < 400) return 'Mestre I';
  if (lvl < 440) return 'Mestre II';
  if (lvl < 480) return 'Mestre III';
  return 'Mago Supremo';
};

const getClampedMenuPos = (clientX, clientY, width = 220, height = 200) => {
  const padding = 12;
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  let x = clientX;
  let y = clientY;

  if (x + width > screenWidth - padding) {
    x = Math.max(padding, screenWidth - width - padding);
  }
  if (y + height > screenHeight - padding) {
    y = Math.max(padding, screenHeight - height - padding);
  }

  return { x, y };
};

export default function App() {
  const pomodoro = usePomodoro();
  const taskState = useTaskUpdate();
  const { t } = useLanguage();
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);

  const {
    profiles,
    activeProfileId,
    switchProfile,
    createProfile,
    deleteProfile,
    getProfileStats,
    skills,
    setSkills,
    nickname,
    setNickname,
    avatar,
    setAvatar,
    currentTheme,
    setCurrentTheme,
    boxColorType,
    setBoxColorType,
    linkSkillsByCategory,
    setLinkSkillsByCategory,
    extraXp,
    setExtraXp,
    xpHistory,
    setXpHistory,
    folders,
    addFolder,
    deleteFolder,
    moveSkillToFolder,
    pendingTransfers,
    sendTransferRequest,
    acceptTransfer,
    rejectTransfer,
    reorderSkills,
    activeDeckId,
    setActiveDeckId,
    getActiveDeckColors,
    customColorDeck,
    addCustomColorToDeck,
    removeCustomColorFromDeck,
    hiddenSkillIds,
    toggleHideSkill,
    playerLevel,
    totalXp,
    currentXpProgress,
    xpNeededForNext,
    trainSkill,
    downgradeSkill,
    toggleChecktask,
    updateSkill,
    deleteSkill,
    addSkill,
    exportAllData,
    importData,
    undo,
    redo,
    diamonds,
    setDiamonds,
    dailyMissions,
    dailyRefreshesLeft,
    refreshDailyMissions,
    resetDailyMissionsHack,
    addExtraRefreshesHack,
    resetRefreshesCountHack,
    completeMission,
    addMiniMissionToSkill,
    deleteMiniMissionFromSkill,
    dailyMissionsQuota,
    setDailyMissionsQuota,
    prioritizedMissions,
    togglePrioritizeMission,
    updateMiniMissionText
  } = useGameData();

  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [tempNickname, setTempNickname] = useState(nickname);

  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [deletingProfileId, setDeletingProfileId] = useState(null);

  const [transferSourceId, setTransferSourceId] = useState(null);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferStep, setTransferStep] = useState('choose_type');
  const [transferNoticeMessage, setTransferNoticeMessage] = useState('');

  const [isMailModalOpen, setIsMailModalOpen] = useState(false);
  const [isXpHistoryModalOpen, setIsXpHistoryModalOpen] = useState(false);

  const [isNewProfileModalOpen, setIsNewProfileModalOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileAvatar, setNewProfileAvatar] = useState('🛡️');
  const [isNewProfileEmojiPickerOpen, setIsNewProfileEmojiPickerOpen] = useState(false);

  const [isLevelInfoModalOpen, setIsLevelInfoModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isBoxColorModalOpen, setIsBoxColorModalOpen] = useState(false);
  const [isSkillSettingsModalOpen, setIsSkillSettingsModalOpen] = useState(false);
  const [isCommandsModalOpen, setIsCommandsModalOpen] = useState(false);
  const [isCustomColorModalOpen, setIsCustomColorModalOpen] = useState(false);
  const [isManageSkillsModalOpen, setIsManageSkillsModalOpen] = useState(false);
  const [isLayoutEditorOpen, setIsLayoutEditorOpen] = useState(false);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [isMissionsModalOpen, setIsMissionsModalOpen] = useState(false);
  const [isEditMissionsModalOpen, setIsEditMissionsModalOpen] = useState(false);
  const [isMissionsHistoryModalOpen, setIsMissionsHistoryModalOpen] = useState(false);
  const [isMiniMissionsModalOpen, setIsMiniMissionsModalOpen] = useState(false);
  const [miniMissionsModalTab, setMiniMissionsModalTab] = useState('list');
  const [newMiniMissionText, setNewMiniMissionText] = useState('');

  const [isHackModalOpen, setIsHackModalOpen] = useState(false);
  const [hackXpInput, setHackXpInput] = useState('');
  const [hackDiamondsInput, setHackDiamondsInput] = useState('');
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [confirmClearSkills, setConfirmClearSkills] = useState(false);

  const [isCategoryFilterModalOpen, setIsCategoryFilterModalOpen] = useState(false);
  const [selectedFolderFilters, setSelectedFolderFilters] = useState(() => {
    try {
      const saved = localStorage.getItem('selected_folder_filters_v1');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('selected_folder_filters_v1', JSON.stringify(selectedFolderFilters));
    } catch (e) {}
  }, [selectedFolderFilters]);

  const [selectedFolderInList, setSelectedFolderInList] = useState('');
  
  const [isFolderDropdownOpen, setIsFolderDropdownOpen] = useState(false);
  const [deletingFolderName, setDeletingFolderName] = useState(null);
  const [deletedFolders, setDeletedFolders] = useState(() => {
    try {
      const saved = localStorage.getItem('rpg_deleted_folders_v1');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('rpg_deleted_folders_v1', JSON.stringify(deletedFolders));
    } catch (e) {}
  }, [deletedFolders]);

  const [editingFolderName, setEditingFolderName] = useState(null);
  const [tempFolderNameInput, setTempFolderNameInput] = useState('');

  const handleRenameFolder = (oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || oldName === 'Geral' || oldName === trimmed) {
      setEditingFolderName(null);
      return;
    }
    playSound('click');

    setSkills((prevSkills) =>
      prevSkills.map((s) => {
        if ((s.folder || 'Geral').trim() === oldName) {
          return { ...s, folder: trimmed };
        }
        return s;
      })
    );

    setDeletedFolders((prev) => [...new Set([...prev, oldName])].filter((f) => f !== trimmed));

    if (addFolder) addFolder(trimmed);

    setSelectedFolderFilters((prev) =>
      prev.map((f) => (f === oldName ? trimmed : f))
    );

    setEditingFolderName(null);
  };

  const [draggedFolderName, setDraggedFolderName] = useState(null);
  const [dragOverFolderName, setDragOverFolderName] = useState(null);

  const [customFolderOrder, setCustomFolderOrder] = useState(() => {
    try {
      const saved = localStorage.getItem('rpg_custom_folder_order_v1');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('rpg_custom_folder_order_v1', JSON.stringify(customFolderOrder));
    } catch (e) {}
  }, [customFolderOrder]);

  const reorderFolders = (fromFolder, toFolder) => {
    if (fromFolder === toFolder) return;
    playSound('train');

    const rawList = Array.from(
      new Set([...(folders || []), 'Geral', ...skills.map((s) => s.folder || 'Geral')])
    ).filter((f) => Boolean(f) && !deletedFolders.includes(f));

    const currentOthers = rawList.filter((f) => f.toLowerCase() !== 'geral');

    if (customFolderOrder && customFolderOrder.length > 0) {
      currentOthers.sort((a, b) => {
        const idxA = customFolderOrder.indexOf(a);
        const idxB = customFolderOrder.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
    }

    const fromIndex = currentOthers.indexOf(fromFolder);
    if (fromIndex === -1) return;

    currentOthers.splice(fromIndex, 1);

    if (toFolder.toLowerCase() === 'geral') {
      currentOthers.unshift(fromFolder);
    } else {
      const toIndex = currentOthers.indexOf(toFolder);
      if (toIndex !== -1) {
        currentOthers.splice(toIndex, 0, fromFolder);
      } else {
        currentOthers.push(fromFolder);
      }
    }

    setCustomFolderOrder(currentOthers);
    setFolderSortOrder('default');
  };

  const handleDeleteFolder = (folderName) => {
    if (folderName === 'Geral') return;
    playSound('delete');

    setSkills((prevSkills) =>
      prevSkills.map((s) => {
        if ((s.folder || 'Geral').trim() === folderName) {
          return { ...s, folder: 'Geral' };
        }
        return s;
      })
    );

    setDeletedFolders((prev) => [...new Set([...prev, folderName])]);
    setSelectedFolderFilters((prev) => prev.filter((f) => f !== folderName));
  };

  const [draggedSkillId, setDraggedSkillId] = useState(null);
  const [dragOverFolder, setDragOverFolder] = useState(null);
  const [folderSortOrder, setFolderSortOrder] = useState('default');
  const [folderCardContextMenu, setFolderCardContextMenu] = useState(null);

  const [draggedLayoutIdx, setDraggedLayoutIdx] = useState(null);
  const [dragOverLayoutIdx, setDragOverLayoutIdx] = useState(null);

  const [folderSearchQuery, setFolderSearchQuery] = useState('');
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [newFolderNameModalInput, setNewFolderNameModalInput] = useState('');

  const [colorPickerTarget, setColorPickerTarget] = useState('new');
  const [pickedColorHex, setPickedColorHex] = useState('#ff007f');
  const [newColorName, setNewColorName] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newFolderSelect, setNewFolderSelect] = useState('Geral');
  const [isCreatingFolderInModal, setIsCreatingFolderInModal] = useState(false);
  const [newCustomFolderInput, setNewCustomFolderInput] = useState('');
  const [newMaxLevel, setNewMaxLevel] = useState(10);
  const [newColor, setNewColor] = useState('#3b82f6');

  const [editingSkill, setEditingSkill] = useState(null);
  const [shakingSkillId, setShakingSkillId] = useState(null);
  const [activeTasksSkill, setActiveTasksSkill] = useState(null);
  const [isCustomMaxLevelInput, setIsCustomMaxLevelInput] = useState(false);

  const [contextMenu, setContextMenu] = useState(null);
  const [globalContextMenu, setGlobalContextMenu] = useState(null);

  const [isBatchSelectMode, setIsBatchSelectMode] = useState(false);
  const [selectedBatchIds, setSelectedBatchIds] = useState([]);
  const [batchConfirmDelete, setBatchConfirmDelete] = useState(false);

  const fileInputRef = useRef(null);
  const holdIntervalRef = useRef(null);
  const holdTimeoutRef = useRef(null);
  const touchTimerRef = useRef(null);

  const closeAllModals = () => {
    let closedSomething = false;

    if (
      isSearchOpen ||
      isHackModalOpen ||
      isMissionsModalOpen ||
      isMiniMissionsModalOpen ||
      isCategoryFilterModalOpen ||
      isCreateFolderModalOpen ||
      isXpHistoryModalOpen ||
      isMailModalOpen ||
      isProfileModalOpen ||
      isNewProfileModalOpen ||
      isNewProfileEmojiPickerOpen ||
      isEmojiPickerOpen ||
      isSettingsModalOpen ||
      isBoxColorModalOpen ||
      isSkillSettingsModalOpen ||
      isCommandsModalOpen ||
      isLevelInfoModalOpen ||
      isCustomColorModalOpen ||
      isThemeModalOpen ||
      activeTasksSkill ||
      isAddModalOpen ||
      editingSkill ||
      isLayoutEditorOpen ||
      isManageSkillsModalOpen ||
      contextMenu ||
      folderCardContextMenu ||
      globalContextMenu
    ) {
      closedSomething = true;
    }

    setIsSearchOpen(false);
    setIsHackModalOpen(false);
    setIsMissionsModalOpen(false);
    setIsEditMissionsModalOpen(false);
    setIsMiniMissionsModalOpen(false);
    setIsCategoryFilterModalOpen(false);
    setIsCreateFolderModalOpen(false);
    setIsXpHistoryModalOpen(false);
    setIsMailModalOpen(false);
    setIsProfileModalOpen(false);
    setIsNewProfileModalOpen(false);
    setIsNewProfileEmojiPickerOpen(false);
    setIsEmojiPickerOpen(false);
    setIsSettingsModalOpen(false);
    setIsBoxColorModalOpen(false);
    setIsSkillSettingsModalOpen(false);
    setIsCommandsModalOpen(false);
    setIsLevelInfoModalOpen(false);
    setIsCustomColorModalOpen(false);
    setIsThemeModalOpen(false);
    setActiveTasksSkill(null);
    setIsAddModalOpen(false);
    setEditingSkill(null);
    setIsLayoutEditorOpen(false);
    setIsManageSkillsModalOpen(false);
    setContextMenu(null);
    setFolderCardContextMenu(null);
    setGlobalContextMenu(null);

    return closedSomething;
  };

  const handleCardTouchStart = (e, skill, isFolderCard = false) => {
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;

    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);

    touchTimerRef.current = setTimeout(() => {
      playSound('click');
      const pos = getClampedMenuPos(clientX, clientY, 220, 180);
      if (isFolderCard) {
        setFolderCardContextMenu({ x: pos.x, y: pos.y, skill });
      } else {
        setContextMenu({ x: pos.x, y: pos.y, skill, confirmDelete: false });
      }
    }, 500);
  };

  const handleCardTouchEndOrMove = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  useEffect(() => {
    setTempNickname(nickname);
  }, [nickname]);

  useEffect(() => {
    const getGameDayKey = (date = new Date()) => {
      const d = new Date(date);
      d.setHours(d.getHours() - 4);
      return d.toISOString().split('T')[0];
    };

    const currentGameDay = getGameDayKey();
    const lastResetGameDay = localStorage.getItem('last_daily_missions_reset_day');

    if (lastResetGameDay !== currentGameDay) {
      resetDailyMissionsHack();
      resetRefreshesCountHack();
      localStorage.setItem('last_daily_missions_reset_day', currentGameDay);
    }
  }, [resetDailyMissionsHack, resetRefreshesCountHack]);
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const keyLower = e.key ? e.key.toLowerCase() : '';

      const isHackTrigger = isCtrlOrCmd && e.shiftKey && (e.code === 'KeyH' || keyLower === 'h');

      if (isHackTrigger) {
        e.preventDefault();
        e.stopPropagation();
        playSound('train');
        setIsHackModalOpen((prev) => !prev);
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        playSound('click');
        const closed = closeAllModals();
        if (!closed) {
          setIsSettingsModalOpen(true);
        }
        return;
      }

      const activeElem = document.activeElement;
      const isEditingText =
        activeElem &&
        (activeElem.tagName === 'INPUT' ||
          activeElem.tagName === 'TEXTAREA' ||
          activeElem.isContentEditable);

      if (isCtrlOrCmd && e.code === 'Space') {
        e.preventDefault();
        playSound('click');
        setIsAddModalOpen(true);
        return;
      }

      if (e.code === 'Space' && !isEditingText && !isSearchOpen) {
        e.preventDefault();
        playSound('click');
        setIsSearchOpen(true);
        return;
      }

      if (isEditingText) return;

      if (isCtrlOrCmd) {
        if (keyLower === 'z' && !e.shiftKey) {
          e.preventDefault();
          playSound('click');
          undo();
        } else if (keyLower === 'y' || (keyLower === 'z' && e.shiftKey)) {
          e.preventDefault();
          playSound('click');
          redo();
        }
        return;
      }

      if (keyLower === 'c') {
        e.preventDefault();
        playSound('click');
        setIsThemeModalOpen((prev) => !prev);
      } else if (keyLower === 'p') {
        e.preventDefault();
        playSound('click');
        setIsProfileModalOpen((prev) => !prev);
      } else if (keyLower === 'g') {
        e.preventDefault();
        playSound('click');
        setIsCategoryFilterModalOpen((prev) => !prev);
      } else if (keyLower === 'o') {
        e.preventDefault();
        playSound('click');
        setIsManageSkillsModalOpen((prev) => !prev);
      } else if (keyLower === 'a') {
        e.preventDefault();
        playSound('click');
        setIsEmojiPickerOpen((prev) => !prev);
      } else if (keyLower === 'm') {
        e.preventDefault();
        playSound('click');
        setIsMissionsModalOpen((prev) => !prev);
      } else if (keyLower === 'e') {
        e.preventDefault();
        playSound('click');
        setIsLayoutEditorOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [undo, redo, isSearchOpen]);

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
      setFolderCardContextMenu(null);
      setGlobalContextMenu(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const activeThemePreset = THEME_PRESETS.find((t) => t.id === currentTheme) || THEME_PRESETS[0];
  const activeDeckColors = getActiveDeckColors();

  const pendingMissionsCount = dailyMissions ? dailyMissions.filter((m) => !m.completed).length : 0;
  const mailIcon = pendingMissionsCount > 0 ? '📫' : '📪';

  const getCardStyle = (isMax, skillColor) => {
    const styleObj = {
      '--skill-accent': isMax ? '#eab308' : skillColor,
      cursor: 'pointer'
    };
    if (boxColorType === 'theme') {
      styleObj.backgroundColor = activeThemePreset.boxBg;
      styleObj.borderColor = activeThemePreset.border;
    }
    return styleObj;
  };

  const stopHold = () => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
  };

  const startHoldAction = (actionFn) => {
    stopHold();
    actionFn();

    holdTimeoutRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(() => {
        actionFn();
      }, 60);
    }, 250);
  };

  const handleOpenNewProfileModal = () => {
    playSound('click');
    setNewProfileName('');
    setNewProfileAvatar('🛡');
    setIsNewProfileModalOpen(true);
  };

  const handleCreateNewProfile = (e) => {
    if (e) e.preventDefault();
    if (!newProfileName.trim()) return;
    playSound('train');
    createProfile(newProfileName.trim(), newProfileAvatar);
    setIsNewProfileModalOpen(false);
    setIsProfileModalOpen(false);
  };

  const handleSendTransfer = (sourceId, targetId, mode) => {
    if (!sourceId || !targetId || sourceId === targetId) return;

    playSound('train');
    const success = sendTransferRequest(sourceId, targetId, mode);

    if (success) {
      const targetProf = profiles.find((p) => p.id === targetId);
      setTransferNoticeMessage(`Carta enviada com sucesso para "${targetProf ? targetProf.name : 'Perfil'}"! Aguardando aceite.`);
      setTransferStep('sent_success');
    } else {
      setTransferNoticeMessage('Não foi possível enviar. Verifique se o perfil de origem possui XP.');
    }
  };

  const handleSaveNickname = () => {
    playSound('click');
    if (tempNickname.trim()) {
      setNickname(tempNickname.trim());
    } else {
      setTempNickname(nickname);
    }
    setIsEditingNickname(false);
  };

  const handleEmojiClick = (emojiData) => {
    playSound('click');
    setAvatar(emojiData.emoji);
    setIsEmojiPickerOpen(false);
  };

  const handleTrainClick = (skill, isBlockedByChecklist) => {
    if (isBlockedByChecklist) {
      playSound('error');
      setShakingSkillId(skill.id);
      setTimeout(() => setShakingSkillId(null), 500);
      return;
    }

    playSound('train');
    const isMaxedNow = trainSkill(skill.id);
    if (isMaxedNow) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
    }
  };

  const handleOpenAddModalForFolder = (folderName) => {
    playSound('click');
    setNewTitle('');
    setNewCategory('');
    setNewFolderSelect(folderName || 'Geral');
    setIsCreatingFolderInModal(false);
    setNewCustomFolderInput('');
    setNewMaxLevel(10);
    setNewColor(activeDeckColors[0]?.hex || '#3b82f6');
    setIsAddModalOpen(true);
  };

  const handleCreateSkill = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    playSound('click');

    let targetFolder = newFolderSelect;
    if (isCreatingFolderInModal && newCustomFolderInput.trim()) {
      targetFolder = newCustomFolderInput.trim();
      addFolder(targetFolder);
    }

    addSkill(newTitle, newCategory, newMaxLevel, newColor, targetFolder || 'Geral');

    setNewTitle('');
    setNewCategory('');
    setNewFolderSelect('Geral');
    setIsCreatingFolderInModal(false);
    setNewCustomFolderInput('');
    setNewMaxLevel(10);
    setNewColor(activeDeckColors[0]?.hex || '#3b82f6');
    setIsAddModalOpen(false);
  };

  const handleSaveEdit = (e) => {
    if (e) e.preventDefault();
    if (!editingSkill) return;
    playSound('click');
    updateSkill(editingSkill.id, editingSkill);
    setEditingSkill(null);
  };

  const handleLinkNewSkillInSameCategory = () => {
    if (!editingSkill) return;
    playSound('click');
    updateSkill(editingSkill.id, editingSkill);

    const currentCat = editingSkill.category || 'Geral';
    const currentColor = editingSkill.color || '#3b82f6';
    const currentFolder = editingSkill.folder || 'Geral';

    setEditingSkill(null);

    setNewTitle('');
    setNewCategory(currentCat);
    setNewFolderSelect(currentFolder);
    setIsCreatingFolderInModal(false);
    setNewColor(currentColor);
    setNewMaxLevel(10);

    setIsAddModalOpen(true);
  };

  const handleLevelDescChange = (lvl, text) => {
    setEditingSkill((prev) => ({
      ...prev,
      levelDescriptions: {
        ...(prev.levelDescriptions || {}),
        [lvl]: text
      }
    }));
  };

  const handleAddTaskToLevel = (lvl) => {
    playSound('click');
    const currentTasks = editingSkill.levelTasks?.[lvl] || [];
    const newTask = {
      id: `task_${Date.now()}`,
      text: '',
      done: false
    };

    setEditingSkill((prev) => ({
      ...prev,
      levelTasks: {
        ...(prev.levelTasks || {}),
        [lvl]: [...currentTasks, newTask]
      }
    }));
  };

  const handleToggleTaskInModal = (lvl, taskId) => {
    playSound('click');
    const currentTasks = editingSkill.levelTasks?.[lvl] || [];
    const updated = currentTasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));

    setEditingSkill((prev) => ({
      ...prev,
      levelTasks: {
        ...(prev.levelTasks || {}),
        [lvl]: updated
      }
    }));
  };

  const handleUpdateTaskText = (lvl, taskId, text) => {
    const currentTasks = editingSkill.levelTasks?.[lvl] || [];
    const updated = currentTasks.map((t) => (t.id === taskId ? { ...t, text } : t));

    setEditingSkill((prev) => ({
      ...prev,
      levelTasks: {
        ...(prev.levelTasks || {}),
        [lvl]: updated
      }
    }));
  };

  const handleDeleteTask = (lvl, taskId) => {
    playSound('delete');
    const currentTasks = editingSkill.levelTasks?.[lvl] || [];
    const updated = currentTasks.filter((t) => t.id !== taskId);

    setEditingSkill((prev) => ({
      ...prev,
      levelTasks: {
        ...(prev.levelTasks || {}),
        [lvl]: updated
      }
    }));
  };

  const handleOpenColorPickerModal = (targetContext, currentColorHex) => {
    playSound('click');
    setColorPickerTarget(targetContext);
    setPickedColorHex(currentColorHex || '#ff007f');
    setNewColorName('');
    setIsCustomColorModalOpen(true);
  };

  const handleApplyCustomColorDirectly = (colorHex) => {
    playSound('click');
    if (colorPickerTarget === 'new') {
      setNewColor(colorHex);
    } else if (colorPickerTarget === 'editing' && editingSkill) {
      setEditingSkill((prev) => ({ ...prev, color: colorHex }));
    }
    setIsCustomColorModalOpen(false);
  };

  const handleSaveColorToDeckAndApply = () => {
    playSound('click');
    addCustomColorToDeck(newColorName || 'Nova Cor', pickedColorHex);
    handleApplyCustomColorDirectly(pickedColorHex);
  };

  const handleExportData = () => {
    playSound('click');
    const baseExport = exportAllData();

    let savedTasks = null;
    try {
      const rawTasks = localStorage.getItem('task_update_lists_v1');
      if (rawTasks) savedTasks = JSON.parse(rawTasks);
    } catch (e) {}

    const exportObject = {
      ...baseExport,
      taskUpdateLists: savedTasks || taskState?.taskLists || taskState?.lists || [],
      taskUpdateLang: localStorage.getItem('task_update_lang_v1') || taskState?.language || 'pt-BR',
      pomodoroPresets: pomodoro?.modePresets,
      pomodoroSound: pomodoro?.soundOption,
      folderCustomOrder: JSON.parse(localStorage.getItem('rpg_custom_folder_order_v1') || '[]'),
      folderDeletedList: JSON.parse(localStorage.getItem('rpg_deleted_folders_v1') || '[]'),
      folderFilters: JSON.parse(localStorage.getItem('selected_folder_filters_v1') || '[]')
    };

    const now = new Date();
    const fileName = `skill-tree-backup-${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}.json`;

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObject, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', fileName);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleFileChange = (e) => {
    const fileReader = new FileReader();
    const file = e.target.files[0];

    if (file) {
      fileReader.readAsText(file, 'UTF-8');
      fileReader.onload = (event) => {
        try {
          const parsedData = JSON.parse(event.target.result);

          const success = importData(parsedData);

          if (parsedData.taskUpdateLists) {
            localStorage.setItem('task_update_lists_v1', JSON.stringify(parsedData.taskUpdateLists));
          }
          if (parsedData.taskUpdateLang) {
            localStorage.setItem('task_update_lang_v1', parsedData.taskUpdateLang);
          }
          if (parsedData.pomodoroPresets) {
            localStorage.setItem('pomodoro_mode_presets_v3', JSON.stringify(parsedData.pomodoroPresets));
          }
          if (parsedData.pomodoroSound) {
            localStorage.setItem('pomodoro_saved_sound_option', parsedData.pomodoroSound);
          }

          if (parsedData.folderCustomOrder) {
            localStorage.setItem('rpg_custom_folder_order_v1', JSON.stringify(parsedData.folderCustomOrder));
          }
          if (parsedData.folderDeletedList) {
            localStorage.setItem('rpg_deleted_folders_v1', JSON.stringify(parsedData.folderDeletedList));
          }
          if (parsedData.folderFilters) {
            localStorage.setItem('selected_folder_filters_v1', JSON.stringify(parsedData.folderFilters));
          }

          if (success) {
            playSound('train');
            setIsSettingsModalOpen(false);
            window.location.reload();
          } else {
            playSound('error');
          }
        } catch (error) {
          playSound('error');
        }
      };
    }
  };

  const handleContextMenu = (e, skill) => {
    e.preventDefault();
    e.stopPropagation();
    playSound('click');
    const pos = getClampedMenuPos(e.clientX, e.clientY, 220, 180);
    setContextMenu({
      x: pos.x,
      y: pos.y,
      skill,
      confirmDelete: false
    });
  };

  const handleGlobalContextMenu = (e) => {
    if (e.target.closest('button, input, select, textarea, .skill-card, .clickable-xp-history-box, .avatar-circle, .subtle-side-rail, .top-icon-button, .custom-context-menu, .modal-backdrop')) {
      return;
    }
    e.preventDefault();
    playSound('click');
    const pos = getClampedMenuPos(e.clientX, e.clientY, 230, 160);
    setGlobalContextMenu({
      x: pos.x,
      y: pos.y
    });
  };

  const handleDropSkillToFolder = (targetFolderName) => {
    if (!draggedSkillId || !targetFolderName) return;
    playSound('train');
    moveSkillToFolder(draggedSkillId, targetFolderName);
    setDraggedSkillId(null);
    setDragOverFolder(null);
  };

  const handleConfirmCreateFolderModal = (e) => {
    if (e) e.preventDefault();
    if (!newFolderNameModalInput.trim()) return;
    playSound('click');
    addFolder(newFolderNameModalInput.trim());
    setNewFolderNameModalInput('');
    setIsCreateFolderModalOpen(false);
  };

  const renderSegmentBars = (level, maxLevel, skillColor, isMax) => {
    const MAX_VISUAL_SEGMENTS = 20;
    const totalSegments = Math.min(maxLevel, MAX_VISUAL_SEGMENTS);
    const levelsPerSegment = maxLevel / totalSegments;

    return Array.from({ length: totalSegments }).map((_, idx) => {
      const segmentStartLvl = idx * levelsPerSegment;
      const segmentEndLvl = (idx + 1) * levelsPerSegment;

      let isFilled = false;
      let opacity = 0.2;

      if (level >= segmentEndLvl) {
        isFilled = true;
        opacity = 1;
      } else if (level > segmentStartLvl) {
        isFilled = true;
        const fraction = (level - segmentStartLvl) / levelsPerSegment;
        opacity = 0.4 + fraction * 0.6;
      }

      const activeColor = isMax ? '#eab308' : skillColor;

      return (
        <div
          key={idx}
          className={`segment-item ${isFilled ? 'filled' : ''}`}
          style={{
            backgroundColor: isFilled ? activeColor : undefined,
            opacity: isFilled ? opacity : undefined,
            boxShadow: isFilled
              ? isMax
                ? '0 0 10px #facc15, 0 0 5px #eab308'
                : `0 0 8px ${activeColor}`
              : undefined
          }}
        />
      );
    });
  };

  const getOrderedSkills = (skillsList) => {
    if (!linkSkillsByCategory) return skillsList;

    const categoryOrder = [];
    const categoryGroups = {};

    skillsList.forEach((skill) => {
      const catKey = (skill.category || 'Geral').trim().toLowerCase();
      if (!categoryGroups[catKey]) {
        categoryGroups[catKey] = [];
        categoryOrder.push(catKey);
      }
      categoryGroups[catKey].push(skill);
    });

    const result = [];
    categoryOrder.forEach((catKey) => {
      result.push(...categoryGroups[catKey]);
    });

    return result;
  };

  const rawVisibleSkills = skills.filter((s) => {
    if (hiddenSkillIds.includes(s.id)) return false;
    if (selectedFolderFilters.length > 0) {
      const folderName = (s.folder || 'Geral').trim();
      return selectedFolderFilters.includes(folderName);
    }
    return true;
  });

  const visibleSkills = getOrderedSkills(rawVisibleSkills);
  const hiddenSkills = skills.filter((s) => hiddenSkillIds.includes(s.id));

  const RANK_MILESTONES = [
    { level: 1, rank: 'Aprendiz I' },
    { level: 40, rank: 'Aprendiz II' },
    { level: 80, rank: 'Aprendiz III' },
    { level: 120, rank: 'Intermediário I' },
    { level: 160, rank: 'Intermediário II' },
    { level: 200, rank: 'Intermediário III' },
    { level: 240, rank: 'Especialista I' },
    { level: 280, rank: 'Especialista II' },
    { level: 320, rank: 'Especialista III' },
    { level: 360, rank: 'Mestre I' },
    { level: 440, rank: 'Mestre III' },
    { level: 480, rank: 'Mago Supremo (Máximo)' }
  ];

  const rawAvailableFolders = Array.from(
    new Set([...(folders || []), 'Geral', ...skills.map((s) => s.folder || 'Geral')])
  ).filter((f) => Boolean(f) && !deletedFolders.includes(f));

  const geralFolderName = rawAvailableFolders.find((f) => f.toLowerCase() === 'geral') || 'Geral';
  const otherFolders = rawAvailableFolders.filter((f) => f.toLowerCase() !== 'geral');

if (folderSortOrder === 'a-z') {
    otherFolders.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  } else if (folderSortOrder === 'z-a') {
    otherFolders.sort((a, b) => b.localeCompare(a, 'pt-BR', { sensitivity: 'base' }));
  } else if (folderSortOrder === 'more-skills') {
    otherFolders.sort((a, b) => {
      const countA = skills.filter((s) => (s.folder || 'Geral').trim() === a).length;
      const countB = skills.filter((s) => (s.folder || 'Geral').trim() === b).length;
      return countB - countA;
    });
  } else if (folderSortOrder === 'less-skills') {
    otherFolders.sort((a, b) => {
      const countA = skills.filter((s) => (s.folder || 'Geral').trim() === a).length;
      const countB = skills.filter((s) => (s.folder || 'Geral').trim() === b).length;
      return countA - countB;
    });
  } else if (folderSortOrder === 'newest') {
    otherFolders.sort((a, b) => rawAvailableFolders.indexOf(b) - rawAvailableFolders.indexOf(a));
  } else if (folderSortOrder === 'oldest') {
    otherFolders.sort((a, b) => rawAvailableFolders.indexOf(a) - rawAvailableFolders.indexOf(b));
  } else if (customFolderOrder && customFolderOrder.length > 0) {
    otherFolders.sort((a, b) => {
      const idxA = customFolderOrder.indexOf(a);
      const idxB = customFolderOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return 0;
    });
  }

  const sortedAvailableFolders = [geralFolderName, ...otherFolders];
  const queryClean = folderSearchQuery.trim().toLowerCase();

  const filteredFoldersToRender = sortedAvailableFolders.filter((folderName) => {
    if (!queryClean) return true;
    const folderMatches = folderName.toLowerCase().includes(queryClean);
    const folderSkills = skills.filter((s) => (s.folder || 'Geral').trim() === folderName);
    const skillMatches = folderSkills.some(
      (s) =>
        (s.title || s.name || '').toLowerCase().includes(queryClean) ||
        (s.category && s.category.toLowerCase().includes(queryClean))
    );
    return folderMatches || skillMatches;
  });

  return (
    <div
      className="app-screen"
      onContextMenu={handleGlobalContextMenu}
      onTouchStart={(e) => {
        if (e.target.closest('button, input, select, textarea, .skill-card, .clickable-xp-history-box, .avatar-circle, .subtle-side-rail, .top-icon-button, .custom-context-menu, .modal-backdrop')) {
          return;
        }
        const touch = e.touches[0];
        const clientX = touch.clientX;
        const clientY = touch.clientY;
        if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
        touchTimerRef.current = setTimeout(() => {
          playSound('click');
          const pos = getClampedMenuPos(clientX, clientY, 230, 160);
          setGlobalContextMenu({ x: pos.x, y: pos.y });
        }, 500);
      }}
      onTouchEnd={handleCardTouchEndOrMove}
      onTouchMove={handleCardTouchEndOrMove}
      style={{
        background: activeThemePreset.bg,
        '--theme-accent': activeThemePreset.color,
        '--theme-modal-bg': activeThemePreset.modalBg,
        '--theme-border': activeThemePreset.border
      }}
    >
      <div className="top-left-nav-buttons" style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <button
            className="top-icon-button"
            title="Alternar / Gerenciar Perfis (P)"
            onClick={() => {
              playSound('click');
              setDeletingProfileId(null);
              setTransferSourceId(null);
              setIsProfileModalOpen(true);
            }}
          >
            👤
          </button>

          <button
            className="top-icon-button"
            title="Pomodoro (R)"
            onClick={() => {
              playSound('click');
              pomodoro.toggleModal();
            }}
          >
            ⏱️
          </button>

          <button
            className="top-icon-button"
            title="Tarefas (T)"
            onClick={() => {
              playSound('click');
              taskState.toggleModal();
            }}
            style={{ position: 'relative' }}
          >
            📋
            <TaskBadge taskState={taskState} />
          </button>
        </div>

        <button
          className="top-icon-button"
          onClick={() => { playSound('click'); setIsMissionsModalOpen(true); }}
          title="Missões Diárias e Diamantes (M)"
          style={{ position: 'relative' }}
        >
          {mailIcon}
          {pendingMissionsCount > 0 && (
            <span className="subtle-mission-badge" title={`${pendingMissionsCount} missão(ões) para concluir!`}>
              {pendingMissionsCount}
            </span>
          )}
        </button>

        <TaskAlert taskState={taskState} />

        {pendingTransfers && pendingTransfers.length > 0 && (
          <button
            className="top-icon-button mail-badge-btn pulse-glow"
            title={`Você tem ${pendingTransfers.length} solicitação(ões) de transferência!`}
            onClick={() => { playSound('click'); setIsMailModalOpen(true); }}
            style={{ position: 'relative', background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)', color: '#000' }}
          >
            ✉
            <span className="mail-count-badge">{pendingTransfers.length}</span>
          </button>
        )}
      </div>

      <div className="top-nav-buttons">
        <button
          className="top-icon-button"
          title="Editor de Layouts / Habilidades (E)"
          onClick={() => { playSound('click'); setIsLayoutEditorOpen(true); }}
        >
          ✏️
        </button>
        <button
          className="top-icon-button"
          title="Customizar Tema (C)"
          onClick={() => { playSound('click'); setIsThemeModalOpen(true); }}
        >
          🎨
        </button>
        <button
          className="top-icon-button"
          title="Configurações (Esc)"
          onClick={() => { playSound('click'); setIsSettingsModalOpen(true); }}
        >
          ⚙
        </button>
      </div>

      <div className="dashboard-container">
        <aside className="character-panel">
          <div className="avatar-wrapper-relative" style={{ position: 'relative', display: 'inline-block' }}>
            <div
              className="avatar-circle"
              onClick={() => {
                playSound('click');
                setIsEmojiPickerOpen(true);
              }}
              title="Clique para escolher um novo emoji (A)"
            >
              {avatar}
            </div>

            {pendingTransfers && pendingTransfers.length > 0 && (
              <button
                className="floating-avatar-mail-btn pulse-glow"
                onClick={() => { playSound('click'); setIsMailModalOpen(true); }}
                title="Abrir carta de transferência de XP / Habilidades"
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-6px',
                  background: '#facc15',
                  border: '2px solid #000',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 5
                }}
              >
                ✉️
              </button>
            )}
          </div>

          <div className="nickname-container">
            {isEditingNickname ? (
              <input
                type="text"
                className="nickname-input"
                value={tempNickname}
                onChange={(e) => setTempNickname(e.target.value)}
                onBlur={handleSaveNickname}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveNickname()}
                autoFocus
                maxLength={20}
              />
            ) : (
              <>
                <h2
                  className="hero-nickname"
                  onClick={() => { playSound('click'); setIsEditingNickname(true); }}
                  title="Clique para editar Nickname"
                >
                  {nickname}
                </h2>
                <button
                  type="button"
                  className="edit-nickname-btn"
                  onClick={() => { playSound('click'); setIsEditingNickname(true); }}
                  title="Editar Nickname"
                >
                  ✎
                </button>
              </>
            )}
          </div>

          <div className="level-badge-row">
            <span className="hero-level-title">{t('hero_level', 'Nível')} {playerLevel}</span>
            <button
              type="button"
              className="inspect-level-btn"
              onClick={() => { playSound('click'); setIsLevelInfoModalOpen(true); }}
              title="Ver tabela de patentes e pontuação"
            >
              📊 {t('hero_inspect_levels', 'Ver Níveis')}
            </button>
          </div>
          <span className="hero-rank">{getRankTitle(playerLevel)}</span>

          <div
            className="xp-box clickable-xp-history-box"
            onClick={() => { playSound('click'); setIsXpHistoryModalOpen(true); }}
            title="Clique para ver o Histórico de XP completo"
            style={{ cursor: 'pointer' }}
          >
            <div className="xp-labels">
              <span>XP Geral</span>
              <span>{currentXpProgress} / {xpNeededForNext}</span>
            </div>
            <div className="xp-track">
              <div
                className="xp-fill"
                style={{ width: `${Math.min(100, (currentXpProgress / xpNeededForNext) * 100)}%` }}
              />
            </div>
          </div>

          <div className="diamonds-box">
            <span className="diamonds-icon">💎</span>
            <span className="diamonds-count">{diamonds || 0} Diamantes</span>
          </div>
        </aside>

        <main className="skills-panel">
          <div className="skills-header-container">
            <h1 className="panel-title">Skills Upgrades</h1>
            <div className="header-action-row-right">
              <button
                type="button"
                className="show-categories-trigger"
                onClick={() => { playSound('click'); setIsCategoryFilterModalOpen(true); }}
                title="Gerenciar pastas e visibilidade (G)"
              >
                mostrar+
              </button>
              <button
                type="button"
                className="show-categories-trigger search-trigger-btn"
                onClick={() => { playSound('click'); setIsSearchOpen(true); }}
                title="Buscar habilidade (Espaço)"
              >
                buscar+
              </button>
            </div>
          </div>

          <div className="skills-list">
            {visibleSkills.map((skill, index) => {
              const isMax = skill.level >= skill.maxLevel;
              const skillColor = skill.color || '#3b82f6';

              const nextLevelNumber = skill.level + 1;
              const nextGoalText =
                skill.levelDescriptions?.[nextLevelNumber] ||
                `Meta do Nível ${nextLevelNumber}`;

              const currentTasks = skill.levelTasks?.[nextLevelNumber] || [];
              const pendingTasks = currentTasks.filter((t) => !t.done);
              const isBlockedByChecklist = !isMax && pendingTasks.length > 0;
              const isShaking = shakingSkillId === skill.id;

              const nextSkill = visibleSkills[index + 1];
              const isSameCategoryWithNext =
                nextSkill &&
                (skill.category || 'Geral').trim().toLowerCase() ===
                  (nextSkill.category || 'Geral').trim().toLowerCase();

              return (
                <div
                  key={skill.id}
                  className={`skill-card-wrapper ${isSameCategoryWithNext ? 'has-next-same-cat' : ''}`}
                >
                  <div
                    onContextMenu={(e) => handleContextMenu(e, skill)}
                    onTouchStart={(e) => handleCardTouchStart(e, skill, false)}
                    onTouchEnd={handleCardTouchEndOrMove}
                    onTouchMove={handleCardTouchEndOrMove}
                    onClick={(e) => {
                      if (e.target.closest('button') || e.target.closest('input')) return;
                      playSound('click');
                      setEditingSkill({ ...skill });
                      setIsCustomMaxLevelInput(false);
                    }}
                    className={`skill-card ${isMax ? 'gold-maxed' : ''} ${isShaking ? 'shake-warning' : ''}`}
                    style={getCardStyle(isMax, skillColor)}
                  >
                    <button
                      className="gear-button"
                      onClick={() => {
                        playSound('click');
                        setEditingSkill({ ...skill });
                        setIsCustomMaxLevelInput(false);
                      }}
                      title="Configurar Habilidade"
                    >
                      ⚙
                    </button>

                    <div className="skill-details">
                      <div className="skill-name">{skill.title || skill.name}</div>
                      <div className="skill-category">{skill.category || 'Geral'}</div>
                    </div>

                    <div className="segments-center-zone">
                      <div className="current-goal-title">
                        {isMax ? 'Habilidade Dominada!' : nextGoalText}
                      </div>

                      {!isMax && currentTasks.length > 0 && (
                        <div className="tasks-indicator-wrapper">
                          <button
                            className={`tasks-toggle-btn ${pendingTasks.length > 0 ? 'has-pending' : 'all-done'}`}
                            onClick={() => { playSound('click'); setActiveTasksSkill(skill); }}
                          >
                            {pendingTasks.length > 0
                              ? `${pendingTasks.length} ${pendingTasks.length === 1 ? 'task pendente' : 'tasks pendentes'}`
                              : 'Todas as tasks concluídas'}
                          </button>
                        </div>
                      )}

                      <div className="segments-bar">
                        {renderSegmentBars(skill.level, skill.maxLevel, skillColor, isMax)}
                      </div>
                    </div>

                    <div className="level-text">Lvl {skill.level}</div>

                    <div className="action-button-stack">
                      <button
                        className={`plus-button ${isBlockedByChecklist ? 'blocked-pulse' : ''}`}
                        onClick={() => handleTrainClick(skill, isBlockedByChecklist)}
                        disabled={isMax}
                        title={isBlockedByChecklist ? 'Conclua as tasks pendentes para subir de nível!' : 'Aumentar Nível (+XP)'}
                        style={{
                          background: isMax
                            ? '#eab308'
                            : isBlockedByChecklist
                            ? '#334155'
                            : `linear-gradient(180deg, ${skillColor} 0%, #1d4ed8 100%)`
                        }}
                      >
                        {isMax ? '✓' : '+'}
                      </button>

                      {isMax && (
                        <button
                          type="button"
                          className="hide-skill-mini-btn"
                          onClick={() => { playSound('click'); toggleHideSkill(skill.id); }}
                          title="Esconder habilidade completada"
                        >
                          −
                        </button>
                      )}
                    </div>
                  </div>

                  {isSameCategoryWithNext && (
                    <div
                      className="category-connector-line"
                      style={{ '--category-line-color': skillColor }}
                    />
                  )}
                </div>
              );
            })}

            <button
              className="add-skill-button"
              onClick={() => { playSound('click'); setIsAddModalOpen(true); }}
            >
              + Adicionar Nova Habilidade
            </button>
          </div>
        </main>

        <div
          className="subtle-side-rail"
          onClick={() => { playSound('click'); setIsManageSkillsModalOpen(true); }}
          title="Editar habilidades atuais e ver escondidas (O)"
        >
          <div className="rail-line-glow" />
          <div className="rail-plus-badge">+</div>
          <span className="rail-tooltip">Editar / Ocultas ({hiddenSkills.length})</span>
        </div>
      </div>

      {/* JANELA DE BUSCA (BUSCAR+) */}
      {isSearchOpen && (
        <div className="modal-backdrop high-z-backdrop" onClick={() => { playSound('click'); setIsSearchOpen(false); }}>
          <div className="modal-window search-modal-window high-z-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3>Buscar Habilidade</h3>
              <button className="close-popup-btn" onClick={() => { playSound('click'); setIsSearchOpen(false); }}>✕</button>
            </div>

            <input
              type="text"
              className="search-input-field"
              placeholder="Digite o nome da habilidade..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />

            <div className="search-results-list">
              {skills
                .filter((s) => (s.title || s.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
                .map((skill) => {
                  const isMax = skill.level >= skill.maxLevel;
                  const skillColor = skill.color || '#3b82f6';
                  const nextLevelNumber = skill.level + 1;
                  const nextGoalText = skill.levelDescriptions?.[nextLevelNumber] || `Meta do Nível ${nextLevelNumber}`;
                  const isHidden = hiddenSkillIds.includes(skill.id);

                  return (
                    <div
                      key={skill.id}
                      className={`skill-card compact-editor-card ${isMax ? 'gold-maxed' : ''}`}
                      style={getCardStyle(isMax, skillColor)}
                      onClick={() => {
                        playSound('click');
                        setEditingSkill({ ...skill });
                        setIsSearchOpen(false);
                      }}
                    >
                      <button
                        type="button"
                        className="gear-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          playSound('click');
                          setEditingSkill({ ...skill });
                          setIsSearchOpen(false);
                        }}
                      >
                        ⚙
                      </button>

                      <div className="skill-details">
                        <div className="skill-name">{skill.title || skill.name}</div>
                        <div className="skill-category">
                          {skill.category || 'Geral'} {isHidden ? '(Oculta)' : ''}
                        </div>
                      </div>

                      <div className="segments-center-zone">
                        <div className="current-goal-title">
                          {isMax ? 'Habilidade Dominada!' : nextGoalText}
                        </div>
                        <div className="segments-bar">
                          {renderSegmentBars(skill.level, skill.maxLevel, skillColor, isMax)}
                        </div>
                      </div>

                      <div className="level-text">Lvl {skill.level}</div>

                      <div className="editor-card-controls">
                        <button
                          type="button"
                          className="manage-edit-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            playSound('click');
                            setEditingSkill({ ...skill });
                            setIsSearchOpen(false);
                          }}
                        >
                          Abrir
                        </button>
                      </div>
                    </div>
                  );
                })}

              {searchQuery && skills.filter((s) => (s.title || s.name || '').toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                <p className="no-colors-msg">Nenhuma habilidade encontrada.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MENU HACK EXPANDIDO DO SISTEMA (CTRL + SHIFT + H) */}
      {isHackModalOpen && (
        <div className="modal-backdrop high-z-backdrop" onClick={() => setIsHackModalOpen(false)}>
          <div
            className="modal-window high-z-window"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '720px', width: '92vw', border: '2px solid #ef4444' }}
          >
            <div className="modal-header-row">
              <h3 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem' }}>
                ⚡ Menu Hack do Sistema
              </h3>
              <button className="close-popup-btn" onClick={() => setIsHackModalOpen(false)}>✕</button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.2rem 0 1rem 0' }}>
              Painel avançado de desenvolvedor para alteração direta de atributos do perfil ativo (<strong>{nickname}</strong>).
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '1rem' }}>
              <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--theme-border, #334155)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--theme-accent, #38bdf8)', fontWeight: 'bold' }}>⚡ XP Acumulado</span>
                  <span style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--theme-accent, #38bdf8)', border: '1px solid var(--theme-border, rgba(56, 189, 248, 0.3))', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.95rem', fontWeight: 'bold' }}>
                    {totalXp} XP
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Ajuste Rápido:</span>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="cancel-button"
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.82rem', fontWeight: 'bold' }}
                      onClick={() => { playSound('click'); setExtraXp((prev) => Math.max(0, prev - 10)); }}
                    >
                      -10 XP
                    </button>
                    <button
                      type="button"
                      className="confirm-button"
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.82rem', fontWeight: 'bold' }}
                      onClick={() => { playSound('train'); setExtraXp((prev) => prev + 10); }}
                    >
                      +10 XP
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.2rem' }}>
                  <input
                    type="number"
                    placeholder="Quantidade de XP"
                    value={hackXpInput}
                    onChange={(e) => setHackXpInput(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 0.6rem', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--theme-border, #334155)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                  />
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="confirm-button"
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                      onClick={() => {
                        playSound('train');
                        setExtraXp((prev) => Math.max(0, prev + Number(hackXpInput || 0)));
                        setHackXpInput('');
                      }}
                    >
                      + Somar XP
                    </button>
                    <button
                      type="button"
                      className="cancel-button"
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                      onClick={() => {
                        playSound('click');
                        setExtraXp(Math.max(0, Number(hackXpInput || 0)));
                        setHackXpInput('');
                      }}
                    >
                      Definir Exato
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--theme-border, #334155)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', color: '#facc15', fontWeight: 'bold' }}>💎 Diamantes Totais</span>
                  <span style={{ background: 'rgba(250, 204, 21, 0.15)', color: '#facc15', border: '1px solid rgba(250, 204, 21, 0.3)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.95rem', fontWeight: 'bold' }}>
                    {diamonds || 0} 💎
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Ajuste Rápido:</span>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="cancel-button"
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.82rem', fontWeight: 'bold' }}
                      onClick={() => { playSound('click'); setDiamonds((prev) => Math.max(0, prev - 1)); }}
                    >
                      -1 💎
                    </button>
                    <button
                      type="button"
                      className="confirm-button"
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.82rem', fontWeight: 'bold', background: '#eab308', color: '#000' }}
                      onClick={() => { playSound('train'); setDiamonds((prev) => prev + 1); }}
                    >
                      +1 💎
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.2rem' }}>
                  <input
                    type="number"
                    placeholder="Quantidade Diamantes"
                    value={hackDiamondsInput}
                    onChange={(e) => setHackDiamondsInput(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 0.6rem', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--theme-border, #334155)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                  />
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="confirm-button"
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem', background: '#eab308', color: '#000' }}
                      onClick={() => {
                        playSound('train');
                        setDiamonds((prev) => Math.max(0, prev + Number(hackDiamondsInput || 0)));
                        setHackDiamondsInput('');
                      }}
                    >
                      + Somar 💎
                    </button>
                    <button
                      type="button"
                      className="cancel-button"
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                      onClick={() => {
                        playSound('click');
                        setDiamonds(Math.max(0, Number(hackDiamondsInput || 0)));
                        setHackDiamondsInput('');
                      }}
                    >
                      Definir Exato
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--theme-border, #334155)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--theme-accent, #38bdf8)', fontWeight: 'bold' }}>📜 Missões de Hoje</span>
                  <span style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--theme-accent, #38bdf8)', border: '1px solid var(--theme-border, rgba(56, 189, 248, 0.3))', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    {dailyMissions ? dailyMissions.filter(m => !m.completed).length : 0} Disponíveis
                  </span>
                </div>

                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
                  Gera 5 novas missões não concluídas a partir das habilidades e reseta o status de conclusão diária.
                </p>

                <button
                  type="button"
                  className="confirm-button"
                  style={{ padding: '0.5rem', fontSize: '0.85rem', fontWeight: 'bold' }}
                  onClick={() => {
                    playSound('train');
                    resetDailyMissionsHack();
                  }}
                >
                  🔄 Zerar / Resetar 5 Missões de Hoje
                </button>
              </div>

              <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--theme-border, #334155)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', color: '#facc15', fontWeight: 'bold' }}>🎲 Sorteios de Missão</span>
                  <span style={{ background: 'rgba(250, 204, 21, 0.15)', color: '#facc15', border: '1px solid rgba(250, 204, 21, 0.3)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    {dailyRefreshesLeft} Restantes Hoje
                  </span>
                </div>

                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
                  Aumente a quantidade de sorteios para o dia ou resete o contador para 2/2.
                </p>

                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    className="confirm-button"
                    style={{ flex: 1, padding: '0.45rem', fontSize: '0.8rem', background: '#eab308', color: '#000', fontWeight: 'bold' }}
                    onClick={() => {
                      playSound('train');
                      addExtraRefreshesHack(1);
                    }}
                  >
                    +1 Sorteio Extra
                  </button>
                  <button
                    type="button"
                    className="cancel-button"
                    style={{ flex: 1, padding: '0.45rem', fontSize: '0.8rem' }}
                    onClick={() => {
                      playSound('click');
                      resetRefreshesCountHack();
                    }}
                  >
                    Resetar (2/2)
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid var(--theme-border, #334155)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '0.85rem', color: '#f8fafc' }}>Apagar Histórico XP</strong>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>Limpa os logs de evolução.</p>
                </div>
                {confirmClearHistory ? (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="confirm-yes-btn"
                      onClick={() => {
                        playSound('delete');
                        setXpHistory([]);
                        setConfirmClearHistory(false);
                      }}
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      className="confirm-no-btn"
                      onClick={() => setConfirmClearHistory(false)}
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="delete-btn"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                    onClick={() => setConfirmClearHistory(true)}
                  >
                    Limpar
                  </button>
                )}
              </div>

              <div style={{ background: '#2d0808', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid #7f1d1d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '0.85rem', color: '#f87171' }}>Zerar Habilidades</strong>
                  <p style={{ fontSize: '0.75rem', color: '#fca5a5', margin: 0 }}>Exclui todas as skills.</p>
                </div>
                {confirmClearSkills ? (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="confirm-yes-btn"
                      style={{ background: '#dc2626' }}
                      onClick={() => {
                        playSound('delete');
                        setSkills([]);
                        setConfirmClearSkills(false);
                      }}
                    >
                      EXCLUIR
                    </button>
                    <button
                      type="button"
                      className="confirm-no-btn"
                      onClick={() => setConfirmClearSkills(false)}
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="delete-btn"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', background: '#dc2626' }}
                    onClick={() => setConfirmClearSkills(true)}
                  >
                    Zerar TUDO
                  </button>
                )}
              </div>
            </div>

            <div className="modal-actions-bar" style={{ marginTop: '1.2rem' }}>
              <button className="confirm-button" onClick={() => setIsHackModalOpen(false)}>
                Fechar Menu Hack
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JANELA DE MISSÕES DE HOJE COM TEMA DINÂMICO */}
      {isMissionsModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsMissionsModalOpen(false)}>
          <div
            className="modal-window missions-modal-large"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '1100px', width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}
          >
<div className="modal-header-row" style={{ justifyContent: 'space-between', width: '100%' }}>
  <h2>📜 Missões de Hoje</h2>
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
    <button
      type="button"
      className="cancel-button"
      style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer' }}
      onClick={() => {
        if (playSound) playSound('click');
        setIsMissionsHistoryModalOpen(true);
      }}
    >
      Histórico
    </button>

    <button
      type="button"
      className="cancel-button"
      style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer' }}
      onClick={() => {
        if (playSound) playSound('click');
        setIsEditMissionsModalOpen(true);
      }}
    >
      Editar Missões
    </button>
                
                <button
                  type="button"
                  className="cancel-button"
                  disabled={dailyRefreshesLeft <= 0}
                  style={{
                    padding: '0.35rem 0.8rem',
                    fontSize: '0.8rem',
                    opacity: dailyRefreshesLeft <= 0 ? 0.5 : 1,
                    cursor: dailyRefreshesLeft <= 0 ? 'not-allowed' : 'pointer'
                  }}
                  onClick={() => {
                    if (dailyRefreshesLeft <= 0) {
                      playSound('error');
                      alert('Você já atingiu o limite máximo de 2 sorteios hoje!');
                      return;
                    }

                    const result = refreshDailyMissions();
                    if (result.success) {
                      playSound('train');
                    } else {
                      playSound('error');
                      if (result.reason === 'limit_reached') {
                        alert('Você já atingiu o limite máximo de 2 sorteios hoje!');
                      } else if (result.reason === 'no_uncompleted_available') {
                        alert('Não há outras mini-missões não-concluídas disponíveis para sortear.');
                      }
                    }
                  }}
                  title={
                    dailyRefreshesLeft > 0
                      ? `Sortear novas missões não concluídas (${dailyRefreshesLeft}/2 restantes hoje)`
                      : 'Limite de 2 sorteios diários atingido'
                  }
                >
                  🔄 Sortear Novas ({dailyRefreshesLeft}/2)
                </button>
                <button className="close-popup-btn" onClick={() => setIsMissionsModalOpen(false)}>
                  ✕
                </button>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#94a3b8', margin: '0.5rem 0 1rem 0' }}>
              Abaixo estão até <strong>{dailyMissionsQuota} missões sorteadas aleatoriamente</strong> para hoje. As missões concluídas são mantidas, enquanto as não-concluídas podem ser resorteadas até <strong>2x por dia</strong> ({dailyRefreshesLeft}/2 restantes). Complete cada uma para resgatar <strong>1 ou 2 Diamantes 💎</strong>!
            </p>

            {(!dailyMissions || dailyMissions.length === 0) ? (
              <div className="no-missions-box" style={{ textAlign: 'center', padding: '3rem 0', color: '#94a3b8' }}>
                <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Nenhuma missão disponível no momento.</p>
                <span style={{ fontSize: '0.85rem' }}>
                  Adicione mini missões dentro do menu de edição (envelope ✉️) das suas habilidades para gerar desafios diários!
                </span>
              </div>
            ) : (
              <div
                className="missions-grid-container"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: '1.2rem',
                  padding: '0.5rem 0.2rem'
                }}
              >
                {dailyMissions.map((mission) => {
                  const isRare = (mission.rewardDiamonds || 0) >= 5;

                  return (
                    <div
                      key={mission.id}
                      className={`mission-card-item ${mission.completed ? 'completed' : ''} ${isRare ? 'rare-mission-card' : ''}`}
                    >
                      <div>
                        <div
                          className="mission-card-header"
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}
                        >
                          <span
                            className="mission-skill-badge"
                            title={mission.skillName}
                          >
                            {mission.skillName}
                          </span>
                          <span
                            className="mission-reward-badge"
                          >
                            +{mission.rewardDiamonds || 1} 💎
                          </span>
                        </div>
                        <div
                          className="mission-text-content"
                          style={{ fontSize: '0.9rem', color: '#f8fafc', marginBottom: '1.2rem', lineHeight: '1.4' }}
                        >
                          {mission.text}
                        </div>
                      </div>

                      <button
                        className={`mission-complete-btn ${mission.completed ? 'is-done' : ''}`}
                        onClick={() => {
                          if (!mission.completed) {
                            playSound('train');
                            completeMission(mission.id);
                          }
                        }}
                        disabled={mission.completed}
                      >
                        {mission.completed ? 'Concluída ✓' : 'Concluir Missão'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {dailyMissions && dailyMissions.length > 0 && (
              <div className="missions-bonus-footer-banner">
                {dailyMissions.every((m) => m.completed) ? (
                  <div className="bonus-claimed-text">
                    🎉 Parabéns! Todas as {dailyMissions.length} missões de hoje foram concluídas e o bônus de +1 💎 foi resgatado!
                  </div>
                ) : (
                  <div className="bonus-pending-text">
                    ⭐ Complete todas as {dailyMissions.length} missões do dia para receber um bônus extra de +1 Diamante!
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions-bar" style={{ marginTop: '1.5rem' }}>
              <button className="confirm-button" onClick={() => setIsMissionsModalOpen(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE GERENCIAMENTO DE MINI MISSÕES COM TEMA DINÂMICO */}
      {isMiniMissionsModalOpen && editingSkill && (
        <div className="modal-backdrop high-z-backdrop" onClick={() => setIsMiniMissionsModalOpen(false)}>
          <div className="modal-window high-z-window" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header-row" style={{ justifyContent: 'space-between', width: '100%' }}>
              <h3>✉️ Mini Missões: {editingSkill.title || editingSkill.name}</h3>
              <button className="close-popup-btn" onClick={() => setIsMiniMissionsModalOpen(false)}>✕</button>
            </div>

            <div className="mini-mission-tabs-row" style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}>
              <button 
                className={`mini-tab-btn ${miniMissionsModalTab === 'list' ? 'active' : ''}`}
                onClick={() => setMiniMissionsModalTab('list')}
              >
                Ver Mini Missões ({editingSkill.miniMissions?.length || 0})
              </button>
              <button 
                className={`mini-tab-btn ${miniMissionsModalTab === 'assign' ? 'active' : ''}`}
                onClick={() => setMiniMissionsModalTab('assign')}
              >
                Adicionar Nova
              </button>
            </div>

            {miniMissionsModalTab === 'list' ? (
              <div className="mini-missions-scroll-list">
                {(!editingSkill.miniMissions || editingSkill.miniMissions.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                    Nenhuma mini missão cadastrada para esta habilidade.
                  </div>
                ) : (
                  editingSkill.miniMissions.map((mm, idx) => (
                    <div key={idx} className="mini-mission-row-item">
                      <span style={{ fontSize: '0.9rem', color: '#f8fafc' }}>{mm}</span>
                      <button 
                        type="button"
                        className="editor-remove-btn" 
                        onClick={() => {
                          playSound('delete');
                          deleteMiniMissionFromSkill(editingSkill.id, idx);
                          setEditingSkill((prev) => ({
                            ...prev,
                            miniMissions: (prev.miniMissions || []).filter((_, i) => i !== idx)
                          }));
                        }}
                        title="Excluir mini missão"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', margin: '1rem 0' }}>
                <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>Digite a descrição da nova mini missão:</label>
                <input
                  type="text"
                  className="nickname-input"
                  style={{ width: '100%', textAlign: 'left', padding: '0.6rem', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid var(--theme-border, #334155)', borderRadius: '6px', color: '#fff' }}
                  placeholder="Ex: Fazer um esboço"
                  value={newMiniMissionText}
                  onChange={(e) => setNewMiniMissionText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newMiniMissionText.trim()) {
                      addMiniMissionToSkill(editingSkill.id, newMiniMissionText.trim());
                      setEditingSkill(prev => ({
                        ...prev,
                        miniMissions: [...(prev.miniMissions || []), newMiniMissionText.trim()]
                      }));
                      setNewMiniMissionText('');
                      setMiniMissionsModalTab('list');
                    }
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className="confirm-button"
                  onClick={() => {
                    if (newMiniMissionText.trim()) {
                      addMiniMissionToSkill(editingSkill.id, newMiniMissionText.trim());
                      setEditingSkill(prev => ({
                        ...prev,
                        miniMissions: [...(prev.miniMissions || []), newMiniMissionText.trim()]
                      }));
                      setNewMiniMissionText('');
                      setMiniMissionsModalTab('list');
                    }
                  }}
                >
                  Salvar e Atribuir Mini Missão
                </button>
              </div>
            )}

            <div className="modal-actions-bar" style={{ marginTop: '1rem' }}>
              <button className="confirm-button" onClick={() => setIsMiniMissionsModalOpen(false)}>
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GERENCIADOR DE PASTAS */}
      {isCategoryFilterModalOpen && (
        <div className="modal-backdrop layout-editor-modal-large" onClick={() => { playSound('click'); setIsCategoryFilterModalOpen(false); }}>
          <div className="modal-window layout-editor-modal-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '95vw', width: '1200px' }}>
            <div className="modal-header-row">
              <h3>Gerenciador de Pastas</h3>
              <button className="close-popup-btn" onClick={() => { playSound('click'); setIsCategoryFilterModalOpen(false); }}>×</button>
            </div>

            <p className="settings-description" style={{ marginBottom: '1rem' }}>
              Marque a <strong>caixa de seleção</strong> de cada pasta para deixar todas as suas habilidades visíveis ou não.
              <br />
              <strong>Arraste qualquer habilidade com o mouse</strong> ou <strong>pressione e segure o card no telemóvel</strong> para movê-la de pasta.
            </p>

            <div className="folder-manager-toolbar">
              <div className="folder-search-add-row">
                <input
                  type="text"
                  placeholder="Pesquisar pasta ou habilidade..."
                  value={folderSearchQuery}
                  onChange={(e) => setFolderSearchQuery(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem 0.8rem', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--theme-border, #334155)', borderRadius: '6px', color: '#fff' }}
                />
                <button
                  type="button"
                  className="confirm-button"
                  onClick={() => { playSound('click'); setNewFolderNameModalInput(''); setIsCreateFolderModalOpen(true); }}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  + Criar Pasta
                </button>
              </div>

               <div className="folder-sort-container">
                <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'bold' }}>Ordem das Pastas:</span>
                <select
                  value={folderSortOrder}
                  onChange={(e) => { playSound('click'); setFolderSortOrder(e.target.value); }}
                  style={{ padding: '0.45rem 0.8rem', borderRadius: '6px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--theme-border, #334155)', color: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  <option value="default">Padrão</option>
                  <option value="a-z">A a Z (Alfabética)</option>
                  <option value="z-a">Z a A (Inversa)</option>
                  <option value="more-skills">Mais Habilidades</option>
                  <option value="less-skills">Menos Habilidades</option>
                  <option value="newest">Mais Novos</option>
                  <option value="oldest">Mais Antigos</option>
                </select>
              </div>
            </div>

            <div className="folders-horizontal-scroll-container">
              {filteredFoldersToRender.map((folderName) => {
                const folderSkills = skills.filter((s) => {
                  const isMatchFolder = (s.folder || 'Geral').trim() === folderName;
                  if (!isMatchFolder) return false;
                  if (!queryClean) return true;
                  const folderNameMatches = folderName.toLowerCase().includes(queryClean);
                  if (folderNameMatches) return true;
                  return (
                    (s.title || s.name || '').toLowerCase().includes(queryClean) ||
                    (s.category && s.category.toLowerCase().includes(queryClean))
                  );
                });

                const isFolderVisible = selectedFolderFilters.length === 0 || selectedFolderFilters.includes(folderName);
                const isDragOverThis = dragOverFolder === folderName;
                const isFolderBeingDragged = draggedFolderName === folderName;
                const isFolderDragTarget = dragOverFolderName === folderName && draggedFolderName !== folderName;

                return (
                  <div
                    key={folderName}
                    draggable={folderName !== 'Geral' && !draggedSkillId}
                    onDragStart={(e) => {
                      if (draggedSkillId) return;
                      setDraggedFolderName(folderName);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggedSkillId) {
                        setDragOverFolder(folderName);
                      } else if (draggedFolderName && draggedFolderName !== folderName) {
                        setDragOverFolderName(folderName);
                      }
                    }}
                    onDragLeave={() => {
                      if (draggedSkillId) {
                        setDragOverFolder(null);
                      } else {
                        setDragOverFolderName(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedSkillId) {
                        handleDropSkillToFolder(folderName);
                      } else if (draggedFolderName && draggedFolderName !== folderName) {
                        reorderFolders(draggedFolderName, folderName);
                      }
                      setDraggedFolderName(null);
                      setDragOverFolderName(null);
                    }}
                    onDragEnd={() => {
                      setDraggedFolderName(null);
                      setDragOverFolderName(null);
                    }}
                    style={{
                      flex: '0 0 290px',
                      background: isDragOverThis || isFolderDragTarget ? 'rgba(255, 255, 255, 0.08)' : 'var(--theme-modal-bg, #0e1626)',
                      border: isDragOverThis || isFolderDragTarget ? '2px dashed var(--theme-accent, #38bdf8)' : '1px solid var(--theme-border, #334155)',
                      borderRadius: '12px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.2s ease',
                      boxShadow: isDragOverThis || isFolderDragTarget ? '0 0 15px rgba(56, 189, 248, 0.3)' : 'none',
                      opacity: isFolderBeingDragged ? 0.4 : 1,
                      cursor: folderName !== 'Geral' ? 'grab' : 'default'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem', borderBottom: '1px solid var(--theme-border, #334155)', paddingBottom: '0.6rem' }}>
                      {editingFolderName === folderName && folderName !== 'Geral' ? (
                        <input
                          type="text"
                          value={tempFolderNameInput}
                          onChange={(e) => setTempFolderNameInput(e.target.value)}
                          onBlur={() => handleRenameFolder(folderName, tempFolderNameInput)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleRenameFolder(folderName, tempFolderNameInput);
                            } else if (e.key === 'Escape') {
                              setEditingFolderName(null);
                            }
                          }}
                          autoFocus
                          style={{
                            fontSize: '0.9rem',
                            padding: '0.2rem 0.4rem',
                            background: 'rgba(0, 0, 0, 0.4)',
                            border: '1px solid var(--theme-accent, #38bdf8)',
                            borderRadius: '4px',
                            color: '#fff',
                            width: '120px'
                          }}
                        />
                      ) : (
                        <strong
                          onClick={() => {
                            if (folderName === 'Geral') return;
                            playSound('click');
                            setEditingFolderName(folderName);
                            setTempFolderNameInput(folderName);
                          }}
                          title={folderName === 'Geral' ? 'Pasta Padrão' : 'Clique para renomear esta pasta'}
                          style={{
                            fontSize: '1rem',
                            color: '#f8fafc',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '130px',
                            cursor: folderName === 'Geral' ? 'default' : 'pointer'
                          }}
                        >
                          {folderName} {folderName === 'Geral' ? '(Padrão)' : ''}
                        </strong>
                      )}

                      {deletingFolderName === folderName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontSize: '0.78rem', color: '#f87171', fontWeight: 'bold' }}>Excluir?</span>
                          <button
                            type="button"
                            className="confirm-yes-btn"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: '#dc2626' }}
                            onClick={() => {
                              handleDeleteFolder(folderName);
                              setDeletingFolderName(null);
                            }}
                          >
                            Sim
                          </button>
                          <button
                            type="button"
                            className="confirm-no-btn"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => {
                              playSound('click');
                              setDeletingFolderName(null);
                            }}
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {folderName !== 'Geral' && (
                            <button
                              type="button"
                              className="delete-folder-icon-btn"
                              onClick={() => {
                                playSound('click');
                                setDeletingFolderName(folderName);
                              }}
                              title={`Excluir pasta "${folderName}"`}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#ef4444',
                                fontSize: '0.95rem',
                                cursor: 'pointer',
                                padding: '0.1rem 0.3rem',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background 0.2s, transform 0.1s'
                              }}
                            >
                              🗑️
                            </button>
                          )}

                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.85rem', color: '#94a3b8', userSelect: 'none' }}>
                            <input
                              type="checkbox"
                              checked={isFolderVisible}
                              onChange={() => {
                                playSound('click');
                                if (selectedFolderFilters.length === 0) {
                                  const others = sortedAvailableFolders.filter((f) => f !== folderName);
                                  setSelectedFolderFilters(others);
                                } else {
                                  if (selectedFolderFilters.includes(folderName)) {
                                    const updated = selectedFolderFilters.filter((f) => f !== folderName);
                                    setSelectedFolderFilters(updated);
                                  } else {
                                    setSelectedFolderFilters([...selectedFolderFilters, folderName]);
                                  }
                                }
                              }}
                            />
                            <span>Visível</span>
                          </label>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenAddModalForFolder(folderName)}
                      style={{
                        width: '100%',
                        padding: '0.4rem 0.6rem',
                        marginBottom: '0.6rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px dashed var(--theme-accent, #38bdf8)',
                        borderRadius: '6px',
                        color: 'var(--theme-accent, #38bdf8)',
                        fontSize: '0.82rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      + Habilidade
                    </button>

                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.6rem',
                        overflowY: 'auto',
                        maxHeight: '280px',
                        paddingRight: '0.2rem'
                      }}
                    >
{folderSkills.length === 0 ? (
  <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: '1rem 0' }}>
    Nenhuma habilidade nesta pasta...
  </div>
) : (
  folderSkills.map((sk) => {
    const isMax = sk.level >= sk.maxLevel;
    const skillColor = sk.color || '#3b82f6';

    return (
      <div
        key={sk.id}
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          setDraggedSkillId(sk.id);
        }}
        onDragEnd={() => {
          setDraggedSkillId(null);
          setDragOverFolder(null);
        }}
        onTouchStart={(e) => handleCardTouchStart(e, sk, true)}
        onTouchEnd={handleCardTouchEndOrMove}
        onTouchMove={handleCardTouchEndOrMove}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          playSound('click');
          const pos = getClampedMenuPos(e.clientX, e.clientY, 200, 200);
          setFolderCardContextMenu({
            x: pos.x,
            y: pos.y,
            skill: sk
          });
        }}
        onClick={(e) => {
          if (e.target.closest('button') || e.target.closest('input')) return;
          playSound('click');
          setIsCategoryFilterModalOpen(false);
          setEditingSkill({ ...sk });
          setIsCustomMaxLevelInput(false);
        }}
        className="skill-card"
        style={{
          ...getCardStyle(false, skillColor),
          borderColor: isMax ? '#facc15' : undefined,
          boxShadow: isMax ? '0 0 8px rgba(250, 204, 21, 0.4)' : 'none',
          padding: '0.6rem 0.8rem',
          cursor: 'pointer',
          userSelect: 'none',
          minHeight: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="skill-name" style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#f8fafc' }}>
            ⁞⁞ {sk.title || sk.name}
          </span>
          <span className="level-text" style={{ fontSize: '0.75rem' }}>
            Lvl {sk.level}/{sk.maxLevel}
          </span>
        </div>

        <div className="segments-center-zone" style={{ margin: 0 }}>
          <div className="segments-bar">
            {renderSegmentBars(sk.level, sk.maxLevel, skillColor, isMax)}
          </div>
        </div>

        <div style={{ fontSize: '0.75rem', opacity: 0.85, color: 'var(--theme-accent, #38bdf8)' }}>
          Cat: {sk.category || 'Geral'}
        </div>
      </div>
    );
  })
)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="modal-actions-bar" style={{ marginTop: '1rem', position: 'relative' }}>
              <button
                type="button"
                className="cancel-button"
                onClick={() => {
                  playSound('click');
                  const areAllVisible =
                    !selectedFolderFilters.includes('__NONE__') &&
                    (selectedFolderFilters.length === 0 ||
                      sortedAvailableFolders.every((f) => selectedFolderFilters.includes(f)));

                  if (areAllVisible) {
                    setSelectedFolderFilters(['__NONE__']);
                  } else {
                    setSelectedFolderFilters([]);
                  }
                }}
              >
                {!selectedFolderFilters.includes('__NONE__') &&
                (selectedFolderFilters.length === 0 ||
                  sortedAvailableFolders.every((f) => selectedFolderFilters.includes(f)))
                  ? 'Ocultar Todas as Pastas'
                  : 'Mostrar Todas as Pastas'}
              </button>

              <div className="custom-folder-dropdown-container" style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="folder-list-select-btn"
                  onClick={() => {
                    playSound('click');
                    setIsFolderDropdownOpen((prev) => !prev);
                  }}
                >
                  📁 Lista de Pastas ▾
                </button>

                {isFolderDropdownOpen && (
                  <>
                    <div
                      className="dropdown-overlay-backdrop"
                      onClick={() => setIsFolderDropdownOpen(false)}
                      style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        zIndex: 99990,
                        background: 'transparent'
                      }}
                    />
                    <div
                      className="custom-folder-dropdown-menu"
                      style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        marginBottom: '0.5rem',
                        background: '#1e293b',
                        border: '1px solid var(--theme-border, #334155)',
                        borderRadius: '8px',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                        maxHeight: '260px',
                        overflowY: 'auto',
                        width: '220px',
                        zIndex: 99991,
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '0.4rem 0'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {sortedAvailableFolders.map((fName) => {
                        const isVisible =
                          !selectedFolderFilters.includes('__NONE__') &&
                          (selectedFolderFilters.length === 0 || selectedFolderFilters.includes(fName));

                        return (
                          <div
                            key={fName}
                            className="custom-folder-dropdown-item"
                            onClick={() => {
                              playSound('click');
                              if (selectedFolderFilters.length === 0) {
                                const others = sortedAvailableFolders.filter((f) => f !== fName);
                                setSelectedFolderFilters(others.length === 0 ? ['__NONE__'] : others);
                              } else if (selectedFolderFilters.includes('__NONE__')) {
                                setSelectedFolderFilters([fName]);
                              } else {
                                if (selectedFolderFilters.includes(fName)) {
                                  const updated = selectedFolderFilters.filter((f) => f !== fName);
                                  setSelectedFolderFilters(updated.length === 0 ? ['__NONE__'] : updated);
                                } else {
                                  setSelectedFolderFilters([...selectedFolderFilters, fName]);
                                }
                              }
                            }}
                            style={{
                              padding: '0.55rem 0.9rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.6rem',
                              color: '#f1f5f9',
                              fontSize: '0.85rem',
                              fontWeight: isVisible ? 'bold' : 'normal',
                              cursor: 'pointer',
                              userSelect: 'none',
                              transition: 'background 0.15s ease'
                            }}
                          >
                            <span style={{ fontSize: '1rem', color: isVisible ? 'var(--theme-accent, #38bdf8)' : '#64748b' }}>
                              {isVisible ? '☑' : '☐'}
                            </span>
                            <span>{fName}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                className="confirm-button"
                onClick={() => {
                  playSound('click');
                  setIsFolderDropdownOpen(false);
                  setIsCategoryFilterModalOpen(false);
                }}
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreateFolderModalOpen && (
        <div className="modal-backdrop high-z-backdrop" onClick={() => { playSound('click'); setIsCreateFolderModalOpen(false); }}>
          <form className="modal-window high-z-window" onSubmit={handleConfirmCreateFolderModal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header-row">
              <h3>Criar Nova Pasta</h3>
              <button type="button" className="close-popup-btn" onClick={() => { playSound('click'); setIsCreateFolderModalOpen(false); }}>×</button>
            </div>

            <div className="field-group" style={{ margin: '1rem 0' }}>
              <label>Nome da Pasta</label>
              <input
                type="text"
                placeholder="Ex: Projetos, Design, Livros..."
                value={newFolderNameModalInput}
                onChange={(e) => setNewFolderNameModalInput(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="modal-actions-bar">
              <button
                type="button"
                className="cancel-button"
                onClick={() => { playSound('click'); setIsCreateFolderModalOpen(false); }}
              >
                Cancelar
              </button>
              <button type="submit" className="confirm-button">
                Criar Pasta
              </button>
            </div>
          </form>
        </div>
      )}

      {folderCardContextMenu && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 99998,
              background: 'transparent'
            }}
            onClick={() => setFolderCardContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setFolderCardContextMenu(null);
            }}
          />
          <div
            className="custom-context-menu"
            style={{
              top: folderCardContextMenu.y,
              left: folderCardContextMenu.x,
              zIndex: 99999,
              minWidth: '200px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '0.6rem 0.8rem', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--theme-accent, #38bdf8)', borderBottom: '1px solid var(--theme-border, #334155)' }}>
              Mover "{folderCardContextMenu.skill.title || folderCardContextMenu.skill.name}" para:
            </div>
            <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
              {sortedAvailableFolders.map((fName) => {
                const isCurrent = (folderCardContextMenu.skill.folder || 'Geral') === fName;
                return (
                  <button
                    key={fName}
                    type="button"
                    className="context-menu-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontWeight: isCurrent ? 'bold' : 'normal',
                      color: isCurrent ? '#34d399' : '#f8fafc'
                    }}
                    onClick={() => {
                      playSound('train');
                      moveSkillToFolder(folderCardContextMenu.skill.id, fName);
                      setFolderCardContextMenu(null);
                    }}
                  >
                    <span>{fName}</span>
                    {isCurrent && <span>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {globalContextMenu && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 99998,
              background: 'transparent'
            }}
            onClick={() => setGlobalContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setGlobalContextMenu(null);
            }}
          />
          <div
            className="custom-context-menu"
            style={{ top: globalContextMenu.y, left: globalContextMenu.x, zIndex: 99999, minWidth: '220px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="context-menu-item"
              onClick={() => {
                playSound('click');
                setIsAddModalOpen(true);
                setGlobalContextMenu(null);
              }}
            >
              Criar Nova Habilidade
            </button>
            <button
              type="button"
              className="context-menu-item"
              onClick={() => {
                playSound('click');
                setIsManageSkillsModalOpen(true);
                setGlobalContextMenu(null);
              }}
            >
              Painel de Habilidades e Ocultas
            </button>
            <button
              type="button"
              className="context-menu-item"
              onClick={() => {
                playSound('click');
                setIsCategoryFilterModalOpen(true);
                setGlobalContextMenu(null);
              }}
            >
              Gerenciador de Pastas
            </button>
          </div>
        </>
      )}

      {isXpHistoryModalOpen && (
        <div className="modal-backdrop high-z-backdrop" onClick={() => { playSound('click'); setIsXpHistoryModalOpen(false); }}>
          <div className="modal-window high-z-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3>📜 Histórico de XP do Perfil</h3>
              <button className="close-popup-btn" onClick={() => { playSound('click'); setIsXpHistoryModalOpen(false); }}>×</button>
            </div>

            <div className="level-stats-summary" style={{ margin: '0.8rem 0 1.2rem 0' }}>
              <div className="stat-box">
                <span>XP Total da Conta</span>
                <strong>{totalXp} XP</strong>
              </div>
              <div className="stat-box">
                <span>Nível Atual</span>
                <strong>Lvl {playerLevel}</strong>
              </div>
            </div>

            <span className="card-section-label">REGISTROS DE XP GANHO E TRANSFERIDO:</span>

            {(!xpHistory || xpHistory.length === 0) ? (
              <p className="no-colors-msg" style={{ margin: '1.5rem 0' }}>
                Nenhum histórico de XP registrado ainda. Evolua habilidades para gerar pontos!
              </p>
            ) : (
              <div className="levels-table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {xpHistory.map((item) => (
                  <div
                    key={item.id}
                    className="level-row-item"
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem' }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#f8fafc' }}>{item.title}</strong>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {item.category || 'Geral'} • {item.date}
                      </span>
                    </div>

                    <span style={{ fontWeight: 'bold', color: '#34d399', fontSize: '1rem' }}>
                      +{item.amount} XP
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions-bar">
              <button className="confirm-button" onClick={() => { playSound('click'); setIsXpHistoryModalOpen(false); }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {isMailModalOpen && (
        <div className="modal-backdrop high-z-backdrop" onClick={() => { playSound('click'); setIsMailModalOpen(false); }}>
          <div className="modal-window high-z-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3>✉️ Cartas de Transferência Recebidas</h3>
              <button className="close-popup-btn" onClick={() => { playSound('click'); setIsMailModalOpen(false); }}>×</button>
            </div>

            {(!pendingTransfers || pendingTransfers.length === 0) ? (
              <p className="no-colors-msg" style={{ margin: '1.5rem 0' }}>Sua caixa de entrada está vazia. Nenhuma transferência pendente!</p>
            ) : (
              <div className="levels-table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {pendingTransfers.map((item) => (
                  <div key={item.id} className="profile-transfer-inline-box" style={{ margin: '0.6rem 0' }}>
                    <div className="transfer-header-row">
                      <span className="transfer-title">
                        ✉ Transferência enviada por <strong>"{item.sourceName}"</strong>
                      </span>
                    </div>

                    <div className="transfer-type-options" style={{ padding: '0.5rem 0' }}>
                      {item.mode === 'all' ? (
                        <p className="transfer-info-notice">
                          📦 <strong>Habilidades + XP:</strong> {item.skills?.length || 0} habilidade(s) ({item.xpAmount} XP acumulado) serão transferidas para seu perfil.
                        </p>
                      ) : (
                        <p className="transfer-info-notice">
                          ⚡ <strong>Apenas XP:</strong> Você receberá <strong>+{item.xpAmount} XP</strong> diretamente na sua conta.
                        </p>
                      )}

                      <div className="transfer-actions-row" style={{ marginTop: '0.8rem' }}>
                        <button
                          type="button"
                          className="confirm-yes-btn"
                          onClick={() => {
                            playSound('train');
                            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                            acceptTransfer(item.id);
                          }}
                        >
                          ✓ Aceitar Transferência
                        </button>
                        <button
                          type="button"
                          className="confirm-no-btn"
                          onClick={() => {
                            playSound('delete');
                            rejectTransfer(item.id);
                          }}
                        >
                          ✕ Recusar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions-bar">
              <button className="confirm-button" onClick={() => { playSound('click'); setIsMailModalOpen(false); }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {isProfileModalOpen && (
        <div className="modal-backdrop" onClick={() => { playSound('click'); setDeletingProfileId(null); setTransferSourceId(null); setIsProfileModalOpen(false); }}>
          <div className="modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3>👤 Troca e Gerenciamento de Perfis (P)</h3>
              <button className="close-popup-btn" onClick={() => { playSound('click'); setDeletingProfileId(null); setTransferSourceId(null); setIsProfileModalOpen(false); }}>×</button>
            </div>

            <span className="card-section-label" style={{ marginTop: '0.2rem' }}>SEUS PERFIS SALVOS:</span>

            <div className="levels-table-container">
              {profiles.map((p) => {
                const isActive = p.id === activeProfileId;
                const stats = getProfileStats(p.id);
                const isConfirmingDelete = deletingProfileId === p.id;
                const isTransferring = transferSourceId === p.id;

                const otherProfiles = profiles.filter((prof) => prof.id !== p.id);
                const currentTarget = profiles.find((prof) => prof.id === transferTargetId) || otherProfiles[0];

                return (
                  <div key={p.id} className="profile-card-wrapper-item">
                    <div
                      className={`profile-card-item ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        if (isConfirmingDelete || isTransferring) return;
                        playSound('click');
                        switchProfile(p.id);
                        setDeletingProfileId(null);
                        setTransferSourceId(null);
                        setIsProfileModalOpen(false);
                      }}
                    >
                      <div className="profile-card-item-left">
                        <span className="profile-card-avatar">{p.avatar || '🛡️'}</span>
                        <div className="profile-card-info">
                          <span className="profile-card-title">{p.name}</span>
                          <span className="profile-card-xp">{stats.xp} XP • Lvl {stats.level}</span>
                          {isActive && <span className="profile-card-badge">● PERFIL ATIVO</span>}
                        </div>
                      </div>

                      {profiles.length > 1 && (
                        <div className="profile-card-actions-right">
                          {isConfirmingDelete ? (
                            <div className="profile-delete-confirm-box" onClick={(e) => e.stopPropagation()}>
                              <span className="confirm-delete-text">Tem certeza?</span>
                              <button
                                type="button"
                                className="confirm-yes-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playSound('delete');
                                  deleteProfile(p.id);
                                  setDeletingProfileId(null);
                                }}
                              >
                                Sim
                              </button>
                              <button
                                type="button"
                                className="confirm-no-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playSound('click');
                                  setDeletingProfileId(null);
                                }}
                              >
                                Não
                              </button>
                            </div>
                          ) : (
                            <div className="profile-action-btns-row" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="editor-transfer-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playSound('click');
                                  setDeletingProfileId(null);
                                  setTransferSourceId(p.id);
                                  const defaultTarget = otherProfiles[0]?.id || '';
                                  setTransferTargetId(defaultTarget);
                                  setTransferStep('choose_type');
                                  setTransferNoticeMessage('');
                                }}
                                title="Transferir Dados do Perfil"
                              >
                                ⇄
                              </button>
                              <button
                                type="button"
                                className="editor-remove-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playSound('click');
                                  setTransferSourceId(null);
                                  setDeletingProfileId(p.id);
                                }}
                                title="Excluir Perfil"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {isTransferring && (
                      <div className="profile-transfer-inline-box" onClick={(e) => e.stopPropagation()}>
                        <div className="transfer-header-row">
                          <span className="transfer-title">⇄ Transferir de "{p.name}"</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Para:</span>
                            <select
                              className="transfer-target-select"
                              value={transferTargetId}
                              onChange={(e) => setTransferTargetId(e.target.value)}
                            >
                              {otherProfiles.map((prof) => (
                                <option key={prof.id} value={prof.id}>
                                  {prof.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {transferStep === 'choose_type' && (
                          <div className="transfer-type-options">
                            <p className="transfer-question">O que você deseja transferir?</p>
                            <div className="transfer-buttons-row">
                              <button
                                type="button"
                                className="transfer-opt-btn all-opt"
                                onClick={() => {
                                  playSound('click');
                                  setTransferStep('confirm_all');
                                }}
                              >
                                🛠 Habilidades + XP
                              </button>
                              <button
                                type="button"
                                className="transfer-opt-btn xp-opt"
                                onClick={() => {
                                  playSound('click');
                                  setTransferStep('confirm_xp_only');
                                }}
                              >
                                ⚡ Apenas XP
                              </button>
                              <button
                                type="button"
                                className="confirm-no-btn"
                                onClick={() => setTransferSourceId(null)}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}

                        {transferStep === 'confirm_all' && (
                          <div className="transfer-confirm-subbox">
                            <p className="transfer-info-notice">
                              Será enviada uma carta com <strong>Habilidades + XP</strong> para <strong>"{currentTarget?.name}"</strong>. O XP só sairá deste perfil quando o destinatário aceitar a carta ✉️.
                            </p>
                            <div className="transfer-actions-row">
                              <button
                                type="button"
                                className="confirm-yes-btn"
                                onClick={() => handleSendTransfer(p.id, transferTargetId, 'all')}
                              >
                                Enviar Solicitação
                              </button>
                              <button
                                type="button"
                                className="confirm-no-btn"
                                onClick={() => setTransferStep('choose_type')}
                              >
                                Voltar
                              </button>
                            </div>
                          </div>
                        )}

                        {transferStep === 'confirm_xp_only' && (
                          <div className="transfer-confirm-subbox xp-warning-style">
                            <p className="transfer-info-notice warning">
                              Será enviada uma carta para <strong>"{currentTarget?.name}"</strong> contendo apenas o XP acumulado. Ao aceitar, o XP sairá deste perfil remetente.
                            </p>
                            <div className="transfer-actions-row">
                              <button
                                type="button"
                                className="confirm-yes-btn"
                                onClick={() => handleSendTransfer(p.id, transferTargetId, 'xp_only')}
                              >
                                Enviar Solicitação de XP
                              </button>
                              <button
                                type="button"
                                className="confirm-no-btn"
                                onClick={() => setTransferStep('choose_type')}
                              >
                                Voltar
                              </button>
                            </div>
                          </div>
                        )}

                        {transferStep === 'sent_success' && (
                          <div className="transfer-confirm-subbox">
                            <p className="transfer-info-notice" style={{ color: '#34d399' }}>
                              {transferNoticeMessage}
                            </p>
                            <div className="transfer-actions-row">
                              <button
                                type="button"
                                className="confirm-yes-btn"
                                onClick={() => setTransferSourceId(null)}
                              >
                                OK
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="modal-actions-bar">
              <button
                type="button"
                className="confirm-button"
                onClick={handleOpenNewProfileModal}
              >
                + Novo
              </button>
              <button className="cancel-button" onClick={() => { playSound('click'); setDeletingProfileId(null); setTransferSourceId(null); setIsProfileModalOpen(false); }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {isNewProfileModalOpen && (
        <div className="modal-backdrop high-z-backdrop" onClick={() => { playSound('click'); setIsNewProfileModalOpen(false); }}>
          <form className="modal-window high-z-window" onSubmit={handleCreateNewProfile} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3>Criar Novo Perfil</h3>
              <button className="close-popup-btn" onClick={() => { playSound('click'); setIsNewProfileModalOpen(false); }}>×</button>
            </div>

            <div className="field-group">
              <label>Nome do Perfil</label>
              <input
                type="text"
                placeholder="Ex: Novo Herói, Trabalho, Estudo..."
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="field-group">
              <label>Emoji do Perfil</label>
              <div
                className="new-profile-emoji-select"
                onClick={() => { playSound('click'); setIsNewProfileEmojiPickerOpen(true); }}
                title="Clique para escolher o ícone"
              >
                <span className="emoji-display">{newProfileAvatar}</span>
                <span className="emoji-change-label">Ícone</span>
              </div>
            </div>

            <div className="modal-actions-bar">
              <button
                type="button"
                className="cancel-button"
                onClick={() => { playSound('click'); setIsNewProfileModalOpen(false); }}
              >
                Cancelar
              </button>
              <button type="submit" className="confirm-button">
                Criar Perfil
              </button>
            </div>
          </form>
        </div>
      )}

      {isNewProfileEmojiPickerOpen && (
        <div className="modal-backdrop high-z-backdrop" onClick={() => { playSound('click'); setIsNewProfileEmojiPickerOpen(false); }}>
          <div onClick={(e) => e.stopPropagation()} className="high-z-window">
            <EmojiPicker
              onEmojiClick={(emojiData) => {
                playSound('click');
                setNewProfileAvatar(emojiData.emoji);
                setIsNewProfileEmojiPickerOpen(false);
              }}
              theme="dark"
              searchPlaceHolder="Buscar emoji..."
            />
          </div>
        </div>
      )}

      {isEmojiPickerOpen && (
        <div className="modal-backdrop" onClick={() => { playSound('click'); setIsEmojiPickerOpen(false); }}>
          <div onClick={(e) => e.stopPropagation()}>
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              theme="dark"
              searchPlaceHolder="Buscar emoji..."
            />
          </div>
        </div>
      )}

      {/* MODAL CONFIGURAÇÕES E DADOS (PADRONIZADO COM 1 COR ÚNICA DE BOTÕES) */}
      {isSettingsModalOpen && (
        <div className="modal-backdrop" onClick={() => { playSound('click'); setIsSettingsModalOpen(false); }}>
          <div className="modal-window settings-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3>{t('modal_settings_title', 'Configurações e Dados')}</h3>
              <button className="close-popup-btn" onClick={() => { playSound('click'); setIsSettingsModalOpen(false); }}>×</button>
            </div>

            <div className="settings-content">
              <p className="settings-description">
                Gerencie seus dados de progresso ou consulte a lista completa de atalhos e comandos do programa.
              </p>

<div className="backup-actions">
                <button
                  className="backup-btn"
                  style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--theme-border, #334155)', color: '#fff' }}
                  onClick={() => { playSound('click'); setIsBoxColorModalOpen(true); }}
                >
                  Cor da Caixa
                </button>

                <button
                  className="backup-btn"
                  style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--theme-border, #334155)', color: '#fff' }}
                  onClick={() => { playSound('click'); setIsSkillSettingsModalOpen(true); }}
                >
                  Habilidades
                </button>

                <button
                  className="backup-btn"
                  style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--theme-border, #334155)', color: '#fff' }}
                  onClick={() => { playSound('click'); setIsCommandsModalOpen(true); }}
                >
                  Comandos do Sistema
                </button>

                <button
                  className="backup-btn"
                  style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--theme-border, #334155)', color: '#fff' }}
                  onClick={() => { playSound('click'); setIsLanguageModalOpen(true); }}
                >
                  {t('btn_language', 'Idioma do Sistema')}
                </button>

                <button
                  className="backup-btn"
                  style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--theme-border, #334155)', color: '#fff' }}
                  onClick={handleExportData}
                >
                  {t('btn_backup', 'Fazer Backup')}
                </button>

                <button
                  className="backup-btn"
                  style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--theme-border, #334155)', color: '#fff' }}
                  onClick={() => { playSound('click'); fileInputRef.current && fileInputRef.current.click(); }}
                >
                  Importar Backup
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".json"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            <div className="modal-actions-bar">
              <button className="confirm-button" onClick={() => { playSound('click'); setIsSettingsModalOpen(false); }}>
                Fechar
              </button>
            </div>

            <div className="settings-footer-credit">
              Feito por Ricardo Bezerra :D
            </div>
          </div>
        </div>
      )}

      {isBoxColorModalOpen && (
        <div className="modal-backdrop high-z-backdrop" onClick={() => { playSound('click'); setIsBoxColorModalOpen(false); }}>
          <div className="modal-window high-z-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3>Cor da Caixa das Habilidades</h3>
              <button className="close-popup-btn" onClick={() => { playSound('click'); setIsBoxColorModalOpen(false); }}>×</button>
            </div>

            <p className="settings-description">
              Escolha o estilo de cor para o fundo das caixas (cards) de habilidades do seu perfil:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', margin: '1rem 0' }}>
              <button
                type="button"
                className={`deck-status-btn ${boxColorType === 'default' ? 'active' : ''}`}
                style={{ padding: '0.85rem 1rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}
                onClick={() => { playSound('click'); setBoxColorType('default'); }}
              >
                <strong style={{ fontSize: '1rem', color: '#f8fafc' }}>● Cor Padrão</strong>
                <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Manter o fundo neutro escuro original em todas as caixas.</span>
              </button>

              <button
                type="button"
                className={`deck-status-btn ${boxColorType === 'theme' ? 'active' : ''}`}
                style={{ padding: '0.85rem 1rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}
                onClick={() => { playSound('click'); setBoxColorType('theme'); }}
              >
                <strong style={{ fontSize: '1rem', color: activeThemePreset.color }}>● Cor do Tema ({activeThemePreset.name})</strong>
                <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Aplicar a tonalidade com o Tema Visual atual do perfil.</span>
              </button>
            </div>

            <div className="modal-actions-bar">
              <button className="confirm-button" onClick={() => { playSound('click'); setIsBoxColorModalOpen(false); }}>
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {isSkillSettingsModalOpen && (
        <div className="modal-backdrop high-z-backdrop" onClick={() => { playSound('click'); setIsSkillSettingsModalOpen(false); }}>
          <div className="modal-window high-z-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3> Configurações de Habilidades</h3>
              <button className="close-popup-btn" onClick={() => { playSound('click'); setIsSkillSettingsModalOpen(false); }}>×</button>
            </div>

            <p className="settings-description">
              Ajuste as regras de exibição e agrupamento das suas habilidades:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', margin: '1rem 0' }}>
              <button
                type="button"
                className={`deck-status-btn ${linkSkillsByCategory ? 'active' : ''}`}
                style={{ padding: '0.85rem 1rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}
                onClick={() => { playSound('click'); setLinkSkillsByCategory(!linkSkillsByCategory); }}
              >
                <strong style={{ fontSize: '1rem', color: linkSkillsByCategory ? '#34d399' : '#f8fafc' }}>
                  ● Interligação por Categoria: {linkSkillsByCategory ? 'Ativada' : 'Desativada'}
                </strong>
                <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                  {linkSkillsByCategory
                    ? 'Habilidades da mesma categoria interligadas'
                    : 'As habilidades seguem estritamente a ordem manual, sem obrigatoriedade de interligação.'}
                </span>
              </button>
            </div>

            <div className="modal-actions-bar">
              <button className="confirm-button" onClick={() => { playSound('click'); setIsSkillSettingsModalOpen(false); }}>
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {isCommandsModalOpen && (
        <div className="modal-backdrop high-z-backdrop" onClick={() => { playSound('click'); setIsCommandsModalOpen(false); }}>
          <div className="modal-window commands-modal-window high-z-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3> Comandos e Atalhos do Sistema</h3>
              <button className="close-popup-btn" onClick={() => { playSound('click'); setIsCommandsModalOpen(false); }}>×</button>
            </div>

            <div className="commands-list-container">
              <div className="command-item">
                <div className="command-keys"><kbd>Esc</kbd></div>
                <div className="command-desc"><strong>Fechar / Configurações:</strong> Fecha janelas abertas ou abre as configurações na tela inicial.</div>
              </div>

              <div className="command-item">
                <div className="command-keys"><kbd>Espaço</kbd></div>
                <div className="command-desc"><strong>Buscar Habilidade:</strong> Abre a janela de busca para pesquisar qualquer habilidade.</div>
              </div>

              <div className="command-item">
                <div className="command-keys"><kbd>Ctrl</kbd> + <kbd>Espaço</kbd></div>
                <div className="command-desc"><strong>Criar Habilidade:</strong> Abre a janela para criar uma nova habilidade.</div>
              </div>

              <div className="command-item">
                <div className="command-keys"><kbd>C</kbd></div>
                <div className="command-desc"><strong>Tema Visual:</strong> Abre a personalização de cores e tema do perfil.</div>
              </div>

              <div className="command-item">
                <div className="command-keys"><kbd>P</kbd></div>
                <div className="command-desc"><strong>Gerenciar Perfis:</strong> Abre o painel de seleção e troca de perfis.</div>
              </div>

              <div className="command-item">
                <div className="command-keys"><kbd>G</kbd></div>
                <div className="command-desc"><strong>Gerenciador de Pastas:</strong> Abre a organização e filtro de pastas.</div>
              </div>

              <div className="command-item">
                <div className="command-keys"><kbd>O</kbd></div>
                <div className="command-desc"><strong>Habilidades & Ocultas:</strong> Abre o painel de gerenciamento de visibilidade.</div>
              </div>

              <div className="command-item">
                <div className="command-keys"><kbd>A</kbd></div>
                <div className="command-desc"><strong>Avatar Emoji:</strong> Abre o seletor de emojis para o perfil.</div>
              </div>

              <div className="command-item">
                <div className="command-keys"><kbd>M</kbd></div>
                <div className="command-desc"><strong>Missões Diárias:</strong> Abre o painel de missões e resgate de diamantes.</div>
              </div>

              <div className="command-item">
                <div className="command-keys"><kbd>E</kbd></div>
                <div className="command-desc"><strong>Editor de Layout:</strong> Abre o reordenador de habilidades.</div>
              </div>
            </div>

            <div className="modal-actions-bar">
              <button className="confirm-button" onClick={() => { playSound('click'); setIsCommandsModalOpen(false); }}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {isLevelInfoModalOpen && (
        <div className="modal-backdrop" onClick={() => { playSound('click'); setIsLevelInfoModalOpen(false); }}>
          <div className="modal-window level-info-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3>Progressão de Patentes e Níveis</h3>
              <button className="close-popup-btn" onClick={() => { playSound('click'); setIsLevelInfoModalOpen(false); }}>×</button>
            </div>

            <div className="level-stats-summary">
              <div className="stat-box">
                <span>Nível Atual</span>
                <strong>Lvl {playerLevel}</strong>
              </div>
              <div className="stat-box">
                <span>Patente Atual</span>
                <strong>{getRankTitle(playerLevel)}</strong>
              </div>
              <div className="stat-box">
                <span>Para Próximo Nível</span>
                <strong>{xpNeededForNext - currentXpProgress} XP</strong>
              </div>
            </div>

            <span className="card-section-label">Marcos de Patente (a cada 40 níveis):</span>

            <div className="levels-table-container">
              {RANK_MILESTONES.map((m) => {
                let cumulativeXp = 0;
                for (let i = 1; i < m.level; i++) {
                  cumulativeXp += getXpNeededForLevel(i);
                }
                const isCurrentRank = getRankTitle(playerLevel) === m.rank.replace(' (Máximo)', '');

                return (
                  <div key={m.level} className={`level-row-item ${isCurrentRank ? 'current' : ''}`}>
                    <span className="level-row-num">Nível {m.level}</span>
                    <span className="level-row-xp">{cumulativeXp.toLocaleString()} XP acumulado</span>
                    <span className="level-row-rank">{m.rank}</span>
                  </div>
                );
              })}
            </div>

            <div className="modal-actions-bar">
              <button className="confirm-button" onClick={() => { playSound('click'); setIsLevelInfoModalOpen(false); }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MENU CONTEXTUAL DE HABILIDADE (CLIQUE DIREITO) */}
      {contextMenu && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 99998,
              background: 'transparent'
            }}
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          />
          <div
            className="custom-context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x, zIndex: 99999 }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.confirmDelete ? (
              <>
                <div style={{ padding: '0.7rem 1rem', fontSize: '0.85rem', fontWeight: 'bold', color: '#f87171', borderBottom: '1px solid var(--theme-border, #334155)', textAlign: 'center' }}>
                  Tem certeza?
                </div>
                <div style={{ display: 'flex' }}>
                  <button
                    type="button"
                    className="context-menu-item delete-item"
                    style={{ flex: 1, textAlign: 'center', justifyContent: 'center', borderRight: '1px solid var(--theme-border, #334155)' }}
                    onClick={() => {
                      playSound('delete');
                      deleteSkill(contextMenu.skill.id);
                      setContextMenu(null);
                    }}
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    className="context-menu-item"
                    style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}
                    onClick={() => {
                      playSound('click');
                      setContextMenu(null);
                    }}
                  >
                    Não
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="context-menu-item"
                  onClick={() => {
                    playSound('click');
                    setEditingSkill({ ...contextMenu.skill });
                    setContextMenu(null);
                  }}
                >
                  Editar Habilidade
                </button>
                <button
                  type="button"
                  className="context-menu-item"
                  onClick={() => {
                    playSound('click');
                    toggleHideSkill(contextMenu.skill.id);
                    setContextMenu(null);
                  }}
                >
                  Ocultar Habilidade
                </button>
                <button
                  type="button"
                  className="context-menu-item delete-item"
                  onClick={() => {
                    playSound('click');
                    setContextMenu((prev) => ({ ...prev, confirmDelete: true }));
                  }}
                >
                  Excluir Habilidade
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* EDITOR DE LAYOUT E REORDENAÇÃO */}
      {isLayoutEditorOpen && (
        <div className="modal-backdrop" onClick={() => { playSound('click'); setIsLayoutEditorOpen(false); }}>
          <div className="modal-window layout-editor-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3>Editor de Layout e Ordem das Habilidades</h3>
              <button className="close-popup-btn" onClick={() => { playSound('click'); setIsLayoutEditorOpen(false); }}>×</button>
            </div>

            <div className="editor-toolbar-row">
              <p className="settings-description" style={{ margin: 0 }}>
                Arraste qualquer habilidade com o botão esquerdo para reordenar. Ative o seletor (<strong>`☑` / `☐`</strong>) para selecionar clicando em qualquer lugar da carta.
              </p>
              <button
                type="button"
                className={`batch-toggle-square ${isBatchSelectMode ? 'active' : ''}`}
                onClick={() => {
                  playSound('click');
                  setIsBatchSelectMode(!isBatchSelectMode);
                  setSelectedBatchIds([]);
                  setBatchConfirmDelete(false);
                }}
                title="Ativar seleção múltipla para exclusão"
              >
                {isBatchSelectMode ? '☑' : '☐'}
              </button>
            </div>

            {isBatchSelectMode && selectedBatchIds.length > 0 && (
              batchConfirmDelete ? (
                <div className="batch-confirm-box">
                  <span>Tem certeza que deseja excluir {selectedBatchIds.length} {selectedBatchIds.length === 1 ? 'habilidade' : 'habilidades'}?</span>
                  <div className="batch-confirm-actions">
                    <button
                      type="button"
                      className="batch-delete-btn"
                      onClick={() => {
                        playSound('delete');
                        selectedBatchIds.forEach((id) => deleteSkill(id));
                        setSelectedBatchIds([]);
                        setBatchConfirmDelete(false);
                        setIsBatchSelectMode(false);
                      }}
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      className="cancel-button"
                      style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem' }}
                      onClick={() => { playSound('click'); setBatchConfirmDelete(false); }}
                    >
                      Não
                    </button>
                  </div>
                </div>
              ) : (
                <div className="batch-actions-panel">
                  <span style={{ fontSize: '0.85rem', color: '#f1f5f9', fontWeight: 'bold' }}>
                    {selectedBatchIds.length} {selectedBatchIds.length === 1 ? 'selecionada' : 'selecionadas'}
                  </span>
                  <button
                    type="button"
                    className="batch-delete-btn"
                    onClick={() => { playSound('click'); setBatchConfirmDelete(true); }}
                  >
                    Excluir Selecionadas
                  </button>
                </div>
              )
            )}

            <div className="editor-skills-scroll-container">
              {visibleSkills.map((skill, idx) => {
                const isMax = skill.level >= skill.maxLevel;
                const skillColor = skill.color || '#3b82f6';
                const nextLevelNumber = skill.level + 1;
                const nextGoalText = skill.levelDescriptions?.[nextLevelNumber] || `Meta do Nível ${nextLevelNumber}`;

                const getRealIndex = (targetVisibleIdx) => {
                  const targetSkill = visibleSkills[targetVisibleIdx];
                  return skills.findIndex((s) => s.id === targetSkill.id);
                };

                const currentRealIdx = skills.findIndex((s) => s.id === skill.id);

                const nextSkill = visibleSkills[idx + 1];
                const isSameCategoryWithNext =
                  nextSkill &&
                  (skill.category || 'Geral').trim().toLowerCase() ===
                    (nextSkill.category || 'Geral').trim().toLowerCase();

                const isCheckedBatch = selectedBatchIds.includes(skill.id);
                const isBeingDragged = draggedLayoutIdx === idx;
                const isDragTarget = dragOverLayoutIdx === idx && !isBeingDragged;

                const toggleBatchSelection = () => {
                  playSound('click');
                  if (isCheckedBatch) {
                    setSelectedBatchIds(selectedBatchIds.filter((id) => id !== skill.id));
                  } else {
                    setSelectedBatchIds([...selectedBatchIds, skill.id]);
                  }
                };

                return (
                  <div
                    key={skill.id}
                    className={`skill-card-wrapper ${isSameCategoryWithNext ? 'has-next-same-cat' : ''}`}
                    draggable={!isBatchSelectMode}
                    onDragStart={(e) => {
                      setDraggedLayoutIdx(idx);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverLayoutIdx(idx);
                    }}
                    onDragLeave={() => {
                      if (dragOverLayoutIdx === idx) setDragOverLayoutIdx(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedLayoutIdx !== null && draggedLayoutIdx !== idx) {
                        const fromReal = getRealIndex(draggedLayoutIdx);
                        const toReal = getRealIndex(idx);
                        playSound('train');
                        reorderSkills(fromReal, toReal);
                      }
                      setDraggedLayoutIdx(null);
                      setDragOverLayoutIdx(null);
                    }}
                    onDragEnd={() => {
                      setDraggedLayoutIdx(null);
                      setDragOverLayoutIdx(null);
                    }}
                  >
                    <div
                      className={`skill-card compact-editor-card ${isMax ? 'gold-maxed' : ''}`}
                      onClick={() => {
                        if (isBatchSelectMode) {
                          toggleBatchSelection();
                        }
                      }}
                      style={{
                        ...getCardStyle(isMax, skillColor),
                        cursor: isBatchSelectMode ? 'pointer' : 'grab',
                        opacity: isBeingDragged ? 0.4 : 1,
                        borderStyle: isDragTarget ? 'dashed' : 'solid',
                        borderWidth: isCheckedBatch || isDragTarget ? '2px' : '1px',
                        borderColor: isCheckedBatch
                          ? '#f87171'
                          : isDragTarget
                          ? 'var(--theme-accent, #38bdf8)'
                          : boxColorType === 'theme'
                          ? activeThemePreset.border
                          : isMax
                          ? '#facc15'
                          : skillColor,
                        boxShadow: isCheckedBatch
                          ? '0 0 14px rgba(248, 113, 113, 0.5)'
                          : isDragTarget
                          ? '0 0 15px rgba(56, 189, 248, 0.4)'
                          : isMax
                          ? '0 0 10px rgba(250, 204, 21, 0.3)'
                          : `0 0 8px ${skillColor.startsWith && skillColor.startsWith('#') ? skillColor + '40' : skillColor}`,
                        ...(isCheckedBatch ? { backgroundColor: 'rgba(127, 29, 29, 0.25)' } : {})
                      }}
                    >
                      {!isBatchSelectMode && (
                        <div className="reorder-button-group" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="reorder-btn edge-btn"
                            disabled={idx === 0}
                            onClick={() => { playSound('click'); reorderSkills(currentRealIdx, getRealIndex(0)); }}
                            title="Mover para o topo"
                          >
                            ▲▲
                          </button>
                          <button
                            type="button"
                            className="reorder-btn"
                            disabled={idx === 0}
                            onClick={() => { playSound('click'); reorderSkills(currentRealIdx, getRealIndex(idx - 1)); }}
                            title="Mover para cima"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            className="reorder-btn"
                            disabled={idx === visibleSkills.length - 1}
                            onClick={() => { playSound('click'); reorderSkills(currentRealIdx, getRealIndex(idx + 1)); }}
                            title="Mover para baixo"
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            className="reorder-btn edge-btn"
                            disabled={idx === visibleSkills.length - 1}
                            onClick={() => { playSound('click'); reorderSkills(currentRealIdx, getRealIndex(visibleSkills.length - 1)); }}
                            title="Mover para o fim"
                          >
                            ▼▼
                          </button>
                        </div>
                      )}

                      {!isBatchSelectMode && (
                        <button
                          type="button"
                          className="mini-missions-envelope-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            playSound('click');
                            setEditingSkill(skill);
                            setMiniMissionsModalTab('list');
                            setIsMiniMissionsModalOpen(true);
                          }}
                          title="Gerenciar Mini Missões"
                        >
                          ✉️
                        </button>
                      )}

                      <div className="skill-details">
                        <div className="skill-name">{skill.title || skill.name}</div>
                        <div className="skill-category">{skill.category}</div>
                      </div>

                      <div className="segments-center-zone">
                        <div className="current-goal-title">
                          {isMax ? 'Habilidade Dominada!' : nextGoalText}
                        </div>
                        <div className="segments-bar">
                          {renderSegmentBars(skill.level, skill.maxLevel, skillColor, isMax)}
                        </div>
                      </div>

                      <div className="level-text">Lvl {skill.level}</div>

                      <div className="editor-card-controls" onClick={(e) => e.stopPropagation()}>
                        {isBatchSelectMode ? (
                          <input
                            type="checkbox"
                            className="card-batch-checkbox"
                            checked={isCheckedBatch}
                            onChange={toggleBatchSelection}
                          />
                        ) : (
                          <button
                            type="button"
                            className="editor-remove-btn"
                            onClick={() => {
                              playSound('delete');
                              deleteSkill(skill.id);
                            }}
                            title="Remover habilidade"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {isSameCategoryWithNext && (
                      <div
                        className="category-connector-line"
                        style={{ '--category-line-color': skillColor }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="modal-actions-bar">
              <button className="confirm-button" onClick={() => { playSound('click'); setIsLayoutEditorOpen(false); }}>
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {isManageSkillsModalOpen && (
        <div className="modal-backdrop" onClick={() => { playSound('click'); setIsManageSkillsModalOpen(false); }}>
          <div className="modal-window layout-editor-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3>Painel de Habilidades e Ocultas</h3>
              <button className="close-popup-btn" onClick={() => { playSound('click'); setIsManageSkillsModalOpen(false); }}>×</button>
            </div>

            <div className="manage-sections-stack">
              <div className="manage-card-section">
                <span className="card-section-label">
                  HABILIDADES ESCONDIDAS ({hiddenSkills.length}):
                </span>

                {hiddenSkills.length === 0 ? (
                  <p className="no-colors-msg">Nenhuma habilidade escondida no momento.</p>
                ) : (
                  <div className="editor-skills-scroll-container">
                    {hiddenSkills.map((skill) => {
                      const isMax = skill.level >= skill.maxLevel;
                      const skillColor = skill.color || '#3b82f6';

                      return (
                        <div
                          key={skill.id}
                          className={`skill-card compact-editor-card ${isMax ? 'gold-maxed' : ''}`}
                          style={getCardStyle(isMax, skillColor)}
                        >
                          <div className="skill-details">
                            <div className="skill-name">{skill.title || skill.name}</div>
                            <div className="skill-category">{skill.category}</div>
                          </div>

                          <div className="segments-center-zone">
                            <div className="segments-bar">
                              {renderSegmentBars(skill.level, skill.maxLevel, skillColor, isMax)}
                            </div>
                          </div>

                          <div className="level-text">Lvl {skill.level}</div>

                          <div className="editor-card-controls">
                            <button
                              type="button"
                              className="restore-btn"
                              onClick={() => { playSound('train'); toggleHideSkill(skill.id); }}
                            >
                              Mostrar
                            </button>
                            <button
                              type="button"
                              className="manage-edit-btn"
                              onClick={() => {
                                playSound('click');
                                setIsManageSkillsModalOpen(false);
                                setEditingSkill({ ...skill });
                              }}
                            >
                              Editar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="manage-card-section">
                <span className="card-section-label">
                  HABILIDADES ATIVAS ({visibleSkills.length}):
                </span>

                <div className="editor-skills-scroll-container">
                  {visibleSkills.map((skill, idx) => {
                    const isMax = skill.level >= skill.maxLevel;
                    const skillColor = skill.color || '#3b82f6';

                    const nextSkill = visibleSkills[idx + 1];
                    const isSameCategoryWithNext =
                      nextSkill &&
                      (skill.category || 'Geral').trim().toLowerCase() ===
                        (nextSkill.category || 'Geral').trim().toLowerCase();

                    return (
                      <div
                        key={skill.id}
                        className={`skill-card-wrapper ${isSameCategoryWithNext ? 'has-next-same-cat' : ''}`}
                      >
                        <div
                          className={`skill-card compact-editor-card ${isMax ? 'gold-maxed' : ''}`}
                          style={getCardStyle(isMax, skillColor)}
                        >
                          <div className="skill-details">
                            <div className="skill-name">{skill.title || skill.name}</div>
                            <div className="skill-category">{skill.category}</div>
                          </div>

                          <div className="segments-center-zone">
                            <div className="segments-bar">
                              {renderSegmentBars(skill.level, skill.maxLevel, skillColor, isMax)}
                            </div>
                          </div>

                          <div className="level-text">Lvl {skill.level}</div>

                          <div className="editor-card-controls">
                            <button
                              type="button"
                              className="hide-action-btn"
                              onClick={() => { playSound('click'); toggleHideSkill(skill.id); }}
                            >
                              Ocultar
                            </button>
                            <button
                              type="button"
                              className="manage-edit-btn"
                              onClick={() => {
                                playSound('click');
                                setIsManageSkillsModalOpen(false);
                                setEditingSkill({ ...skill });
                              }}
                            >
                              Editar
                            </button>
                          </div>
                        </div>

                        {isSameCategoryWithNext && (
                          <div
                            className="category-connector-line"
                            style={{ '--category-line-color': skillColor }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="modal-actions-bar">
              <button className="confirm-button" onClick={() => { playSound('click'); setIsManageSkillsModalOpen(false); }}>
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {isCustomColorModalOpen && (
        <div className="modal-backdrop high-z-backdrop" onClick={() => { playSound('click'); setIsCustomColorModalOpen(false); }}>
          <div className="modal-window color-picker-modal high-z-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3>Personalizar Cor e Decks</h3>
              <button className="close-popup-btn" onClick={() => { playSound('click'); setIsCustomColorModalOpen(false); }}>×</button>
            </div>

            <div className="color-custom-card-compact">
              <span className="card-section-label">Escolher / Criar Cor Única:</span>

              <div className="compact-color-controls">
                <input
                  type="color"
                  value={pickedColorHex}
                  onChange={(e) => setPickedColorHex(e.target.value)}
                  className="picker-square-compact"
                  title="Escolher cor visualmente"
                />
                <input
                  type="text"
                  placeholder="Nome (opcional)"
                  value={newColorName}
                  onChange={(e) => setNewColorName(e.target.value)}
                  className="color-name-compact"
                />
                <input
                  type="text"
                  value={pickedColorHex}
                  onChange={(e) => setPickedColorHex(e.target.value)}
                  className="color-hex-compact"
                  maxLength={7}
                />
              </div>

              <div className="compact-buttons-row">
                <button
                  type="button"
                  className="compact-btn use-btn"
                  style={{ backgroundColor: pickedColorHex }}
                  onClick={() => handleApplyCustomColorDirectly(pickedColorHex)}
                >
                  Usar Esta Cor
                </button>
                <button
                  type="button"
                  className="compact-btn save-btn"
                  onClick={handleSaveColorToDeckAndApply}
                >
                  + Salvar no Meu Deck
                </button>
              </div>
            </div>

            <div className="decks-list-scroll-area">
              <span className="card-section-label">Decks de Cores Disponíveis:</span>

              <div className="decks-stack">
                {PRESET_DECKS.map((deck) => {
                  const isActive = activeDeckId === deck.id;
                  return (
                    <div key={deck.id} className={`deck-row-card ${isActive ? 'is-active-deck' : ''}`}>
                      <div className="deck-row-header">
                        <span className="deck-title">{deck.name}</span>
                        <button
                          type="button"
                          className={`deck-status-btn ${isActive ? 'active' : ''}`}
                          onClick={() => { playSound('click'); setActiveDeckId(deck.id); }}
                        >
                          {isActive ? 'Deck Padrão' : 'Definir como Deck Padrão'}
                        </button>
                      </div>

                      <div className="deck-chips-flex">
                        {deck.colors.map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            className="color-chip-btn"
                            onClick={() => handleApplyCustomColorDirectly(c.hex)}
                            title={`${c.name} (${c.hex})`}
                          >
                            <span className="chip-color-dot" style={{ backgroundColor: c.hex }} />
                            <span className="chip-color-name">{c.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <div className={`deck-row-card ${activeDeckId === 'deck_custom' ? 'is-active-deck' : ''}`}>
                  <div className="deck-row-header">
                    <span className="deck-title">Meu Deck Personalizado</span>
                    <button
                      type="button"
                      className={`deck-status-btn ${activeDeckId === 'deck_custom' ? 'active' : ''}`}
                      onClick={() => { playSound('click'); setActiveDeckId('deck_custom'); }}
                    >
                      {activeDeckId === 'deck_custom' ? 'Deck Padrão' : 'Definir como Deck Padrão'}
                    </button>
                  </div>

                  {customColorDeck.length === 0 ? (
                    <p className="no-colors-msg">Nenhuma cor salva no seu deck personalizado.</p>
                  ) : (
                    <div className="deck-chips-flex">
                      {customColorDeck.map((item) => (
                        <div key={item.id} className="custom-chip-wrapper">
                          <button
                            type="button"
                            className="color-chip-btn"
                            onClick={() => handleApplyCustomColorDirectly(item.hex)}
                            title={`${item.name} (${item.hex})`}
                          >
                            <span className="chip-color-dot" style={{ backgroundColor: item.hex }} />
                            <span className="chip-color-name">{item.name}</span>
                          </button>
                          <button
                            type="button"
                            className="delete-color-x"
                            onClick={() => { playSound('delete'); removeCustomColorFromDeck(item.id); }}
                            title="Remover cor do deck"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-actions-bar">
              <button className="confirm-button" onClick={() => { playSound('click'); setIsCustomColorModalOpen(false); }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {isThemeModalOpen && (
        <div className="modal-backdrop" onClick={() => { playSound('click'); setIsThemeModalOpen(false); }}>
          <div className="modal-window theme-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3>Tema Visual do Perfil ({nickname})</h3>
              <button className="close-popup-btn" onClick={() => { playSound('click'); setIsThemeModalOpen(false); }}>×</button>
            </div>

            <div className="theme-grid">
              {THEME_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  className={`theme-card ${currentTheme === preset.id ? 'active' : ''}`}
                  onClick={() => { playSound('train'); setCurrentTheme(preset.id); }}
                >
                  <div className="theme-preview" style={{ background: preset.bg }}>
                    <div className="theme-preview-accent" style={{ backgroundColor: preset.color }} />
                  </div>
                  <span className="theme-card-name">{preset.name}</span>
                </div>
              ))}
            </div>

            <div className="modal-actions-bar">
              <button className="confirm-button" onClick={() => { playSound('click'); setIsThemeModalOpen(false); }}>
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTasksSkill && (
        <div className="modal-backdrop" onClick={() => { playSound('click'); setActiveTasksSkill(null); }}>
          <div className="modal-window tasks-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3>Tasks para alcançar o Nível {activeTasksSkill.level + 1}</h3>
              <button className="close-popup-btn" onClick={() => { playSound('click'); setActiveTasksSkill(null); }}>×</button>
            </div>

            <div className="tasks-modal-list">
              {(activeTasksSkill.levelTasks?.[activeTasksSkill.level + 1] || []).map((task) => (
                <label key={task.id} className="tasks-modal-item">
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => {
                      playSound('click');
                      toggleChecktask(activeTasksSkill.id, activeTasksSkill.level + 1, task.id);
                      setActiveTasksSkill((prev) => {
                        const lvl = prev.level + 1;
                        const updatedTasks = (prev.levelTasks?.[lvl] || []).map((t) =>
                          t.id === task.id ? { ...t, done: !t.done } : t
                        );
                        return {
                          ...prev,
                          levelTasks: { ...prev.levelTasks, [lvl]: updatedTasks }
                        };
                      });
                    }}
                  />
                  <span className={task.done ? 'done-text' : ''}>{task.text || 'Sem descrição'}</span>
                </label>
              ))}
            </div>

            <div className="modal-actions-bar">
              <button className="confirm-button" onClick={() => { playSound('click'); setActiveTasksSkill(null); }}>
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="modal-backdrop" onClick={() => { playSound('click'); setIsAddModalOpen(false); }}>
          <form className="modal-window" onSubmit={handleCreateSkill} onClick={(e) => e.stopPropagation()}>
            <h3>Criar Nova Habilidade</h3>
            <input
              type="text"
              placeholder="Nome da habilidade"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
              required
            />
            <input
              type="text"
              placeholder="Categoria (ex: Idiomas, Programação)"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />

            <div className="field-group">
              <label>Adicionar em Pasta:</label>
              {!isCreatingFolderInModal ? (
                <select
                  value={newFolderSelect}
                  onChange={(e) => {
                    playSound('click');
                    if (e.target.value === '__CREATE_NEW__') {
                      setIsCreatingFolderInModal(true);
                      setNewCustomFolderInput('');
                    } else {
                      setNewFolderSelect(e.target.value);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.8rem',
                    borderRadius: '6px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--theme-border, #334155)',
                    color: '#fff',
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  {sortedAvailableFolders.map((f) => (
                    <option key={f} value={f}>
                      {f} {f === 'Geral' ? '(Padrão)' : ''}
                    </option>
                  ))}
                  <option value="__CREATE_NEW__">+ Criar Nova Pasta...</option>
                </select>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Nome da nova pasta..."
                    value={newCustomFolderInput}
                    onChange={(e) => setNewCustomFolderInput(e.target.value)}
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    className="cancel-button"
                    style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      playSound('click');
                      setIsCreatingFolderInModal(false);
                      setNewFolderSelect('Geral');
                    }}
                  >
                    Voltar
                  </button>
                </div>
              )}
            </div>

            <div className="field-group">
              <label>Níveis Máximos:</label>
              <div className="level-input-preset-row">
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={newMaxLevel}
                  onChange={(e) => setNewMaxLevel(Number(e.target.value))}
                  required
                />
                <select
                  className="preset-level-dropdown"
                  value={LEVEL_PRESETS.includes(newMaxLevel) ? newMaxLevel : ''}
                  onChange={(e) => {
                    playSound('click');
                    if (e.target.value) setNewMaxLevel(Number(e.target.value));
                  }}
                >
                  <option value="" disabled>Presets Nível...</option>
                  {LEVEL_PRESETS.map((num) => (
                    <option key={num} value={num}>
                      {num} Níveis
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field-group">
              <label>Cor Temática:</label>
              <div className="color-selector">
                {activeDeckColors.map((c) => (
                  <button
                    type="button"
                    key={c.hex}
                    className={`color-dot ${newColor === c.hex ? 'selected' : ''}`}
                    style={{ backgroundColor: c.hex }}
                    onClick={() => { playSound('click'); setNewColor(c.hex); }}
                    title={`${c.name || 'Cor'} (${c.hex})`}
                  />
                ))}

                <button
                  type="button"
                  className="add-custom-color-dot-btn"
                  onClick={() => handleOpenColorPickerModal('new', newColor)}
                  title="Abrir gerenciador de cores e decks"
                >
                  +
                </button>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={() => { playSound('click'); setIsAddModalOpen(false); }}
              >
                Cancelar
              </button>
              <button type="submit" className="confirm-button">
                Adicionar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE HABILIDADE */}
      {editingSkill && (
        <div className="modal-backdrop" onClick={() => handleSaveEdit()}>
          <form className="modal-window full-screen-edit" onSubmit={handleSaveEdit} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h2>Editar Habilidade: {editingSkill.title || editingSkill.name}</h2>
              <div className="header-action-row-right">
                <button
                  type="button"
                  className="delete-btn"
                  onClick={() => {
                    playSound('delete');
                    deleteSkill(editingSkill.id);
                    setEditingSkill(null);
                  }}
                >
                  Excluir Habilidade
                </button>
                <button
                  type="button"
                  className="close-modal-x-btn"
                  onClick={() => {
                    playSound('click');
                    setEditingSkill(null);
                  }}
                  title="Fechar"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="horizontal-info-bar">
              <div className="field-group flex-2">
                <label>Nome da Habilidade</label>
                <input
                  type="text"
                  value={editingSkill.title || editingSkill.name || ''}
                  onChange={(e) =>
                    setEditingSkill({ ...editingSkill, title: e.target.value, name: e.target.value })
                  }
                  required
                />
                <button
                  type="button"
                  className="mini-missions-envelope-btn"
                  style={{ marginTop: '0.4rem', width: 'fit-content', padding: '0.35rem 0.7rem', fontSize: '1.1rem', cursor: 'pointer' }}
                  onClick={() => {
                    playSound('click');
                    setMiniMissionsModalTab('list');
                    setIsMiniMissionsModalOpen(true);
                  }}
                  title="Gerenciar Mini Missões"
                >
                  ✉
                </button>
              </div>

              <div className="field-group flex-2">
                <label>Categoria</label>
                <input
                  type="text"
                  value={editingSkill.category}
                  onChange={(e) =>
                    setEditingSkill({ ...editingSkill, category: e.target.value })
                  }
                />
                <button
                  type="button"
                  className="link-new-skill-btn"
                  onClick={handleLinkNewSkillInSameCategory}
                  title="Criar outra habilidade com esta mesma categoria"
                >
                  🔗 Interligar Nova Habilidade
                </button>
              </div>

              <div className="field-group flex-1">
                <label>Pasta Organizadora</label>
                <select
                  value={editingSkill.folder || 'Geral'}
                  onChange={(e) =>
                    setEditingSkill({ ...editingSkill, folder: e.target.value })
                  }
                  style={{ padding: '0.45rem', borderRadius: '6px', background: 'rgba(0, 0, 0, 0.3)', color: '#fff', border: '1px solid var(--theme-border, #334155)' }}
                >
                  {sortedAvailableFolders.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div className="field-group flex-1">
                <label>Cor Temática</label>
                <div className="color-selector">
                  {activeDeckColors.map((c) => (
                    <button
                      type="button"
                      key={c.hex}
                      className={`color-dot ${editingSkill.color === c.hex ? 'selected' : ''}`}
                      style={{ backgroundColor: c.hex }}
                      onClick={() => { playSound('click'); setEditingSkill({ ...editingSkill, color: c.hex }); }}
                      title={`${c.name || 'Cor'} (${c.hex})`}
                    />
                  ))}

                  <button
                    type="button"
                    className="add-custom-color-dot-btn"
                    onClick={() => handleOpenColorPickerModal('editing', editingSkill.color)}
                    title="Abrir gerenciador de cores e decks"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="control-box flex-1">
                <div className="box-title-stacked">
                  <span>Concluídos:</span>
                  <strong>Lvl {editingSkill.level}</strong>
                </div>
                <div className="btn-group">
                  <button
                    type="button"
                    className="icon-button"
                    disabled={editingSkill.level <= 0}
                    onMouseDown={() => startHoldAction(() => {
                      playSound('click');
                      downgradeSkill(editingSkill.id);
                      setEditingSkill((prev) => ({
                        ...prev,
                        level: Math.max(0, prev.level - 1)
                      }));
                    })}
                    onMouseUp={stopHold}
                    onMouseLeave={stopHold}
                    onTouchStart={() => startHoldAction(() => {
                      playSound('click');
                      downgradeSkill(editingSkill.id);
                      setEditingSkill((prev) => ({
                        ...prev,
                        level: Math.max(0, prev.level - 1)
                      }));
                    })}
                    onTouchEnd={stopHold}
                    title="Diminuir nível"
                  >
                    −
                  </button>

                  <button
                    type="button"
                    className="icon-button"
                    disabled={editingSkill.level >= editingSkill.maxLevel}
                    onMouseDown={() => startHoldAction(() => {
                      playSound('train');
                      trainSkill(editingSkill.id);
                      setEditingSkill((prev) => ({
                        ...prev,
                        level: Math.min(prev.maxLevel, prev.level + 1)
                      }));
                    })}
                    onMouseUp={stopHold}
                    onMouseLeave={stopHold}
                    onTouchStart={() => startHoldAction(() => {
                      playSound('train');
                      trainSkill(editingSkill.id);
                      setEditingSkill((prev) => ({
                        ...prev,
                        level: Math.min(prev.maxLevel, prev.level + 1)
                      }));
                    })}
                    onTouchEnd={stopHold}
                    title="Aumentar nível"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="control-box flex-2">
                <div className="max-lvl-header-row">
                  <div className="title-with-custom-btn">
                    <span>Nível Máximo: <strong>{editingSkill.maxLevel}</strong></span>
                    <button
                      type="button"
                      className="edit-max-custom-btn"
                      onClick={() => { playSound('click'); setIsCustomMaxLevelInput((prev) => !prev); }}
                      title="Digitar quantidade de níveis customizada"
                    >
                      Personalizar
                    </button>
                  </div>

                  {isCustomMaxLevelInput ? (
                    <input
                      type="number"
                      min="1"
                      max="500"
                      value={editingSkill.maxLevel}
                      onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value));
                        setEditingSkill((prev) => ({ ...prev, maxLevel: val }));
                      }}
                      className="custom-max-lvl-input"
                      placeholder="Qtd Níveis"
                      autoFocus
                    />
                  ) : (
                    <select
                      className="preset-level-dropdown mini"
                      value={LEVEL_PRESETS.includes(editingSkill.maxLevel) ? editingSkill.maxLevel : ''}
                      onChange={(e) => {
                        playSound('click');
                        if (e.target.value) {
                          setEditingSkill((prev) => ({
                            ...prev,
                            maxLevel: Number(e.target.value)
                          }));
                        }
                      }}
                    >
                      <option value="" disabled>Padrões...</option>
                      {LEVEL_PRESETS.map((num) => (
                        <option key={num} value={num}>
                          {num} Níveis
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="btn-group">
                  <button
                    type="button"
                    className="icon-button"
                    disabled={editingSkill.maxLevel <= 1}
                    onMouseDown={() => startHoldAction(() => {
                      playSound('click');
                      setEditingSkill((prev) => ({
                        ...prev,
                        maxLevel: Math.max(1, prev.maxLevel - 1)
                      }));
                    })}
                    onMouseUp={stopHold}
                    onMouseLeave={stopHold}
                    onTouchStart={() => startHoldAction(() => {
                      playSound('click');
                      setEditingSkill((prev) => ({
                        ...prev,
                        maxLevel: Math.max(1, prev.maxLevel - 1)
                      }));
                    })}
                    onTouchEnd={stopHold}
                    title="Diminuir nível máximo"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onMouseDown={() => startHoldAction(() => {
                      playSound('click');
                      setEditingSkill((prev) => ({
                        ...prev,
                        maxLevel: prev.maxLevel + 1
                      }));
                    })}
                    onMouseUp={stopHold}
                    onMouseLeave={stopHold}
                    onTouchStart={() => startHoldAction(() => {
                      playSound('click');
                      setEditingSkill((prev) => ({
                        ...prev,
                        maxLevel: prev.maxLevel + 1
                      }));
                    })}
                    onTouchEnd={stopHold}
                    title="Adicionar nível máximo"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="objectives-section-wrapper">
              <h3 className="section-label-large">Metas e Sub-tarefas por Nível</h3>
              <div className="horizontal-levels-grid">
                {Array.from({ length: editingSkill.maxLevel }).map((_, idx) => {
                  const lvlNum = idx + 1;
                  const targetActiveLevel = editingSkill.level + 1;
                  const isCurrentActive = lvlNum === targetActiveLevel;
                  const isPassed = lvlNum <= editingSkill.level;
                  const tasksForLvl = editingSkill.levelTasks?.[lvlNum] || [];

                  return (
                    <div
                      key={lvlNum}
                      className={`level-card-item ${isCurrentActive ? 'active-level' : ''} ${isPassed ? 'passed-level' : ''}`}
                    >
                      <div className="level-card-header">
                        <span className="level-card-badge">Nível {lvlNum}</span>
                        {isCurrentActive && <span className="current-indicator">EM PROGRESSO</span>}
                        {isPassed && <span className="passed-indicator">CONCLUÍDO</span>}
                      </div>

                      <textarea
                        rows={2}
                        placeholder={`Meta principal do Nível ${lvlNum}`}
                        value={editingSkill.levelDescriptions?.[lvlNum] || ''}
                        onChange={(e) => handleLevelDescChange(lvlNum, e.target.value)}
                      />

                      <div className="subtasks-editor">
                        <div className="subtasks-header">
                          <span>Sub-tarefas ({tasksForLvl.length}):</span>
                          <button
                            type="button"
                            className="add-task-mini-btn"
                            onClick={() => handleAddTaskToLevel(lvlNum)}
                          >
                            + Item
                          </button>
                        </div>
                        <div className="subtasks-inputs-list">
                          {tasksForLvl.map((task) => (
                            <div key={task.id} className="subtask-row" style={{ width: '100%', boxSizing: 'border-box' }}>
                              <input
                                type="checkbox"
                                className="task-checkbox"
                                checked={task.done}
                                onChange={() => handleToggleTaskInModal(lvlNum, task.id)}
                              />
                              <input
                                type="text"
                                placeholder="Descrição da tarefa..."
                                value={task.text}
                                style={{ flex: 1, minWidth: 0 }}
                                onChange={(e) =>
                                  handleUpdateTaskText(lvlNum, task.id, e.target.value)
                                }
                              />
                              <button
                                type="button"
                                className="remove-task-btn"
                                style={{ flexShrink: 0 }}
                                onClick={() => handleDeleteTask(lvlNum, task.id)}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-actions-bar">
              <button
                type="button"
                className="cancel-button"
                onClick={() => { playSound('click'); setEditingSkill(null); }}
              >
                Cancelar
              </button>
              <button type="submit" className="confirm-button" onClick={() => playSound('click')}>
                Salvar Alterações
              </button>
            </div>
          </form>
        </div>
      )}

      {/* COMPONENTES DO POMODORO E TAREFAS */}
      <PomodoroModal pomodoro={pomodoro} playSound={playSound} />
      <PomodoroWidget pomodoro={pomodoro} playSound={playSound} />
      <TaskModal taskState={taskState} playSound={playSound} />
      <UpIdiomaModal
        isOpen={isLanguageModalOpen}
        onClose={() => setIsLanguageModalOpen(false)}
        playSound={playSound}
      />
{/* ... outros modais do final do App.jsx ... */}

      <EditMissionsModal
        isOpen={isEditMissionsModalOpen}
        onClose={() => setIsEditMissionsModalOpen(false)}
        skills={skills}
        dailyMissionsQuota={dailyMissionsQuota}
        setDailyMissionsQuota={setDailyMissionsQuota}
        prioritizedMissions={prioritizedMissions}
        togglePrioritizeMission={togglePrioritizeMission}
        updateMiniMissionText={updateMiniMissionText}
        playSound={playSound}
      />

      {/* === COLE O PASSO 3 AQUI (LOGO ABAIXO DO EditMissionsModal) === */}
      {isMissionsHistoryModalOpen && (
        <div className="modal-backdrop high-z-backdrop" onClick={() => { playSound('click'); setIsMissionsHistoryModalOpen(false); }}>
          <div className="modal-window high-z-window" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px', width: '92vw' }}>
            <div className="modal-header-row">
              <h3>Histórico de Missões Concluídas</h3>
              <button className="close-popup-btn" onClick={() => { playSound('click'); setIsMissionsHistoryModalOpen(false); }}>✕</button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.5rem 0 1rem 0' }}>
              Lista das missões concluídas e recompensas resgatadas.
            </p>

            {(!dailyMissions || dailyMissions.filter((m) => m.completed).length === 0) ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8', fontSize: '0.9rem' }}>
                Nenhuma missão foi concluída ainda.
              </div>
            ) : (
              <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingRight: '0.3rem' }}>
                {dailyMissions
                  .filter((m) => m.completed)
                  .map((mission) => (
                    <div
                      key={mission.id}
                      style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid var(--theme-border, rgba(255, 255, 255, 0.1))',
                        borderRadius: '8px',
                        padding: '0.75rem 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.8rem'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--theme-accent, #38bdf8)', fontWeight: 'bold' }}>
                          {mission.skillName}
                        </span>
                        <span style={{ fontSize: '0.9rem', color: '#f8fafc' }}>
                          {mission.text}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontSize: '0.82rem', color: '#34d399', fontWeight: 'bold' }}>
                          Concluída ✓
                        </span>
                        <span style={{ fontSize: '0.85rem', color: '#facc15', fontWeight: 'bold' }}>
                          +{mission.rewardDiamonds || 1} 💎
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            <div className="modal-actions-bar" style={{ marginTop: '1.2rem' }}>
              <button className="confirm-button" onClick={() => { playSound('click'); setIsMissionsHistoryModalOpen(false); }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ============================================================ */}

    </div>
  );
}