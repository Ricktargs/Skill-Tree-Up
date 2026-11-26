// =========================================================
// ⏰ RELÓGIO (aba do Pomodoro): alarmes por horário
// Cada alarme: hora, nome, dias da semana (nenhum = toca uma vez) e som.
// Toca em qualquer modo do programa, com aviso flutuante (Parar / +5 min).
// Fica guardado no aparelho (vale para todos os perfis).
// =========================================================
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { tx } from '../i18n/index.jsx';
import { ALARM_SOUNDS, getAlarmRepeatMs, playWebAudioAlarm } from './Update_2.js';
import './AlarmClock.css';

const KEY = 'orbe-alarms-v1';
const DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']; // domingo..sábado
const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// ---------- guarda (compartilhada entre a aba e o aviso) ----------
const load = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};
let alarms = load();
let ringing = []; // [{ id, label, sound }]
const listeners = new Set();
let version = 0;
const emit = () => {
  version += 1;
  listeners.forEach((l) => l());
};
const persist = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(alarms));
  } catch {
    /* sem espaço */
  }
};
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const useAlarms = () => {
  useSyncExternalStore(subscribe, () => version);
  return { alarms, ringing };
};
const setAlarms = (fn) => {
  alarms = fn(alarms);
  persist();
  emit();
};
// outro aparelho/aba mudou (ou o desfazer global restaurou)
if (typeof window !== 'undefined') {
  const reload = () => {
    alarms = load();
    emit();
  };
  window.addEventListener('storage', (e) => e.key === KEY && reload());
  window.addEventListener('rpg-undo-restore', reload);
}

