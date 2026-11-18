import { useState, useEffect, useCallback } from 'react';
import { useUndoRestore } from './GlobalUndo.js';

// =========================================================
// ARMAZENAMENTO POR PERFIL
// Antes, checklists e pastas eram salvos uma vez só para o app inteiro,
// então todos os perfis enxergavam os mesmos dados. Agora cada perfil tem
// a sua própria cópia: `<chave>__<idDoPerfil>`.
// =========================================================

// Dados que pertencem a cada perfil
export const PER_PROFILE_KEYS = [
  'task_update_lists_v1', // listas e tarefas do Checklist
  'task_update_view_v1', // filtro/ordenação do Checklist
  'rpg_custom_folder_order_v1', // ordem das pastas
  'rpg_deleted_folders_v1', // pastas excluídas
  'selected_folder_filters_v1', // filtros de pastas
  'rpg_favorite_themes_v1', // temas favoritos
  'rpg_hero_v1' // personagem (classe e cores)
];

// Dados do app inteiro que também vão no backup
export const GLOBAL_BACKUP_KEYS = [
  'rpg_language_v1',
  'rpg_custom_themes_v1',
  'pomodoro_mode_presets_v3',
  'pomodoro_saved_sound_option',
  'pomodoro_saved_target_time',
  'pomodoro_extra_timers_v1',
  'task_update_lang_v1'
];

export const profileKey = (base, profileId) => `${base}__${profileId}`;

const claimKey = (base) => `${base}__claimed_by`;

// Lê o valor do perfil. Na primeira vez, se existir o dado antigo (global),
// ele é entregue ao perfil que estiver ativo naquele momento.
const profileExists = (pid) => {
  try {
    const list = JSON.parse(localStorage.getItem('rpg_profiles_list')) || [];
    return list.some((p) => p.id === pid);
  } catch (e) {
    return false;
  }
};

// Só o perfil ativo de verdade pode "herdar" os dados antigos
const isActiveProfile = (pid) => {
  const active = localStorage.getItem('rpg_active_profile_id');
  return !active || active === pid;
};

export const readProfileRaw = (base, profileId) => {
  if (!profileId) return null;
  try {
    const own = localStorage.getItem(profileKey(base, profileId));
    if (own !== null) return own;
    const legacy = localStorage.getItem(base);
    const claimedBy = localStorage.getItem(claimKey(base));
    const claimFree = !claimedBy || claimedBy === profileId || !profileExists(claimedBy);
    if (legacy !== null && claimFree && isActiveProfile(profileId)) {
      localStorage.setItem(claimKey(base), profileId);
      localStorage.setItem(profileKey(base, profileId), legacy);
      return legacy;
    }
  } catch (e) {}
  return null;
};

export const readProfileValue = (base, profileId, fallback) => {
  const raw = readProfileRaw(base, profileId);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
};

export const writeProfileValue = (base, profileId, value) => {
  if (!profileId) return;
  try {
    localStorage.setItem(profileKey(base, profileId), JSON.stringify(value));
  } catch (e) {}
};

// useState que salva por perfil e recarrega sozinho ao trocar de perfil
export function useProfileStoredState(base, profileId, fallback) {
  const [state, setState] = useState(() => ({ pid: profileId, value: readProfileValue(base, profileId, fallback) }));

  let current = state;
  if (state.pid !== profileId) {
    // Troca de perfil: carrega os dados do novo perfil já nesta renderização
    current = { pid: profileId, value: readProfileValue(base, profileId, fallback) };
    setState(current);
  }

  const setValue = useCallback(
    (updater) =>
      setState((s) => ({ pid: s.pid, value: typeof updater === 'function' ? updater(s.value) : updater })),
    []
  );

  useEffect(() => {
    writeProfileValue(base, state.pid, state.value);
  }, [base, state]);

  useUndoRestore(
    (k) => k === profileKey(base, current.pid),
    () => setState((s) => ({ pid: s.pid, value: readProfileValue(base, s.pid, fallback) }))
  );

  return [current.value, setValue];
}

// ---------- Backup ----------
export const collectBackupExtras = (profileIds) => {
  const perProfile = {};
  profileIds.forEach((pid) => {
    const bundle = {};
    PER_PROFILE_KEYS.forEach((base) => {
      const raw = readProfileRaw(base, pid);
      if (raw !== null) {
        try {
          bundle[base] = JSON.parse(raw);
        } catch (e) {}
      }
    });
    perProfile[pid] = bundle;
  });

  const globals = {};
  GLOBAL_BACKUP_KEYS.forEach((key) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) globals[key] = raw;
    } catch (e) {}
  });

  return { perProfileData: perProfile, globalSettings: globals };
};

// Restaura o backup. Aceita também backups antigos (dados globais),
// que vão para o perfil ativo do backup.
export const applyBackupExtras = (data, activeProfileId) => {
  try {
    if (data.perProfileData && typeof data.perProfileData === 'object') {
      Object.entries(data.perProfileData).forEach(([pid, bundle]) => {
        Object.entries(bundle || {}).forEach(([base, value]) => {
          if (PER_PROFILE_KEYS.includes(base)) writeProfileValue(base, pid, value);
        });
      });
    } else if (activeProfileId) {
      const legacy = {
        task_update_lists_v1: data.taskUpdateLists,
        rpg_custom_folder_order_v1: data.folderCustomOrder,
        rpg_deleted_folders_v1: data.folderDeletedList,
        selected_folder_filters_v1: data.folderFilters
      };
      Object.entries(legacy).forEach(([base, value]) => {
        if (value !== undefined) writeProfileValue(base, activeProfileId, value);
      });
    }

    if (data.globalSettings && typeof data.globalSettings === 'object') {
      Object.entries(data.globalSettings).forEach(([key, raw]) => {
        if (GLOBAL_BACKUP_KEYS.includes(key) && typeof raw === 'string') localStorage.setItem(key, raw);
      });
    } else {
      if (data.pomodoroPresets) localStorage.setItem('pomodoro_mode_presets_v3', JSON.stringify(data.pomodoroPresets));
      if (data.pomodoroSound) localStorage.setItem('pomodoro_saved_sound_option', data.pomodoroSound);
      if (Array.isArray(data.customThemes)) localStorage.setItem('rpg_custom_themes_v1', JSON.stringify(data.customThemes));
      if (data.taskUpdateLang) localStorage.setItem('task_update_lang_v1', data.taskUpdateLang);
    }
  } catch (e) {
    console.error('Erro ao restaurar dados extras do backup:', e);
  }
};
