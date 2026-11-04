import { Inject, Injectable } from '@nestjs/common';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import {
  INVENTORY_REPORT_READER,
  InventoryReportReader,
  StockOnHandReportRow,
  ValuationSummary,
} from '../ports/inventory-report.reader';
import { effectiveSortName } from '../services/effective-name-sort';
import { InventoryItemNameResolver } from '../services/inventory-item-name.resolver';
import { InventoryReportScopeService } from '../services/inventory-report-scope.service';

/**
 * PLATCAT-ADOPT-1B: attach the live catalog name to each report row (adopted items
 * carry itemName = null). One batched catalog resolution per report (no N+1); mutates
 * and returns the same rows for convenience.
 */
async function attachCatalogNames(
  names: InventoryItemNameResolver,
  rows: StockOnHandReportRow[],
): Promise<StockOnHandReportRow[]> {
  const resolved = await names.resolveMany(
    rows.map((r) => ({ id: r.itemId, catalogItemId: r.catalogItemId })),
  );
  for (const r of rows) {
    r.catalogName = resolved.get(r.itemId) ?? null;
  }
  return rows;
}

/**
 * INV-SEARCH-1: order report rows by EFFECTIVE display name (resolved catalog name for
 * adopted items, else local itemName), with locationName as the tiebreaker. Must run
 * AFTER attachCatalogNames so adopted rows interleave instead of clustering — keeping the
 * report consistent with the item + stock lists. Mutates in place.
 */
function sortByEffectiveName(rows: StockOnHandReportRow[]): void {
  rows.sort(
    (a, b) =>
      effectiveSortName(a.itemName, a.catalogName).localeCompare(
        effectiveSortName(b.itemName, b.catalogName),
      ) || a.locationName.localeCompare(b.locationName),
  );
}

/** Shared request fields for every stock report (branch isolation is resolved). */
export interface StockReportRequest {
  organizationId: string;
  restaurantId: string | null;
  userId: string;
  /** Optional single-branch filter (validated against the caller's reach). */
  branchId?: string;
  locationId?: string;
  itemId?: string;
  categoryId?: string;
}

export interface StockOnHandReportResult {
  data: StockOnHandReportRow[];
  pagination: Paginated<StockOnHandReportRow>['pagination'];
  /** Total FIFO value over ALL matched rows (not just the page). */
  totalValuationAmount: number;
}

@Injectable()
export class GetStockOnHandReportUseCase {
  constructor(
    private readonly scope: InventoryReportScopeService,
    @Inject(INVENTORY_REPORT_READER) private readonly reader: InventoryReportReader,
    private readonly names: InventoryItemNameResolver,
  ) {}

  async execute(
    input: StockReportRequest & { lowStock?: boolean; page?: number; limit?: number },
  ): Promise<StockOnHandReportResult> {
    const scope = await this.scope.resolve(input);
    const query = normalizePagination({ page: input.page, limit: input.limit });
    const report = await this.reader.stockOnHand({
      restaurantId: input.restaurantId as string,
      branchIds: scope.branchIds,
      locationId: input.locationId,
      itemId: input.itemId,
      categoryId: input.categoryId,
      lowStockOnly: input.lowStock,
    });
    // INV-SEARCH-1: resolve names, sort by effective name, then paginate in the app layer.
    await attachCatalogNames(this.names, report.rows);
    sortByEffectiveName(report.rows);
    const { skip, take } = toSkipTake(query);
    const pageRows = report.rows.slice(skip, skip + take);
    const { pagination } = paginate(pageRows, report.total, query);
    return { data: pageRows, pagination, totalValuationAmount: report.totalValuationAmount };
  }
}

@Injectable()
export class GetValuationSummaryUseCase {
  constructor(
    private readonly scope: InventoryReportScopeService,
    @Inject(INVENTORY_REPORT_READER) private readonly reader: InventoryReportReader,
  ) {}

  async execute(input: StockReportRequest): Promise<ValuationSummary> {
    const scope = await this.scope.resolve(input);
    return this.reader.valuationSummary({
      restaurantId: input.restaurantId as string,
      branchIds: scope.branchIds,
      locationId: input.locationId,
      itemId: input.itemId,
      categoryId: input.categoryId,
    });
  }
}

@Injectable()
export class GetLowStockReportUseCase {
  constructor(
    private readonly scope: InventoryReportScopeService,
    @Inject(INVENTORY_REPORT_READER) private readonly reader: InventoryReportReader,
    private readonly names: InventoryItemNameResolver,
  ) {}

  async execute(input: StockReportRequest): Promise<StockOnHandReportRow[]> {
    const scope = await this.scope.resolve(input);
    const rows = await this.reader.lowStock({
      restaurantId: input.restaurantId as string,
      branchIds: scope.branchIds,
      locationId: input.locationId,
      itemId: input.itemId,
      categoryId: input.categoryId,
    });
    await attachCatalogNames(this.names, rows);
    sortByEffectiveName(rows);
    return rows;
  }
}

@Injectable()
export class GetNegativeStockReportUseCase {
  constructor(
    private readonly scope: InventoryReportScopeService,
    @Inject(INVENTORY_REPORT_READER) private readonly reader: InventoryReportReader,
    private readonly names: InventoryItemNameResolver,
  ) {}

  async execute(input: StockReportRequest): Promise<StockOnHandReportRow[]> {
    const scope = await this.scope.resolve(input);
    const rows = await this.reader.negativeStock({
      restaurantId: input.restaurantId as string,
      branchIds: scope.branchIds,
      locationId: input.locationId,
      itemId: input.itemId,
      categoryId: input.categoryId,
    });
    await attachCatalogNames(this.names, rows);
    sortByEffectiveName(rows);
    return rows;
  }
}
