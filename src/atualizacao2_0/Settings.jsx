import React from 'react';
import './Settings.css';
import { useLanguage, LANGUAGES, tx } from '../i18n/index.jsx';

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
  if (!isOpen) return null;

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
            <p>{tx('Aparência, idioma, habilidades e seus dados')}</p>
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

          {/* Aparência */}
          <section className="st-section">
            <h4>🎨 {tx('Aparência')}</h4>
            <div className="st-row">
              <div className="st-row-text">
                <strong>{tx('Tema visual')}</strong>
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

          {/* Habilidades */}
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

          {/* Dados */}
          <section className="st-section">
            <h4>💾 {tx('Dados e backup')}</h4>
            <p className="st-note">
              {tx('O backup inclui perfis, habilidades, missões, diamantes, checklists e Pomodoro.')}
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
              {tx('Ver todos os comandos do sistema')} →
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
      { keys: ['C'], text: 'Tema visual e cores.' },
      { keys: ['P'], text: 'Perfis.' },
      { keys: ['A'], text: 'Emoji do avatar.' },
      { keys: ['M'], text: 'Missões diárias e diamantes.' },
      { keys: ['T'], text: 'Checklists (tarefas).' },
      { keys: ['F'], text: 'Flashcards.' },
      { keys: ['R'], text: 'Pomodoro.' },
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

export function CommandsModal({ isOpen, onClose, playSound }) {
  useLanguage();
  if (!isOpen) return null;

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

        <div className="st-body">
          {COMMAND_GROUPS.map((group) => (
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
