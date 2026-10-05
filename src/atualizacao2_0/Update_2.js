import { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY_TIME = 'pomodoro_saved_target_time';
const STORAGE_KEY_SOUND = 'pomodoro_saved_sound_option';
const STORAGE_KEY_PRESETS = 'pomodoro_mode_presets_v3';

const DEFAULT_PRESETS = [
  { id: 'pomodoro', name: 'Pomodoro', hours: 0, minutes: 45, seconds: 0 },
  { id: 'shortBreak', name: 'Pausa Curta', hours: 0, minutes: 10, seconds: 0 },
  { id: 'longBreak', name: 'Pausa Longa', hours: 0, minutes: 15, seconds: 0 }
];

// Helper para tocar alarmes via Web Audio API
export function playWebAudioAlarm(soundOption = 'clock') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const now = ctx.currentTime;

    if (soundOption === 'clock') {
      [0, 0.08, 0.16, 0.24].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(2048, now + delay);

        gain.gain.setValueAtTime(0.12, now + delay);
        gain.gain.setValueAtTime(0.001, now + delay + 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + delay);
        osc.stop(now + delay + 0.05);
      });
    } else if (soundOption === 'digital') {
      [0, 0.22, 0.44].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(987.77, now + delay);
        osc.frequency.exponentialRampToValueAtTime(523.25, now + delay + 0.16);

        gain.gain.setValueAtTime(0.6, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.16);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + delay);
        osc.stop(now + delay + 0.16);
      });
    } else if (soundOption === 'bell') {
      [523.25, 1046.5, 1567.98].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.4 / (idx + 1), now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 1.2);
      });
    } else if (soundOption === 'arcade') {
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.2, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.08);
      });
    }
  } catch (e) {
    console.error('Erro ao tocar som do alarme:', e);
  }
}

