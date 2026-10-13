import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Reservation } from '../../domain/entities/reservation';
import {
  RESERVATION_REPOSITORY,
  ReservationRepository,
} from '../../domain/repositories/reservation.repository';
import {
  NoRestaurantInScope,
  ReservationNotFound,
  ReservationsDisabled,
  TableAlreadyReserved,
} from '../application.errors';
import {
  RESERVATION_SETTINGS_READER,
  ReservationSettingsReader,
} from '../ports/reservation-settings.reader';
import { tableHasOverlappingReservation } from '../services/reservation-overlap';

export interface UpdateReservationInput {
  restaurantId: string | null;
  branchId: string;
  reservationId: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string | null;
  guestCount?: number;
  reservedAt?: Date;
  durationMinutes?: number;
  notes?: string | null;
}

/** Edit reservation details (not when terminal). */
@Injectable()
export class UpdateReservationUseCase implements UseCase<UpdateReservationInput, Reservation> {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepository,
    @Inject(RESERVATION_SETTINGS_READER) private readonly settings: ReservationSettingsReader,
  ) {}

  async execute(input: UpdateReservationInput): Promise<Reservation> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const settings = await this.settings.get(input.restaurantId);
    if (!settings.enableReservations) {
      throw ReservationsDisabled();
    }
    const reservation = await this.reservations.findById(
      input.restaurantId,
      input.branchId,
      input.reservationId,
    );
    if (!reservation) {
      throw ReservationNotFound();
    }
    reservation.editDetails({
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      guestCount: input.guestCount,
      reservedAt: input.reservedAt,
      durationMinutes: input.durationMinutes,
      notes: input.notes,
    });
    // If the edit moved this reservation's time window (or it already holds a
    // table), re-check for a double-booking on that same table — the same
    // record-based overlap create/assign-table enforce. Excludes self so an
    // unrelated edit (e.g. renaming the customer) is never blocked. editDetails
    // has already applied the new reservedAt/durationMinutes above.
    if (
      reservation.tableId &&
      (input.reservedAt !== undefined || input.durationMinutes !== undefined)
    ) {
      const overlaps = await tableHasOverlappingReservation(
        this.reservations,
        input.restaurantId,
        input.branchId,
        reservation.tableId,
        reservation.reservedAt,
        reservation.durationMinutes,
        reservation.id,
      );
      if (overlaps) {
        throw TableAlreadyReserved();
      }
    }
    await this.reservations.save(reservation);
    return reservation;
  }
}
