import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  normalizePagination,
  paginate,
  Paginated,
  toSkipTake,
} from '../../../../shared/application/pagination';
import {
  CONSUMER_RESERVATION_REPOSITORY,
  ConsumerReservationRepository,
  ReservationScope,
} from '../../domain/repositories/consumer-reservation.repository';
import { ConsumerReservationResponse } from '../dto/booking-saved.dto';

export interface ListMyReservationsInput {
  customerAccountId: string;
  scope: ReservationScope;
  page?: number;
  limit?: number;
}

/**
 * "My Reservations" (AUTH). Lists ONLY this consumer's reservations, split into
 * upcoming (active + future, ascending) and past (terminal or elapsed,
 * descending), each card carrying its branch summary. Paginated (notably for Past).
 */
@Injectable()
export class ListMyReservationsUseCase
  implements UseCase<ListMyReservationsInput, Paginated<ConsumerReservationResponse>>
{
  constructor(
    @Inject(CONSUMER_RESERVATION_REPOSITORY)
    private readonly reservations: ConsumerReservationRepository,
  ) {}

  async execute(
    input: ListMyReservationsInput,
  ): Promise<Paginated<ConsumerReservationResponse>> {
    const pagination = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(pagination);

    const { items, total } = await this.reservations.listByConsumer(
      input.customerAccountId,
      input.scope,
      new Date(),
      skip,
      take,
    );

    const cards: ConsumerReservationResponse[] = items.map((r) => ({
      reservationId: r.reservationId,
      status: r.status,
      reservedAt: r.reservedAt.toISOString(),
      guestCount: r.guestCount,
      note: r.customerNote,
      branch: r.branch
        ? {
            branchId: r.branch.branchId,
            restaurantId: r.branch.restaurantId,
            name: r.branch.name,
            logoUrl: r.branch.logoUrl,
            address: r.branch.address,
            city: r.branch.city,
          }
        : null,
    }));

    return paginate(cards, total, pagination);
  }
}
