import React, { useState, useRef, useEffect } from 'react';
import './Hero.css';
import { tx, useLanguage } from '../i18n/index.jsx';
import {
  DEFAULT_LOOK,
  HERO_CLASSES,
  OUTFIT_COLORS,
  TRIM_COLORS,
  statsFor,
  MAX_STAT_LEVEL,
  normalizeHero,
  getLook,
  getStatLevels,
  upgradeCost,
  getHeroClass,
  getGender,
  heroNameFor,
  SKIN_COLORS,
  EYE_COLORS,
  HAIR_COLORS,
  buildPalette,
  resolveColor,
  FACE_PATTERNS,
  FACE_PIXEL_COLORS
} from './HeroModels.js';
import { buildHeroParts, HAIR_STYLES, BEARD_STYLES, ARMOR_TYPES, HELM_TYPES } from './HeroParts.js';

// =========================================================
// HERÓI EM BLOCOS (voxel)
// Arraste para girar · clique para pular · segure para abrir o menu
// =========================================================

// Caixa 3D centralizada em (x, y, z), com rotação opcional.
// `wave` (segundos de atraso) faz o bloco ondular (corpo do dragão).
function Box({ w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, color, className = '', face = null, wave }) {
  const sides = [
    ['front', w, h, `translateZ(${d / 2}px)`],
    ['back', w, h, `rotateY(180deg) translateZ(${d / 2}px)`],
    ['right', d, h, `rotateY(90deg) translateZ(${w / 2}px)`],
    ['left', d, h, `rotateY(-90deg) translateZ(${w / 2}px)`],
    ['top', w, d, `rotateX(90deg) translateZ(${h / 2}px)`],
    ['bottom', w, d, `rotateX(-90deg) translateZ(${h / 2}px)`]
  ];
  const faces = sides.map(([name, fw, fh, transform]) => (
    <div
      key={name}
      className={`vx-face vx-${name}`}
      style={{ width: fw, height: fh, left: (w - fw) / 2, top: (h - fh) / 2, transform }}
    >
      {name === 'front' && face}
    </div>
  ));
  return (
    <div
      className={`vx-box ${className}`}
      style={{
        width: w,
        height: h,
        transform: `translate3d(${x - w / 2}px, ${y - h / 2}px, ${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`,
        '--vx': color
      }}
    >
      {wave !== undefined ? (
        <div className="vx-wave" style={{ width: w, height: h, animationDelay: `${wave}s` }}>
          {faces}
        </div>
      ) : (
        faces
      )}
    </div>
  );
}

function PixelFace({ rows, palette }) {
  return (
    <div className="vx-pixels">
      {rows
        .join('')
        .split('')
        .map((c, i) => {
          if (c === '.') return <span key={i} />;
          return <span key={i} style={{ background: resolveColor(FACE_PIXEL_COLORS[c], palette) }} />;
        })}
    </div>
  );
}

// Os blocos de um personagem, com as cores DELE
function HeroBody({ hero, cls }) {
  const heroClass = getHeroClass(cls || hero.cls);
  const look = getLook(hero, heroClass.id);
  const palette = buildPalette(heroClass, look);
  const gender = getGender(look, heroClass);
  const { blocks, face } = buildHeroParts(heroClass, look, gender, FACE_PATTERNS);
  const floating = heroClass.floating || heroClass.id === 'fairy';
  return (
    <div
      className={`vx-idle ${floating ? 'floating' : ''}`}
      style={{ '--vx-lift': `${heroClass.lift || 0}px`, '--vx-scale': heroClass.scale || 1 }}
    >
      {blocks.map(([w, h, d, x, y, z, color, extra = {}], i) => (
        <Box
          key={i}
          w={w}
          h={h}
          d={d}
          x={x}
          y={y}
          z={z}
          rx={extra.rx}
          ry={extra.ry}
          rz={extra.rz}
          wave={extra.wave}
          className={extra.cls || ''}
          color={resolveColor(color, palette)}
          face={extra.face ? <PixelFace rows={face} palette={palette} /> : null}
        />
      ))}
    </div>
  );
}

