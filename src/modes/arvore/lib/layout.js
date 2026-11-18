/* =========================================================
   LAYOUT DA ÁRVORE (posições, colisões e curvas)
========================================================= */
import { ROOT_ID } from "./constants";
import { countDescendants, getAncestorIds } from "./tree";
import { extractTags } from "./html";
import { getEffectiveBranchId } from "./folders";
import { planForest, treeGeometry, attachPoints } from "./growth";

export const ROOT_POS = { x: 600, y: 620 };

function getSubtreeWidth(node) {
  if (!node?.children?.length) return 1;
  return node.children.reduce((acc, child) => acc + getSubtreeWidth(child), 0);
}

function layoutChildren(parent, parentPos, isLeft, depth, nodes, links) {
  const children = parent?.children || [];
  if (!children.length) return;

  const total = getSubtreeWidth(parent);
  const baseAngle = isLeft ? Math.PI : 0;
  const spread = Math.min(Math.PI * 0.35, 0.15 + children.length * 0.12);
  let current = baseAngle - spread / 2;
  const step = Math.max(70, 130 - depth * 6);

  children.forEach((child) => {
    const portion = (getSubtreeWidth(child) / total) * spread;
    const angle = current + portion / 2;
    const pos = {
      x: parentPos.x + Math.cos(angle) * step,
      y: parentPos.y + Math.sin(angle) * step,
    };
    links.push({ depth, targetId: child.id, parentId: parent.id, parent: parentPos, child: pos });
    nodes.push({ branch: child, ...pos, depth });
    layoutChildren(child, pos, isLeft, depth + 1, nodes, links);
    current += portion;
  });
}

/**
 * Layout base (sem deslocamentos manuais).
 * ctx = { info, growth }: notas/texto por galho e as permissões de crescimento
 * (dividir o tronco, árvores novas). Ver lib/growth.js.
 */
export function createLayout(tree, ctx = {}) {
  const nodes = [{ branch: tree, ...ROOT_POS, depth: 0 }];
  const links = [];
  const forest = planForest(tree, ctx.info || new Map(), ctx.growth || {});
  const trees = forest.trees.map((t) => ({ ...t, geo: treeGeometry(t) }));

  trees.forEach((t) => {
    const attach = attachPoints(t, t.geo);
    t.branches.forEach((node, index) => {
      const { point, isLeft } = attach[index];
      const [ax, ay] = point;
      // Os de cima apontam mais para o alto; os de baixo, mais para fora
      const height = Math.max(0, Math.min(1, (t.baseY - ay) / t.H));
      const tilt = 0.08 + height * 0.42;
      const angle = isLeft ? Math.PI + tilt : -tilt;
      const dist = (150 + (index % 3) * 14) * (t.index === 0 ? 1 : Math.max(0.75, t.scale + 0.15));
      const pos = { x: ax + Math.cos(angle) * dist, y: ay + Math.sin(angle) * dist };
      links.push({ depth: 0, targetId: node.id, parentId: ROOT_ID, parent: { x: ax, y: ay }, child: pos, treeIndex: t.index });
      nodes.push({ branch: node, ...pos, depth: 1, treeIndex: t.index });
      layoutChildren(node, pos, isLeft, 2, nodes, links);
    });
  });

  const totalNodes = countDescendants(tree);
  const trunkBonus = Math.min(30, Math.pow(totalNodes, 0.65) * 2.2);
  const dims = new Map();
  for (const node of nodes) {
    const id = node.branch.id;
    if (node.depth === 0) {
      const r = 38 + trunkBonus * 0.3;
      dims.set(id, { rx: r, ry: r });
    } else if (node.depth === 1) {
      const desc = countDescendants(node.branch);
      dims.set(id, { rx: Math.min(88, 68 + Math.min(12, desc * 1.5)), ry: Math.min(32, 24 + Math.min(5, desc * 0.6)) });
    } else {
      const scale = Math.pow(0.82, node.depth - 2);
      dims.set(id, { rx: Math.max(20, 50 * scale), ry: Math.max(10, 18 * scale) });
    }
  }

  // A moldura inclui as pontas dos troncos e as árvores novas
  const extents = trees.flatMap((t) => [
    { x: t.x - t.baseHalf * 3, y: t.baseY },
    { x: t.x + t.baseHalf * 3, y: t.baseY },
    ...t.geo.limbs.map((l) => ({ x: l.curve[3][0], y: l.curve[3][1] })),
  ]);
  return { nodes, links, dims, trees, needs: forest.needs, transform: fitTransform([...nodes, ...extents.map((p) => ({ ...p, branch: {} }))]) };
}

function fitTransform(nodes) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y);
  }
  minY = Math.min(minY, 120);
  maxY = Math.max(maxY, 630);
  const scale = Math.max(0.3, Math.min(1, 1100 / (maxX - minX + 180), 650 / (maxY - minY + 160)));
  const tx = 600 - ((minX + maxX) / 2) * scale;
  const ty = 350 - ((minY + maxY) / 2) * scale;
  return `translate(${tx} ${ty}) scale(${scale})`;
}

