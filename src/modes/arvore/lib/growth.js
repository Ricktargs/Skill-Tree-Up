/* =========================================================
   CRESCIMENTO DA ÁRVORE
   - "Peso" de cada árvore = galhos + copas + notas + texto das notas
   - Tronco em curva que afina até virar uma ponta de galho
   - Bifurcação: o tronco vira dois (um saindo de dentro do outro)
   - Árvores novas ao lado (ligadas por uma raiz rasteira)
   - Raízes que aumentam com o peso
   Tudo é geometria pura (sem React); o desenho fica em TreeArt.
========================================================= */
import { hashString } from "./ids";

export const FORK_AT = 8; // galhos principais para pedir a bifurcação
export const MAIN_CAP_SINGLE = 10; // galhos que um tronco só aguenta antes de pedir outra árvore
export const MAIN_CAP_FORKED = 12; // com o tronco dividido em dois
export const SIDE_CAP = 6; // galhos de cada árvore nova
export const BASE_Y = 620;

const rand = (seed) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/* Contorno do chão (o mesmo do desenho do chão) */
export const GROUND_POINTS = [
  [-9000, 650], [-1600, 640], [-900, 622], [-450, 606], [-120, 588], [120, 584], [330, 606],
  [480, 628], [600, 636], [720, 630], [880, 612], [1080, 588], [1300, 580], [1560, 598],
  [1950, 618], [2700, 632], [10200, 650],
];

export function groundY(x) {
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

/* ---------------- curvas ---------------- */
const bez = (p, t) => {
  const u = 1 - t;
  return [
    u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
    u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1],
  ];
};

const bezTangent = (p, t) => {
  const u = 1 - t;
  const x = 3 * u * u * (p[1][0] - p[0][0]) + 6 * u * t * (p[2][0] - p[1][0]) + 3 * t * t * (p[3][0] - p[2][0]);
  const y = 3 * u * u * (p[1][1] - p[0][1]) + 6 * u * t * (p[2][1] - p[1][1]) + 3 * t * t * (p[3][1] - p[2][1]);
  const len = Math.hypot(x, y) || 1;
  return [x / len, y / len];
};

/** Curva suave (Catmull-Rom → Bézier) passando por todos os pontos. */
export function smoothPath(points, close = false) {
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
  return close ? `${d} Z` : d;
}

/**
 * Contorno de um "membro" (tronco, ramo do tronco ou raiz): segue a curva
 * `curve` (Bézier cúbica) com meia-largura `half(t)`. Termina em ponta.
 */
export function limbOutline(curve, half, steps = 26) {
  const left = [];
  const right = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const c = bez(curve, t);
    const [tx, ty] = bezTangent(curve, t);
    const h = Math.max(0.6, half(t));
    left.push([c[0] - ty * h, c[1] + tx * h]);
    right.push([c[0] + ty * h, c[1] - tx * h]);
  }
  const tip = bez(curve, 1);
  return smoothPath([...left, tip, ...right.reverse()], true);
}

/** Linhas de veio (claras) ao longo de um membro. */
export function limbGrains(curve, half, count, seed) {
  const out = [];
  for (let g = 0; g < count; g++) {
    const k = count === 1 ? 0 : (g / (count - 1)) * 1.3 - 0.65;
    const pts = [];
    const end = 0.55 + rand(seed + g) * 0.35;
    for (let i = 0; i <= 14; i++) {
      const t = (i / 14) * end;
      const c = bez(curve, t);
      const [tx, ty] = bezTangent(curve, t);
      const h = half(t) * k;
      pts.push([c[0] - ty * h, c[1] + tx * h]);
    }
    out.push({
      d: smoothPath(pts),
      dash: `${50 + rand(seed + g + 20) * 90} ${8 + rand(seed + g + 21) * 18} ${20 + rand(seed + g + 22) * 40} ${6 + rand(seed + g + 23) * 10}`,
    });
  }
  return out;
}

