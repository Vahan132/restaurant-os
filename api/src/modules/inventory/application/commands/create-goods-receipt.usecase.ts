import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { GoodsReceipt, GoodsReceiptLine } from '../../domain/entities/goods-receipt';
import { InventoryItem } from '../../domain/entities/inventory-item';
import { StockMovementType } from '../../domain/enums';
import {
  INVENTORY_LEDGER_GATEWAY,
  InventoryLedgerGateway,
  ItemCostUpdate,
  NewLayerSpec,
  NewMovementSpec,
} from '../../domain/repositories/inventory-ledger.gateway';
import {
  INVENTORY_ITEM_REPOSITORY,
  InventoryItemRepository,
} from '../../domain/repositories/inventory-item.repository';
import { InventoryLocationProvisioner } from '../services/inventory-location-provisioner.service';
import {
  CrossBranchReference,
  InventoryItemNotFound,
  NoRestaurantInScope,
} from '../application.errors';

export interface CreateGoodsReceiptLineInput {
  itemId: string;
  unit: string;
  qty: number;
  lineTotalCostAmount: number;
  expiryDate?: Date | null;
}

export interface CreateGoodsReceiptInput {
  restaurantId: string | null;
  branchId: string;
  /** 6C: target location for the received stock (defaults to Main Storage). */
  locationId?: string | null;
  supplierId?: string | null;
  reference?: string | null;
  receivedAt?: Date | null;
  note?: string | null;
  lines: CreateGoodsReceiptLineInput[];
  actorUserId: string;
}

/**
 * Record a goods receipt. For each line: validate item + unit, convert to base,
 * create a line + a StockLayer, and emit a RECEIPT_IN movement; refresh each
 * item's lastUnitCostMicro. The whole receipt is one DB transaction (gateway).
 */
@Injectable()
export class CreateGoodsReceiptUseCase implements UseCase<CreateGoodsReceiptInput, GoodsReceipt> {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    @Inject(INVENTORY_LEDGER_GATEWAY) private readonly ledger: InventoryLedgerGateway,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly locations: InventoryLocationProvisioner,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: CreateGoodsReceiptInput): Promise<GoodsReceipt> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const restaurantId = input.restaurantId;
    const receivedAt = input.receivedAt ?? new Date();

    const branchId = input.branchId;
    // 6C: received stock lands in the requested target location (validated active
    // + in-branch), or the branch default Main Storage if unspecified.
    const locationId = await this.locations.resolveReceivingLocationId(
      restaurantId,
      branchId,
      input.locationId ?? null,
    );
    const itemIds = [...new Set(input.lines.map((l) => l.itemId))];
    const itemRows = await this.items.findManyByIds(restaurantId, branchId, itemIds);
    const itemsById = new Map<string, InventoryItem>(itemRows.map((i) => [i.id, i]));

    const receiptId = this.ids.generate();
    const lines: GoodsReceiptLine[] = [];
    const layers: NewLayerSpec[] = [];
    const movements: NewMovementSpec[] = [];
    const costByItem = new Map<string, bigint>();

    for (const line of input.lines) {
      const item = itemsById.get(line.itemId);
      if (!item) {
        // §5: distinguish a genuinely cross-branch reference from a missing id.
        const crossBranch = await this.items.findInRestaurant(restaurantId, line.itemId);
        if (crossBranch) {
          throw CrossBranchReference(
            'Goods-receipt line references an item in a different branch.',
          );
        }
        throw InventoryItemNotFound();
      }
      // Domain invariants: expiry only when tracked; unit must resolve.
      item.assertExpiryAllowed(line.expiryDate ?? null);
      const baseQty = item.toBaseQty(line.unit, line.qty); // throws UnknownUnitError

      const lineId = this.ids.generate();
      const layerId = this.ids.generate();

      lines.push(
        new GoodsReceiptLine({
          id: lineId,
          // §4: stock follows the item — the line lives in the item's branch.
          branchId: item.branchId,
          itemId: line.itemId,
          enteredUnit: line.unit,
          enteredQty: line.qty,
          baseQty,
          lineTotalCostAmount: line.lineTotalCostAmount,
          expiryDate: line.expiryDate ?? null,
        }),
      );

      layers.push({
        id: layerId,
        restaurantId,
        // §4: stock follows the item — the layer lives in the item's branch.
        branchId: item.branchId,
        locationId,
        itemId: line.itemId,
        sourceReceiptLineId: lineId,
        baseQtyReceived: baseQty,
        baseQtyRemaining: baseQty,
        lineTotalCostAmount: line.lineTotalCostAmount,
        receivedAt,
        expiryDate: line.expiryDate ?? null,
      });

      movements.push({
        id: this.ids.generate(),
        restaurantId,
        // §4: stock follows the item — the movement lives in the item's branch.
        branchId: item.branchId,
        locationId,
        itemId: line.itemId,
        type: StockMovementType.RECEIPT_IN,
        baseQty,
        costAmount: line.lineTotalCostAmount,
        layerId,
        reason: null,
        refType: 'GOODS_RECEIPT',
        refId: receiptId,
        occurredAt: receivedAt,
        createdByUserId: input.actorUserId,
      });

      // Last line for an item wins; lastUnitCostMicro derived per §5.
      costByItem.set(line.itemId, item.unitCostMicroFor(line.lineTotalCostAmount, baseQty));
    }

    const receipt = GoodsReceipt.create({
      id: receiptId,
      restaurantId,
      branchId,
      supplierId: input.supplierId ?? null,
      reference: input.reference ?? null,
      receivedAt,
      note: input.note ?? null,
      createdByUserId: input.actorUserId,
      lines,
    });

    const costUpdates: ItemCostUpdate[] = [...costByItem.entries()].map(
      ([itemId, lastUnitCostMicro]) => ({ itemId, lastUnitCostMicro }),
    );

    await this.ledger.recordReceipt({ receipt, layers, movements, costUpdates });
    await this.events.publishFromAggregate(receipt);
    return receipt;
  }
}
