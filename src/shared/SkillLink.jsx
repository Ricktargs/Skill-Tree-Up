// =========================================================
// LIGAÇÃO COM UMA HABILIDADE (Neurônios e galhos)
// Sem ligação: "+ habilidade" abre uma lista bonita das habilidades.
// Com ligação: chip com a cor e o nome; clicar abre a janela da
// habilidade (sem sair do modo atual), o × desfaz a ligação.
// =========================================================
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModeActions } from './modeBridge.js';
import './SkillLink.css';

export default function SkillLink({ value, onChange, className = '' }) {
  const skills = useModeActions('skills');
  const list = useMemo(() => skills?.list || [], [skills]);
  const linked = value ? list.find((s) => s.id === value) : null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef(null);
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);

  // A lista flutua por cima da tela (não fica presa dentro do painel)
  useLayoutEffect(() => {
    if (!open || !boxRef.current) return;
    const r = boxRef.current.getBoundingClientRect();
    const w = 250;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    const below = r.bottom + 6;
    const up = below + 300 > window.innerHeight;
    // no mesmo "tema" da tela (as cores vêm do modo aberto)
    const target = boxRef.current.closest('.nr-root, .arvore-root, .app-screen') || document.body;
    setPos({ target, style: up ? { left, bottom: window.innerHeight - r.top + 6 } : { left, top: below } });
  }, [open]);

  // fecha ao clicar fora ou apertar Esc
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      const inside = (boxRef.current && boxRef.current.contains(e.target)) || (menuRef.current && menuRef.current.contains(e.target));
      if (!inside) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  if (value) {
    // Ligada a uma habilidade que não existe mais: mostra para poder desfazer
    const title = linked ? linked.title : 'Habilidade removida';
    return (
      <span className={`skill-link-chip ${linked ? '' : 'missing'} ${className}`} style={{ '--skill': linked?.color || '#999' }}>
        <button
          type="button"
          className="skill-link-open"
          onClick={() => linked && skills?.open(linked.id)}
          title={linked ? `Abrir “${linked.title}”` : 'Essa habilidade foi excluída'}
          disabled={!linked}
        >
          <i aria-hidden="true" />
          {title}
        </button>
        <button type="button" className="skill-link-remove" onClick={() => onChange(null)} aria-label="Desfazer ligação com a habilidade" title="Desfazer ligação">
          ×
        </button>
      </span>
    );
  }

  const q = query.trim().toLowerCase();
  const shown = q ? list.filter((s) => `${s.title} ${s.category}`.toLowerCase().includes(q)) : list;

  return (
    <span className={`skill-link-pick ${className}`} ref={boxRef}>
      <button
        type="button"
        className="skill-link-add"
        onClick={() => {
          setQuery('');
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        title={list.length ? 'Ligar a uma habilidade' : 'Crie uma habilidade no modo Habilidades primeiro'}
      >
        + habilidade
      </button>
      {open &&
        pos &&
        createPortal(
        <div
          ref={menuRef}
          className="skill-link-menu"
          role="listbox"
          style={{ position: 'fixed', ...pos.style }}
        >
          <div className="skill-link-menu-head">Ligar a uma habilidade</div>
          {list.length > 6 && (
            <input className="skill-link-search" autoFocus placeholder="Procurar…" value={query} onChange={(e) => setQuery(e.target.value)} />
          )}
          <div className="skill-link-options">
            {shown.map((s) => (
              <button
                key={s.id}
                type="button"
                role="option"
                className="skill-link-option"
                style={{ '--skill': s.color }}
                onClick={() => {
                  onChange(s.id);
                  setOpen(false);
                }}
              >
                <i aria-hidden="true" />
                <span className="skill-link-option-text">
                  <b>{s.title}</b>
                  {s.category && <small>{s.category}</small>}
                </span>
              </button>
            ))}
            {!shown.length && <div className="skill-link-empty">{list.length ? 'Nada encontrado.' : 'Nenhuma habilidade ainda. Crie uma no modo Habilidades.'}</div>}
          </div>
        </div>,
          pos.target
        )}
    </span>
  );
}
