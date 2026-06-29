import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { StockAdjustedInEvent } from '../../domain/events/inventory-events';
import { AdjustmentDirection, AdjustmentReason, StockMovementType } from '../../domain/enums';
import {
  STOCK_CONSUMPTION_PORT,
  StockConsumptionPort,
} from '../../domain/ports/stock-consumption.port';
import {
  INVENTORY_LEDGER_GATEWAY,
  InventoryLedgerGateway,
} from '../../domain/repositories/inventory-ledger.gateway';
import {
  INVENTORY_ITEM_REPOSITORY,
  InventoryItemRepository,
} from '../../domain/repositories/inventory-item.repository';
import { costFromUnitCostMicro } from '../../domain/value-objects/money';
import { InventoryLocationProvisioner } from '../services/inventory-location-provisioner.service';
import { NegativeStockPolicyService } from '../services/negative-stock-policy.service';
import { InventoryItemNotFound, NoRestaurantInScope } from '../application.errors';

export interface CreateAdjustmentInput {
  restaurantId: string | null;
  branchId: string;
  itemId: string;
  direction: AdjustmentDirection;
  unit: string;
  qty: number;
  reason: AdjustmentReason;
  note?: string | null;
  actorUserId: string;
}

export interface AdjustmentResult {
  itemId: string;
  direction: AdjustmentDirection;
  baseQty: number;
  wentNegative: boolean;
  uncosted: boolean;
}

/**
 * Manual stock adjustment (opening balances + corrections).
 *  - IN: creates a layer (cost from item.lastUnitCostMicro; 0 + flagged uncosted
 *    if none) + an ADJUSTMENT_IN movement.
 *  - OUT: runs the FIFO/FEFO consumption service, producing ADJUSTMENT_OUT
 *    movement(s). Never throws on insufficient stock (returns wentNegative).
 */
@Injectable()
export class CreateAdjustmentUseCase implements UseCase<CreateAdjustmentInput, AdjustmentResult> {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    @Inject(INVENTORY_LEDGER_GATEWAY) private readonly ledger: InventoryLedgerGateway,
    @Inject(STOCK_CONSUMPTION_PORT) private readonly consumption: StockConsumptionPort,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly locations: InventoryLocationProvisioner,
    private readonly negativeStock: NegativeStockPolicyService,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: CreateAdjustmentInput): Promise<AdjustmentResult> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const item = await this.items.findById(input.restaurantId, input.branchId, input.itemId);
    if (!item) {
      throw InventoryItemNotFound();
    }
    const baseQty = item.toBaseQty(input.unit, input.qty); // throws UnknownUnitError

    if (input.direction === AdjustmentDirection.OUT) {
      // 6C: a manual OUT depletes the item's consumption location. §5: BLOCK
      // rejects a manual depletion that would drive THAT location below zero
      // (ALLOW/WARN fall through; consume() still never throws).
      const consumptionLocationId = await this.locations.resolveConsumptionLocationId(
        input.restaurantId,
        item.branchId,
        item.consumptionLocationId,
      );
      await this.negativeStock.assertLocationDepletionAllowed(
        input.restaurantId,
        item.branchId,
        input.itemId,
        consumptionLocationId,
        baseQty,
      );
      const result = await this.consumption.consume({
        restaurantId: input.restaurantId,
        itemId: input.itemId,
        baseQty,
        type: StockMovementType.ADJUSTMENT_OUT,
        reason: input.reason,
        refType: null,
        refId: null,
        createdByUserId: input.actorUserId,
        locationId: consumptionLocationId,
      });
      return {
        itemId: item.id,
        direction: AdjustmentDirection.OUT,
        baseQty,
        wentNegative: result.wentNegative,
        uncosted: result.uncosted,
      };
    }

    // IN: cost the new layer from the item's last known unit cost (or flag uncosted).
    const hasCost = item.lastUnitCostMicro !== null && item.lastUnitCostMicro > 0n;
    const lineTotalCostAmount = hasCost
      ? costFromUnitCostMicro(item.lastUnitCostMicro as bigint, baseQty)
      : 0;
    const uncosted = !hasCost;

    const occurredAt = new Date();
    const layerId = this.ids.generate();
    // 6A: manual IN lands on the branch default (Main Storage) location.
    const locationId = await this.locations.resolveDefaultLocationId(
      input.restaurantId,
      item.branchId,
    );
    await this.ledger.recordInboundAdjustment({
      layer: {
        id: layerId,
        restaurantId: input.restaurantId,
        // §4: stock follows the item — the layer lives in the item's branch.
        branchId: item.branchId,
        locationId,
        itemId: input.itemId,
        sourceReceiptLineId: null,
        baseQtyReceived: baseQty,
        baseQtyRemaining: baseQty,
        lineTotalCostAmount,
        receivedAt: occurredAt,
        expiryDate: null,
      },
      movement: {
        id: this.ids.generate(),
        restaurantId: input.restaurantId,
        // §4: stock follows the item — the movement lives in the item's branch.
        branchId: item.branchId,
        locationId,
        itemId: input.itemId,
        type: StockMovementType.ADJUSTMENT_IN,
        baseQty,
        costAmount: lineTotalCostAmount,
        layerId,
        reason: input.reason,
        refType: null,
        refId: null,
        occurredAt,
        createdByUserId: input.actorUserId,
      },
    });

    await this.events.publish(
      new StockAdjustedInEvent(item.id, item.restaurantId, baseQty, uncosted, input.actorUserId),
    );

    return {
      itemId: item.id,
      direction: AdjustmentDirection.IN,
      baseQty,
      wentNegative: false,
      uncosted,
    };
  }
}
