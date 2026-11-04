import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { TableSession } from '../../domain/entities/table-session';
import {
  TABLE_SESSION_REPOSITORY,
  TableSessionRepository,
} from '../../domain/repositories/table-session.repository';
import { NoRestaurantInScope } from '../application.errors';
import {
  AttachedOrderStatus,
  SESSION_ORDER_STATUS_READER,
  SessionOrderStatusReader,
} from '../ports/session-order-status.reader';

export interface GetTableSessionViewInput {
  restaurantId: string | null;
  branchId: string;
  tableId: string;
}

export interface TableSessionView {
  /** The current non-terminal session for the table, or null if none is active. */
  session: TableSession | null;
  /** Status of orders attached to that session (empty when no active session). */
  orders: AttachedOrderStatus[];
}

/**
 * Table-scoped read: the current non-terminal session for a (branch, table) and
 * its attached orders' status. No mutation.
 *
 * Accepted exposure (explicit decision): anyone scanning an active table sees
 * that table's order list/status. Intentional — table-scoped, not participant-
 * narrowed. Response DTOs still keep staff-only fields off the QR-web view.
 */
@Injectable()
export class GetTableSessionViewUseCase
  implements UseCase<GetTableSessionViewInput, TableSessionView>
{
  constructor(
    @Inject(TABLE_SESSION_REPOSITORY) private readonly sessions: TableSessionRepository,
    @Inject(SESSION_ORDER_STATUS_READER)
    private readonly orderStatuses: SessionOrderStatusReader,
  ) {}

  async execute(input: GetTableSessionViewInput): Promise<TableSessionView> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const session = await this.sessions.findActiveByTable(
      input.restaurantId,
      input.branchId,
      input.tableId,
    );
    if (!session) {
      return { session: null, orders: [] };
    }
    const orders = await this.orderStatuses.listBySession(input.restaurantId, session.id);
    return { session, orders };
  }
}
