import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { TableSession } from '../../domain/entities/table-session';
import {
  TABLE_SESSION_REPOSITORY,
  TableSessionRepository,
} from '../../domain/repositories/table-session.repository';
import {
  CrossBranchTableSession,
  NoRestaurantInScope,
  TableSessionNotFound,
} from '../application.errors';

export interface CloseTableSessionInput {
  restaurantId: string | null;
  branchId: string;
  sessionId: string;
  /** Staff member performing the close (for audit trail in later prompts). */
  userId: string;
}

/**
 * Staff clear / settled: OPEN|LOCKED -> CLOSED. Invalidates all participant
 * tokens (the aggregate clears the token hash on close).
 */
@Injectable()
export class CloseTableSessionUseCase implements UseCase<CloseTableSessionInput, TableSession> {
  constructor(
    @Inject(TABLE_SESSION_REPOSITORY) private readonly sessions: TableSessionRepository,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: CloseTableSessionInput): Promise<TableSession> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const session = await this.sessions.findById(input.restaurantId, input.sessionId);
    if (!session) {
      throw TableSessionNotFound();
    }
    if (session.branchId !== input.branchId) {
      throw CrossBranchTableSession();
    }
    session.close();
    await this.sessions.save(session);
    await this.events.publishFromAggregate(session);
    return session;
  }
}
