// =========================================================
// PEÇAS OPCIONAIS DOS PERSONAGENS
// Cabelos, barbas, armaduras (Guerreiro/Arqueiro) e elmos (Anão).
// Tudo é gerado em volta da cabeça/tronco de cada personagem.
// Blocos: [largura, altura, profundidade, x, y, z, cor, extras?]
// =========================================================

export const HAIR_STYLES = [
  { id: 'default', name: 'Padrão', icon: '✨' },
  { id: 'short_straight', name: 'Curto liso', icon: '💇' },
  { id: 'short_curly', name: 'Curto cacheado', icon: '🌀' },
  { id: 'long_straight', name: 'Longo liso', icon: '💁' },
  { id: 'long_curly', name: 'Longo cacheado', icon: '🌊' },
  { id: 'afro', name: 'Black power', icon: '☁️' },
  { id: 'braid', name: 'Trança', icon: '🪢' },
  { id: 'ponytail', name: 'Rabo de cavalo', icon: '🎀' }
];

export const BEARD_STYLES = [
  { id: 'default', name: 'Padrão', icon: '✨' },
  { id: 'none', name: 'Sem barba', icon: '🚫' },
  { id: 'short', name: 'Curta', icon: '🧔' },
  { id: 'long', name: 'Longa', icon: '🧙' },
  { id: 'full', name: 'Cheia', icon: '🪓' }
];

export const ARMOR_TYPES = [
  { id: 'default', name: 'Padrão', icon: '✨' },
  { id: 'leather', name: 'Couro', icon: '🟫' },
  { id: 'chain', name: 'Cota de malha', icon: '⛓️' },
  { id: 'plate', name: 'Placas', icon: '🛡️' }
];

export const HELM_TYPES = [
  { id: 'default', name: 'Chifres', icon: '🐂' },
  { id: 'miner', name: 'Mineiro', icon: '🔦' },
  { id: 'war', name: 'Guerra', icon: '⚔️' },
  { id: 'winged', name: 'Alado', icon: '🪽' },
  { id: 'none', name: 'Sem elmo', icon: '🚫' }
];

const LEATHER = '#7c4a24';
const LEATHER_DARK = '#4a2c14';
const CHAIN = '#9ca3af';
const STEEL = '#cbd5e1';
const STEEL_DARK = '#94a3b8';

// ---------- Cabelos (relativos ao centro da cabeça; cabeça = cubo de 30) ----------
const cap = () => [[32, 6, 32, 0, -16, 0]];
const fringe = () => [[30, 4, 3, 0, -12.5, 15.5]];
const shortBack = () => [
  [32, 20, 4, 0, -6, -15.5],
  [3, 12, 28, -16, -9, -1],
  [3, 12, 28, 16, -9, -1]
];
const curlyTop = () => {
  const out = [[30, 5, 30, 0, -16, 0]];
  [-10, 0, 10].forEach((x) =>
    [-10, 0, 10].forEach((z) => out.push([10, 6, 10, x, (x + z) % 20 === 0 ? -20 : -19, z]))
  );
  [-10, 0, 10].forEach((x) => out.push([9, 5, 4, x, -13, 15.5]));
  return out;
};

const HAIR_BUILDERS = {
  short_straight: () => [...cap(), ...fringe(), ...shortBack()],
  short_curly: () => [
    ...curlyTop(),
    [10, 10, 6, -10, -6, -15],
    [10, 12, 6, 0, -5, -15],
    [10, 10, 6, 10, -6, -15],
    [5, 10, 12, -16, -10, -7],
    [5, 10, 12, 16, -10, -7]
  ],
  long_straight: () => [
    ...cap(),
    ...fringe(),
    [3, 30, 26, -16, 1, -2],
    [3, 30, 26, 16, 1, -2],
    [32, 38, 5, 0, 4, -16]
  ],
  long_curly: () => [
    ...curlyTop(),
    [6, 32, 24, -17, 2, -3],
    [6, 32, 24, 17, 2, -3],
    [4, 8, 8, -20.5, -6, -4],
    [4, 8, 8, 20.5, 8, -4],
    [4, 8, 8, -20.5, 14, -6],
    [36, 40, 6, 0, 5, -16],
    [10, 6, 8, -12, 26, -15],
    [10, 7, 8, 0, 27, -15],
    [10, 6, 8, 12, 26, -15]
  ],
  afro: () => [
    [46, 28, 36, 0, -15, -4],
    [38, 6, 30, 0, -31, -4],
    [50, 18, 28, 0, -12, -6]
  ],
  braid: () => {
    const out = [...cap(), ...fringe(), ...shortBack()];
    for (let i = 0; i < 5; i += 1) out.push([8, 7, 7, i % 2 ? 1 : -1, 8 + i * 6.5, -18]);
    out.push([9, 3, 8, 0, 38, -18, 'T']);
    out.push([6, 5, 6, 0, 42, -18]);
    return out;
  },
  ponytail: () => [
    ...cap(),
    ...fringe(),
    [32, 16, 4, 0, -8, -15.5],
    [3, 10, 28, -16, -10, -1],
    [3, 10, 28, 16, -10, -1],
    [9, 6, 6, 0, -7, -18.5, 'T'],
    [8, 26, 6, 0, 8, -21, 'H', { rx: -14 }]
  ]
};

