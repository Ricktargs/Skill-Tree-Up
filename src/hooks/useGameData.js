import { useState, useEffect } from 'react';

export const PRESET_DECKS = [
  {
    id: 'deck_neon',
    name: 'Neon Cyber',
    colors: [
      { name: 'Azul Neon', hex: '#3b82f6' },
      { name: 'Ciano', hex: '#06b6d4' },
      { name: 'Roxo Neon', hex: '#a855f7' },
      { name: 'Rosa Neon', hex: '#ec4899' },
      { name: 'Verde Lima', hex: '#10b981' }
    ]
  },
  {
    id: 'deck_pastel',
    name: 'Suave / Pastel',
    colors: [
      { name: 'Azul Céu', hex: '#38bdf8' },
      { name: 'Menta', hex: '#34d399' },
      { name: 'Lavanda', hex: '#c084fc' },
      { name: 'Pêssego', hex: '#fb923c' },
      { name: 'Rosa Suave', hex: '#f472b6' }
    ]
  },
  {
    id: 'deck_elemental',
    name: 'Elemental RPG',
    colors: [
      { name: 'Fogo', hex: '#ef4444' },
      { name: 'Água', hex: '#0284c7' },
      { name: 'Terra', hex: '#15803d' },
      { name: 'Trovão', hex: '#eab308' },
      { name: 'Sombra', hex: '#64748b' }
    ]
  }
];

export const getXpNeededForLevel = (lvl) => {
  return 500 + (Math.max(1, lvl) - 1) * 200;
};

export const calculatePlayerLevelStats = (totalXp) => {
  let lvl = 1;
  let currentXp = Math.max(0, totalXp);
  let needed = getXpNeededForLevel(lvl);

  while (currentXp >= needed) {
    currentXp -= needed;
    lvl++;
    needed = getXpNeededForLevel(lvl);
  }

  return {
    playerLevel: lvl,
    currentXpProgress: currentXp,
    xpNeededForNext: needed
  };
};

export const calculateTotalXpFromSkills = (skillsList) => {
  if (!Array.isArray(skillsList)) return 0;
  return skillsList.reduce((acc, skill) => {
    const currentLvl = Number(skill.level) || 0;
    const maxLvl = Number(skill.maxLevel) || 10;
    if (currentLvl <= 0) return acc;

    if (currentLvl >= maxLvl) {
      return acc + ((maxLvl - 1) * 10 + 50);
    } else {
      return acc + (currentLvl * 10);
    }
  }, 0);
};

const DEFAULT_PROFILE_DATA = {
  nickname: 'Herói Principal',
  avatar: '🛡️',
  currentTheme: 'cyberpunk',
  boxColorType: 'default',
  extraXp: 0,
  xpHistory: [],
  folders: ['Geral', 'Trabalho', 'Estudos'],
  skills: [
    {
      id: 'skill_1',
      title: 'Programação React',
      category: 'Tecnologia',
      folder: 'Estudos',
      level: 1,
      maxLevel: 10,
      color: '#3b82f6',
      levelDescriptions: { 1: 'Aprender JSX e Props' },
      levelTasks: { 1: [{ id: 't1', text: 'Criar primeiro app', done: false }] }
    }
  ],
  customColorDeck: [],
  activeDeckId: 'deck_neon',
  hiddenSkillIds: [],
  pendingTransfers: []
};