/* ---------------- peso (o que faz a árvore crescer) ---------------- */
/**
 * info: Map(idDoGalho -> { notes, chars }) só das notas daquele galho.
 * Peso de um galho principal = subgalhos (copas) + notas + texto, de toda a sua copa.
 */
export function branchWeight(branch, info) {
  const walk = (node) => {
    const own = info.get(node.id) || { notes: 0, chars: 0 };
    let w = 1.5 + own.notes * 1 + Math.min(6, own.chars / 600);
    for (const c of node.children || []) w += walk(c);
    return w;
  };
  return walk(branch);
}

/* ---------------- plano: quantas árvores e quem vai em cada ---------------- */
/**
 * growth: { fork: true | false | null, trees: número de árvores extras liberadas,
 *           declinedTrees: true se a pessoa não quis mais árvores }
 */
export function planForest(tree, info, growth = {}) {
  const main = tree?.children || [];
  const n = main.length;
  const forkWanted = n >= FORK_AT;
  const fork = forkWanted && growth.fork === true;
  const mainCap = fork ? MAIN_CAP_FORKED : MAIN_CAP_SINGLE;
  const neededExtra = n > mainCap ? Math.ceil((n - mainCap) / SIDE_CAP) : 0;
  const extra = growth.declinedTrees ? 0 : Math.min(neededExtra, Math.max(0, growth.trees || 0));

  // As árvores novas recebem os galhos mais recentes (do fim da lista)
  const groups = [];
  let tail = n;
  const sideGroups = [];
  for (let k = 0; k < extra; k++) {
    const count = Math.min(SIDE_CAP, tail - mainCap > 0 ? Math.min(SIDE_CAP, tail - mainCap) : 0);
    if (count <= 0) break;
    sideGroups.unshift(main.slice(tail - count, tail));
    tail -= count;
  }
  groups.push(main.slice(0, tail));
  sideGroups.forEach((g) => groups.push(g));

  const trees = groups.map((branches, index) => {
    const weight = branches.reduce((w, b) => w + branchWeight(b, info), 0);
    const side = index === 0 ? 0 : index % 2 === 1 ? 1 : -1; // direita, esquerda, direita...
    const ring = Math.ceil(index / 2);
    const x = index === 0 ? 600 : 600 + side * (820 + (ring - 1) * 760);
    const scale = index === 0 ? 1 : Math.min(0.85, 0.55 + Math.sqrt(weight) * 0.025);
    const baseY = index === 0 ? BASE_Y : groundY(x) - 10;
    const bn = branches.length;
    const H = index === 0 ? 430 + Math.min(150, Math.max(0, bn - 5) * 16 + weight * 0.25) : (300 + Math.min(160, weight * 0.9)) * scale;
    const baseHalf = (24 + Math.min(42, Math.sqrt(weight) * 3.1)) * (index === 0 ? 1 : scale);
    const forked = index === 0 ? fork : fork && bn >= 5;
    const look = Number(tree?.look) || 0;
    const seed = hashString(`${tree?.id || "eu"}-${index}-${look}`);
    return { index, x, baseY, scale, H, baseHalf, forked, weight, branches, seed, look };
  });

  return {
    trees,
    // Dividir o tronco e árvores novas ficam desligados até a pessoa ligar
    // nas Configurações (a pergunta aparece só ao ligar)
    needs: { fork: false, tree: false },
  };
}

/* ---------------- contorno de um caminho qualquer (raízes, gravetos) ---------------- */
const tangentAt = (pts, i) => {
  const a = pts[Math.max(0, i - 1)];
  const b = pts[Math.min(pts.length - 1, i + 1)];
  const tx = b[0] - a[0];
  const ty = b[1] - a[1];
  const len = Math.hypot(tx, ty) || 1;
  return [tx / len, ty / len];
};

