// =========================================================
// PERSONAGENS 2D EM PIXEL (no formato desenhado pelo Ricardo)
// Grade em "células": cabeça quadrada grande com contorno preto, braço
// esquerdo largo (vista 3/4), tronco, braço direito estreito e duas pernas.
// Tudo é montado em camadas: pele → cabelo → rosto → chapéu/elmo →
// roupa → calça → sapato → itens (cajado, arco, espada, escudo).
// Cada célula pertence a uma parte (head, body, armL, armR, legL, legR),
// assim o Santuário consegue mexer braços e pernas ao andar e pular.
// =========================================================

// Área total da grade (sobra espaço para chapéu, arco e cajado)
export const GRID = { c0: -7, c1: 42, r0: -17, r1: 39 };
const K = '#0b0b0d'; // contorno

// ---------- cores ----------
const toRgb = (hex) => {
  const h = String(hex || '').replace('#', '');
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(h)) return null;
  const f = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
};
const toHex = (rgb) => `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
/** escurece (f < 0) ou clareia (f > 0) uma cor */
export const shade = (hex, f) => {
  const rgb = toRgb(hex);
  if (!rgb) return hex;
  return toHex(rgb.map((v) => (f < 0 ? v * (1 + f) : v + (255 - v) * f)));
};

// ---------- opções editáveis ----------
export const HAIR_STYLES_2D = [
  { id: 'topete', name: 'Topete' },
  { id: 'curto', name: 'Curto' },
  { id: 'franja', name: 'Franja' },
  { id: 'longo', name: 'Longo' },
  { id: 'cacheado', name: 'Cacheado' },
  { id: 'rabo', name: 'Rabo de cavalo' },
  { id: 'moicano', name: 'Moicano' },
  { id: 'careca', name: 'Careca' }
];
export const BEARD_STYLES_2D = [
  { id: 'nenhuma', name: 'Sem barba' },
  { id: 'bigode', name: 'Bigode' },
  { id: 'curta', name: 'Curta' },
  { id: 'longa', name: 'Longa' }
];
export const MOUTH_STYLES_2D = [
  { id: 'sorriso', name: 'Sorrisão' },
  { id: 'leve', name: 'Sorriso leve' },
  { id: 'serio', name: 'Sério' },
  { id: 'surpreso', name: 'Surpreso' },
  { id: 'batom', name: 'Batom' }
];
export const EYE_STYLES_2D = [
  { id: 'grande', name: 'Grandes' },
  { id: 'feliz', name: 'Felizes' },
  { id: 'pequeno', name: 'Pequenos' },
  { id: 'cilios', name: 'Com cílios' }
];

// ---------- a "tela" de células ----------
function makeCanvas() {
  const cells = new Map(); // "c,r" -> { color, part }
  const key = (c, r) => `${c},${r}`;
  const api = {
    cells,
    set(c, r, color, part) {
      if (c < GRID.c0 || c > GRID.c1 || r < GRID.r0 || r > GRID.r1) return;
      cells.set(key(c, r), { color, part });
    },
    get(c, r) {
      return cells.get(key(c, r));
    },
    del(c, r) {
      cells.delete(key(c, r));
    },
    rect(c0, r0, c1, r1, color, part) {
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) api.set(c, r, color, part);
    },
    // contorno preto em volta de um conjunto de células (peças extras)
    outline(list, part) {
      const own = new Set(list.map(([c, r]) => key(c, r)));
      list.forEach(([c, r]) =>
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1]
        ].forEach(([dc, dr]) => {
          const k = key(c + dc, r + dr);
          if (!own.has(k) && !cells.has(k)) api.set(c + dc, r + dr, K, part);
        })
      );
    }
  };
  return api;
}

// ---------- molde (o desenho base do Ricardo) ----------
function drawTemplate(cv) {
  // cabeça
  cv.rect(2, 0, 34, 0, K, 'head');
  cv.set(1, 1, K, 'head');
  cv.rect(0, 2, 0, 23, K, 'head');
  cv.rect(35, 1, 35, 23, K, 'head');
  cv.rect(1, 24, 34, 24, K, 'head');
  // braço esquerdo (largo, mais perto) / tronco / braço direito
  cv.rect(3, 25, 3, 32, K, 'armL');
  cv.rect(3, 33, 13, 33, K, 'armL');
  cv.rect(13, 25, 13, 32, K, 'armL');
  cv.rect(28, 25, 28, 30, K, 'body');
  cv.rect(14, 31, 27, 31, K, 'body');
  cv.rect(28, 31, 28, 32, K, 'armR');
  cv.rect(33, 25, 33, 32, K, 'armR');
  cv.rect(28, 33, 33, 33, K, 'armR');
  // pernas
  cv.rect(7, 34, 7, 37, K, 'legL');
  cv.rect(7, 38, 20, 38, K, 'legL');
  cv.rect(20, 32, 20, 37, K, 'legL');
  cv.rect(28, 34, 28, 37, K, 'legR');
  cv.rect(21, 38, 28, 38, K, 'legR');
}

// interior da cabeça (sem o contorno)
const inHead = (c, r) => r >= 1 && r <= 23 && c >= 1 && c <= 34 && !(r === 1 && c === 1);

// ---------- cabelos: célula (c,r) é cabelo? ----------
const TOPETE_LEFT = { 9: 13, 10: 13, 11: 13, 12: 12, 13: 12, 14: 12, 15: 11, 16: 11, 17: 10, 18: 9, 19: 9, 20: 8, 21: 7, 22: 6, 23: 6 };
const HAIR = {
  topete: (c, r) => {
    if (r <= 9) return true;
    if (c < (TOPETE_LEFT[r] ?? 6)) return true;
    if (r <= 16 && c >= 31) return true;
    if (r === 10 && c >= 21 && c <= 28) return true;
    if (r === 11 && (c === 21 || c === 22)) return true;
    return false;
  },
  curto: (c, r) => r <= 6 || (r === 7 && c % 5 < 3) || ((c <= 3 || c >= 32) && r <= 13),
  franja: (c, r) => r <= 9 || ((c <= 4 || c >= 31) && r <= 18),
  longo: (c, r) => r <= 7 || c <= 5 || c >= 30,
  cacheado: (c, r) => r <= 8 || (r === 9 && c % 4 < 2) || ((c <= 4 || c >= 31) && r <= 15) || ((c <= 3 || c >= 32) && r <= 18 && r % 2 === 0),
  rabo: (c, r) => r <= 6 || (r === 7 && c % 5 < 3) || ((c <= 3 || c >= 32) && r <= 12),
  moicano: (c, r) => c >= 13 && c <= 22 && r <= 5,
  careca: () => false
};

// volume de cabelo fora da cabeça (topete, coque, moicano, rabo)
function hairExtras(style, cv, hair) {
  const hairD = shade(hair, -0.3);
  const list = [];
  const add = (c, r, col = hair) => {
    cv.set(c, r, col, 'head');
    list.push([c, r]);
  };
  if (style === 'topete') {
    for (let c = 11; c <= 29; c++) add(c, 0);
    for (let c = 12; c <= 28; c++) add(c, -1, c > 22 ? hairD : hair);
    for (let r = 1; r <= 5; r++) add(36, r, hairD);
    add(37, 2, hairD);
    add(37, 3, hairD);
  }
  if (style === 'moicano') {
    for (let r = -4; r <= 0; r++) for (let c = 14 + Math.max(0, -r - 2); c <= 21 - Math.max(0, -r - 2); c++) add(c, r, r < -2 ? shade(hair, 0.15) : hair);
  }
  if (style === 'rabo') {
    for (let r = 3; r <= 14; r++) for (let c = 36; c <= 37 + (r > 6 && r < 12 ? 1 : 0); c++) add(c, r, r > 9 ? hairD : hair);
  }
  if (style === 'cacheado') {
    [3, 9, 15, 21, 27].forEach((c0) => [c0, c0 + 1, c0 + 2, c0 + 3].forEach((c) => add(c, 0, hair)));
    [5, 11, 17, 23].forEach((c0) => [c0, c0 + 1].forEach((c) => add(c, -1, shade(hair, 0.12))));
  }
  if (list.length) cv.outline(list, 'head');
}

// ---------- rosto ----------
function drawFace(cv, look) {
  const eye = look.eye || '#0b0b0d';
  const eyeShade = shade(eye, -0.35);
  const style = look.eyes || 'grande';
  if (style === 'feliz') {
    // olhos fechados sorrindo (^ ^)
    [
      [14, 14],
      [15, 13],
      [16, 12],
      [17, 13],
      [18, 14],
      [24, 14],
      [25, 13],
      [26, 12],
      [27, 13],
      [28, 14]
    ].forEach(([c, r]) => cv.set(c, r, K, 'head'));
  } else {
    const tall = style === 'pequeno' ? [12, 14] : [11, 15];
    if (style === 'cilios') {
      [
        [13, 10],
        [14, 10],
        [12, 9],
        [28, 10],
        [29, 10],
        [30, 9]
      ].forEach(([c, r]) => cv.set(c, r, K, 'head'));
    }
    for (let r = tall[0]; r <= tall[1]; r++) {
      // olho esquerdo: branco | pupila | sombra
      if (style !== 'pequeno') {
        cv.set(14, r, '#fbfbfb', 'head');
        cv.set(15, r, '#fbfbfb', 'head');
      }
      cv.set(16, r, eye, 'head');
      cv.set(17, r, eye, 'head');
      cv.set(18, r, eyeShade, 'head');
      // olho direito: pupila | sombra | branco
      cv.set(24, r, eye, 'head');
      cv.set(25, r, eye, 'head');
      cv.set(26, r, eyeShade, 'head');
      if (style !== 'pequeno') {
        cv.set(27, r, '#fbfbfb', 'head');
        cv.set(28, r, '#fbfbfb', 'head');
      }
    }
    // brilho no olho
    cv.set(16, tall[0], shade(eye, 0.55), 'head');
    cv.set(24, tall[0], shade(eye, 0.55), 'head');
  }
  // bochechas: risquinhos ou rosadas
  if (look.blush) {
    [12, 13, 14, 27, 28, 29].forEach((c) => {
      cv.set(c, 16, '#f9a8b4', 'head');
      cv.set(c, 17, '#fbc4cc', 'head');
    });
  } else {
    [12, 13, 14, 27, 28, 29].forEach((c) => cv.set(c, 16, K, 'head'));
  }

  // boca
  const lip = '#4a1010';
  const tongue = '#6b1717';
  const m = look.mouth || 'sorriso';
  if (m === 'focinho') {
    // focinho de porco (para o vendedor da vila)
    const sn = shade(look.skin || '#f6a5b0', -0.16);
    cv.rect(15, 16, 26, 20, sn, 'head');
    cv.rect(16, 15, 25, 15, sn, 'head');
    cv.rect(16, 21, 25, 21, sn, 'head');
    cv.rect(15, 16, 26, 16, shade(sn, 0.18), 'head');
    cv.rect(17, 17, 18, 19, '#5b1f2a', 'head');
    cv.rect(23, 17, 24, 19, '#5b1f2a', 'head');
    cv.rect(17, 23, 24, 23, '#7a2a36', 'head');
  } else if (m === 'sorriso') {
    cv.rect(16, 18, 17, 18, '#ffffff', 'head');
    cv.rect(24, 18, 25, 18, '#ffffff', 'head');
    cv.rect(17, 19, 24, 19, '#ffffff', 'head');
    cv.rect(14, 20, 26, 20, lip, 'head');
    cv.rect(14, 21, 26, 21, lip, 'head');
    cv.rect(18, 21, 24, 21, tongue, 'head');
    cv.rect(16, 22, 25, 22, lip, 'head');
    cv.rect(19, 22, 23, 22, tongue, 'head');
    cv.rect(18, 23, 23, 23, lip, 'head');
  } else if (m === 'leve') {
    cv.set(16, 19, K, 'head');
    cv.rect(17, 20, 24, 20, K, 'head');
    cv.set(25, 19, K, 'head');
  } else if (m === 'batom') {
    const lipC = '#e11d48';
    cv.set(17, 19, lipC, 'head');
    cv.set(24, 19, lipC, 'head');
    cv.rect(18, 20, 23, 20, lipC, 'head');
    cv.rect(19, 21, 22, 21, shade(lipC, -0.25), 'head');
  } else if (m === 'serio') {
    cv.rect(17, 20, 24, 20, K, 'head');
  } else {
    cv.rect(19, 19, 22, 19, lip, 'head');
    cv.rect(18, 20, 23, 22, lip, 'head');
    cv.rect(19, 20, 22, 21, tongue, 'head');
    cv.rect(19, 23, 22, 23, lip, 'head');
  }
}

function drawBeard(cv, look, hair) {
  const b = look.beard || 'nenhuma';
  if (b === 'nenhuma') return;
  const hairD = shade(hair, -0.25);
  if (b === 'bigode') {
    cv.rect(15, 18, 26, 18, hair, 'head');
    cv.rect(14, 19, 16, 19, hair, 'head');
    cv.rect(25, 19, 27, 19, hair, 'head');
    return;
  }
  // barba: cobre a parte de baixo do rosto
  const top = b === 'curta' ? 19 : 18;
  for (let r = top; r <= 23; r++) for (let c = 6; c <= 33; c++) {
    const edge = Math.abs(c - 20) > 13 - (r - top);
    if (!edge && inHead(c, r)) cv.set(c, r, (c + r) % 5 === 0 ? hairD : hair, 'head');
  }
  cv.rect(15, 18, 26, 18, hair, 'head'); // bigode
  if (b === 'curta') cv.rect(18, 20, 23, 20, '#4a1010', 'head');
  if (b === 'longa') {
    // desce por cima do tronco
    const list = [];
    for (let r = 24; r <= 31; r++) {
      const half = Math.max(1, 8 - Math.floor((r - 24) * 1.1));
      for (let c = 21 - half; c <= 20 + half; c++) {
        cv.set(c, r, (c + r) % 4 === 0 ? hairD : hair, 'body');
        list.push([c, r]);
      }
    }
    cv.outline(list, 'body');
  }
}

// ---------- orelhas de elfo (pontudas, para fora da cabeça) ----------
function drawEars(cv, look) {
  if (look.ears === 'porco') {
    // orelhinhas de porco caídas em cima da cabeça
    const sk = look.skin || '#f6a5b0';
    const dk = shade(sk, -0.2);
    [
      [4, 8],
      [27, 31]
    ].forEach(([a, b]) => {
      for (let r = -4; r <= 1; r++) {
        const w = Math.max(0, r + 4);
        for (let c = a + (r < -1 ? 1 : 0); c <= Math.min(b, a + w); c++) cv.set(c, r, r === -4 || c === a ? dk : sk, 'head');
      }
      cv.set(a + 2, -1, shade(sk, -0.32), 'head');
    });
    return;
  }
  if (look.ears !== 'elfo') return;
  const skin = look.skin;
  const skinD = shade(skin, -0.15);
  const list = [];
  const put = (c, r, col) => {
    cv.set(c, r, col, 'head');
    list.push([c, r]);
  };
  // [coluna para fora, linhas]
  const shape = [
    [1, [9, 14]],
    [2, [8, 13]],
    [3, [7, 11]],
    [4, [6, 9]],
    [5, [5, 7]]
  ];
  shape.forEach(([d, [r0, r1]]) => {
    for (let r = r0; r <= r1; r++) {
      put(-d, r, d === 1 ? skinD : skin);
      put(35 + d, r, d === 1 ? skinD : skin);
    }
  });
  cv.outline(list, 'head');
}

// ---------- chapéus e elmos ----------
function drawHeadgear(cv, kind, look) {
  const list = [];
  const put = (c, r, color) => {
    cv.set(c, r, color, 'head');
    list.push([c, r]);
  };
  if (kind === 'chapeu-mago') {
    const hat = look.outfit;
    const hatD = shade(hat, -0.3);
    const hatL = shade(hat, 0.18);
    // aba larga
    for (let c = -3; c <= 38; c++) put(c, 1, hatD);
    for (let c = -1; c <= 36; c++) put(c, 2, hatD);
    // cone inclinado
    for (let r = 0; r >= -15; r--) {
      const w = Math.max(1, Math.round(14 - (-r) * 0.95));
      const center = 17 + Math.round((-r) * 0.45);
      for (let c = center - w; c <= center + w; c++) put(c, r, c < center - w + 2 ? hatD : c > center + w - 3 ? hatL : hat);
    }
    // faixa e estrela
    for (let c = 4; c <= 31; c++) put(c, -1, look.trim);
    [
      [22, -8],
      [21, -7],
      [22, -7],
      [23, -7],
      [22, -6]
    ].forEach(([c, r]) => put(c, r, look.trim));
  }
  if (kind === 'chapeu-arqueiro') {
    const hat = look.outfit;
    const hatD = shade(hat, -0.3);
    for (let c = 1; c <= 34; c++) put(c, 3, hatD);
    for (let r = 2; r >= -4; r--) {
      const left = 4 + (2 - r) * 2;
      const right = 30 + (2 - r);
      for (let c = left; c <= right; c++) put(c, r, r === 2 ? hatD : hat);
    }
    // pena
    for (let i = 0; i <= 7; i++) {
      put(30 + i, -3 - i, look.trim);
      put(31 + i, -3 - i, shade(look.trim, -0.2));
    }
  }
  if (kind === 'tiara') {
    // aro dourado na testa com uma pedra no meio
    for (let c = 2; c <= 33; c++) put(c, 5, look.trim);
    for (let c = 3; c <= 32; c++) if (c % 3 === 0) put(c, 4, shade(look.trim, 0.2));
    [16, 17, 18, 19].forEach((c) => put(c, 4, look.trim));
    [17, 18].forEach((c) => {
      put(c, 3, '#22c55e');
      put(c, 4, '#16a34a');
    });
  }
  if (kind === 'elmo') {
    const metal = '#b8c0cc';
    const metalD = '#7c8594';
    const metalL = '#e6ebf2';
    for (let r = -2; r <= 9; r++) {
      const inset = r < 0 ? 2 - r : 0;
      for (let c = 0 + inset; c <= 35 - inset; c++) put(c, r, c < 4 + inset ? metalD : c > 30 - inset ? metalL : metal);
    }
    // protetor do nariz e das bochechas
    for (let r = 10; r <= 13; r++) {
      put(20, r, metal);
      put(21, r, metalD);
    }
    for (let r = 10; r <= 17; r++) {
      [1, 2, 3, 4].forEach((c) => put(c, r, metalD));
      [31, 32, 33, 34].forEach((c) => put(c, r, metal));
    }
    // rebites
    [4, 10, 16, 22, 28].forEach((c) => put(c, 7, metalL));
    // penacho
    for (let r = -8; r <= -3; r++) for (let c = 15; c <= 22 - Math.max(0, -5 - r); c++) put(c, r, (c + r) % 3 ? look.trim : shade(look.trim, -0.25));
  }
  // o contorno só nas bordas de fora (dentro da cabeça já existe)
  const extra = list.filter(([c, r]) => !inHead(c, r));
  if (extra.length) cv.outline(extra, 'head');
}

// ---------- roupa ----------
function drawOutfit(cv, look, cls) {
  const o = look.outfit;
  const oD = shade(o, -0.32);
  const oL = shade(o, 0.14);
  const o2 = look.outfit2 || shade(o, -0.45);
  const o2L = shade(o2, 0.12);
  const skin = look.skin;
  // braço esquerdo (com o lado do casaco)
  for (let r = 25; r <= 32; r++)
    for (let c = 4; c <= 12; c++) {
      const low = r >= 28;
      let col = low ? o2 : o;
      if (c <= 5) col = low ? shade(o2, -0.2) : oD;
      if (r === 28 && c >= 6 && c <= 8) col = o2L;
      cv.set(c, r, col, 'armL');
    }
  cv.rect(11, 31, 12, 32, skin, 'armL'); // mão
  // braço direito
  for (let r = 25; r <= 32; r++)
    for (let c = 29; c <= 32; c++) {
      const low = r >= 28;
      cv.set(c, r, low ? (c === 32 ? shade(o2, -0.2) : o2) : c === 32 ? oD : o, 'armR');
    }
  cv.rect(29, 31, 30, 32, skin, 'armR');
  // tronco: casaco + camisa clara no meio
  for (let r = 25; r <= 30; r++)
    for (let c = 14; c <= 27; c++) {
      let col = c <= 15 ? oD : c >= 26 ? oL : o;
      if (c >= 18 && c <= 22) col = look.shirt || '#e7e7e7';
      cv.set(c, r, col, 'body');
    }
  cv.rect(19, 25, 21, 25, skin, 'body'); // pescoço
  if (cls === 'warrior') {
    // peitoral de metal
    for (let r = 25; r <= 30; r++) for (let c = 15; c <= 26; c++) cv.set(c, r, c <= 17 ? '#7c8594' : c >= 24 ? '#e6ebf2' : '#b8c0cc', 'body');
    cv.rect(20, 26, 21, 29, look.trim, 'body');
    cv.rect(18, 27, 23, 27, look.trim, 'body');
  } else {
    // alça / cinto em diagonal (como no desenho original)
    for (let i = 0; i <= 13; i++) {
      const c = 14 + i;
      const r = 25 + Math.floor(i / 2.4);
      cv.set(c, r, o2, 'body');
      if (r + 1 <= 30) cv.set(c, r + 1, shade(o2, -0.25), 'body');
    }
  }
}

function drawLegs(cv, look) {
  const p = look.pants;
  const pD = shade(p, -0.3);
  const s = look.shoes;
  const sL = shade(s, 0.15);
  // perna esquerda
  cv.rect(14, 32, 19, 33, p, 'legL');
  for (let r = 34; r <= 35; r++) for (let c = 8; c <= 19; c++) cv.set(c, r, c <= 9 ? pD : p, 'legL');
  for (let r = 36; r <= 37; r++) for (let c = 8; c <= 19; c++) cv.set(c, r, r === 36 ? sL : s, 'legL');
  cv.rect(13, 37, 16, 37, '#e5e5e5', 'legL'); // sola
  // perna direita
  for (let r = 32; r <= 35; r++) for (let c = 21; c <= 27; c++) cv.set(c, r, c === 27 ? pD : p, 'legR');
  for (let r = 36; r <= 37; r++) for (let c = 21; c <= 27; c++) cv.set(c, r, r === 36 ? sL : s, 'legR');
  cv.rect(24, 37, 25, 37, '#e5e5e5', 'legR');
}

// ---------- itens ----------
function drawItem(cv, cls, look) {
  const list = [];
  const put = (c, r, color, part) => {
    cv.set(c, r, color, part);
    list.push([c, r, part]);
  };
  if (cls === 'wizard') {
    // cajado na mão direita, com uma gema no topo
    for (let r = 8; r <= 38; r++) {
      put(35, r, '#8b5a2b', 'armR');
      put(36, r, '#6b4220', 'armR');
    }
    for (let r = 3; r <= 7; r++) for (let c = 34; c <= 37; c++) put(c, r, r === 3 || c === 37 ? shade(look.trim, -0.2) : look.trim, 'armR');
    put(34, 4, '#ffffff', 'armR');
  }
  if (cls === 'elf') {
    const wood = '#6b4a22';
    for (let r = 10; r <= 38; r++) {
      const c = 35 + (r < 16 ? Math.round((16 - r) / 3) : 0);
      put(c, r, wood, 'armR');
      put(c + 1, r, shade(wood, -0.2), 'armR');
    }
    // folhas no topo
    [
      [36, 5], [37, 5], [38, 6], [37, 6], [36, 6],
      [39, 8], [40, 8], [40, 9], [39, 9],
      [34, 8], [33, 8], [33, 9], [34, 9],
      [37, 3], [38, 3], [38, 4], [37, 4]
    ].forEach(([c, r], i) => put(c, r, i % 3 === 0 ? '#16a34a' : i % 3 === 1 ? '#22c55e' : '#4ade80', 'armR'));
    put(38, 7, look.trim, 'armR');
  }
  if (cls === 'archer') {
    // arco na mão esquerda
    const bow = '#7a4a22';
    for (let r = 20; r <= 40; r++) {
      const d = Math.abs(r - 30);
      const c = -3 + Math.round((d * d) / 30);
      put(c, r, bow, 'armL');
      put(c + 1, r, shade(bow, 0.15), 'armL');
    }
    for (let r = 21; r <= 39; r++) put(3, r, '#e5e5e5', 'armL');
  }
  if (cls === 'warrior') {
    // espada erguida na mão direita (do lado da cabeça, sem cobrir o elmo)
    for (let r = 12; r <= 29; r++) {
      put(37, r, '#e6ebf2', 'armR');
      put(38, r, '#9aa3b2', 'armR');
    }
    put(37, 11, '#e6ebf2', 'armR');
    for (let c = 34; c <= 41; c++) put(c, 30, look.trim, 'armR');
    for (let r = 31; r <= 33; r++) {
      put(37, r, '#5b3a1e', 'armR');
      put(38, r, '#3f2814', 'armR');
    }
    // mão segurando o cabo
    put(34, 31, look.skin, 'armR');
    put(35, 31, look.skin, 'armR');
    put(36, 31, look.skin, 'armR');
    // escudo no braço esquerdo
    for (let r = 24; r <= 35; r++) {
      const w = r > 32 ? 35 - r : 3;
      for (let c = 2 - w; c <= 2 + w + 1; c++) put(c, r, c <= 0 ? '#7c8594' : '#b8c0cc', 'armL');
    }
    for (let r = 26; r <= 32; r++) put(1, r, look.trim, 'armL');
    for (let c = -1; c <= 3; c++) put(c, 28, look.trim, 'armL');
  }
  // contorno de cada peça, na parte certa
  const byPart = {};
  list.forEach(([c, r, part]) => (byPart[part] = byPart[part] || []).push([c, r]));
  Object.entries(byPart).forEach(([part, l]) => cv.outline(l, part));
}

// ---------- montagem ----------
export function buildHero2D(cls, look) {
  const cv = makeCanvas();
  const skin = look.skin;
  const skinD = shade(skin, -0.12);
  const skinL = shade(skin, 0.22);
  const hair = look.hair;
  const hairD = shade(hair, -0.28);
  const hairL = shade(hair, 0.18);
  const style = look.hairStyle || 'topete';
  const isHair = HAIR[style] || HAIR.curto;
  const hasHat = look.headgear !== false && !!look.hat;
  const coversHair = hasHat && look.hat !== 'tiara';

  // itens que ficam atrás do corpo (arco) vão primeiro
  drawTemplate(cv);
  drawOutfit(cv, look, cls);
  drawLegs(cv, look);

  // cabeça: pele com sombra à esquerda e brilho à direita
  for (let r = 1; r <= 23; r++)
    for (let c = 1; c <= 34; c++) {
      if (!inHead(c, r)) continue;
      let col = skin;
      if (c <= 4 + Math.max(0, r - 17) && r >= 14) col = skinD;
      if (c >= 33 && r >= 16) col = skinL;
      if (isHair(c, r)) {
        const edge = !isHair(c, r + 1) || !isHair(c + 1, r) || !isHair(c - 1, r);
        col = edge ? hairD : c > 24 && r < 6 ? hairL : hair;
        if (r <= 2 && c > 28) col = hairL;
      }
      cv.set(c, r, col, 'head');
    }
  if (style === 'topete') {
    // traços do topete (como no desenho)
    cv.rect(10, 6, 23, 6, K, 'head');
    cv.set(9, 5, K, 'head');
    cv.rect(23, 5, 26, 5, K, 'head');
    cv.rect(27, 4, 29, 4, K, 'head');
  }
  // topete, moicano, coque e rabo ficam para fora da cabeça (sem chapéu)
  if (!coversHair) hairExtras(style, cv, hair);
  drawEars(cv, look);
  drawFace(cv, look);
  drawBeard(cv, look, hair);
  if (hasHat) drawHeadgear(cv, look.hat, look);
  if (look.item !== false) drawItem(cv, cls, look);
  return cv.cells;
}

// Junta células vizinhas da mesma cor (menos retângulos para desenhar)
export function toRects(cells) {
  const rows = new Map();
  cells.forEach((v, k) => {
    const [c, r] = k.split(',').map(Number);
    const g = `${v.part}|${r}`;
    if (!rows.has(g)) rows.set(g, []);
    rows.get(g).push({ c, r, color: v.color, part: v.part });
  });
  const out = [];
  rows.forEach((list) => {
    list.sort((a, b) => a.c - b.c);
    let cur = null;
    list.forEach((p) => {
      if (cur && p.c === cur.c + cur.w && p.color === cur.color) cur.w += 1;
      else {
        if (cur) out.push(cur);
        cur = { c: p.c, r: p.r, w: 1, color: p.color, part: p.part };
      }
    });
    if (cur) out.push(cur);
  });
  return out;
}

// =========================================================
// PERSONAGENS DESENHADOS PELO USUÁRIO (criador em pixel art)
// pixels = { "c,r": "#cor" } na mesma grade (GRID). As partes que se mexem
// (braços e pernas) são descobertas pela posição, seguindo o molde.
// =========================================================
export function partOf(c, r) {
  if (r <= 24) return 'head';
  if (r >= 34 || (r >= 32 && c >= 14 && c <= 27)) return c <= 20 ? 'legL' : 'legR';
  if (c <= 13) return 'armL';
  if (c >= 28) return 'armR';
  return 'body';
}

export function cellsFromPixels(pixels) {
  const cells = new Map();
  Object.entries(pixels || {}).forEach(([k, color]) => {
    const [c, r] = k.split(',').map(Number);
    if (Number.isFinite(c) && Number.isFinite(r) && color) cells.set(k, { color, part: partOf(c, r) });
  });
  return cells;
}

/** Copia um personagem pronto para o criador (vira pixels editáveis) */
export function pixelsFromHero(cls, look) {
  const out = {};
  buildHero2D(cls, look).forEach((v, k) => {
    out[k] = v.color;
  });
  return out;
}

/** Só o contorno do molde (para começar a desenhar por cima) */
export function templatePixels() {
  const cv = makeCanvas();
  drawTemplate(cv);
  const out = {};
  cv.cells.forEach((v, k) => {
    out[k] = v.color;
  });
  return out;
}

/** "Criar do zero": molde com a cabeça em pele clara, olhos e mãos (só para orientar) */
export function starterPixels() {
  const cv = makeCanvas();
  drawTemplate(cv);
  const skin = '#f8d9b8';
  for (let r = 1; r <= 23; r++) for (let c = 1; c <= 34; c++) if (inHead(c, r)) cv.set(c, r, skin, 'head');
  drawFace(cv, { eye: '#0b0b0d', eyes: 'grande', mouth: 'leve' });
  cv.rect(11, 31, 12, 32, skin, 'armL');
  cv.rect(29, 31, 30, 32, skin, 'armR');
  const out = {};
  cv.cells.forEach((v, k) => {
    out[k] = v.color;
  });
  return out;
}
