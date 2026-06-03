import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import {
  PLATFORM_ADMIN_QUERY,
  PlatformAdminQuery,
  SubscriptionHistoryAdminRow,
} from '../ports/platform-admin-query.port';

export interface GetSubscriptionHistoryInput {
  organizationId: string;
  page: number;
  limit: number;
}

@Injectable()
export class GetSubscriptionHistoryUseCase implements UseCase<
  GetSubscriptionHistoryInput,
  Paginated<SubscriptionHistoryAdminRow>
> {
  constructor(@Inject(PLATFORM_ADMIN_QUERY) private readonly query: PlatformAdminQuery) {}
  async execute(
    input: GetSubscriptionHistoryInput,
  ): Promise<Paginated<SubscriptionHistoryAdminRow>> {
    const pagination = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(pagination);
    const { items, total } = await this.query.subscriptionHistory(input.organizationId, skip, take);
    return paginate(items, total, pagination);
  }
}
