import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { NoRestaurantInScope } from '../application.errors';
import { ItemRow, REPORTS_QUERY, ReportsQuery } from '../ports/reports-query.port';
import { inclusiveDayRange } from '../report-time.util';

export interface GetSalesByItemInput {
  restaurantId: string | null;
  from: string;
  to: string;
  /** BR-REPORTS-1: access-checked branch filter (omitted = restaurant-wide). */
  branchIds?: string[];
}

@Injectable()
export class GetSalesByItemUseCase implements UseCase<GetSalesByItemInput, ItemRow[]> {
  constructor(@Inject(REPORTS_QUERY) private readonly q: ReportsQuery) {}

  async execute(input: GetSalesByItemInput): Promise<ItemRow[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const tz = await this.q.timezone(input.restaurantId);
    const { start, end } = inclusiveDayRange(input.from, input.to, tz);
    return this.q.salesByItem(input.restaurantId, start, end, input.branchIds);
  }
}
