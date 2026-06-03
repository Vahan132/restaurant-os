import { Inject, Injectable } from '@nestjs/common';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { UseCase } from '../../../../shared/application/use-case';
import { User } from '../../domain/entities/user';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';

export interface ListUsersInput {
  organizationId: string;
  page?: number;
  limit?: number;
  restaurantId?: string;
  search?: string;
}

/** Paginated, tenant-scoped listing of users. */
@Injectable()
export class ListUsersUseCase implements UseCase<ListUsersInput, Paginated<User>> {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(input: ListUsersInput): Promise<Paginated<User>> {
    const query = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(query);
    const { items, total } = await this.users.list({
      organizationId: input.organizationId,
      restaurantId: input.restaurantId,
      search: input.search,
      skip,
      take,
    });
    return paginate(items, total, query);
  }
}
