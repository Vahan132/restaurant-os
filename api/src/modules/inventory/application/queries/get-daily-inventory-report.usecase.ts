import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { NoRestaurantInScope } from '../application.errors';
import { DAILY_INVENTORY_SOURCE, DailyInventorySource } from '../ports/daily-inventory.source';
import { ITEM_COST_TRACKER, ItemCostTracker } from '../ports/item-cost-tracker';
import {
  DailyInventoryReport,
  DailyInventoryReportService,
} from '../services/daily-inventory-report.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MAX_RANGE_DAYS = 366;

/** Whole calendar days from a to b (YYYY-MM-DD). */
function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

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
    /** Range mode: [from .. to] inclusive business days. */
    from?: string;
    to?: string;
    refresh?: boolean;
  }): Promise<DailyInventoryReport> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    for (const d of [input.date, input.from, input.to]) {
      if (d && !DATE_RE.test(d)) {
        throw new BadRequestException({
          code: 'INVALID_DATE',
          message: 'Dates must be YYYY-MM-DD.',
        });
      }
    }
    const timezone = await this.source.restaurantTimezone(input.restaurantId);
    const today = this.builder.todayFor(timezone);

    if (input.from) {
      const to = input.to ?? input.from;
      if (to < input.from) {
        throw new BadRequestException({
          code: 'INVALID_DATE_RANGE',
          message: '`to` must be on or after `from`.',
        });
      }
      if (daysBetween(input.from, to) > MAX_RANGE_DAYS) {
        throw new BadRequestException({
          code: 'DATE_RANGE_TOO_LONG',
          message: `The range may span at most ${MAX_RANGE_DAYS} days.`,
        });
      }
      if (to !== input.from) {
        // Multi-day ranges are always computed live from the append-only ledger.
        return this.builder.buildRange(
          input.restaurantId,
          input.branchId,
          input.from,
          to,
          timezone,
        );
      }
      return this.execute({ ...input, date: input.from, from: undefined, to: undefined });
    }

    const date = input.date ?? today;

    if (date >= today) {
      return this.builder.build(input.restaurantId, input.branchId, date, timezone);
    }
    if (!input.refresh) {
      const snap = await this.source.findSnapshot(input.branchId, date);
      if (snap) {
        const frozen = snap as DailyInventoryReport;
        // Snapshots frozen before range support have no endDate.
        return { ...frozen, endDate: frozen.endDate ?? date, frozen: true };
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
