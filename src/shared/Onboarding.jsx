// =========================================================
// BOAS-VINDAS + TUTORIAL DO ORBE-G
// - Usuário novo: depois da abertura aparece "Ver tutorial / Pular"
//   e o botão para baixar o app de PC (no navegador).
// - Tutorial: passa pelos 3 modos (Habilidades, Santuário e Neurônios)
//   destacando cada parte da tela. Pode ser revisto nas Configurações.
// =========================================================
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './Onboarding.css';
import { getMode, setMode } from '../modes/modeState.js';
import { setNotesPanelOpen } from './notesPanel.js';
import { isNewUser, markWelcomeDone } from './firstRun.js';
import { startTutorial, stopTutorial, useTutorialOpen } from './tutorial.js';
import { DOWNLOADS, IS_IOS_HOME, PLATFORM, downloadFor, visitorSystem } from './updater.js';
import { tx, useLanguage } from '../i18n/index.jsx';
import { sfx } from '../modes/arvore/lib/sound.js';

const SPLASH_MS = 2700; // espera a abertura terminar

const STEPS = [
  // ---------- Habilidades ----------
  {
    mode: 'skills',
    emoji: '👋',
    title: 'Bem-vindo ao ORBE-G!',
    text: 'Organização, Rotina, Base, Evolução e Gamificação. O programa tem 3 modos — vamos passar rapidinho por cada um.'
  },
  {
    mode: 'skills',
    target: '.mode-switcher',
    emoji: '🧭',
    title: 'Os 3 modos',
    text: 'Aqui você troca entre Neurônios, Santuário e Habilidades. Atalhos: Alt+1, Alt+2 e Alt+3.'
  },
  {
    mode: 'skills',
    target: '.hero-stage',
    emoji: '🧙',
    title: 'Seu herói',
    text: 'Este é você. Ganhe XP para subir de nível e de patente, e junte diamantes completando missões e listas de tarefas.'
  },
  {
    mode: 'skills',
    target: '.skills-list',
    emoji: '🌱',
    title: 'Habilidades',
    text: 'Cada habilidade tem suas tarefas. Conclua as tarefas pendentes e aperte ＋ para a habilidade subir de nível. A engrenagem configura a habilidade.'
  },
  {
    mode: 'skills',
    target: '.skills-header-container',
    emoji: '🔎',
    title: 'Pastas e busca',
    text: 'Organize as habilidades em pastas (G) e encontre qualquer uma com Espaço.'
  },
  {
    mode: 'skills',
    target: 'button[title^="Tarefas"]',
    emoji: '✅',
    title: 'Tarefas (T)',
    text: 'Suas listas de tarefas. Cada tarefa feita dá +2 de XP e terminar uma lista inteira dá 1 diamante.'
  },
  {
    mode: 'skills',
    target: 'button[title^="Flashcards"]',
    emoji: '🎴',
    title: 'Flashcards (F)',
    text: 'Baralhos para estudar com repetição: a carta volta no tempo certo para você não esquecer.'
  },
  {
    mode: 'skills',
    target: 'button[title^="Pomodoro"]',
    emoji: '🍅',
    title: 'Pomodoro (R) e Missões (M)',
    text: 'Foque com o Pomodoro e cumpra as missões diárias para ganhar diamantes. Essas ferramentas ficam nesta coluna nos três modos.'
  },
  // ---------- Santuário ----------
  {
    mode: 'arvore',
    target: '.tree-container',
    emoji: '🌳',
    title: 'Santuário',
    text: 'O mundo do seu herói, sem cobrança. A árvore guarda galhos e notas e cresce com o que você registra. Ande com W A S D e pule com Espaço.'
  },
  {
    mode: 'arvore',
    target: '.sanc-toggle-btn',
    emoji: '🗺️',
    title: 'Layout do mundo',
    text: 'Escolha entre Terra, Ilha voadora e Ilha com mar, e decore: árvores, lagos, barracas, fogueiras, lanternas…'
  },
  // ---------- Neurônios ----------
  {
    mode: 'neuronios',
    target: '.nr-split',
    emoji: '🧠',
    title: 'Neurônios',
    text: 'Um mapa das suas ideias. Cada neurônio é uma nota; ligue um ao outro escrevendo [[ dentro do texto e eles se conectam no mapa.'
  },
  {
    mode: 'neuronios',
    target: '.nr-new',
    emoji: '＋',
    title: 'Criar neurônio (N)',
    text: 'Cria um neurônio novo. Em Mapa/Neuro você ajusta as forças do mapa. Aperte V para reorganizar.'
  },
  {
    mode: 'neuronios',
    target: '.nr-search-wrap',
    emoji: '🔍',
    title: 'Buscar (Espaço ou /)',
    text: 'Procura neurônios e notas ao mesmo tempo, mostrando também os relacionados.'
  },
  {
    mode: 'neuronios',
    target: '.notes-fab',
    emoji: '✒️',
    title: 'Editor de notas (E)',
    text: 'Abre em qualquer modo: notas em pastas, arrastar para organizar e Pressets para criar notas prontas (diário, estudo…).'
  },
  {
    mode: 'skills',
    target: 'button[title^="Configurações"]',
    emoji: '⚙️',
    title: 'Configurações (Esc)',
    text: 'Idioma, aparência, sons, o app de PC e este tutorial para rever quando quiser.'
  },
  {
    mode: 'skills',
    emoji: '🚀',
    title: 'Tudo pronto!',
    text: 'Comece criando sua primeira habilidade ou neurônio. Bom proveito!'
  }
];

