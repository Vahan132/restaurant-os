import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { WriteOff, WriteOffLine } from '../../domain/entities/write-off';
import {
  StockMovementType,
  WRITE_OFF_REF_TYPE,
  WriteOffLineKind,
  WriteOffReason,
} from '../../domain/enums';
import { InventoryWentNegativeEvent } from '../../domain/events/inventory-events';
import {
  STOCK_CONSUMPTION_PORT,
  StockConsumptionPort,
} from '../../domain/ports/stock-consumption.port';
import {
  INVENTORY_ITEM_REPOSITORY,
  InventoryItemRepository,
} from '../../domain/repositories/inventory-item.repository';
import {
  WRITE_OFF_REPOSITORY,
  WriteOffRepository,
} from '../../domain/repositories/write-off.repository';
import { MENU_ITEM_LOOKUP, MenuItemLookup } from '../ports/menu-item.lookup';
import {
  CrossBranchReference,
  InventoryItemNotFound,
  MenuItemNotFoundForRecipe,
  NoRestaurantInScope,
} from '../application.errors';
import { RecipeConsumptionService } from '../services/recipe-consumption.service';

export interface CreateWriteOffItemLine {
  kind: WriteOffLineKind.ITEM;
  itemId: string;
  unit: string;
  qty: number;
}
export interface CreateWriteOffDishLine {
  kind: WriteOffLineKind.DISH;
  menuItemId: string;
  units: number;
  modifierOptionIds?: string[];
}
export type CreateWriteOffLine = CreateWriteOffItemLine | CreateWriteOffDishLine;

export interface CreateWriteOffInput {
  restaurantId: string | null;
  branchId: string;
  reason: WriteOffReason;
  note?: string | null;
  occurredAt?: Date | null;
  lines: CreateWriteOffLine[];
  actorUserId: string;
}

/**
 * Record a stock write-off. Per line, draws stock down as WRITE_OFF_OUT (ITEM:
 * direct consume; DISH: recipe explosion via the reusable RecipeConsumptionService),
 * keyed by refType=WRITE_OFF so a later void reverses it. Never throws on
 * insufficient stock (warn-don't-block); negatives surface via an event.
 *
 * The consumption ref is the LINE id, not the write-off id. The ledger's
 * idempotency guard keys on (refType, refId, itemId); with the write-off id as
 * the ref, a second line touching the same item — two ITEM lines for one
 * ingredient, or an ITEM line plus a DISH line whose recipe uses it — looked
 * like a re-fire and was silently skipped, so that quantity never left stock.
 * Per-line refs keep each line's draw independent; VoidWriteOffUseCase reverses
 * every line's ref (and the legacy write-off-id ref, for rows written before
 * this change).
 */
@Injectable()
export class CreateWriteOffUseCase implements UseCase<CreateWriteOffInput, WriteOff> {
  constructor(
    @Inject(WRITE_OFF_REPOSITORY) private readonly writeOffs: WriteOffRepository,
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    @Inject(STOCK_CONSUMPTION_PORT) private readonly consumption: StockConsumptionPort,
    @Inject(MENU_ITEM_LOOKUP) private readonly menuItems: MenuItemLookup,
    private readonly recipeConsumption: RecipeConsumptionService,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: CreateWriteOffInput): Promise<WriteOff> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const restaurantId = input.restaurantId;
    const branchId = input.branchId;
    const writeOffId = this.ids.generate();
    const occurredAt = input.occurredAt ?? new Date();
    const negatives: Array<{ itemId: string; shortfall: number }> = [];
    const lines: WriteOffLine[] = [];

    for (const line of input.lines) {
      // Allocated up-front: it is this line's consumption ref, so it must exist
      // before the draw, not just when the line row is built.
      const lineId = this.ids.generate();
      if (line.kind === WriteOffLineKind.ITEM) {
        // §5 cross-branch: load branch-AGNOSTIC so we can inspect the item's branch.
        const item = await this.items.findInRestaurant(restaurantId, line.itemId);
        if (!item) {
          throw InventoryItemNotFound();
        }
        if (item.branchId !== branchId) {
          throw CrossBranchReference('Write-off references an item in a different branch.');
        }
        const baseQty = item.toBaseQty(line.unit, line.qty); // throws UnknownUnitError
        const result = await this.consumption.consume({
          restaurantId,
          itemId: line.itemId,
          baseQty,
          type: StockMovementType.WRITE_OFF_OUT,
          reason: input.reason,
          refType: WRITE_OFF_REF_TYPE,
          refId: lineId,
          createdByUserId: input.actorUserId,
          occurredAt,
        });
        if (result.wentNegative) {
          negatives.push({ itemId: line.itemId, shortfall: result.shortfallBaseQty });
        }
        lines.push(
          new WriteOffLine({
            id: lineId,
            branchId: item.branchId,
            kind: WriteOffLineKind.ITEM,
            itemId: line.itemId,
            menuItemId: null,
            enteredUnit: line.unit,
            enteredQty: line.qty,
            baseQty,
            units: null,
            modifierOptionIds: null,
            costAmount: result.totalCostAmount,
          }),
        );
      } else {
        // §5 cross-branch: the menu item must belong to the active branch.
        const menuItemBranchId = await this.menuItems.menuItemBranchId(
          restaurantId,
          line.menuItemId,
        );
        if (menuItemBranchId === null) {
          throw MenuItemNotFoundForRecipe();
        }
        if (menuItemBranchId !== branchId) {
          throw CrossBranchReference('Write-off references a menu item in a different branch.');
        }
        const result = await this.recipeConsumption.consumeMenuItem({
          restaurantId,
          menuItemId: line.menuItemId,
          units: line.units,
          type: StockMovementType.WRITE_OFF_OUT,
          reason: input.reason,
          refType: WRITE_OFF_REF_TYPE,
          refId: lineId,
          modifierOptionIds: line.modifierOptionIds,
          createdByUserId: input.actorUserId,
        });
        for (const neg of result.negativeItems) {
          negatives.push({ itemId: neg.itemId, shortfall: neg.shortfallBaseQty });
        }
        lines.push(
          new WriteOffLine({
            id: lineId,
            branchId,
            kind: WriteOffLineKind.DISH,
            itemId: null,
            menuItemId: line.menuItemId,
            enteredUnit: null,
            enteredQty: null,
            baseQty: null,
            units: line.units,
            modifierOptionIds: line.modifierOptionIds ?? null,
            costAmount: result.totalCostAmount,
          }),
        );
      }
    }

    const writeOff = WriteOff.create({
      id: writeOffId,
      restaurantId,
      branchId: input.branchId,
      reason: input.reason,
      note: input.note ?? null,
      occurredAt,
      createdByUserId: input.actorUserId,
      lines,
    });
    await this.writeOffs.create(writeOff);
    await this.events.publishFromAggregate(writeOff);

    // Surface any negative stock (warn-don't-block) for reports/notifications.
    for (const neg of negatives) {
      await this.events.publish(
        new InventoryWentNegativeEvent(
          neg.itemId,
          restaurantId,
          WRITE_OFF_REF_TYPE,
          writeOffId,
          neg.shortfall,
        ),
      );
    }

    return writeOff;
  }
}
