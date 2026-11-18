import React, { useEffect, useState } from 'react';
import './ColorDeck.css';
import { tx, useLanguage } from '../i18n/index.jsx';

// =========================================================
// CORES E DECKS
// Criador de cor (prévia grande + nome + hex) à esquerda,
// decks em abas à direita. Clicar numa cor já aplica.
// =========================================================

const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v || '');

// Texto legível por cima da cor (preto ou branco)
const readableOn = (hex) => {
  if (!isHex(hex)) return '#fff';
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#0f172a' : '#fff';
};

export default function ColorDeckModal({
  isOpen,
  onClose,
  playSound,
  pickedColor,
  setPickedColor,
  colorName,
  setColorName,
  currentColor,
  presetDecks,
  activeDeckId,
  setActiveDeckId,
  customDeck,
  onAddCustom,
  onRemoveCustom,
  onApply
}) {
  useLanguage();
  const [viewDeck, setViewDeck] = useState(activeDeckId);
  const [hexDraft, setHexDraft] = useState(pickedColor);

  // Ao abrir, mostra o deck padrão
  useEffect(() => {
    if (isOpen) setViewDeck(activeDeckId);
  }, [isOpen, activeDeckId]);

  useEffect(() => {
    setHexDraft(pickedColor);
  }, [pickedColor]);

  if (!isOpen) return null;

  const click = (t = 'click') => playSound && playSound(t);
  const close = () => {
    click();
    onClose();
  };

  const decks = [
    ...presetDecks.map((d) => ({ ...d, custom: false })),
    { id: 'deck_custom', name: 'Meu Deck Personalizado', colors: customDeck, custom: true }
  ];
  const deck = decks.find((d) => d.id === viewDeck) || decks[0];
  const valid = isHex(pickedColor);
  const safeColor = valid ? pickedColor : '#888888';
  const alreadySaved = customDeck.some((c) => c.hex.toLowerCase() === safeColor.toLowerCase());

  const commitHex = (raw) => {
    let v = raw.trim();
    if (v && v[0] !== '#') v = `#${v}`;
    if (/^#[0-9a-f]{3}$/i.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
    setHexDraft(v);
    if (isHex(v)) setPickedColor(v.toLowerCase());
  };

  return (
    <div className="modal-backdrop high-z-backdrop" onClick={close}>
      <div className="modal-window high-z-window cd-window" onClick={(e) => e.stopPropagation()}>
        <div className="cd-header">
          <div>
            <h3>🎨 {tx('Cores e Decks')}</h3>
            <p>{tx('Clique numa cor para usar na habilidade, ou crie a sua.')}</p>
          </div>
          <button type="button" className="st-close" onClick={close} title={tx('Fechar (Esc)')}>
            ✕
          </button>
        </div>

        <div className="cd-body">
          {/* ---------- Criador ---------- */}
          <section className="cd-creator">
            <label className="cd-preview" style={{ background: safeColor, color: readableOn(safeColor) }}>
              <input type="color" value={safeColor} onChange={(e) => setPickedColor(e.target.value)} />
              <span className="cd-preview-name">{colorName.trim() || tx('Nova Cor')}</span>
              <span className="cd-preview-hex">{safeColor.toUpperCase()}</span>
              <span className="cd-preview-hint">🖌️ {tx('Clique para escolher')}</span>
            </label>

            {/* Como a cor fica numa habilidade */}
            <div className="cd-sample">
              <div className="cd-sample-top">
                <span className="cd-sample-dot" style={{ background: safeColor }} />
                <strong>{tx('Prévia')}</strong>
                <span>{tx('Nv.')} 3</span>
              </div>
              <div className="cd-sample-bar">
                <span style={{ width: '62%', background: safeColor, boxShadow: `0 0 10px ${safeColor}` }} />
              </div>
            </div>

            <div className="cd-fields">
              <label>
                <span>{tx('Nome')}</span>
                <input
                  type="text"
                  value={colorName}
                  maxLength={24}
                  placeholder={tx('Nome (opcional)')}
                  onChange={(e) => setColorName(e.target.value)}
                />
              </label>
              <label className="cd-hex">
                <span>Hex</span>
                <input
                  type="text"
                  value={hexDraft}
                  maxLength={7}
                  spellCheck={false}
                  className={isHex(hexDraft) ? '' : 'invalid'}
                  onChange={(e) => commitHex(e.target.value)}
                />
              </label>
            </div>

            {currentColor && (
              <button
                type="button"
                className="cd-current"
                onClick={() => {
                  click();
                  setPickedColor(currentColor);
                }}
                title={tx('Voltar para a cor atual')}
              >
                <span style={{ background: currentColor }} />
                {tx('Cor atual')} · {String(currentColor).toUpperCase()}
              </button>
            )}

            <div className="cd-actions">
              <button
                type="button"
                className="cd-btn primary"
                disabled={!valid}
                style={{ background: safeColor, color: readableOn(safeColor) }}
                onClick={() => onApply(safeColor)}
              >
                ✔ {tx('Usar Esta Cor')}
              </button>
              <button
                type="button"
                className="cd-btn"
                disabled={!valid || alreadySaved}
                onClick={() => {
                  click('train');
                  onAddCustom(colorName.trim() || 'Nova Cor', safeColor);
                  setViewDeck('deck_custom');
                }}
                title={alreadySaved ? tx('Essa cor já está no seu deck') : ''}
              >
                {alreadySaved ? `✓ ${tx('Já está no Meu Deck')}` : `＋ ${tx('Salvar no Meu Deck')}`}
              </button>
            </div>
          </section>

          {/* ---------- Decks ---------- */}
          <section className="cd-decks">
            <div className="cd-deck-tabs" role="tablist">
              {decks.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  role="tab"
                  aria-selected={deck.id === d.id}
                  className={`cd-deck-tab ${deck.id === d.id ? 'active' : ''}`}
                  onClick={() => {
                    click();
                    setViewDeck(d.id);
                  }}
                >
                  <span className="cd-deck-strip">
                    {d.colors.length === 0 ? (
                      <i className="empty" />
                    ) : (
                      d.colors.slice(0, 6).map((c) => <i key={c.id || c.hex} style={{ background: c.hex }} />)
                    )}
                  </span>
                  <span className="cd-deck-tab-name">
                    {activeDeckId === d.id && <b title={tx('Deck Padrão')}>⭐</b>}
                    {tx(d.name)}
                  </span>
                </button>
              ))}
            </div>

            <div className="cd-deck-panel">
              <div className="cd-deck-head">
                <div>
                  <h4>{tx(deck.name)}</h4>
                  <small>
                    {deck.colors.length} {deck.colors.length === 1 ? tx('cor') : tx('cores')}
                  </small>
                </div>
                <button
                  type="button"
                  className={`cd-default ${activeDeckId === deck.id ? 'on' : ''}`}
                  disabled={activeDeckId === deck.id}
                  onClick={() => {
                    click();
                    setActiveDeckId(deck.id);
                  }}
                  title={tx('As cores do deck padrão aparecem ao criar e editar habilidades')}
                >
                  {activeDeckId === deck.id ? `⭐ ${tx('Deck Padrão')}` : `☆ ${tx('Definir como Deck Padrão')}`}
                </button>
              </div>

              <div className="cd-grid">
                {deck.colors.map((c) => {
                  const selected = String(currentColor || '').toLowerCase() === c.hex.toLowerCase();
                  return (
                    <div key={c.id || c.hex} className={`cd-tile ${selected ? 'selected' : ''}`}>
                      <button
                        type="button"
                        className="cd-tile-main"
                        onClick={() => onApply(c.hex)}
                        title={`${tx('Usar')} ${tx(c.name)} (${c.hex})`}
                      >
                        <span className="cd-tile-color" style={{ background: c.hex }}>
                          {selected && <em style={{ color: readableOn(c.hex) }}>✓</em>}
                        </span>
                        <span className="cd-tile-name">{tx(c.name)}</span>
                        <span className="cd-tile-hex">{c.hex.toUpperCase()}</span>
                      </button>
                      {deck.custom && (
                        <button
                          type="button"
                          className="cd-tile-del"
                          onClick={() => {
                            click('delete');
                            onRemoveCustom(c.id);
                          }}
                          title={tx('Remover cor do deck')}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}

                {deck.custom && (
                  <button
                    type="button"
                    className="cd-tile add"
                    disabled={!valid || alreadySaved}
                    onClick={() => {
                      click('train');
                      onAddCustom(colorName.trim() || 'Nova Cor', safeColor);
                    }}
                    title={tx('Salvar no Meu Deck')}
                  >
                    <span className="cd-tile-color" style={{ background: valid ? safeColor : undefined }}>
                      ＋
                    </span>
                    <span className="cd-tile-name">{alreadySaved ? tx('Já está no Meu Deck') : tx('Adicionar a cor criada')}</span>
                  </button>
                )}
              </div>

              {deck.custom && deck.colors.length === 0 && (
                <p className="cd-empty">{tx('Crie uma cor ao lado e salve aqui para montar seu deck.')}</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
