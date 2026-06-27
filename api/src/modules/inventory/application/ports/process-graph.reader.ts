import { InventoryItem } from '../../domain/entities/inventory-item';

export const PROCESS_GRAPH_READER = Symbol('ProcessGraphReader');

export interface RelatedItems {
  /** Items that are INPUTS to any process whose outputs include the given item. */
  rawSources: InventoryItem[];
  /** PROCESSED items OUTPUT by any process that takes the given item as an input. */
  processedOutputs: InventoryItem[];
}

/**
 * Resolves raw↔processed counterparts from the process graph (for the INV-3
 * recipe warning). Branch-scoped within a tenant (restaurantId + branchId);
 * excludes soft-deleted items.
 */
export interface ProcessGraphReader {
  related(restaurantId: string, branchId: string, itemId: string): Promise<RelatedItems>;
}