// ---------- Barbas (relativas ao centro da cabeça) ----------
const BEARD_BUILDERS = {
  short: () => [
    [30, 6, 3, 0, 12, 15.6],
    [14, 3, 3, 0, 6.5, 15.6],
    [3, 12, 3, -13.5, 6, 15.6],
    [3, 12, 3, 13.5, 6, 15.6]
  ],
  long: () => [
    [30, 9, 4, 0, 11, 15.5],
    [14, 3, 3, 0, 6, 16],
    [22, 14, 5, 0, 22, 15],
    [12, 9, 5, 0, 32, 14.5]
  ],
  full: () => [
    [32, 14, 6, 0, 9, 14.5],
    [32, 20, 6, 0, 25, 13.5],
    [16, 3, 3, 0, 5.5, 17.6],
    [4, 18, 24, -16, 2, 2],
    [4, 18, 24, 16, 2, 2]
  ]
};

// ---------- Armaduras (coordenadas do corpo do Guerreiro/Arqueiro) ----------
const ARMOR_BUILDERS = {
  leather: (gender) => [
    [34, 22, 20, 0, 19, 0, LEATHER],
    [4, 32, 21, -5, 20, 0, LEATHER_DARK, { rz: -28 }],
    [12, 5, 12, -21, 8, 0, LEATHER],
    [12, 5, 12, 21, 8, 0, LEATHER],
    [35, 5, 21, 0, 31, 0, LEATHER_DARK],
    [6, 5, 2, 0, 31, 11, 'T'],
    [10, 6, 10.5, -21, 33, 0, LEATHER_DARK],
    [10, 6, 10.5, 21, 33, 0, LEATHER_DARK],
    ...(gender === 'f'
      ? [
          [11, 8, 4, -7, 15, 11.5, LEATHER],
          [11, 8, 4, 7, 15, 11.5, LEATHER]
        ]
      : [])
  ],
  chain: (gender) => [
    [34, 30, 20, 0, 24, 0, CHAIN, { cls: 'vx-chain' }],
    [11, 15, 11, -21, 15, 0, CHAIN, { cls: 'vx-chain' }],
    [11, 15, 11, 21, 15, 0, CHAIN, { cls: 'vx-chain' }],
    [35, 4, 21, 0, 32, 0, LEATHER_DARK],
    [16, 16, 2, 0, 32, 11, 'O'],
    [6, 6, 2, 0, 31, 12.5, 'T', { rz: 45 }],
    ...(gender === 'f'
      ? [
          [11, 8, 4, -7, 15, 11.5, CHAIN, { cls: 'vx-chain' }],
          [11, 8, 4, 7, 15, 11.5, CHAIN, { cls: 'vx-chain' }]
        ]
      : [])
  ],
  plate: (gender) => [
    [36, 20, 22, 0, 17, 0, STEEL],
    [34, 6, 21, 0, 29.5, 0, STEEL_DARK],
    [34, 6, 21, 0, 35.5, 0, STEEL_DARK],
    [37, 2, 23, 0, 8, 0, 'T'],
    [22, 5, 18, 0, 6, 0, STEEL_DARK],
    [16, 9, 16, -22, 7, 0, STEEL],
    [16, 9, 16, 22, 7, 0, STEEL],
    [17, 2, 17, -22, 11.5, 0, 'T'],
    [17, 2, 17, 22, 11.5, 0, 'T'],
    [11, 9, 11, -21, 36, 0, STEEL_DARK],
    [11, 9, 11, 21, 36, 0, STEEL_DARK],
    [5, 5, 2, 0, 17, 12, 'T', { cls: 'vx-gem' }],
    ...(gender === 'f'
      ? [
          [12, 9, 5, -7, 14, 12.5, STEEL],
          [12, 9, 5, 7, 14, 12.5, STEEL]
        ]
      : [])
  ]
};

