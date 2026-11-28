import React, { useState, useRef, useEffect, useMemo } from 'react';
import './Hero.css';
import { tx, useLanguage } from '../i18n/index.jsx';
import {
  HERO_CLASSES,
  OUTFIT_COLORS,
  DETAIL_COLORS,
  PANTS_COLORS,
  SHOE_COLORS,
  TRIM_COLORS,
  statsFor,
  MAX_STAT_LEVEL,
  normalizeHero,
  getLook,
  getStatLevels,
  upgradeCost,
  getHeroClass,
  heroNameFor,
  SKIN_COLORS,
  EYE_COLORS,
  HAIR_COLORS,
  classFor,
  findCustom,
  isCustomClass,
  newCustomId
} from './HeroModels.js';
import { buildHero2D, cellsFromPixels, pixelsFromHero, HAIR_STYLES_2D, BEARD_STYLES_2D, MOUTH_STYLES_2D, EYE_STYLES_2D } from './Hero2D.js';
import { CellsSvg } from './Hero2DView.jsx';
import PixelEditor from './PixelEditor.jsx';
import { ask } from '../shared/Dialog.jsx';

// =========================================================
// HERÓI 2D EM PIXEL (no formato desenhado pelo Ricardo)
// Clique abre o personagem · arraste para os lados vira de lado
// =========================================================

// Desenho do personagem: os 3 padrão (montados por camadas) ou um desenhado no criador
function Hero2DSvg({ hero, cls }) {
  const custom = isCustomClass(cls) ? findCustom(hero, cls) : null;
  const override = !custom && hero.pixelOverrides ? hero.pixelOverrides[cls] : null;
  const look = custom || override ? null : getLook(hero, cls);
  const lookKey = look ? JSON.stringify(look) : '';
  const cells = useMemo(
    () => (custom ? cellsFromPixels(custom.pixels) : override ? cellsFromPixels(override) : buildHero2D(cls, look)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [custom, override, cls, lookKey]
  );
  return <CellsSvg cells={cells} />;
}

// Personagem completo. `rotation` (herança do 3D) decide para que lado ele olha;
// `flip` força olhar para a esquerda. `pose`: idle · walk · jump (Santuário).
export function HeroModel({ hero, cls, rotation = 0, hop = 0, size = 1, still = false, limbs = false, pose = null, flip }) {
  const h = normalizeHero(hero);
  const id = cls || h.cls;
  const deg = (((rotation % 360) + 360) % 360);
  const left = flip !== undefined ? flip : deg > 90 && deg < 270;
  return (
    <div className={`h2d-model ${still ? 'still' : ''} ${limbs ? 'limbs' : ''} ${pose ? `pose-${pose}` : ''}`} style={{ '--h2d-size': size }}>
      <div className="h2d-shadow" />
      <div className={`h2d-hop ${hop ? 'hopping' : ''}`} key={hop}>
        <div className={`h2d-flip ${left ? 'left' : ''}`}>
          <Hero2DSvg hero={h} cls={id} />
        </div>
      </div>
    </div>
  );
}

// Arrastar para girar + clique + segurar (toque longo)
function useHeroGestures({ onTap, onHold } = {}) {
  const [rotation, setRotation] = useState(0);
  const drag = useRef(null);
  const holdTimer = useRef(null);

  useEffect(() => () => clearTimeout(holdTimer.current), []);

  const handlers = {
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      drag.current = { x: e.clientX, start: rotation, moved: false, held: false };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (err) {}
      clearTimeout(holdTimer.current);
      if (onHold) {
        holdTimer.current = setTimeout(() => {
          if (drag.current && !drag.current.moved) {
            drag.current.held = true;
            onHold();
          }
        }, 550);
      }
    },
    onPointerMove: (e) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      if (!d.moved && Math.abs(dx) > 5) {
        d.moved = true;
        clearTimeout(holdTimer.current);
      }
      if (d.moved) setRotation(dx < 0 ? 180 : 0);
    },
    onPointerUp: () => {
      clearTimeout(holdTimer.current);
      const d = drag.current;
      drag.current = null;
      if (d && !d.moved && !d.held && onTap) onTap();
    },
    onPointerCancel: () => {
      clearTimeout(holdTimer.current);
      drag.current = null;
    },
    onContextMenu: (e) => e.preventDefault()
  };

  return { rotation, handlers };
}

