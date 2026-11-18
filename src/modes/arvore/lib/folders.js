/* =========================================================
   PASTAS, SUBGALHOS E LOCALIZAÇÃO DAS NOTAS

   Modelo de dados (compatível com a versão anterior):
   - tree:        árvore de galhos { id, name, children }
   - foldersMap:  { [idDoPai]: [{ id, name, color, isSubbranch }] }
                  idDoPai pode ser um galho ou outra pasta.
   - records:     notas { id, branchId, folderId, ... }
                  branchId = galho real (nó da árvore) onde a nota vive
                  folderId = pasta comum (não-galho) dentro dele, ou null
========================================================= */
import { ROOT_ID } from "./constants";
import { colorForId } from "./ids";
import { findBranch, findParentBranch, collectSubtreeIds, getAncestorIds } from "./tree";

/** Chave do pai (galho ou pasta) onde a pasta `id` está listada. */
export function findFolderParentKey(foldersMap, id) {
  for (const [key, list] of Object.entries(foldersMap || {})) {
    if (Array.isArray(list) && list.some((f) => f.id === id)) return key;
  }
  return null;
}

export function findFolderEntry(foldersMap, id) {
  for (const list of Object.values(foldersMap || {})) {
    if (!Array.isArray(list)) continue;
    const found = list.find((f) => f.id === id);
    if (found) return found;
  }
  return null;
}

export function itemExists(tree, foldersMap, id) {
  return !!id && (!!findBranch(tree, id) || !!findFolderEntry(foldersMap, id));
}

export function getItemName(tree, foldersMap, id) {
  const b = findBranch(tree, id);
  if (b) return b.name;
  return findFolderEntry(foldersMap, id)?.name || "Pasta";
}

/** Sobe pela cadeia de pastas até encontrar um galho real. */
export function resolveTreeAncestor(tree, foldersMap, id, fallback = ROOT_ID) {
  const visited = new Set();
  let current = id;
  while (current && !visited.has(current)) {
    visited.add(current);
    if (findBranch(tree, current)) return current;
    current = findFolderParentKey(foldersMap, current);
  }
  return fallback;
}

/** Galho real onde a nota aparece na árvore. */
export function getEffectiveBranchId(tree, foldersMap, record) {
  if (!record) return ROOT_ID;
  const fallback = findBranch(tree, record.branchId) ? record.branchId : ROOT_ID;
  return resolveTreeAncestor(tree, foldersMap, record.folderId || record.branchId, fallback);
}

/** { branchId, folderId } para guardar uma nota dentro do nível `levelId`. */
export function locationForLevel(tree, foldersMap, levelId) {
  if (findBranch(tree, levelId)) return { branchId: levelId, folderId: null };
  return { branchId: resolveTreeAncestor(tree, foldersMap, levelId), folderId: levelId };
}

export function isRecordAtLevel(record, levelId) {
  return record.folderId ? record.folderId === levelId : record.branchId === levelId;
}

/**
 * Itens (pastas/subgalhos) mostrados dentro de um nível.
 * Subgalhos que já estão guardados dentro de outra pasta não são duplicados.
 */
export function getLevelItems(tree, foldersMap, levelId) {
  const stored = (foldersMap[levelId] || []).map((f) => {
    const node = findBranch(tree, f.id);
    return {
      ...f,
      name: node ? node.name : f.name,
      color: f.color || colorForId(f.id),
      isSubbranch: !!node,
    };
  });

  const node = findBranch(tree, levelId);
  if (node) {
    const seen = new Set(stored.map((f) => f.id));
    for (const child of node.children || []) {
      if (seen.has(child.id)) continue;
      const placedKey = findFolderParentKey(foldersMap, child.id);
      if (placedKey && placedKey !== levelId && itemExists(tree, foldersMap, placedKey)) continue;
      stored.push({ id: child.id, name: child.name, color: colorForId(child.id), isSubbranch: true });
    }
  }
  return stored;
}

