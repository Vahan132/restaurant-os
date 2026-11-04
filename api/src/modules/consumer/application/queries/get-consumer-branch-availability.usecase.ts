import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { GetTableAvailabilityUseCase } from '../../../reservations/application/queries/get-table-availability.usecase';
import {
  BRANCH_PUBLIC_REPOSITORY,
  BranchPublicRepository,
} from '../../domain/repositories/branch-public.repository';
import {
  BranchNotListedError,
  ReservationsNotPublicError,
} from '../../domain/consumer.errors';
import { ConsumerAvailabilityResponse } from '../dto/responses';

export interface GetConsumerBranchAvailabilityInput {
  branchId: string;
  windowStart?: string;
  windowEnd?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * GetConsumerBranchAvailability — REUSES the existing reservations availability
 * use-case (no reimplementation). Only returns data when the branch is
 * effectively listed (else 404 BRANCH_NOT_LISTED) AND reservationsPublic is true
 * (else RESERVATIONS_NOT_PUBLIC). The reused use-case is staff-facing and exposes
 * customer names; this endpoint is anonymous, so output is reduced to PII-free
 * busy windows. Anonymous.
 */
@Injectable()
export class GetConsumerBranchAvailabilityUseCase
  implements UseCase<GetConsumerBranchAvailabilityInput, ConsumerAvailabilityResponse>
{
  constructor(
    @Inject(BRANCH_PUBLIC_REPOSITORY)
    private readonly branches: BranchPublicRepository,
    private readonly getAvailability: GetTableAvailabilityUseCase,
  ) {}

  async execute(
    input: GetConsumerBranchAvailabilityInput,
  ): Promise<ConsumerAvailabilityResponse> {
    const ctx = await this.branches.loadAvailabilityContext(input.branchId);
    if (!ctx) {
      throw new BranchNotListedError();
    }
    if (!ctx.reservationsPublic) {
      throw new ReservationsNotPublicError();
    }

    const windowStart = input.windowStart ? new Date(input.windowStart) : new Date();
    const windowEnd = input.windowEnd
      ? new Date(input.windowEnd)
      : new Date(windowStart.getTime() + DAY_MS);

    const tables = await this.getAvailability.execute({
      restaurantId: ctx.restaurantId,
      branchId: ctx.branchId,
      windowStart,
      windowEnd,
    });

    return {
      branchId: ctx.branchId,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      tables: tables.map((t) => ({
        tableId: t.tableId,
        name: t.name,
        status: t.status,
        // PII stripped: customer names/ids from the staff view are NOT exposed.
        busyWindows: t.reservations.map((r) => {
          const start = new Date(r.reservedAt);
          const end = new Date(start.getTime() + r.durationMinutes * 60_000);
          return { start: start.toISOString(), end: end.toISOString() };
        }),
      })),
    };
  }
}
