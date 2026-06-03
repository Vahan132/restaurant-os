import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import {
  SUBSCRIPTION_HISTORY_REPOSITORY,
  SubscriptionHistoryRecord,
  SubscriptionHistoryRepository,
} from '../../../platform/application/ports/subscription-history.repository';

export interface ListHistoryInput {
  organizationId: string;
  page: number;
  limit: number;
}

@Injectable()
export class ListHistoryUseCase implements UseCase<
  ListHistoryInput,
  Paginated<SubscriptionHistoryRecord>
> {
  constructor(
    @Inject(SUBSCRIPTION_HISTORY_REPOSITORY)
    private readonly history: SubscriptionHistoryRepository,
  ) {}

  async execute(input: ListHistoryInput): Promise<Paginated<SubscriptionHistoryRecord>> {
    const pagination = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(pagination);
    const { items, total } = await this.history.listByOrg(input.organizationId, skip, take);
    return paginate(items, total, pagination);
  }
}