// ---------- Tutorial ----------
function Tutorial({ onClose }) {
  useLanguage();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [ready, setReady] = useState(false);
  const cardRef = useRef(null);
  const [cardSize, setCardSize] = useState({ w: 340, h: 200 });
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  // troca de modo e espera o alvo aparecer
  useEffect(() => {
    let alive = true;
    setReady(false);
    if (getMode() !== step.mode) setMode(step.mode);
    if (!step.target) {
      setRect(null);
      setReady(true);
      return undefined;
    }
    const started = Date.now();
    let timer;
    const find = () => {
      if (!alive) return;
      const el = document.querySelector(step.target);
      const r = el && el.getBoundingClientRect();
      if (r && r.width > 0 && r.height > 0) {
        if (el.scrollIntoView && (r.top < 0 || r.bottom > window.innerHeight)) el.scrollIntoView({ block: 'center' });
        setRect(el.getBoundingClientRect());
        setReady(true);
      } else if (Date.now() - started < 2500) timer = setTimeout(find, 100);
      else {
        setRect(null); // não achou: mostra no meio da tela
        setReady(true);
      }
    };
    timer = setTimeout(find, step.mode !== getMode() ? 250 : 60);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [index, step]);

  // acompanha o alvo (janela mudou de tamanho, animações…)
  useEffect(() => {
    if (!step.target || !ready) return undefined;
    const t = setInterval(() => {
      const el = document.querySelector(step.target);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect((cur) => (cur && Math.abs(cur.x - r.x) < 1 && Math.abs(cur.y - r.y) < 1 && Math.abs(cur.width - r.width) < 1 && Math.abs(cur.height - r.height) < 1 ? cur : r));
    }, 250);
    return () => clearInterval(t);
  }, [step, ready]);

  useLayoutEffect(() => {
    if (!cardRef.current) return;
    const b = cardRef.current.getBoundingClientRect();
    if (Math.abs(b.width - cardSize.w) > 1 || Math.abs(b.height - cardSize.h) > 1) setCardSize({ w: b.width, h: b.height });
  });

  const go = useCallback(
    (delta) => {
      const next = index + delta;
      if (next < 0) return;
      if (next >= STEPS.length) {
        sfx.play('grow');
        onClose();
        return;
      }
      sfx.play('tick');
      setIndex(next);
    },
    [index, onClose]
  );

  // teclado: → / Enter avança, ← volta, Esc sai (sem disparar os atalhos do app)
  useEffect(() => {
    const onKey = (e) => {
      e.stopImmediatePropagation();
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key !== 'Tab') e.preventDefault();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [go, onClose]);

  // posição do balão: embaixo do alvo, ou em cima, ou ao lado
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let cardStyle = { left: (vw - cardSize.w) / 2, top: (vh - cardSize.h) / 2 };
  const hole = rect && {
    left: Math.max(4, rect.left - pad),
    top: Math.max(4, rect.top - pad),
    width: Math.min(vw - 8, rect.width + pad * 2),
    height: Math.min(vh - 8, rect.height + pad * 2)
  };
  if (hole) {
    const gap = 14;
    const below = hole.top + hole.height + gap;
    const above = hole.top - gap - cardSize.h;
    const clampX = (x) => Math.max(12, Math.min(vw - cardSize.w - 12, x));
    const clampY = (y) => Math.max(12, Math.min(vh - cardSize.h - 12, y));
    if (below + cardSize.h <= vh - 12) cardStyle = { left: clampX(hole.left + hole.width / 2 - cardSize.w / 2), top: below };
    else if (above >= 12) cardStyle = { left: clampX(hole.left + hole.width / 2 - cardSize.w / 2), top: above };
    else if (hole.left + hole.width + gap + cardSize.w <= vw - 12) cardStyle = { left: hole.left + hole.width + gap, top: clampY(hole.top + hole.height / 2 - cardSize.h / 2) };
    else if (hole.left - gap - cardSize.w >= 12) cardStyle = { left: hole.left - gap - cardSize.w, top: clampY(hole.top + hole.height / 2 - cardSize.h / 2) };
    // alvo enorme (o mapa, o mundo): balão por cima, embaixo no centro
    else cardStyle = { left: (vw - cardSize.w) / 2, top: vh - cardSize.h - 90 };
  }

  const modeLabel = { skills: 'Habilidades', arvore: 'Santuário', neuronios: 'Neurônios' }[step.mode];

  return (
    <div className="ob-layer" role="dialog" aria-modal="true" aria-label={tx('Tutorial')} onMouseDown={(e) => e.preventDefault()}>
      {hole && ready ? <div className="ob-hole" style={hole} /> : <div className="ob-dim" />}
      <div ref={cardRef} className={`ui-dialog ob-card ${ready ? 'show' : ''}`} style={cardStyle}>
        <div className="ob-top">
          <span className="ob-mode">{tx(modeLabel)}</span>
          <span className="ob-count">
            {index + 1}/{STEPS.length}
          </span>
          <button type="button" className="ob-x" onClick={onClose} title={tx('Sair do tutorial (Esc)')} aria-label={tx('Sair do tutorial')}>
            ✕
          </button>
        </div>
        <div className="ob-emoji" aria-hidden="true">
          {step.emoji}
        </div>
        <h3>{tx(step.title)}</h3>
        <p className="ui-dialog-message">{tx(step.text)}</p>
        <div className="ob-dots" aria-hidden="true">
          {STEPS.map((s, i) => (
            <i key={i} className={`${i === index ? 'on' : ''} ${i < index ? 'done' : ''}`} />
          ))}
        </div>
        <div className="ui-dialog-actions">
          {index > 0 ? (
            <button type="button" className="ui-dialog-btn" onClick={() => go(-1)}>
              ← {tx('Voltar')}
            </button>
          ) : (
            <button type="button" className="ui-dialog-btn" onClick={onClose}>
              {tx('Pular tutorial')}
            </button>
          )}
          <button type="button" className="ui-dialog-btn primary" onClick={() => go(1)} autoFocus>
            {last ? tx('Começar!') : `${tx('Próximo')} →`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Boas-vindas (só para usuário novo) ----------
function Welcome({ onTutorial, onSkip }) {
  useLanguage();
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onSkip();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onSkip]);

  return (
    <div className="ui-dialog-backdrop ob-welcome-backdrop">
      <div className="ui-dialog ob-welcome" role="dialog" aria-label={tx('Boas-vindas')}>
        <div className="ob-welcome-logo">ORBE-G</div>
        <h3>{tx('Bem-vindo! É sua primeira vez aqui?')}</h3>
        <p className="ui-dialog-message">{tx('Um tutorial rápido mostra os 3 modos do programa: Habilidades, Santuário e Neurônios.')}</p>
        <div className="ui-dialog-actions">
          <button type="button" className="ui-dialog-btn" onClick={onSkip}>
            {tx('Pular tutorial')}
          </button>
          <button type="button" className="ui-dialog-btn primary" onClick={onTutorial} autoFocus>
            ▶ {tx('Ver tutorial')}
          </button>
        </div>
        {PLATFORM === 'web' && !IS_IOS_HOME && (
          <div className="ob-download">
            <div>
              <strong>⬇ {tx('Baixar o app')}</strong>
              <span>{tx('Use o ORBE-G como programa no PC ou no celular.')}</span>
            </div>
            <div className="ob-download-btns">
              {Object.entries(DOWNLOADS).map(([id, d]) => (
                <button
                  key={id}
                  type="button"
                  className={`ui-dialog-btn ${visitorSystem === id ? 'primary' : ''}`}
                  onClick={() => {
                    sfx.play('tick');
                    downloadFor(id);
                  }}
                >
                  {d.icon} {d.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Onboarding() {
  const tutorialOpen = useTutorialOpen();
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    if (!isNewUser()) return undefined;
    const t = setTimeout(() => setWelcome(true), SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  // começa o tutorial com a tela limpa
  useEffect(() => {
    if (tutorialOpen) setNotesPanelOpen(false);
  }, [tutorialOpen]);

  return (
    <>
      {welcome && !tutorialOpen && (
        <Welcome
          onTutorial={() => {
            sfx.play('open');
            markWelcomeDone();
            setWelcome(false);
            startTutorial();
          }}
          onSkip={() => {
            sfx.play('close');
            markWelcomeDone();
            setWelcome(false);
          }}
        />
      )}
      {tutorialOpen && <Tutorial onClose={stopTutorial} />}
    </>
  );
}
