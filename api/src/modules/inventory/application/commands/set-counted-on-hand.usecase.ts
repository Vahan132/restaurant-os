import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import {
  LowStockAlertRaisedEvent,
  StockCountAdjustedEvent,
} from '../../domain/events/inventory-events';
import {
  INVENTORY_LEDGER_GATEWAY,
  InventoryLedgerGateway,
} from '../../domain/repositories/inventory-ledger.gateway';
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
} from '../application.errors';

export interface SetCountedOnHandUseCaseInput {
  restaurantId: string | null;
  branchId: string;
  itemId: string;
  locationId: string;
  /** Base unit (e.g. "GRAM") or a defined alternate (e.g. "kg"). */
  unit: string;
  /** The actual counted quantity in the entered unit (>= 0). */
  countedQty: number;
  reason?: string | null;
  actorUserId: string;
}

export interface SetCountedOnHandResult {
  itemId: string;
  locationId: string;
  beforeBaseQty: number;
  afterBaseQty: number;
  deltaBaseQty: number;
  uncosted: boolean;
  lowStockRaised: boolean;
}

/**
 * Correction adjustment (6A, §6): a manager declares the ACTUAL counted on-hand
 * for an (item, location). The gateway writes the signed-difference ADJUSTMENT
 * movement, adjusts the FIFO lots, and updates the projection + alerts atomically.
 * Corrects both wrong negatives and surprise surpluses. Audited via the emitted
 * count-adjusted event (carries actor + before/after).
 */
@Injectable()
export class SetCountedOnHandUseCase
  implements UseCase<SetCountedOnHandUseCaseInput, SetCountedOnHandResult>
{
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    @Inject(INVENTORY_LOCATION_REPOSITORY) private readonly locations: InventoryLocationRepository,
    @Inject(INVENTORY_LEDGER_GATEWAY) private readonly ledger: InventoryLedgerGateway,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: SetCountedOnHandUseCaseInput): Promise<SetCountedOnHandResult> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const item = await this.items.findById(input.restaurantId, input.branchId, input.itemId);
    if (!item) {
      throw InventoryItemNotFound();
    }
    const location = await this.locations.findById(
      input.restaurantId,
      input.branchId,
      input.locationId,
    );
    if (!location) {
      throw InventoryLocationNotFound();
    }

    const countedBaseQty = item.toBaseQty(input.unit, input.countedQty); // throws UnknownUnitError

    const occurredAt = new Date();
    const result = await this.ledger.setCountedOnHand({
      restaurantId: input.restaurantId,
      // §4: stock follows the item — attribute to the item's branch.
      branchId: item.branchId,
      itemId: item.id,
      locationId: location.id,
      countedBaseQty,
      lastUnitCostMicro: item.lastUnitCostMicro,
      trackExpiry: item.trackExpiry,
      reason: input.reason ?? null,
      createdByUserId: input.actorUserId,
      occurredAt,
    });

    await this.events.publish(
      new StockCountAdjustedEvent(
        item.id,
        item.restaurantId,
        item.branchId,
        location.id,
        result.deltaBaseQty,
        countedBaseQty,
        input.actorUserId,
      ),
    );
    if (result.lowStockRaised && result.thresholdBase !== null) {
      await this.events.publish(
        new LowStockAlertRaisedEvent(
          item.id,
          item.restaurantId,
          item.branchId,
          location.id,
          result.thresholdBase,
          result.afterBaseQty,
        ),
      );
    }

    return {
      itemId: item.id,
      locationId: location.id,
      beforeBaseQty: result.beforeBaseQty,
      afterBaseQty: result.afterBaseQty,
      deltaBaseQty: result.deltaBaseQty,
      uncosted: result.uncosted,
      lowStockRaised: result.lowStockRaised,
    };
  }
}
