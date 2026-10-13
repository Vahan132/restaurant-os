import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  INVENTORY_LOCATION_REPOSITORY,
  InventoryLocationRepository,
} from '../../domain/repositories/inventory-location.repository';
import { OnHandRow, STOCK_ON_HAND_READER, StockOnHandReader } from '../ports/stock-on-hand.reader';
import { InventoryItemNameResolver } from '../services/inventory-item-name.resolver';
import { InventoryLocationNotFound, NoRestaurantInScope } from '../application.errors';

export interface GetLocationOnHandInput {
  restaurantId: string | null;
  branchId: string;
  locationId: string;
}

/** On-hand rows (per item) for a single location (6A). */
@Injectable()
export class GetLocationOnHandUseCase implements UseCase<GetLocationOnHandInput, OnHandRow[]> {
  constructor(
    @Inject(INVENTORY_LOCATION_REPOSITORY) private readonly locations: InventoryLocationRepository,
    @Inject(STOCK_ON_HAND_READER) private readonly onHand: StockOnHandReader,
    private readonly names: InventoryItemNameResolver,
  ) {}

  async execute(input: GetLocationOnHandInput): Promise<OnHandRow[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const location = await this.locations.findById(
      input.restaurantId,
      input.branchId,
      input.locationId,
    );
    if (!location) {
      throw InventoryLocationNotFound();
    }
    const rows = await this.onHand.byLocation(input.restaurantId, input.branchId, input.locationId);
    // PLATCAT-ADOPT-1B: resolve the live catalog name for adopted rows (batched, no N+1).
    const catalogNames = await this.names.resolveMany(
      rows.map((r) => ({ id: r.itemId, catalogItemId: r.catalogItemId })),
    );
    for (const r of rows) {
      r.catalogName = catalogNames.get(r.itemId) ?? null;
    }
    return rows;
  }
}
