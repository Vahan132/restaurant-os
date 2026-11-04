import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  TABLE_SESSION_REPOSITORY,
  TableSessionRepository,
} from '../../domain/repositories/table-session.repository';

export interface TouchTableSessionInput {
  restaurantId: string;
  sessionId: string;
}

/**
 * Bump a session's lastActivityAt (keeps it out of the idle sweep). Used cross-
 * module by ORDER-2 ConfirmPayment after a successful prepayment. No-op-safe: a
 * terminal session throws inside the aggregate, which the caller ignores.
 */
@Injectable()
export class TouchTableSessionUseCase implements UseCase<TouchTableSessionInput, void> {
  constructor(
    @Inject(TABLE_SESSION_REPOSITORY) private readonly sessions: TableSessionRepository,
  ) {}

  async execute(input: TouchTableSessionInput): Promise<void> {
    const session = await this.sessions.findById(input.restaurantId, input.sessionId);
    if (!session || session.isTerminal()) {
      return;
    }
    session.touchActivity();
    await this.sessions.save(session);
  }
}
