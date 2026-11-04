import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { CatalogItemStatus } from '../../../platform-catalog/domain/entities/catalog-item';
import {
  CATALOG_BROWSE_READER,
  CatalogBrowseReader,
  CatalogBrowseView,
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
import { InventoryCategoryNotFound, NoRestaurantInScope } from '../application.errors';

/** Hard cap per request (the whole kitchen catalog is well below this). */
export const BULK_ADOPT_MAX = 2000;

export interface BulkAdoptCatalogItemsInput {
  restaurantId: string | null;
  branchId: string;
  /** Explicit selection. Ignored when `all` is true. */
  catalogItemIds?: string[];
  /** Adopt every ACTIVE catalog item matching search / catalogCategoryId. */
  all?: boolean;
  search?: string;
  catalogCategoryId?: string;
  /** Inventory category for the new items (optional). */
  categoryId?: string | null;
  actorUserId: string;
}

export interface BulkAdoptCatalogItemsResult {
  requested: number;
  adopted: number;
  skipped: number;
  unavailable: number;
}

/**
 * CATALOG-BULK-ADOPT-1 — adopt many platform catalog items into a branch at once
 * ("Adopt selected" / "Adopt all"). Same rules as the single adopt
 * (AdoptCatalogItemUseCase): ACTIVE items only, no local name (the platform owns
 * an adopted item's name), single-adopt per branch — but already-adopted and
 * archived items are SKIPPED instead of failing the batch. Each new item takes
 * the catalog item's own unit; no SKU is set.
 */
@Injectable()
export class BulkAdoptCatalogItemsUseCase
  implements UseCase<BulkAdoptCatalogItemsInput, BulkAdoptCatalogItemsResult>
{
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    @Inject(INVENTORY_CATEGORY_REPOSITORY) private readonly categories: InventoryCategoryRepository,
    @Inject(CATALOG_BROWSE_READER) private readonly catalog: CatalogBrowseReader,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: BulkAdoptCatalogItemsInput): Promise<BulkAdoptCatalogItemsResult> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const restaurantId = input.restaurantId;

    if (input.categoryId) {
      const category = await this.categories.findById(restaurantId, input.branchId, input.categoryId);
      if (!category) {
        throw InventoryCategoryNotFound();
      }
    }

    // 1. Resolve the target catalog items.
    let targets: CatalogBrowseView[];
    let requested: number;
    if (input.all) {
      targets = await this.catalog.listAllActive({
        search: input.search,
        categoryId: input.catalogCategoryId,
        limit: BULK_ADOPT_MAX,
      });
      requested = targets.length;
    } else {
      const unique = [...new Set(input.catalogItemIds ?? [])].slice(0, BULK_ADOPT_MAX);
      requested = unique.length;
      const found = await Promise.all(unique.map((id) => this.catalog.findById(id)));
      targets = found.filter(
        (v): v is CatalogBrowseView => v !== null && v.status === CatalogItemStatus.ACTIVE,
      );
    }
    const unavailable = requested - targets.length;

    // 2. Skip what the branch already adopted (one query, not one per item).
    const adoptedIds = new Set(
      await this.items.listAdoptedCatalogItemIds(restaurantId, input.branchId),
    );

    let adopted = 0;
    let skipped = 0;
    for (const view of targets) {
      if (adoptedIds.has(view.id)) {
        skipped++;
        continue;
      }
      const item = InventoryItem.create({
        id: this.ids.generate(),
        restaurantId,
        branchId: input.branchId,
        name: null,
        baseUnit: view.baseUnit as unknown as InventoryBaseUnit,
        categoryId: input.categoryId ?? null,
        sku: null,
        catalogItemId: view.id,
        actorUserId: input.actorUserId,
      });
      await this.items.create(item);
      await this.events.publishFromAggregate(item);
      adoptedIds.add(view.id);
      adopted++;
    }

    return { requested, adopted, skipped, unavailable };
  }
}
