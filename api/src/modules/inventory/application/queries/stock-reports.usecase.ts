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
import { InventoryReportScopeService } from '../services/inventory-report-scope.service';

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
  ) {}

  async execute(
    input: StockReportRequest & { lowStock?: boolean; page?: number; limit?: number },
  ): Promise<StockOnHandReportResult> {
    const scope = await this.scope.resolve(input);
    const query = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(query);
    const report = await this.reader.stockOnHand({
      restaurantId: input.restaurantId as string,
      branchIds: scope.branchIds,
      locationId: input.locationId,
      itemId: input.itemId,
      categoryId: input.categoryId,
      lowStockOnly: input.lowStock,
      skip,
      take,
    });
    const { pagination } = paginate(report.rows, report.total, query);
    return { data: report.rows, pagination, totalValuationAmount: report.totalValuationAmount };
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
  ) {}

  async execute(input: StockReportRequest): Promise<StockOnHandReportRow[]> {
    const scope = await this.scope.resolve(input);
    return this.reader.lowStock({
      restaurantId: input.restaurantId as string,
      branchIds: scope.branchIds,
      locationId: input.locationId,
      itemId: input.itemId,
      categoryId: input.categoryId,
    });
  }
}

@Injectable()
export class GetNegativeStockReportUseCase {
  constructor(
    private readonly scope: InventoryReportScopeService,
    @Inject(INVENTORY_REPORT_READER) private readonly reader: InventoryReportReader,
  ) {}

  async execute(input: StockReportRequest): Promise<StockOnHandReportRow[]> {
    const scope = await this.scope.resolve(input);
    return this.reader.negativeStock({
      restaurantId: input.restaurantId as string,
      branchIds: scope.branchIds,
      locationId: input.locationId,
      itemId: input.itemId,
      categoryId: input.categoryId,
    });
  }
}
