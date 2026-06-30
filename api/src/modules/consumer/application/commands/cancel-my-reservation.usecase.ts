import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { CancelReservationUseCase } from '../../../reservations/application/commands/cancel-reservation.usecase';
import {
  CONSUMER_RESERVATION_REPOSITORY,
  ConsumerReservationRepository,
} from '../../domain/repositories/consumer-reservation.repository';
import {
  ReservationNotCancellableError,
  ReservationNotYoursError,
} from '../../domain/consumer.errors';
import { ConsumerActionAckResponse } from '../dto/booking-saved.dto';

/** Statuses a consumer may still self-cancel (must also be in the future). */
const CANCELLABLE_STATUSES = new Set(['PENDING', 'CONFIRMED', 'ARRIVED', 'SEATED']);

export interface CancelMyReservationInput {
  customerAccountId: string;
  reservationId: string;
}

/**
 * Consumer self-cancel (AUTH). Asserts the reservation belongs to this consumer
 * (404 RESERVATION_NOT_YOURS) and is still cancellable (409
 * RESERVATION_NOT_CANCELLABLE: terminal or elapsed), then routes through the REAL
 * CancelReservationUseCase so the table is freed exactly like a staff cancel.
 */
@Injectable()
export class CancelMyReservationUseCase
  implements UseCase<CancelMyReservationInput, ConsumerActionAckResponse>
{
  constructor(
    @Inject(CONSUMER_RESERVATION_REPOSITORY)
    private readonly reservations: ConsumerReservationRepository,
    private readonly cancelReservation: CancelReservationUseCase,
  ) {}

  async execute(input: CancelMyReservationInput): Promise<ConsumerActionAckResponse> {
    const owned = await this.reservations.findOwnership(input.reservationId);
    // Unknown OR not-mine both surface as NOT_YOURS (no existence enumeration).
    if (!owned || owned.consumerId !== input.customerAccountId) {
      throw new ReservationNotYoursError();
    }

    const cancellable =
      CANCELLABLE_STATUSES.has(owned.status) && owned.reservedAt.getTime() >= Date.now();
    if (!cancellable) {
      throw new ReservationNotCancellableError();
    }

    await this.cancelReservation.execute({
      restaurantId: owned.restaurantId,
      branchId: owned.branchId,
      reservationId: owned.reservationId,
      reason: 'Cancelled by guest',
      actorUserId: `CONSUMER:${input.customerAccountId}`,
    });

    return { success: true };
  }
}
