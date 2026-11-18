import { hashString } from "./ids";

function rand(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/* ---------------- copa em aquarela de um galho ---------------- */
export function canopyCircles(id, x, y, rx, ry, count, isMain) {
  const h = hashString(id);
  const growth = (isMain ? 1.15 : 1.08) + Math.min(0.55, count * 0.06);
  const n = (isMain ? 6 : 4) + (h % 3);
  const spread = rx * (isMain ? 0.62 : 0.55) * growth;
  const out = [{ cx: x, cy: y - ry * 0.1, r: ry * 1.1 * growth }];
  for (let j = 0; j < n; j++) {
    const t = n === 1 ? 0 : (j / (n - 1)) * 2 - 1;
    const r1 = rand(h + j * 3.1);
    const r2 = rand(h + j * 7.7);
    out.push({
      cx: x + t * spread + (r1 - 0.5) * ry * 0.4,
      cy: y + (r2 - 0.5) * ry * 0.7 - (1 - t * t) * ry * 0.35,
      r: ry * (0.8 + r1 * 0.5) * growth,
    });
  }
  return out;
}
