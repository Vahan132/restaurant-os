import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  INVENTORY_LOCATION_REPOSITORY,
  InventoryLocationRepository,
} from '../../domain/repositories/inventory-location.repository';
import { OnHandRow, STOCK_ON_HAND_READER, StockOnHandReader } from '../ports/stock-on-hand.reader';
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
    return this.onHand.byLocation(input.restaurantId, input.branchId, input.locationId);
  }
}
