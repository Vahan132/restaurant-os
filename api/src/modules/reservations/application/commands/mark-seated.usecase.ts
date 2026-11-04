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

export interface MarkSeatedInput {
  restaurantId: string | null;
  branchId: string;
  reservationId: string;
}

/** ARRIVED -> SEATED. Auto mode: occupy the assigned table (reject if DISABLED). */
@Injectable()
export class MarkSeatedUseCase implements UseCase<MarkSeatedInput, Reservation> {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepository,
    @Inject(RESERVATION_SETTINGS_READER) private readonly settings: ReservationSettingsReader,
    private readonly tableSync: ReservationTableSync,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: MarkSeatedInput): Promise<Reservation> {
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
    reservation.markSeated();
    await this.tableSync.onSeated(input.restaurantId, reservation.tableId);
    await this.reservations.save(reservation);
    await this.events.publishFromAggregate(reservation);
    return reservation;
  }
}
