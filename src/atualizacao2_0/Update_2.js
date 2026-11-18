import { useState, useEffect, useRef, useCallback } from 'react';
import { isSkillsMode } from '../modes/modeState.js';
import { useUndoRestore } from './GlobalUndo.js';

const STORAGE_KEY_TIME = 'pomodoro_saved_target_time';
const STORAGE_KEY_SOUND = 'pomodoro_saved_sound_option';
const STORAGE_KEY_PRESETS = 'pomodoro_mode_presets_v3';
const STORAGE_KEY_RUNTIME = 'pomodoro_runtime_v1';
const STORAGE_KEY_EXTRAS = 'pomodoro_extra_timers_v1';

// Modo usado quando o tempo é editado à mão e não corresponde a nenhuma pré-definição
export const CUSTOM_MODE_ID = 'custom';

const DEFAULT_PRESETS = [
  { id: 'pomodoro', name: 'Pomodoro', hours: 0, minutes: 45, seconds: 0 },
  { id: 'shortBreak', name: 'Pausa Curta', hours: 0, minutes: 10, seconds: 0 },
  { id: 'longBreak', name: 'Pausa Longa', hours: 0, minutes: 15, seconds: 0 }
];

const readJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
};

const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
};

const presetSeconds = (p) => (p.hours || 0) * 3600 + (p.minutes || 0) * 60 + (p.seconds || 0);
const targetSeconds = (t) => (t.min || 0) * 60 + (t.sec || 0);
const secondsLeft = (endAt) => Math.max(0, Math.ceil((endAt - Date.now()) / 1000));

// Um único AudioContext reaproveitado por todos os alarmes.
// Antes, cada bipe criava um contexto novo que nunca era fechado (vazamento de memória).
let sharedAudioCtx = null;
function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioContextClass();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

// Emoji padrão dos timers extras
export const DEFAULT_TIMER_EMOJI = '⏰';

// Catálogo de sons do alarme. repeatMs = intervalo entre repetições enquanto toca.
export const ALARM_SOUNDS = [
  { value: 'clock', label: '🎵 Timer', repeatMs: 1500 },
  { value: 'digital', label: '🎵 Bip Grave (Triplo)', repeatMs: 1500 },
  { value: 'bell', label: '🎵 Sino Ressonante', repeatMs: 1500 },
  { value: 'arcade', label: '🎵 Arcade 8-Bit', repeatMs: 1500 },
  { value: 'musicbox', label: '🎵 Caixinha de Música', repeatMs: 2000 },
  { value: 'fanfare', label: '🎵 Fanfarra', repeatMs: 1800 },
  { value: 'levelup', label: '🎵 Level Up (RPG)', repeatMs: 1500 },
  { value: 'marimba', label: '🎵 Marimba', repeatMs: 1600 },
  { value: 'windchimes', label: '🎵 Sinos de Vento', repeatMs: 2400 },
  { value: 'tibetan', label: '🎵 Tigela Tibetana', repeatMs: 3200 }
];

export const getAlarmRepeatMs = (sound) => ALARM_SOUNDS.find((s) => s.value === sound)?.repeatMs || 1500;