/** Empurra nós sobrepostos. Muta `nodes`. */
export function resolveCollisions(nodes, dims, fixedId = null) {
  const padX = 24;
  const padY = 18;
  const damping = 0.25;
  for (let iter = 0; iter < 20; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const da = dims.get(a.branch.id) || { rx: 40, ry: 20 };
        const db = dims.get(b.branch.id) || { rx: 40, ry: 20 };
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const overlapX = da.rx + db.rx + padX - Math.abs(dx);
        const overlapY = da.ry + db.ry + padY - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;

        let mx = 0;
        let my = 0;
        if (Math.abs(dy) >= 2 || overlapY < overlapX * 1.5) {
          const sy = dy < 0 ? -1 : dy > 0 ? 1 : b.x > a.x ? -1 : 1;
          my = overlapY * sy * damping;
        } else {
          mx = overlapX * (dx >= 0 ? 1 : -1) * damping;
        }

        const fixedA = a.branch.id === ROOT_ID || a.branch.id === fixedId;
        const fixedB = b.branch.id === ROOT_ID || b.branch.id === fixedId;
        if (!fixedA && !fixedB) {
          a.x -= mx / 2; a.y -= my / 2;
          b.x += mx / 2; b.y += my / 2;
        } else if (fixedA && !fixedB) {
          b.x += mx; b.y += my;
        } else if (!fixedA && fixedB) {
          a.x -= mx; a.y -= my;
        }
      }
    }
  }
}

/** Aplica deslocamentos (do nó e de todos os ancestrais) + arraste ativo + colisões. */
export function applyOffsets(base, tree, offsets, drag) {
  const nodes = base.nodes.map((node) => {
    const ancestors = getAncestorIds(tree, node.branch.id) || [node.branch.id];
    let x = node.x;
    let y = node.y;
    for (const id of ancestors) {
      if (id === ROOT_ID) continue;
      const o = offsets[id];
      if (o) { x += o.x; y += o.y; }
      if (drag && drag.id === id) { x += drag.dx; y += drag.dy; }
    }
    return { ...node, x, y };
  });
  resolveCollisions(nodes, base.dims, drag?.id);

  const pos = new Map(nodes.map((n) => [n.branch.id, { x: n.x, y: n.y }]));
  const links = base.links.map((l) => ({
    ...l,
    parent: l.parentId === ROOT_ID ? l.parent : pos.get(l.parentId) || l.parent,
    child: pos.get(l.targetId) || l.child,
  }));
  return { nodes, links, pos };
}

export function createBranchPath(parent, child) {
  const dx = child.x - parent.x;
  const dy = child.y - parent.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return `M ${parent.x} ${parent.y}`;
  const nx = -dy / len;
  const ny = dx / len;
  const seed = Math.sin(parent.x * 12.9898 + parent.y * 78.233 + child.x * 43.123) * 43758.5453;
  const r1 = seed - Math.floor(seed);
  const r2 = seed * 1.5 - Math.floor(seed * 1.5);
  const off1 = (r1 - 0.5) * Math.min(16, len * 0.2);
  const off2 = (r2 - 0.5) * Math.min(12, len * 0.15);
  const avgY = (parent.y + child.y) / 2;
  const ground = Math.max(0, Math.min(1, (avgY - 160) / 460));
  const sag = Math.min(38, len * 0.3) * (0.35 + ground * 0.65);
  const p1 = { x: parent.x + dx * 0.35 + nx * off1, y: parent.y + dy * 0.35 + ny * off1 + sag * 0.5 };
  const p2 = { x: parent.x + dx * 0.7 + nx * off2, y: parent.y + dy * 0.7 + ny * off2 + sag };
  return `M ${parent.x} ${parent.y} C ${parent.x + dx * 0.2} ${parent.y + dy * 0.2 + sag * 0.2}, ${p1.x} ${p1.y}, ${p1.x} ${p1.y} C ${p2.x} ${p2.y}, ${child.x - dx * 0.2} ${child.y - dy * 0.2}, ${child.x} ${child.y}`;
}

export function createCipoPath(p1, p2) {
  const sag = Math.max(90, Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.6);
  return `M ${p1.x} ${p1.y} C ${p1.x} ${p1.y + sag}, ${p2.x} ${p2.y + sag}, ${p2.x} ${p2.y}`;
}

export function createTrunkPath(totalNodes) {
  const bonus = Math.min(32, Math.pow(totalNodes, 0.65) * 2.2);
  const baseHalf = 28 + bonus * 0.85;
  const topHalf = 9 + Math.min(4, bonus * 0.12);
  const blX = 600 - baseHalf, brX = 600 + baseHalf, tlX = 600 - topHalf, trX = 600 + topHalf;
  return {
    bonus,
    d: `M ${blX} 620 C ${blX + 4} 510, 582 400, ${tlX - 4} 290 C ${tlX - 2} 230, ${tlX - 1} 190, ${tlX} 160 L ${trX} 160 C ${trX + 1} 190, ${trX + 2} 230, ${trX + 4} 290 C 618 400, ${brX - 4} 510, ${brX} 620 Z`,
  };
}

/** Cipós: ligações entre galhos que compartilham uma [tag]. */
export function extractCipos(records, tree, foldersMap) {
  const tagToBranches = new Map();
  for (const rec of records) {
    const branchId = getEffectiveBranchId(tree, foldersMap, rec);
    for (const tag of extractTags(`${rec.title || ""} ${rec.text || ""}`)) {
      if (!tagToBranches.has(tag)) tagToBranches.set(tag, new Set());
      tagToBranches.get(tag).add(branchId);
    }
  }
  const out = [];
  const seen = new Set();
  tagToBranches.forEach((set, tag) => {
    const list = [...set];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const key = [list[i], list[j]].sort().join("::");
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ fromId: list[i], toId: list[j], tag });
      }
    }
  });
  return out;
}
