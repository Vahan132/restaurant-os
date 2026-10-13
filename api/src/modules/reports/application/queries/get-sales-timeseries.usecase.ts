import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { NoRestaurantInScope } from '../application.errors';
import { REPORTS_QUERY, ReportsQuery, TimeSeriesBucket } from '../ports/reports-query.port';
import { inclusiveDayRange } from '../report-time.util';

export interface GetSalesTimeSeriesInput {
  restaurantId: string | null;
  from: string;
  to: string;
  groupBy: 'day' | 'week' | 'month';
  /** BR-REPORTS-1: access-checked branch filter (omitted = restaurant-wide). */
  branchIds?: string[];
}

/** Revenue + order count per bucket (date_trunc-equivalent in restaurant tz). */
@Injectable()
export class GetSalesTimeSeriesUseCase implements UseCase<
  GetSalesTimeSeriesInput,
  TimeSeriesBucket[]
> {
  constructor(@Inject(REPORTS_QUERY) private readonly q: ReportsQuery) {}

  async execute(input: GetSalesTimeSeriesInput): Promise<TimeSeriesBucket[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const tz = await this.q.timezone(input.restaurantId);
    const { start, end } = inclusiveDayRange(input.from, input.to, tz);
    return this.q.salesTimeSeries(
      input.restaurantId,
      start,
      end,
      input.groupBy,
      tz,
      input.branchIds,
    );
  }
}
