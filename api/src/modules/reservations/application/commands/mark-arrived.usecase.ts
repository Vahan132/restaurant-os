import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
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
import { ReservationTableSync } from '../services/reservation-table-sync';

export interface MarkArrivedInput {
  restaurantId: string | null;
  branchId: string;
  reservationId: string;
}

/** CONFIRMED -> ARRIVED. Auto mode: hold an AVAILABLE assigned table as RESERVED. */
@Injectable()
export class MarkArrivedUseCase implements UseCase<MarkArrivedInput, Reservation> {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepository,
    @Inject(RESERVATION_SETTINGS_READER) private readonly settings: ReservationSettingsReader,
    private readonly tableSync: ReservationTableSync,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: MarkArrivedInput): Promise<Reservation> {
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
    reservation.markArrived();
    await this.tableSync.onArrived(input.restaurantId, reservation.tableId);
    await this.reservations.save(reservation);
    await this.events.publishFromAggregate(reservation);
    return reservation;
  }
}
