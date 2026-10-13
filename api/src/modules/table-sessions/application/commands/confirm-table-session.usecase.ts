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

export interface ConfirmTableSessionInput {
  restaurantId: string | null;
  branchId: string;
  sessionId: string;
  /** Staff member performing the confirm (for audit trail in later prompts). */
  userId: string;
}

/**
 * Waiter confirm: PENDING_CONFIRM -> OPEN (the confirm-once binding). Once OPEN,
 * later app orders attach without re-confirmation (append mechanics land later).
 * Authorized via staff capability IAM at the controller.
 */
@Injectable()
export class ConfirmTableSessionUseCase implements UseCase<ConfirmTableSessionInput, TableSession> {
  constructor(
    @Inject(TABLE_SESSION_REPOSITORY) private readonly sessions: TableSessionRepository,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: ConfirmTableSessionInput): Promise<TableSession> {
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
    session.confirm();
    await this.sessions.save(session);
    await this.events.publishFromAggregate(session);
    return session;
  }
}
