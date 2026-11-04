import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { InventoryItem } from '../../domain/entities/inventory-item';
import {
  INVENTORY_ITEM_REPOSITORY,
  InventoryItemRepository,
} from '../../domain/repositories/inventory-item.repository';
import { InventoryItemNotFound, NoRestaurantInScope } from '../application.errors';

export interface GetInventoryItemInput {
  restaurantId: string | null;
  branchId: string;
  itemId: string;
}

/** Fetch a single inventory item (tenant-scoped; 404 hides cross-tenant rows). */
@Injectable()
export class GetInventoryItemUseCase implements UseCase<GetInventoryItemInput, InventoryItem> {
  constructor(@Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository) {}

  async execute(input: GetInventoryItemInput): Promise<InventoryItem> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const item = await this.items.findById(input.restaurantId, input.branchId, input.itemId);
    if (!item) {
      throw InventoryItemNotFound();
    }
    return item;
  }
}
