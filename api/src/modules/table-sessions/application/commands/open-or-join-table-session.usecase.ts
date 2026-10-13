import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { TableSession } from '../../domain/entities/table-session';
import { TableSessionChannel, TableSessionFlow } from '../../domain/enums';
import { decideSessionStart } from '../../domain/ordering-flow.policy';
import { ActiveTableSessionConflictError } from '../../domain/table-sessions.errors';
import {
  TABLE_SESSION_REPOSITORY,
  TableSessionRepository,
} from '../../domain/repositories/table-session.repository';
import { BranchOrderingPolicyNotFound, NoRestaurantInScope } from '../application.errors';
import {
  ORDERING_POLICY_READER,
  OrderingPolicyReader,
} from '../ports/ordering-policy.reader';
import {
  SESSION_TOKEN_SERVICE,
  SessionTokenService,
} from '../ports/session-token.service';

export interface OpenOrJoinTableSessionInput {
  restaurantId: string | null;
  branchId: string;
  tableId: string;
  channel: TableSessionChannel;
  /** APP only: chosen flow when the branch enables both. Ignored for QR_WEB. */
  requestedFlow?: TableSessionFlow;
  /** APP only: the verified consumer participant. Null for anonymous QR-web. */
  consumerAccountId?: string | null;
}

export interface OpenOrJoinTableSessionResult {
  session: TableSession;
  /**
   * The opaque session token — present ONLY when a session was freshly created
   * (returned exactly once). Null when an existing session was joined.
   */
  plaintextToken: string | null;
}

/**
 * Open-or-join: return the current non-terminal session for a (branch, table) or
 * create one. Enforces the single-active-session invariant (guard + partial
 * unique index) and the effective ordering policy, and sets the flow/initial
 * state from channel + config. Issues an opaque token on create only.
 */
@Injectable()
export class OpenOrJoinTableSessionUseCase
  implements UseCase<OpenOrJoinTableSessionInput, OpenOrJoinTableSessionResult>
{
  constructor(
    @Inject(TABLE_SESSION_REPOSITORY) private readonly sessions: TableSessionRepository,
    @Inject(ORDERING_POLICY_READER) private readonly policies: OrderingPolicyReader,
    @Inject(SESSION_TOKEN_SERVICE) private readonly tokens: SessionTokenService,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: OpenOrJoinTableSessionInput): Promise<OpenOrJoinTableSessionResult> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const restaurantId = input.restaurantId;

    // Join: an existing non-terminal session wins; joining bumps activity.
    const existing = await this.sessions.findActiveByTable(
      restaurantId,
      input.branchId,
      input.tableId,
    );
    if (existing) {
      existing.touchActivity();
      await this.sessions.save(existing);
      return { session: existing, plaintextToken: null };
    }

    // Decide flow + initial state from the EFFECTIVE policy (restaurant AND branch).
    const policy = await this.policies.get(restaurantId, input.branchId);
    if (!policy) {
      throw BranchOrderingPolicyNotFound();
    }
    const start = decideSessionStart(input.channel, input.requestedFlow, policy);

    const issued = this.tokens.generate();
    const session = TableSession.create({
      id: this.ids.generate(),
      restaurantId,
      branchId: input.branchId,
      tableId: input.tableId,
      flow: start.flow,
      channel: input.channel,
      initialState: start.initialState,
      tokenHash: issued.tokenHash,
      consumerAccountId: input.consumerAccountId ?? null,
    });

    try {
      await this.sessions.create(session);
    } catch (err) {
      if (err instanceof ActiveTableSessionConflictError) {
        // Lost a create race: the winner's session is now the active one. Return
        // it (join semantics) without issuing a token.
        const winner = await this.sessions.findActiveByTable(
          restaurantId,
          input.branchId,
          input.tableId,
        );
        if (winner) {
          return { session: winner, plaintextToken: null };
        }
      }
      throw err;
    }

    await this.events.publishFromAggregate(session);
    return { session, plaintextToken: issued.token };
  }
}
