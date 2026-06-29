import { Inject, Injectable } from '@nestjs/common';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { UseCase } from '../../../../shared/application/use-case';
import { ModifierGroup } from '../../domain/entities/modifier-group';
import { MenuStatus } from '../../domain/enums';
import {
  MODIFIER_GROUP_REPOSITORY,
  ModifierGroupRepository,
} from '../../domain/repositories/modifier-group.repository';
import { NoRestaurantInScope } from '../application.errors';

export interface ListModifierGroupsInput {
  restaurantId: string | null;
  branchId: string;
  status?: MenuStatus;
  search?: string;
  page?: number;
  limit?: number;
}

/** List the reusable modifier-group library (restaurant+branch-scoped, paginated). */
@Injectable()
export class ListModifierGroupsUseCase implements UseCase<
  ListModifierGroupsInput,
  Paginated<ModifierGroup>
> {
  constructor(
    @Inject(MODIFIER_GROUP_REPOSITORY) private readonly groups: ModifierGroupRepository,
  ) {}

  async execute(input: ListModifierGroupsInput): Promise<Paginated<ModifierGroup>> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const pagination = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(pagination);
    const { items, total } = await this.groups.list({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      status: input.status,
      search: input.search,
      skip,
      take,
    });
    return paginate(items, total, pagination);
  }
}
