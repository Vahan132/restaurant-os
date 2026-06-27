import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { MissedCall } from '../../domain/entities/missed-call';
import { MissedCallStatus } from '../../domain/enums';
import {
  MISSED_CALL_REPOSITORY,
  MissedCallRepository,
} from '../../domain/repositories/missed-call.repository';
import { NoRestaurantInScope } from '../application.errors';

export interface ListMissedCallsInput {
  restaurantId: string | null;
  branchId: string;
  status?: MissedCallStatus;
  occurredFrom?: Date;
  occurredTo?: Date;
  page: number;
  limit: number;
}

/** Missed-call inbox list — newest first, filtered by status / occurredAt range. */
@Injectable()
export class ListMissedCallsUseCase implements UseCase<
  ListMissedCallsInput,
  Paginated<MissedCall>
> {
  constructor(@Inject(MISSED_CALL_REPOSITORY) private readonly missedCalls: MissedCallRepository) {}

  async execute(input: ListMissedCallsInput): Promise<Paginated<MissedCall>> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const pagination = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(pagination);
    const { items, total } = await this.missedCalls.list({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      status: input.status,
      occurredFrom: input.occurredFrom,
      occurredTo: input.occurredTo,
      skip,
      take,
    });
    return paginate(items, total, pagination);
  }
}
