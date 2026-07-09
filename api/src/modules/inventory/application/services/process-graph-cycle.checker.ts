import { Inject, Injectable } from '@nestjs/common';
import { ProcessGraphCycleError } from '../../domain/inventory.errors';
import {
  INVENTORY_ITEM_REPOSITORY,
  InventoryItemRepository,
} from '../../domain/repositories/inventory-item.repository';
import { detectProcessCycle } from '../../domain/services/process-graph-cycle';
import {
  PROCESS_GRAPH_EDGES_READER,
  ProcessGraphEdgesReader,
} from '../ports/process-graph-edges.reader';

export interface AssertAcyclicInput {
  restaurantId: string;
  branchId: string;
  /** Id of the process being written; null on create (nothing to exclude). */
  processId: string | null;
  processName: string;
  inputItemIds: string[];
  outputItemIds: string[];
}

/**
 * Write-time DAG guard (CATALOG-1b §5). Loads the branch's current process graph
 * and rejects a proposed process whose edges would close a cycle in the
 * produced-item graph, naming the conflicting item/process pair. Every
 * process-graph write use-case routes through this, so no caller (incl. seeds and
 * tests) can plant a cycle.
 */
@Injectable()
export class ProcessGraphCycleChecker {
  constructor(
    @Inject(PROCESS_GRAPH_EDGES_READER)
    private readonly edges: ProcessGraphEdgesReader,
    @Inject(INVENTORY_ITEM_REPOSITORY)
    private readonly items: InventoryItemRepository,
  ) {}

  async assertAcyclic(input: AssertAcyclicInput): Promise<void> {
    const existing = await this.edges.loadEdges(input.restaurantId, input.branchId);
    const conflict = detectProcessCycle({
      targetProcessId: input.processId,
      inputItemIds: input.inputItemIds,
      outputItemIds: input.outputItemIds,
      existing,
    });
    if (!conflict) {
      return;
    }
    // Error path only: resolve human names for the conflicting pair. Both ids are
    // referenced by the process being written, so they resolve in this branch.
    const names = await this.itemNames(input.restaurantId, input.branchId, [
      conflict.inputItemId,
      conflict.outputItemId,
    ]);
    throw new ProcessGraphCycleError(
      input.processName,
      names.get(conflict.inputItemId) ?? conflict.inputItemId,
      names.get(conflict.outputItemId) ?? conflict.outputItemId,
    );
  }

  private async itemNames(
    restaurantId: string,
    branchId: string,
    ids: string[],
  ): Promise<Map<string, string>> {
    const rows = await this.items.findManyByIds(restaurantId, branchId, [...new Set(ids)]);
    return new Map(rows.map((r) => [r.id, r.name]));
  }
}
