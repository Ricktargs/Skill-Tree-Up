import React, { Suspense, lazy, useEffect } from 'react';
import './ModeSwitcher.css';
import App from '../App.jsx';
import { MODES, setMode, useMode } from './modeState.js';

// A Árvore só carrega quando for aberta (e sai da memória ao trocar de modo)
const ArvoreApp = lazy(() => import('./arvore/App.jsx'));
const NeuroniosApp = lazy(() => import('./neuronios/Neuronios.jsx'));

const isTyping = (el) =>
  el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

export default function ModeRoot() {
  const mode = useMode();

  // Título da aba conforme o projeto aberto
  useEffect(() => {
    const m = MODES.find((x) => x.id === mode);
    if (m) document.title = m.title;
  }, [mode]);

  // Alt+1 / Alt+2 / Alt+3 trocam de modo (Neurônios, Árvore, Habilidades)
  useEffect(() => {
    const onKey = (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || isTyping(document.activeElement)) return;
      const index = ['1', '2', '3'].indexOf(e.key);
      if (index < 0) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setMode(MODES[index].id);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, []);

  return (
    <>
      {/* O SkillTree continua montado (Pomodoro e alarmes seguem rodando),
          só fica escondido e com os atalhos desligados fora do modo Skills */}
      <div style={{ display: mode === 'skills' ? 'contents' : 'none' }} aria-hidden={mode !== 'skills'}>
        <App />
      </div>

      {mode === 'arvore' && (
        <Suspense fallback={<div className="mode-loading" />}>
          <ArvoreApp />
        </Suspense>
      )}

      {mode === 'neuronios' && (
        <Suspense fallback={<div className="mode-loading" />}>
          <NeuroniosApp />
        </Suspense>
      )}

      <ModeSwitcher mode={mode} />
    </>
  );
}

function ModeSwitcher({ mode }) {
  return (
    <nav className={`mode-switcher on-${mode}`} aria-label="Trocar de projeto">
      {MODES.map((m, i) => (
        <button
          key={m.id}
          type="button"
          className={`mode-btn ${mode === m.id ? 'active' : ''}`}
          aria-pressed={mode === m.id}
          onClick={() => setMode(m.id)}
          title={`${m.title} (Alt+${i + 1})`}
        >
          {m.name}
        </button>
      ))}
    </nav>
  );
}
