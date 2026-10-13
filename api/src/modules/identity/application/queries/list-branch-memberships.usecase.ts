import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  BRANCH_MEMBERSHIP_REPOSITORY,
  BranchMembershipRepository,
} from '../../domain/repositories/branch-membership.repository';
import { ROLE_REPOSITORY, RoleRepository } from '../../domain/repositories/role.repository';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { NoRestaurantInScope, UserNotFound } from '../application.errors';
import { BRANCH_DIRECTORY_READER, BranchDirectoryReader } from '../ports/branch-directory.reader';

export interface ListBranchMembershipsInput {
  organizationId: string;
  restaurantId: string | null;
  userId: string;
}

export interface BranchMembershipView {
  branchId: string;
  branchName: string | null;
  userId: string;
  roleId: string;
  roleName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** List a user's branch memberships (enriched with branch + role names). */
@Injectable()
export class ListBranchMembershipsUseCase implements UseCase<
  ListBranchMembershipsInput,
  BranchMembershipView[]
> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(BRANCH_MEMBERSHIP_REPOSITORY)
    private readonly memberships: BranchMembershipRepository,
    @Inject(BRANCH_DIRECTORY_READER) private readonly branches: BranchDirectoryReader,
  ) {}

  async execute(input: ListBranchMembershipsInput): Promise<BranchMembershipView[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const user = await this.users.findById(input.organizationId, input.userId);
    if (!user) {
      throw UserNotFound();
    }

    const memberships = await this.memberships.listByUser(input.restaurantId, input.userId);
    const branchById = new Map(
      (await this.branches.listActive(input.restaurantId)).map((b) => [b.id, b]),
    );

    const views: BranchMembershipView[] = [];
    for (const m of memberships) {
      const role = await this.roles.findById(input.organizationId, m.roleId);
      views.push({
        branchId: m.branchId,
        branchName: branchById.get(m.branchId)?.name ?? null,
        userId: m.userId,
        roleId: m.roleId,
        roleName: role?.name ?? null,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      });
    }
    return views;
  }
}
