import React, { useState, useEffect } from 'react';
import './Themes.css';
import { tx, useLanguage } from '../i18n/index.jsx';
import { THEME_CATEGORIES, makeTheme, findCategoryOf, getThemeById } from './Themes.js';
import { useUiTheme, setVisual, setNanquimTheme } from '../shared/uiTheme.js';
import { NANQUIM_THEMES } from '../shared/nanquimThemes.js';

// Degradê de verdade de um tema do Gameficado (cor de destaque → borda → fundo)
const themeGradient = (t) =>
  `linear-gradient(145deg, ${t.color} 0%, ${t.border || t.color} 45%, ${t.boxBg || t.modalBg || '#0b0f1a'} 75%, ${t.modalBg || '#0b0f1a'} 100%)`;

// Tema do Nanquim: só a cor, o nome e a descrição
function NanquimCard({ theme, palette, accent, active, onClick }) {
  return (
    <button type="button" className={`th-card th-simple ${active ? 'active' : ''}`} onClick={onClick}>
      <span
        className="th-swatch"
        style={{
          background: `linear-gradient(145deg, ${accent} 0%, ${palette.foliage2 || accent} 38%, ${palette.paper3 || palette.bg} 72%, ${palette.paper} 100%)`
        }}
      />
      <span className="th-text">
        <span className="th-name">{tx(theme.name)}</span>
        <small className="th-desc">{tx(theme.desc)}</small>
      </span>
      {active && <span className="th-check">✓</span>}
    </button>
  );
}

// Quantas categorias aparecem antes do botão "+"
const VISIBLE_CATEGORIES = 3;

const EMPTY_DRAFT = { id: null, name: '', color: '#f472b6', base: '#2a0a1f' };

