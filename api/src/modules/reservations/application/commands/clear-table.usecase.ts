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
} from '../application.errors';
import {
  RESERVATION_SETTINGS_READER,
  ReservationSettingsReader,
} from '../ports/reservation-settings.reader';

export interface ClearTableInput {
  restaurantId: string | null;
  branchId: string;
  reservationId: string;
}

/** Clear the assigned table (plan only — NO live table-status change). */
@Injectable()
export class ClearTableUseCase implements UseCase<ClearTableInput, Reservation> {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepository,
    @Inject(RESERVATION_SETTINGS_READER) private readonly settings: ReservationSettingsReader,
  ) {}

  async execute(input: ClearTableInput): Promise<Reservation> {
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
    reservation.clearTable();
    await this.reservations.save(reservation);
    return reservation;
  }
}
