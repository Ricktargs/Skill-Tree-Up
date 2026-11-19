/* =========================================================
   SOM — tudo sintetizado com Web Audio (sem arquivos externos)
   - Efeitos curtos para as ações (galho, folha, papel, sino...)
   - Ambiente opcional: vento suave + pássaros ocasionais
========================================================= */
import { useSyncExternalStore } from "react";

const KEY = "eu-sou-arvore-sound";
// Todos os sons (efeitos e ambiente) vêm ligados de padrão
const DEFAULTS = { enabled: true, ambient: true, volume: 1 };

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY)) || {};
    // v2.0.8: som ligado, músicas (ambiente) ligadas e volume no máximo —
    // aplicado uma vez em todos os aparelhos; depois vale o que a pessoa escolher
    if (!saved.soundDefaultV3) {
      saved.enabled = true;
      saved.ambient = true;
      saved.volume = 1;
      saved.ambientDefaultV2 = true;
      saved.soundDefaultV3 = true;
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...DEFAULTS, ...saved }));
      } catch {
        /* sem armazenamento */
      }
    }
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

let settings = loadSettings();
const listeners = new Set();

let ctx = null;
let master = null;
let noiseBuffer = null;
let ambient = null;

function getCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 4;
  master = ctx.createGain();
  master.gain.value = settings.volume;
  master.connect(comp).connect(ctx.destination);

  const len = ctx.sampleRate * 2;
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

function ready() {
  const c = getCtx();
  if (!c) return null;
  if (c.state === "suspended") c.resume();
  return c;
}

/* ---------------- blocos de síntese ---------------- */
function tone(c, { freq, to, type = "sine", start = 0, attack = 0.005, decay = 0.3, gain = 0.2, pan = 0 }) {
  const t = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + decay * 0.8);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  let out = g;
  if (pan && c.createStereoPanner) {
    const p = c.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    out = p;
  }
  osc.connect(g);
  out.connect(master);
  osc.start(t);
  osc.stop(t + attack + decay + 0.05);
}

function noise(c, { start = 0, attack = 0.01, decay = 0.2, gain = 0.15, type = "bandpass", freq = 2000, to, q = 1 }) {
  const t = c.currentTime + start;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = c.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  src.connect(f).connect(g).connect(master);
  const offset = Math.random() * 1.5;
  src.start(t, offset);
  src.stop(t + attack + decay + 0.05);
}

const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];

const SOUNDS = {
  /* toque de madeira ao clicar num galho */
  branch(c) {
    tone(c, { freq: 220, to: 140, type: "sine", decay: 0.16, gain: 0.35 });
    tone(c, { freq: 440, to: 300, type: "triangle", decay: 0.06, gain: 0.08 });
    noise(c, { freq: 1800, q: 3, decay: 0.04, gain: 0.12 });
  },
  /* folhas farfalhando (arrastar galho) */
  rustle(c) {
    for (let i = 0; i < 6; i++) {
      noise(c, { start: i * 0.035 + Math.random() * 0.02, freq: 3500 + Math.random() * 2500, q: 0.8, decay: 0.06, gain: 0.06 });
    }
  },
  /* papel deslizando (abrir janela) */
  open(c) {
    noise(c, { type: "highpass", freq: 800, to: 4000, attack: 0.06, decay: 0.16, gain: 0.07, q: 0.7 });
  },
  close(c) {
    noise(c, { type: "highpass", freq: 3500, to: 900, attack: 0.03, decay: 0.12, gain: 0.05, q: 0.7 });
  },
  /* sino suave (salvar) */
  save(c) {
    tone(c, { freq: 659.25, type: "triangle", decay: 0.9, gain: 0.12 });
    tone(c, { freq: 987.77, type: "sine", start: 0.08, decay: 1.1, gain: 0.09 });
    tone(c, { freq: 1975.5, type: "sine", start: 0.08, decay: 0.5, gain: 0.02 });
  },
  /* crescimento: arpejo pentatônico (ganhar pontos) */
  grow(c) {
    const base = Math.floor(Math.random() * 2);
    [0, 2, 4].forEach((n, i) => {
      tone(c, { freq: PENTA[base + n], type: "triangle", start: i * 0.07, decay: 0.7, gain: 0.09, pan: (i - 1) * 0.3 });
    });
    noise(c, { start: 0.05, freq: 6000, q: 2, decay: 0.25, gain: 0.02 });
  },
  /* soltar nota num galho: folha caindo + pluck */
  drop(c) {
    tone(c, { freq: 784, to: 523, type: "triangle", decay: 0.25, gain: 0.1 });
    SOUNDS.rustle(c);
  },
  /* excluir: baque abafado */
  delete(c) {
    tone(c, { freq: 120, to: 55, type: "sine", decay: 0.3, gain: 0.3 });
    noise(c, { type: "lowpass", freq: 900, to: 200, decay: 0.25, gain: 0.15 });
  },
  /* modo de troca ativado */
  hold(c) {
    tone(c, { freq: 392, type: "sine", decay: 0.25, gain: 0.12 });
    tone(c, { freq: 587.33, type: "sine", start: 0.1, decay: 0.35, gain: 0.12 });
  },
  swap(c) {
    tone(c, { freq: 587.33, to: 392, type: "triangle", decay: 0.2, gain: 0.1, pan: -0.4 });
    tone(c, { freq: 392, to: 587.33, type: "triangle", decay: 0.2, gain: 0.1, pan: 0.4 });
    SOUNDS.rustle(c);
  },
  /* desfazer / refazer / pequenos cliques */
  tick(c) {
    tone(c, { freq: 1200, type: "triangle", decay: 0.04, gain: 0.05 });
  },
  folder(c) {
    noise(c, { type: "bandpass", freq: 1200, q: 1.2, attack: 0.01, decay: 0.08, gain: 0.1 });
    tone(c, { freq: 330, type: "sine", start: 0.02, decay: 0.12, gain: 0.1 });
  },
};

