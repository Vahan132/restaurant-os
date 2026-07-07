import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { TableSession } from '../../domain/entities/table-session';
import { NON_TERMINAL_TABLE_SESSION_STATES, TableSessionState } from '../../domain/enums';
import { ActiveTableSessionConflictError } from '../../domain/table-sessions.errors';
import { TableSessionRepository } from '../../domain/repositories/table-session.repository';
import { TableSessionMapper, TableSessionRow } from './table-session.mapper';

const NON_TERMINAL: TableSessionState[] = [...NON_TERMINAL_TABLE_SESSION_STATES];

@Injectable()
export class PrismaTableSessionRepository implements TableSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveByTable(
    restaurantId: string,
    branchId: string,
    tableId: string,
  ): Promise<TableSession | null> {
    const row = await this.prisma.tableSession.findFirst({
      where: { restaurantId, branchId, tableId, state: { in: NON_TERMINAL } },
    });
    return row ? TableSessionMapper.toDomain(row) : null;
  }

  async findById(restaurantId: string, id: string): Promise<TableSession | null> {
    const row = await this.prisma.tableSession.findFirst({ where: { id, restaurantId } });
    return row ? TableSessionMapper.toDomain(row) : null;
  }

  async create(session: TableSession): Promise<void> {
    try {
      await this.prisma.tableSession.create({ data: TableSessionMapper.toCreateRow(session) });
    } catch (err) {
      // P2002 = unique violation. The partial unique index (branchId, tableId)
      // WHERE non-terminal rejects a second active session for the table.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ActiveTableSessionConflictError();
      }
      throw err;
    }
  }

  async save(session: TableSession): Promise<void> {
    await this.prisma.tableSession.updateMany({
      where: { id: session.id, restaurantId: session.restaurantId },
      data: TableSessionMapper.toUpdateRow(session),
    });
  }

  /**
   * Non-terminal sessions whose lastActivityAt is older than their branch's
   * idleExpiryMinutes. The per-row threshold lives on the branch, so this is a
   * raw join with an interval arithmetic; the transition itself runs through the
   * aggregate + persistExpiry (never here).
   */
  async findIdleBatch(now: Date, limit: number): Promise<TableSession[]> {
    const rows = await this.prisma.$queryRaw<TableSessionRow[]>(Prisma.sql`
      SELECT ts.*
      FROM "table_sessions" ts
      JOIN "branches" b ON b."id" = ts."branchId"
      WHERE ts."state" IN ('PENDING_CONFIRM', 'OPEN', 'LOCKED')
        AND ts."lastActivityAt" < (${now}::timestamp - (b."orderingIdleExpiryMinutes" * INTERVAL '1 minute'))
      ORDER BY ts."lastActivityAt" ASC
      LIMIT ${limit}
    `);
    return rows.map((r) => TableSessionMapper.toDomain(r));
  }

  /**
   * Conditional EXPIRED flip: updates the row ONLY if it is still non-terminal.
   * Returns true iff this call performed the transition (idempotent + safe under
   * concurrent sweeps).
   */
  async persistExpiry(session: TableSession): Promise<boolean> {
    const res = await this.prisma.tableSession.updateMany({
      where: {
        id: session.id,
        restaurantId: session.restaurantId,
        state: { in: NON_TERMINAL },
      },
      data: {
        state: TableSessionState.EXPIRED,
        tokenHash: session.tokenHash,
        closedAt: session.closedAt,
        lastActivityAt: session.lastActivityAt,
        updatedAt: session.updatedAt,
      },
    });
    return res.count === 1;
  }
}
