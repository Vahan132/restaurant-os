import { TableSession as PrismaTableSession } from '@prisma/client';
import { TableSession } from '../../domain/entities/table-session';
import {
  TableSessionChannel,
  TableSessionFlow,
  TableSessionState,
} from '../../domain/enums';

/** Row shape returned by raw idle-sweep queries (columns are camelCase, quoted). */
export interface TableSessionRow {
  id: string;
  restaurantId: string;
  branchId: string;
  tableId: string;
  state: string;
  flow: string;
  channel: string;
  tokenHash: string;
  consumerAccountId: string | null;
  openedAt: Date;
  lastActivityAt: Date;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class TableSessionMapper {
  static toDomain(r: PrismaTableSession | TableSessionRow): TableSession {
    return TableSession.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      tableId: r.tableId,
      state: r.state as TableSessionState,
      flow: r.flow as TableSessionFlow,
      channel: r.channel as TableSessionChannel,
      tokenHash: r.tokenHash,
      consumerAccountId: r.consumerAccountId,
      openedAt: r.openedAt,
      lastActivityAt: r.lastActivityAt,
      closedAt: r.closedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }

  /** Full column set for insert. */
  static toCreateRow(s: TableSession) {
    return {
      id: s.id,
      restaurantId: s.restaurantId,
      branchId: s.branchId,
      tableId: s.tableId,
      state: s.state,
      flow: s.flow,
      channel: s.channel,
      tokenHash: s.tokenHash,
      consumerAccountId: s.consumerAccountId,
      openedAt: s.openedAt,
      lastActivityAt: s.lastActivityAt,
      closedAt: s.closedAt,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }

  /** Mutable columns for update (identity + immutable creation fields excluded). */
  static toUpdateRow(s: TableSession) {
    return {
      state: s.state,
      tokenHash: s.tokenHash,
      lastActivityAt: s.lastActivityAt,
      closedAt: s.closedAt,
      updatedAt: s.updatedAt,
    };
  }
}
