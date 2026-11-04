import { Inject, Injectable } from '@nestjs/common';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { UseCase } from '../../../../shared/application/use-case';
import { CatalogLocalizedName } from '../../../platform-catalog/domain/repositories/catalog-item.reader';
import {
  CATALOG_BROWSE_READER,
  CatalogBrowseReader,
} from '../../../platform-catalog/domain/repositories/catalog-browse.reader';
import { InventoryItem } from '../../domain/entities/inventory-item';
import { ItemKind } from '../../domain/enums';
import {
  INVENTORY_ITEM_REPOSITORY,
  InventoryItemRepository,
} from '../../domain/repositories/inventory-item.repository';
import { compareByEffectiveName } from '../services/effective-name-sort';
import { InventoryItemNameResolver } from '../services/inventory-item-name.resolver';
import { NoRestaurantInScope } from '../application.errors';

export interface ListInventoryItemsInput {
  restaurantId: string | null;
  branchId: string;
  categoryId?: string;
  kind?: ItemKind;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * One listed item plus its live-resolved catalog name (INV-SEARCH-1). The use-case
 * resolves once — for both the effective-name sort AND the response — so the controller
 * doesn't re-resolve (single batched catalog read per call, no N+1).
 */
export interface ResolvedInventoryItem {
  item: InventoryItem;
  /** Live trilingual catalog name for an adopted item; null for a custom item. */
  catalogName: CatalogLocalizedName | null;
}

/** Paginated, tenant-scoped listing of inventory items with filters. */
@Injectable()
export class ListInventoryItemsUseCase implements UseCase<
  ListInventoryItemsInput,
  Paginated<ResolvedInventoryItem>
> {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    @Inject(CATALOG_BROWSE_READER) private readonly catalog: CatalogBrowseReader,
    private readonly names: InventoryItemNameResolver,
  ) {}

  async execute(input: ListInventoryItemsInput): Promise<Paginated<ResolvedInventoryItem>> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const query = normalizePagination({ page: input.page, limit: input.limit });

    // INV-SEARCH-1 step 1: a search term also matches adopted items by their live catalog
    // name — resolve matching ACTIVE catalog ids (any-of-three locales), unpaginated.
    const term = input.search?.trim();
    const matchedCatalogItemIds = term ? await this.catalog.searchActiveIds(term) : undefined;

    // Full filtered candidate set (no DB pagination / no DB name sort).
    const items = await this.items.list({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      categoryId: input.categoryId,
      kind: input.kind,
      search: term || undefined,
      matchedCatalogItemIds,
    });

    // Resolve effective names once (batched) — used for BOTH sort and response.
    const catalogNames = await this.names.resolveMany(
      items.map((i) => ({ id: i.id, catalogItemId: i.catalogItemId })),
    );
    const resolved: ResolvedInventoryItem[] = items.map((item) => ({
      item,
      catalogName: catalogNames.get(item.id) ?? null,
    }));

    // Sort by effective name (adopted + custom interleave), then paginate in memory.
    resolved.sort((a, b) =>
      compareByEffectiveName(a.item.name, a.catalogName, b.item.name, b.catalogName),
    );
    const { skip, take } = toSkipTake(query);
    return paginate(resolved.slice(skip, skip + take), resolved.length, query);
  }
}
