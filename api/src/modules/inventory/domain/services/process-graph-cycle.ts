/**
 * Process-graph cycle detection (CATALOG-1b, ADR-CATALOG §5) — pure, no IO.
 *
 * The produced-item dependency graph is process→process: process P *depends on*
 * process Q iff some `ProcessInput` of P references an item that is a
 * `ProcessOutput` of Q. Because a write fully replaces a single process's whole
 * input+output set, the guard reasons about one process P (its proposed inputs
 * and outputs) against the rest of the current graph.
 *
 * A cycle is closed iff, walking DOWNWARD from any of P's input items through the
 * existing graph (produced item → its producing processes → their input items →
 * …), we reach one of P's own output items. The degenerate self-reference (an
 * item that is both an input and an output of P) is caught up front.
 *
 * The walk carries a `visited` set, so it terminates even if the existing graph
 * already contains a cycle (bad data from a path that skipped the guard). This is
 * the same downward traversal CATALOG-3's allergen flatten will reuse.
 */

/** One process's edges as item ids (branch-scoped, soft-deleted excluded). */
export interface ProcessEdgeSet {
  processId: string;
  inputItemIds: string[];
  outputItemIds: string[];
}

/** The conflicting pair: adding `inputItemId` to the process loops back to `outputItemId`. */
export interface ProcessCyclePair {
  inputItemId: string;
  outputItemId: string;
}

/** Adjacency maps over the produced-item graph, shared by the guard and the walk. */
export interface ProcessAdjacency {
  /** itemId -> ids of processes that OUTPUT (produce) it. */
  producersByItem: Map<string, string[]>;
  /** processId -> its INPUT item ids. */
  inputsByProcess: Map<string, string[]>;
}

/**
 * Builds the produced-item adjacency from a branch's process edges. Pass
 * `excludeProcessId` to omit a process whose edges are being replaced (write
 * guard); omit it to view the whole current graph (read traversal).
 */
export function buildProcessAdjacency(
  edges: ProcessEdgeSet[],
  excludeProcessId?: string | null,
): ProcessAdjacency {
  const producersByItem = new Map<string, string[]>();
  const inputsByProcess = new Map<string, string[]>();
  for (const e of edges) {
    if (excludeProcessId != null && e.processId === excludeProcessId) {
      continue;
    }
    inputsByProcess.set(e.processId, e.inputItemIds);
    for (const outId of e.outputItemIds) {
      const list = producersByItem.get(outId);
      if (list) {
        list.push(e.processId);
      } else {
        producersByItem.set(outId, [e.processId]);
      }
    }
  }
  return { producersByItem, inputsByProcess };
}

export interface DetectProcessCycleParams {
  /** Id of the process being written; null on create. Excluded from `existing`. */
  targetProcessId: string | null;
  /** Proposed input item ids of the process being written. */
  inputItemIds: string[];
  /** Proposed output item ids of the process being written. */
  outputItemIds: string[];
  /** Every process's current edges (the whole branch graph). */
  existing: ProcessEdgeSet[];
}

/**
 * Returns the conflicting {inputItemId, outputItemId} pair if the proposed
 * process edges would close a cycle (self-reference included), else null.
 */
export function detectProcessCycle(params: DetectProcessCycleParams): ProcessCyclePair | null {
  const { targetProcessId, inputItemIds, outputItemIds, existing } = params;
  const outputs = new Set(outputItemIds);

  // Self-reference: an item that is both an input and an output of THIS process.
  for (const inId of inputItemIds) {
    if (outputs.has(inId)) {
      return { inputItemId: inId, outputItemId: inId };
    }
  }

  // Build the existing graph from every OTHER process (the target's own current
  // edges in the DB are being replaced, so they are excluded).
  const { producersByItem, inputsByProcess } = buildProcessAdjacency(existing, targetProcessId);

  // Downward reachability from each proposed input item. If the walk reaches one
  // of THIS process's output items, adding that input closes a loop.
  for (const startId of inputItemIds) {
    const visited = new Set<string>();
    const stack: string[] = [startId];
    while (stack.length > 0) {
      const item = stack.pop()!;
      if (visited.has(item)) {
        continue;
      }
      visited.add(item);
      if (item !== startId && outputs.has(item)) {
        return { inputItemId: startId, outputItemId: item };
      }
      for (const producer of producersByItem.get(item) ?? []) {
        for (const ingredient of inputsByProcess.get(producer) ?? []) {
          if (!visited.has(ingredient)) {
            stack.push(ingredient);
          }
        }
      }
    }
  }

  return null;
}