/** Ids de uma pasta e de todas as pastas comuns dentro dela (não desce em subgalhos). */
export function collectFolderSubtree(tree, foldersMap, rootId) {
  const result = [rootId];
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift();
    for (const f of foldersMap[id] || []) {
      if (result.includes(f.id) || findBranch(tree, f.id)) continue;
      result.push(f.id);
      queue.push(f.id);
    }
  }
  return result;
}

/** Lista plana (para busca) de todos os subgalhos e pastas abaixo de um galho. */
export function collectNavigableItems(tree, foldersMap, branchId) {
  const out = [];
  const visited = new Set([branchId]);
  const walk = (levelId, path, names) => {
    for (const item of getLevelItems(tree, foldersMap, levelId)) {
      if (visited.has(item.id)) continue;
      visited.add(item.id);
      const itemPath = [...path, item.id];
      out.push({ ...item, path: itemPath, label: names.join(" › ") });
      walk(item.id, itemPath, [...names, item.name]);
    }
  };
  walk(branchId, [], [getItemName(tree, foldersMap, branchId)]);
  return out;
}

function removeIdsFromFolders(foldersMap, ids) {
  const set = new Set(ids);
  const next = {};
  for (const [key, list] of Object.entries(foldersMap)) {
    if (set.has(key)) continue;
    next[key] = (list || []).filter((f) => !set.has(f.id));
  }
  return next;
}

function upsertFolderEntry(foldersMap, parentKey, entry) {
  const list = foldersMap[parentKey] || [];
  const exists = list.some((f) => f.id === entry.id);
  return {
    ...foldersMap,
    [parentKey]: exists ? list.map((f) => (f.id === entry.id ? { ...f, ...entry } : f)) : [...list, entry],
  };
}

/* =========================================================
   REPARO / NORMALIZAÇÃO
   Corrige notas "órfãs" (que ficavam invisíveis na versão anterior).
========================================================= */
export function repairData(data) {
  const { tree, foldersMap } = data;
  let changed = false;
  const records = data.records.map((r) => {
    let { branchId, folderId } = r;
    if (folderId && findBranch(tree, folderId)) {
      branchId = folderId;
      folderId = null;
    }
    if (folderId && !findFolderEntry(foldersMap, folderId)) folderId = null;
    if (folderId) branchId = resolveTreeAncestor(tree, foldersMap, folderId, findBranch(tree, branchId) ? branchId : ROOT_ID);
    if (!findBranch(tree, branchId)) branchId = ROOT_ID;
    if (branchId === r.branchId && (folderId || null) === (r.folderId || null)) return r;
    changed = true;
    return { ...r, branchId, folderId: folderId || null };
  });
  return changed ? { ...data, records } : data;
}

/* =========================================================
   OPERAÇÕES (puras: recebem data e devolvem data nova)
========================================================= */

export function createFolder(data, levelId, folder) {
  return { ...data, foldersMap: upsertFolderEntry(data.foldersMap, levelId, { ...folder, isSubbranch: false }) };
}

export function createSubbranch(data, levelId, branch) {
  const { tree, foldersMap } = data;
  const treeParent = resolveTreeAncestor(tree, foldersMap, levelId);
  const parent = findBranch(tree, treeParent);
  const nextTree = JSON.parse(JSON.stringify(tree));
  const nextParent = findBranch(nextTree, parent.id);
  nextParent.children = [...(nextParent.children || []), { id: branch.id, name: branch.name, children: [] }];
  return {
    ...data,
    tree: nextTree,
    foldersMap: upsertFolderEntry(foldersMap, levelId, { ...branch, isSubbranch: true }),
  };
}

