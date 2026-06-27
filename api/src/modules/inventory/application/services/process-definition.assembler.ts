import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { ProcessInput, ProcessOutput } from '../../domain/entities/process';
import { ItemKind } from '../../domain/enums';
import { OutputMustBeProcessedError } from '../../domain/inventory.errors';
import {
  INVENTORY_ITEM_REPOSITORY,
  InventoryItemRepository,
} from '../../domain/repositories/inventory-item.repository';
import { CrossBranchReference, InventoryItemNotFound } from '../application.errors';

export interface RawInput {
  itemId: string;
  baseQty: number;
}
export interface RawOutput {
  itemId: string;
  baseQty: number;
  isPrimary?: boolean;
  costShareBps?: number | null;
}

/**
 * Loads referenced items (branch-scoped), enforces that every referenced item
 * lives in the ACTIVE branch (§5 cross-branch guard), that every OUTPUT item is
 * of kind PROCESSED, and builds the domain input/output value objects (stamped
 * with the active branch) with fresh ids. The allocation-shape rule (§3) is
 * enforced by the Process aggregate.
 */
@Injectable()
export class ProcessDefinitionAssembler {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async build(
    restaurantId: string,
    branchId: string,
    inputs: RawInput[],
    outputs: RawOutput[],
  ): Promise<{ inputs: ProcessInput[]; outputs: ProcessOutput[] }> {
    const itemIds = [...new Set([...inputs, ...outputs].map((x) => x.itemId))];
    const rows = await this.items.findManyByIds(restaurantId, branchId, itemIds);
    const byId = new Map(rows.map((r) => [r.id, r]));

    // §5: every referenced item must exist in the ACTIVE branch. If it is missing
    // from the in-branch set, distinguish a cross-branch reference (exists in the
    // tenant under a different branch) from a genuinely unknown item.
    for (const id of itemIds) {
      if (!byId.has(id)) {
        const elsewhere = await this.items.findInRestaurant(restaurantId, id);
        if (elsewhere && elsewhere.branchId !== branchId) {
          throw CrossBranchReference('Process references an item in a different branch.');
        }
        throw InventoryItemNotFound();
      }
    }
    // Every OUTPUT item must be PROCESSED.
    for (const o of outputs) {
      if (byId.get(o.itemId)!.kind !== ItemKind.PROCESSED) {
        throw new OutputMustBeProcessedError();
      }
    }

    return {
      inputs: inputs.map(
        (i) =>
          new ProcessInput({
            id: this.ids.generate(),
            branchId,
            itemId: i.itemId,
            baseQty: i.baseQty,
          }),
      ),
      outputs: outputs.map(
        (o) =>
          new ProcessOutput({
            id: this.ids.generate(),
            branchId,
            itemId: o.itemId,
            baseQty: o.baseQty,
            isPrimary: o.isPrimary ?? false,
            costShareBps: o.costShareBps ?? null,
          }),
      ),
    };
  }
}