// ---------- Tela inicial: herói + balão de pensamento ----------
export function ThoughtBubble({ emoji, onClick }) {
  return (
    <button type="button" className="hero-thought" onClick={onClick} title={tx('Clique no balão para trocar o emoji (A)')}>
      <span className="hero-thought-dot small" />
      <span className="hero-thought-dot" />
      <span className="hero-thought-bubble">{emoji}</span>
    </button>
  );
}

export function HeroStage({ emoji, onEmojiClick, hero: rawHero, onOpenMenu }) {
  useLanguage();
  const hero = normalizeHero(rawHero);
  // Clique (ou segurar) abre o personagem; arrastar para os lados gira
  const { rotation, handlers } = useHeroGestures({ onTap: onOpenMenu, onHold: onOpenMenu });

  return (
    <div className="hero-stage">
      <div className="vx-stage" {...handlers} title={tx('Clique para abrir o personagem · arraste para virar de lado')}>
        <HeroModel hero={hero} rotation={rotation} />
      </div>
      <ThoughtBubble emoji={emoji} onClick={onEmojiClick} />
    </div>
  );
}

// ---------- Upgrades com cara de jogo ----------
const RANKS = [
  { min: 0, name: 'Bronze', color: '#d08a4a' },
  { min: 10, name: 'Prata', color: '#cbd5e1' },
  { min: 20, name: 'Ouro', color: '#facc15' },
  { min: 35, name: 'Diamante', color: '#67e8f9' },
  { min: 50, name: 'Lenda', color: '#f472b6' }
];
function UpgradeArcade({ hero, heroClass, diamonds, onUpgrade, click }) {
  const levels = getStatLevels(hero, heroClass.id);
  const stats = statsFor(heroClass);
  const [flash, setFlash] = useState(null);
  const total = stats.reduce((a, st) => a + (levels[st.id] || 0), 0);
  const maxTotal = stats.length * MAX_STAT_LEVEL;
  const power = stats.reduce((a, st) => a + ((heroClass.base?.[st.id] || 0) + (levels[st.id] || 0)) * 10, 0);
  let rank = RANKS[0];
  RANKS.forEach((r) => {
    if (total >= Math.round((r.min / 50) * maxTotal)) rank = r;
  });
  const next = RANKS[RANKS.indexOf(rank) + 1];

  return (
    <div className="ga-panel">
      <div className="ga-top">
        <div className="ga-box">
          <small>{tx('PODER')}</small>
          <strong>{power}</strong>
        </div>
        <div className="ga-box ga-rank" style={{ '--rank': rank.color }}>
          <small>{tx('RANK')}</small>
          <strong>{tx(rank.name)}</strong>
        </div>
        <div className="ga-box ga-gems" title={tx('Seus diamantes')}>
          <small>{tx('DIAMANTES')}</small>
          <strong>💎 {diamonds}</strong>
        </div>
      </div>

      <div className="ga-xp">
        <div className="ga-xp-bar">
          <span style={{ width: `${(total / maxTotal) * 100}%` }} />
        </div>
        <small>
          {total}/{maxTotal} {tx('níveis')}
          {next ? ` · ${tx('próximo rank')}: ${tx(next.name)}` : ` · ${tx('rank máximo!')}`}
        </small>
      </div>

      <div className="ga-list">
        {stats.map((st) => {
          const lvl = levels[st.id] || 0;
          const base = heroClass.base?.[st.id] || 0;
          const maxed = lvl >= MAX_STAT_LEVEL;
          const cost = upgradeCost(lvl);
          const canBuy = !maxed && diamonds >= cost;
          return (
            <div key={st.id} className={`ga-card ${maxed ? 'maxed' : ''} ${flash === st.id ? 'flash' : ''}`} title={tx(st.desc)}>
              <span className="ga-badge">{st.icon}</span>
              <div className="ga-info">
                <div className="ga-line">
                  <strong>{tx(st.name)}</strong>
                  <span className="ga-val">{base + lvl}</span>
                  <span className="ga-lvl">
                    {tx('NV')} {lvl}/{MAX_STAT_LEVEL}
                  </span>
                </div>
                <div className="ga-seg">
                  {Array.from({ length: MAX_STAT_LEVEL }).map((_, i) => (
                    <span key={i} className={i < lvl ? 'on' : ''} />
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="ga-buy"
                disabled={!canBuy}
                onClick={() => {
                  if (!canBuy) return;
                  click('train');
                  onUpgrade(st, lvl, cost);
                  setFlash(st.id);
                  setTimeout(() => setFlash((f) => (f === st.id ? null : f)), 700);
                }}
                title={maxed ? tx('Nível máximo') : canBuy ? tx('Melhorar') : tx('Diamantes insuficientes')}
              >
                {maxed ? (
                  'MAX'
                ) : (
                  <>
                    <b>{tx('UPAR')}</b>
                    <small>💎 {cost}</small>
                  </>
                )}
              </button>
              {flash === st.id && <span className="ga-pop">+1</span>}
            </div>
          );
        })}
      </div>
      <p className="ga-tip">{tx('Ganhe diamantes completando as missões diárias.')}</p>
    </div>
  );
}

// Fileira de amostras de cor (com cor personalizada no fim).
// O nome da cor aparece ao passar o mouse (e fica mostrando a escolhida).
function Swatches({ colors, value, onPick, click, allowTheme = false, customFallback = '#ffffff' }) {
  const [hover, setHover] = useState(null);
  const items = colors
    .map((c) => (typeof c === 'string' ? { hex: c, name: c } : c))
    .filter((c) => c.hex);
  const nameOf = (hex) => {
    if (!hex) return tx('Cor do tema');
    const found = items.find((c) => c.hex.toLowerCase() === String(hex).toLowerCase());
    return found ? tx(found.name) : `${tx('Cor personalizada')} (${hex})`;
  };
  const shown = hover || { hex: value, name: nameOf(value) };
  const tip = (name) => ({
    title: name,
    'aria-label': name,
    onBlur: () => setHover(null)
  });

  return (
    <div className="hm-swatch-group" onMouseLeave={() => setHover(null)}>
      <div className="hm-swatch-caption">
        <span
          className={`hm-swatch-caption-dot ${!shown.hex ? 'theme' : ''}`}
          style={shown.hex ? { background: shown.hex } : undefined}
        />
        <span>{shown.name}</span>
      </div>
      <div className="hm-swatches">
        {allowTheme && (
          <button
            type="button"
            className={`hm-swatch theme ${!value ? 'active' : ''}`}
            {...tip(tx('Cor do tema'))}
            onMouseEnter={() => setHover({ hex: null, name: tx('Cor do tema') })}
            onFocus={() => setHover({ hex: null, name: tx('Cor do tema') })}
            onClick={() => {
              click();
              onPick(null);
            }}
          />
        )}
        {items.map((c) => (
          <button
            key={c.hex}
            type="button"
            className={`hm-swatch ${value === c.hex ? 'active' : ''}`}
            style={{ background: c.hex }}
            {...tip(tx(c.name))}
            onMouseEnter={() => setHover({ hex: c.hex, name: tx(c.name) })}
            onFocus={() => setHover({ hex: c.hex, name: tx(c.name) })}
            onClick={() => {
              click();
              onPick(c.hex);
            }}
          />
        ))}
        <label
          className="hm-swatch custom"
          title={tx('Cor personalizada')}
          onMouseEnter={() => setHover({ hex: value || customFallback, name: tx('Cor personalizada') })}
        >
          <input type="color" value={value || customFallback} onChange={(e) => onPick(e.target.value)} />
          <span>＋</span>
        </label>
      </div>
    </div>
  );
}

// Botões de escolha (estilo de cabelo, barba, armadura, elmo)
function OptionChips({ options, value, onPick, click }) {
  return (
    <div className="hm-chips">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`hm-chip ${value === o.id ? 'active' : ''}`}
          onClick={() => {
            if (value !== o.id) click();
            onPick(o.id);
          }}
        >
          {o.icon && <span aria-hidden="true">{o.icon}</span>}
          {tx(o.name)}
        </button>
      ))}
    </div>
  );
}

