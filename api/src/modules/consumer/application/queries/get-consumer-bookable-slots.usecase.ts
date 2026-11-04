import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { GetBookableSlotsUseCase } from '../../../reservations/application/queries/get-bookable-slots.usecase';
import {
  BRANCH_PUBLIC_REPOSITORY,
  BranchPublicRepository,
} from '../../domain/repositories/branch-public.repository';
import {
  BranchNotListedError,
  ReservationsNotPublicError,
} from '../../domain/consumer.errors';
import { resolveOpenWindows } from '../booking-hours.util';
import { ConsumerBookableSlotsResponse } from '../dto/booking-saved.dto';

export interface GetConsumerBookableSlotsInput {
  branchId: string;
  date: string; // YYYY-MM-DD
  partySize: number;
}

/**
 * Consumer bookable-slots — ANONYMOUS (the app shows availability pre-login). Only
 * orchestrates: asserts the branch is effectively listed (404 BRANCH_NOT_LISTED)
 * and reservationsPublic (409 RESERVATIONS_NOT_PUBLIC), resolves the branch's
 * public hours to absolute windows, then DELEGATES to the reservation engine's
 * GetBookableSlotsUseCase. No slot math here.
 */
@Injectable()
export class GetConsumerBookableSlotsUseCase
  implements UseCase<GetConsumerBookableSlotsInput, ConsumerBookableSlotsResponse>
{
  constructor(
    @Inject(BRANCH_PUBLIC_REPOSITORY) private readonly branches: BranchPublicRepository,
    private readonly getSlots: GetBookableSlotsUseCase,
  ) {}

  async execute(input: GetConsumerBookableSlotsInput): Promise<ConsumerBookableSlotsResponse> {
    const ctx = await this.branches.loadBookingContext(input.branchId);
    if (!ctx) {
      throw new BranchNotListedError();
    }
    if (!ctx.reservationsPublic) {
      throw new ReservationsNotPublicError();
    }

    const openWindows = resolveOpenWindows(input.date, ctx.hours, ctx.timezone);
    const slots = await this.getSlots.execute({
      restaurantId: ctx.restaurantId,
      branchId: ctx.branchId,
      openWindows,
      partySize: input.partySize,
    });

    return {
      branchId: ctx.branchId,
      date: input.date,
      partySize: input.partySize,
      slots: slots.map((s) => ({
        time: new Date(s.startMs).toISOString(),
        available: s.available,
      })),
    };
  }
}
