import { Inject, Injectable } from '@nestjs/common';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { UseCase } from '../../../../shared/application/use-case';
import {
  CATALOG_BROWSE_READER,
  CatalogBrowseReader,
} from '../../../platform-catalog/domain/repositories/catalog-browse.reader';
import { ItemKind } from '../../domain/enums';
import {
  INVENTORY_STOCK_READER,
  InventoryStockReader,
  StockRow,
} from '../ports/inventory-stock.reader';
import { compareByEffectiveName } from '../services/effective-name-sort';
import { InventoryItemNameResolver } from '../services/inventory-item-name.resolver';
import { NoRestaurantInScope } from '../application.errors';

export interface GetStockInput {
  restaurantId: string | null;
  branchId: string;
  lowStock?: boolean;
  expiringBefore?: Date;
  categoryId?: string;
  kind?: ItemKind;
  search?: string;
  page?: number;
  limit?: number;
}

/** Per-item on-hand + valuation, with low-stock / expiry / category / kind filters. */
@Injectable()
export class GetStockUseCase implements UseCase<GetStockInput, Paginated<StockRow>> {
  constructor(
    @Inject(INVENTORY_STOCK_READER) private readonly reader: InventoryStockReader,
    @Inject(CATALOG_BROWSE_READER) private readonly catalog: CatalogBrowseReader,
    private readonly names: InventoryItemNameResolver,
  ) {}

  async execute(input: GetStockInput): Promise<Paginated<StockRow>> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const query = normalizePagination({ page: input.page, limit: input.limit });

    // INV-SEARCH-1 step 1: resolve catalog ids the term matches so adopted items are
    // findable by their live catalog name (any-of-three locales, unpaginated).
    const term = input.search?.trim();
    const matchedCatalogItemIds = term ? await this.catalog.searchActiveIds(term) : undefined;

    // Full filtered set (lowStock / expiry applied), unsorted + unpaginated.
    const rows = await this.reader.stock({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      lowStock: input.lowStock,
      expiringBefore: input.expiringBefore,
      categoryId: input.categoryId,
      kind: input.kind,
      search: term || undefined,
      matchedCatalogItemIds,
    });

    // PLATCAT-ADOPT-1B: resolve the live catalog name for adopted rows (batched, no N+1).
    const catalogNames = await this.names.resolveMany(
      rows.map((r) => ({ id: r.itemId, catalogItemId: r.catalogItemId })),
    );
    for (const r of rows) {
      r.catalogName = catalogNames.get(r.itemId) ?? null;
    }

    // INV-SEARCH-1: sort by effective name (adopted + custom interleave), then paginate.
    rows.sort((a, b) => compareByEffectiveName(a.name, a.catalogName, b.name, b.catalogName));
    const { skip, take } = toSkipTake(query);
    return paginate(rows.slice(skip, skip + take), rows.length, query);
  }
}
