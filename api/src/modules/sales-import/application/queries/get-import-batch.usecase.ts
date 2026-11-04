import { Inject, Injectable } from '@nestjs/common';
import {
  BRANCH_ACCESS_RESOLVER,
  BranchAccessResolver,
} from '../../../../shared/auth/branch-access.resolver';
import { UseCase } from '../../../../shared/application/use-case';
import { ImportBatch } from '../../domain/entities/import-batch';
import {
  SALES_IMPORT_REPOSITORY,
  SalesImportRepository,
} from '../../domain/repositories/sales-import.repository';
import { ImportBatchNotFound, NoRestaurantInScope } from '../application.errors';
import { resolveScope } from './list-import-batches.usecase';

export interface GetImportBatchInput {
  organizationId: string;
  restaurantId: string | null;
  userId: string;
  id: string;
}

/** Fetch one import batch within the caller's branch reach (else 404). */
@Injectable()
export class GetImportBatchUseCase implements UseCase<GetImportBatchInput, ImportBatch> {
  constructor(
    @Inject(SALES_IMPORT_REPOSITORY) private readonly repo: SalesImportRepository,
    @Inject(BRANCH_ACCESS_RESOLVER) private readonly branchAccess: BranchAccessResolver,
  ) {}

  async execute(input: GetImportBatchInput): Promise<ImportBatch> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const scope = await resolveScope(
      this.branchAccess,
      input.organizationId,
      input.restaurantId,
      input.userId,
    );
    const batch = await this.repo.findBatchById(input.restaurantId, input.id, scope);
    if (!batch) {
      throw ImportBatchNotFound();
    }
    return batch;
  }
}
