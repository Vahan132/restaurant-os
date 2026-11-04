import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { StockLayer } from '../../domain/entities/stock-layer';
import {
  INVENTORY_ITEM_REPOSITORY,
  InventoryItemRepository,
} from '../../domain/repositories/inventory-item.repository';
import {
  STOCK_LAYER_REPOSITORY,
  StockLayerRepository,
} from '../../domain/repositories/stock-layer.repository';
import { InventoryItemNotFound, NoRestaurantInScope } from '../application.errors';

export interface GetItemLayersInput {
  restaurantId: string | null;
  branchId: string;
  itemId: string;
  includeAll?: boolean;
}

/** Layers for an item (OPEN by default, or all) — FIFO/FEFO visibility. */
@Injectable()
export class GetItemLayersUseCase implements UseCase<GetItemLayersInput, StockLayer[]> {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    @Inject(STOCK_LAYER_REPOSITORY) private readonly layers: StockLayerRepository,
  ) {}

  async execute(input: GetItemLayersInput): Promise<StockLayer[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const item = await this.items.findById(input.restaurantId, input.branchId, input.itemId);
    if (!item) {
      throw InventoryItemNotFound();
    }
    return this.layers.listForItem(
      input.restaurantId,
      input.branchId,
      input.itemId,
      !input.includeAll,
    );
  }
}
