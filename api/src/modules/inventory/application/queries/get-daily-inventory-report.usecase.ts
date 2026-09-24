import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { NoRestaurantInScope } from '../application.errors';
import { DAILY_INVENTORY_SOURCE, DailyInventorySource } from '../ports/daily-inventory.source';
import { ITEM_COST_TRACKER, ItemCostTracker } from '../ports/item-cost-tracker';
import {
  DailyInventoryReport,
  DailyInventoryReportService,
} from '../services/daily-inventory-report.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD minus one calendar day (pure date arithmetic, tz-independent). */
export function previousDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/**
 * DAILY-INV-1: the end-of-day inventory report for the active branch. Today (or a
 * future date) is computed live and flagged `inProgress`; a closed day is served
 * from its frozen nightly snapshot, generating + freezing it on first request if
 * the job has not run yet. `?refresh=true` re-freezes a closed day from the ledger.
 */
@Injectable()
export class GetDailyInventoryReportUseCase {
  constructor(
    @Inject(DAILY_INVENTORY_SOURCE) private readonly source: DailyInventorySource,
    private readonly builder: DailyInventoryReportService,
  ) {}

  async execute(input: {
    restaurantId: string | null;
    branchId: string;
    date?: string;
    refresh?: boolean;
  }): Promise<DailyInventoryReport> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    if (input.date && !DATE_RE.test(input.date)) {
      throw new BadRequestException({ code: 'INVALID_DATE', message: 'date must be YYYY-MM-DD.' });
    }
    const timezone = await this.source.restaurantTimezone(input.restaurantId);
    const today = this.builder.todayFor(timezone);
    const date = input.date ?? today;

    if (date >= today) {
      return this.builder.build(input.restaurantId, input.branchId, date, timezone);
    }
    if (!input.refresh) {
      const snap = await this.source.findSnapshot(input.branchId, date);
      if (snap) {
        return { ...(snap as DailyInventoryReport), frozen: true };
      }
    }
    const report = await this.builder.build(input.restaurantId, input.branchId, date, timezone);
    await this.source.saveSnapshot({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      businessDate: date,
      timezone,
      payload: report,
      generatedAt: new Date(report.generatedAt),
    });
    return { ...report, frozen: true };
  }
}

/**
 * DAILY-INV-1 nightly job body: for every active branch whose business day has
 * rolled over, reconcile ingredient/dish costs and freeze yesterday's report.
 * Idempotent (skips days that already have a snapshot).
 */
@Injectable()
export class CloseInventoryDayUseCase {
  private readonly logger = new Logger(CloseInventoryDayUseCase.name);

  constructor(
    @Inject(DAILY_INVENTORY_SOURCE) private readonly source: DailyInventorySource,
    @Inject(ITEM_COST_TRACKER) private readonly tracker: ItemCostTracker,
    private readonly builder: DailyInventoryReportService,
  ) {}

  async execute(now: Date = new Date()): Promise<number> {
    const branches = await this.source.scheduledBranches();
    let frozen = 0;
    for (const b of branches) {
      try {
        const yesterday = previousDate(this.builder.todayFor(b.timezone, now));
        if (await this.source.findSnapshot(b.branchId, yesterday)) continue;
        await this.tracker.reconcileBranch(b.restaurantId, b.branchId);
        const report = await this.builder.build(
          b.restaurantId,
          b.branchId,
          yesterday,
          b.timezone,
          now,
        );
        await this.source.saveSnapshot({
          restaurantId: b.restaurantId,
          branchId: b.branchId,
          businessDate: yesterday,
          timezone: b.timezone,
          payload: report,
          generatedAt: now,
        });
        frozen += 1;
      } catch (err) {
        this.logger.error(
          `Daily inventory close failed for branch ${b.branchId}: ${(err as Error).message}`,
        );
      }
    }
    return frozen;
  }
}
