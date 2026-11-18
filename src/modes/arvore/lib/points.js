import { BRANCH_POINTS, pointsForType } from "./constants";
import { countDescendants } from "./tree";

/** Pontuação total calculada a partir dos dados atuais. */
export function computePoints(data) {
  let total = 0;
  for (const r of data.records) total += pointsForType(r.type);
  const walk = (node, depth) => {
    for (const child of node.children || []) {
      total += depth === 1 ? BRANCH_POINTS.main : BRANCH_POINTS.sub;
      walk(child, depth + 1);
    }
  };
  walk(data.tree, 1);
  total += countDescendants(data.tree) * BRANCH_POINTS.growth;
  return total;
}
