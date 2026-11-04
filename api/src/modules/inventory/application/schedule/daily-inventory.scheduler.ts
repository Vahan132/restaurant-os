import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CloseInventoryDayUseCase } from '../queries/get-daily-inventory-report.usecase';

/**
 * DAILY-INV-1: hourly trigger (restaurants live in different timezones, so each
 * branch is closed in the first run after ITS local midnight). Also runs once
 * shortly after boot so a restarted server catches up on a missed night.
 *
 * NOTE: fires on every instance (cloud + branch hubs), like IdleExpiryScheduler.
 * The use-case is idempotent (one snapshot per branch/day), so this is harmless.
 */
@Injectable()
export class DailyInventoryScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(DailyInventoryScheduler.name);
  private running = false;

  constructor(private readonly closeDay: CloseInventoryDayUseCase) {}

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') return;
    const t = setTimeout(() => void this.run(), 60_000);
    t.unref?.();
  }

  @Cron('5 * * * *')
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const n = await this.closeDay.execute();
      if (n > 0) this.logger.log(`Froze ${n} end-of-day inventory report(s).`);
    } catch (err) {
      this.logger.error(`Daily inventory close failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