export function renameItem(data, id, name) {
  const { tree, foldersMap } = data;
  let nextTree = tree;
  if (findBranch(tree, id)) {
    nextTree = JSON.parse(JSON.stringify(tree));
    findBranch(nextTree, id).name = name;
  }
  const nextFolders = {};
  for (const [key, list] of Object.entries(foldersMap)) {
    nextFolders[key] = (list || []).map((f) => (f.id === id ? { ...f, name } : f));
  }
  return { ...data, tree: nextTree, foldersMap: nextFolders };
}

export function setItemColor(data, id, color, fallbackParentKey) {
  const parentKey = findFolderParentKey(data.foldersMap, id) || fallbackParentKey;
  const name = getItemName(data.tree, data.foldersMap, id);
  return {
    ...data,
    foldersMap: upsertFolderEntry(data.foldersMap, parentKey, { id, name, color, isSubbranch: !!findBranch(data.tree, id) }),
  };
}

/**
 * Exclui uma pasta (ou subgalho mostrado como pasta).
 * As notas de dentro NÃO são apagadas: vão para `targetLevelId`.
 */
export function deleteFolder(data, folderId, targetLevelId) {
  const { tree, foldersMap } = data;
  const node = findBranch(tree, folderId);
  const treeIds = node ? collectSubtreeIds(node) : [];
  const folderIds = new Set();
  for (const id of [folderId, ...treeIds]) {
    collectFolderSubtree(tree, foldersMap, id).forEach((f) => folderIds.add(f));
  }
  const removed = new Set([...treeIds, ...folderIds]);

  let nextTree = tree;
  if (node) {
    nextTree = JSON.parse(JSON.stringify(tree));
    const parent = findParentBranch(nextTree, folderId);
    if (parent) parent.children = parent.children.filter((c) => c.id !== folderId);
  }
  const nextFolders = removeIdsFromFolders(foldersMap, [...removed]);
  const target = locationForLevel(nextTree, nextFolders, targetLevelId);

  const records = data.records.map((r) =>
    removed.has(r.branchId) || removed.has(r.folderId) ? { ...r, ...target } : r
  );
  const offsets = { ...data.offsets };
  treeIds.forEach((id) => delete offsets[id]);

  return repairData({ ...data, tree: nextTree, foldersMap: nextFolders, records, offsets });
}

/** Itens que seriam apagados junto com o galho (para a confirmação). */
export function branchDeletionScope(data, branchId) {
  const node = findBranch(data.tree, branchId);
  if (!node) return { treeIds: [], folderIds: [], recordIds: [] };
  const treeIds = collectSubtreeIds(node);
  const folderIds = new Set();
  for (const id of treeIds) collectFolderSubtree(data.tree, data.foldersMap, id).forEach((f) => folderIds.add(f));
  treeIds.forEach((id) => folderIds.delete(id));
  const all = new Set([...treeIds, ...folderIds]);
  const recordIds = data.records.filter((r) => all.has(r.branchId) || all.has(r.folderId)).map((r) => r.id);
  return { treeIds, folderIds: [...folderIds], recordIds };
}

/** Exclui um galho, seus subgalhos, pastas e notas. */
export function deleteBranch(data, branchId) {
  if (branchId === ROOT_ID) return data;
  const { treeIds, folderIds, recordIds } = branchDeletionScope(data, branchId);
  if (!treeIds.length) return data;
  const nextTree = JSON.parse(JSON.stringify(data.tree));
  const parent = findParentBranch(nextTree, branchId);
  if (parent) parent.children = parent.children.filter((c) => c.id !== branchId);
  const drop = new Set(recordIds);
  const offsets = { ...data.offsets };
  treeIds.forEach((id) => delete offsets[id]);
  return repairData({
    ...data,
    tree: nextTree,
    foldersMap: removeIdsFromFolders(data.foldersMap, [...treeIds, ...folderIds]),
    records: data.records.filter((r) => !drop.has(r.id)),
    offsets,
  });
}