const newId = () => `al_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const pad = (n) => String(n).padStart(2, '0');
const nowHM = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// ---------- tocar ----------
let soundTimer = null;
const restartSound = () => {
  clearInterval(soundTimer);
  soundTimer = null;
  if (!ringing.length) return;
  const snd = ringing[ringing.length - 1].sound || 'musicbox';
  playWebAudioAlarm(snd);
  soundTimer = setInterval(() => playWebAudioAlarm(snd), getAlarmRepeatMs(snd));
};
const ring = (alarm) => {
  if (ringing.some((r) => r.id === alarm.id)) return;
  ringing = [...ringing, { id: alarm.id, label: alarm.label || tx('Alarme'), time: alarm.time, sound: alarm.sound || 'musicbox' }];
  restartSound();
  emit();
  // aviso do sistema (se o programa estiver na bandeja / em outra janela)
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(`⏰ ${alarm.time} · ${alarm.label || tx('Alarme')}`, { body: tx('ORBE-G — alarme do relógio'), silent: true });
    }
  } catch {
    /* sem notificações */
  }
};
const stopRinging = (id) => {
  ringing = ringing.filter((r) => r.id !== id);
  restartSound();
  emit();
};
const snooze = (id, min = 5) => {
  const r = ringing.find((x) => x.id === id);
  stopRinging(id);
  if (!r) return;
  setAlarms((list) => list.map((a) => (a.id === id ? { ...a, snoozeUntil: Date.now() + min * 60000 } : a)));
};

// Verifica a cada segundo (funciona com o programa em segundo plano também)
let lastCheckedMinute = '';
const check = () => {
  const d = new Date();
  const hm = nowHM(d);
  const minuteKey = `${d.toDateString()} ${hm}`;
  const now = Date.now();
  // soneca vencida
  alarms.forEach((a) => {
    if (a.snoozeUntil && now >= a.snoozeUntil) {
      setAlarms((list) => list.map((x) => (x.id === a.id ? { ...x, snoozeUntil: null } : x)));
      ring(a);
    }
  });
  if (minuteKey === lastCheckedMinute) return;
  lastCheckedMinute = minuteKey;
  alarms.forEach((a) => {
    if (!a.enabled || a.time !== hm || a.lastFired === minuteKey) return;
    const days = Array.isArray(a.days) ? a.days : [];
    if (days.length && !days.includes(d.getDay())) return;
    // sem dias marcados: toca uma vez e desliga
    setAlarms((list) => list.map((x) => (x.id === a.id ? { ...x, lastFired: minuteKey, enabled: days.length ? x.enabled : false } : x)));
    ring(a);
  });
};
let started = false;
const startClock = () => {
  if (started || typeof window === 'undefined') return;
  started = true;
  check();
  setInterval(check, 1000);
};

// =========================================================
// Aviso flutuante (fica montado no App: toca em qualquer modo)
// =========================================================
export function AlarmClockHost() {
  const { ringing: list } = useAlarms();
  useEffect(() => startClock(), []);
  if (!list.length) return null;
  return createPortal(
    <div className="alc-ringing" role="alertdialog" aria-label={tx('Alarme tocando')}>
      {list.map((r) => (
        <div key={r.id} className="alc-ring-card">
          <span className="alc-ring-bell" aria-hidden="true">
            ⏰
          </span>
          <div className="alc-ring-text">
            <b>{r.time}</b>
            <span>{r.label}</span>
          </div>
          <button type="button" className="alc-btn ghost" onClick={() => snooze(r.id)}>
            +5 min
          </button>
          <button type="button" className="alc-btn primary" onClick={() => stopRinging(r.id)}>
            {tx('Parar')}
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}

// =========================================================
// Aba "Relógio" dentro do Pomodoro
// =========================================================
export function ClockTab({ click }) {
  const { alarms: list } = useAlarms();
  const [now, setNow] = useState(() => new Date());
  const [draft, setDraft] = useState(null); // alarme sendo criado/editado
  const timeRef = useRef(null);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (draft) setTimeout(() => timeRef.current?.focus(), 30);
  }, [draft && draft.id]);

  const sorted = [...list].sort((a, b) => a.time.localeCompare(b.time));
  const openNew = () => {
    click();
    const d = new Date(Date.now() + 60 * 60000);
    setDraft({ id: null, time: `${pad(d.getHours())}:00`, label: '', days: [], sound: 'musicbox' });
    // pede permissão para avisar fora do programa (uma vez)
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission();
    } catch {
      /* sem notificações */
    }
  };
  const save = () => {
    if (!draft || !/^\d{2}:\d{2}$/.test(draft.time)) return;
    click('train');
    if (draft.id) setAlarms((l) => l.map((a) => (a.id === draft.id ? { ...a, ...draft, enabled: true, lastFired: null } : a)));
    else setAlarms((l) => [...l, { ...draft, id: newId(), enabled: true }]);
    setDraft(null);
  };
  const daysText = (days) => {
    if (!days || !days.length) return tx('Uma vez');
    if (days.length === 7) return tx('Todos os dias');
    const s = [...days].sort();
    if (s.join() === '1,2,3,4,5') return tx('Dias úteis');
    if (s.join() === '0,6') return tx('Fim de semana');
    return s.map((d) => tx(DAY_NAMES[d]).slice(0, 3)).join(', ');
  };

  return (
    <div className="alc-tab">
      <div className="alc-now">
        <span className="alc-now-time">
          {pad(now.getHours())}:{pad(now.getMinutes())}
          <small>:{pad(now.getSeconds())}</small>
        </span>
        <span className="alc-now-date">{now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      </div>

      {draft ? (
        <div className="alc-editor">
          <div className="alc-editor-row">
            <input ref={timeRef} className="alc-time-input" type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
            <input
              className="alc-label-input"
              type="text"
              maxLength={40}
              placeholder={tx('Nome do alarme (ex: Remédio)')}
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && save()}
            />
          </div>
          <div className="alc-days" role="group" aria-label={tx('Repetir nos dias')}>
            {DAYS.map((d, i) => (
              <button
                key={i}
                type="button"
                title={tx(DAY_NAMES[i])}
                className={`alc-day ${draft.days.includes(i) ? 'on' : ''}`}
                onClick={() => setDraft({ ...draft, days: draft.days.includes(i) ? draft.days.filter((x) => x !== i) : [...draft.days, i] })}
              >
                {d}
              </button>
            ))}
            <small>{daysText(draft.days)}</small>
          </div>
          <div className="alc-editor-row">
            <select className="alc-sound" value={draft.sound} onChange={(e) => setDraft({ ...draft, sound: e.target.value })}>
              {ALARM_SOUNDS.map((o) => (
                <option key={o.value} value={o.value}>
                  🔊 {tx(o.label)}
                </option>
              ))}
            </select>
            <button type="button" className="alc-btn ghost" onClick={() => playWebAudioAlarm(draft.sound)} title={tx('Ouvir')}>
              ▶
            </button>
          </div>
          <div className="alc-editor-row end">
            <button type="button" className="alc-btn ghost" onClick={() => { click(); setDraft(null); }}>
              {tx('Cancelar')}
            </button>
            <button type="button" className="alc-btn primary" onClick={save}>
              {tx('Salvar alarme')}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="alc-add" onClick={openNew}>
          ＋ {tx('Novo alarme')}
        </button>
      )}

      {sorted.length === 0 && !draft && <p className="alc-empty">{tx('Nenhum alarme ainda. Crie um para tocar num horário.')}</p>}

      <div className="alc-list">
        {sorted.map((a) => (
          <div key={a.id} className={`alc-item ${a.enabled ? '' : 'off'}`}>
            <button type="button" className="alc-item-main" onClick={() => { click(); setDraft({ ...a, days: a.days || [] }); }} title={tx('Editar')}>
              <span className="alc-item-time">{a.time}</span>
              <span className="alc-item-info">
                <b>{a.label || tx('Alarme')}</b>
                <small>
                  {daysText(a.days)}
                  {a.snoozeUntil ? ` · ${tx('soneca')} ${nowHM(new Date(a.snoozeUntil))}` : ''}
                </small>
              </span>
            </button>
            <label className="alc-switch" title={a.enabled ? tx('Desligar') : tx('Ligar')}>
              <input
                type="checkbox"
                checked={Boolean(a.enabled)}
                onChange={() => {
                  click();
                  setAlarms((l) => l.map((x) => (x.id === a.id ? { ...x, enabled: !x.enabled, lastFired: null, snoozeUntil: null } : x)));
                }}
              />
              <span />
            </label>
            <button
              type="button"
              className="alc-del"
              title={tx('Excluir alarme')}
              onClick={() => {
                click('delete');
                setAlarms((l) => l.filter((x) => x.id !== a.id));
              }}
            >
              🗑
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export const useAlarmCount = () => useAlarms().alarms.filter((a) => a.enabled).length;
export const useAlarmRinging = () => useAlarms().ringing.length > 0;
