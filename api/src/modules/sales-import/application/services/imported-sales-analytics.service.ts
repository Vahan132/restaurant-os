import { Inject, Injectable } from '@nestjs/common';
import {
  BRANCH_ACCESS_RESOLVER,
  BranchAccessResolver,
} from '../../../../shared/auth/branch-access.resolver';
import { BranchScope } from '../../domain/repositories/sales-import.repository';
import { InvalidDateRange, NoRestaurantInScope } from '../application.errors';
import { inclusiveDayRange, todayInTz } from '../imported-report-time.util';
import {
  IMPORTED_SALES_ANALYTICS_READER,
  ImportedItemRow,
  ImportedPaymentMethodRow,
  ImportedSalesAnalyticsReader,
  ImportedSalesFilter,
  ImportedSalesSummary,
  ImportedTimeSeriesBucket,
} from '../ports/imported-sales-analytics.reader';
import { resolveScope } from '../queries/list-import-batches.usecase';

export interface AnalyticsRequest {
  organizationId: string;
  restaurantId: string | null;
  userId: string;
  from?: string;
  to?: string;
}

/**
 * Orchestrates the IMPORTED-SALES analytics surface: resolves the caller's
 * branch scope + restaurant timezone, turns the optional date range into
 * boundaries, and delegates to the read port. Reads ONLY imported data —
 * structurally separate from the orders-based fiscal reports.
 */
@Injectable()
export class ImportedSalesAnalyticsService {
  constructor(
    @Inject(IMPORTED_SALES_ANALYTICS_READER)
    private readonly reader: ImportedSalesAnalyticsReader,
    @Inject(BRANCH_ACCESS_RESOLVER) private readonly branchAccess: BranchAccessResolver,
  ) {}

  private async resolve(
    req: AnalyticsRequest,
  ): Promise<{ filter: ImportedSalesFilter; timeZone: string }> {
    if (!req.restaurantId) {
      throw NoRestaurantInScope();
    }
    if (req.from && req.to && req.from > req.to) {
      throw InvalidDateRange();
    }
    const restaurantId = req.restaurantId;
    const scope: BranchScope = await resolveScope(
      this.branchAccess,
      req.organizationId,
      restaurantId,
      req.userId,
    );
    const timeZone = await this.reader.timezone(restaurantId);
    // Historical data: default to an open-ended window (epoch → today).
    const from = req.from ?? '1970-01-01';
    const to = req.to ?? todayInTz(timeZone);
    const { start, end } = inclusiveDayRange(from, to, timeZone);
    return { filter: { restaurantId, from: start, to: end, scope }, timeZone };
  }

  async summary(req: AnalyticsRequest): Promise<ImportedSalesSummary> {
    const { filter } = await this.resolve(req);
    return this.reader.summary(filter);
  }

  async byItem(req: AnalyticsRequest): Promise<ImportedItemRow[]> {
    const { filter } = await this.resolve(req);
    return this.reader.byItem(filter);
  }

  async timeSeries(
    req: AnalyticsRequest,
    groupBy: 'day' | 'week' | 'month',
  ): Promise<ImportedTimeSeriesBucket[]> {
    const { filter, timeZone } = await this.resolve(req);
    return this.reader.timeSeries(filter, groupBy, timeZone);
  }

  async byPaymentMethod(req: AnalyticsRequest): Promise<ImportedPaymentMethodRow[]> {
    const { filter } = await this.resolve(req);
    return this.reader.byPaymentMethod(filter);
  }
}
