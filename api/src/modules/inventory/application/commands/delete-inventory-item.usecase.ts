import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import {
  INVENTORY_ITEM_REPOSITORY,
  InventoryItemRepository,
} from '../../domain/repositories/inventory-item.repository';
import { InventoryItemNotFound, NoRestaurantInScope } from '../application.errors';

export interface DeleteInventoryItemInput {
  restaurantId: string | null;
  branchId: string;
  itemId: string;
  actorUserId: string;
}

/** Soft-delete an inventory item (catalog deletedAt). Stock/ledger remain intact. */
@Injectable()
export class DeleteInventoryItemUseCase implements UseCase<DeleteInventoryItemInput, void> {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: DeleteInventoryItemInput): Promise<void> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const item = await this.items.findById(input.restaurantId, input.branchId, input.itemId);
    if (!item) {
      throw InventoryItemNotFound();
    }
    item.softDelete(input.actorUserId);
    await this.items.update(item);
    await this.events.publishFromAggregate(item);
  }
}
