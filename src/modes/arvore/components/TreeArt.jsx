/* =========================================================
   ARTE DA ÁRVORE — estilo nanquim + aquarela
   Tronco/galhos em tinta preta com veios claros, copas em
   aquarela azul, chão escuro com ondas em pinceladas claras
   e textura de papel granulado. Tudo gerado em SVG.
========================================================= */
import { memo } from "react";
import { limbGrains, limbOutline, pathOutline, runnerPath, treeRoots } from "../lib/growth";

/* ---------------- utilidades ---------------- */
function rand(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Curva suave (Catmull-Rom → Bézier) passando por todos os pontos. */
function smoothPath(points) {
  if (points.length < 2) return "";
  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/* Contorno do chão (coordenadas da árvore: base do tronco em y = 620). */
const GROUND_POINTS = [
  [-9000, 650], [-1600, 640], [-900, 622], [-450, 606], [-120, 588], [120, 584], [330, 606],
  [480, 628], [600, 636], [720, 630], [880, 612], [1080, 588], [1300, 580], [1560, 598],
  [1950, 618], [2700, 632], [10200, 650],
];

function groundY(x) {
  for (let i = 0; i < GROUND_POINTS.length - 1; i++) {
    const [x1, y1] = GROUND_POINTS[i];
    const [x2, y2] = GROUND_POINTS[i + 1];
    if (x >= x1 && x <= x2) {
      const t = (x - x1) / (x2 - x1);
      const s = t * t * (3 - 2 * t);
      return y1 + (y2 - y1) * s;
    }
  }
  return 650;
}

/* ---------------- definições (filtros, texturas) ---------------- */
export const TreeDefs = memo(function TreeDefs() {
  return (
    <defs>
      {/* contorno levemente irregular, como traço de pincel */}
      <filter id="organic-branch" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.8" xChannelSelector="R" yChannelSelector="G" />
      </filter>

      {/* aquarela: borda rasgada + borda mais escura + pigmento granulado */}
      <filter id="watercolor" x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="4" result="warp" />
        <feDisplacementMap in="SourceGraphic" in2="warp" scale="10" xChannelSelector="R" yChannelSelector="G" result="ragged" />
        <feMorphology in="ragged" operator="erode" radius="2.2" result="inner" />
        <feComposite in="ragged" in2="inner" operator="out" result="edge" />
        <feFlood className="wc-edge" result="edgeColor" />
        <feComposite in="edgeColor" in2="edge" operator="in" result="darkEdge" />
        <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="11" result="grain" />
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.3 0 0 0 -0.88" result="speck" />
        <feComposite in="speck" in2="ragged" operator="in" result="speckIn" />
        <feMerge>
          <feMergeNode in="ragged" />
          <feMergeNode in="darkEdge" />
          <feMergeNode in="speckIn" />
        </feMerge>
      </filter>

      {/* grão de papel/tinta em ladrilhos (barato de desenhar) */}
      <filter id="grain-light-fx" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" seed="2" />
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.8 0 0 0 -0.95" />
      </filter>
      <filter id="grain-dark-fx" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" stitchTiles="stitch" seed="7" />
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.6 0 0 0 -0.7" />
      </filter>
      <pattern id="grain-light" width="180" height="180" patternUnits="userSpaceOnUse">
        <rect width="180" height="180" filter="url(#grain-light-fx)" />
      </pattern>
      <pattern id="grain-dark" width="400" height="400" patternUnits="userSpaceOnUse">
        <rect width="400" height="400" filter="url(#grain-dark-fx)" />
      </pattern>

      <linearGradient id="ground-fill" x1="0" y1="590" x2="0" y2="860" gradientUnits="userSpaceOnUse">
        <stop offset="0" style={{ stopColor: "var(--ground-top)" }} />
        <stop offset="0.12" style={{ stopColor: "var(--ground-top)" }} />
        <stop offset="0.5" style={{ stopColor: "var(--ground-mid)" }} />
        <stop offset="1" style={{ stopColor: "var(--ground-deep)" }} />
      </linearGradient>
    </defs>
  );
});

/* ---------------- chão ---------------- */
export const Ground = memo(function Ground() {
  const top = smoothPath(GROUND_POINTS);
  const body = `${top} L 10200 14000 L -9000 14000 Z`;

  // pinceladas claras seguindo o relevo
  const strokes = [];
  for (let i = 0; i < 14; i++) {
    const dy = 16 + i * 24 + rand(i + 1) * 10;
    const amp = 4 + i * 1.6;
    const phase = rand(i + 7) * 6;
    const start = -1100 + rand(i + 3) * 500;
    const end = 2200 - rand(i + 5) * 500;
    const pts = [];
    for (let x = start; x <= end; x += 45) {
      pts.push([x, groundY(x) + dy + Math.sin(x / (70 + i * 9) + phase) * amp]);
    }
    strokes.push({
      d: smoothPath(pts),
      width: 0.9 + rand(i + 11) * 2.2,
      opacity: 0.25 + rand(i + 13) * 0.4,
      dash: `${120 + rand(i) * 260} ${20 + rand(i + 2) * 60} ${40 + rand(i + 4) * 120} ${15 + rand(i + 6) * 40}`,
      offset: rand(i + 9) * 300,
    });
  }

  // tufos de grama na crista
  const tufts = [];
  for (let x = -700; x < 1950; x += 38 + rand(x) * 40) {
    if (x > 520 && x < 690) continue; // deixa a base do tronco limpa
    const y = groundY(x) + 1;
    const h = 5 + rand(x + 1) * 9;
    const lean = (rand(x + 2) - 0.5) * 6;
    tufts.push(`M ${x - 3} ${y} q ${lean * 0.3} ${-h * 0.6} ${lean - 1} ${-h} M ${x} ${y} q ${lean * 0.2} ${-h * 0.8} ${lean + 1} ${-h * 1.25} M ${x + 3} ${y} q ${lean * 0.4} ${-h * 0.5} ${lean + 3} ${-h * 0.8}`);
  }

  return (
    <g className="ground" aria-hidden="true">
      <path d={body} fill="url(#ground-fill)" />
      <path d={body} fill="url(#grain-dark)" opacity="0.55" />
      <path d={body} fill="url(#grain-light)" opacity="0.18" />
      <path className="grass" d={tufts.join(" ")} />
      {strokes.map((s, i) => (
        <path
          key={i}
          className="ground-stroke"
          d={s.d}
          style={{ strokeWidth: s.width, opacity: s.opacity, strokeDasharray: s.dash, strokeDashoffset: s.offset }}
        />
      ))}
    </g>
  );
});

/* ---------------- raízes (crescem com a árvore) ---------------- */
export const ForestRoots = memo(function ForestRoots({ trees }) {
  const main = trees[0];
  return (
    <g className="roots" filter="url(#organic-branch)">
      {/* raiz rasteira que liga as árvores novas à principal */}
      {trees.slice(1).map((t) => (
        <path
          key={`runner-${t.index}`}
          className="root-runner"
          d={runnerPath({ x: main.x + Math.sign(t.x - main.x) * main.baseHalf * 0.8 }, { x: t.x }, t.seed)}
          style={{ strokeWidth: 3 + Math.min(4, t.weight * 0.05) }}
        />
      ))}
      {trees.slice(1).map((t) => (
        <path
          key={`runner-line-${t.index}`}
          className="root-runner-line"
          d={runnerPath({ x: main.x + Math.sign(t.x - main.x) * main.baseHalf * 0.8 }, { x: t.x }, t.seed)}
        />
      ))}
      {trees.map((t) =>
        treeRoots(t).map((r, i) => (
          <g key={`${t.index}-${i}`}>
            <path className="ink-fill root-fill" d={r.d} />
            {r.grains.map((g, j) => (
              <path key={j} className="ink-grain" d={g.d} style={{ strokeDasharray: g.dash }} />
            ))}
          </g>
        ))
      )}
    </g>
  );
});

/* ---------------- troncos: afinam até virar galho e podem se dividir ---------------- */
export const ForestTrunks = memo(function ForestTrunks({ trees, selected, dimmed, events, onSideTreeMenu }) {
  return (
    <g className="forest-trunks">
      {trees.map((t) => {
        const limbs = t.geo.limbs.map((l) => ({ ...l, d: limbOutline(l.curve, l.half) }));
        // gravetos do topo (o tronco se abre dentro da copa)
        const twigs = (t.geo.twigs || []).map((tw) => pathOutline(tw.pts, tw.half));
        const grains = t.geo.limbs.flatMap((l, li) =>
          limbGrains(l.curve, l.half, l.role === "trunk" ? 5 : 3, t.seed + li * 31)
        );
        return (
          <g
            key={t.index}
            style={{ opacity: dimmed ? 0.6 : 1 }}
            onContextMenu={
              t.index > 0 && onSideTreeMenu
                ? (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSideTreeMenu(t);
                  }
                : undefined
            }
          >
            {twigs.map((d, i) => (
              <path key={`tw${i}`} className={`trunk ${selected ? "selected" : ""}`} filter="url(#organic-branch)" d={d} {...events} />
            ))}
            {limbs.map((l, i) => (
              <path key={i} className={`trunk ${selected ? "selected" : ""}`} filter="url(#organic-branch)" d={l.d} {...events} />
            ))}
            {limbs.map((l, i) => (
              <path key={`g${i}`} d={l.d} fill="url(#grain-light)" opacity="0.22" style={{ pointerEvents: "none" }} />
            ))}
            <g style={{ pointerEvents: "none" }}>
              {grains.map((g, i) => (
                <path key={i} className="ink-grain" d={g.d} style={{ strokeDasharray: g.dash }} />
              ))}
              {t.baseHalf > 30 && (
                <g className="knot">
                  <ellipse cx={t.x - t.baseHalf * 0.38} cy={t.baseY - 48 * t.scale} rx={6 + t.baseHalf * 0.12} ry={10 + t.baseHalf * 0.2} />
                  <ellipse cx={t.x - t.baseHalf * 0.38} cy={t.baseY - 47 * t.scale} rx={2.5 + t.baseHalf * 0.05} ry={5 + t.baseHalf * 0.1} />
                </g>
              )}
            </g>
          </g>
        );
      })}
    </g>
  );
});
