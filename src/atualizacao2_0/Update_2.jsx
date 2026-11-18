import React, { useState, useEffect } from 'react';
import { tx } from '../i18n/index.jsx';
import EmojiPicker from 'emoji-picker-react';
import './Update_2.css';
import { usePomodoro, useDraggable, ALARM_SOUNDS, DEFAULT_TIMER_EMOJI } from './Update_2.js';

export { usePomodoro };

const SOUND_OPTIONS = ALARM_SOUNDS;

// Sugestões rápidas de emoji para os timers (o "…" abre o seletor completo)
const QUICK_EMOJIS = ['⏰', '📚', '💻', '💪', '🧘', '☕', '✍️', '🎮', '🍅', '🎯'];

const DIAL_RADIUS = 45;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS;

function formatSeconds(total) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
}

const presetTotal = (p) => (p.hours || 0) * 3600 + (p.minutes || 0) * 60 + (p.seconds || 0);
const progressOf = (remaining, total) => (total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0);
const toSeconds = (h, m, s) =>
  Math.max(0, parseInt(h, 10) || 0) * 3600 +
  Math.max(0, parseInt(m, 10) || 0) * 60 +
  Math.min(59, Math.max(0, parseInt(s, 10) || 0));

// Campos h / m / s reutilizados em todo o Pomodoro
function HmsInputs({ h, m, s, onH, onM, onS, compact = false }) {
  return (
    <div className={`pomo-hms ${compact ? 'compact' : ''}`}>
      <input className="pomo-input num" type="number" min="0" max="99" value={h} onChange={(e) => onH(e.target.value)} aria-label={tx("Horas")} />
      <span>h</span>
      <input className="pomo-input num" type="number" min="0" max="59" value={m} onChange={(e) => onM(e.target.value)} aria-label={tx("Minutos")} />
      <span>m</span>
      <input className="pomo-input num" type="number" min="0" max="59" value={s} onChange={(e) => onS(e.target.value)} aria-label={tx("Segundos")} />
      <span>s</span>
    </div>
  );
}

// Anel de progresso (grande no Pomodoro principal, pequeno nos cards)
function ProgressRing({ progress, className = '' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <circle className="pomo-dial-track" cx="50" cy="50" r={DIAL_RADIUS} />
      <circle
        className="pomo-dial-progress"
        cx="50"
        cy="50"
        r={DIAL_RADIUS}
        strokeDasharray={DIAL_CIRCUMFERENCE}
        strokeDashoffset={DIAL_CIRCUMFERENCE * (1 - progress)}
      />
    </svg>
  );
}

// 1. BOTÃO DO POMODORO NA TELA PRINCIPAL
export function PomodoroIconButton({ pomodoro, playSound }) {
  const { toggleModal, handleButtonContextMenu } = pomodoro;

  return (
    <button
      type="button"
      className="top-icon-button"
      onClick={() => {
        if (playSound) playSound('click');
        toggleModal();
      }}
      onContextMenu={handleButtonContextMenu}
      title={tx("Pomodoro (R) — clique direito para criar um timer")}
    >
      ⏱️
    </button>
  );
}

