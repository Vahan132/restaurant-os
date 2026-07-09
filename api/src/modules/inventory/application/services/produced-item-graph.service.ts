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
}
