import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { OrdersReservationReader } from '../../application/ports/reservation-conflict.reader';

/** Non-terminal reservation statuses — a reservation in one of these may still hold a table. */
const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED', 'ARRIVED', 'SEATED'] as const;

/** Reads reservation holds on a table (orders module's view of the reservations context). */
@Injectable()
export class PrismaOrdersReservationReader implements OrdersReservationReader {
  constructor(private readonly prisma: PrismaService) {}

  async hasActiveReservationHold(
    restaurantId: string,
    branchId: string,
    tableId: string,
    at: Date,
  ): Promise<boolean> {
    // Candidates: active reservations assigned to this table that have already
    // started (reservedAt <= at). The application-side overlap check below then
    // keeps only those whose window has not yet ended.
    const holds = await this.prisma.reservation.findMany({
      where: {
        restaurantId,
        branchId,
        tableId,
        deletedAt: null,
        status: { in: [...ACTIVE_STATUSES] },
        reservedAt: { lte: at },
      },
      select: { reservedAt: true, durationMinutes: true },
    });
    const atMs = at.getTime();
    return holds.some((r) => r.reservedAt.getTime() + r.durationMinutes * 60_000 > atMs);
  }
}
