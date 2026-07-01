import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { CreateReservationUseCase } from '../../../reservations/application/commands/create-reservation.usecase';
import { GetBookableSlotsUseCase } from '../../../reservations/application/queries/get-bookable-slots.usecase';
import { PUBLIC_RESERVATION_ACTOR } from '../../../reservations/application/commands/submit-public-reservation.usecase';
import { ReservationSource } from '../../../reservations/domain/enums';
import {
  BRANCH_PUBLIC_REPOSITORY,
  BranchPublicRepository,
} from '../../domain/repositories/branch-public.repository';
import {
  CONSUMER_PROFILE_READER,
  ConsumerProfileReader,
} from '../../domain/repositories/consumer-profile.reader';
import {
  BranchNotListedError,
  ReservationsNotPublicError,
  SlotUnavailableError,
} from '../../domain/consumer.errors';
import { resolveOpenWindows } from '../booking-hours.util';
import { ConsumerReservationConfirmationResponse } from '../dto/booking-saved.dto';

export interface CreateConsumerReservationInput {
  customerAccountId: string;
  branchId: string;
  date: string; // YYYY-MM-DD (the slot's local day)
  time: string; // ISO-8601, taken verbatim from the slots endpoint
  partySize: number;
  note?: string | null;
}

/**
 * Consumer booking (AUTH). Enters the EXISTING PENDING → staff-confirm flow via
 * CreateReservationUseCase, stamped with consumerId. Name/phone come from the
 * verified profile (never re-entered). The slot is re-validated against the live
 * engine derivation right before writing, so a taken slot surfaces SLOT_UNAVAILABLE
 * (no client-trusted availability).
 */
@Injectable()
export class CreateConsumerReservationUseCase
  implements UseCase<CreateConsumerReservationInput, ConsumerReservationConfirmationResponse>
{
  constructor(
    @Inject(BRANCH_PUBLIC_REPOSITORY) private readonly branches: BranchPublicRepository,
    @Inject(CONSUMER_PROFILE_READER) private readonly profiles: ConsumerProfileReader,
    private readonly getSlots: GetBookableSlotsUseCase,
    private readonly createReservation: CreateReservationUseCase,
  ) {}

  async execute(
    input: CreateConsumerReservationInput,
  ): Promise<ConsumerReservationConfirmationResponse> {
    const ctx = await this.branches.loadBookingContext(input.branchId);
    if (!ctx) {
      throw new BranchNotListedError();
    }
    if (!ctx.reservationsPublic) {
      throw new ReservationsNotPublicError();
    }

    const reservedAt = new Date(input.time);
    if (Number.isNaN(reservedAt.getTime())) {
      throw new SlotUnavailableError();
    }

    // Re-derive against the live engine: the chosen instant must be a CURRENTLY
    // available slot. This is what rejects a double-booked / closed / past time.
    const openWindows = resolveOpenWindows(input.date, ctx.hours, ctx.timezone);
    const slots = await this.getSlots.execute({
      restaurantId: ctx.restaurantId,
      branchId: ctx.branchId,
      openWindows,
      partySize: input.partySize,
    });
    const target = reservedAt.getTime();
    const isBookable = slots.some((s) => s.startMs === target && s.available);
    if (!isBookable) {
      throw new SlotUnavailableError();
    }

    // Name/phone from the verified profile — not re-entered by the consumer.
    const contact = await this.profiles.getContact(input.customerAccountId);

    const reservation = await this.createReservation.execute({
      restaurantId: ctx.restaurantId,
      branchId: ctx.branchId,
      createdByUserId: PUBLIC_RESERVATION_ACTOR,
      customerName: contact?.name ?? 'Guest',
      customerPhone: contact?.phone ?? '',
      guestCount: input.partySize,
      reservedAt,
      source: ReservationSource.PUBLIC,
      customerNote: input.note ?? null,
      consumerId: input.customerAccountId,
    });

    return {
      reservationId: reservation.id,
      status: reservation.status,
      reservedAt: reservation.reservedAt.toISOString(),
      branchId: ctx.branchId,
    };
  }
}
