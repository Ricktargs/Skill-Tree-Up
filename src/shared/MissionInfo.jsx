// =========================================================
// (i) DAS MISSÕES E MINI MISSÕES
// Mesmo botão "i" dos níveis: abre um descritivo da mini missão
// (anotações, como fazer, links...). Aparece em Missões de Hoje,
// Mini Missões e no Editor de Missões Diárias — é o mesmo texto nos três.
// =========================================================
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { tx } from '../i18n/index.jsx';

export function getMissionInfo(skill, text) {
  const key = String(text || '').trim();
  return (skill && skill.miniMissionInfos && skill.miniMissionInfos[key]) || '';
}

export default function MissionInfo({ skill, text, onSave, playSound }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const saved = getMissionInfo(skill, text);
  const has = Boolean(saved.trim());

  const close = () => {
    if (draft !== saved) onSave(draft);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return undefined;
    const key = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  });

  const host = document.getElementById('root') || document.body;

  return (
    <>
      <button
        type="button"
        className={`btn-level-info lv-info mission-info-btn ${has ? 'has' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (playSound) playSound('click');
          setDraft(saved);
          setOpen(true);
        }}
        title={has ? tx('Ver / editar o descritivo desta missão') : tx('Escrever um descritivo para esta missão')}
        aria-label={tx('Info da missão')}
      >
        i
      </button>
      {open &&
        createPortal(
          <div
            className="modal-backdrop high-z-backdrop mission-info-backdrop"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
          >
            <div className="modal-window high-z-window" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px', width: '94vw', maxHeight: '92vh' }}>
              <div className="modal-header-row">
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--theme-accent, #38bdf8)' }}>{tx('Info/Descritivo - Missão')}</h3>
                <button type="button" className="close-popup-btn" onClick={close}>
                  ✕
                </button>
              </div>
              <p className="mission-info-title">
                <b>{skill?.title || skill?.name}</b> · {text}
              </p>
              <textarea
                className="info-textarea"
                placeholder={tx('Escreva aqui anotações, como fazer ou observações para esta missão...')}
                rows={12}
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <div className="modal-actions-bar">
                <button type="button" className="confirm-button" style={{ width: '100%' }} onClick={close}>
                  {tx('Concluído')}
                </button>
              </div>
            </div>
          </div>,
          host
        )}
    </>
  );
}