// 2. MENU DE CONTEXTO (CLIQUE DIREITO)
export function PomodoroContextMenu({ contextMenu, closeContextMenu, onAdd }) {
  useEffect(() => {
    if (!contextMenu.visible) return undefined;
    const handleClickOutside = () => closeContextMenu();
    const handleKey = (e) => e.key === 'Escape' && closeContextMenu();
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [contextMenu.visible, closeContextMenu]);

  if (!contextMenu.visible) return null;

  return (
    <div
      className="pomo-context-menu"
      style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" onClick={onAdd}>
        {tx("＋ Novo timer")}
      </button>
    </div>
  );
}

// 3. FORMULÁRIO DE TIMER (criar ou editar)
function TimerForm({ title, initial, presets, defaultSound, testSound, click, onSubmit, onCancel, mode = 'create' }) {
  const init = initial || {};
  const [name, setName] = useState(init.title || '');
  const [h, setH] = useState(String(init.hours ?? 0));
  const [m, setM] = useState(String(init.minutes ?? 25));
  const [s, setS] = useState(String(init.seconds ?? 0));
  const [sound, setSound] = useState(init.soundOption || defaultSound);
  const [presetId, setPresetId] = useState(null);
  const [onScreen, setOnScreen] = useState(false);
  const [emoji, setEmoji] = useState(init.emoji || DEFAULT_TIMER_EMOJI);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const secs = toSeconds(h, m, s);
  const presetName = presets.find((p) => p.id === presetId)?.name;

  const pickPreset = (preset) => {
    click();
    setPresetId(preset.id);
    setH(String(preset.hours || 0));
    setM(String(preset.minutes || 0));
    setS(String(preset.seconds || 0));
  };

  const typed = (setter) => (v) => {
    setter(v);
    setPresetId(null);
  };

  const submit = (start) => {
    if (secs <= 0) return;
    onSubmit({ title: name || presetName, emoji, seconds: secs, sound, start, onScreen });
  };

  return (
    <div className="pomo-manage">
      <span className="pomo-manage-title">{title}</span>
      <div className="pomo-name-row">
        <button
          type="button"
          className="pomo-emoji-btn"
          onClick={() => {
            click();
            setIsPickerOpen(true);
          }}
          title={tx("Escolher emoji")}
        >
          {emoji}
        </button>
        <input
          className="pomo-input name"
          type="text"
          placeholder={presetName || tx("Nome (ex: Leitura)")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit(false)}
          autoFocus
        />
      </div>

      <div className="pomo-emoji-row">
        {QUICK_EMOJIS.map((em) => (
          <button
            key={em}
            type="button"
            className={`pomo-emoji-quick ${emoji === em ? 'active' : ''}`}
            onClick={() => {
              click();
              setEmoji(em);
            }}
          >
            {em}
          </button>
        ))}
        <button
          type="button"
          className="pomo-emoji-quick more"
          onClick={() => {
            click();
            setIsPickerOpen(true);
          }}
          title={tx("Mais emojis")}
        >
          …
        </button>
      </div>

      {isPickerOpen && (
        <div
          className="pomo-emoji-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setIsPickerOpen(false);
          }}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <EmojiPicker
              onEmojiClick={(emojiData) => {
                click();
                setEmoji(emojiData.emoji);
                setIsPickerOpen(false);
              }}
              theme="dark"
              searchPlaceHolder={tx("Buscar emoji...")}
            />
          </div>
        </div>
      )}

      <div className="pomo-chips">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`pomo-chip ${presetId === preset.id ? 'active' : ''}`}
            onClick={() => pickPreset(preset)}
          >
            {tx(preset.name)}
            <small>{formatSeconds(presetTotal(preset))}</small>
          </button>
        ))}
      </div>

      <div className="pomo-manage-row" style={{ justifyContent: 'space-between' }}>
        <HmsInputs h={h} m={m} s={s} onH={typed(setH)} onM={typed(setM)} onS={typed(setS)} />
        <select
          className="pomodoro-select-input"
          value={sound}
          onChange={(e) => {
            setSound(e.target.value);
            testSound(e.target.value);
          }}
          title={tx("Som do alarme deste timer")}
        >
          {SOUND_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>🔊 {tx(opt.label)}</option>
          ))}
        </select>
      </div>

      {mode === 'create' && (
        <label className="pomo-switch">
          <input type="checkbox" checked={onScreen} onChange={(e) => setOnScreen(e.target.checked)} />
          <span className="pomo-switch-track" />
          <span>{tx("📌 Mostrar janela na tela inicial")}</span>
        </label>
      )}

      <div className="pomo-manage-row">
        {mode === 'create' ? (
          <>
            <button type="button" className="pomo-small-btn grow" disabled={secs <= 0} onClick={() => submit(true)}>
              {tx("▶ Criar e iniciar")}
            </button>
            <button type="button" className="pomo-ghost-btn" disabled={secs <= 0} onClick={() => submit(false)}>
              {tx("Criar")}
            </button>
          </>
        ) : (
          <button type="button" className="pomo-small-btn grow" disabled={secs <= 0} onClick={() => submit(false)}>
            {tx("Salvar")}
          </button>
        )}
        <button type="button" className="pomo-ghost-btn" onClick={onCancel}>
          {tx("Cancelar")}
        </button>
      </div>
    </div>
  );
}