export function pathOutline(pts, half) {
  const n = pts.length;
  const left = [];
  const right = [];
  for (let i = 0; i < n; i++) {
    const [tx, ty] = tangentAt(pts, i);
    const h = Math.max(0.5, half(i / (n - 1)));
    left.push([pts[i][0] - ty * h, pts[i][1] + tx * h]);
    right.push([pts[i][0] + ty * h, pts[i][1] - tx * h]);
  }
  return smoothPath([...left, pts[n - 1], ...right.reverse()], true);
}

export function pathGrains(pts, half, count, seed) {
  const out = [];
  const n = pts.length;
  for (let g = 0; g < count; g++) {
    const k = count === 1 ? 0 : (g / (count - 1)) * 1.1 - 0.55;
    const end = Math.max(3, Math.round(n * (0.45 + rand(seed + g) * 0.4)));
    const line = [];
    for (let i = 0; i < end; i++) {
      const [tx, ty] = tangentAt(pts, i);
      const h = half(i / (n - 1)) * k;
      line.push([pts[i][0] - ty * h, pts[i][1] + tx * h]);
    }
    out.push({
      d: smoothPath(line),
      dash: `${40 + rand(seed + g + 20) * 80} ${8 + rand(seed + g + 21) * 14} ${16 + rand(seed + g + 22) * 30} ${6 + rand(seed + g + 23) * 10}`,
    });
  }
  return out;
}

/* ---------------- copa no topo: o tronco se abre em gravetos ---------------- */
// A ponta de cada tronco vira 3 a 5 gravetos finos que se espalham para cima,
// cobertos por uma copa de aquarela (como no desenho de referência).
function crownAt(curve, half, seed, scale, weight, out) {
  const n = 3 + Math.floor(rand(seed + 2) * 3);
  const size = (1 + Math.min(0.8, weight / 120)) * Math.max(0.6, scale);
  for (let i = 0; i < n; i++) {
    const s = 0.8 + rand(seed + i * 5.3) * 0.17;
    const [px, py] = bez(curve, s);
    const [tx, ty] = bezTangent(curve, s);
    // abre em leque: os de fora inclinam mais
    const spreadAng = (i / (n - 1) - 0.5) * 1.6 + (rand(seed + i * 9.1) - 0.5) * 0.4;
    const ca = Math.cos(spreadAng);
    const sa = Math.sin(spreadAng);
    const dx = tx * ca - ty * sa;
    const dy = tx * sa + ty * ca;
    const len = (42 + rand(seed + i * 2.7) * 46) * size;
    const bend = (rand(seed + i * 4.4) - 0.5) * 18 * size;
    const pts = [];
    for (let j = 0; j <= 8; j++) {
      const u = j / 8;
      const curl = Math.sin(u * Math.PI) * bend;
      pts.push([px + dx * len * u - dy * curl, py + dy * len * u + dx * curl - u * u * 10 * size]);
    }
    const h0 = Math.max(1.2, half(s) * 0.55);
    out.twigs.push({ pts, half: (u) => Math.max(0.5, h0 * Math.pow(1 - u, 0.9)) });
    // copa sobre a ponta de cada graveto
    const [ex, ey] = pts[pts.length - 1];
    const r = (16 + rand(seed + i * 6.6) * 12) * size;
    out.crowns.push({ cx: ex, cy: ey - r * 0.2, r });
    out.crowns.push({ cx: ex + (rand(seed + i) - 0.5) * r * 1.4, cy: ey + r * 0.35, r: r * 0.75 });
  }
  // miolo da copa cobrindo a ponta do tronco
  const tip = bez(curve, 1);
  out.crowns.push({ cx: tip[0], cy: tip[1] - 4 * size, r: 24 * size });
}

