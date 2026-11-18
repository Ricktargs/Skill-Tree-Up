import React, { useEffect, useState } from 'react';
import './Settings.css';
import { useLanguage, LANGUAGES, tx } from '../i18n/index.jsx';
import { useMode, MODES } from '../modes/modeState.js';
import { useUiTheme, setVisual, setDark, VISUAL_THEMES } from '../shared/uiTheme.js';
import { useModeActions } from '../shared/modeBridge.js';
import { useSoundSettings, setSoundSettings, sfx } from '../modes/arvore/lib/sound.js';

// Interruptor no padrão das Configurações
function Toggle({ title, desc, checked, onChange }) {
  return (
    <label className="st-row st-toggle-row">
      <div className="st-row-text">
        <strong>{title}</strong>
        {desc && <span>{desc}</span>}
      </div>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="st-switch" />
    </label>
  );
}

// =========================================================
// CONFIGURAÇÕES (Esc) — tudo num lugar só, agrupado por assunto
// =========================================================
export function SettingsModal({
  isOpen,
  onClose,
  playSound,
  themeName,
  themeColor,
  boxColorType,
  setBoxColorType,
  linkSkillsByCategory,
  setLinkSkillsByCategory,
  onOpenTheme,
  onOpenManageSkills,
  onOpenLayoutEditor,
  onOpenFolders,
  onOpenCommands,
  onExport,
  onImport
}) {
  const { lang, setLanguage } = useLanguage();
  const mode = useMode();
  const ui = useUiTheme();
  const arvore = useModeActions('arvore');
  const growth = useModeActions('arvoreGrowth');
  const neuronios = useModeActions('neuronios');
  const sound = useSoundSettings();
  if (!isOpen) return null;
  const modeName = (MODES.find((m) => m.id === mode) || {}).name;

  const click = (type = 'click') => playSound && playSound(type);
  const close = () => {
    click();
    onClose();
  };
  const open = (fn) => () => {
    click();
    fn();
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal-window st-window" onClick={(e) => e.stopPropagation()}>
        <div className="st-header">
          <div>
            <h3>⚙️ {tx('Configurações')}</h3>
            <p>{tx('Vale para Neurônios, Árvore e Habilidades')}</p>
          </div>
          <button type="button" className="st-close" onClick={close} title={tx('Fechar (Esc)')}>
            ✕
          </button>
        </div>

        <div className="st-body">
          {/* Idioma */}
          <section className="st-section">
            <h4>🌐 {tx('Idioma')}</h4>
            <div className="st-langs">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  className={`st-lang ${lang === l.code ? 'active' : ''}`}
                  onClick={() => {
                    if (lang !== l.code) click('train');
                    setLanguage(l.code);
                  }}
                >
                  <span className="st-lang-flag">{l.flag}</span>
                  <span>{l.native}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Aparência (todos os modos) */}
          <section className="st-section">
            <h4>🎨 {tx('Aparência')}</h4>
            <div className="st-row">
              <div className="st-row-text">
                <strong>{tx('Estilo visual')}</strong>
                <span>{tx((VISUAL_THEMES.find((t) => t.id === ui.visual) || {}).desc || '')}</span>
              </div>
              <div className="st-segmented">
                {VISUAL_THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={ui.visual === t.id ? 'active' : ''}
                    onClick={() => {
                      click();
                      setVisual(t.id);
                    }}
                  >
                    {tx(t.name)}
                  </button>
                ))}
              </div>
            </div>
            <Toggle
              title={tx('Modo noturno')}
              desc={ui.visual === 'gamificado' ? tx('No estilo Gameficado as Habilidades já são escuras') : tx('Papel escuro e tinta clara nos três modos')}
              checked={ui.dark}
              onChange={(v) => {
                click();
                setDark(v);
              }}
            />
          </section>

          {mode === 'skills' && (
          <section className="st-section">
            <h4>🖌️ {tx('Cores das Habilidades')}</h4>
            <div className="st-row">
              <div className="st-row-text">
                <strong>{ui.visual === 'nanquim' ? tx('Cor da tinta') : tx('Tema de cores')}</strong>
                <span>
                  {tx('Atual')}: <em style={{ color: themeColor }}>{tx(themeName)}</em>
                </span>
              </div>
              <button type="button" className="st-btn" onClick={open(onOpenTheme)}>
                {tx('Personalizar')} <kbd>C</kbd>
              </button>
            </div>
            <div className="st-row">
              <div className="st-row-text">
                <strong>{tx('Cor das caixas de habilidade')}</strong>
                <span>{tx('Fundo dos cards na tela inicial')}</span>
              </div>
              <div className="st-segmented">
                <button
                  type="button"
                  className={boxColorType !== 'theme' ? 'active' : ''}
                  onClick={() => {
                    click();
                    setBoxColorType('default');
                  }}
                >
                  {tx('Padrão')}
                </button>
                <button
                  type="button"
                  className={boxColorType === 'theme' ? 'active' : ''}
                  onClick={() => {
                    click();
                    setBoxColorType('theme');
                  }}
                >
                  {tx('Do tema')}
                </button>
              </div>
            </div>
          </section>
          )}

          {/* Opções do modo aberto */}
          {mode === 'arvore' && (
            <section className="st-section">
              <h4>🌳 {tx('Árvore')}</h4>
              {arvore ? (
                <>
                  {growth && (
                    <>
                      <Toggle
                        title={tx('Dividir o tronco ao crescer')}
                        desc={tx('Com muitos galhos, o tronco vira dois (um saindo do outro)')}
                        checked={growth.fork === true}
                        onChange={(v) => {
                          click();
                          growth.setFork(v);
                        }}
                      />
                      <Toggle
                        title={tx('Árvores novas ao lado')}
                        desc={
                          growth.allowTrees
                            ? tx('Quando ficar grande demais, os galhos novos crescem numa árvore ligada pelas raízes')
                            : tx('Recusado: todos os galhos ficam numa árvore só')
                        }
                        checked={growth.allowTrees}
                        onChange={(v) => {
                          click();
                          growth.setAllowTrees(v);
                        }}
                      />
                      {growth.extraTrees && (
                        <div className="st-actions list">
                          <button type="button" className="st-btn wide" onClick={() => { click(); growth.mergeTrees(); }}>
                            <span>🌳 {tx('Recusar árvores extras e juntar numa só')}</span>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  <div className="st-actions list">
                    <button type="button" className="st-btn wide" onClick={open(arvore.shuffle)}>
                      <span>🔀 {tx('Aleatorizar galhos')}</span> <kbd>Ctrl+M</kbd>
                    </button>
                    <button
                      type="button"
                      className="st-btn wide"
                      onClick={() => {
                        click();
                        onClose();
                        arvore.openRevisions();
                      }}
                    >
                      <span>🕰️ {tx('Pontos de restauração (diários)')}</span>
                    </button>
                  </div>
                </>
              ) : (
                <p className="st-note">{tx('Carregando…')}</p>
              )}
              <Toggle
                title={tx('Efeitos sonoros')}
                desc={tx('Sons ao criar galhos, notas e pastas')}
                checked={sound.enabled}
                onChange={(v) => {
                  setSoundSettings({ enabled: v });
                  if (v) sfx.play('grow');
                }}
              />
              <Toggle
                title={tx('Som ambiente')}
                desc={tx('Vento e pássaros')}
                checked={sound.ambient}
                onChange={(v) => setSoundSettings({ ambient: v })}
              />
              <div className="st-row">
                <div className="st-row-text">
                  <strong>{tx('Volume')}</strong>
                </div>
                <input
                  className="st-range"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={sound.volume}
                  disabled={!sound.enabled}
                  onChange={(e) => setSoundSettings({ volume: Number(e.target.value) })}
                />
              </div>
            </section>
          )}

          {mode === 'neuronios' && (
            <section className="st-section">
              <h4>🧠 {tx('Neurônios')}</h4>
              {neuronios ? (
                <>
                  <Toggle
                    title={tx('Tags no mapa')}
                    desc={tx('Mostra as tags como nós ligados aos neurônios')}
                    checked={neuronios.tagNodes}
                    onChange={(v) => {
                      click();
                      neuronios.setView({ tagNodes: v });
                    }}
                  />
                  <Toggle
                    title={tx('Esconder neurônios sem ligação')}
                    desc={tx('Deixa no mapa só quem está ligado a alguém')}
                    checked={neuronios.hideOrphans}
                    onChange={(v) => {
                      click();
                      neuronios.setView({ hideOrphans: v });
                    }}
                  />
                </>
              ) : (
                <p className="st-note">{tx('Carregando…')}</p>
              )}
            </section>
          )}

          {mode === 'skills' && (
          <section className="st-section">
            <h4>🧩 {tx('Habilidades')}</h4>
            <label className="st-row st-toggle-row">
              <div className="st-row-text">
                <strong>{tx('Interligar por categoria')}</strong>
                <span>
                  {linkSkillsByCategory
                    ? tx('Habilidades da mesma categoria ficam interligadas')
                    : tx('As habilidades seguem só a ordem manual')}
                </span>
              </div>
              <input
                type="checkbox"
                checked={!!linkSkillsByCategory}
                onChange={() => {
                  click();
                  setLinkSkillsByCategory(!linkSkillsByCategory);
                }}
              />
              <span className="st-switch" />
            </label>
            <div className="st-actions list">
              <button type="button" className="st-btn wide" onClick={open(onOpenManageSkills)}>
                <span>👁️ {tx('Habilidades e ocultas')}</span> <kbd>O</kbd>
              </button>
              <button type="button" className="st-btn wide" onClick={open(onOpenLayoutEditor)}>
                <span>↕️ {tx('Editor de layout')}</span> <kbd>E</kbd>
              </button>
              <button type="button" className="st-btn wide" onClick={open(onOpenFolders)}>
                <span>🗂️ {tx('Pastas')}</span> <kbd>G</kbd>
              </button>
            </div>
          </section>
          )}

          {/* Dados */}
          <section className="st-section">
            <h4>💾 {tx('Dados e backup')}</h4>
            <p className="st-note">
              {tx('Um backup só para os três modos: Neurônios, Árvore e Habilidades de todos os perfis, com tarefas, flashcards, Pomodoro e aparência.')}
            </p>
            <div className="st-actions two">
              <button type="button" className="st-btn primary" onClick={onExport}>
                ⬇️ {tx('Fazer backup')}
              </button>
              <button type="button" className="st-btn" onClick={open(onImport)}>
                ⬆️ {tx('Importar backup')}
              </button>
            </div>
          </section>

          {/* Atalhos */}
          <section className="st-section">
            <h4>⌨️ {tx('Atalhos')}</h4>
            <button type="button" className="st-btn wide" onClick={open(onOpenCommands)}>
              {tx('Ver os atalhos de {mode}', { mode: tx(modeName) })} →
            </button>
          </section>
        </div>

        <div className="st-footer">Feito por Ricardo Bezerra :D</div>
      </div>
    </div>
  );
}

// =========================================================
// COMANDOS DO SISTEMA — lista completa, agrupada
// =========================================================
// Atalhos que valem nos três modos
const SHARED_GROUPS = [
  {
    title: 'Em todos os modos',
    items: [
      { keys: ['Alt', '1'], alt: ['Alt', '3'], text: 'Troca entre Neurônios, Árvore e Habilidades.' },
      { keys: ['P'], text: 'Perfis.' },
      { keys: ['M'], text: 'Missões diárias e diamantes.' },
      { keys: ['C'], text: 'Temas (Nanquim e Gameficado).' },
      { keys: ['T'], text: 'Checklists (tarefas).' },
      { keys: ['F'], text: 'Flashcards.' },
      { keys: ['R'], text: 'Pomodoro.' },
      { keys: ['Esc'], text: 'Fecha a janela da frente.' },
      { keys: ['Enter'], alt: ['Esc'], text: 'Numa pergunta: Sim / Não.' }
    ]
  }
];

const ARVORE_GROUPS = [
  {
    title: 'Árvore',
    items: [
      { keys: ['Clique'], text: 'Num galho: abre o painel dele.' },
      { keys: ['Shift', 'Clique'], text: 'Abre mais um painel sem fechar os outros.' },
      { keys: ['Arrastar'], text: 'Um galho: reposiciona (os subgalhos vão junto).' },
      { keys: ['Segurar'], text: 'Um galho por 1,5s: modo de troca de posição.' },
      { keys: ['Arrastar'], text: 'Uma nota até um galho: move a nota.' },
      { keys: ['Roda do mouse'], text: 'Zoom.' },
      { keys: ['Espaço', 'Espaço'], text: 'Centraliza a visão.' },
      { keys: ['Ctrl', 'Z'], alt: ['Ctrl', 'Y'], text: 'Desfaz / refaz na árvore ou no editor da nota.' },
      { keys: ['Ctrl', 'M'], text: 'Aleatoriza os galhos do tronco.' },
      { keys: ['Botão direito'], text: 'No tronco de uma árvore ao lado: juntar tudo numa árvore só.' },
      { keys: ['Ctrl', 'Clique no ×'], text: 'Fecha todas as janelas.' },
      { keys: ['Ctrl', 'S'], text: 'No editor: salva a nota.' },
      { keys: ['[palavra]'], text: 'Nas notas: cria cipós (conexões) entre galhos.' }
    ]
  }
];

const NEURONIOS_GROUPS = [
  {
    title: 'Mapa',
    items: [
      { keys: ['N'], text: 'Novo neurônio.' },
      { keys: ['/'], text: 'Buscar neurônios.' },
      { keys: ['Clique duplo'], text: 'No vazio do mapa: cria um neurônio ali.' },
      { keys: ['Clique'], text: 'Num neurônio: abre no editor.' },
      { keys: ['Ctrl', 'Clique'], text: 'Abre numa aba nova.' },
      { keys: ['Arrastar'], text: 'Move o mapa ou um neurônio.' },
      { keys: ['Roda do mouse'], text: 'Zoom.' },
      { keys: ['Esc'], text: 'Fecha a aba aberta.' }
    ]
  },
  {
    title: 'Editor',
    items: [
      { keys: ['[['], text: 'Liga a outro neurônio (ou cria um novo).' },
      { keys: ['#', 'Espaço'], text: 'Título (## e ### para menores).' },
      { keys: ['-', 'Espaço'], text: 'Lista.' },
      { keys: ['1.', 'Espaço'], text: 'Lista numerada.' },
      { keys: ['[]', 'Espaço'], text: 'Caixa de tarefa.' },
      { keys: ['>', 'Espaço'], text: 'Citação.' },
      { keys: ['Ctrl', 'K'], text: 'Link.' },
      { keys: ['Ctrl', 'Enter'], text: 'Marca/desmarca a caixa de tarefa.' },
      { keys: ['Ctrl', 'B'], alt: ['Ctrl', 'I'], text: 'Negrito / itálico.' }
    ]
  }
];

const COMMAND_GROUPS = [
  {
    title: 'Geral',
    items: [
      { keys: ['Esc'], text: 'Fecha a janela aberta. Na tela inicial, abre as Configurações.' },
      { keys: ['Espaço'], text: 'Buscar uma habilidade.' },
      { keys: ['Ctrl', 'Espaço'], text: 'Criar uma nova habilidade.' },
      { keys: ['Ctrl', 'Z'], text: 'Desfazer a última ação (vale para tudo no programa).' },
      { keys: ['Ctrl', 'Y'], alt: ['Ctrl', 'Shift', 'Z'], text: 'Refazer.' }
    ]
  },
  {
    title: 'Abrir janelas',
    items: [
      { keys: ['A'], text: 'Emoji do avatar.' },
      { keys: ['G'], text: 'Pastas e filtros.' },
      { keys: ['O'], text: 'Habilidades e ocultas.' },
      { keys: ['E'], text: 'Editor de layout (ordem das habilidades).' }
    ]
  },
  {
    title: 'Mouse e toque',
    items: [
      { keys: ['Botão direito'], text: 'Numa habilidade: editar, ocultar ou excluir.' },
      { keys: ['Botão direito'], text: 'Num espaço vazio da tela: criar nova habilidade.' },
      { keys: ['Segurar'], text: 'No celular, segurar o dedo faz o mesmo que o botão direito.' },
      { keys: ['Clique'], text: 'No contador de diamantes: ver o histórico de diamantes.' },
      { keys: ['Clique'], text: 'Na barra de XP: ver o histórico de XP.' }
    ]
  },
  {
    title: 'Checklists',
    items: [
      { keys: ['Enter'], text: 'Adiciona a tarefa digitada na adição rápida.' },
      { keys: ['Ctrl', 'Enter'], text: 'Salva a tarefa no editor.' },
      { keys: ['Clique duplo'], text: 'No nome da lista: renomear.' },
      { keys: ['Botão direito'], text: 'Numa tarefa: abrir o editor.' }
    ]
  },
  {
    title: 'Flashcards',
    items: [
      { keys: ['Espaço'], text: 'Vira a carta e mostra a resposta.' },
      { keys: ['1', '2', '3', '4'], text: 'Avalia a resposta: Errei, Difícil, Bom ou Fácil.' },
      { keys: ['Ctrl', 'Enter'], text: 'Adiciona a carta digitada no editor do deck.' },
      { keys: ['Clique duplo'], text: 'Numa carta da lista: editar.' },
      { keys: ['Botão direito'], text: 'Num deck: editar, adicionar cartas, excluir ou ligar/desligar a notificação.' }
    ]
  },
  {
    title: 'Pomodoro',
    items: [
      { keys: ['Clique'], text: 'No tempo: editar minutos e segundos.' },
      { keys: ['Enter'], text: 'Salva o tempo editado.' },
      { keys: ['Arrastar'], text: 'Move a janelinha flutuante do Pomodoro.' },
      { keys: ['Botão direito'], text: 'Na janelinha flutuante: criar um novo timer.' }
    ]
  }
];

const Keys = ({ keys }) => (
  <span className="cm-keys">
    {keys.map((k, i) => (
      <React.Fragment key={i}>
        {i > 0 && <span className="cm-plus">+</span>}
        <kbd>{tx(k)}</kbd>
      </React.Fragment>
    ))}
  </span>
);

const TABS = [
  { id: 'neuronios', name: 'Neurônios', groups: NEURONIOS_GROUPS },
  { id: 'arvore', name: 'Árvore', groups: ARVORE_GROUPS },
  { id: 'skills', name: 'Habilidades', groups: COMMAND_GROUPS },
  { id: 'shared', name: 'Ferramentas', groups: SHARED_GROUPS }
];

export function CommandsModal({ isOpen, onClose, playSound }) {
  useLanguage();
  const mode = useMode();
  const [tab, setTab] = useState(mode);
  // Abre na aba do modo em que você está
  useEffect(() => {
    if (isOpen) setTab(mode);
  }, [isOpen, mode]);
  if (!isOpen) return null;
  const current = TABS.find((t) => t.id === tab) || TABS[2];

  const close = () => {
    if (playSound) playSound('click');
    onClose();
  };

  return (
    <div className="modal-backdrop high-z-backdrop" onClick={close}>
      <div className="modal-window st-window cm-window high-z-window" onClick={(e) => e.stopPropagation()}>
        <div className="st-header">
          <div>
            <h3>⌨️ {tx('Comandos do sistema')}</h3>
            <p>{tx('Atalhos de teclado, mouse e toque')}</p>
          </div>
          <button type="button" className="st-close" onClick={close} title={tx('Fechar (Esc)')}>
            ✕
          </button>
        </div>

        <div className="cm-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => {
                if (playSound) playSound('click');
                setTab(t.id);
              }}
            >
              {tx(t.name)}
            </button>
          ))}
        </div>

        <div className="st-body">
          {current.groups.map((group) => (
            <section key={group.title} className="st-section">
              <h4>{tx(group.title)}</h4>
              <div className="cm-list">
                {group.items.map((item, i) => (
                  <div key={i} className="cm-item">
                    <span className="cm-combo">
                      <Keys keys={item.keys} />
                      {item.alt && (
                        <>
                          <span className="cm-or">{tx('ou')}</span>
                          <Keys keys={item.alt} />
                        </>
                      )}
                    </span>
                    <span className="cm-text">{tx(item.text)}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
