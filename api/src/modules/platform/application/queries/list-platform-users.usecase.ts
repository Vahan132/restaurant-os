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
  PlatformUserRow,
} from '../ports/platform-admin-query.port';

export interface ListPlatformUsersInput {
  organizationId?: string;
  search?: string;
  role?: string;
  status?: string;
  page: number;
  limit: number;
}

@Injectable()
export class ListPlatformUsersUseCase implements UseCase<
  ListPlatformUsersInput,
  Paginated<PlatformUserRow>
> {
  constructor(@Inject(PLATFORM_ADMIN_QUERY) private readonly query: PlatformAdminQuery) {}
  async execute(input: ListPlatformUsersInput): Promise<Paginated<PlatformUserRow>> {
    const pagination = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(pagination);
    const { items, total } = await this.query.users({
      organizationId: input.organizationId,
      search: input.search,
      role: input.role,
      status: input.status,
      skip,
      take,
    });
    return paginate(items, total, pagination);
  }
}
