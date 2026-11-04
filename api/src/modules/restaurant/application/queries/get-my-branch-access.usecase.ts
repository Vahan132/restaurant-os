import { Inject, Injectable } from '@nestjs/common';
import {
  BRANCH_ACCESS_RESOLVER,
  BranchAccessResolver,
} from '../../../../shared/auth/branch-access.resolver';
import { UseCase } from '../../../../shared/application/use-case';
import { NoRestaurantInScope } from '../application.errors';

export interface GetMyBranchAccessInput {
  organizationId: string;
  restaurantId: string | null;
  userId: string;
  branchId: string;
}

export interface MyBranchAccess {
  branchId: string;
  permissions: string[];
}

/**
 * Demonstration use case (BR-1 §7): resolve the caller's EFFECTIVE permissions at
 * the active branch end-to-end. The route is @BranchScoped, so BranchAccessGuard
 * has already proven access before this runs; resolving again proves resolution.
 */
@Injectable()
export class GetMyBranchAccessUseCase implements UseCase<GetMyBranchAccessInput, MyBranchAccess> {
  constructor(@Inject(BRANCH_ACCESS_RESOLVER) private readonly resolver: BranchAccessResolver) {}

  async execute(input: GetMyBranchAccessInput): Promise<MyBranchAccess> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const result = await this.resolver.resolveForBranch({
      organizationId: input.organizationId,
      restaurantId: input.restaurantId,
      userId: input.userId,
      branchId: input.branchId,
    });
    return { branchId: input.branchId, permissions: result.permissions };
  }
}