/* ---------------- geometria de cada árvore ---------------- */
export function treeGeometry(t) {
  const { x, baseY, H, baseHalf, seed } = t;
  const lean = (rand(seed + 1) - 0.5) * 60 * t.scale;
  const tipY = baseY - H;
  const extra = { twigs: [], crowns: [] };

  if (!t.forked) {
    // Tronco único: afina devagar e termina dentro da copa do topo
    const tip = [x + lean + (lean >= 0 ? 12 : -12) * t.scale, tipY];
    const curve = [[x, baseY], [x + lean * 0.15, baseY - H * 0.38], [x + lean * 0.75, baseY - H * 0.78], tip];
    const half = (s) => Math.max(1.1, baseHalf * Math.pow(1 - s, 0.7)) + (s < 0.1 ? baseHalf * 0.5 * Math.pow(1 - s / 0.1, 2) : 0);
    crownAt(curve, half, seed + 100, t.scale, t.weight, extra);
    return { limbs: [{ curve, half, role: "trunk" }], leaders: { left: curve, right: curve }, tip, ...extra };
  }

  // Bifurcado: base grossa até a forquilha e dois troncos saindo dela
  const forkY = baseY - H * 0.42;
  const forkHalf = baseHalf * 0.78;
  const baseCurve = [[x, baseY], [x + lean * 0.05, baseY - H * 0.16], [x + lean * 0.12, forkY + H * 0.12], [x + lean * 0.15, forkY]];
  const baseHalfFn = (s) => baseHalf - (baseHalf - forkHalf) * s + (s < 0.1 ? baseHalf * 0.5 * Math.pow(1 - s / 0.1, 2) : 0);
  const fx = x + lean * 0.15;
  const wobL = (rand(seed + 3) - 0.5) * 0.12 * H;
  const wobR = (rand(seed + 4) - 0.5) * 0.12 * H;
  const leftTip = [fx - H * 0.3 + wobL, tipY + H * 0.1];
  const rightTip = [fx + H * 0.34 + wobR, tipY];
  const left = [[fx - forkHalf * 0.3, forkY + 8], [fx - forkHalf * 0.45 - 4, forkY - H * 0.22], [fx - H * 0.14 + wobL, tipY + H * 0.32], leftTip];
  const right = [[fx + forkHalf * 0.3, forkY + 8], [fx + forkHalf * 0.45 + 6, forkY - H * 0.24], [fx + H * 0.16 + wobR, tipY + H * 0.26], rightTip];
  const leaderHalf = (s) => Math.max(1, forkHalf * 0.72 * Math.pow(1 - s, 0.72));
  crownAt(left, leaderHalf, seed + 200, t.scale * 0.9, t.weight / 2, extra);
  crownAt(right, leaderHalf, seed + 300, t.scale * 0.9, t.weight / 2, extra);
  return {
    limbs: [
      { curve: baseCurve, half: baseHalfFn, role: "trunk" },
      { curve: left, half: leaderHalf, role: "leader" },
      { curve: right, half: leaderHalf, role: "leader" },
    ],
    leaders: { left, right },
    forkY,
    tip: rightTip,
    ...extra,
  };
}

/**
 * Onde cada galho principal sai do tronco. A copa de cada galho continua
 * alternando esquerda/direita, mas a altura e (no tronco dividido) o tronco
 * de onde ele nasce são aleatórios: muitos cruzam o meio e se sobrepõem.
 */
export function attachPoints(t, geo) {
  const n = t.branches.length;
  // alturas embaralhadas (mas espalhadas), estáveis para cada galho
  const order = t.branches
    .map((b, i) => ({ i, r: rand(hashString(b.id || String(i)) + 0.5 + (t.look || 0)) }))
    .sort((a, b) => a.r - b.r);
  const slot = new Array(n);
  order.forEach((o, k) => {
    slot[o.i] = k;
  });

  return t.branches.map((branch, i) => {
    const h = hashString(branch.id || String(i)) + (t.look || 0);
    const isLeft = i % 2 === 1;
    const jitter = (rand(h + 1.7) - 0.5) * 0.08;
    if (t.forked) {
      // 60% nasce do tronco do mesmo lado; 40% atravessa para o outro lado
      const cross = rand(h + 3.9) < 0.4;
      const fromLeft = cross ? !isLeft : isLeft;
      const s = Math.min(0.92, Math.max(0.1, 0.12 + (0.76 * slot[i]) / Math.max(1, n - 1) + jitter));
      return { point: bez(fromLeft ? geo.leaders.left : geo.leaders.right, s), isLeft };
    }
    const s = Math.min(0.9, Math.max(0.16, (n === 1 ? 0.55 : 0.18 + (0.7 * slot[i]) / (n - 1)) + jitter));
    return { point: bez(geo.limbs[0].curve, s), isLeft };
  });
}

