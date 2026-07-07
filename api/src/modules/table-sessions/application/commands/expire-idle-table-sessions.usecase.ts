import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import {
  TABLE_SESSION_REPOSITORY,
  TableSessionRepository,
} from '../../domain/repositories/table-session.repository';

export interface ExpireIdleTableSessionsInput {
  /** Override "now" (tests). Defaults to the wall clock. */
  now?: Date;
  /** Max sessions per batch. */
  batchLimit?: number;
  /** Safety cap on total batches per run. */
  maxBatches?: number;
}

export interface ExpireIdleTableSessionsResult {
  expired: number;
}

/**
 * Idle sweep: any non-terminal session whose lastActivityAt is older than its
 * branch's idleExpiryMinutes -> EXPIRED. The transition runs through the
 * aggregate; persistExpiry is a conditional write so the sweep is IDEMPOTENT and
 * safe under concurrent instances (cloud + branch hubs).
 *
 * NOTE: no leader election. Concurrent sweeps are harmless (conditional writes
 * mean only one run flips a given row). If multi-instance sweeps prove wasteful,
 * later hardening is a Redis lock or a single-owner env gate — not needed now.
 */
@Injectable()
export class ExpireIdleTableSessionsUseCase
  implements UseCase<ExpireIdleTableSessionsInput, ExpireIdleTableSessionsResult>
{
  constructor(
    @Inject(TABLE_SESSION_REPOSITORY) private readonly sessions: TableSessionRepository,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: ExpireIdleTableSessionsInput = {}): Promise<ExpireIdleTableSessionsResult> {
    const now = input.now ?? new Date();
    const batchLimit = input.batchLimit ?? 200;
    const maxBatches = input.maxBatches ?? 50;

    let expired = 0;
    for (let batch = 0; batch < maxBatches; batch++) {
      const candidates = await this.sessions.findIdleBatch(now, batchLimit);
      if (candidates.length === 0) {
        break;
      }
      for (const session of candidates) {
        session.expire(now);
        const flipped = await this.sessions.persistExpiry(session);
        if (flipped) {
          expired++;
          await this.events.publishFromAggregate(session);
        } else {
          // A concurrent sweep already expired it; discard its events.
          session.clearDomainEvents();
        }
      }
      if (candidates.length < batchLimit) {
        break;
      }
    }
    return { expired };
  }
}