// Toca uma sequência de notas: [frequência, início (s), duração (s), volume?]
function playNotes(ctx, start, notes, type = 'sine', baseGain = 0.25) {
  notes.forEach(([freq, at, dur, gainMul = 1]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = start + at;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(baseGain * gainMul, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  });
}

// Notas usadas nas melodias
const N = {
  C4: 261.63, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77,
  C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, A6: 1760.0, C7: 2093.0
};

const MELODIES = {
  // Caixinha de música: melodia suave e aguda
  musicbox: (ctx, now) => {
    playNotes(ctx, now, [
      [N.G5, 0, 0.6], [N.E6, 0.2, 0.6], [N.C6, 0.4, 0.6],
      [N.G5, 0.6, 0.6], [N.A5, 0.8, 0.6], [N.C6, 1.0, 0.9]
    ], 'sine', 0.22);
    playNotes(ctx, now, [[N.C5, 0, 1.6, 0.6]], 'triangle', 0.08);
  },
  // Fanfarra: "ta-ta-ta-tááá"
  fanfare: (ctx, now) => {
    playNotes(ctx, now, [
      [N.G4, 0, 0.14], [N.G4, 0.16, 0.14], [N.G4, 0.32, 0.14],
      [N.C5, 0.5, 0.9], [N.E5, 0.5, 0.9, 0.7], [N.G5, 0.5, 0.9, 0.6]
    ], 'sawtooth', 0.07);
    playNotes(ctx, now, [[N.C4, 0.5, 0.9]], 'triangle', 0.15);
  },
  // Level Up: arpejo rápido de videogame
  levelup: (ctx, now) => {
    playNotes(ctx, now, [
      [N.C5, 0, 0.1], [N.E5, 0.07, 0.1], [N.G5, 0.14, 0.1], [N.C6, 0.21, 0.1],
      [N.E6, 0.28, 0.1], [N.G6, 0.35, 0.45]
    ], 'square', 0.09);
    playNotes(ctx, now, [[N.C6, 0.35, 0.45, 0.8]], 'square', 0.06);
  },
  // Marimba: notas curtas com harmônico agudo
  marimba: (ctx, now) => {
    const seq = [[N.E5, 0], [N.G5, 0.16], [N.C6, 0.32], [N.G5, 0.48], [N.A5, 0.64], [N.C6, 0.8]];
    playNotes(ctx, now, seq.map(([f, t]) => [f, t, 0.35]), 'sine', 0.3);
    playNotes(ctx, now, seq.map(([f, t]) => [f * 4, t, 0.08]), 'sine', 0.05);
  },
  // Sinos de vento: notas altas que se sobrepõem
  windchimes: (ctx, now) => {
    playNotes(ctx, now, [
      [N.C6, 0, 1.4], [N.A6, 0.18, 1.3, 0.8], [N.E6, 0.4, 1.3], [N.C7, 0.62, 1.2, 0.6],
      [N.G6, 0.85, 1.2, 0.8], [N.D6, 1.1, 1.1]
    ], 'sine', 0.12);
  },
  // Tigela tibetana: som grave e longo, com leve batimento
  tibetan: (ctx, now) => {
    playNotes(ctx, now, [
      [196.0, 0, 2.9], [198.2, 0, 2.9, 0.7], [529.0, 0, 2.2, 0.35], [1043.0, 0, 1.4, 0.12]
    ], 'sine', 0.28);
  }
};

// Helper para tocar alarmes via Web Audio API
export function playWebAudioAlarm(soundOption = 'clock') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
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
    } else if (MELODIES[soundOption]) {
      MELODIES[soundOption](ctx, now);
    }
  } catch (e) {
    console.error('Erro ao tocar som do alarme:', e);
  }
}

// Agenda verificações de um timer baseado em horário final (endAt).
// - intervalo curto para atualizar o display;
// - um setTimeout único para o instante exato do fim (timeouts únicos sofrem
//   menos atraso que intervalos quando a aba está em segundo plano);
// - recalcula ao voltar para a aba.
export function useEndTimeTicker(endAt, onTick) {
  const onTickRef = useRef(onTick);
  useEffect(() => {
    onTickRef.current = onTick;
  });

  useEffect(() => {
    if (endAt == null) return undefined;
    const tick = () => onTickRef.current();
    tick();
    const interval = setInterval(tick, 250);
    const timeout = setTimeout(tick, Math.max(0, endAt - Date.now()) + 20);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [endAt]);
}

// Arrastar widgets com mouse ou toque, sempre mantendo-os dentro da tela.
export function useDraggable(position, onMove) {
  const elRef = useRef(null);
  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const positionRef = useRef(position);
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    positionRef.current = position;
    onMoveRef.current = onMove;
  });

  const clampToViewport = useCallback((x, y) => {
    const el = elRef.current;
    const w = el ? el.offsetWidth : 160;
    const h = el ? el.offsetHeight : 70;
    return {
      x: Math.round(Math.min(Math.max(0, x), Math.max(0, window.innerWidth - w))),
      y: Math.round(Math.min(Math.max(0, y), Math.max(0, window.innerHeight - h)))
    };
  }, []);

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('button, input, select, textarea')) return;
    const pos = positionRef.current;
    dragRef.current = {
      dx: e.clientX - pos.x,
      dy: e.clientY - pos.y,
      startX: e.clientX,
      startY: e.clientY
    };
    movedRef.current = false;
  };

  useEffect(() => {
    const moveTo = (pos) => {
      const cur = positionRef.current;
      if (pos.x !== cur.x || pos.y !== cur.y) onMoveRef.current(pos);
    };
    const handleMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      // Pequena tolerância para não confundir clique com arraste
      if (!movedRef.current && Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) < 4) return;
      movedRef.current = true;
      moveTo(clampToViewport(e.clientX - d.dx, e.clientY - d.dy));
    };
    const handleUp = () => {
      dragRef.current = null;
    };
    const handleResize = () => {
      const pos = positionRef.current;
      moveTo(clampToViewport(pos.x, pos.y));
    };

    handleResize();
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      window.removeEventListener('resize', handleResize);
    };
  }, [clampToViewport]);

  return { elRef, onPointerDown, movedRef };
}