// 4. CARD DE UM TIMER EXTRA (um Pomodoro independente)
function TimerCard({ timer, pomodoro, click }) {
  const { extraRemaining, startExtra, pauseExtra, resetExtra, editExtra, removeExtraPomodoro, setExtraOnScreen, modePresets, soundOption, testSound } = pomodoro;
  const [isEditing, setIsEditing] = useState(false);

  const isActive = timer.endAt != null;
  const ringing = timer.isAlarmRinging;
  const total = timer.initialTotalSeconds || 1500;
  const remaining = extraRemaining(timer);
  const state = ringing ? 'ringing' : isActive ? 'running' : 'paused';

  if (isEditing) {
    return (
      <TimerForm
        mode="edit"
        title={tx('Editar “{name}”', { name: timer.title })}
        initial={timer}
        presets={modePresets}
        defaultSound={soundOption}
        testSound={testSound}
        click={click}
        onSubmit={(values) => {
          click();
          editExtra(timer.id, values);
          setIsEditing(false);
        }}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <div className={`pomo-card ${state}`}>
      <div className="pomo-card-ring">
        <ProgressRing progress={ringing ? 1 : progressOf(remaining, total)} />
        <span className="pomo-card-ring-icon">{ringing ? '🔔' : timer.emoji || DEFAULT_TIMER_EMOJI}</span>
      </div>

      <div className="pomo-card-info">
        <span className="pomo-card-name" title={timer.title}>{timer.title}</span>
        <span className="pomo-card-time">{ringing ? tx("Acabou!") : formatSeconds(remaining)}</span>
        <span className="pomo-card-meta">
          {formatSeconds(total)} · {tx(SOUND_OPTIONS.find((o) => o.value === (timer.soundOption || 'clock'))?.label)}
        </span>
      </div>

      <div className="pomo-card-actions">
        <div className="pomo-card-controls">
          {ringing ? (
            <button
              type="button"
              className="pomo-mini-btn play alarm"
              title={tx("Desligar alarme")}
              onClick={() => {
                click();
                resetExtra(timer.id);
              }}
            >
              🔕
            </button>
          ) : isActive ? (
            <button
              type="button"
              className="pomo-mini-btn"
              title={tx("Pausar")}
              onClick={() => {
                click();
                pauseExtra(timer.id);
              }}
            >
              ⏸
            </button>
          ) : (
            <button
              type="button"
              className="pomo-mini-btn play"
              title={tx("Iniciar")}
              onClick={() => {
                click('train');
                startExtra(timer.id);
              }}
            >
              ▶
            </button>
          )}
          <button
            type="button"
            className="pomo-mini-btn"
            title={tx("Reiniciar")}
            onClick={() => {
              click('delete');
              resetExtra(timer.id);
            }}
          >
            ↺
          </button>
        </div>
        <div className="pomo-card-controls subtle">
          <button
            type="button"
            className={`pomo-mini-btn ghost pin ${timer.onScreen ? 'is-on' : ''}`}
            title={timer.onScreen ? tx("Tirar a janela da tela inicial") : tx("Mostrar janela na tela inicial")}
            onClick={() => {
              click();
              setExtraOnScreen(timer.id, !timer.onScreen);
            }}
          >
            📌
          </button>
          <button type="button" className="pomo-mini-btn ghost" title={tx("Editar nome, tempo e som")} onClick={() => setIsEditing(true)}>
            ✏️
          </button>
          <button
            type="button"
            className="pomo-mini-btn ghost danger"
            title={tx("Excluir timer")}
            onClick={() => {
              click('delete');
              removeExtraPomodoro(timer.id);
            }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// 4b. JANELA FLUTUANTE DE UM TIMER EXTRA (só aparece se você ativar o 📌,
//     ou enquanto o alarme dele estiver tocando)
function ExtraFloat({ timer, pomodoro, click }) {
  const { extraRemaining, startExtra, pauseExtra, resetExtra, setExtraOnScreen, updateExtraPomodoro, openTimersTab } = pomodoro;
  const position = timer.position || { x: 16, y: 16 };
  const { elRef, onPointerDown, movedRef } = useDraggable(position, (pos) => updateExtraPomodoro(timer.id, { position: pos }));

  const isActive = timer.endAt != null;
  const ringing = timer.isAlarmRinging;
  const total = timer.initialTotalSeconds || 1500;
  const remaining = extraRemaining(timer);
  const state = ringing ? 'ringing' : isActive ? 'running' : 'paused';

  return (
    <div
      ref={elRef}
      className={`pomo-float ${state}`}
      style={{ left: `${position.x}px`, top: `${position.y}px`, zIndex: 101 }}
      onPointerDown={onPointerDown}
      onClick={() => {
        if (movedRef.current) return;
        click();
        openTimersTab();
      }}
      title={tx("Clique para abrir · arraste para mover")}
    >
      <div className="pomo-float-head">
        <span className="pomo-float-title">{ringing ? '🔔' : timer.emoji || DEFAULT_TIMER_EMOJI} {timer.title}</span>
        {timer.onScreen && (
          <button
            type="button"
            className="pomo-mini-btn ghost danger"
            title={tx("Tirar da tela (o timer continua)")}
            onClick={(e) => {
              e.stopPropagation();
              click();
              setExtraOnScreen(timer.id, false);
            }}
          >
            ✕
          </button>
        )}
      </div>
      <div className="pomo-float-body">
        <span className="pomo-float-time">{ringing ? tx("Acabou!") : formatSeconds(remaining)}</span>
        <div className="pomo-float-controls" onClick={(e) => e.stopPropagation()}>
          {ringing ? (
            <button type="button" className="pomo-mini-btn play alarm" title={tx("Desligar alarme")} onClick={() => { click(); resetExtra(timer.id); }}>
              🔕
            </button>
          ) : isActive ? (
            <button type="button" className="pomo-mini-btn" title={tx("Pausar")} onClick={() => { click(); pauseExtra(timer.id); }}>
              ⏸
            </button>
          ) : (
            <button type="button" className="pomo-mini-btn play" title={tx("Iniciar")} onClick={() => { click('train'); startExtra(timer.id); }}>
              ▶
            </button>
          )}
          {!ringing && (
            <button type="button" className="pomo-mini-btn" title={tx("Reiniciar")} onClick={() => { click('delete'); resetExtra(timer.id); }}>
              ↺
            </button>
          )}
        </div>
      </div>
      <div className="pomo-float-bar" style={{ width: `${(ringing ? 1 : progressOf(remaining, total)) * 100}%` }} />
    </div>
  );
}

// 5. ABA "TIMERS"
function TimersTab({ pomodoro, click }) {
  const { extraTimers, addExtraPomodoro, isAddPanelOpen, setIsAddPanelOpen, modePresets, soundOption, testSound } = pomodoro;
  const runningCount = extraTimers.filter((t) => t.endAt != null).length;

  return (
    <div className="pomo-timers">
      {isAddPanelOpen ? (
        <TimerForm
          title={tx("Novo timer")}
          presets={modePresets}
          defaultSound={soundOption}
          testSound={testSound}
          click={click}
          onSubmit={(values) => {
            click(values.start ? 'train' : 'click');
            addExtraPomodoro(values);
            setIsAddPanelOpen(false);
          }}
          onCancel={() => setIsAddPanelOpen(false)}
        />
      ) : (
        <button
          type="button"
          className="pomo-add-timer"
          onClick={() => {
            click();
            setIsAddPanelOpen(true);
          }}
        >
          {tx("＋ Novo timer")}
        </button>
      )}

      {extraTimers.length === 0 ? (
        !isAddPanelOpen && (
          <div className="pomo-empty">
            <span className="pomo-empty-icon">🗂️</span>
            <p>{tx("Nenhum timer ainda.")}</p>
            <small>{tx("Cada timer tem nome, tempo e som próprios, e roda sozinho: iniciar um não mexe nos outros.")}</small>
          </div>
        )
      ) : (
        <>
          <div className="pomo-timers-summary">
            {extraTimers.length} {extraTimers.length === 1 ? 'timer' : 'timers'}
            {runningCount > 0 && <> · <strong>{runningCount} rodando</strong></>}
          </div>
          <div className="pomo-card-list">
            {extraTimers.map((timer) => (
              <TimerCard key={timer.id} timer={timer} pomodoro={pomodoro} click={click} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// 6. MODAL PRINCIPAL DO POMODORO
export function PomodoroModal({ pomodoro, playSound }) {
  const {
    isOpen,
    setIsOpen,
    isActive,
    mode,
    changeMode,
    modePresets,
    updateModePreset,
    addPreset,
    removePreset,
    soundOption,
    setSoundOption,
    testSound,
    isAlarmRinging,
    stopAlarm,
    startTimer,
    pauseTimer,
    resetTimer,
    formatTime,
    minutes,
    seconds,
    hours,
    targetTotalSeconds,
    updateCustomTime,
    extraTimers,
    ringingExtras,
    setIsAddPanelOpen,
    modalTab,
    setModalTab
  } = pomodoro;

  const [isEditingTime, setIsEditingTime] = useState(false);
  const [inputMin, setInputMin] = useState('45');
  const [inputSec, setInputSec] = useState('0');

  const [editingPresetId, setEditingPresetId] = useState(null);
  const [presetInputH, setPresetInputH] = useState('0');
  const [presetInputM, setPresetInputM] = useState('20');
  const [presetInputS, setPresetInputS] = useState('0');

  const [isManagingPresets, setIsManagingPresets] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetH, setNewPresetH] = useState('0');
  const [newPresetM, setNewPresetM] = useState('20');
  const [newPresetS, setNewPresetS] = useState('0');

  const click = (type = 'click') => {
    if (playSound) playSound(type);
  };

  const startEditing = () => {
    click();
    pauseTimer();
    setInputMin(String(hours * 60 + minutes));
    setInputSec(String(seconds));
    setIsEditingTime(true);
  };

  const handleSaveTime = () => {
    if (!isEditingTime) return;
    const m = Math.max(0, parseInt(inputMin, 10) || 0);
    const s = Math.min(59, Math.max(0, parseInt(inputSec, 10) || 0));
    updateCustomTime(m, s);
    setIsEditingTime(false);
  };

  const startPresetEdit = (preset) => {
    click();
    setEditingPresetId(preset.id);
    setPresetInputH(String(preset.hours || 0));
    setPresetInputM(String(preset.minutes || 0));
    setPresetInputS(String(preset.seconds || 0));
  };

  const handleSavePreset = (id) => {
    click();
    updateModePreset(id, presetInputH, presetInputM, presetInputS);
    setEditingPresetId(null);
  };

  const handleCreateNewPreset = () => {
    click();
    addPreset(newPresetName, newPresetH, newPresetM, newPresetS);
    setNewPresetName('');
    setNewPresetH('0');
    setNewPresetM('20');
    setNewPresetS('0');
  };

  const closeModal = () => {
    click();
    if (isEditingTime) handleSaveTime();
    if (isAlarmRinging) stopAlarm();
    setEditingPresetId(null);
    setIsManagingPresets(false);
    setIsAddPanelOpen(false);
    setIsOpen(false);
  };

  const switchTab = (tab) => {
    if (tab === modalTab) return;
    click();
    if (isEditingTime) handleSaveTime();
    setIsManagingPresets(false);
    setEditingPresetId(null);
    setIsAddPanelOpen(false);
    setModalTab(tab);
  };

  if (!isOpen) return null;

  const remaining = hours * 3600 + minutes * 60 + seconds;
  const progress = isAlarmRinging ? 1 : progressOf(remaining, targetTotalSeconds);
  const dialState = isAlarmRinging ? 'ringing' : isActive ? 'running' : 'paused';
  const timeLabel = formatTime();
  const runningExtras = extraTimers.filter((t) => t.endAt != null).length;

  return (
    <div className="modal-backdrop high-z-backdrop" onClick={closeModal}>
      <div className="modal-window pomodoro-modal-window high-z-window" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className="pomo-header">
          <h3>{tx("⏱️ Pomodoro")}</h3>
          <div className="pomo-header-actions">
            {modalTab === 'main' && (
              <button
                type="button"
                className={`pomo-icon-btn ${isManagingPresets ? 'is-on' : ''}`}
                onClick={() => {
                  click();
                  setIsManagingPresets((prev) => !prev);
                  setEditingPresetId(null);
                }}
                title={isManagingPresets ? tx("Concluir edição") : tx("Editar e criar botões de tempo")}
              >
                ✏️
              </button>
            )}
            <button type="button" className="pomo-icon-btn close" onClick={closeModal} title={tx("Fechar")}>
              ✕
            </button>
          </div>
        </div>

        {/* Abas */}
        <div className="pomo-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={modalTab === 'main'}
            className={`pomo-tab ${modalTab === 'main' ? 'active' : ''}`}
            onClick={() => switchTab('main')}
          >
            {tx("Principal")}
            {isActive && <span className="pomo-tab-dot" />}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modalTab === 'timers'}
            className={`pomo-tab ${modalTab === 'timers' ? 'active' : ''}`}
            onClick={() => switchTab('timers')}
          >
            {tx("Timers")}
            {extraTimers.length > 0 && (
              <span className={`pomo-tab-badge ${ringingExtras.length > 0 ? 'ringing' : runningExtras > 0 ? 'running' : ''}`}>
                {extraTimers.length}
              </span>
            )}
          </button>
        </div>

        {modalTab === 'timers' ? (
          <TimersTab pomodoro={pomodoro} click={click} />
        ) : (
          <>
            {/* Criar novo botão de tempo */}
            {isManagingPresets && (
              <div className="pomo-manage">
                <span className="pomo-manage-title">{tx("Novo botão de tempo")}</span>
                <div className="pomo-manage-row">
                  <input
                    className="pomo-input name"
                    type="text"
                    placeholder={tx("Nome (ex: Foco)")}
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                  />
                  <HmsInputs h={newPresetH} m={newPresetM} s={newPresetS} onH={setNewPresetH} onM={setNewPresetM} onS={setNewPresetS} />
                  <button type="button" className="pomo-small-btn" onClick={handleCreateNewPreset}>
                    {tx("Criar")}
                  </button>
                </div>
              </div>
            )}

            {/* Abas de modo */}
            <div className="pomo-modes">
              {modePresets.map((preset) => (
                <div key={preset.id} className="pomo-mode">
                  {isManagingPresets && modePresets.length > 1 && (
                    <button
                      type="button"
                      className="pomo-mode-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        click('delete');
                        removePreset(preset.id);
                      }}
                      title={tx("Remover este botão")}
                    >
                      ✕
                    </button>
                  )}

                  <button
                    type="button"
                    className={`pomodoro-mode-btn ${mode === preset.id ? 'active' : ''}`}
                    onClick={() => {
                      click();
                      setIsEditingTime(false);
                      changeMode(preset.id);
                    }}
                    title={formatSeconds(presetTotal(preset))}
                  >
                    {tx(preset.name)}
                  </button>

                  {isManagingPresets && (
                    <button
                      type="button"
                      className={`pomo-mode-edit ${editingPresetId === preset.id ? 'is-on' : ''}`}
                      onClick={() => startPresetEdit(preset)}
                      title={tx("Editar tempo deste botão")}
                    >
                      ✏️ {formatSeconds(presetTotal(preset))}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Edição do tempo de um botão existente */}
            {isManagingPresets && editingPresetId && (
              <div className="pomo-manage">
                <span className="pomo-manage-title">
                  {tx('Editar “{name}”', { name: tx(modePresets.find((p) => p.id === editingPresetId)?.name) })}
                </span>
                <div className="pomo-manage-row">
                  <HmsInputs
                    h={presetInputH}
                    m={presetInputM}
                    s={presetInputS}
                    onH={setPresetInputH}
                    onM={setPresetInputM}
                    onS={setPresetInputS}
                  />
                  <button type="button" className="pomo-small-btn" onClick={() => handleSavePreset(editingPresetId)}>
                    {tx("Salvar")}
                  </button>
                  <button type="button" className="pomo-mode-edit" onClick={() => setEditingPresetId(null)}>
                    {tx("Cancelar")}
                  </button>
                </div>
              </div>
            )}

            {/* Anel do timer */}
            <div className={`pomo-dial ${dialState}`}>
              <ProgressRing progress={progress} />

              <div className="pomo-dial-center">
                {isEditingTime ? (
                  <>
                    <div className="timer-edit-row">
                      <input
                        type="number"
                        className="timer-edit-input"
                        value={inputMin}
                        onChange={(e) => setInputMin(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveTime()}
                        autoFocus
                        min="0"
                        max="999"
                        aria-label={tx("Minutos")}
                      />
                      <span className="timer-colon">:</span>
                      <input
                        type="number"
                        className="timer-edit-input"
                        value={inputSec}
                        onChange={(e) => setInputSec(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveTime()}
                        min="0"
                        max="59"
                        aria-label={tx("Segundos")}
                      />
                    </div>
                    <button
                      type="button"
                      className="pomo-small-btn"
                      onClick={() => {
                        click();
                        handleSaveTime();
                      }}
                    >
                      {tx("✓ Salvar")}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`timer-text editable ${isAlarmRinging ? 'ringing' : ''} ${timeLabel.length > 5 ? 'long' : ''}`}
                      onClick={startEditing}
                      title={tx("Clique para editar o tempo")}
                    >
                      {isAlarmRinging ? tx("Acabou!") : timeLabel}
                    </button>
                    <span className={`timer-status-tag ${dialState}`}>
                      <span className="dot" />
                      {isAlarmRinging ? tx("Tempo esgotado") : isActive ? tx("Em andamento") : tx("Pausado")}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Controles */}
            <div className="pomodoro-controls-row">
              {isAlarmRinging ? (
                <button
                  type="button"
                  className="pomo-primary alarm"
                  onClick={() => {
                    click();
                    stopAlarm();
                  }}
                >
                  {tx("🔕 Desligar alarme")}
                </button>
              ) : isActive ? (
                <button
                  type="button"
                  className="pomo-primary pause"
                  onClick={() => {
                    click();
                    pauseTimer();
                  }}
                >
                  {tx("⏸ Pausar")}
                </button>
              ) : (
                <button
                  type="button"
                  className="pomo-primary"
                  onClick={() => {
                    click('train');
                    if (isEditingTime) handleSaveTime();
                    startTimer();
                  }}
                >
                  {tx("▶ Iniciar")}
                </button>
              )}

              <button
                type="button"
                className="pomo-secondary"
                onClick={() => {
                  click('delete');
                  setIsEditingTime(false);
                  resetTimer();
                }}
                title={tx("Reiniciar")}
              >
                ↺
              </button>
            </div>

            {/* Som do alarme */}
            <div className="pomo-footer">
              <span>{tx("🔊 Alarme")}</span>
              <select
                className="pomodoro-select-input"
                value={soundOption}
                onChange={(e) => {
                  setSoundOption(e.target.value);
                  testSound(e.target.value);
                }}
              >
                {SOUND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{tx(opt.label)}</option>
                ))}
              </select>
              <button type="button" className="pomo-icon-btn" onClick={() => testSound(soundOption)} title={tx("Testar som")}>
                ▶
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// 7. MINI-WIDGET FLUTUANTE
export function PomodoroWidget({ pomodoro, playSound }) {
  const {
    isOpen,
    setIsOpen,
    formatTime,
    isActive,
    startTimer,
    pauseTimer,
    resetTimer,
    isAlarmRinging,
    stopAlarm,
    mode,
    modePresets,
    hours,
    minutes,
    seconds,
    targetTotalSeconds,
    handleButtonContextMenu,
    contextMenu,
    closeContextMenu,
    setModalTab,
    extraTimers,
    widgetVisible,
    setWidgetVisible,
    widgetPosition: position,
    setWidgetPosition
  } = pomodoro;

  const { elRef, onPointerDown, movedRef } = useDraggable(position, setWidgetPosition);

  const click = (type = 'click') => {
    if (playSound) playSound(type);
  };

  const modeName = tx(modePresets.find((p) => p.id === mode)?.name || 'Personalizado');
  const remaining = hours * 3600 + minutes * 60 + seconds;
  const progress = isAlarmRinging ? 1 : progressOf(remaining, targetTotalSeconds);
  // Timers extras rodando que não têm janela própria na tela
  const hiddenRunningExtras = extraTimers.filter((t) => t.endAt != null && !t.onScreen).length;
  const stateClass = isAlarmRinging ? 'ringing' : isActive ? 'running' : 'paused';
  // Só aparece depois de iniciar um Pomodoro (ou, se foi fechado no ✕, enquanto o alarme toca)
  const showMain = (widgetVisible || isAlarmRinging) && !isOpen;
  const floatingExtras = isOpen ? [] : extraTimers.filter((t) => t.onScreen || t.isAlarmRinging);

  return (
    <>
      {showMain && (
        <div
          ref={elRef}
          className={`pomo-float ${stateClass}`}
          style={{ left: `${position.x}px`, top: `${position.y}px`, zIndex: 100 }}
          onPointerDown={onPointerDown}
          onContextMenu={handleButtonContextMenu}
          onClick={() => {
            // Um clique (sem arrastar) abre o Pomodoro na aba certa
            if (movedRef.current) return;
            click();
            if (isAlarmRinging) stopAlarm();
            setModalTab('main');
            setIsOpen(true);
          }}
          title={tx("Clique para abrir · arraste para mover · botão direito para criar um timer")}
        >
          <div className="pomo-float-head">
            <span className="pomo-float-title">⏱️ {modeName}</span>
            {hiddenRunningExtras > 0 && (
              <span className="pomo-float-badge" title={tx('{n} timer(s) rodando sem janela na tela', { n: hiddenRunningExtras })}>
                +{hiddenRunningExtras}
              </span>
            )}
            <button
              type="button"
              className="pomo-mini-btn ghost danger"
              title={tx("Tirar da tela (abra o Pomodoro para mostrar de novo)")}
              onClick={(e) => {
                e.stopPropagation();
                click();
                setWidgetVisible(false);
              }}
            >
              ✕
            </button>
          </div>
          <div className="pomo-float-body">
            <span className="pomo-float-time">{isAlarmRinging ? tx("🔔 Acabou!") : formatTime()}</span>
            <div className="pomo-float-controls" onClick={(e) => e.stopPropagation()}>
              {isAlarmRinging ? (
                <button
                  type="button"
                  className="pomo-mini-btn play alarm"
                  title={tx("Desligar alarme")}
                  onClick={() => {
                    click();
                    stopAlarm();
                  }}
                >
                  🔕
                </button>
              ) : isActive ? (
                <button
                  type="button"
                  className="pomo-mini-btn"
                  title={tx("Pausar")}
                  onClick={() => {
                    click();
                    pauseTimer();
                  }}
                >
                  ⏸
                </button>
              ) : (
                <button
                  type="button"
                  className="pomo-mini-btn play"
                  title={tx("Iniciar")}
                  onClick={() => {
                    click('train');
                    startTimer();
                  }}
                >
                  ▶
                </button>
              )}
              {!isAlarmRinging && (
                <button
                  type="button"
                  className="pomo-mini-btn"
                  title={tx("Reiniciar")}
                  onClick={() => {
                    click('delete');
                    resetTimer();
                  }}
                >
                  ↺
                </button>
              )}
            </div>
          </div>
          <div className="pomo-float-bar" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      {/* Janelas dos timers extras que você ativou com 📌 */}
      {floatingExtras.map((timer) => (
        <ExtraFloat key={timer.id} timer={timer} pomodoro={pomodoro} click={click} />
      ))}

      {/* Menu do Botão Direito */}
      <PomodoroContextMenu
        contextMenu={contextMenu}
        closeContextMenu={closeContextMenu}
        onAdd={() => openTimersTab({ create: true })}
      />
    </>
  );
}
