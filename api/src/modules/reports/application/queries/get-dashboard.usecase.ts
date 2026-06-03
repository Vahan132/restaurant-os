import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { NoRestaurantInScope } from '../application.errors';
import { DashboardData, REPORTS_QUERY, ReportsQuery } from '../ports/reports-query.port';
import { todayInTz, zonedDayRange } from '../report-time.util';

export interface GetDashboardInput {
  restaurantId: string | null;
}

/** Today's operational snapshot (revenue, counts, top items, recent orders). */
@Injectable()
export class GetDashboardUseCase implements UseCase<GetDashboardInput, DashboardData> {
  constructor(@Inject(REPORTS_QUERY) private readonly q: ReportsQuery) {}

  async execute(input: GetDashboardInput): Promise<DashboardData> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const tz = await this.q.timezone(input.restaurantId);
    const { start, end } = zonedDayRange(todayInTz(tz), tz);
    return this.q.dashboard(input.restaurantId, start, end);
  }
}
