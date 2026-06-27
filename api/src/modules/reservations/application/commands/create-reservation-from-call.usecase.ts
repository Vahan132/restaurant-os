import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { Reservation } from '../../domain/entities/reservation';
import { ReservationSource } from '../../domain/enums';
import {
  MISSED_CALL_REPOSITORY,
  MissedCallRepository,
} from '../../domain/repositories/missed-call.repository';
import {
  RESERVATION_REPOSITORY,
  ReservationRepository,
} from '../../domain/repositories/reservation.repository';
import {
  MissedCallNotFound,
  NoRestaurantInScope,
  ReservationsDisabled,
} from '../application.errors';
import {
  RESERVATION_SETTINGS_READER,
  ReservationSettingsReader,
} from '../ports/reservation-settings.reader';

export interface CreateReservationFromCallInput {
  restaurantId: string | null;
  branchId: string;
  callId: string;
  actorUserId: string;
  customerName: string;
  guestCount: number;
  reservedAt: Date;
  customerNote?: string | null;
}

export interface CreateReservationFromCallResult {
  reservation: Reservation;
}

/**
 * Create a PENDING, source=PHONE reservation from a missed call: the customer
 * phone is prefilled from the call, the call is linked to the new reservation and
 * marked HANDLED. Gated by enableReservations (RESERVATIONS_DISABLED if off).
 */
@Injectable()
export class CreateReservationFromCallUseCase implements UseCase<
  CreateReservationFromCallInput,
  CreateReservationFromCallResult
> {
  constructor(
    @Inject(MISSED_CALL_REPOSITORY) private readonly missedCalls: MissedCallRepository,
    @Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepository,
    @Inject(RESERVATION_SETTINGS_READER) private readonly settings: ReservationSettingsReader,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: CreateReservationFromCallInput): Promise<CreateReservationFromCallResult> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const call = await this.missedCalls.findById(input.restaurantId, input.branchId, input.callId);
    if (!call) {
      throw MissedCallNotFound();
    }
    const settings = await this.settings.get(input.restaurantId);
    if (!settings.enableReservations) {
      throw ReservationsDisabled();
    }

    const reservation = Reservation.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      // The reservation inherits the active branch (== the call's branch, since the
      // call is scoped to that branch). The call's branch came from its registered
      // device. TODO(BR-7): when a call can span branches, derive the target branch
      // explicitly rather than inheriting the active POS branch.
      branchId: input.branchId,
      customerName: input.customerName,
      customerPhone: call.phoneNumber,
      guestCount: input.guestCount,
      reservedAt: input.reservedAt,
      source: ReservationSource.PHONE,
      customerNote: input.customerNote ?? null,
      createdByUserId: input.actorUserId,
    });
    await this.reservations.create(reservation);
    await this.events.publishFromAggregate(reservation);

    call.linkReservation(reservation.id, input.actorUserId);
    await this.missedCalls.save(call);

    return { reservation };
  }
}
