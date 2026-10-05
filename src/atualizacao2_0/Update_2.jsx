import React, { useState, useRef, useEffect } from 'react';
import './Update_2.css';
import { playWebAudioAlarm } from './Update_2';

// 1. BOTÃO DO POMODORO NA TELA PRINCIPAL
export function PomodoroIconButton({ pomodoro, playSound }) {
  const { toggleModal, handleButtonContextMenu } = pomodoro;

  return (
    <button
      type="button"
      className="pomodoro-app-icon-btn"
      onClick={() => {
        if (playSound) playSound('click');
        toggleModal();
      }}
      onContextMenu={handleButtonContextMenu}
      title="Clique com botão esquerdo para abrir / Clique com botão direito para 'Adicionar Pomodoro'"
      style={{
        width: '70px',
        height: '70px',
        borderRadius: '18px',
        background: '#131927',
        border: '1.5px solid #d97706',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        transition: 'transform 0.15s ease, border-color 0.15s ease',
        outline: 'none',
        position: 'relative'
      }}
    >
      <span style={{ fontSize: '2rem' }}>⏱️</span>
    </button>
  );
}

// 2. MENU DE CONTEXTO (CLIQUE DIREITO)
export function PomodoroContextMenu({ contextMenu, closeContextMenu, addExtraPomodoro }) {
  useEffect(() => {
    const handleClickOutside = () => closeContextMenu();
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [closeContextMenu]);

  if (!contextMenu.visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: `${contextMenu.y}px`,
        left: `${contextMenu.x}px`,
        zIndex: 9999,
        background: '#0f172a',
        border: '1px solid #334155',
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
        padding: '4px 0',
        minWidth: '160px'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        style={{
          width: '100%',
          textAlign: 'left',
          background: 'none',
          border: 'none',
          color: '#f8fafc',
          padding: '8px 14px',
          fontSize: '0.85rem',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'background 0.2s ease'
        }}
        onMouseEnter={(e) => (e.target.style.background = 'rgba(56, 189, 248, 0.15)')}
        onMouseLeave={(e) => (e.target.style.background = 'none')}
        onClick={() => {
          addExtraPomodoro();
        }}
      >
        Adicionar Pomodoro
      </button>
    </div>
  );
}

// 3. WIDGET DE POMODORO SUSPENSO ADICIONAL (Customizável no Ecrã)
export function ExtraPomodoroWidget({ timer, removeExtraPomodoro, updateExtraPomodoro }) {
  const { id, title, hours, minutes, seconds, totalSeconds, isActive, isAlarmRinging, soundOption, position } = timer;

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editH, setEditH] = useState(String(hours));
  const [editM, setEditM] = useState(String(minutes));
  const [editS, setEditS] = useState(String(seconds));

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const timerIntervalRef = useRef(null);
  const alarmIntervalRef = useRef(null);

  const handleMouseDown = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      updateExtraPomodoro(id, {
        position: {
          x: e.clientX - dragStartRef.current.x,
          y: e.clientY - dragStartRef.current.y
        }
      });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [id, position, updateExtraPomodoro]);

  useEffect(() => {
    if (!isActive) {
      clearInterval(timerIntervalRef.current);
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      if (totalSeconds <= 1) {
        clearInterval(timerIntervalRef.current);
        updateExtraPomodoro(id, { isActive: false, isAlarmRinging: true, totalSeconds: 0 });
      } else {
        updateExtraPomodoro(id, { totalSeconds: totalSeconds - 1 });
      }
    }, 1000);

    return () => clearInterval(timerIntervalRef.current);
  }, [isActive, totalSeconds, id, updateExtraPomodoro]);

  useEffect(() => {
    if (isAlarmRinging) {
      playWebAudioAlarm(soundOption);
      alarmIntervalRef.current = setInterval(() => {
        playWebAudioAlarm(soundOption);
      }, 1000);
    } else {
      clearInterval(alarmIntervalRef.current);
    }
    return () => clearInterval(alarmIntervalRef.current);
  }, [isAlarmRinging, soundOption]);

  const handleSaveEdit = () => {
    const h = Math.max(0, parseInt(editH, 10) || 0);
    const m = Math.max(0, parseInt(editM, 10) || 0);
    const s = Math.min(59, Math.max(0, parseInt(editS, 10) || 0));
    const total = h * 3600 + m * 60 + s;

    updateExtraPomodoro(id, {
      title: editTitle || 'Pomodoro',
      hours: h,
      minutes: m,
      seconds: s,
      totalSeconds: total,
      initialTotalSeconds: total
    });
    setIsEditing(false);
  };

  const stopAlarm = () => {
    updateExtraPomodoro(id, { isAlarmRinging: false, totalSeconds: timer.initialTotalSeconds || 1500 });
  };

  const currH = Math.floor(totalSeconds / 3600);
  const currM = Math.floor((totalSeconds % 3600) / 60);
  const currS = totalSeconds % 60;

  const formattedDisplay = () => {
    const mStr = String(currM).padStart(2, '0');
    const sStr = String(currS).padStart(2, '0');
    if (currH > 0) {
      return `${String(currH).padStart(2, '0')}:${mStr}:${sStr}`;
    }
    return `${mStr}:${sStr}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 500,
        background: '#0e1626',
        border: isAlarmRinging ? '2px solid #ef4444' : isActive ? '2px solid #34d399' : '2px solid #38bdf8',
        borderRadius: '14px',
        padding: '8px 12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        minWidth: '180px',
        color: '#fff',
        userSelect: 'none',
        cursor: 'grab'
      }}
      onMouseDown={handleMouseDown}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#38bdf8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          ⏱️ {title}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setIsEditing((prev) => !prev)}
            title="Editar tempo e nome"
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.75rem' }}
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={() => removeExtraPomodoro(id)}
            title="Remover Pomodoro Suspenso"
            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      </div>

      {isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(0,0,0,0.4)', padding: '6px', borderRadius: '8px' }}>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Nome do Timer"
            style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#fff', fontSize: '0.75rem', padding: '2px 4px' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'center' }}>
            <input type="number" value={editH} onChange={(e) => setEditH(e.target.value)} min="0" style={{ width: '28px', fontSize: '0.7rem', textAlign: 'center' }} />
            <span style={{ fontSize: '0.65rem' }}>h</span>
            <input type="number" value={editM} onChange={(e) => setEditM(e.target.value)} min="0" max="59" style={{ width: '28px', fontSize: '0.7rem', textAlign: 'center' }} />
            <span style={{ fontSize: '0.65rem' }}>m</span>
            <input type="number" value={editS} onChange={(e) => setEditS(e.target.value)} min="0" max="59" style={{ width: '28px', fontSize: '0.7rem', textAlign: 'center' }} />
            <span style={{ fontSize: '0.65rem' }}>s</span>
            <button type="button" onClick={handleSaveEdit} style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer', fontWeight: 'bold' }}>✓</button>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: '800', color: isAlarmRinging ? '#ef4444' : '#fff' }}>
          {isAlarmRinging ? '🚨 ESGOTADO!' : formattedDisplay()}
        </div>
      )}

      {isAlarmRinging && (
        <button
          type="button"
          onClick={stopAlarm}
          style={{ background: '#ef4444', border: 'none', borderRadius: '6px', color: '#fff', padding: '4px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
        >
          🔔 Desligar
        </button>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '4px' }}>
        {!isActive ? (
          <button
            type="button"
            onClick={() => {
              if (isAlarmRinging) stopAlarm();
              updateExtraPomodoro(id, { isActive: true });
            }}
            style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            ▶
          </button>
        ) : (
          <button
            type="button"
            onClick={() => updateExtraPomodoro(id, { isActive: false })}
            style={{ background: 'none', border: 'none', color: '#facc15', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            ⏸
          </button>
        )}
        <button
          type="button"
          onClick={() => updateExtraPomodoro(id, { isActive: false, isAlarmRinging: false, totalSeconds: timer.initialTotalSeconds || 1500 })}
          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem' }}
        >
          ⏹
        </button>
      </div>
    </div>
  );
}

// 4. MODAL PRINCIPAL DO POMODORO
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
    minutes,
    seconds,
    hours,
    updateCustomTime,
    addExtraPomodoro
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

  const startEditing = () => {
    if (playSound) playSound('click');
    pauseTimer();
    const totalMins = hours * 60 + minutes;
    setInputMin(String(totalMins));
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
    if (playSound) playSound('click');
    setEditingPresetId(preset.id);
    setPresetInputH(String(preset.hours || 0));
    setPresetInputM(String(preset.minutes || 0));
    setPresetInputS(String(preset.seconds || 0));
  };

  const handleSavePreset = (id) => {
    if (playSound) playSound('click');
    updateModePreset(id, presetInputH, presetInputM, presetInputS);
    setEditingPresetId(null);
  };

  const handleCreateNewPreset = () => {
    if (playSound) playSound('click');
    addPreset(newPresetName, newPresetH, newPresetM, newPresetS);
    setNewPresetName('');
    setNewPresetH('0');
    setNewPresetM('20');
    setNewPresetS('0');
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop high-z-backdrop"
      onClick={() => {
        if (playSound) playSound('click');
        if (isEditingTime) handleSaveTime();
        if (isAlarmRinging) stopAlarm();
        setEditingPresetId(null);
        setIsManagingPresets(false);
        setIsOpen(false);
      }}
    >
      <div
        className="modal-window pomodoro-modal-window high-z-window"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho com Lápis, Botão + (Sem cor) e Fechar */}
        <div className="modal-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3>⏱ Pomodoro</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {/* Ícone de Lápis */}
            <button
              className="close-popup-btn"
              onClick={() => {
                if (playSound) playSound('click');
                setIsManagingPresets((prev) => {
                  if (prev) setEditingPresetId(null);
                  return !prev;
                });
              }}
              title={isManagingPresets ? 'Concluir edição' : 'Gerenciar e criar novos botões de pré-definição'}
              style={{
                fontSize: '0.95rem',
                padding: '0.2rem 0.4rem',
                color: isManagingPresets ? '#38bdf8' : '#94a3b8',
                background: isManagingPresets ? 'rgba(56, 189, 248, 0.15)' : 'none',
                borderRadius: '6px'
              }}
            >
              ✏️
            </button>

            {/* Ícone de + (sem cor) ao lado do lápis para abrir novos Pomodoros suspensos */}
            <button
              className="close-popup-btn"
              onClick={() => {
                if (playSound) playSound('click');
                addExtraPomodoro();
              }}
              title="Adicionar novo Pomodoro suspenso no ecrã"
              style={{
                fontSize: '1.2rem',
                fontWeight: 'bold',
                padding: '0.2rem 0.4rem',
                color: '#94a3b8',
                background: 'none',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                lineHeight: 1
              }}
            >
              +
            </button>

            {/* Ícone de Fechar (X) */}
            <button
              className="close-popup-btn"
              onClick={() => {
                if (playSound) playSound('click');
                if (isEditingTime) handleSaveTime();
                if (isAlarmRinging) stopAlarm();
                setEditingPresetId(null);
                setIsManagingPresets(false);
                setIsOpen(false);
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Painel de criar novo botão de pré-definição (Ativado pelo Lápis do Cabeçalho) */}
        {isManagingPresets && (
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px dashed var(--theme-accent, #38bdf8)',
              borderRadius: '10px',
              padding: '0.6rem 0.8rem',
              marginTop: '0.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              textAlign: 'left'
            }}
          >
            <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#38bdf8' }}>
              ➕ Criar Novo Botão de Pré-definição
            </span>
            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Nome (ex: Foco)"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                style={{
                  flex: '1 1 110px',
                  minWidth: '90px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '0.3rem 0.4rem',
                  fontSize: '0.78rem',
                  outline: 'none'
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <input
                  type="number"
                  placeholder="0"
                  value={newPresetH}
                  onChange={(e) => setNewPresetH(e.target.value)}
                  min="0"
                  max="99"
                  style={{
                    width: '36px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '0.3rem 0.2rem',
                    fontSize: '0.78rem',
                    textAlign: 'center',
                    outline: 'none'
                  }}
                />
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>h</span>

                <input
                  type="number"
                  placeholder="20"
                  value={newPresetM}
                  onChange={(e) => setNewPresetM(e.target.value)}
                  min="0"
                  max="59"
                  style={{
                    width: '36px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '0.3rem 0.2rem',
                    fontSize: '0.78rem',
                    textAlign: 'center',
                    outline: 'none'
                  }}
                />
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>m</span>

                <input
                  type="number"
                  placeholder="0"
                  value={newPresetS}
                  onChange={(e) => setNewPresetS(e.target.value)}
                  min="0"
                  max="59"
                  style={{
                    width: '36px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '0.3rem 0.2rem',
                    fontSize: '0.78rem',
                    textAlign: 'center',
                    outline: 'none'
                  }}
                />
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>s</span>
              </div>
              <button
                type="button"
                className="confirm-button"
                onClick={handleCreateNewPreset}
                style={{
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.78rem',
                  fontWeight: 'bold',
                  borderRadius: '6px'
                }}
              >
                + Criar
              </button>
            </div>
          </div>
        )}

        {/* Lista de Botões de Pré-definição */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            justifyContent: 'center',
            marginTop: '0.6rem'
          }}
        >
          {modePresets.map((preset) => {
            const isSelected = mode === preset.id;
            return (
              <div
                key={preset.id}
                style={{
                  flex: '1 1 28%',
                  minWidth: '95px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.2rem',
                  position: 'relative'
                }}
              >
                {/* X para apagar pré-definição */}
                {isManagingPresets && modePresets.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (playSound) playSound('delete');
                      removePreset(preset.id);
                    }}
                    title="Remover este botão"
                    style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-4px',
                      background: '#ef4444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      fontSize: '0.65rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2,
                      boxShadow: '0 2px 5px rgba(0,0,0,0.4)'
                    }}
                  >
                    ✕
                  </button>
                )}

                <button
                  type="button"
                  className={`pomodoro-mode-btn ${isSelected ? 'active' : ''}`}
                  style={{ width: '100%' }}
                  onClick={() => {
                    if (playSound) playSound('click');
                    setIsEditingTime(false);
                    changeMode(preset.id);
                  }}
                >
                  {preset.name}
                </button>

                {/* Ícone de lápis / Edição abaixo dos botões */}
                {isManagingPresets && (
                  editingPresetId === preset.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <input
                        type="number"
                        value={presetInputH}
                        onChange={(e) => setPresetInputH(e.target.value)}
                        min="0"
                        max="99"
                        style={{
                          width: '30px',
                          fontSize: '0.7rem',
                          textAlign: 'center',
                          background: 'rgba(0,0,0,0.5)',
                          border: '1px solid var(--theme-accent, #38bdf8)',
                          borderRadius: '4px',
                          color: '#fff',
                          outline: 'none',
                          padding: '1px'
                        }}
                      />
                      <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>h</span>

                      <input
                        type="number"
                        value={presetInputM}
                        onChange={(e) => setPresetInputM(e.target.value)}
                        min="0"
                        max="59"
                        style={{
                          width: '30px',
                          fontSize: '0.7rem',
                          textAlign: 'center',
                          background: 'rgba(0,0,0,0.5)',
                          border: '1px solid var(--theme-accent, #38bdf8)',
                          borderRadius: '4px',
                          color: '#fff',
                          outline: 'none',
                          padding: '1px'
                        }}
                      />
                      <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>m</span>

                      <input
                        type="number"
                        value={presetInputS}
                        onChange={(e) => setPresetInputS(e.target.value)}
                        min="0"
                        max="59"
                        style={{
                          width: '30px',
                          fontSize: '0.7rem',
                          textAlign: 'center',
                          background: 'rgba(0,0,0,0.5)',
                          border: '1px solid var(--theme-accent, #38bdf8)',
                          borderRadius: '4px',
                          color: '#fff',
                          outline: 'none',
                          padding: '1px'
                        }}
                      />
                      <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>s</span>

                      <button
                        type="button"
                        onClick={() => handleSavePreset(preset.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#34d399',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                          padding: '0 2px'
                        }}
                      >
                        ✓
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startPresetEdit(preset)}
                      title="Editar tempo deste botão"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        padding: '1px 4px',
                        opacity: 0.75
                      }}
                    >
                      ✏️
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>

        {/* Display do Tempo */}
        <div className="pomodoro-timer-display">
          {isEditingTime ? (
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
              />
              <button
                type="button"
                className="timer-save-btn"
                onClick={() => {
                  if (playSound) playSound('click');
                  handleSaveTime();
                }}
                title="Salvar tempo"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#34d399',
                  fontSize: '1.8rem',
                  cursor: 'pointer',
                  marginLeft: '0.4rem',
                  lineHeight: 1
                }}
              >
                ✓
              </button>
            </div>
          ) : (
            <span
              className="timer-text editable"
              onClick={startEditing}
              title="Clique para editar o tempo"
            >
              {isAlarmRinging ? 'Pomodoro!' : formatTime()}
            </span>
          )}

          <span className="timer-status-tag" style={{ color: isAlarmRinging ? '#f87171' : undefined }}>
            {isAlarmRinging
              ? '🚨 TEMPO ESGOTADO!'
              : isActive
              ? '● EM ANDAMENTO'
              : isEditingTime
              ? 'Digite o tempo e clique em ✓ ou ENTER'
              : 'PAUSADO (Clique no número para editar)'}
          </span>
        </div>

        {isAlarmRinging && (
          <div style={{ marginBottom: '1rem' }}>
            <button
              type="button"
              className="confirm-button"
              style={{
                width: '100%',
                padding: '0.9rem',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                boxShadow: '0 0 15px rgba(220, 38, 38, 0.6)'
              }}
              onClick={() => {
                if (playSound) playSound('click');
                stopAlarm();
              }}
            >
              🔔 Desligar Alarme
            </button>
          </div>
        )}

        <div className="pomodoro-controls-row">
          {!isActive ? (
            <button
              type="button"
              className="confirm-button pomodoro-action-btn"
              onClick={() => {
                if (playSound) playSound('train');
                if (isEditingTime) handleSaveTime();
                startTimer();
              }}
            >
              ▶ Iniciar
            </button>
          ) : (
            <button
              type="button"
              className="cancel-button pomodoro-action-btn pause"
              onClick={() => {
                if (playSound) playSound('click');
                pauseTimer();
              }}
            >
              ⏸ Pausar
            </button>
          )}

          <button
            type="button"
            className="cancel-button pomodoro-action-btn"
            onClick={() => {
              if (playSound) playSound('delete');
              setIsEditingTime(false);
              resetTimer();
            }}
          >
            Resetar
          </button>
        </div>

        {/* Som do Alarme */}
        <div className="pomodoro-sound-option">
          <label className="pomodoro-sound-label">
            <span>🔊 Som do Alarme:</span>
            <select
              className="pomodoro-select-input"
              value={soundOption}
              onChange={(e) => {
                const newSound = e.target.value;
                setSoundOption(newSound);
                testSound(newSound);
              }}
            >
              <option value="clock">Timer</option>
              <option value="digital">Bip Grave (Triplo)</option>
              <option value="bell">Sino Resonante</option>
              <option value="arcade">Arcade 8-Bit</option>
            </select>
          </label>
          <button
            type="button"
            className="sound-test-btn"
            onClick={() => testSound(soundOption)}
            title="Testar som do alarme"
          >
            🔊 Testar
          </button>
        </div>

        <div className="pomodoro-pin-option">
          <label className="pomodoro-checkbox-label">
            <input
              type="checkbox"
              checked={pinOnScreen}
              onChange={(e) => {
                if (playSound) playSound('click');
                setPinOnScreen(e.target.checked);
              }}
            />
            <span>Manter mini-widget visível no ecrã inicial</span>
          </label>
        </div>

        <div className="modal-actions-bar">
          <button
            className="confirm-button"
            onClick={() => {
              if (playSound) playSound('click');
              if (isEditingTime) handleSaveTime();
              if (isAlarmRinging) stopAlarm();
              setEditingPresetId(null);
              setIsManagingPresets(false);
              setIsOpen(false);
            }}
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
}

// 5. MINI-WIDGET FLUTUANTE + GERENCIADOR
export function PomodoroWidget({ pomodoro, playSound }) {
  const {
    pinOnScreen,
    isOpen,
    toggleModal,
    formatTime,
    isActive,
    startTimer,
    pauseTimer,
    resetTimer,
    isAlarmRinging,
    stopAlarm,
    handleButtonContextMenu,
    contextMenu,
    closeContextMenu,
    addExtraPomodoro,
    extraTimers,
    removeExtraPomodoro,
    updateExtraPomodoro
  } = pomodoro;

  const [position, setPosition] = useState({ x: 24, y: 24 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  const handleMouseDown = (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      hasMovedRef.current = true;
      setPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <>
      {pinOnScreen && !isOpen && (
        <div
          className={`pomodoro-floating-widget ${isAlarmRinging ? 'ringing' : isActive ? 'running' : 'paused'}`}
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            bottom: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '6px 14px',
            background: '#0e1626',
            border: isAlarmRinging ? '2px solid #f87171' : isActive ? '2px solid #34d399' : '2px solid #38bdf8',
            borderRadius: '16px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.6)',
            position: 'fixed',
            zIndex: 100,
            userSelect: 'none',
            cursor: 'grab'
          }}
          onMouseDown={handleMouseDown}
          onContextMenu={handleButtonContextMenu}
          title="Clique com botão direito para 'Adicionar Pomodoro'"
        >
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            onClick={() => {
              if (!hasMovedRef.current) {
                if (playSound) playSound('click');
                if (isAlarmRinging) stopAlarm();
                toggleModal();
              }
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>{isAlarmRinging ? '🔔' : '⏱️'}</span>
            <span
              style={{
                fontFamily: 'system-ui, monospace',
                fontSize: isAlarmRinging ? '1rem' : '1.15rem',
                fontWeight: '800',
                color: isAlarmRinging ? '#f87171' : '#f8fafc'
              }}
            >
              {isAlarmRinging ? 'Pomodoro!' : formatTime()}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              width: '100%',
              borderTop: '1px solid rgba(255, 255, 255, 0.15)',
              paddingTop: '4px',
              marginTop: '2px'
            }}
          >
            {!isActive ? (
              <button
                type="button"
                title="Iniciar"
                style={{ background: 'none', border: 'none', color: '#34d399', fontSize: '0.95rem', cursor: 'pointer', padding: 0 }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (playSound) playSound('train');
                  startTimer();
                }}
              >
                ▶
              </button>
            ) : (
              <button
                type="button"
                title="Pausar"
                style={{ background: 'none', border: 'none', color: '#facc15', fontSize: '0.95rem', cursor: 'pointer', padding: 0 }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (playSound) playSound('click');
                  pauseTimer();
                }}
              >
                ⏸
              </button>
            )}

            <button
              type="button"
              title="Resetar"
              style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.95rem', cursor: 'pointer', padding: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                if (playSound) playSound('delete');
                resetTimer();
              }}
            >
              ⏹
            </button>
          </div>
        </div>
      )}

      {/* Menu do Botão Direito */}
      <PomodoroContextMenu
        contextMenu={contextMenu}
        closeContextMenu={closeContextMenu}
        addExtraPomodoro={addExtraPomodoro}
      />

      {/* Lista de Pomodoros Suspensos Extras */}
      {extraTimers.map((timer) => (
        <ExtraPomodoroWidget
          key={timer.id}
          timer={timer}
          removeExtraPomodoro={removeExtraPomodoro}
          updateExtraPomodoro={updateExtraPomodoro}
        />
      ))}
    </>
  );
}