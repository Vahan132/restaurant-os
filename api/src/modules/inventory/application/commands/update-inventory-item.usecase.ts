import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { InventoryItem } from '../../domain/entities/inventory-item';
import { ItemKind } from '../../domain/enums';
import {
  INVENTORY_CATEGORY_REPOSITORY,
  InventoryCategoryRepository,
} from '../../domain/repositories/inventory-category.repository';
import {
  INVENTORY_ITEM_REPOSITORY,
  InventoryItemRepository,
} from '../../domain/repositories/inventory-item.repository';
import {
  InventoryCategoryNotFound,
  InventoryItemNotFound,
  InventorySkuAlreadyExists,
  NoRestaurantInScope,
} from '../application.errors';

export interface UpdateInventoryItemInput {
  restaurantId: string | null;
  branchId: string;
  itemId: string;
  name?: string;
  kind?: ItemKind;
  categoryId?: string | null;
  sku?: string | null;
  alternateUnits?: ReadonlyArray<{ name: string; factor: number }>;
  trackExpiry?: boolean;
  lowStockThresholdBase?: number | null;
}

/** Update editable catalog fields (incl. kind). Whitelist respected by the DTO. */
@Injectable()
export class UpdateInventoryItemUseCase implements UseCase<
  UpdateInventoryItemInput,
  InventoryItem
> {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    @Inject(INVENTORY_CATEGORY_REPOSITORY) private readonly categories: InventoryCategoryRepository,
  ) {}

  async execute(input: UpdateInventoryItemInput): Promise<InventoryItem> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const item = await this.items.findById(input.restaurantId, input.branchId, input.itemId);
    if (!item) {
      throw InventoryItemNotFound();
    }
    if (input.categoryId) {
      const category = await this.categories.findById(
        input.restaurantId,
        input.branchId,
        input.categoryId,
      );
      if (!category) {
        throw InventoryCategoryNotFound();
      }
    }
    if (input.sku && input.sku !== item.sku) {
      const exists = await this.items.existsBySku(
        input.restaurantId,
        input.branchId,
        input.sku,
        input.itemId,
      );
      if (exists) {
        throw InventorySkuAlreadyExists();
      }
    }
    item.updateDetails({
      name: input.name,
      kind: input.kind,
      categoryId: input.categoryId,
      sku: input.sku,
      alternateUnits: input.alternateUnits,
      trackExpiry: input.trackExpiry,
      lowStockThresholdBase: input.lowStockThresholdBase,
    });
    await this.items.update(item);
    return item;
  }
}
