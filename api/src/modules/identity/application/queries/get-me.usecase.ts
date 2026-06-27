import { Inject, Injectable } from '@nestjs/common';
import {
  AccessibleBranchesResult,
  BRANCH_ACCESS_RESOLVER,
  BranchAccessResolver,
} from '../../../../shared/auth/branch-access.resolver';
import { UseCase } from '../../../../shared/application/use-case';
import { Role } from '../../domain/entities/role';
import { User } from '../../domain/entities/user';
import { ROLE_REPOSITORY, RoleRepository } from '../../domain/repositories/role.repository';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { UserNotFound } from '../application.errors';

export interface GetMeInput {
  organizationId: string;
  userId: string;
}

export interface GetMeOutput {
  user: User;
  role: Role | null;
  /** Restaurant-wide permission set (the role snapshot). */
  permissions: string[];
  /** Branch access (accessible branches + per-branch perms + default + allBranches). */
  branchAccess: AccessibleBranchesResult;
}

const EMPTY_BRANCH_ACCESS: AccessibleBranchesResult = {
  allBranches: false,
  restaurantWidePermissions: [],
  branches: [],
  defaultBranchId: null,
};

/** Return the current user with their role, permissions and branch access. */
@Injectable()
export class GetMeUseCase implements UseCase<GetMeInput, GetMeOutput> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(BRANCH_ACCESS_RESOLVER) private readonly branchAccess: BranchAccessResolver,
  ) {}

  async execute(input: GetMeInput): Promise<GetMeOutput> {
    const user = await this.users.findById(input.organizationId, input.userId);
    if (!user) {
      throw UserNotFound();
    }
    const role = await this.roles.findById(input.organizationId, user.roleId);

    const branchAccess = user.restaurantId
      ? await this.branchAccess.resolveAccessibleBranches({
          organizationId: input.organizationId,
          restaurantId: user.restaurantId,
          userId: user.id,
        })
      : EMPTY_BRANCH_ACCESS;

    return { user, role, permissions: role?.permissions ?? [], branchAccess };
  }
}
