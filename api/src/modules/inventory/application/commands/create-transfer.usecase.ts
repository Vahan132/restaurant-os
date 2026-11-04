import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { InventoryLocationStatus } from '../../domain/enums';
import { StockTransferredEvent } from '../../domain/events/inventory-events';
import {
  INVENTORY_LEDGER_GATEWAY,
  InventoryLedgerGateway,
  TransferSliceRecord,
} from '../../domain/repositories/inventory-ledger.gateway';
import {
  INVENTORY_ITEM_REPOSITORY,
  InventoryItemRepository,
} from '../../domain/repositories/inventory-item.repository';
import {
  INVENTORY_LOCATION_REPOSITORY,
  InventoryLocationRepository,
} from '../../domain/repositories/inventory-location.repository';
import { STOCK_ON_HAND_READER, StockOnHandReader } from '../ports/stock-on-hand.reader';
import {
  InventoryItemNotFound,
  InventoryLocationNotFound,
  NoRestaurantInScope,
  TransferExceedsOnHand,
  TransferLocationInactive,
  TransferSameLocation,
} from '../application.errors';

export interface CreateTransferUseCaseInput {
  restaurantId: string | null;
  branchId: string;
  itemId: string;
  fromLocationId: string;
  toLocationId: string;
  /** Base unit (e.g. "GRAM") or a defined alternate name (e.g. "kg"). */
  unit: string;
  /** Quantity in the entered unit (positive integer). */
  qty: number;
  actorUserId: string;
}

export interface CreateTransferResult {
  transferId: string;
  itemId: string;
  fromLocationId: string;
  toLocationId: string;
  baseQty: number;
  occurredAt: Date;
  fromOnHandAfter: number;
  toOnHandAfter: number;
  slices: TransferSliceRecord[];
}

/**
 * Create a within-branch stock transfer (6B). Validates (same branch via
 * branch-scoped lookups, A≠B, both ACTIVE, Q>0, Q≤source on-hand) then delegates
 * the atomic FIFO relocation to the ledger gateway. Relocation at carrying cost —
 * NO COGS.
 */
@Injectable()
export class CreateTransferUseCase
  implements UseCase<CreateTransferUseCaseInput, CreateTransferResult>
{
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    @Inject(INVENTORY_LOCATION_REPOSITORY) private readonly locations: InventoryLocationRepository,
    @Inject(STOCK_ON_HAND_READER) private readonly onHand: StockOnHandReader,
    @Inject(INVENTORY_LEDGER_GATEWAY) private readonly ledger: InventoryLedgerGateway,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: CreateTransferUseCaseInput): Promise<CreateTransferResult> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    if (input.fromLocationId === input.toLocationId) {
      throw TransferSameLocation();
    }

    const item = await this.items.findById(input.restaurantId, input.branchId, input.itemId);
    if (!item) {
      throw InventoryItemNotFound();
    }

    // Branch-scoped lookups: a cross-branch location id simply won't resolve here,
    // which enforces "within-branch only".
    const [from, to] = await Promise.all([
      this.locations.findById(input.restaurantId, input.branchId, input.fromLocationId),
      this.locations.findById(input.restaurantId, input.branchId, input.toLocationId),
    ]);
    if (!from || !to) {
      throw InventoryLocationNotFound();
    }
    if (
      from.status !== InventoryLocationStatus.ACTIVE ||
      to.status !== InventoryLocationStatus.ACTIVE
    ) {
      throw TransferLocationInactive();
    }

    const baseQty = item.toBaseQty(input.unit, input.qty); // throws UnknownUnitError; DTO guarantees qty>=1

    // Block over-transfer up front (the gateway re-asserts inside the tx).
    const available = await this.onHand.quantityAt(
      input.restaurantId,
      // §4: stock follows the item.
      item.branchId,
      item.id,
      from.id,
    );
    if (baseQty > available) {
      throw TransferExceedsOnHand();
    }

    const transferId = this.ids.generate();
    const occurredAt = new Date();
    const result = await this.ledger.transfer({
      transferId,
      restaurantId: input.restaurantId,
      branchId: item.branchId,
      itemId: item.id,
      fromLocationId: from.id,
      toLocationId: to.id,
      baseQty,
      trackExpiry: item.trackExpiry,
      lastUnitCostMicro: item.lastUnitCostMicro,
      performedByUserId: input.actorUserId,
      occurredAt,
    });

    await this.events.publish(
      new StockTransferredEvent(
        transferId,
        item.restaurantId,
        item.branchId,
        item.id,
        from.id,
        to.id,
        baseQty,
        result.slices.length,
        input.actorUserId,
      ),
    );

    return {
      transferId,
      itemId: item.id,
      fromLocationId: from.id,
      toLocationId: to.id,
      baseQty,
      occurredAt,
      fromOnHandAfter: result.fromOnHandAfter,
      toOnHandAfter: result.toOnHandAfter,
      slices: result.slices,
    };
  }
}
