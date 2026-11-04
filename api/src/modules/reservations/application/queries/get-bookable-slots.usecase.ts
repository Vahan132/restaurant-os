import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  BookingOpenWindow,
  DerivedSlot,
  deriveBookableSlots,
} from '../../domain/services/slot-derivation';
import {
  RESERVATION_REPOSITORY,
  ReservationRepository,
} from '../../domain/repositories/reservation.repository';
import { NoRestaurantInScope } from '../application.errors';
import {
  RESERVATIONS_TABLE_READER,
  ReservationsTableReader,
} from '../ports/reservations-table.reader';

/**
 * Engine slot-derivation config. Conservative MVP defaults; if these ever become
 * per-restaurant they belong on RestaurantSettings, read here — never recomputed
 * by the consumer context or the app.
 */
export const SLOT_INTERVAL_MIN = 30;
export const TURN_TIME_MIN = 90; // matches Reservation default durationMinutes
export const LEAD_TIME_MIN = 60; // no same-hour bookings

export interface GetBookableSlotsInput {
  restaurantId: string | null;
  branchId: string;
  /** Branch-local opening hours already resolved to absolute [startMs, endMs). */
  openWindows: BookingOpenWindow[];
  partySize: number;
  /** Clock injection point (tests); defaults to now. */
  nowMs?: number;
}

/**
 * GetBookableSlots — the reservation engine's bookable-times derivation. Reads
 * seating capacity (active tables) + the day's active reservations, then applies
 * the pure {@link deriveBookableSlots} rules. The consumer slots endpoint calls
 * this; no slot math lives outside the reservation domain.
 */
@Injectable()
export class GetBookableSlotsUseCase implements UseCase<GetBookableSlotsInput, DerivedSlot[]> {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepository,
    @Inject(RESERVATIONS_TABLE_READER) private readonly tables: ReservationsTableReader,
  ) {}

  async execute(input: GetBookableSlotsInput): Promise<DerivedSlot[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    if (input.openWindows.length === 0) {
      return [];
    }

    const activeTables = await this.tables.listActiveTables(input.restaurantId, input.branchId);
    const totalSeats = activeTables.reduce((sum, t) => sum + t.seatCapacity, 0);
    const maxTableSeats = activeTables.reduce((max, t) => Math.max(max, t.seatCapacity), 0);

    const windowEnd = new Date(Math.max(...input.openWindows.map((w) => w.endMs)));
    const candidates = await this.reservations.findActiveStartingBefore(
      input.restaurantId,
      input.branchId,
      windowEnd,
    );

    return deriveBookableSlots({
      openWindows: input.openWindows,
      existing: candidates.map((r) => ({
        startMs: r.reservedAt.getTime(),
        durationMin: r.durationMinutes,
        guestCount: r.guestCount,
      })),
      capacity: { totalSeats, maxTableSeats },
      partySize: input.partySize,
      config: {
        slotIntervalMin: SLOT_INTERVAL_MIN,
        turnTimeMin: TURN_TIME_MIN,
        leadTimeMin: LEAD_TIME_MIN,
      },
      nowMs: input.nowMs ?? Date.now(),
    });
  }
}
