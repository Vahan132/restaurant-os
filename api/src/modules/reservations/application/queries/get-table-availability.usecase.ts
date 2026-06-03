import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  RESERVATION_REPOSITORY,
  ReservationRepository,
} from '../../domain/repositories/reservation.repository';
import { NoRestaurantInScope } from '../application.errors';
import { TableAvailabilityResponse } from '../dto/responses';
import {
  RESERVATIONS_TABLE_READER,
  ReservationsTableReader,
} from '../ports/reservations-table.reader';

export interface GetTableAvailabilityInput {
  restaurantId: string | null;
  windowStart: Date;
  windowEnd: Date;
}

/**
 * For each active table: its live status + the active reservations whose
 * [reservedAt, reservedAt+duration) overlaps the window. MVP: informational only
 * — assigning a table does NOT block it for the window (no booking enforcement).
 */
@Injectable()
export class GetTableAvailabilityUseCase implements UseCase<
  GetTableAvailabilityInput,
  TableAvailabilityResponse[]
> {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepository,
    @Inject(RESERVATIONS_TABLE_READER) private readonly tables: ReservationsTableReader,
  ) {}

  async execute(input: GetTableAvailabilityInput): Promise<TableAvailabilityResponse[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const startMs = input.windowStart.getTime();
    const tables = await this.tables.listActiveTables(input.restaurantId);
    const candidates = await this.reservations.findActiveWithTableBefore(
      input.restaurantId,
      input.windowEnd,
    );
    // keep only reservations whose [reservedAt, +duration) actually overlaps the window
    const overlapping = candidates.filter((r) => {
      const end = r.reservedAt.getTime() + r.durationMinutes * 60_000;
      return end > startMs;
    });

    const byTable = new Map<string, typeof overlapping>();
    for (const r of overlapping) {
      if (!r.tableId) {
        continue;
      }
      const arr = byTable.get(r.tableId) ?? [];
      arr.push(r);
      byTable.set(r.tableId, arr);
    }

    return tables.map((t) => ({
      tableId: t.id,
      name: t.name,
      status: t.status,
      reservations: (byTable.get(t.id) ?? [])
        .sort((a, b) => a.reservedAt.getTime() - b.reservedAt.getTime())
        .map((r) => ({
          reservationId: r.id,
          customerName: r.customerName,
          reservedAt: r.reservedAt.toISOString(),
          durationMinutes: r.durationMinutes,
          guestCount: r.guestCount,
          status: r.status,
        })),
    }));
  }
}
