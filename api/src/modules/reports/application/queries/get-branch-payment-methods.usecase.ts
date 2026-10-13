import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { NoRestaurantInScope } from '../application.errors';
import { BranchPaymentMethodsData, REPORTS_QUERY, ReportsQuery } from '../ports/reports-query.port';
import { todayInTz, zonedDayRange } from '../report-time.util';

export interface GetBranchPaymentMethodsInput {
  restaurantId: string | null;
  /** The caller's validated ACTIVE branch (X-Branch-Id). */
  branchId: string;
  /** Business day (YYYY-MM-DD, restaurant tz). Defaults to today there. */
  date?: string | null;
}

export interface BranchPaymentMethodsResult extends BranchPaymentMethodsData {
  /** The business day actually reported on, echoed back for the UI header. */
  date: string;
  branchId: string;
}

/**
 * Cashier shift report: payment-method totals for ONE branch and ONE business
 * day. Deliberately narrower than the restaurant-wide by-payment-method report —
 * a cashier holds `reports:shift:view` at their branch only, so they can close
 * out their till without seeing other branches or the full reports suite.
 *
 * The day boundary is the restaurant's timezone, matching every other report, so
 * "today" on a terminal in another timezone still means the restaurant's today.
 */
@Injectable()
export class GetBranchPaymentMethodsUseCase implements UseCase<
  GetBranchPaymentMethodsInput,
  BranchPaymentMethodsResult
> {
  constructor(@Inject(REPORTS_QUERY) private readonly q: ReportsQuery) {}

  async execute(input: GetBranchPaymentMethodsInput): Promise<BranchPaymentMethodsResult> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const tz = await this.q.timezone(input.restaurantId);
    const date = input.date ?? todayInTz(tz);
    const { start, end } = zonedDayRange(date, tz);
    const data = await this.q.branchPaymentMethods(input.restaurantId, input.branchId, start, end);
    return { ...data, date, branchId: input.branchId };
  }
}
