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
  TableNotInRestaurant,
} from '../application.errors';
import {
  RESERVATION_SETTINGS_READER,
  ReservationSettingsReader,
} from '../ports/reservation-settings.reader';
import {
  RESERVATIONS_TABLE_READER,
  ReservationsTableReader,
} from '../ports/reservations-table.reader';

export interface AssignTableInput {
  restaurantId: string | null;
  reservationId: string;
  tableId: string;
}

/** Assign a table to the reservation (plan only — NO live table-status change). */
@Injectable()
export class AssignTableUseCase implements UseCase<AssignTableInput, Reservation> {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepository,
    @Inject(RESERVATION_SETTINGS_READER) private readonly settings: ReservationSettingsReader,
    @Inject(RESERVATIONS_TABLE_READER) private readonly tables: ReservationsTableReader,
  ) {}

  async execute(input: AssignTableInput): Promise<Reservation> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const settings = await this.settings.get(input.restaurantId);
    if (!settings.enableReservations) {
      throw ReservationsDisabled();
    }
    const reservation = await this.reservations.findById(input.restaurantId, input.reservationId);
    if (!reservation) {
      throw ReservationNotFound();
    }
    const status = await this.tables.findTableStatus(input.restaurantId, input.tableId);
    if (status === null) {
      throw TableNotInRestaurant();
    }
    reservation.assignTable(input.tableId);
    await this.reservations.save(reservation);
    return reservation;
  }
}
