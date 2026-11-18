import { useState, useEffect } from 'react';
import { STARTER_FOLDERS, seedStarterProfile, starterSkills } from '../shared/starterProfile.js';
import { publishActiveProfile } from '../shared/activeProfile.js';
import { useUndoRestore } from '../atualizacao2_0/GlobalUndo.js';

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
  return skillsList.reduce((total, skill) => {
    let skillLevelsSum = 0;

    // Pega o nível do Módulo Principal (Geral)
    const defaultLvl = skill.defaultLevel !== undefined
      ? skill.defaultLevel
      : (skill.activeModuleId === 'default' || !skill.activeModuleId ? Number(skill.level) || 0 : 0);

    skillLevelsSum += defaultLvl;

    // Soma os níveis de todos os outros módulos criados na habilidade
    if (Array.isArray(skill.modules)) {
      skill.modules.forEach((mod) => {
        skillLevelsSum += (Number(mod.level) || 0);
      });
    }

    // Retorna a soma de XP de todos os módulos combinados
    return total + (skillLevelsSum * 10);
  }, 0);
};

// Dia do jogo: horário LOCAL, virando às 04:00 (antes cada parte usava um fuso/hora
// diferente e as missões chegavam a ser sorteadas duas vezes por dia)
export const GAME_DAY_START_HOUR = 4;
export const getGameDayKey = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(d.getHours() - GAME_DAY_START_HOUR);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const logId = () => `dl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// Registro de diamantes: cada ganho/ajuste com data, hora e origem.
// source: 'mission' | 'bonus' | 'manual'
const makeLogEntry = (amount, source, extra = {}) => ({
  id: logId(),
  at: new Date().toISOString(),
  amount,
  source,
  ...extra
});

// Missões concluídas antes do registro existir entram sem data
const backfillDiamondLog = (log, dailyMissions) => {
  const list = Array.isArray(log) ? log : [];
  const logged = new Set(list.filter((e) => e.missionId).map((e) => e.missionId));
  const missing = (dailyMissions || [])
    .filter((m) => m.completed && !logged.has(m.id))
    .map((m) => ({
      id: logId(),
      at: m.completedAt || null,
      amount: m.rewardDiamonds || 1,
      source: 'mission',
      missionId: m.id,
      skillId: m.skillId,
      skillName: m.skillName,
      text: m.text
    }));
  return missing.length ? [...missing, ...list] : list;
};

export const generateDailyMissionsFromSkills = (skillsList, quota = 5, prioritizedKeys = []) => {
  if (!Array.isArray(skillsList)) return [];

  const prioritizedPool = [];
  const normalPool = [];

  skillsList.forEach((skill) => {
    if (Array.isArray(skill.miniMissions)) {
      skill.miniMissions.forEach((text) => {
        if (text && text.trim()) {
          const itemText = text.trim();
          const key1 = `${skill.id}___${itemText}`;
          const key2 = `${skill.id}_${itemText}`;

          const isPrioritized = Array.isArray(prioritizedKeys) && prioritizedKeys.some((pKey) => {
            if (!pKey) return false;
            return pKey === key1 || pKey === key2 || (pKey.includes(skill.id) && pKey.includes(itemText));
          });

          const missionData = {
            skillId: skill.id,
            skillName: skill.title || skill.name,
            text: itemText,
            key: key1
          };

          if (isPrioritized) {
            prioritizedPool.push(missionData);
          } else {
            normalPool.push(missionData);
          }
        }
      });
    }
  });

  const selected = [...prioritizedPool];

  if (selected.length > quota) {
    selected.length = quota;
  } else if (selected.length < quota && normalPool.length > 0) {
    const shuffledNormals = [...normalPool].sort(() => 0.5 - Math.random());
    const needed = quota - selected.length;
    selected.push(...shuffledNormals.slice(0, needed));
  }

  return selected.map((m, idx) => {
    const rand = Math.random();
    const reward = rand < 0.02 ? 5 : (Math.random() < 0.5 ? 1 : 2);

    return {
      id: `dm_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
      skillId: m.skillId,
      skillName: m.skillName,
      text: m.text,
      rewardDiamonds: reward,
      completed: false
    };
  });
};

