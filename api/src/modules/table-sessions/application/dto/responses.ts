import { ApiProperty } from '@nestjs/swagger';
import { TableSession } from '../../domain/entities/table-session';
import { TableSessionView } from '../queries/get-table-session-view.usecase';
import { OpenOrJoinTableSessionResult } from '../commands/open-or-join-table-session.usecase';

const STATES = ['PENDING_CONFIRM', 'OPEN', 'LOCKED', 'CLOSED', 'EXPIRED'];
const FLOWS = ['PREPAYMENT', 'PAY_AT_END'];
const CHANNELS = ['QR_WEB', 'APP'];

export class AttachedOrderStatusResponse {
  @ApiProperty() orderId!: string;
  @ApiProperty() orderNumber!: number;
  @ApiProperty({ enum: STATES, description: 'Order status (order enum, not session).' })
  status!: string;
}

/**
 * QR-web open-or-join result. `token` is the opaque reattach token, present ONLY
 * when a session was freshly created (returned exactly once); null on join.
 * Deliberately free of staff-only fields.
 */
export class OpenTableSessionResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: STATES }) state!: string;
  @ApiProperty({ enum: FLOWS }) flow!: string;
  @ApiProperty({ enum: CHANNELS }) channel!: string;
  @ApiProperty({ nullable: true, type: String, description: 'Reattach token; only on create.' })
  token!: string | null;

  static from(result: OpenOrJoinTableSessionResult): OpenTableSessionResponse {
    const s = result.session;
    return {
      id: s.id,
      state: s.state,
      flow: s.flow,
      channel: s.channel,
      token: result.plaintextToken,
    };
  }
}

/**
 * QR-web table-scoped view. Table-scoped by explicit decision (anyone scanning an
 * active table sees its order list/status), but NO token, consumer identity, or
 * staff timestamps are exposed here.
 */
export class PublicTableSessionViewResponse {
  @ApiProperty({ description: 'Whether an active (non-terminal) session exists for this table.' })
  active!: boolean;
  @ApiProperty({ nullable: true, type: String }) id!: string | null;
  @ApiProperty({ nullable: true, enum: STATES }) state!: string | null;
  @ApiProperty({ nullable: true, enum: FLOWS }) flow!: string | null;
  @ApiProperty({ nullable: true, enum: CHANNELS }) channel!: string | null;
  @ApiProperty({ type: [AttachedOrderStatusResponse] }) orders!: AttachedOrderStatusResponse[];

  static from(view: TableSessionView): PublicTableSessionViewResponse {
    const s = view.session;
    return {
      active: s !== null,
      id: s?.id ?? null,
      state: s?.state ?? null,
      flow: s?.flow ?? null,
      channel: s?.channel ?? null,
      orders: view.orders,
    };
  }
}

/** Staff view of a table session (adds handling/timestamps). No token is ever exposed. */
export class StaffTableSessionResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: STATES }) state!: string;
  @ApiProperty({ enum: FLOWS }) flow!: string;
  @ApiProperty({ enum: CHANNELS }) channel!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty() tableId!: string;
  @ApiProperty({ nullable: true, type: String }) consumerAccountId!: string | null;
  @ApiProperty() openedAt!: string;
  @ApiProperty() lastActivityAt!: string;
  @ApiProperty({ nullable: true, type: String }) closedAt!: string | null;

  static from(s: TableSession): StaffTableSessionResponse {
    return {
      id: s.id,
      state: s.state,
      flow: s.flow,
      channel: s.channel,
      branchId: s.branchId,
      tableId: s.tableId,
      consumerAccountId: s.consumerAccountId,
      openedAt: s.openedAt.toISOString(),
      lastActivityAt: s.lastActivityAt.toISOString(),
      closedAt: s.closedAt ? s.closedAt.toISOString() : null,
    };
  }
}

/** Staff table-scoped view: the active session (if any) + attached order statuses. */
export class StaffTableSessionViewResponse {
  @ApiProperty() active!: boolean;
  @ApiProperty({ nullable: true, type: StaffTableSessionResponse })
  session!: StaffTableSessionResponse | null;
  @ApiProperty({ type: [AttachedOrderStatusResponse] }) orders!: AttachedOrderStatusResponse[];

  static from(view: TableSessionView): StaffTableSessionViewResponse {
    return {
      active: view.session !== null,
      session: view.session ? StaffTableSessionResponse.from(view.session) : null,
      orders: view.orders,
    };
  }
}
