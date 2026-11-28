// =========================================================
// Desenho de um personagem 2D a partir das células (usado pelo herói e
// pelo criador de pixel art). Cada parte vira um <g> para poder animar.
// =========================================================
import React, { useMemo } from 'react';
import { GRID, toRects } from './Hero2D.js';

const PARTS = ['legL', 'legR', 'armL', 'body', 'armR', 'head'];

export function CellsSvg({ cells }) {
  const rects = useMemo(() => toRects(cells), [cells]);
  const w = GRID.c1 - GRID.c0 + 1;
  const h = GRID.r1 - GRID.r0 + 1;
  return (
    <svg className="h2d-svg" viewBox={`${GRID.c0} ${GRID.r0} ${w} ${h}`} shapeRendering="crispEdges" aria-hidden="true">
      {PARTS.map((part) => (
        <g key={part} className={`h2d-${part}`}>
          {rects
            .filter((rc) => rc.part === part)
            .map((rc, i) => (
              <rect key={i} x={rc.c} y={rc.r} width={rc.w} height={1.02} fill={rc.color} />
            ))}
        </g>
      ))}
    </svg>
  );
}