// Personagem completo (cena 3D). `size` muda a escala (miniaturas do menu).
export function HeroModel({ hero, cls, rotation = -30, hop = 0, size = 1, still = false }) {
  return (
    <div className={`vx-model ${still ? 'still' : ''}`} style={{ '--vx-size': size }}>
      <div className="vx-shadow" />
      <div className="vx-scene">
        <div className="vx-rot" style={{ transform: `rotateX(-14deg) rotateY(${rotation}deg)` }}>
          <div className={`vx-hop ${hop ? 'hopping' : ''}`} key={hop}>
            <HeroBody hero={hero} cls={cls} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Arrastar para girar + clique + segurar (toque longo)
function useHeroGestures({ onTap, onHold } = {}) {
  const [rotation, setRotation] = useState(-30);
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
      if (d.moved) setRotation(d.start + dx * 0.9);
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
      <div className="vx-stage" {...handlers} title={tx('Clique para abrir o personagem · arraste para girar')}>
        <HeroModel hero={hero} rotation={rotation} />
      </div>
      <ThoughtBubble emoji={emoji} onClick={onEmojiClick} />
    </div>
  );
}

// ---------- Gráfico radar dos atributos ----------
function StatRadar({ heroClass, levels }) {
  const size = 200;
  const c = size / 2;
  const r = 70;
  const max = 20; // valor-base (até ~10) + upgrades (até 10)
  const stats = statsFor(heroClass);
  const n = stats.length;
  const point = (i, v) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v];
  };
  const poly = (fn) => stats.map((st, i) => point(i, fn(st)).join(',')).join(' ');
  const base = (st) => Math.min(1, (heroClass.base?.[st.id] || 0) / max);
  const total = (st) => Math.min(1, ((heroClass.base?.[st.id] || 0) + (levels[st.id] || 0)) / max);

  return (
    <svg className="rp-radar" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} className="rp-radar-ring" points={poly(() => f)} />
      ))}
      {stats.map((st, i) => {
        const [x, y] = point(i, 1);
        return <line key={st.id} className="rp-radar-axis" x1={c} y1={c} x2={x} y2={y} />;
      })}
      <polygon className="rp-radar-base" points={poly(base)} />
      <polygon className="rp-radar-value" points={poly(total)} />
      {stats.map((st, i) => {
        const [x, y] = point(i, 1.24);
        return (
          <text key={st.id} x={x} y={y} className="rp-radar-icon" textAnchor="middle" dominantBaseline="central">
            {st.icon}
          </text>
        );
      })}
    </svg>
  );
}

// Posição de cada atributo ao redor do personagem (% da área da prévia)
const ORBIT_POS = {
  atk: { left: 17, top: 24 },
  def: { left: 17, top: 66 },
  agi: { left: 83, top: 24 },
  mag: { left: 83, top: 66 },
  hp: { left: 50, top: 11 }
};

