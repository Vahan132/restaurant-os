import { Inject, Injectable } from '@nestjs/common';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { StockConsumedEvent } from '../../domain/events/inventory-events';
import {
  ConsumeStockCommand,
  ReverseStockCommand,
  StockConsumptionPort,
  StockConsumptionResult,
  StockReversalResult,
} from '../../domain/ports/stock-consumption.port';
import {
  INVENTORY_LEDGER_GATEWAY,
  InventoryLedgerGateway,
} from '../../domain/repositories/inventory-ledger.gateway';
import {
  INVENTORY_ITEM_REPOSITORY,
  InventoryItemRepository,
} from '../../domain/repositories/inventory-item.repository';
import { InventoryLocationProvisioner } from './inventory-location-provisioner.service';
import { InventoryItemNotFound } from '../application.errors';

/**
 * InventoryConsumptionService — the reusable FIFO/FEFO consumption core, exposed
 * to later contexts via the StockConsumptionPort token.
 *
 * It validates the item, captures the metadata that drives ordering/costing
 * (trackExpiry => FEFO; lastUnitCostMicro => negative-stock fallback), delegates
 * the atomic draw-down to the ledger gateway, then publishes a domain event.
 * NEVER throws on insufficient stock — returns `wentNegative` instead.
 */
@Injectable()
export class InventoryConsumptionService implements StockConsumptionPort {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    @Inject(INVENTORY_LEDGER_GATEWAY) private readonly ledger: InventoryLedgerGateway,
    private readonly locations: InventoryLocationProvisioner,
    private readonly events: DomainEventPublisher,
  ) {}

  async consume(command: ConsumeStockCommand): Promise<StockConsumptionResult> {
    // §4/§6: load the item branch-agnostically and let stock follow the ITEM's
    // branch. Callers (orders, recipes) need not supply an active branch.
    const item = await this.items.findInRestaurant(command.restaurantId, command.itemId);
    if (!item) {
      throw InventoryItemNotFound();
    }

    // 6C: deplete from the item's resolved consumption location (per-item default
    // for the branch) unless the caller pinned a specific location. NEVER blocks a
    // sale — the gateway draws this location's FIFO and goes negative on shortfall.
    const locationId =
      command.locationId ??
      (await this.locations.resolveConsumptionLocationId(
        command.restaurantId,
        item.branchId,
        item.consumptionLocationId,
      ));

    const result = await this.ledger.consume({
      restaurantId: command.restaurantId,
      branchId: item.branchId,
      itemId: command.itemId,
      baseQty: command.baseQty,
      type: command.type,
      reason: command.reason ?? null,
      refType: command.refType ?? null,
      refId: command.refId ?? null,
      createdByUserId: command.createdByUserId,
      occurredAt: command.occurredAt ?? new Date(),
      trackExpiry: item.trackExpiry,
      lastUnitCostMicro: item.lastUnitCostMicro,
      locationId,
    });

    await this.events.publish(
      new StockConsumedEvent(
        item.id,
        item.restaurantId,
        command.type,
        command.baseQty,
        result.wentNegative,
        command.createdByUserId,
      ),
    );

    return result;
  }

  async reverse(command: ReverseStockCommand): Promise<StockReversalResult> {
    const reversedCount = await this.ledger.reverse({
      restaurantId: command.restaurantId,
      refType: command.refType,
      refId: command.refId,
      createdByUserId: command.createdByUserId,
      occurredAt: command.occurredAt ?? new Date(),
    });
    return { reversedCount };
  }
}
