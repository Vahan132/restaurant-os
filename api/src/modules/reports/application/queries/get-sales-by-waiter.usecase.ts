import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { NoRestaurantInScope } from '../application.errors';
import { WaiterRow, REPORTS_QUERY, ReportsQuery } from '../ports/reports-query.port';
import { inclusiveDayRange } from '../report-time.util';

export interface GetSalesByWaiterInput {
  restaurantId: string | null;
  from: string;
  to: string;
  /** BR-REPORTS-1: access-checked branch filter (omitted = restaurant-wide). */
  branchIds?: string[];
}

@Injectable()
export class GetSalesByWaiterUseCase implements UseCase<GetSalesByWaiterInput, WaiterRow[]> {
  constructor(@Inject(REPORTS_QUERY) private readonly q: ReportsQuery) {}

  async execute(input: GetSalesByWaiterInput): Promise<WaiterRow[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const tz = await this.q.timezone(input.restaurantId);
    const { start, end } = inclusiveDayRange(input.from, input.to, tz);
    return this.q.salesByWaiter(input.restaurantId, start, end, input.branchIds);
  }
}
