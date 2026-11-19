// =========================================================
// ABERTURA DO ORBE-G (2,5 s)
// Organização · Rotina · Base · Evolução · Gamificação
// As palavras aparecem escritas, depois o resto de cada uma some
// e as iniciais se juntam em "ORBE-G", que fica em destaque.
// Um "plim" fofo toca quando a sigla se forma.
// Não dá para pular: a abertura toca inteira, com o som, até sumir.
// =========================================================
import React, { useEffect, useRef, useState } from 'react';
import './Splash.css';

const WORDS = ['Organização', 'Rotina', 'Base', 'Evolução', 'Gamificação'];
const DURATION = 2500;
const CHIME_AT = 1.38; // segundos: quando a sigla se forma

// Respeita o "Efeitos sonoros" das Configurações
const soundOn = () => {
  try {
    const s = JSON.parse(localStorage.getItem('eu-sou-arvore-sound') || 'null');
    return !s || s.enabled !== false;
  } catch {
    return true;
  }
};

// Plim fofo: três notas subindo, suaves, com um brilho por cima
function playChime(ctx) {
  const start = () => {
    const t0 = ctx.currentTime + 0.02;
    const master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);
    [
      [784, 0], // Sol
      [1047, 0.09], // Dó
      [1319, 0.18], // Mi
    ].forEach(([f, dt]) => {
      const t = t0 + dt;
      [
        ['sine', f, 1],
        ['triangle', f * 2, 0.18],
      ].forEach(([type, freq, vol]) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(freq * 1.006, t + 0.4);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
        o.connect(g).connect(master);
        o.start(t);
        o.stop(t + 0.6);
      });
    });
  };
  start();
  return ctx;
}

// No app de PC (Electron) o som sempre toca. No navegador, Chrome/Edge podem
// bloquear som antes de qualquer clique na página — aí o plim fica mudo
// (regra do navegador). Clicar durante a abertura NÃO toca nem pula nada.
function makeAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try {
    return new Ctx();
  } catch {
    return null;
  }
}

export default function Splash() {
  const [show, setShow] = useState(true);
  const audio = useRef(null);

  useEffect(() => {
    if (!show) return undefined;
    const end = setTimeout(() => setShow(false), DURATION);
    const wantSound = soundOn();
    const ctx = wantSound ? makeAudio() : null;
    audio.current = ctx;
    let played = false;
    let due = false; // já passou da hora do plim
    const ring = () => {
      if (played || !ctx) return;
      if (ctx.state === 'running') {
        played = true;
        playChime(ctx);
      }
    };
    // tenta liberar o áudio já (funciona quando o navegador permite)
    if (ctx && ctx.state === 'suspended') ctx.resume().then(() => due && ring()).catch(() => {});
    const chime = ctx
      ? setTimeout(() => {
          due = true;
          ring();
        }, CHIME_AT * 1000)
      : null;
    return () => {
      clearTimeout(end);
      if (chime) clearTimeout(chime);
      // áudio que nem chegou a tocar não fica aberto à toa
      if (ctx && !played) {
        try {
          ctx.close();
        } catch {
          /* nada */
        }
      }
    };
  }, [show]);

  // fecha o áudio depois que o plim termina
  useEffect(() => {
    if (show) return undefined;
    const t = setTimeout(() => {
      try {
        audio.current?.close();
      } catch {
        /* nada */
      }
    }, 900);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;
  return (
    <div className="orbe-splash" role="presentation" aria-label="ORBE-G">
      <div className="orbe-stage">
        <div className="orbe-logo" aria-hidden="true">
          {WORDS.map((w, i) => (
            <span key={w} className="orbe-word" style={{ '--i': i }}>
              <span className="orbe-ini">{w[0]}</span>
              <span className="orbe-rest">{w.slice(1)}</span>
              {i === 3 && <span className="orbe-dash">-</span>}
            </span>
          ))}
        </div>
        <div className="orbe-tag">Organização · Rotina · Base · Evolução · Gamificação</div>
      </div>
    </div>
  );
}
