import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { NoRestaurantInScope } from '../application.errors';
import { DiscountsData, REPORTS_QUERY, ReportsQuery } from '../ports/reports-query.port';
import { inclusiveDayRange } from '../report-time.util';

export interface GetDiscountsReportInput {
  restaurantId: string | null;
  from: string;
  to: string;
}

@Injectable()
export class GetDiscountsReportUseCase implements UseCase<GetDiscountsReportInput, DiscountsData> {
  constructor(@Inject(REPORTS_QUERY) private readonly q: ReportsQuery) {}

  async execute(input: GetDiscountsReportInput): Promise<DiscountsData> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const tz = await this.q.timezone(input.restaurantId);
    const { start, end } = inclusiveDayRange(input.from, input.to, tz);
    return this.q.discounts(input.restaurantId, start, end);
  }
}