export function usePomodoro() {
  const [isOpen, setIsOpen] = useState(false);

  const [modePresets, setModePresets] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PRESETS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p) => ({
            id: p.id,
            name: p.name,
            hours: parseInt(p.hours, 10) || 0,
            minutes: parseInt(p.minutes, 10) || 0,
            seconds: parseInt(p.seconds, 10) || 0
          }));
        }
      }
      return DEFAULT_PRESETS;
    } catch (e) {
      return DEFAULT_PRESETS;
    }
  });

  const [mode, setMode] = useState(() => modePresets[0]?.id || 'pomodoro');

  const [targetTime, setTargetTime] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TIME);
      return saved ? JSON.parse(saved) : { min: modePresets[0]?.minutes || 45, sec: 0 };
    } catch (e) {
      return { min: 45, sec: 0 };
    }
  });

  const [totalSeconds, setTotalSeconds] = useState(() => targetTime.min * 60 + targetTime.sec);
  const [isActive, setIsActive] = useState(false);

  const [soundOption, setSoundOption] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_SOUND) || 'clock';
  });

  const [pinOnScreen, setPinOnScreen] = useState(false);
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);

  // Lista de Pomodoros Suspensos Adicionais
  const [extraTimers, setExtraTimers] = useState([]);

  // Estado do Menu de Contexto (Clique Direito)
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });

  const timerRef = useRef(null);
  const alarmIntervalRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(modePresets));
    } catch (e) {}
  }, [modePresets]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TIME, JSON.stringify(targetTime));
    } catch (e) {}
  }, [targetTime]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SOUND, soundOption);
    } catch (e) {}
  }, [soundOption]);

  const toggleModal = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleButtonContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0 });
  };

  // Criar Pomodoro Suspenso Adicional no Ecrã
  const addExtraPomodoro = () => {
    closeContextMenu();
    const newId = 'extra_pomo_' + Date.now();
    const count = extraTimers.length + 2;
    const offset = (extraTimers.length + 1) * 35;

    const newTimer = {
      id: newId,
      title: `Pomodoro ${count}`,
      hours: 0,
      minutes: 25,
      seconds: 0,
      totalSeconds: 25 * 60,
      initialTotalSeconds: 25 * 60,
      isActive: false,
      isAlarmRinging: false,
      soundOption: 'clock',
      position: { x: 120 + offset, y: 120 + offset }
    };

    setExtraTimers((prev) => [...prev, newTimer]);
  };

  const removeExtraPomodoro = (id) => {
    setExtraTimers((prev) => prev.filter((t) => t.id !== id));
  };

  const updateExtraPomodoro = (id, updates) => {
    setExtraTimers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  const triggerSoundStep = (overrideSound = soundOption) => {
    playWebAudioAlarm(overrideSound);
  };

  const testSound = (soundType) => {
    triggerSoundStep(soundType);
  };

  const startAlarm = () => {
    setIsAlarmRinging(true);
    triggerSoundStep();
    if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    alarmIntervalRef.current = setInterval(() => {
      triggerSoundStep();
    }, 1000);
  };

  const stopAlarm = () => {
    setIsAlarmRinging(false);
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    setTotalSeconds(targetTime.min * 60 + targetTime.sec);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeElem = document.activeElement;
      const isEditingText =
        activeElem &&
        (activeElem.tagName === 'INPUT' ||
          activeElem.tagName === 'TEXTAREA' ||
          activeElem.isContentEditable);

      if (isEditingText) return;

      const keyLower = e.key ? e.key.toLowerCase() : '';
      if (keyLower === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        toggleModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [toggleModal]);

  useEffect(() => {
    if (!isActive) return;

    timerRef.current = setInterval(() => {
      setTotalSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setIsActive(false);
          startAlarm();
          return targetTime.min * 60 + targetTime.sec;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [isActive, targetTime]);

  const startTimer = () => {
    if (isAlarmRinging) stopAlarm();
    setIsActive(true);
  };

  const pauseTimer = () => setIsActive(false);

  const changeMode = (presetId) => {
    setIsActive(false);
    stopAlarm();
    setMode(presetId);

    const preset = modePresets.find((p) => p.id === presetId);
    const h = preset ? preset.hours || 0 : 0;
    const m = preset ? preset.minutes || 0 : 45;
    const s = preset ? preset.seconds || 0 : 0;

    const totalMins = h * 60 + m;
    setTargetTime({ min: totalMins, sec: s });
    setTotalSeconds(h * 3600 + m * 60 + s);
  };

  const updateModePreset = (presetId, hVal, mVal, sVal) => {
    const h = Math.max(0, parseInt(hVal, 10) || 0);
    const m = Math.max(0, parseInt(mVal, 10) || 0);
    const s = Math.min(59, Math.max(0, parseInt(sVal, 10) || 0));

    setModePresets((prev) =>
      prev.map((p) => (p.id === presetId ? { ...p, hours: h, minutes: m, seconds: s } : p))
    );

    if (mode === presetId) {
      const totalMins = h * 60 + m;
      setTargetTime({ min: totalMins, sec: s });
      setTotalSeconds(h * 3600 + m * 60 + s);
    }
  };

  const addPreset = (name, hVal, mVal, sVal) => {
    const h = Math.max(0, parseInt(hVal, 10) || 0);
    const m = Math.max(0, parseInt(mVal, 10) || 0);
    const s = Math.min(59, Math.max(0, parseInt(sVal, 10) || 0));

    if (h === 0 && m === 0 && s === 0) return;

    const cleanName = (name || 'Nova Pausa').trim();
    const newId = 'preset_' + Date.now();
    const newPreset = { id: newId, name: cleanName, hours: h, minutes: m, seconds: s };

    setModePresets((prev) => [...prev, newPreset]);
  };

  const removePreset = (presetId) => {
    if (modePresets.length <= 1) return;
    setModePresets((prev) => {
      const filtered = prev.filter((p) => p.id !== presetId);
      if (mode === presetId && filtered.length > 0) {
        changeMode(filtered[0].id);
      }
      return filtered;
    });
  };

  const resetTimer = () => {
    setIsActive(false);
    stopAlarm();
    setTotalSeconds(targetTime.min * 60 + targetTime.sec);
  };

  const updateCustomTime = (m, s) => {
    setTargetTime({ min: m, sec: s });
    setTotalSeconds(m * 60 + s);
  };

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formatTime = () => {
    const mStr = String(minutes).padStart(2, '0');
    const sStr = String(seconds).padStart(2, '0');
    if (hours > 0) {
      const hStr = String(hours).padStart(2, '0');
      return `${hStr}:${mStr}:${sStr}`;
    }
    return `${mStr}:${sStr}`;
  };

  return {
    isOpen,
    setIsOpen,
    toggleModal,
    minutes,
    seconds,
    hours,
    updateCustomTime,
    isActive,
    mode,
    changeMode,
    modePresets,
    updateModePreset,
    addPreset,
    removePreset,
    pinOnScreen,
    setPinOnScreen,
    soundOption,
    setSoundOption,
    testSound,
    isAlarmRinging,
    stopAlarm,
    startTimer,
    pauseTimer,
    resetTimer,
    formatTime,
    contextMenu,
    handleButtonContextMenu,
    closeContextMenu,
    extraTimers,
    addExtraPomodoro,
    removeExtraPomodoro,
    updateExtraPomodoro
  };
}