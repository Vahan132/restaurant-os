import { Inject, Injectable } from '@nestjs/common';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { UseCase } from '../../../../shared/application/use-case';
import { Process } from '../../domain/entities/process';
import {
  PROCESS_REPOSITORY,
  ProcessRepository,
} from '../../domain/repositories/process.repository';
import { NoRestaurantInScope } from '../application.errors';

export interface ListProcessesInput {
  restaurantId: string | null;
  branchId: string;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ListProcessesUseCase implements UseCase<ListProcessesInput, Paginated<Process>> {
  constructor(@Inject(PROCESS_REPOSITORY) private readonly processes: ProcessRepository) {}

  async execute(input: ListProcessesInput): Promise<Paginated<Process>> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const query = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(query);
    const { items, total } = await this.processes.list({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      search: input.search,
      skip,
      take,
    });
    return paginate(items, total, query);
  }
}
