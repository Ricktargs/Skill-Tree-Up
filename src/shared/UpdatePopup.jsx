// =========================================================
// AVISO DE ATUALIZAÇÃO (discreto, no canto)
// Quando sai versão nova, aparece um cartãozinho ao abrir o programa:
// "Atualizar" ou "Depois". "Depois" esconde até a próxima versão nova
// (ou até abrir de novo amanhã). Nada pisca nem cobre a tela.
// =========================================================
import React, { useEffect, useState } from 'react';
import { tx } from '../i18n/index.jsx';
import { APP_VERSION, PLATFORM, hasUpdate, installUpdate, useUpdate } from './updater.js';
import './UpdatePopup.css';

const KEY = 'orbe-update-later-v1';
const today = () => new Date().toISOString().slice(0, 10);
const laterFor = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
};

export default function UpdatePopup() {
  const st = useUpdate();
  const [hidden, setHidden] = useState(false);
  const [ready, setReady] = useState(false);
  const version = st.version || '';

  // espera a abertura (splash) terminar antes de aparecer
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 4500);
    return () => clearTimeout(t);
  }, []);

  if (!ready || hidden || !hasUpdate(st)) return null;
  const later = laterFor();
  if (later && later.version === version && later.day === today()) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version, day: today() }));
    } catch {
      /* sem armazenamento: some só agora */
    }
    setHidden(true);
  };
  const readyToInstall = st.status === 'ready';
  const downloading = st.status === 'downloading';
  const label = PLATFORM === 'web' ? tx('Recarregar') : readyToInstall ? tx('Reiniciar e atualizar') : tx('Atualizar');

  return (
    <div className="upd-pop" role="status" aria-live="polite">
      <span className="upd-ico" aria-hidden="true">✨</span>
      <div className="upd-text">
        <b>{tx('Nova versão disponível')}</b>
        <small>
          {version && version !== 'nova' ? `v${APP_VERSION} → v${version}` : tx('Uma versão mais nova do ORBE-G já saiu.')}
        </small>
      </div>
      <div className="upd-actions">
        <button type="button" className="upd-later" onClick={dismiss}>
          {tx('Depois')}
        </button>
        <button type="button" className="upd-go" disabled={downloading} onClick={() => installUpdate()}>
          {downloading ? `${Math.round(st.progress || 0)}%` : label}
        </button>
      </div>
      <button type="button" className="upd-x" onClick={dismiss} aria-label={tx('Fechar')}>
        ✕
      </button>
    </div>
  );
}
