import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { CatalogItemStatus } from '../../../platform-catalog/domain/entities/catalog-item';
import {
  CATALOG_BROWSE_READER,
  CatalogBrowseReader,
} from '../../../platform-catalog/domain/repositories/catalog-browse.reader';
import { InventoryItem } from '../../domain/entities/inventory-item';
import { InventoryBaseUnit } from '../../domain/enums';
import {
  INVENTORY_CATEGORY_REPOSITORY,
  InventoryCategoryRepository,
} from '../../domain/repositories/inventory-category.repository';
import {
  INVENTORY_ITEM_REPOSITORY,
  InventoryItemRepository,
} from '../../domain/repositories/inventory-item.repository';
import {
  CatalogItemAlreadyAdopted,
  CatalogItemNotAdoptable,
  CatalogItemNotFound,
  InventoryCategoryNotFound,
  InventorySkuAlreadyExists,
  NoRestaurantInScope,
} from '../application.errors';

export interface AdoptCatalogItemInput {
  restaurantId: string | null;
  branchId: string;
  catalogItemId: string;
  baseUnit: InventoryBaseUnit;
  alternateUnits?: ReadonlyArray<{ name: string; factor: number }>;
  categoryId?: string | null;
  sku?: string | null;
  actorUserId: string;
}

/**
 * Adopt a platform CatalogItem into a branch's inventory (CATALOG-1). Creates an
 * InventoryItem with `catalogItemId` set so allergens/adgCode resolve by reference
 * (overrides left null — that's OVERRIDE-1). The catalog is read via the tenant
 * browse port (ACTIVE-gated), NOT the resolution service (which resolves archived
 * items so adopted refs never orphan).
 */
@Injectable()
export class AdoptCatalogItemUseCase implements UseCase<AdoptCatalogItemInput, InventoryItem> {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    @Inject(INVENTORY_CATEGORY_REPOSITORY) private readonly categories: InventoryCategoryRepository,
    @Inject(CATALOG_BROWSE_READER) private readonly catalog: CatalogBrowseReader,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: AdoptCatalogItemInput): Promise<InventoryItem> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const restaurantId = input.restaurantId;

    // 1. Adoptability gate (browse port, not resolution).
    const catalogItem = await this.catalog.findById(input.catalogItemId);
    if (catalogItem === null) {
      throw CatalogItemNotFound();
    }
    if (catalogItem.status !== CatalogItemStatus.ACTIVE) {
      throw CatalogItemNotAdoptable();
    }

    // 2. Double-adopt guard (code-enforced; no DB unique index yet).
    const alreadyAdopted = await this.items.findByCatalogItemId(
      restaurantId,
      input.branchId,
      input.catalogItemId,
    );
    if (alreadyAdopted !== null) {
      throw CatalogItemAlreadyAdopted(alreadyAdopted.id);
    }

    // 3. Same create-path validations for the tenant-supplied fields.
    if (input.categoryId) {
      const category = await this.categories.findById(restaurantId, input.branchId, input.categoryId);
      if (!category) {
        throw InventoryCategoryNotFound();
      }
    }
    if (input.sku) {
      const exists = await this.items.existsBySku(restaurantId, input.branchId, input.sku);
      if (exists) {
        throw InventorySkuAlreadyExists();
      }
    }

    // 4. PLATCAT-ADOPT-1B: the platform OWNS an adopted item's name. Persist NO
    //    local name (name = null); display resolves the catalog's trilingual name
    //    live at read time, so a platform name fix propagates to every tenant.
    const item = InventoryItem.create({
      id: this.ids.generate(),
      restaurantId,
      branchId: input.branchId,
      name: null,
      baseUnit: input.baseUnit,
      categoryId: input.categoryId ?? null,
      sku: input.sku ?? null,
      alternateUnits: input.alternateUnits,
      catalogItemId: input.catalogItemId,
      actorUserId: input.actorUserId,
    });
    await this.items.create(item);
    await this.events.publishFromAggregate(item);
    return item;
  }
}
