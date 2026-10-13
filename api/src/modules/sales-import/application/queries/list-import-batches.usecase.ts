import { Inject, Injectable } from '@nestjs/common';
import {
  BRANCH_ACCESS_RESOLVER,
  BranchAccessResolver,
} from '../../../../shared/auth/branch-access.resolver';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { UseCase } from '../../../../shared/application/use-case';
import { ImportBatch } from '../../domain/entities/import-batch';
import {
  BranchScope,
  SALES_IMPORT_REPOSITORY,
  SalesImportRepository,
} from '../../domain/repositories/sales-import.repository';
import { NoRestaurantInScope } from '../application.errors';

export interface ListImportBatchesInput {
  organizationId: string;
  restaurantId: string | null;
  userId: string;
  page?: number;
  limit?: number;
}

/** List import batches, newest first, restricted to the caller's branch reach. */
@Injectable()
export class ListImportBatchesUseCase
  implements UseCase<ListImportBatchesInput, Paginated<ImportBatch>>
{
  constructor(
    @Inject(SALES_IMPORT_REPOSITORY) private readonly repo: SalesImportRepository,
    @Inject(BRANCH_ACCESS_RESOLVER) private readonly branchAccess: BranchAccessResolver,
  ) {}

  async execute(input: ListImportBatchesInput): Promise<Paginated<ImportBatch>> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const scope = await resolveScope(
      this.branchAccess,
      input.organizationId,
      input.restaurantId,
      input.userId,
    );
    const pagination = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(pagination);
    const { rows, total } = await this.repo.listBatches({
      restaurantId: input.restaurantId,
      scope,
      skip,
      take,
    });
    return paginate(rows, total, pagination);
  }
}

/**
 * Shared scope resolver: all-branch callers (e.g. OWNER) see every branch;
 * everyone else is restricted to the branches they can reach (empty => none).
 */
export async function resolveScope(
  branchAccess: BranchAccessResolver,
  organizationId: string,
  restaurantId: string,
  userId: string,
): Promise<BranchScope> {
  const access = await branchAccess.resolveAccessibleBranches({
    organizationId,
    restaurantId,
    userId,
  });
  return access.allBranches
    ? { all: true }
    : { all: false, branchIds: access.branches.map((b) => b.id) };
}
