import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { InventoryItem } from '../../domain/entities/inventory-item';
import { InventoryBaseUnit, ItemKind } from '../../domain/enums';
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
  InventorySkuAlreadyExists,
  NoRestaurantInScope,
} from '../application.errors';

export interface CreateInventoryItemInput {
  restaurantId: string | null;
  branchId: string;
  name: string;
  baseUnit: InventoryBaseUnit;
  kind?: ItemKind;
  categoryId?: string | null;
  sku?: string | null;
  alternateUnits?: ReadonlyArray<{ name: string; factor: number }>;
  trackExpiry?: boolean;
  lowStockThresholdBase?: number | null;
  cleaningLossBps?: number | null;
  actorUserId: string;
}

/** Create an inventory item (RAW or PROCESSED). Validates an optional category. */
@Injectable()
export class CreateInventoryItemUseCase implements UseCase<
  CreateInventoryItemInput,
  InventoryItem
> {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    @Inject(INVENTORY_CATEGORY_REPOSITORY) private readonly categories: InventoryCategoryRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: CreateInventoryItemInput): Promise<InventoryItem> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
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
    if (input.sku) {
      const exists = await this.items.existsBySku(input.restaurantId, input.branchId, input.sku);
      if (exists) {
        throw InventorySkuAlreadyExists();
      }
    }
    const item = InventoryItem.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      name: input.name,
      baseUnit: input.baseUnit,
      kind: input.kind,
      categoryId: input.categoryId ?? null,
      sku: input.sku ?? null,
      alternateUnits: input.alternateUnits, // domain validates each factor
      trackExpiry: input.trackExpiry,
      lowStockThresholdBase: input.lowStockThresholdBase ?? null,
      cleaningLossBps: input.cleaningLossBps ?? null,
      actorUserId: input.actorUserId,
    });
    await this.items.create(item);
    await this.events.publishFromAggregate(item);
    return item;
  }
}
