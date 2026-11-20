// =========================================================
// MÓDULOS / CURSOS DE UMA HABILIDADE (no Editar Habilidade)
// Abas simples: clicar troca · duplo clique (ou ✎) renomeia ali mesmo ·
// "+" cria na hora · ✕ exclui. Cada aba mostra o nível do módulo.
// O módulo aberto fica nos campos da própria habilidade (level, metas…);
// os outros guardam os deles em skill.modules (o "Geral" em default*).
// =========================================================
import React, { useEffect, useRef, useState } from 'react';
import { tx } from '../i18n/index.jsx';
import { ask } from '../shared/Dialog.jsx';
import './ModuleTabs.css';

const FIELDS = ['level', 'maxLevel', 'levelDescriptions', 'levelTasks', 'levelInfos'];
const DEFAULT_ID = 'default';

// guarda o que está aberto no lugar dele (módulo ou "Geral")
function stash(skill) {
  const active = skill.activeModuleId || DEFAULT_ID;
  if (active === DEFAULT_ID) {
    return {
      ...skill,
      defaultLevel: skill.level,
      defaultMaxLevel: skill.maxLevel,
      defaultLevelDescriptions: skill.levelDescriptions,
      defaultLevelTasks: skill.levelTasks,
      defaultLevelInfos: skill.levelInfos
    };
  }
  return {
    ...skill,
    modules: (skill.modules || []).map((m) => (m.id === active ? { ...m, ...Object.fromEntries(FIELDS.map((f) => [f, skill[f]])) } : m))
  };
}

// abre um módulo (traz os dados dele para a habilidade)
export function openModule(skill, targetId) {
  const s = stash(skill);
  if (targetId === DEFAULT_ID) {
    return {
      ...s,
      activeModuleId: DEFAULT_ID,
      level: s.defaultLevel ?? 0,
      maxLevel: s.defaultMaxLevel ?? 10,
      levelDescriptions: s.defaultLevelDescriptions ?? {},
      levelTasks: s.defaultLevelTasks ?? {},
      levelInfos: s.defaultLevelInfos ?? {}
    };
  }
  const m = (s.modules || []).find((x) => x.id === targetId);
  if (!m) return s;
  return {
    ...s,
    activeModuleId: targetId,
    level: m.level || 0,
    maxLevel: m.maxLevel || 10,
    levelDescriptions: m.levelDescriptions || {},
    levelTasks: m.levelTasks || {},
    levelInfos: m.levelInfos || {}
  };
}

// Campo de nome que cresce com o texto
function NameInput({ initial, placeholder, onDone, onCancel }) {
  const [value, setValue] = useState(initial || '');
  const ref = useRef(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (save) => {
    if (done.current) return;
    done.current = true;
    const v = value.trim();
    if (save && v) onDone(v);
    else onCancel();
  };
  return (
    <span className="mt-input-wrap" data-value={value || placeholder}>
      <input
        ref={ref}
        className="mt-input"
        value={value}
        placeholder={placeholder}
        size={1}
        maxLength={48}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            finish(true);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            finish(false);
          }
        }}
        onBlur={() => finish(true)}
      />
    </span>
  );
}

