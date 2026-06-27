import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Reservation } from '../../domain/entities/reservation';
import {
  RESERVATION_REPOSITORY,
  ReservationRepository,
} from '../../domain/repositories/reservation.repository';
import {
  CrossBranchReference,
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
  branchId: string;
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
    const reservation = await this.reservations.findById(
      input.restaurantId,
      input.branchId,
      input.reservationId,
    );
    if (!reservation) {
      throw ReservationNotFound();
    }
    const table = await this.tables.findTableRef(input.restaurantId, input.tableId);
    if (table === null) {
      throw TableNotInRestaurant();
    }
    // §6 intra-branch integrity: the assigned table must be in this reservation's branch.
    if (table.branchId !== reservation.branchId) {
      throw CrossBranchReference();
    }
    reservation.assignTable(input.tableId);
    await this.reservations.save(reservation);
    return reservation;
  }
}
