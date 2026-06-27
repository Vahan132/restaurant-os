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

export interface CancelReservationInput {
  restaurantId: string | null;
  branchId: string;
  reservationId: string;
  reason?: string | null;
  actorUserId?: string | null;
}

/** -> CANCELLED. Auto mode: free the table if it was RESERVED for this plan. */
@Injectable()
export class CancelReservationUseCase implements UseCase<CancelReservationInput, Reservation> {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepository,
    @Inject(RESERVATION_SETTINGS_READER) private readonly settings: ReservationSettingsReader,
    private readonly tableSync: ReservationTableSync,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: CancelReservationInput): Promise<Reservation> {
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
    reservation.cancel(input.reason ?? null, input.actorUserId ?? null);
    await this.tableSync.onReleased(input.restaurantId, reservation.tableId);
    await this.reservations.save(reservation);
    await this.events.publishFromAggregate(reservation);
    return reservation;
  }
}
