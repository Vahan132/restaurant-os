import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { InventoryItem } from '../../domain/entities/inventory-item';
import { InventoryLocationStatus } from '../../domain/enums';
import {
  INVENTORY_ITEM_REPOSITORY,
  InventoryItemRepository,
} from '../../domain/repositories/inventory-item.repository';
import {
  INVENTORY_LOCATION_REPOSITORY,
  InventoryLocationRepository,
} from '../../domain/repositories/inventory-location.repository';
import {
  InventoryItemNotFound,
  InventoryLocationNotFound,
  NoRestaurantInScope,
  TransferLocationInactive,
} from '../application.errors';

export interface SetItemConsumptionLocationInput {
  restaurantId: string | null;
  branchId: string;
  itemId: string;
  /** Target location id, or null to reset to the branch default (Main Storage). */
  locationId: string | null;
}

/**
 * Reassign an item's consumption location (6C, §1). Validates the target location
 * is active and in this branch; null resets to the branch default.
 */
@Injectable()
export class SetItemConsumptionLocationUseCase
  implements UseCase<SetItemConsumptionLocationInput, InventoryItem>
{
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    @Inject(INVENTORY_LOCATION_REPOSITORY) private readonly locations: InventoryLocationRepository,
  ) {}

  async execute(input: SetItemConsumptionLocationInput): Promise<InventoryItem> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const item = await this.items.findById(input.restaurantId, input.branchId, input.itemId);
    if (!item) {
      throw InventoryItemNotFound();
    }
    if (input.locationId) {
      const location = await this.locations.findById(
        input.restaurantId,
        input.branchId,
        input.locationId,
      );
      if (!location) {
        throw InventoryLocationNotFound();
      }
      if (location.status !== InventoryLocationStatus.ACTIVE) {
        throw TransferLocationInactive();
      }
      item.setConsumptionLocation(location.id);
    } else {
      item.setConsumptionLocation(null);
    }
    await this.items.update(item);
    return item;
  }
}
