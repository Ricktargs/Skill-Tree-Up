/* =========================================================
   FUNÇÕES PURAS DA ÁRVORE DE GALHOS
   Todas as funções que "alteram" devolvem uma árvore nova.
========================================================= */
import { ROOT_ID } from "./constants";

export function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value));
}

export function findBranch(node, id) {
  if (!node || !id) return null;
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findBranch(child, id);
    if (found) return found;
  }
  return null;
}

export function findParentBranch(node, childId) {
  if (!node) return null;
  for (const child of node.children || []) {
    if (child.id === childId) return node;
    const found = findParentBranch(child, childId);
    if (found) return found;
  }
  return null;
}

/** Caminho de ids da raiz até o alvo (inclusive). */
export function getAncestorIds(node, targetId, path = []) {
  if (!node) return null;
  const next = [...path, node.id];
  if (node.id === targetId) return next;
  for (const child of node.children || []) {
    const found = getAncestorIds(child, targetId, next);
    if (found) return found;
  }
  return null;
}

export function countDescendants(node) {
  if (!node || !node.children) return 0;
  return node.children.reduce((acc, child) => acc + 1 + countDescendants(child), 0);
}

export function isDescendant(node, targetId) {
  if (!node) return false;
  return (node.children || []).some((c) => c.id === targetId || isDescendant(c, targetId));
}

/** Ids do nó e de toda a subárvore. */
export function collectSubtreeIds(node) {
  if (!node) return [];
  return [node.id, ...(node.children || []).flatMap(collectSubtreeIds)];
}

export function canSwapNodes(tree, id1, id2) {
  if (!id1 || !id2 || id1 === ROOT_ID || id2 === ROOT_ID || id1 === id2) return false;
  const n1 = findBranch(tree, id1);
  const n2 = findBranch(tree, id2);
  if (!n1 || !n2) return false;
  return !isDescendant(n1, id2) && !isDescendant(n2, id1);
}

export function swapNodes(tree, id1, id2) {
  if (!canSwapNodes(tree, id1, id2)) return tree;
  const next = cloneDeep(tree);
  const p1 = findParentBranch(next, id1);
  const p2 = findParentBranch(next, id2);
  const i1 = p1.children.findIndex((c) => c.id === id1);
  const i2 = p2.children.findIndex((c) => c.id === id2);
  const tmp = p1.children[i1];
  p1.children[i1] = p2.children[i2];
  p2.children[i2] = tmp;
  return next;
}

export function addChild(tree, parentId, child) {
  const next = cloneDeep(tree);
  const parent = findBranch(next, parentId) || next;
  parent.children = parent.children || [];
  if (!parent.children.some((c) => c.id === child.id)) {
    parent.children.push({ children: [], ...child });
  }
  return next;
}

export function renameBranch(tree, id, name) {
  const next = cloneDeep(tree);
  const node = findBranch(next, id);
  if (!node) return tree;
  node.name = name;
  return next;
}

/** Liga (ou desliga, com null) um galho a uma habilidade do modo Habilidades. */
export function setBranchSkill(tree, id, skillId) {
  const next = cloneDeep(tree);
  const node = findBranch(next, id);
  if (!node) return tree;
  if (skillId) node.skillId = skillId;
  else delete node.skillId;
  return next;
}

export function removeBranch(tree, id) {
  if (id === ROOT_ID) return tree;
  const next = cloneDeep(tree);
  const parent = findParentBranch(next, id);
  if (!parent) return tree;
  parent.children = parent.children.filter((c) => c.id !== id);
  return next;
}

export function shuffleTrunkBranches(tree) {
  const next = cloneDeep(tree);
  const list = next.children || [];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return next;
}

/** Profundidade: raiz = 0, galho principal = 1, subgalhos >= 2. */
export function getDepth(tree, id) {
  const path = getAncestorIds(tree, id);
  return path ? path.length - 1 : -1;
}

export function isValidTree(tree) {
  return !!tree && typeof tree === "object" && tree.id === ROOT_ID && Array.isArray(tree.children);
}
