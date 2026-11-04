import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  INVENTORY_ITEM_REPOSITORY,
  InventoryItemRepository,
} from '../../domain/repositories/inventory-item.repository';
import {
  PROCESS_GRAPH_READER,
  ProcessGraphReader,
  RelatedItems,
} from '../ports/process-graph.reader';
import { InventoryItemNotFound, NoRestaurantInScope } from '../application.errors';

export interface GetRelatedItemsInput {
  restaurantId: string | null;
  branchId: string;
  itemId: string;
}

/**
 * Raw↔processed counterparts of an item, derived from the process graph (for the
 * INV-3 recipe warning). 404 if the item is unknown to the tenant.
 */
@Injectable()
export class GetRelatedItemsUseCase implements UseCase<GetRelatedItemsInput, RelatedItems> {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    @Inject(PROCESS_GRAPH_READER) private readonly graph: ProcessGraphReader,
  ) {}

  async execute(input: GetRelatedItemsInput): Promise<RelatedItems> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const item = await this.items.findById(input.restaurantId, input.branchId, input.itemId);
    if (!item) {
      throw InventoryItemNotFound();
    }
    return this.graph.related(input.restaurantId, input.branchId, input.itemId);
  }
}
