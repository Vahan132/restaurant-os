import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExpireIdleTableSessionsUseCase } from '../commands/expire-idle-table-sessions.usecase';

/**
 * Thin cron trigger for the idle sweep. Without this the ExpireIdleTableSessions
 * use-case would never run and sessions would silently never expire.
 *
 * NOTE: fires on every instance (no leader election). The use-case is idempotent
 * and batch-safe, so concurrent runs across the cloud + branch hubs are harmless.
 * If that proves wasteful, gate this with a Redis lock or a single-owner env flag
 * later — intentionally not built now.
 */
@Injectable()
export class IdleExpiryScheduler {
  private readonly logger = new Logger(IdleExpiryScheduler.name);

  constructor(private readonly expireIdle: ExpireIdleTableSessionsUseCase) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweep(): Promise<void> {
    try {
      const { expired } = await this.expireIdle.execute({});
      if (expired > 0) {
        this.logger.log(`Idle sweep expired ${expired} table session(s).`);
      }
    } catch (err) {
      // Never let a sweep failure crash the scheduler; log and move on.
      this.logger.error(`Idle sweep failed: ${(err as Error).message}`, (err as Error).stack);
    }
  }
}
