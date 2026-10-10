import React, { useState } from 'react';

export function EditMissionsModal({
  isOpen,
  onClose,
  skills,
  dailyMissionsQuota,
  setDailyMissionsQuota,
  prioritizedMissions,
  togglePrioritizeMission,
  updateMiniMissionText,
  playSound
}) {
  const [editingKey, setEditingKey] = useState(null);
  const [tempText, setTempText] = useState('');

  if (!isOpen) return null;

  const handleStartEdit = (skillId, idx, currentText) => {
    if (playSound) playSound('click');
    setEditingKey(`${skillId}_mm_${idx}`);
    setTempText(currentText);
  };

  const handleSaveEdit = (skillId, oldText) => {
    if (tempText.trim() && tempText.trim() !== oldText.trim()) {
      if (playSound) playSound('train');
      if (updateMiniMissionText) {
        updateMiniMissionText(skillId, oldText, tempText.trim());
      }
    }
    setEditingKey(null);
  };

  return (
    <div className="modal-backdrop high-z-backdrop" onClick={onClose}>
      <div
        className="modal-window high-z-window"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '680px', width: '92vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-header-row">
          <h3>Editor de Missões Diárias</h3>
          <button className="close-popup-btn" onClick={onClose}>✕</button>
        </div>

        {/* PAINEL DE AJUSTE DA QUANTIDADE DIÁRIA */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.3)',
            padding: '0.8rem 1rem',
            borderRadius: '8px',
            border: '1px solid var(--theme-border, #334155)',
            margin: '0.8rem 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <strong style={{ fontSize: '0.9rem', color: '#f8fafc' }}>Quantidade de Missões por Dia:</strong>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
              Defina quantas missões serão geradas diariamente.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="cancel-button"
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.9rem', fontWeight: 'bold' }}
              onClick={() => {
                if (playSound) playSound('click');
                setDailyMissionsQuota(Math.max(1, dailyMissionsQuota - 1));
              }}
            >
              -
            </button>
            <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--theme-accent, #38bdf8)', minWidth: '24px', textAlign: 'center' }}>
              {dailyMissionsQuota}
            </span>
            <button
              type="button"
              className="confirm-button"
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.9rem', fontWeight: 'bold', background: 'var(--theme-accent, #38bdf8)' }}
              onClick={() => {
                if (playSound) playSound('click');
                setDailyMissionsQuota(Math.min(20, dailyMissionsQuota + 1));
              }}
            >
              +
            </button>
          </div>
        </div>

        <span className="card-section-label" style={{ marginBottom: '0.5rem', color: 'var(--theme-accent, #38bdf8)', fontWeight: 'bold' }}>
          TODAS AS MINI MISSÕES CADASTRADAS:
        </span>

        {/* LISTA DE MINI MISSÕES */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingRight: '0.3rem' }}>
          {skills.flatMap((skill) =>
            (skill.miniMissions || []).map((text, idx) => {
              const itemKey = `${skill.id}___${text.trim()}`;
              const isPrioritized = (prioritizedMissions || []).includes(itemKey);
              const cardEditingKey = `${skill.id}_mm_${idx}`;
              const isEditing = editingKey === cardEditingKey;

              return (
                <div
                  key={`${skill.id}_mm_${idx}`}
                  style={{
                    background: isPrioritized ? 'rgba(234, 179, 8, 0.08)' : 'rgba(0, 0, 0, 0.25)',
                    border: isPrioritized ? '1px solid #eab308' : '1px solid var(--theme-border, rgba(255, 255, 255, 0.1))',
                    borderRadius: '8px',
                    padding: '0.65rem 0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.8rem'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
                    {/* HABILIDADE DE ORIGEM */}
                    <span style={{ fontSize: '0.82rem', color: 'var(--theme-accent, #38bdf8)', fontWeight: 'bold' }}>
                      {skill.title || skill.name}
                    </span>

                    {/* TEXTO DA MISSÃO / EDIÇÃO INLINE */}
                    {isEditing ? (
                      <input
                        type="text"
                        value={tempText}
                        onChange={(e) => setTempText(e.target.value)}
                        onBlur={() => handleSaveEdit(skill.id, text)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(skill.id, text);
                          if (e.key === 'Escape') setEditingKey(null);
                        }}
                        autoFocus
                        style={{
                          width: '95%',
                          padding: '0.35rem 0.6rem',
                          background: 'rgba(0, 0, 0, 0.5)',
                          border: '1px solid var(--theme-accent, #38bdf8)',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '0.88rem',
                          marginTop: '0.2rem'
                        }}
                      />
                    ) : (
                      <span
                        onClick={() => handleStartEdit(skill.id, idx, text)}
                        title="Clique para editar o nome desta mini missão"
                        style={{
                          fontSize: '0.88rem',
                          color: '#f8fafc',
                          cursor: 'pointer'
                        }}
                      >
                        {text}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      background: isPrioritized ? '#eab308' : 'rgba(255, 255, 255, 0.08)',
                      color: isPrioritized ? '#000' : '#cbd5e1',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => {
                      if (playSound) playSound('click');
                      togglePrioritizeMission(skill.id, text);
                    }}
                    title={isPrioritized ? 'Esta missão aparecerá obrigatoriamente todos os dias' : 'Clique para priorizar'}
                  >
                    {isPrioritized ? 'Priorizada ✓' : 'Priorizar missão diária'}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="modal-actions-bar" style={{ marginTop: '1rem' }}>
          <button
            className="confirm-button"
            style={{ width: '100%', background: 'var(--theme-accent, #38bdf8)', color: '#000', fontWeight: 'bold' }}
            onClick={onClose}
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
}