/** Transforma uma pasta comum em subgalho (nó da árvore). */
export function folderToSubbranch(data, folderId) {
  const { tree, foldersMap } = data;
  if (findBranch(tree, folderId)) return data;
  const entry = findFolderEntry(foldersMap, folderId);
  const parentKey = findFolderParentKey(foldersMap, folderId);
  if (!entry || !parentKey) return data;

  const treeParent = resolveTreeAncestor(tree, foldersMap, parentKey);
  const nextTree = JSON.parse(JSON.stringify(tree));
  const parentNode = findBranch(nextTree, treeParent);
  parentNode.children = [...(parentNode.children || []), { id: folderId, name: entry.name, children: [] }];

  const inner = new Set(collectFolderSubtree(tree, foldersMap, folderId));
  const records = data.records.map((r) => {
    if (r.folderId === folderId) return { ...r, branchId: folderId, folderId: null };
    if (inner.has(r.folderId)) return { ...r, branchId: folderId };
    return r;
  });
  return repairData({
    ...data,
    tree: nextTree,
    foldersMap: upsertFolderEntry(foldersMap, parentKey, { ...entry, isSubbranch: true }),
    records,
  });
}

/**
 * Transforma um subgalho de volta em pasta comum.
 * Retorna { data, error } — não permite se o subgalho tiver subgalhos dentro.
 */
export function subbranchToFolder(data, branchId) {
  const { tree, foldersMap } = data;
  const node = findBranch(tree, branchId);
  const parent = findParentBranch(tree, branchId);
  if (!node || !parent) return { data, error: null };
  if ((node.children || []).length > 0) {
    return { data, error: "Este subgalho tem subgalhos dentro dele. Transforme-os em pasta (ou mova-os) primeiro." };
  }

  const parentKey = findFolderParentKey(foldersMap, branchId) || parent.id;
  const nextTree = JSON.parse(JSON.stringify(tree));
  const nextParent = findBranch(nextTree, parent.id);
  nextParent.children = nextParent.children.filter((c) => c.id !== branchId);

  const nextFolders = upsertFolderEntry(foldersMap, parentKey, {
    id: branchId,
    name: node.name,
    color: findFolderEntry(foldersMap, branchId)?.color || colorForId(branchId),
    isSubbranch: false,
  });
  const ownerBranch = resolveTreeAncestor(nextTree, nextFolders, parentKey, parent.id);

  const records = data.records.map((r) => {
    if (r.branchId !== branchId) return r;
    return { ...r, branchId: ownerBranch, folderId: r.folderId || branchId };
  });
  const offsets = { ...data.offsets };
  delete offsets[branchId];

  return {
    data: repairData({ ...data, tree: nextTree, foldersMap: nextFolders, records, offsets }),
    error: null,
    newOwner: ownerBranch,
    parentKey,
  };
}

/** Move notas para um nível (galho ou pasta). */
export function moveRecordsToLevel(data, recordIds, levelId) {
  const ids = new Set(recordIds);
  const loc = locationForLevel(data.tree, data.foldersMap, levelId);
  let changed = false;
  const records = data.records.map((r) => {
    if (!ids.has(r.id)) return r;
    if (r.branchId === loc.branchId && (r.folderId || null) === loc.folderId) return r;
    changed = true;
    return { ...r, ...loc };
  });
  return changed ? { ...data, records } : data;
}

/** Reordena uma nota relativa a outra (e a traz para o nível, se necessário). */
export function reorderRecord(data, sourceId, targetId, placeAfter, levelId) {
  let next = moveRecordsToLevel(data, [sourceId], levelId);
  if (sourceId === targetId) return next;
  const list = [...next.records];
  const from = list.findIndex((r) => r.id === sourceId);
  if (from === -1) return next;
  const [item] = list.splice(from, 1);
  const to = list.findIndex((r) => r.id === targetId);
  if (to === -1) return next;
  list.splice(placeAfter ? to + 1 : to, 0, item);
  return { ...next, records: list };
}

export function getBranchPath(tree, id) {
  return getAncestorIds(tree, id) || [ROOT_ID];
}