export function useGameData() {
  const [profiles, setProfiles] = useState(() => {
    const saved = localStorage.getItem('rpg_profiles_list');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [{ id: 'profile_default', name: 'Herói Principal', avatar: '🛡️' }];
  });

  const [activeProfileId, setActiveProfileId] = useState(() => {
    return localStorage.getItem('rpg_active_profile_id') || 'profile_default';
  });

  const getProfileStorageKey = (id) => `rpg_profile_data_${id}`;

  const loadDataForProfile = (id) => {
    const saved = localStorage.getItem(getProfileStorageKey(id));
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          nickname: parsed.nickname || 'Herói',
          avatar: parsed.avatar || '🛡️',
          currentTheme: parsed.currentTheme || 'cyberpunk',
          boxColorType: parsed.boxColorType || 'default',
          extraXp: Number(parsed.extraXp) || 0,
          xpHistory: parsed.xpHistory || [],
          folders: Array.isArray(parsed.folders) ? parsed.folders : ['Geral'],
          skills: parsed.skills || [],
          customColorDeck: parsed.customColorDeck || [],
          activeDeckId: parsed.activeDeckId || 'deck_neon',
          hiddenSkillIds: parsed.hiddenSkillIds || [],
          pendingTransfers: parsed.pendingTransfers || []
        };
      } catch (e) {}
    }
    return DEFAULT_PROFILE_DATA;
  };

  const initialData = loadDataForProfile(activeProfileId);

  const [nickname, setNickname] = useState(initialData.nickname);
  const [avatar, setAvatar] = useState(initialData.avatar);
  const [currentTheme, setCurrentTheme] = useState(initialData.currentTheme);
  const [boxColorType, setBoxColorType] = useState(initialData.boxColorType);
  const [extraXp, setExtraXp] = useState(initialData.extraXp);
  const [xpHistory, setXpHistory] = useState(initialData.xpHistory);
  const [folders, setFolders] = useState(initialData.folders);
  const [skills, setSkills] = useState(initialData.skills);
  const [customColorDeck, setCustomColorDeck] = useState(initialData.customColorDeck);
  const [activeDeckId, setActiveDeckId] = useState(initialData.activeDeckId);
  const [hiddenSkillIds, setHiddenSkillIds] = useState(initialData.hiddenSkillIds);
  const [pendingTransfers, setPendingTransfers] = useState(initialData.pendingTransfers);

  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  useEffect(() => {
    localStorage.setItem('rpg_profiles_list', JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem('rpg_active_profile_id', activeProfileId);
  }, [activeProfileId]);

  useEffect(() => {
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === activeProfileId ? { ...p, name: nickname, avatar: avatar } : p
      )
    );
  }, [nickname, avatar, activeProfileId]);

  useEffect(() => {
    const dataToSave = {
      nickname,
      avatar,
      currentTheme,
      boxColorType,
      extraXp,
      xpHistory,
      folders,
      skills,
      customColorDeck,
      activeDeckId,
      hiddenSkillIds,
      pendingTransfers
    };
    localStorage.setItem(getProfileStorageKey(activeProfileId), JSON.stringify(dataToSave));
  }, [activeProfileId, nickname, avatar, currentTheme, boxColorType, extraXp, xpHistory, folders, skills, customColorDeck, activeDeckId, hiddenSkillIds, pendingTransfers]);

  const recordState = (newSkills, newHidden) => {
    setHistory((prev) => [
      ...prev,
      {
        skills: JSON.parse(JSON.stringify(skills)),
        hiddenSkillIds: [...hiddenSkillIds]
      }
    ]);
    setFuture([]);
    if (newSkills) setSkills(newSkills);
    if (newHidden) setHiddenSkillIds(newHidden);
  };

  const switchProfile = (targetProfileId) => {
    if (targetProfileId === activeProfileId) return;
    const targetData = loadDataForProfile(targetProfileId);
    setActiveProfileId(targetProfileId);
    setNickname(targetData.nickname);
    setAvatar(targetData.avatar);
    setCurrentTheme(targetData.currentTheme);
    setBoxColorType(targetData.boxColorType || 'default');
    setExtraXp(targetData.extraXp || 0);
    setXpHistory(targetData.xpHistory || []);
    setFolders(targetData.folders || ['Geral']);
    setSkills(targetData.skills);
    setCustomColorDeck(targetData.customColorDeck);
    setActiveDeckId(targetData.activeDeckId);
    setHiddenSkillIds(targetData.hiddenSkillIds);
    setPendingTransfers(targetData.pendingTransfers || []);
    setHistory([]);
    setFuture([]);
  };

  const createProfile = (name, avatarSymbol) => {
    const newId = `profile_${Date.now()}`;
    const newProfileName = name.trim() || `Perfil ${profiles.length + 1}`;
    const newAvatar = avatarSymbol || '🛡️';
    const newProfileMeta = { id: newId, name: newProfileName, avatar: newAvatar };

    const initialProfileData = {
      nickname: newProfileName,
      avatar: newAvatar,
      currentTheme: 'cyberpunk',
      boxColorType: 'default',
      extraXp: 0,
      xpHistory: [],
      folders: ['Geral'],
      skills: [],
      customColorDeck: [],
      activeDeckId: 'deck_neon',
      hiddenSkillIds: [],
      pendingTransfers: []
    };

    localStorage.setItem(getProfileStorageKey(newId), JSON.stringify(initialProfileData));
    setProfiles((prev) => [...prev, newProfileMeta]);
    switchProfile(newId);
  };

  const deleteProfile = (profileIdToDelete) => {
    if (profiles.length <= 1) return;
    const updatedProfiles = profiles.filter((p) => p.id !== profileIdToDelete);
    localStorage.removeItem(getProfileStorageKey(profileIdToDelete));
    setProfiles(updatedProfiles);
    if (activeProfileId === profileIdToDelete) {
      switchProfile(updatedProfiles[0].id);
    }
  };

  const sendTransferRequest = (sourceId, targetId, mode) => {
    if (!sourceId || !targetId || sourceId === targetId) return false;

    const sourceData = loadDataForProfile(sourceId);
    const targetData = loadDataForProfile(targetId);

    const srcSkills = sourceId === activeProfileId ? skills : (sourceData.skills || []);
    const srcExtraXp = sourceId === activeProfileId ? extraXp : (sourceData.extraXp || 0);
    const srcTotalXp = calculateTotalXpFromSkills(srcSkills) + srcExtraXp;

    if (srcTotalXp === 0) return false;

    const transferPayload = {
      id: `transfer_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sourceId,
      sourceName: sourceData.nickname || 'Perfil',
      mode,
      skills: mode === 'all' ? JSON.parse(JSON.stringify(srcSkills)) : [],
      xpAmount: srcTotalXp,
      createdAt: new Date().toISOString()
    };

    const updatedTargetTransfers = [...(targetData.pendingTransfers || []), transferPayload];
    targetData.pendingTransfers = updatedTargetTransfers;

    localStorage.setItem(getProfileStorageKey(targetId), JSON.stringify(targetData));

    if (targetId === activeProfileId) {
      setPendingTransfers(updatedTargetTransfers);
    }
    return true;
  };

  const acceptTransfer = (transferId) => {
    const transfer = pendingTransfers.find((t) => t.id === transferId);
    if (!transfer) return;

    const remainingTransfers = pendingTransfers.filter((t) => t.id !== transferId);
    setPendingTransfers(remainingTransfers);

    const sourceData = loadDataForProfile(transfer.sourceId);
    sourceData.skills = [];
    sourceData.extraXp = 0;
    localStorage.setItem(getProfileStorageKey(transfer.sourceId), JSON.stringify(sourceData));

    if (transfer.sourceId === activeProfileId) {
      setSkills([]);
      setExtraXp(0);
    }

    const nowFormatted = new Date().toLocaleString('pt-BR');

    if (transfer.mode === 'all' && Array.isArray(transfer.skills)) {
      const incomingSkills = transfer.skills.map((s) => ({
        ...s,
        id: `skill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      }));
      setSkills((prev) => [...prev, ...incomingSkills]);

      const logEntry = {
        id: `xplog_${Date.now()}`,
        title: `Recebeu Habilidades + XP de "${transfer.sourceName}"`,
        category: 'Transferência',
        amount: transfer.xpAmount,
        date: nowFormatted
      };
      setXpHistory((prev) => [logEntry, ...prev]);
    } else if (transfer.mode === 'xp_only' && transfer.xpAmount > 0) {
      setExtraXp((prev) => prev + transfer.xpAmount);

      const logEntry = {
        id: `xplog_${Date.now()}`,
        title: `XP Recebido de "${transfer.sourceName}"`,
        category: 'Transferência',
        amount: transfer.xpAmount,
        date: nowFormatted
      };
      setXpHistory((prev) => [logEntry, ...prev]);
    }
  };

  const rejectTransfer = (transferId) => {
    const remainingTransfers = pendingTransfers.filter((t) => t.id !== transferId);
    setPendingTransfers(remainingTransfers);
  };

  const addFolder = (folderName) => {
    const trimmed = folderName.trim();
    if (!trimmed || folders.includes(trimmed)) return;
    setFolders((prev) => [...prev, trimmed]);
  };

  const moveSkillToFolder = (skillId, targetFolderName) => {
    const updated = skills.map((s) =>
      s.id === skillId ? { ...s, folder: targetFolderName } : s
    );
    recordState(updated);
  };

  const skillsXp = calculateTotalXpFromSkills(skills);
  const totalXp = skillsXp + extraXp;
  const { playerLevel, currentXpProgress, xpNeededForNext } = calculatePlayerLevelStats(totalXp);

  const getProfileStats = (profileId) => {
    if (profileId === activeProfileId) {
      return { xp: totalXp, level: playerLevel };
    }
    const pData = loadDataForProfile(profileId);
    const pXp = calculateTotalXpFromSkills(pData.skills || []) + (pData.extraXp || 0);
    const pStats = calculatePlayerLevelStats(pXp);
    return { xp: pXp, level: pStats.playerLevel };
  };

  const getActiveDeckColors = () => {
    if (activeDeckId === 'deck_custom') return customColorDeck;
    const found = PRESET_DECKS.find((d) => d.id === activeDeckId);
    return found ? found.colors : PRESET_DECKS[0].colors;
  };

  const trainSkill = (skillId) => {
    let isMaxed = false;
    let gainedSkillTitle = '';
    let gainedCategory = 'Geral';
    let gainedXpAmount = 10;
    let newLvl = 1;

    const updated = skills.map((s) => {
      if (s.id === skillId && s.level < s.maxLevel) {
        newLvl = s.level + 1;
        gainedSkillTitle = s.title;
        gainedCategory = s.category || 'Geral';
        if (newLvl >= s.maxLevel) {
          isMaxed = true;
          gainedXpAmount = 50;
        }
        return { ...s, level: newLvl };
      }
      return s;
    });

    if (gainedSkillTitle) {
      const nowFormatted = new Date().toLocaleString('pt-BR');
      const logEntry = {
        id: `xplog_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        title: `Evolução: ${gainedSkillTitle} (Nível ${newLvl})`,
        category: gainedCategory,
        amount: gainedXpAmount,
        date: nowFormatted
      };
      setXpHistory((prev) => [logEntry, ...prev]);
    }

    recordState(updated);
    return isMaxed;
  };

  const downgradeSkill = (skillId) => {
    const updated = skills.map((s) => {
      if (s.id === skillId && s.level > 0) {
        return { ...s, level: s.level - 1 };
      }
      return s;
    });
    recordState(updated);
  };

  const toggleChecktask = (skillId, lvl, taskId) => {
    const updated = skills.map((s) => {
      if (s.id === skillId) {
        const lvlTasks = s.levelTasks?.[lvl] || [];
        const updatedTasks = lvlTasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));
        return { ...s, levelTasks: { ...(s.levelTasks || {}), [lvl]: updatedTasks } };
      }
      return s;
    });
    recordState(updated);
  };

  const updateSkill = (skillId, newSkillData) => {
    const updated = skills.map((s) => (s.id === skillId ? { ...newSkillData } : s));
    recordState(updated);
  };

  const deleteSkill = (skillId) => {
    const updated = skills.filter((s) => s.id !== skillId);
    const updatedHidden = hiddenSkillIds.filter((id) => id !== skillId);
    recordState(updated, updatedHidden);
  };

  const addSkill = (title, category, maxLevel, color, folder) => {
    const newSkill = {
      id: `skill_${Date.now()}`,
      title: title.trim(),
      category: category ? category.trim() : 'Geral',
      folder: folder ? folder.trim() : 'Geral',
      level: 0,
      maxLevel: Number(maxLevel) || 10,
      color: color || '#3b82f6',
      levelDescriptions: {},
      levelTasks: {}
    };
    recordState([...skills, newSkill]);
  };

  const reorderSkills = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= skills.length) return;
    const result = Array.from(skills);
    const [removed] = result.splice(fromIndex, 1);
    result.splice(toIndex, 0, removed);
    recordState(result);
  };

  const toggleHideSkill = (skillId) => {
    const isHidden = hiddenSkillIds.includes(skillId);
    const newHidden = isHidden
      ? hiddenSkillIds.filter((id) => id !== skillId)
      : [...hiddenSkillIds, skillId];
    recordState(null, newHidden);
  };

  const addCustomColorToDeck = (name, hex) => {
    const newItem = { id: `col_${Date.now()}`, name: name || 'Custom', hex };
    setCustomColorDeck((prev) => [...prev, newItem]);
  };

  const removeCustomColorFromDeck = (colId) => {
    setCustomColorDeck((prev) => prev.filter((c) => c.id !== colId));
  };

  const exportAllData = () => {
    const currentActiveData = {
      nickname,
      avatar,
      currentTheme,
      boxColorType,
      extraXp,
      xpHistory,
      folders,
      skills,
      customColorDeck,
      activeDeckId,
      hiddenSkillIds,
      pendingTransfers
    };

    const profilesDataMap = {};
    profiles.forEach((p) => {
      if (p.id === activeProfileId) {
        profilesDataMap[p.id] = currentActiveData;
      } else {
        profilesDataMap[p.id] = loadDataForProfile(p.id);
      }
    });

    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      activeProfileId,
      profiles,
      profilesData: profilesDataMap
    };
  };

  const importData = (data) => {
    if (!data) return false;

    try {
      if (Array.isArray(data.profiles) && data.profilesData) {
        setProfiles(data.profiles);
        localStorage.setItem('rpg_profiles_list', JSON.stringify(data.profiles));

        Object.entries(data.profilesData).forEach(([profId, profData]) => {
          localStorage.setItem(getProfileStorageKey(profId), JSON.stringify(profData));
        });

        const targetActiveId = data.activeProfileId && data.profilesData[data.activeProfileId]
          ? data.activeProfileId
          : data.profiles[0].id;

        setActiveProfileId(targetActiveId);
        localStorage.setItem('rpg_active_profile_id', targetActiveId);

        const activeData = data.profilesData[targetActiveId] || loadDataForProfile(targetActiveId);
        setNickname(activeData.nickname || 'Herói');
        setAvatar(activeData.avatar || '🛡️');
        setCurrentTheme(activeData.currentTheme || 'cyberpunk');
        setBoxColorType(activeData.boxColorType || 'default');
        setExtraXp(activeData.extraXp || 0);
        setXpHistory(activeData.xpHistory || []);
        setFolders(activeData.folders || ['Geral']);
        setSkills(activeData.skills || []);
        setCustomColorDeck(activeData.customColorDeck || []);
        setActiveDeckId(activeData.activeDeckId || 'deck_neon');
        setHiddenSkillIds(activeData.hiddenSkillIds || []);
        setPendingTransfers(activeData.pendingTransfers || []);

        setHistory([]);
        setFuture([]);
        return true;
      }

      if (data.skills) {
        setSkills(data.skills);
        if (data.nickname) setNickname(data.nickname);
        if (data.avatar) setAvatar(data.avatar);
        if (data.currentTheme) setCurrentTheme(data.currentTheme);
        if (data.boxColorType) setBoxColorType(data.boxColorType);
        if (data.extraXp) setExtraXp(data.extraXp);
        if (data.xpHistory) setXpHistory(data.xpHistory);
        if (data.folders) setFolders(data.folders);
        if (data.customColorDeck) setCustomColorDeck(data.customColorDeck);
        if (data.activeDeckId) setActiveDeckId(data.activeDeckId);
        if (data.hiddenSkillIds) setHiddenSkillIds(data.hiddenSkillIds);
        if (data.pendingTransfers) setPendingTransfers(data.pendingTransfers);
        setHistory([]);
        setFuture([]);
        return true;
      }
    } catch (e) {
      console.error('Erro ao importar backup:', e);
    }

    return false;
  };

  const undo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setFuture((prev) => [
      { skills: JSON.parse(JSON.stringify(skills)), hiddenSkillIds: [...hiddenSkillIds] },
      ...prev
    ]);
    setSkills(last.skills);
    setHiddenSkillIds(last.hiddenSkillIds);
    setHistory((prev) => prev.slice(0, prev.length - 1));
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory((prev) => [
      ...prev,
      { skills: JSON.parse(JSON.stringify(skills)), hiddenSkillIds: [...hiddenSkillIds] }
    ]);
    setSkills(next.skills);
    setHiddenSkillIds(next.hiddenSkillIds);
    setFuture((prev) => prev.slice(1));
  };

  return {
    profiles,
    activeProfileId,
    switchProfile,
    createProfile,
    deleteProfile,
    getProfileStats,
    skills,
    nickname,
    setNickname,
    avatar,
    setAvatar,
    currentTheme,
    setCurrentTheme,
    boxColorType,
    setBoxColorType,
    extraXp,
    xpHistory,
    folders,
    addFolder,
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
    redo
  };
}