function chirp(c) {
  const pan = Math.random() * 1.6 - 0.8;
  const base = 2400 + Math.random() * 1400;
  const n = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    tone(c, { freq: base, to: base * (1.25 + Math.random() * 0.3), start: i * (0.09 + Math.random() * 0.05), attack: 0.01, decay: 0.07, gain: 0.025, pan });
  }
}

function startAmbient() {
  const c = ready();
  if (!c || ambient) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 450;
  filter.Q.value = 0.6;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.06, c.currentTime + 3);

  // rajadas de vento: LFOs lentos no filtro e no volume
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 260;
  lfo.connect(lfoGain).connect(filter.frequency);
  const lfo2 = c.createOscillator();
  lfo2.frequency.value = 0.11;
  const lfo2Gain = c.createGain();
  lfo2Gain.gain.value = 0.025;
  lfo2.connect(lfo2Gain).connect(gain.gain);

  src.connect(filter).connect(gain).connect(master);
  src.start();
  lfo.start();
  lfo2.start();

  let birdTimer = null;
  const scheduleBird = () => {
    birdTimer = setTimeout(() => {
      if (ambient && c.state === "running") chirp(c);
      scheduleBird();
    }, 5000 + Math.random() * 11000);
  };
  scheduleBird();

  ambient = {
    stop() {
      clearTimeout(birdTimer);
      const t = c.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value || 0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1);
      [src, lfo, lfo2].forEach((n) => n.stop(t + 1.1));
    },
  };
}

function stopAmbient() {
  ambient?.stop();
  ambient = null;
}

/* O navegador só libera áudio depois de um gesto do usuário. */
let gestureBound = false;
function bindFirstGesture() {
  if (gestureBound || typeof window === "undefined") return;
  gestureBound = true;
  const onGesture = () => {
    window.removeEventListener("pointerdown", onGesture, true);
    window.removeEventListener("keydown", onGesture, true);
    if (settings.enabled && settings.ambient) startAmbient();
  };
  window.addEventListener("pointerdown", onGesture, true);
  window.addEventListener("keydown", onGesture, true);
}
bindFirstGesture();

/* ---------------- API pública ---------------- */
export const sfx = {
  play(name) {
    if (!settings.enabled) return;
    const fn = SOUNDS[name];
    if (!fn) return;
    try {
      const c = ready();
      if (c) fn(c);
    } catch {
      /* áudio indisponível: ignora */
    }
  },
};

export function getSoundSettings() {
  return settings;
}

export function setSoundSettings(patch) {
  settings = { ...settings, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
  if (master && ctx) master.gain.setTargetAtTime(settings.volume, ctx.currentTime, 0.05);
  if (settings.enabled && settings.ambient) startAmbient();
  else stopAmbient();
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSoundSettings() {
  return useSyncExternalStore(subscribe, getSoundSettings);
}