const loadExtraTimers = () => {
  const saved = readJSON(STORAGE_KEY_EXTRAS, []);
  if (!Array.isArray(saved)) return [];
  return saved
    .filter((t) => t && t.id)
    .map((t) => {
      const initial = t.initialTotalSeconds || 1500;
      // Um alarme que estava tocando quando a página fechou volta pronto para recomeçar
      const base = { ...t, emoji: t.emoji || DEFAULT_TIMER_EMOJI };
      return t.isAlarmRinging
        ? { ...base, isAlarmRinging: false, endAt: null, totalSeconds: initial }
        : { ...base, endAt: t.endAt ?? null };
    });
};

export function usePomodoro() {
  const [isOpen, setIsOpen] = useState(false);

  const [runtime] = useState(() => readJSON(STORAGE_KEY_RUNTIME, null) || {});

  const [modePresets, setModePresets] = useState(() => {
    const parsed = readJSON(STORAGE_KEY_PRESETS, null);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((p) => ({
        id: p.id,
        name: p.name,
        hours: parseInt(p.hours, 10) || 0,
        minutes: parseInt(p.minutes, 10) || 0,
        seconds: parseInt(p.seconds, 10) || 0
      }));
    }
    return DEFAULT_PRESETS;
  });

  const [targetTime, setTargetTime] = useState(() => {
    const saved = readJSON(STORAGE_KEY_TIME, null);
    if (saved && typeof saved.min === 'number') return saved;
    const first = modePresets[0];
    return first ? { min: (first.hours || 0) * 60 + (first.minutes || 0), sec: first.seconds || 0 } : { min: 45, sec: 0 };
  });

  // O modo selecionado é restaurado; se não existir mais, deduz pelo tempo atual
  const [mode, setMode] = useState(() => {
    if (runtime.mode === CUSTOM_MODE_ID) return CUSTOM_MODE_ID;
    if (runtime.mode && modePresets.some((p) => p.id === runtime.mode)) return runtime.mode;
    const match = modePresets.find((p) => presetSeconds(p) === targetSeconds(targetTime));
    return match ? match.id : CUSTOM_MODE_ID;
  });

  // Horário (ms) em que o timer termina. null = parado.
  // Contar a partir de um horário final evita atrasos quando a aba fica em segundo plano.
  const [endAt, setEndAt] = useState(() => (typeof runtime.endAt === 'number' ? runtime.endAt : null));
  const isActive = endAt !== null;

  const [totalSeconds, setTotalSeconds] = useState(() => {
    if (typeof runtime.endAt === 'number') return secondsLeft(runtime.endAt);
    if (typeof runtime.remaining === 'number' && runtime.remaining > 0) return runtime.remaining;
    return targetSeconds(targetTime);
  });

  const [soundOption, setSoundOption] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_SOUND) || 'clock';
    } catch (e) {
      return 'clock';
    }
  });

  // O mini-widget agora fica sempre visível; começa no canto inferior esquerdo
  // para não cobrir os botões do topo.
  const [widgetPosition, setWidgetPosition] = useState(() =>
    runtime.widgetPos && typeof runtime.widgetPos.x === 'number'
      ? runtime.widgetPos
      : { x: 16, y: Math.max(16, window.innerHeight - 110) }
  );
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);

  // O mini-widget só aparece depois que um Pomodoro é iniciado; o ✕ dele o esconde de novo.
  const [widgetVisible, setWidgetVisible] = useState(() => Boolean(runtime.widgetOn) || typeof runtime.endAt === 'number');

  // Aba do modal: 'main' (Pomodoro principal) ou 'timers' (timers extras)
  const [modalTab, setModalTab] = useState('main');
  // Formulário "Novo timer" aberto dentro da aba Timers
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);

  // Timers extras: cada um é um Pomodoro independente (tempo, som e controles próprios)
  const [extraTimers, setExtraTimers] = useState(loadExtraTimers);
  // Força re-render quando algum segundo exibido dos timers extras muda
  const [, setExtrasDisplayKey] = useState('');
  const extraTimersRef = useRef(extraTimers);
  useEffect(() => {
    extraTimersRef.current = extraTimers;
  });

  // Estado do Menu de Contexto (Clique Direito)
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });

  const alarmIntervalRef = useRef(null);
  const soundOptionRef = useRef(soundOption);
  const targetTimeRef = useRef(targetTime);
  useEffect(() => {
    soundOptionRef.current = soundOption;
    targetTimeRef.current = targetTime;
  });

  // Ctrl+Z/Ctrl+Y global: recarrega a configuração do Pomodoro
  useUndoRestore(
    (k) => [STORAGE_KEY_PRESETS, STORAGE_KEY_TIME, STORAGE_KEY_SOUND, STORAGE_KEY_EXTRAS].includes(k),
    (keys) => {
      if (keys.includes(STORAGE_KEY_PRESETS)) {
        const parsed = readJSON(STORAGE_KEY_PRESETS, null);
        if (Array.isArray(parsed) && parsed.length > 0) setModePresets(parsed);
      }
      if (keys.includes(STORAGE_KEY_TIME)) {
        const saved = readJSON(STORAGE_KEY_TIME, null);
        if (saved && typeof saved.min === 'number') {
          setTargetTime(saved);
          if (endAt === null) setTotalSeconds(targetSeconds(saved));
        }
      }
      if (keys.includes(STORAGE_KEY_SOUND)) {
        try {
          setSoundOption(localStorage.getItem(STORAGE_KEY_SOUND) || 'clock');
        } catch (e) {}
      }
      if (keys.includes(STORAGE_KEY_EXTRAS)) {
        // Mantém o andamento dos timers que continuam existindo
        const restored = loadExtraTimers();
        setExtraTimers((prev) =>
          restored.map((t) => {
            const live = prev.find((p) => p.id === t.id);
            return live
              ? { ...t, endAt: live.endAt, totalSeconds: live.totalSeconds, isAlarmRinging: live.isAlarmRinging }
              : { ...t, endAt: null, isAlarmRinging: false, totalSeconds: t.initialTotalSeconds || t.totalSeconds };
          })
        );
      }
    }
  );

  useEffect(() => writeJSON(STORAGE_KEY_PRESETS, modePresets), [modePresets]);
  useEffect(() => writeJSON(STORAGE_KEY_TIME, targetTime), [targetTime]);
  useEffect(() => writeJSON(STORAGE_KEY_EXTRAS, extraTimers), [extraTimers]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SOUND, soundOption);
    } catch (e) {}
  }, [soundOption]);
  useEffect(() => {
    writeJSON(STORAGE_KEY_RUNTIME, { mode, endAt, remaining: totalSeconds, widgetPos: widgetPosition, widgetOn: widgetVisible });
  }, [mode, endAt, totalSeconds, widgetPosition, widgetVisible]);

  // Abrir o Pomodoro traz o mini-widget de volta; se o alarme tocar com ele
  // escondido, ele reaparece para dar acesso ao botão de desligar.
  const ringingExtras = extraTimers.filter((t) => t.isAlarmRinging);

  // ---------- Relógio dos timers extras ----------
  // Um único relógio para todos: verifica quem terminou e atualiza o display.
  const nextExtraEnd = extraTimers.reduce(
    (min, t) => (t.endAt != null && (min === null || t.endAt < min) ? t.endAt : min),
    null
  );

  useEffect(() => {
    if (nextExtraEnd === null) return undefined;
    const tick = () => {
      const now = Date.now();
      setExtraTimers((prev) => {
        let changed = false;
        const next = prev.map((t) => {
          if (t.endAt != null && now >= t.endAt) {
            changed = true;
            return { ...t, endAt: null, isAlarmRinging: true, totalSeconds: 0 };
          }
          return t;
        });
        return changed ? next : prev;
      });
      // Só re-renderiza quando algum segundo visível muda
      setExtrasDisplayKey(
        extraTimersRef.current
          .filter((t) => t.endAt != null)
          .map((t) => Math.ceil((t.endAt - now) / 1000))
          .join(',')
      );
    };
    tick();
    const interval = setInterval(tick, 250);
    const timeout = setTimeout(tick, Math.max(0, nextExtraEnd - Date.now()) + 20);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [nextExtraEnd]);

  // Alarme dos timers extras (toca o som de cada timer que terminou)
  const ringingSoundsKey = [...new Set(ringingExtras.map((t) => t.soundOption || 'clock'))].join(',');
  useEffect(() => {
    if (!ringingSoundsKey) return undefined;
    const sounds = ringingSoundsKey.split(',');
    const play = () => sounds.forEach((snd) => playWebAudioAlarm(snd));
    play();
    const interval = setInterval(play, Math.max(...sounds.map(getAlarmRepeatMs)));
    return () => clearInterval(interval);
  }, [ringingSoundsKey]);

  // Garante que o alarme pare se o componente for desmontado
  useEffect(() => () => clearInterval(alarmIntervalRef.current), []);

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

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => (prev.visible ? { visible: false, x: 0, y: 0 } : prev));
  }, []);

  // Abre o Pomodoro na aba Timers (opcionalmente já com o formulário de novo timer)
  const openTimersTab = ({ create = false } = {}) => {
    closeContextMenu();
    setModalTab('timers');
    if (create) setIsAddPanelOpen(true);
    setIsOpen(true);
  };

  // Escolhe uma posição livre para a janela de um timer extra: empilha acima do
  // mini-widget e passa para a coluna ao lado quando chega perto do topo.
  const nextExtraPosition = (index) => {
    const rowHeight = 92;
    const colWidth = 178;
    const base = widgetPosition;
    const rowsPerCol = Math.max(1, Math.floor((base.y - 16) / rowHeight));
    const col = Math.floor(index / rowsPerCol);
    const row = index % rowsPerCol;
    return {
      x: Math.min(base.x + col * colWidth, Math.max(16, window.innerWidth - colWidth)),
      y: Math.max(16, base.y - (row + 1) * rowHeight)
    };
  };

  // Liga/desliga a janela flutuante de um timer extra
  const setExtraOnScreen = (id, onScreen) => {
    setExtraTimers((prev) => {
      const shown = prev.filter((t) => t.onScreen && t.id !== id).length;
      return prev.map((t) =>
        t.id === id
          ? { ...t, onScreen, position: onScreen && !t.onScreen ? nextExtraPosition(shown) : t.position }
          : t
      );
    });
  };

  const extraRemaining = (t) =>
    t.endAt != null ? Math.max(0, Math.ceil((t.endAt - Date.now()) / 1000)) : t.totalSeconds;

  // Criar timer extra
  const addExtraPomodoro = ({ title, emoji, seconds: totalSecs = 25 * 60, sound, start = false, onScreen = false } = {}) => {
    closeContextMenu();
    const secs = Math.max(1, Math.round(totalSecs));
    const usedNames = new Set(extraTimers.map((t) => t.title));
    let n = extraTimers.length + 1;
    while (usedNames.has(`Timer ${n}`)) n += 1;

    const newTimer = {
      id: 'extra_pomo_' + Date.now(),
      title: (title || '').trim() || `Timer ${n}`,
      emoji: emoji || DEFAULT_TIMER_EMOJI,
      hours: Math.floor(secs / 3600),
      minutes: Math.floor((secs % 3600) / 60),
      seconds: secs % 60,
      totalSeconds: secs,
      initialTotalSeconds: secs,
      endAt: start ? Date.now() + secs * 1000 : null,
      isAlarmRinging: false,
      soundOption: sound || soundOption,
      onScreen,
      position: onScreen ? nextExtraPosition(extraTimers.filter((t) => t.onScreen).length) : null
    };

    setExtraTimers((prev) => [...prev, newTimer]);
  };

  const removeExtraPomodoro = useCallback((id) => {
    setExtraTimers((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateExtraPomodoro = useCallback((id, updates) => {
    setExtraTimers((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  // Controles individuais: iniciar um timer não mexe em nenhum outro
  const startExtra = (id) => {
    setExtraTimers((prev) =>
      prev.map((t) => {
        if (t.id !== id || t.endAt != null) return t;
        const initial = t.initialTotalSeconds || 1500;
        const secs = !t.isAlarmRinging && t.totalSeconds > 0 ? t.totalSeconds : initial;
        return { ...t, isAlarmRinging: false, totalSeconds: secs, endAt: Date.now() + secs * 1000 };
      })
    );
  };

  const pauseExtra = (id) => {
    setExtraTimers((prev) =>
      prev.map((t) => (t.id === id && t.endAt != null ? { ...t, endAt: null, totalSeconds: extraRemaining(t) } : t))
    );
  };

  const resetExtra = (id) => {
    setExtraTimers((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, endAt: null, isAlarmRinging: false, totalSeconds: t.initialTotalSeconds || 1500 } : t
      )
    );
  };

  const silenceAllExtras = () => {
    setExtraTimers((prev) =>
      prev.map((t) => (t.isAlarmRinging ? { ...t, isAlarmRinging: false, totalSeconds: t.initialTotalSeconds || 1500 } : t))
    );
  };

  // Edita nome, tempo e som; se estiver rodando, recomeça com o novo tempo
  const editExtra = (id, { title, emoji, seconds: secs, sound }) => {
    setExtraTimers((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const next = {
          ...t,
          title: (title || '').trim() || t.title,
          emoji: emoji || t.emoji || DEFAULT_TIMER_EMOJI,
          soundOption: sound || t.soundOption
        };
        if (secs > 0) {
          Object.assign(next, {
            hours: Math.floor(secs / 3600),
            minutes: Math.floor((secs % 3600) / 60),
            seconds: secs % 60,
            totalSeconds: secs,
            initialTotalSeconds: secs,
            endAt: t.endAt != null ? Date.now() + secs * 1000 : null
          });
        }
        return next;
      })
    );
  };

  const testSound = (soundType) => {
    playWebAudioAlarm(soundType);
  };

  const startAlarm = () => {
    if (alarmIntervalRef.current) return;
    setIsAlarmRinging(true);
    // Lê o som pela ref para usar sempre a opção atual, mesmo se trocada durante a contagem
    playWebAudioAlarm(soundOptionRef.current);
    alarmIntervalRef.current = setInterval(() => {
      playWebAudioAlarm(soundOptionRef.current);
    }, getAlarmRepeatMs(soundOptionRef.current));
  };

  const silenceAlarm = () => {
    setIsAlarmRinging(false);
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
  };

  const stopAlarm = () => {
    silenceAlarm();
    setTotalSeconds(targetSeconds(targetTimeRef.current));
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Atalhos do SkillTree só valem no modo Skills
      if (!isSkillsMode()) return;
      const activeElem = document.activeElement;
      const isEditingText =
        activeElem &&
        (activeElem.tagName === 'INPUT' ||
          activeElem.tagName === 'TEXTAREA' ||
          activeElem.tagName === 'SELECT' ||
          activeElem.isContentEditable);

      // Esc fecha o Pomodoro (antes abria as Configurações por cima dele)
      if (isOpen && e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        setIsOpen(false);
        return;
      }

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
  }, [toggleModal, isOpen]);

  useEndTimeTicker(endAt, () => {
    const left = secondsLeft(endAt);
    if (left <= 0) {
      setEndAt(null);
      setTotalSeconds(targetSeconds(targetTimeRef.current));
      startAlarm();
    } else {
      setTotalSeconds(left);
    }
  });

  const startTimer = () => {
    if (isActive) return;
    const wasRinging = isAlarmRinging;
    if (wasRinging) silenceAlarm();
    const target = targetSeconds(targetTimeRef.current);
    const secs = !wasRinging && totalSeconds > 0 ? totalSeconds : target;
    if (secs <= 0) return;
    setTotalSeconds(secs);
    setEndAt(Date.now() + secs * 1000);
    // Iniciar um Pomodoro coloca o mini-widget na tela inicial
    setWidgetVisible(true);
  };

  const pauseTimer = () => {
    if (endAt === null) return;
    setTotalSeconds(secondsLeft(endAt));
    setEndAt(null);
  };

  const changeMode = (presetId, presetList = modePresets) => {
    setEndAt(null);
    silenceAlarm();
    setMode(presetId);

    const preset = presetList.find((p) => p.id === presetId);
    const h = preset ? preset.hours || 0 : 0;
    const m = preset ? preset.minutes || 0 : 45;
    const s = preset ? preset.seconds || 0 : 0;

    const next = { min: h * 60 + m, sec: s };
    targetTimeRef.current = next;
    setTargetTime(next);
    setTotalSeconds(h * 3600 + m * 60 + s);
  };

  const updateModePreset = (presetId, hVal, mVal, sVal) => {
    const h = Math.max(0, parseInt(hVal, 10) || 0);
    const m = Math.max(0, parseInt(mVal, 10) || 0);
    const s = Math.min(59, Math.max(0, parseInt(sVal, 10) || 0));
    if (h === 0 && m === 0 && s === 0) return;

    setModePresets((prev) =>
      prev.map((p) => (p.id === presetId ? { ...p, hours: h, minutes: m, seconds: s } : p))
    );

    if (mode === presetId) {
      const total = h * 3600 + m * 60 + s;
      const next = { min: h * 60 + m, sec: s };
      targetTimeRef.current = next;
      setTargetTime(next);
      setTotalSeconds(total);
      if (isActive) setEndAt(Date.now() + total * 1000);
    }
  };

  const addPreset = (name, hVal, mVal, sVal) => {
    const h = Math.max(0, parseInt(hVal, 10) || 0);
    const m = Math.max(0, parseInt(mVal, 10) || 0);
    const s = Math.min(59, Math.max(0, parseInt(sVal, 10) || 0));

    if (h === 0 && m === 0 && s === 0) return;

    const cleanName = (name || '').trim() || 'Nova Pausa';
    const newId = 'preset_' + Date.now();
    const newPreset = { id: newId, name: cleanName, hours: h, minutes: m, seconds: s };

    setModePresets((prev) => [...prev, newPreset]);
  };

  const removePreset = (presetId) => {
    if (modePresets.length <= 1) return;
    const filtered = modePresets.filter((p) => p.id !== presetId);
    setModePresets(filtered);
    if (mode === presetId && filtered.length > 0) {
      changeMode(filtered[0].id, filtered);
    }
  };

  const resetTimer = () => {
    setEndAt(null);
    stopAlarm();
  };

  const updateCustomTime = (m, s) => {
    const next = { min: m, sec: s };
    const total = targetSeconds(next);
    if (total <= 0) return;
    targetTimeRef.current = next;
    setTargetTime(next);
    setTotalSeconds(total);
    // Se o novo tempo não bate com o botão selecionado, nenhum botão fica destacado
    const current = modePresets.find((p) => p.id === mode);
    if (!current || presetSeconds(current) !== total) {
      const match = modePresets.find((p) => presetSeconds(p) === total);
      setMode(match ? match.id : CUSTOM_MODE_ID);
    }
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
    targetTotalSeconds: targetSeconds(targetTime),
    widgetVisible,
    setWidgetVisible,
    isAddPanelOpen,
    setIsAddPanelOpen,
    modalTab,
    setModalTab,
    openTimersTab,
    extraRemaining,
    startExtra,
    pauseExtra,
    resetExtra,
    editExtra,
    silenceAllExtras,
    setExtraOnScreen,
    ringingExtras,
    widgetPosition,
    setWidgetPosition,
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