// ---------- Atributos em volta do personagem ----------
function UpgradeOrbit({ hero, heroClass, diamonds, onUpgrade, click }) {
  const levels = getStatLevels(hero, heroClass.id);
  return (
    <div className="up-orbit">
      {statsFor(heroClass).map((st) => {
        const lvl = levels[st.id] || 0;
        const maxed = lvl >= MAX_STAT_LEVEL;
        const cost = upgradeCost(lvl);
        const canBuy = !maxed && diamonds >= cost;
        const pos = ORBIT_POS[st.id] || { left: 50, top: 50 };
        return (
          <div
            key={st.id}
            className={`up-node ${maxed ? 'maxed' : ''}`}
            style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
            title={tx(st.desc)}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="up-node-icon">{st.icon}</span>
            <span className="up-node-name">{tx(st.name)}</span>
            <span className="up-node-lvl">
              {tx('Nv.')} {lvl}/{MAX_STAT_LEVEL}
            </span>
            <div className="up-pips">
              {Array.from({ length: MAX_STAT_LEVEL }).map((_, i) => (
                <span key={i} className={i < lvl ? 'on' : ''} />
              ))}
            </div>
            <button
              type="button"
              className="up-buy"
              disabled={!canBuy}
              onClick={() => {
                if (!canBuy) return;
                click('train');
                onUpgrade(st, lvl, cost);
              }}
              title={maxed ? tx('Nível máximo') : canBuy ? tx('Melhorar') : tx('Diamantes insuficientes')}
            >
              {maxed ? 'MAX' : `+ 💎${cost}`}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Ficha do herói (gráfico + valores) ----------
function HeroSheet({ hero, heroClass, diamonds }) {
  const levels = getStatLevels(hero, heroClass.id);
  return (
    <div className="rp-sheet">
      <div className="rp-head">
        <div>
          <h4>📜 {tx('Ficha do Herói')}</h4>
          <small>{tx(heroNameFor(heroClass, getGender(getLook(hero, heroClass.id), heroClass)))}</small>
        </div>
        <div className="rp-purse" title={tx('Seus diamantes')}>
          <span>💎</span>
          <strong>{diamonds}</strong>
        </div>
      </div>

      <StatRadar heroClass={heroClass} levels={levels} />

      <div className="rp-list">
        {statsFor(heroClass).map((st) => {
          const lvl = levels[st.id] || 0;
          const base = heroClass.base?.[st.id] || 0;
          return (
            <div key={st.id} className="rp-row">
              <span>{st.icon}</span>
              <span className="rp-row-name">
                {tx(st.name)}
                <small>{tx(st.desc)}</small>
              </span>
              <span className="rp-row-value">
                {base + lvl}
                {lvl > 0 && <em>+{lvl}</em>}
              </span>
            </div>
          );
        })}
      </div>
      <p className="rp-tip">{tx('Ganhe diamantes completando as missões diárias.')}</p>
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
          <span aria-hidden="true">{o.icon}</span>
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
  const { rotation, handlers } = useHeroGestures();

  // Ao abrir, começa sempre na ficha de upgrades
  useEffect(() => {
    if (isOpen) setTab('upgrades');
  }, [isOpen]);

  if (!isOpen) return null;

  const hero = normalizeHero(rawHero);
  const heroClass = getHeroClass(hero.cls);
  const look = getLook(hero, heroClass.id);
  const palette = buildPalette(heroClass, look);
  const gender = getGender(look, heroClass);
  const isDragon = heroClass.id === 'dragon';
  const heroName = heroNameFor(heroClass, gender);

  const click = (type = 'click') => playSound && playSound(type);
  const close = () => {
    click();
    onClose();
  };
  const save = (fn) => setHero((prev) => fn(normalizeHero(prev)));
  // Tudo que for personalizado fica só no personagem atual
  const updateLook = (fields) =>
    save((h) => ({ ...h, looks: { ...h.looks, [h.cls]: { ...getLook(h, h.cls), ...fields } } }));

  const upgrade = (st, lvl, cost) => {
    const label = `${tx(heroName)}: ${tx(st.name)} ${tx('Nv.')} ${lvl + 1}`;
    if (onSpend && !onSpend(cost, label)) return;
    save((h) => ({
      ...h,
      stats: { ...h.stats, [heroClass.id]: { ...getStatLevels(h, heroClass.id), [st.id]: lvl + 1 } }
    }));
  };

  return (
    <div className="modal-backdrop" onClick={close}>
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
              {tab === 'upgrades' && (
                <UpgradeOrbit hero={hero} heroClass={heroClass} diamonds={diamonds} onUpgrade={upgrade} click={click} />
              )}
              <div className="hm-preview-info">
                <strong>{tx(heroName)}</strong>
                <span>↔ {tx('Arraste para girar')}</span>
              </div>
            </div>

            {/* Gênero, embaixo do personagem (aba Personagens) */}
            {tab === 'classes' && !heroClass.noGender && (
              <div className="hm-gender">
                <span>{tx('Gênero')}</span>
                <div className="hm-gender-toggle">
                  {[
                    ['m', `♂ ${tx('Masculino')}`],
                    ['f', `♀ ${tx('Feminino')}`]
                  ].map(([g, label]) => (
                    <button
                      key={g}
                      type="button"
                      className={gender === g ? 'active' : ''}
                      onClick={() => {
                        click();
                        updateLook({ gender: g });
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
              <HeroSheet hero={hero} heroClass={heroClass} diamonds={diamonds} />
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
                      <HeroModel hero={hero} cls={c.id} rotation={-28} size={c.id === 'dragon' ? 0.5 : 0.68} still />
                    </div>
                    <span className="hm-slot-name">{tx(heroNameFor(c, getGender(getLook(hero, c.id), c)))}</span>
                  </button>
                ))}
              </div>
            )}

            {tab === 'custom' && (
              <div className="hm-colors">
                <p className="hm-hint">
                  {tx('Vale só para este personagem:')} <strong>{tx(heroName)}</strong>
                </p>
                <section>
                  <h4>{isDragon ? tx('Escamas') : tx('Roupa')}</h4>
                  <Swatches colors={OUTFIT_COLORS} value={look.outfit} onPick={(v) => updateLook({ outfit: v })} click={click} />
                </section>

                {!isDragon && (
                  <section>
                    <h4>{tx('Pele')}</h4>
                    <Swatches colors={SKIN_COLORS} value={palette.skin} onPick={(v) => updateLook({ skin: v })} click={click} />
                  </section>
                )}

                <section>
                  <h4>{tx('Olhos')}</h4>
                  <Swatches colors={EYE_COLORS} value={palette.eye} onPick={(v) => updateLook({ eye: v })} click={click} />
                </section>

                {!isDragon && (
                  <section>
                    <h4>{tx('Cabelo')}</h4>
                    <OptionChips
                      options={HAIR_STYLES}
                      value={look.hairStyle || 'default'}
                      onPick={(v) => updateLook({ hairStyle: v })}
                      click={click}
                    />
                    <p className="hm-hint hm-hint-gap">{tx('Cor do cabelo e da barba')}</p>
                    <Swatches colors={HAIR_COLORS} value={palette.hair} onPick={(v) => updateLook({ hair: v })} click={click} />
                  </section>
                )}

                {!isDragon && (
                  <section>
                    <h4>{tx('Barba')}</h4>
                    <OptionChips
                      options={BEARD_STYLES}
                      value={look.beard || 'default'}
                      onPick={(v) => updateLook({ beard: v })}
                      click={click}
                    />
                  </section>
                )}

                {heroClass.hasArmor && (
                  <section>
                    <h4>{tx('Armadura')}</h4>
                    <OptionChips
                      options={ARMOR_TYPES}
                      value={look.armor || 'default'}
                      onPick={(v) => updateLook({ armor: v })}
                      click={click}
                    />
                  </section>
                )}

                {heroClass.hasHelm && (
                  <section>
                    <h4>{tx('Elmo')}</h4>
                    <OptionChips
                      options={HELM_TYPES}
                      value={look.helm || 'default'}
                      onPick={(v) => updateLook({ helm: v })}
                      click={click}
                    />
                  </section>
                )}

                <section>
                  <h4>{tx('Detalhes')}</h4>
                  <p className="hm-hint">{tx('Gemas, cintos, penas e enfeites')}</p>
                  <Swatches
                    colors={TRIM_COLORS}
                    value={look.trim}
                    allowTheme
                    customFallback="#facc15"
                    onPick={(v) => updateLook({ trim: v })}
                    click={click}
                  />
                </section>

                <button
                  type="button"
                  className="hm-reset"
                  onClick={() => {
                    click('delete');
                    updateLook({ ...DEFAULT_LOOK, skin: null, eye: null, hair: null, hairStyle: null, beard: null, armor: null, helm: null });
                  }}
                >
                  ↺ {tx('Restaurar padrão')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