// ---------- Menu do personagem ----------
export function HeroMenu({ isOpen, onClose, hero: rawHero, setHero, playSound, diamonds = 0, onSpend }) {
  useLanguage();
  const [tab, setTab] = useState('upgrades');
  const [drawing, setDrawing] = useState(null); // { id?, name, pixels } aberto no criador
  const { rotation, handlers } = useHeroGestures();

  // Ao abrir, começa sempre na ficha de upgrades
  useEffect(() => {
    if (isOpen) setTab('upgrades');
  }, [isOpen]);

  if (!isOpen) return null;

  const hero = normalizeHero(rawHero);
  const heroClass = classFor(hero, hero.cls);
  const look = getLook(hero, heroClass.id);
  const heroName = heroNameFor(heroClass);

  const click = (type = 'click') => playSound && playSound(type);
  const close = () => {
    click();
    onClose();
  };
  const save = (fn) => setHero((prev) => fn(normalizeHero(prev)));
  // Tudo que for personalizado fica só no personagem atual
  const updateLook = (fields) =>
    save((h) => ({ ...h, looks2d: { ...h.looks2d, [h.cls]: { ...((h.looks2d || {})[h.cls] || {}), ...fields } } }));

  const upgrade = (st, lvl, cost) => {
    const label = `${tx(heroName)}: ${tx(st.name)} ${tx('Nv.')} ${lvl + 1}`;
    if (onSpend && !onSpend(cost, label)) return;
    save((h) => ({
      ...h,
      stats: { ...h.stats, [heroClass.id]: { ...getStatLevels(h, heroClass.id), [st.id]: lvl + 1 } }
    }));
  };

  const saveDrawing = ({ name, pixels }) => {
    if (drawing && drawing.mode === 'override') {
      const cid = drawing.cls;
      save((h) => ({ ...h, pixelOverrides: { ...h.pixelOverrides, [cid]: pixels } }));
      setDrawing(null);
      return;
    }
    const id = drawing && drawing.id ? drawing.id : newCustomId();
    save((h) => {
      const list = h.customs.filter((c) => c.id !== id);
      const idx = h.customs.findIndex((c) => c.id === id);
      const item = { id, name, pixels };
      if (idx >= 0) list.splice(idx, 0, item);
      else list.push(item);
      return { ...h, customs: list, cls: `custom:${id}` };
    });
    setDrawing(null);
    setTab('classes');
  };
  const deleteDrawing = () => {
    const id = drawing && drawing.id;
    if (id) {
      click('delete');
      save((h) => ({ ...h, customs: h.customs.filter((c) => c.id !== id), cls: h.cls === `custom:${id}` ? 'archer' : h.cls }));
    }
    setDrawing(null);
  };

  return (
    <div className="modal-backdrop" onClick={drawing ? undefined : close}>
      {drawing && (
        <PixelEditor
          initial={drawing.pixels ? drawing : null}
          lockedName={drawing.mode === 'override' ? drawing.name : null}
          hero={hero}
          playSound={playSound}
          onCancel={() => setDrawing(null)}
          onSave={saveDrawing}
          onDelete={drawing.id && drawing.mode !== 'override' ? deleteDrawing : null}
        />
      )}
      <div className="modal-window hm-window" onClick={(e) => e.stopPropagation()}>
        <div className="hm-header">
          <div>
            <h3>🛡️ {tx('Personagem')}</h3>
            <p>{tx('Melhore seu herói, troque de personagem e personalize as cores')}</p>
          </div>
          <button type="button" className="st-close" onClick={close} title={tx('Fechar (Esc)')}>
            ✕
          </button>
        </div>

        <div className={`hm-body ${tab === 'upgrades' ? 'is-upgrades' : ''}`}>
          {/* Prévia grande, gira arrastando */}
          <div className="hm-preview-col">
            <div className="hm-preview" {...handlers}>
              <div className="hm-preview-model">
                <HeroModel hero={hero} rotation={rotation} size={tab === 'upgrades' ? 1.2 : 1.45} />
              </div>
              <div className="hm-pedestal" />
              <div className="hm-preview-info">
                <strong>{tx(heroName)}</strong>
                <span>↔ {tx('Arraste para virar de lado')}</span>
              </div>
            </div>

          </div>

          <div className="hm-panel">
            <div className="hm-tabs">
              {[
                ['upgrades', `⬆️ ${tx('Upgrades')}`],
                ['classes', `⚔️ ${tx('Personagens')}`],
                ['custom', `🎨 ${tx('Personalizar')}`]
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={tab === id ? 'active' : ''}
                  onClick={() => {
                    click();
                    setTab(id);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'upgrades' && (
              <UpgradeArcade hero={hero} heroClass={heroClass} diamonds={diamonds} onUpgrade={upgrade} click={click} />
            )}

            {tab === 'classes' && (
              <div className="hm-slots">
                {HERO_CLASSES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`hm-slot ${hero.cls === c.id ? 'active' : ''}`}
                    onClick={() => {
                      click('train');
                      save((h) => ({ ...h, cls: c.id }));
                    }}
                  >
                    <div className="hm-slot-model">
                      <HeroModel hero={hero} cls={c.id} size={0.62} still />
                    </div>
                    <span className="hm-slot-name">{tx(c.name)}</span>
                  </button>
                ))}
                {hero.customs.map((c) => (
                  <div key={c.id} className={`hm-slot custom ${hero.cls === `custom:${c.id}` ? 'active' : ''}`}>
                    <button
                      type="button"
                      className="hm-slot-pick"
                      onClick={() => {
                        click('train');
                        save((h) => ({ ...h, cls: `custom:${c.id}` }));
                      }}
                    >
                      <div className="hm-slot-model">
                        <HeroModel hero={hero} cls={`custom:${c.id}`} size={0.62} still />
                      </div>
                      <span className="hm-slot-name">{c.name}</span>
                    </button>
                    <button type="button" className="hm-slot-edit" title={tx('Editar desenho')} onClick={() => { click(); setDrawing({ ...c }); }}>
                      ✏️
                    </button>
                  </div>
                ))}
                <button type="button" className="hm-slot hm-slot-new" onClick={() => { click(); setDrawing({ name: '', pixels: null }); }}>
                  <span className="hm-slot-plus">＋</span>
                  <span className="hm-slot-name">{tx('Criar do zero')}</span>
                </button>
              </div>
            )}

            {tab === 'custom' && heroClass.custom && (
              <div className="hm-colors">
                <p className="hm-hint">
                  <strong>{heroClass.name}</strong> {tx('foi desenhado por você, pixel por pixel.')}
                </p>
                <button type="button" className="hm-chip active" onClick={() => { click(); setDrawing({ ...findCustom(hero, hero.cls) }); }}>
                  ✏️ {tx('Abrir no criador')}
                </button>
              </div>
            )}

            {tab === 'custom' && !heroClass.custom && (
              <div className="hm-colors">
                <p className="hm-hint">
                  {tx('Vale só para este personagem:')} <strong>{tx(heroName)}</strong>
                </p>
                <section className="hm-pixel-box">
                  <h4>{tx('Pixel art')}</h4>
                  <p className="hm-hint">
                    {hero.pixelOverrides[hero.cls]
                      ? tx('Este personagem está com o seu desenho. As opções abaixo voltam a valer quando você voltar ao original.')
                      : tx('Abra o personagem no criador e pinte pixel por pixel o que quiser mudar.')}
                  </p>
                  <div className="hm-chips">
                    <button
                      type="button"
                      className="hm-chip active"
                      onClick={() => {
                        click();
                        setDrawing({
                          mode: 'override',
                          cls: hero.cls,
                          name: heroName,
                          pixels: hero.pixelOverrides[hero.cls] || pixelsFromHero(hero.cls, look)
                        });
                      }}
                    >
                      ✏️ {tx('Editar em pixel art')}
                    </button>
                    {hero.pixelOverrides[hero.cls] && (
                      <button
                        type="button"
                        className="hm-chip"
                        onClick={async () => {
                          if (!(await ask({ title: tx('Voltar ao original?'), message: tx('O desenho em pixel art deste personagem será apagado.'), yes: tx('Voltar') }))) return;
                          click('delete');
                          save((h) => {
                            const po = { ...h.pixelOverrides };
                            delete po[h.cls];
                            return { ...h, pixelOverrides: po };
                          });
                        }}
                      >
                        ↺ {tx('Voltar ao original')}
                      </button>
                    )}
                  </div>
                </section>
                {!hero.pixelOverrides[hero.cls] && (
                  <>
                <section>
                  <h4>{tx('Cabelo')}</h4>
                  <OptionChips options={HAIR_STYLES_2D} value={look.hairStyle} onPick={(v) => updateLook({ hairStyle: v })} click={click} />
                  <Swatches colors={HAIR_COLORS} value={look.hair} onPick={(v) => updateLook({ hair: v })} click={click} />
                </section>
                <section>
                  <h4>{tx('Barba')}</h4>
                  <OptionChips options={BEARD_STYLES_2D} value={look.beard} onPick={(v) => updateLook({ beard: v })} click={click} />
                </section>
                <section>
                  <h4>{tx('Rosto')}</h4>
                  <OptionChips options={EYE_STYLES_2D} value={look.eyes} onPick={(v) => updateLook({ eyes: v })} click={click} />
                  <OptionChips options={MOUTH_STYLES_2D} value={look.mouth} onPick={(v) => updateLook({ mouth: v })} click={click} />
                  <div className="hm-chips hm-chips-gap">
                    <button type="button" className={`hm-chip ${look.blush ? 'active' : ''}`} onClick={() => { click(); updateLook({ blush: !look.blush }); }}>
                      {tx('Bochechas rosadas')}
                    </button>
                    <button type="button" className={`hm-chip ${look.ears === 'elfo' ? 'active' : ''}`} onClick={() => { click(); updateLook({ ears: look.ears === 'elfo' ? null : 'elfo' }); }}>
                      {tx('Orelhas de elfo')}
                    </button>
                  </div>
                  <p className="hm-hint hm-hint-gap">{tx('Cor dos olhos')}</p>
                  <Swatches colors={EYE_COLORS} value={look.eye} onPick={(v) => updateLook({ eye: v })} click={click} />
                  <p className="hm-hint hm-hint-gap">{tx('Pele')}</p>
                  <Swatches colors={SKIN_COLORS} value={look.skin} onPick={(v) => updateLook({ skin: v })} click={click} />
                </section>
                <section>
                  <h4>{tx('Roupa')}</h4>
                  <Swatches colors={OUTFIT_COLORS} value={look.outfit} onPick={(v) => updateLook({ outfit: v })} click={click} />
                  <p className="hm-hint hm-hint-gap">{tx('Mangas, alça e detalhes')}</p>
                  <Swatches colors={DETAIL_COLORS} value={look.outfit2} onPick={(v) => updateLook({ outfit2: v })} click={click} />
                  <p className="hm-hint hm-hint-gap">{tx('Calça')}</p>
                  <Swatches colors={PANTS_COLORS} value={look.pants} onPick={(v) => updateLook({ pants: v })} click={click} />
                  <p className="hm-hint hm-hint-gap">{tx('Sapatos')}</p>
                  <Swatches colors={SHOE_COLORS} value={look.shoes} onPick={(v) => updateLook({ shoes: v })} click={click} />
                </section>
                <section>
                  <h4>{tx('Acessórios')}</h4>
                  <div className="hm-chips">
                    <button type="button" className={`hm-chip ${look.headgear ? 'active' : ''}`} onClick={() => { click(); updateLook({ headgear: !look.headgear }); }}>
                      {look.headgear ? '✓ ' : ''}{tx(heroClass.hatName)}
                    </button>
                    <button type="button" className={`hm-chip ${look.item ? 'active' : ''}`} onClick={() => { click(); updateLook({ item: !look.item }); }}>
                      {look.item ? '✓ ' : ''}{tx(heroClass.itemName)}
                    </button>
                  </div>
                  <p className="hm-hint hm-hint-gap">{tx('Detalhes (gema, pena, penacho)')}</p>
                  <Swatches colors={TRIM_COLORS} value={look.trim} onPick={(v) => updateLook({ trim: v })} click={click} />
                </section>
                <button
                  type="button"
                  className="hm-reset"
                  onClick={() => {
                    click('delete');
                    save((h) => ({ ...h, looks2d: { ...h.looks2d, [h.cls]: {} } }));
                  }}
                >
                  ↺ {tx('Restaurar padrão')}
                </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