export default function ModuleTabs({ skill, setSkill, playSound, tools = null }) {
  const [renaming, setRenaming] = useState(null); // id do módulo
  const [creating, setCreating] = useState(false);
  const click = (k = 'click') => playSound && playSound(k);
  const active = skill.activeModuleId || DEFAULT_ID;
  const modules = skill.modules || [];

  const levelOf = (id) => {
    if (id === active) return [skill.level || 0, skill.maxLevel || 10];
    if (id === DEFAULT_ID) return [skill.defaultLevel ?? 0, skill.defaultMaxLevel ?? 10];
    const m = modules.find((x) => x.id === id);
    return [m?.level || 0, m?.maxLevel || 10];
  };
  const tabs = [{ id: DEFAULT_ID, name: skill.defaultModuleName || tx('Geral') }, ...modules.map((m) => ({ id: m.id, name: m.name }))];

  const switchTo = (id) => {
    if (id === active) return;
    click();
    setSkill((prev) => openModule(prev, id));
  };
  const rename = (id, name) => {
    setRenaming(null);
    setSkill((prev) =>
      id === DEFAULT_ID ? { ...prev, defaultModuleName: name } : { ...prev, modules: (prev.modules || []).map((m) => (m.id === id ? { ...m, name } : m)) }
    );
  };
  const create = (name) => {
    setCreating(false);
    click('train');
    const id = `mod_${Date.now()}`;
    setSkill((prev) => {
      const s = stash(prev);
      return openModule(
        { ...s, modules: [...(s.modules || []), { id, name, level: 0, maxLevel: 10, levelDescriptions: {}, levelTasks: {}, levelInfos: {} }] },
        id
      );
    });
  };
  const remove = async (tab) => {
    const ok = await ask({
      title: tx('Excluir o módulo “{name}”?', { name: tab.name }),
      message: tx('As metas e tarefas dele são apagadas. Os outros módulos continuam.'),
      yes: tx('Excluir'),
      danger: true
    });
    if (!ok) return;
    click('delete');
    setSkill((prev) => {
      const base = (prev.activeModuleId || DEFAULT_ID) === tab.id ? openModule({ ...prev }, DEFAULT_ID) : prev;
      return { ...base, modules: (base.modules || []).filter((m) => m.id !== tab.id) };
    });
  };

  return (
    <div className="mt-bar">
      <div className="mt-head">
        <h3 className="section-label-large">{tx('Metas e Níveis')}</h3>
        <span className="mt-hint">{tx('Módulos / cursos · duplo clique renomeia')}</span>
        {tools && <div className="mt-tools">{tools}</div>}
      </div>
      <div className="mt-tabs" role="tablist">
        {tabs.map((t) => {
          const on = t.id === active;
          const [lv, max] = levelOf(t.id);
          const pct = Math.round((Math.min(lv, max) / Math.max(1, max)) * 100);
          if (renaming === t.id) {
            return (
              <span key={t.id} className={`mt-tab editing ${on ? 'on' : ''}`}>
                <NameInput initial={t.name} placeholder={tx('Nome do módulo')} onDone={(v) => rename(t.id, v)} onCancel={() => setRenaming(null)} />
              </span>
            );
          }
          return (
            <span
              key={t.id}
              role="tab"
              tabIndex={0}
              aria-selected={on}
              className={`mt-tab ${on ? 'on' : ''}`}
              style={{ '--mt-pct': `${pct}%` }}
              onClick={() => (on ? setRenaming(t.id) : switchTo(t.id))}
              onDoubleClick={() => setRenaming(t.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') switchTo(t.id);
                if (e.key === 'F2') setRenaming(t.id);
              }}
              title={on ? tx('Clique para renomear') : tx('Abrir este módulo')}
            >
              <span className="mt-name">{t.name}</span>
              <span className="mt-lv">
                {lv}/{max}
              </span>
              {on && (
                <span className="mt-pen" aria-hidden="true">
                  ✎
                </span>
              )}
              {t.id !== DEFAULT_ID && (
                <button
                  type="button"
                  className="mt-x"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(t);
                  }}
                  title={tx('Excluir este módulo')}
                  aria-label={tx('Excluir este módulo')}
                >
                  ✕
                </button>
              )}
            </span>
          );
        })}
        {creating ? (
          <span className="mt-tab editing new">
            <NameInput initial="" placeholder={tx('Nome do novo módulo')} onDone={create} onCancel={() => setCreating(false)} />
          </span>
        ) : (
          <button type="button" className="mt-add" onClick={() => (click(), setCreating(true))} title={tx('Criar um módulo (ex.: Design Web, Design Gráfico…)')}>
            ＋ {tx('Novo')}
          </button>
        )}
      </div>
    </div>
  );
}