const DEFAULT_PROFILE_DATA = {
  nickname: 'Seu Nick',
  avatar: '🧙🏻‍♂️',
  currentTheme: 'cyberpunk',
  boxColorType: 'default',
  linkSkillsByCategory: true,
  extraXp: 0,
  xpHistory: [],
  folders: STARTER_FOLDERS,
  skills: starterSkills(),
  diamonds: 1,
  diamondLog: [],
  dailyMissions: [],
  dailyMissionsQuota: 5,
  prioritizedMissions: [],
  lastMissionsDate: '',
  dailyBonusClaimed: false,
  dailyRefreshesCount: 0,
  lastRefreshesDate: '',
  customColorDeck: [],
  activeDeckId: 'deck_neon',
  hiddenSkillIds: [],
  pendingTransfers: []
};

export function useGameData() {
  const [profiles, setProfiles] = useState(() => {
    const saved = localStorage.getItem('rpg_profiles_list');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    // Primeira vez no app: o perfil padrão começa com o conteúdo inicial
    if (localStorage.getItem('rpg_profile_data_profile_default') === null) seedStarterProfile('profile_default');
    return [{ id: 'profile_default', name: 'Seu Nick', avatar: '🧙🏻‍♂️' }];
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
          linkSkillsByCategory: parsed.linkSkillsByCategory !== undefined ? !!parsed.linkSkillsByCategory : true,
          extraXp: Number(parsed.extraXp) || 0,
          xpHistory: parsed.xpHistory || [],
          folders: Array.isArray(parsed.folders) ? parsed.folders : ['Geral'],
          skills: parsed.skills || [],
          diamonds: Number(parsed.diamonds) || 0,
          diamondLog: backfillDiamondLog(parsed.diamondLog, parsed.dailyMissions),
          dailyMissions: parsed.dailyMissions || [],
          dailyMissionsQuota: Number(parsed.dailyMissionsQuota) || 5,
          prioritizedMissions: Array.isArray(parsed.prioritizedMissions) ? parsed.prioritizedMissions : [],
          lastMissionsDate: parsed.lastMissionsDate || '',
          dailyBonusClaimed: !!parsed.dailyBonusClaimed,
          dailyRefreshesCount: Number(parsed.dailyRefreshesCount) || 0,
          lastRefreshesDate: parsed.lastRefreshesDate || '',
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
  const [linkSkillsByCategory, setLinkSkillsByCategory] = useState(initialData.linkSkillsByCategory);
  const [extraXp, setExtraXp] = useState(initialData.extraXp);
  const [xpHistory, setXpHistory] = useState(initialData.xpHistory);
  const [folders, setFolders] = useState(initialData.folders);
  const [skills, setSkills] = useState(initialData.skills);
  const [diamonds, setDiamonds] = useState(initialData.diamonds);
  const [diamondLog, setDiamondLog] = useState(initialData.diamondLog || []);
  const [dailyMissions, setDailyMissions] = useState(initialData.dailyMissions);
  const [dailyMissionsQuota, setDailyMissionsQuota] = useState(() => initialData.dailyMissionsQuota || 5);
  const [prioritizedMissions, setPrioritizedMissions] = useState(() => initialData.prioritizedMissions || []);

  const togglePrioritizeMission = (skillIdOrKey, text) => {
    let key1 = '';
    let key2 = '';
    if (text !== undefined && text !== null) {
      key1 = `${skillIdOrKey}___${text.trim()}`;
      key2 = `${skillIdOrKey}_${text.trim()}`;
    } else if (typeof skillIdOrKey === 'string') {
      key1 = skillIdOrKey.trim();
      key2 = skillIdOrKey.trim();
    }

    setPrioritizedMissions((prev) => {
      const exists = prev.some((k) => k === key1 || k === key2 || (text && k.includes(skillIdOrKey) && k.includes(text.trim())));
      if (exists) {
        return prev.filter((k) => k !== key1 && k !== key2 && !(text && k.includes(skillIdOrKey) && k.includes(text.trim())));
      } else {
        return [...prev, key1 || key2];
      }
    });
  };

  const updateMiniMissionText = (skillId, oldText, newText) => {
    const oldTrimmed = oldText ? oldText.trim() : '';
    const newTrimmed = newText ? newText.trim() : '';
    if (!newTrimmed || oldTrimmed === newTrimmed) return;

    // 1. Atualiza no cadastro de Habilidades (skills)
    setSkills((prevSkills) =>
      prevSkills.map((skill) => {
        if (skill.id === skillId && Array.isArray(skill.miniMissions)) {
          const updated = skill.miniMissions.map((t) =>
            t.trim() === oldTrimmed ? newTrimmed : t
          );
          return { ...skill, miniMissions: updated };
        }
        return skill;
      })
    );

    // 2. Atualiza nas Missões Diárias mantendo ID, diamantes e conclusão intactos
    setDailyMissions((prevMissions) =>
      (prevMissions || []).map((mission) => {
        if (mission.skillId === skillId && mission.text.trim() === oldTrimmed) {
          return { ...mission, text: newTrimmed };
        }
        return mission;
      })
    );

    // 3. Atualiza na lista de priorizadas
    setPrioritizedMissions((prev) =>
      (prev || []).map((key) => {
        const key1 = `${skillId}___${oldTrimmed}`;
        const key2 = `${skillId}_${oldTrimmed}`;
        if (key === key1 || key === key2) {
          return `${skillId}___${newTrimmed}`;
        }
        return key;
      })
    );
  };

  const [lastMissionsDate, setLastMissionsDate] = useState(initialData.lastMissionsDate);
  const [dailyBonusClaimed, setDailyBonusClaimed] = useState(initialData.dailyBonusClaimed);
  const [dailyRefreshesCount, setDailyRefreshesCount] = useState(initialData.dailyRefreshesCount);
  const [lastRefreshesDate, setLastRefreshesDate] = useState(initialData.lastRefreshesDate);
  const [customColorDeck, setCustomColorDeck] = useState(initialData.customColorDeck);
  const [activeDeckId, setActiveDeckId] = useState(initialData.activeDeckId);
  const [hiddenSkillIds, setHiddenSkillIds] = useState(initialData.hiddenSkillIds);
  const [pendingTransfers, setPendingTransfers] = useState(initialData.pendingTransfers);

  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  // SINCRONIZAÇÃO PRESERVANDO AS MISSÕES EXISTENTES E SEUS DIAMANTES
  useEffect(() => {
    const todayStr = getGameDayKey();
    // Comparação de texto AAAA-MM-DD: datas salvas no formato antigo (UTC, às vezes
    // "um dia à frente") não disparam um sorteio extra
    const isNewDay = !lastMissionsDate || lastMissionsDate < todayStr;

    if (isNewDay) {
      const fresh = generateDailyMissionsFromSkills(skills, dailyMissionsQuota, prioritizedMissions);
      if (fresh.length > 0) {
        setDailyMissions(fresh);
        setLastMissionsDate(todayStr);
        setDailyBonusClaimed(false);
        setDailyRefreshesCount(0);
        setLastRefreshesDate(todayStr);
      }
    } else {
      setDailyMissions((prevMissions) => {
        const current = Array.isArray(prevMissions) ? prevMissions : [];
        const targetQuota = Number(dailyMissionsQuota) || 5;

        // Se a quantidade atual já for suficiente, apenas corta sem alterar o conteúdo ou diamantes das existentes
        if (current.length >= targetQuota) {
          return current.slice(0, targetQuota);
        }

        // Se aumentou a quota, PRESERVA TODAS as missões existentes
        const slotsNeeded = targetQuota - current.length;
        const existingKeys = new Set(current.map((m) => `${m.skillId}___${m.text.trim()}`));

        const availableSkills = skills.map((s) => ({
          ...s,
          miniMissions: (s.miniMissions || []).filter(
            (text) => !existingKeys.has(`${s.id}___${text.trim()}`)
          )
        }));

        const newDrawn = generateDailyMissionsFromSkills(
          availableSkills,
          slotsNeeded,
          prioritizedMissions
        );

        return [...current, ...newDrawn];
      });
    }
  }, [skills, dailyMissionsQuota, prioritizedMissions]);

  useEffect(() => {
    localStorage.setItem('rpg_profiles_list', JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem('rpg_active_profile_id', activeProfileId);
    // Avisa a Árvore e os Neurônios para carregarem os dados deste perfil
    publishActiveProfile(activeProfileId);
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
      linkSkillsByCategory,
      extraXp,
      xpHistory,
      folders,
      skills,
      diamonds,
      diamondLog,
      dailyMissions,
      dailyMissionsQuota,
      prioritizedMissions,
      lastMissionsDate,
      dailyBonusClaimed,
      dailyRefreshesCount,
      lastRefreshesDate,
      customColorDeck,
      activeDeckId,
      hiddenSkillIds,
      pendingTransfers
    };
    localStorage.setItem(getProfileStorageKey(activeProfileId), JSON.stringify(dataToSave));
  }, [
    activeProfileId,
    nickname,
    avatar,
    currentTheme,
    boxColorType,
    linkSkillsByCategory,
    extraXp,
    xpHistory,
    folders,
    skills,
    diamonds,
    diamondLog,
    dailyMissions,
    dailyMissionsQuota,
    prioritizedMissions,
    lastMissionsDate,
    dailyBonusClaimed,
    dailyRefreshesCount,
    lastRefreshesDate,
    customColorDeck,
    activeDeckId,
    hiddenSkillIds,
    pendingTransfers
  ]);

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

  const todayStr = getGameDayKey();
  const currentRefreshesUsedToday = lastRefreshesDate >= todayStr ? dailyRefreshesCount : 0;
  const dailyRefreshesLeft = Math.max(0, 2 - currentRefreshesUsedToday);

  const refreshDailyMissions = () => {
    const currentTodayStr = getGameDayKey();
    let usedCount = lastRefreshesDate >= currentTodayStr ? dailyRefreshesCount : 0;

    if (usedCount >= 2) {
      return { success: false, reason: 'limit_reached' };
    }

    const completedMissions = (dailyMissions || []).filter((m) => m.completed);
    const completedKeys = new Set(completedMissions.map((m) => `${m.skillId}_${m.text}`));

    const availableSkills = skills.map((s) => ({
      ...s,
      miniMissions: (s.miniMissions || []).filter(
        (text) => !completedKeys.has(`${s.id}_${text.trim()}`)
      )
    }));

    const slotsNeeded = Math.max(0, dailyMissionsQuota - completedMissions.length);

    if (slotsNeeded <= 0) {
      return { success: false, reason: 'no_uncompleted_available' };
    }

    const newDrawnMissions = generateDailyMissionsFromSkills(
      availableSkills,
      slotsNeeded,
      prioritizedMissions
    );

    if (newDrawnMissions.length === 0) {
      return { success: false, reason: 'no_uncompleted_available' };
    }

    const updatedMissions = [...completedMissions, ...newDrawnMissions];
    const newUsedCount = usedCount + 1;

    setDailyMissions(updatedMissions);
    setDailyRefreshesCount(newUsedCount);
    setLastRefreshesDate(currentTodayStr);
    setLastMissionsDate(currentTodayStr);

    return { success: true, remaining: 2 - newUsedCount };
  };

  const resetDailyMissionsHack = () => {
    const freshMissions = generateDailyMissionsFromSkills(skills, dailyMissionsQuota, prioritizedMissions);
    const currentTodayStr = getGameDayKey();
    setDailyMissions(freshMissions);
    setLastMissionsDate(currentTodayStr);
    setDailyBonusClaimed(false);
  };

  const addExtraRefreshesHack = (amount = 1) => {
    setDailyRefreshesCount((prev) => prev - amount);
  };

  const resetRefreshesCountHack = () => {
    setDailyRefreshesCount(0);
    setLastRefreshesDate(getGameDayKey());
  };

  const switchProfile = (targetProfileId) => {
    if (targetProfileId === activeProfileId) return;
    const targetData = loadDataForProfile(targetProfileId);
    setActiveProfileId(targetProfileId);
    setNickname(targetData.nickname);
    setAvatar(targetData.avatar);
    setCurrentTheme(targetData.currentTheme);
    setBoxColorType(targetData.boxColorType || 'default');
    setLinkSkillsByCategory(targetData.linkSkillsByCategory !== undefined ? !!targetData.linkSkillsByCategory : true);
    setExtraXp(targetData.extraXp || 0);
    setXpHistory(targetData.xpHistory || []);
    setFolders(targetData.folders || ['Geral']);
    setSkills(targetData.skills);
    setDiamonds(targetData.diamonds || 0);
    setDiamondLog(targetData.diamondLog || []);
    setDailyMissions(targetData.dailyMissions || []);
    setDailyMissionsQuota(targetData.dailyMissionsQuota || 5);
    setPrioritizedMissions(targetData.prioritizedMissions || []);
    setLastMissionsDate(targetData.lastMissionsDate || '');
    setDailyBonusClaimed(!!targetData.dailyBonusClaimed);
    setDailyRefreshesCount(targetData.dailyRefreshesCount || 0);
    setLastRefreshesDate(targetData.lastRefreshesDate || '');
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
      linkSkillsByCategory: true,
      extraXp: 0,
      xpHistory: [],
      folders: STARTER_FOLDERS,
      skills: starterSkills(),
      diamonds: 0,
      diamondLog: [],
      dailyMissions: [],
      dailyMissionsQuota: 5,
      prioritizedMissions: [],
      lastMissionsDate: '',
      dailyBonusClaimed: false,
      dailyRefreshesCount: 0,
      lastRefreshesDate: '',
      customColorDeck: [],
      activeDeckId: 'deck_neon',
      hiddenSkillIds: [],
      pendingTransfers: []
    };

    localStorage.setItem(getProfileStorageKey(newId), JSON.stringify(initialProfileData));
    seedStarterProfile(newId);
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

    const srcSkills = sourceId === activeProfileId ? skills : sourceData.skills || [];
    const srcExtraXp = sourceId === activeProfileId ? extraXp : sourceData.extraXp || 0;
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

  const completeMission = (missionId) => {
    const target = (dailyMissions || []).find((m) => m.id === missionId);
    if (!target || target.completed) return;

    const nowIso = new Date().toISOString();
    const rewardAmount = target.rewardDiamonds || 1;
    const updated = dailyMissions.map((m) =>
      m.id === missionId ? { ...m, completed: true, completedAt: nowIso } : m
    );
    const entries = [
      makeLogEntry(rewardAmount, 'mission', {
        at: nowIso,
        missionId: target.id,
        skillId: target.skillId,
        skillName: target.skillName,
        text: target.text
      })
    ];

    let total = rewardAmount;
    if (updated.every((m) => m.completed) && !dailyBonusClaimed) {
      total += 1;
      entries.push(makeLogEntry(1, 'bonus', { at: nowIso, missionsCount: updated.length }));
      setDailyBonusClaimed(true);
    }

    // Mais recente primeiro (bônus acima da missão que o liberou).
    // Cópia invertida fora do updater: reverse() dentro dele rodaria 2x no StrictMode.
    const newestFirst = [...entries].reverse();
    setDailyMissions(updated);
    setDiamonds((d) => d + total);
    setDiamondLog((prev) => [...newestFirst, ...prev]);
  };

  // Ajustes manuais (painel de testes): também ficam registrados
  const adjustDiamonds = (delta, label = 'Ajuste manual') => {
    const amount = Math.round(Number(delta) || 0);
    if (!amount) return;
    const applied = amount < 0 ? -Math.min(diamonds, -amount) : amount;
    if (!applied) return;
    setDiamonds((d) => Math.max(0, d + applied));
    setDiamondLog((prev) => [makeLogEntry(applied, 'manual', { label }), ...prev]);
  };

  // Gasta diamantes (ex.: upgrades do personagem). Devolve false se não houver saldo.
  const spendDiamonds = (amount, label) => {
    const cost = Math.round(Number(amount) || 0);
    if (cost <= 0 || cost > diamonds) return false;
    setDiamonds((d) => Math.max(0, d - cost));
    setDiamondLog((prev) => [makeLogEntry(-cost, 'upgrade', { label }), ...prev]);
    return true;
  };

  const setDiamondsTo = (value, label = 'Saldo definido manualmente') => {
    const target = Math.max(0, Math.round(Number(value) || 0));
    const delta = target - diamonds;
    if (!delta) return;
    setDiamonds(target);
    setDiamondLog((prev) => [makeLogEntry(delta, 'manual', { label }), ...prev]);
  };

  const addMiniMissionToSkill = (skillId, missionText) => {
    const textTrimmed = missionText.trim();
    if (!textTrimmed) return;

    const updatedSkills = skills.map((s) => {
      if (s.id === skillId) {
        const miniArr = s.miniMissions || [];
        return { ...s, miniMissions: [...miniArr, textTrimmed] };
      }
      return s;
    });
    recordState(updatedSkills);
  };

  const deleteMiniMissionFromSkill = (skillId, index) => {
    let missionTextToRemove = '';

    const updatedSkills = skills.map((s) => {
      if (s.id === skillId) {
        const miniArr = s.miniMissions || [];
        missionTextToRemove = miniArr[index];
        const filtered = miniArr.filter((_, idx) => idx !== index);
        return { ...s, miniMissions: filtered };
      }
      return s;
    });
    recordState(updatedSkills);

    if (missionTextToRemove) {
      setDailyMissions((prev) =>
        prev.filter((m) => !(m.skillId === skillId && m.text === missionTextToRemove))
      );
    }
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
      if (s.id !== skillId) return s;

      gainedSkillTitle = s.title;
      gainedCategory = s.category || 'Geral';
      const activeId = s.activeModuleId || 'default';

      // Se estiver treinando dentro de um Módulo Adicional
      if (activeId !== 'default' && Array.isArray(s.modules)) {
        const updatedModules = s.modules.map((m) => {
          if (m.id === activeId) {
            const currentLvl = Number(m.level) || 0;
            const maxLvl = Number(m.maxLevel) || 10;
            if (currentLvl < maxLvl) {
              newLvl = currentLvl + 1;
              if (newLvl >= maxLvl) {
                isMaxed = true;
                gainedXpAmount = 50;
              }
            } else {
              newLvl = currentLvl;
            }
            return { ...m, level: newLvl };
          }
          return m;
        });
        const activeMod = updatedModules.find((m) => m.id === activeId);
        return {
          ...s,
          level: activeMod ? activeMod.level : s.level,
          modules: updatedModules
        };
      } else {
        // Se estiver treinando no Módulo Principal (Geral)
        const currentLvl = Number(s.level) || 0;
        const maxLvl = Number(s.maxLevel) || 10;
        if (currentLvl < maxLvl) {
          newLvl = currentLvl + 1;
          if (newLvl >= maxLvl) {
            isMaxed = true;
            gainedXpAmount = 50;
          }
          return {
            ...s,
            level: newLvl,
            defaultLevel: newLvl
          };
        }
        return s;
      }
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
      levelTasks: {},
      miniMissions: []
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

  // XP bônus vindo de outras atividades (ex.: sessões de Flashcards)
  const grantBonusXp = (amount, title, category = 'Geral') => {
    const value = Math.round(Number(amount) || 0);
    if (value <= 0) return;
    setExtraXp((prev) => (Number(prev) || 0) + value);
    setXpHistory((prev) => [
      {
        id: `xplog_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        title,
        category: category || 'Geral',
        amount: value,
        date: new Date().toLocaleString('pt-BR')
      },
      ...prev
    ]);
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
      linkSkillsByCategory,
      extraXp,
      xpHistory,
      folders,
      skills,
      diamonds,
      diamondLog,
      dailyMissions,
      dailyMissionsQuota,
      prioritizedMissions,
      lastMissionsDate,
      dailyBonusClaimed,
      dailyRefreshesCount,
      lastRefreshesDate,
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

        const targetActiveId =
          data.activeProfileId && data.profilesData[data.activeProfileId]
            ? data.activeProfileId
            : data.profiles[0].id;

        setActiveProfileId(targetActiveId);
        localStorage.setItem('rpg_active_profile_id', targetActiveId);

        const activeData = data.profilesData[targetActiveId] || loadDataForProfile(targetActiveId);
        setNickname(activeData.nickname || 'Herói');
        setAvatar(activeData.avatar || '🛡️');
        setCurrentTheme(activeData.currentTheme || 'cyberpunk');
        setBoxColorType(activeData.boxColorType || 'default');
        setLinkSkillsByCategory(activeData.linkSkillsByCategory !== undefined ? !!activeData.linkSkillsByCategory : true);
        setExtraXp(activeData.extraXp || 0);
        setXpHistory(activeData.xpHistory || []);
        setFolders(activeData.folders || ['Geral']);
        setSkills(activeData.skills || []);
        setDiamonds(activeData.diamonds || 0);
        setDiamondLog(backfillDiamondLog(activeData.diamondLog, activeData.dailyMissions));
        setDailyMissions(activeData.dailyMissions || []);
        setDailyMissionsQuota(activeData.dailyMissionsQuota || 5);
        setPrioritizedMissions(activeData.prioritizedMissions || []);
        setLastMissionsDate(activeData.lastMissionsDate || '');
        setDailyBonusClaimed(!!activeData.dailyBonusClaimed);
        setDailyRefreshesCount(activeData.dailyRefreshesCount || 0);
        setLastRefreshesDate(activeData.lastRefreshesDate || '');
        setCustomColorDeck(activeData.customColorDeck || []);
        setActiveDeckId(activeData.activeDeckId || 'deck_neon');
        setHiddenSkillIds(activeData.hiddenSkillIds || []);
        setPendingTransfers(activeData.pendingTransfers || []);

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

  // Ctrl+Z/Ctrl+Y global: recarrega perfis e dados do perfil a partir do armazenamento
  useUndoRestore(
    (k) => k === 'rpg_profiles_list' || k === 'rpg_active_profile_id' || k.startsWith('rpg_profile_data_'),
    () => {
      try {
        const list = JSON.parse(localStorage.getItem('rpg_profiles_list') || 'null');
        if (Array.isArray(list) && list.length > 0) setProfiles(list);
        const savedId = localStorage.getItem('rpg_active_profile_id');
        const targetId = savedId && (!Array.isArray(list) || list.some((p) => p.id === savedId)) ? savedId : activeProfileId;
        const d = loadDataForProfile(targetId);
        setActiveProfileId(targetId);
        setNickname(d.nickname || 'Herói');
        setAvatar(d.avatar || '🛡️');
        setCurrentTheme(d.currentTheme || 'cyberpunk');
        setBoxColorType(d.boxColorType || 'default');
        setLinkSkillsByCategory(d.linkSkillsByCategory !== undefined ? !!d.linkSkillsByCategory : true);
        setExtraXp(d.extraXp || 0);
        setXpHistory(d.xpHistory || []);
        setFolders(d.folders || ['Geral']);
        setSkills(d.skills || []);
        setDiamonds(d.diamonds || 0);
        setDiamondLog(backfillDiamondLog(d.diamondLog, d.dailyMissions));
        setDailyMissions(d.dailyMissions || []);
        setDailyMissionsQuota(d.dailyMissionsQuota || 5);
        setPrioritizedMissions(d.prioritizedMissions || []);
        setLastMissionsDate(d.lastMissionsDate || '');
        setDailyBonusClaimed(!!d.dailyBonusClaimed);
        setDailyRefreshesCount(d.dailyRefreshesCount || 0);
        setLastRefreshesDate(d.lastRefreshesDate || '');
        setCustomColorDeck(d.customColorDeck || []);
        setActiveDeckId(d.activeDeckId || 'deck_neon');
        setHiddenSkillIds(d.hiddenSkillIds || []);
        setPendingTransfers(d.pendingTransfers || []);
      } catch (e) {
        console.error('Erro ao desfazer:', e);
      }
    }
  );

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
    grantBonusXp,
    xpHistory,
    setXpHistory,
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
    redo,
    diamonds,
    setDiamonds,
    diamondLog,
    adjustDiamonds,
    spendDiamonds,
    setDiamondsTo,
    dailyMissions,
    dailyBonusClaimed,
    dailyRefreshesLeft,
    refreshDailyMissions,
    resetDailyMissionsHack,
    addExtraRefreshesHack,
    resetRefreshesCountHack,
    completeMission,
    addMiniMissionToSkill,
    deleteMiniMissionFromSkill,
    updateMiniMissionText,
    dailyMissionsQuota,
    setDailyMissionsQuota,
    prioritizedMissions,
    togglePrioritizeMission
  };
}