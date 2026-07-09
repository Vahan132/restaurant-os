import { Inject, Injectable } from '@nestjs/common';
import {
  ProducedItemVisit,
  walkProducedItemDependencies,
} from '../../domain/services/process-graph-traversal';
import {
  PROCESS_GRAPH_EDGES_READER,
  ProcessGraphEdgesReader,
} from '../ports/process-graph-edges.reader';

/**
 * Read-time entry point for the produced-item dependency walk (CATALOG-1b §5,
 * Step 3). Loads the branch's process graph once and walks it downward from an
 * item with the visited-set backstop, so any traversal terminates regardless of
 * how the data arrived. CATALOG-3's allergen flatten consumes this instead of
 * writing its own recursion.
 */
@Injectable()
export class ProducedItemGraphService {
  constructor(
    @Inject(PROCESS_GRAPH_EDGES_READER)
    private readonly edges: ProcessGraphEdgesReader,
  ) {}

  /** Downward walk from `itemId`, each reachable item visited once (BFS, min depth). */
  async walk(
    restaurantId: string,
    branchId: string,
    itemId: string,
  ): Promise<ProducedItemVisit[]> {
    const edges = await this.edges.loadEdges(restaurantId, branchId);
    return walkProducedItemDependencies(itemId, edges);
  }

  /**
   * Batch walk (CATALOG-4): load the branch edges ONCE and walk many start items
   * over the shared edge set — so resolving a whole KDS board / order is a single
   * edge load, not one per item. Same terminating primitive, no new recursion.
   */
  async walkMany(
    restaurantId: string,
    branchId: string,
    itemIds: readonly string[],
  ): Promise<Map<string, ProducedItemVisit[]>> {
    const edges = await this.edges.loadEdges(restaurantId, branchId);
    const out = new Map<string, ProducedItemVisit[]>();
    for (const id of new Set(itemIds)) {
      out.set(id, walkProducedItemDependencies(id, edges));
    }
    return out;
  }
}
