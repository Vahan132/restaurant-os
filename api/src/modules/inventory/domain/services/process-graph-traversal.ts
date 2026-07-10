/**
 * Read-time produced-item traversal (CATALOG-1b §5, Step 3) — pure, no IO.
 *
 * Walks the produced-item dependency graph DOWNWARD from a starting item:
 *   item → each process that OUTPUTS it → that process's INPUT items → recurse
 *        → … → leaves (items no process produces, i.e. RAW / bought-in).
 *
 * This is the sanctioned walk CATALOG-3's allergen flatten consumes. It carries a
 * `visited` set and refuses to re-enter a node, so it ALWAYS terminates — even if
 * the stored graph contains a cycle that arrived via a path that skipped the
 * write-guard (a migration or a manual DB edit). The write-guard is the
 * authoritative prevention; this visited-set is termination insurance.
 *
 * Breadth-first, so each item is recorded at its MINIMUM depth from the start —
 * which is what CATALOG-3's "display depth-1 vs. full recursion" needs.
 */
import { buildProcessAdjacency, ProcessEdgeSet } from './process-graph-cycle';

export interface ProducedItemVisit {
  itemId: string;
  /** 0 = the start item; increments per hop down to ingredients. */
  depth: number;
  /** Processes whose output is this item; empty ⇒ this item is a leaf (RAW/bought-in). */
  producingProcessIds: string[];
  /** True when no process in the graph produces this item. */
  isLeaf: boolean;
}

/**
 * Returns every item reachable downward from `startItemId` (the start included at
 * depth 0), each visited exactly once, in breadth-first order. Terminates on any
 * input, cyclic or not.
 */
export function walkProducedItemDependencies(
  startItemId: string,
  edges: ProcessEdgeSet[],
): ProducedItemVisit[] {
  const { producersByItem, inputsByProcess } = buildProcessAdjacency(edges);
  const visited = new Set<string>();
  const out: ProducedItemVisit[] = [];
  const queue: Array<{ itemId: string; depth: number }> = [{ itemId: startItemId, depth: 0 }];

  while (queue.length > 0) {
    const { itemId, depth } = queue.shift()!;
    if (visited.has(itemId)) {
      continue;
    }
    visited.add(itemId);

    const producers = producersByItem.get(itemId) ?? [];
    out.push({
      itemId,
      depth,
      producingProcessIds: producers,
      isLeaf: producers.length === 0,
    });

    for (const producerId of producers) {
      for (const ingredientId of inputsByProcess.get(producerId) ?? []) {
        if (!visited.has(ingredientId)) {
          queue.push({ itemId: ingredientId, depth: depth + 1 });
        }
      }
    }
  }

  return out;
}
