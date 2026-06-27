import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { Reservation } from '../../domain/entities/reservation';
import { ReservationSource } from '../../domain/enums';
import {
  RESERVATION_REPOSITORY,
  ReservationRepository,
} from '../../domain/repositories/reservation.repository';
import {
  ReservationsDisabled,
  ReservationRateLimited,
  ReservationTimeInvalid,
} from '../application.errors';
import {
  RESERVATION_SETTINGS_READER,
  ReservationSettingsReader,
} from '../ports/reservation-settings.reader';

/**
 * Synthetic actor id recorded as `createdByUserId` for self-service public
 * bookings — there is no authenticated user on the public surface. It is a plain
 * marker (the column has no FK), never a real user id.
 */
export const PUBLIC_RESERVATION_ACTOR = 'PUBLIC';

/** Anti-abuse: max PUBLIC reservations per phone within the rolling window. */
const PUBLIC_PHONE_WINDOW_MS = 60 * 60_000; // 1 hour
const PUBLIC_PHONE_MAX_IN_WINDOW = 5;

export interface SubmitPublicReservationInput {
  restaurantId: string;
  /** BR-9: the resolved branch (from the URL slug; validated active by the guard). */
  branchId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  guestCount: number;
  reservedAt: Date;
  customerNote?: string | null;
}

export interface SubmitPublicReservationResult {
  reservationId: string;
  status: string;
  reservedAt: Date;
}

/**
 * Public request-to-book. Creates a PENDING, source=PUBLIC reservation (NOT
 * auto-confirmed; the MVP has no live availability holds). Gated by
 * enableReservations; rate-limited per phone in addition to the per-IP throttle
 * applied at the controller.
 */
@Injectable()
export class SubmitPublicReservationUseCase implements UseCase<
  SubmitPublicReservationInput,
  SubmitPublicReservationResult
> {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepository,
    @Inject(RESERVATION_SETTINGS_READER) private readonly settings: ReservationSettingsReader,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: SubmitPublicReservationInput): Promise<SubmitPublicReservationResult> {
    const settings = await this.settings.get(input.restaurantId);
    if (!settings.enableReservations) {
      throw ReservationsDisabled();
    }

    // BR-9: the branch is resolved upstream from the URL slug and validated
    // (active, belongs to the restaurant) by PublicRestaurantResolverGuard.
    const branchId = input.branchId;

    // Must be a valid time strictly in the future.
    if (
      !(input.reservedAt instanceof Date) ||
      Number.isNaN(input.reservedAt.getTime()) ||
      input.reservedAt.getTime() <= Date.now()
    ) {
      throw ReservationTimeInvalid();
    }

    // Per-phone rate limit (in addition to the per-IP throttle on the route).
    const since = new Date(Date.now() - PUBLIC_PHONE_WINDOW_MS);
    const recent = await this.reservations.countRecentBySourceAndPhone(
      input.restaurantId,
      branchId,
      ReservationSource.PUBLIC,
      input.customerPhone,
      since,
    );
    if (recent >= PUBLIC_PHONE_MAX_IN_WINDOW) {
      throw ReservationRateLimited();
    }

    const reservation = Reservation.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      branchId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail ?? null,
      guestCount: input.guestCount,
      reservedAt: input.reservedAt,
      source: ReservationSource.PUBLIC,
      customerNote: input.customerNote ?? null,
      createdByUserId: PUBLIC_RESERVATION_ACTOR,
    });
    await this.reservations.create(reservation);
    await this.events.publishFromAggregate(reservation);

    return {
      reservationId: reservation.id,
      status: reservation.status,
      reservedAt: reservation.reservedAt,
    };
  }
}
