// =========================================================
// LIGAÇÃO COM UMA HABILIDADE (Neurônios e galhos da Árvore)
// Sem ligação: "+ habilidade" abre a lista das habilidades.
// Com ligação: chip com a cor e o nome; clicar abre a habilidade
// no modo Habilidades, o × desfaz a ligação.
// =========================================================
import React from 'react';
import { useModeActions } from './modeBridge.js';
import './SkillLink.css';

export default function SkillLink({ value, onChange, className = '' }) {
  const skills = useModeActions('skills');
  const list = skills?.list || [];
  const linked = value ? list.find((s) => s.id === value) : null;

  if (value) {
    // Ligada a uma habilidade que não existe mais: mostra para poder desfazer
    const title = linked ? linked.title : 'Habilidade removida';
    return (
      <span className={`skill-link-chip ${linked ? '' : 'missing'} ${className}`} style={{ '--skill': linked?.color || '#999' }}>
        <button
          type="button"
          className="skill-link-open"
          onClick={() => linked && skills?.open(linked.id)}
          title={linked ? `Abrir “${linked.title}” em Habilidades` : 'Essa habilidade foi excluída'}
          disabled={!linked}
        >
          <i aria-hidden="true" />⚔ {title}
        </button>
        <button type="button" className="skill-link-remove" onClick={() => onChange(null)} aria-label="Desfazer ligação com a habilidade" title="Desfazer ligação">
          ×
        </button>
      </span>
    );
  }

  return (
    <label className={`skill-link-add ${className}`} title={list.length ? 'Ligar a uma habilidade' : 'Crie uma habilidade no modo Habilidades primeiro'}>
      <span>+ habilidade</span>
      <select value="" disabled={!list.length} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label="Ligar a uma habilidade">
        <option value="">Ligar a uma habilidade…</option>
        {list.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
            {s.category ? ` · ${s.category}` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
