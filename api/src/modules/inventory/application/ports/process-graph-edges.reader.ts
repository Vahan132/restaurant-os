import { ProcessEdgeSet } from '../../domain/services/process-graph-cycle';

export const PROCESS_GRAPH_EDGES_READER = Symbol('ProcessGraphEdgesReader');

/**
 * Loads the whole branch's process-graph edges as item ids (CATALOG-1b §5), so
 * the write-time cycle guard can reason about a proposed process against the
 * current graph. Branch-scoped within a tenant (restaurantId + branchId);
 * excludes soft-deleted processes.
 */
export interface ProcessGraphEdgesReader {
  loadEdges(restaurantId: string, branchId: string): Promise<ProcessEdgeSet[]>;
}