// ---------- Elmos do Anão (cabeça em y = 6, topo em y = -9) ----------
const HELM_BUILDERS = {
  miner: () => [
    [34, 9, 34, 0, -12, 0, '#eab308'],
    [38, 3, 38, 0, -8, 0, '#a16207'],
    [10, 8, 4, 0, -12, 18, '#3f3f46'],
    [7, 5, 2, 0, -12, 20.5, '#fef08a', { cls: 'vx-gem' }]
  ],
  war: () => [
    [34, 10, 34, 0, -12, 0, 'M'],
    [36, 3, 36, 0, -7, 0, 'MD'],
    [4, 14, 3, 0, 0, 16.5, 'M'],
    [4, 20, 30, -16.5, 1, 0, 'M'],
    [4, 20, 30, 16.5, 1, 0, 'M'],
    [4, 8, 26, 0, -20, 0, 'T']
  ],
  winged: () => [
    [34, 10, 34, 0, -12, 0, STEEL],
    [36, 3, 36, 0, -7, 0, 'T'],
    [2, 16, 14, -19, -17, -2, '#f8fafc', { rz: 22 }],
    [2, 16, 14, 19, -17, -2, '#f8fafc', { rz: -22 }],
    [2, 11, 10, -22, -24, -5, '#e2e8f0', { rz: 38 }],
    [2, 11, 10, 22, -24, -5, '#e2e8f0', { rz: -38 }]
  ],
  none: () => []
};

// Desloca blocos relativos para a posição da cabeça (herda a inclinação dela)
const atHead = (head, list, defaultColor) =>
  list.map(([w, h, d, x, y, z, color, extra = {}]) => [
    w,
    h,
    d,
    head.x + x,
    head.y + y,
    head.z + z,
    color || defaultColor,
    head.rz ? { rz: head.rz, ...extra } : extra
  ]);

// Rosto sem os pixels de barba; se a boca sumiu junto, desenha uma
const cleanFace = (rows) => {
  const out = rows.map((r) => r.replace(/b/g, '.'));
  const hasMouth = out.slice(5).some((r) => /[mqr]/.test(r));
  if (!hasMouth) out[6] = '...mm...';
  return out;
};

// Monta os blocos e o rosto finais de um personagem com as escolhas do `look`
export function buildHeroParts(heroClass, look, gender, faces) {
  const isDragon = heroClass.id === 'dragon';
  const baseFace = faces[(gender === 'f' ? heroClass.faceF : heroClass.faceM) || heroClass.face] || faces.wizard;

  // Estilo de cabelo efetivo (o "Padrão" do Fado é curto e cacheado)
  let hairStyle = look.hairStyle || 'default';
  if (hairStyle === 'default' && gender === 'm' && heroClass.hairStyleM) hairStyle = heroClass.hairStyleM;
  const beard = look.beard || 'default';
  const armor = heroClass.hasArmor ? look.armor || 'default' : 'default';
  const helm = heroClass.hasHelm ? look.helm || 'default' : 'default';

  const blocks = heroClass.blocks.filter((b) => {
    const extra = b[7] || {};
    if (extra.only && extra.only !== gender) return false;
    if (!isDragon && extra.hair && hairStyle !== 'default') return false;
    if (!isDragon && extra.beard && beard !== 'default') return false;
    if (extra.armor && armor !== 'default') return false;
    if (extra.helm && helm !== 'default') return false;
    return true;
  });

  let face = baseFace;
  if (isDragon) return { blocks, face };

  const headBlock = heroClass.blocks.find((b) => b[7] && b[7].face);
  const head = headBlock
    ? { x: headBlock[3], y: headBlock[4], z: headBlock[5], rz: headBlock[7].rz || 0 }
    : { x: 0, y: -12, z: 0, rz: 0 };

  if (hairStyle !== 'default' && HAIR_BUILDERS[hairStyle]) {
    let hair = HAIR_BUILDERS[hairStyle]();
    // Com chapéu/elmo/capuz, só aparecem as laterais e a parte de trás do cabelo
    const covered = heroClass.headgear || (heroClass.hasHelm && helm !== 'none');
    if (covered) {
      hair = hair.filter(([, h, , , y, z]) => y - h / 2 >= -16.5 && z <= 15);
      // O black power escapa pelos lados do chapéu/elmo
      if (hairStyle === 'afro') hair.push([8, 18, 26, -19, -6, -4], [8, 18, 26, 19, -6, -4], [40, 16, 8, 0, -4, -18]);
    }
    blocks.push(...atHead(head, hair, 'H'));
  }

  if (beard !== 'default') {
    face = cleanFace(baseFace);
    if (BEARD_BUILDERS[beard]) blocks.push(...atHead(head, BEARD_BUILDERS[beard](), 'H'));
  }

  if (armor !== 'default' && ARMOR_BUILDERS[armor]) blocks.push(...ARMOR_BUILDERS[armor](gender));
  if (helm !== 'default' && HELM_BUILDERS[helm]) blocks.push(...HELM_BUILDERS[helm]());

  return { blocks, face };
}