// Tema do Gameficado: só a cor, o nome e a descrição (a família de cores)
function ThemeCard({ theme, active, editing, favorite, onClick, onContextMenu, label }) {
  const catId = theme.custom ? 'custom' : findCategoryOf(theme.id);
  const cat = THEME_CATEGORIES.find((c) => c.id === catId);
  const desc = theme.custom || catId === 'custom' ? tx('Tema criado por você') : cat ? tx(cat.name) : '';
  return (
    <button
      type="button"
      className={`th-card th-simple ${active ? 'active' : ''} ${editing ? 'editing' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <span
        className="th-swatch"
        style={{ background: themeGradient(theme) }}
      />
      <span className="th-text">
        <span className="th-name">{label}</span>
        {desc && <small className="th-desc">{desc}</small>}
      </span>
      {active && <span className="th-check">✓</span>}
      {editing && <span className="th-edit-badge">✏️</span>}
      {favorite && !editing && <span className="th-fav-badge" title={tx('Favorito')}>★</span>}
    </button>
  );
}

export function ThemeModal({
  isOpen,
  onClose,
  playSound,
  nickname,
  currentTheme,
  setCurrentTheme,
  customThemes,
  setCustomThemes,
  favoriteThemes = [],
  setFavoriteThemes
}) {
  useLanguage();
  const ui = useUiTheme();
  // só existe o visual Gameficado
  const family = 'gamificado';
  const setFamily = () => {};
  const [category, setCategory] = useState(() => findCategoryOf(currentTheme, customThemes));
  const [expanded, setExpanded] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [menu, setMenu] = useState(null); // menu do botão direito { x, y, theme }

  // Fecha o menu ao clicar fora
  useEffect(() => {
    if (!menu) return undefined;
    const closeMenu = () => setMenu(null);
    window.addEventListener('click', closeMenu);
    window.addEventListener('resize', closeMenu);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('resize', closeMenu);
    };
  }, [menu]);

  // Ao abrir, mostra a categoria do tema atual
  useEffect(() => {
    if (!isOpen) return;
    setFamily(ui.visual);
    const cat = findCategoryOf(currentTheme, customThemes);
    setCategory(cat);
    const idx = THEME_CATEGORIES.findIndex((c) => c.id === cat);
    if (idx >= VISIBLE_CATEGORIES) setExpanded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const click = (type = 'click') => playSound && playSound(type);
  const close = () => {
    click();
    setIsEditMode(false);
    setDraft(EMPTY_DRAFT);
    onClose();
  };

  const tabs = expanded ? THEME_CATEGORIES : THEME_CATEGORIES.slice(0, VISIBLE_CATEGORIES);
  const hiddenCount = THEME_CATEGORIES.length - VISIBLE_CATEGORIES;
  const isCustom = category === 'custom';
  const isFavorites = category === 'favorites';
  // Favoritos guardam só o id; temas que deixaram de existir são ignorados
  const favoriteList = favoriteThemes
    .map((id) => getThemeById(id, customThemes))
    .filter((t, i) => t.id === favoriteThemes[i]);
  const themes = isFavorites
    ? favoriteList
    : isCustom
    ? customThemes
    : THEME_CATEGORIES.find((c) => c.id === category)?.themes || [];

  const isFavorite = (id) => favoriteThemes.includes(id);
  const toggleFavorite = (id) => {
    if (!setFavoriteThemes) return;
    click(isFavorite(id) ? 'delete' : 'train');
    setFavoriteThemes((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  };
  const openMenu = (e, theme) => {
    e.preventDefault();
    e.stopPropagation();
    click();
    const x = Math.min(e.clientX, window.innerWidth - 230);
    const y = Math.min(e.clientY, window.innerHeight - 120);
    setMenu({ x, y, theme });
  };

  const previewTheme = makeTheme('preview', draft.name, draft.color, draft.base);

  const startEdit = (theme) => {
    click();
    setDraft({ id: theme.id, name: theme.name, color: theme.color, base: theme.base });
  };

  const saveDraft = () => {
    const name = draft.name.trim() || tx('Meu tema');
    if (draft.id) {
      setCustomThemes((list) => list.map((t) => (t.id === draft.id ? { ...t, name, color: draft.color, base: draft.base } : t)));
      setCurrentTheme(draft.id);
    } else {
      const id = `custom_${Date.now().toString(36)}`;
      setCustomThemes((list) => [...list, { id, name, color: draft.color, base: draft.base }]);
      setCurrentTheme(id);
    }
    click('train');
    setDraft(EMPTY_DRAFT);
  };

  const deleteDraft = () => {
    if (!draft.id) return;
    click('delete');
    setCustomThemes((list) => list.filter((t) => t.id !== draft.id));
    if (currentTheme === draft.id) setCurrentTheme('cyberpunk');
    setDraft(EMPTY_DRAFT);
  };

  const toggleEditMode = () => {
    click();
    const next = !isEditMode;
    setIsEditMode(next);
    setDraft(EMPTY_DRAFT);
    if (next) setCategory('custom');
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal-window th-window" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className="th-header">
          <div>
            <h3>🎨 {tx('Temas')}</h3>
            <p>{tx('Perfil')}: {nickname}</p>
          </div>
          <div className="th-header-actions">
            {family === 'gamificado' && (
            <button
              type="button"
              className={`th-icon-btn ${isEditMode ? 'is-on' : ''}`}
              onClick={toggleEditMode}
              title={isEditMode ? tx('Concluir edição') : tx('Criar e editar seus temas')}
            >
              ✏️
            </button>
            )}
            <button type="button" className="th-icon-btn close" onClick={close} title={tx('Fechar (Esc)')}>
              ✕
            </button>
          </div>
        </div>

        {family === 'gamificado' && (
        <>
        {/* Categorias */}
        <div className="th-tabs">
          {tabs.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`th-tab ${category === cat.id ? 'active' : ''}`}
              onClick={() => {
                click();
                setCategory(cat.id);
                setDraft(EMPTY_DRAFT);
              }}
            >
              <span>{cat.icon}</span> {tx(cat.name)}
            </button>
          ))}
          <button
            type="button"
            className="th-tab more"
            onClick={() => {
              click();
              setExpanded((v) => !v);
            }}
            title={expanded ? tx('Mostrar menos categorias') : tx('Mostrar mais categorias')}
          >
            {expanded ? '−' : `+ ${hiddenCount}`}
          </button>
          <button
            type="button"
            className={`th-tab fav ${isFavorites ? 'active' : ''}`}
            onClick={() => {
              click();
              setCategory('favorites');
              setDraft(EMPTY_DRAFT);
            }}
            title={tx('Clique com o botão direito num tema para favoritar')}
          >
            <span>⭐</span> {tx('Favoritos')}
            {favoriteList.length > 0 && <em>{favoriteList.length}</em>}
          </button>
          <button
            type="button"
            className={`th-tab custom ${isCustom ? 'active' : ''}`}
            onClick={() => {
              click();
              setCategory('custom');
            }}
          >
            <span>🎨</span> {tx('Meus Temas')}
            {customThemes.length > 0 && <em>{customThemes.length}</em>}
          </button>
        </div>

        {/* Editor dos temas criados (lápis) */}
        {isEditMode && (
          <div className="th-editor">
            <div className="th-editor-preview">
              <ThemeCard theme={previewTheme} label={draft.name || tx('Meu tema')} />
            </div>
            <div className="th-editor-fields">
              <span className="th-editor-title">{draft.id ? tx('Editar tema') : tx('Novo tema')}</span>
              <input
                className="th-input"
                type="text"
                placeholder={tx('Nome do tema (ex: Meia-Noite Rubi)')}
                value={draft.name}
                maxLength={40}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && saveDraft()}
              />
              <div className="th-colors">
                <label className="th-color">
                  <input type="color" value={draft.color} onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))} />
                  <span>
                    <strong>{tx('Cor de destaque')}</strong>
                    <small>{tx('Botões, brilhos e detalhes')}</small>
                  </span>
                </label>
                <label className="th-color">
                  <input type="color" value={draft.base} onChange={(e) => setDraft((d) => ({ ...d, base: e.target.value }))} />
                  <span>
                    <strong>{tx('Cor de fundo')}</strong>
                    <small>{tx('Use tons escuros para ler melhor')}</small>
                  </span>
                </label>
              </div>
              <div className="th-editor-actions">
                {draft.id && (
                  <button type="button" className="th-btn danger" onClick={deleteDraft}>
                    🗑 {tx('Excluir')}
                  </button>
                )}
                {draft.id && (
                  <button
                    type="button"
                    className="th-btn ghost"
                    onClick={() => {
                      click();
                      setDraft(EMPTY_DRAFT);
                    }}
                  >
                    {tx('Cancelar')}
                  </button>
                )}
                <button type="button" className="th-btn primary" onClick={saveDraft}>
                  {draft.id ? tx('Salvar e aplicar') : tx('Criar e aplicar')}
                </button>
              </div>
              {customThemes.length > 0 && !draft.id && (
                <small className="th-hint">{tx('Clique num tema seu abaixo para editar o nome e as cores.')}</small>
              )}
            </div>
          </div>
        )}

        {/* Temas da categoria */}
        {themes.length === 0 && isFavorites ? (
          <div className="th-empty">
            <span>⭐</span>
            <p>{tx('Nenhum tema favorito ainda.')}</p>
            <small>{tx('Clique com o botão direito num tema para adicionar aos favoritos.')}</small>
          </div>
        ) : themes.length === 0 ? (
          <div className="th-empty">
            <span>🎨</span>
            <p>{tx('Você ainda não criou nenhum tema.')}</p>
            {!isEditMode && (
              <button type="button" className="th-btn primary" onClick={toggleEditMode}>
                ✏️ {tx('Criar meu primeiro tema')}
              </button>
            )}
          </div>
        ) : (
          <div className="th-grid">
            {themes.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                active={ui.visual === 'gamificado' && currentTheme === theme.id}
                editing={isEditMode && theme.custom}
                favorite={isFavorite(theme.id)}
                onContextMenu={(e) => openMenu(e, theme)}
                // Temas criados pelo usuário não são traduzidos (são dados dele)
                label={theme.custom ? theme.name : tx(theme.name)}
                onClick={() => {
                  if (isEditMode && theme.custom) {
                    startEdit(theme);
                    return;
                  }
                  click('train');
                  setCurrentTheme(theme.id);
                  setVisual('gamificado');
                }}
              />
            ))}
          </div>
        )}

        </>
        )}

        {/* Menu do botão direito: favoritar / aplicar */}
        {menu && (
          <div className="th-menu" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
            <span className="th-menu-title">{menu.theme.custom ? menu.theme.name : tx(menu.theme.name)}</span>
            <button
              type="button"
              onClick={() => {
                toggleFavorite(menu.theme.id);
                setMenu(null);
              }}
            >
              {isFavorite(menu.theme.id) ? `☆ ${tx('Remover dos favoritos')}` : `⭐ ${tx('Adicionar aos favoritos')}`}
            </button>
            {currentTheme !== menu.theme.id && (
              <button
                type="button"
                onClick={() => {
                  click('train');
                  setCurrentTheme(menu.theme.id);
                  setVisual('gamificado');
                  setMenu(null);
                }}
              >
                🎨 {tx('Aplicar tema')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
