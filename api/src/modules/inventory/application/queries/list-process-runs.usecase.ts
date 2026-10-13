import { Inject, Injectable } from '@nestjs/common';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { UseCase } from '../../../../shared/application/use-case';
import { ProcessRun } from '../../domain/entities/process-run';
import {
  PROCESS_RUN_REPOSITORY,
  ProcessRunRepository,
} from '../../domain/repositories/process-run.repository';
import { NoRestaurantInScope } from '../application.errors';

export interface ListProcessRunsInput {
  restaurantId: string | null;
  branchId: string;
  processId?: string;
  runFrom?: Date;
  runTo?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class ListProcessRunsUseCase implements UseCase<
  ListProcessRunsInput,
  Paginated<ProcessRun>
> {
  constructor(@Inject(PROCESS_RUN_REPOSITORY) private readonly runs: ProcessRunRepository) {}

  async execute(input: ListProcessRunsInput): Promise<Paginated<ProcessRun>> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const query = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(query);
    const { items, total } = await this.runs.list({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      processId: input.processId,
      runFrom: input.runFrom,
      runTo: input.runTo,
      skip,
      take,
    });
    return paginate(items, total, query);
  }
}