/**
 * Raízes naturais: poucas raízes-mestras grossas saem do pé do tronco, se
 * abrem sobre o chão e mergulham; por baixo, radicelas finas serpenteiam e se
 * ramificam. Tamanho, quantidade e grossura acompanham o tamanho da árvore.
 * "Aleatorizar galhos" troca o desenho (t.seed muda com tree.look).
 */
export function treeRoots(t) {
  const { x, baseY, baseHalf, weight, seed } = t;
  // 0.5 (árvore pequena) … ~1.6 (árvore grande)
  const size = Math.max(0.5, Math.min(1.7, baseHalf / 34 + weight / 400));
  const count = Math.min(16, 4 + Math.floor(size * 5) + Math.floor(rand(seed + 0.3) * 3));
  const roots = [];

  const push = (pts, w0, rs) => {
    const power = 0.7 + rand(rs + 5) * 1.1;
    const half = (u) => Math.max(0.45, w0 * Math.pow(1 - u, power));
    roots.push({ d: pathOutline(pts, half), grains: w0 > 4.5 ? pathGrains(pts, half, w0 > 9 ? 3 : 2, rs) : [] });
  };

  // Raiz que entra na terra: caminhada aleatória a partir de um ângulo
  const dig = (sx, sy, ang, len, w0, rs, depth) => {
    const steps = Math.max(6, Math.round(len / 14));
    const step = len / steps;
    const pts = [[sx, sy]];
    let a = ang;
    let px = sx;
    let py = sy;
    const wander = 0.18 + rand(rs + 1) * 0.35;
    for (let j = 1; j <= steps; j++) {
      a += (rand(rs + j * 1.37) - 0.5) * wander * 2;
      px += Math.sin(a) * step;
      py += Math.cos(a) * step;
      // nunca sai da terra
      const floor = groundY(px) + 4 + j * 0.6;
      if (py < floor) {
        py = floor;
        a *= 0.85;
      }
      pts.push([px, py]);
    }
    push(pts, w0, rs);
    // ramificações mais finas, em ângulos e tamanhos aleatórios
    if (depth < 2 && w0 > 1.6) {
      const kids = rand(rs + 7) < 0.55 ? 1 + Math.floor(rand(rs + 8) * 2) : 0;
      for (let k = 0; k < kids; k++) {
        const at = Math.floor(pts.length * (0.25 + rand(rs + 9 + k) * 0.5));
        const [bx, by] = pts[at];
        const turn = (rand(rs + 11 + k) < 0.5 ? -1 : 1) * (0.4 + rand(rs + 12 + k) * 0.7);
        dig(bx, by, a * 0.5 + turn, len * (0.3 + rand(rs + 13 + k) * 0.35), w0 * (0.35 + rand(rs + 14 + k) * 0.2), rs + 40 + k * 13, depth + 1);
      }
    }
  };

  // Raízes-mestras (como no desenho de referência): nascem do pé do tronco,
  // se abrem pelo chão, um pouco acima da terra, e depois mergulham nela
  const buttress = (side, rs) => {
    const w0 = Math.max(1.5, baseHalf * (0.32 + rand(rs + 0.4) * 0.26));
    const sx = x + side * baseHalf * (0.25 + rand(rs + 0.6) * 0.35);
    const sy = baseY - baseHalf * (0.35 + rand(rs + 0.8) * 0.45);
    const crawl = (40 + rand(rs + 1.1) * 90) * size;
    const pts = [];
    const steps = 10;
    for (let j = 0; j <= steps; j++) {
      const u = j / steps;
      const px = sx + side * crawl * Math.pow(u, 0.85);
      // desce rápido do tronco até "deitar" sobre a terra
      const target = groundY(px) - w0 * 0.55;
      const ease = 1 - Math.pow(1 - u, 2.4);
      pts.push([px, sy + (target - sy) * ease + Math.sin(u * Math.PI) * w0 * 0.15]);
    }
    // depois mergulha, serpenteando
    let a = side * (0.95 + rand(rs + 1.5) * 0.4);
    let [px, py] = pts[pts.length - 1];
    const diveLen = (40 + rand(rs + 1.7) * 90) * size;
    const diveSteps = Math.max(5, Math.round(diveLen / 14));
    for (let j = 1; j <= diveSteps; j++) {
      a += (rand(rs + 3 + j * 1.31) - 0.5) * 0.45 - side * 0.05;
      px += Math.sin(a) * (diveLen / diveSteps);
      py += Math.cos(a) * (diveLen / diveSteps);
      py = Math.max(py, groundY(px) + 2 + j * 1.5);
      pts.push([px, py]);
    }
    const power = 1.05 + rand(rs + 5) * 0.4;
    const half = (u) => Math.max(0.6, w0 * Math.pow(1 - u, power));
    roots.push({ d: pathOutline(pts, half), grains: w0 > 4.5 ? pathGrains(pts, half, w0 > 9 ? 3 : 2, rs) : [] });
    // radicelas finas saindo da parte enterrada
    const kids = 1 + Math.floor(rand(rs + 7) * 2);
    for (let k = 0; k < kids; k++) {
      const at = steps + 1 + Math.floor((pts.length - steps - 2) * rand(rs + 9 + k));
      const [bx, by] = pts[Math.min(pts.length - 2, at)];
      const u = Math.min(pts.length - 2, at) / (pts.length - 1);
      dig(bx, by, side * (0.2 + rand(rs + 12 + k) * 0.7), diveLen * (0.4 + rand(rs + 13 + k) * 0.4), Math.max(0.8, half(u) * 0.45), rs + 60 + k * 13, 1);
    }
  };

  // 2 a 5 raízes-mestras, alternando os lados
  const masters = Math.min(5, 2 + Math.floor(size * 1.6 + rand(seed + 0.9)));
  for (let i = 0; i < masters; i++) {
    const rs = seed + 500 + i * 23.1;
    const side = i % 2 === 0 ? -1 : 1;
    buttress(i < 2 ? side : rand(rs) < 0.5 ? -1 : 1, rs);
  }

  // Radicelas por baixo da terra: finas, em direções aleatórias
  for (let i = 0; i < count - masters; i++) {
    const rs = seed + i * 17.3;
    const side = rand(rs) < 0.5 ? -1 : 1;
    const thick = 0.05 + Math.pow(rand(rs + 0.7), 2) * 0.2;
    const w0 = Math.max(0.8, baseHalf * thick);
    const sx = x + side * baseHalf * (0.1 + rand(rs + 2.1) * 0.7);
    const sy = baseY + 2 + rand(rs + 2.9) * 6;
    const len = (35 + rand(rs + 1.3) * 120) * size * (0.6 + thick * 1.5);
    // ângulo a partir da vertical: algumas descem quase retas, outras abrem para o lado
    const ang = side * (0.15 + Math.pow(rand(rs + 4.1), 0.8) * 1.0);
    dig(sx, sy, ang, len, w0, rs, 0);
  }
  return roots;
}

/** Raiz rasteira que liga a árvore principal a uma árvore nova. */
export function runnerPath(from, to, seed) {
  const pts = [];
  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    const px = from.x + (to.x - from.x) * s;
    const wob = Math.sin(s * Math.PI * 3 + rand(seed) * 6) * 5;
    pts.push([px, groundY(px) + 10 + wob]);
  }
  return smoothPath(pts);
}
