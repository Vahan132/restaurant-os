import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { BranchMembership } from '../../domain/entities/branch-membership';
import {
  BRANCH_MEMBERSHIP_REPOSITORY,
  BranchMembershipRepository,
} from '../../domain/repositories/branch-membership.repository';
import { ROLE_REPOSITORY, RoleRepository } from '../../domain/repositories/role.repository';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import {
  BranchNotInRestaurant,
  NoRestaurantInScope,
  RoleNotFound,
  UserNotFound,
} from '../application.errors';
import { ID_GENERATOR, IdGenerator } from '../ports/id-generator';
import { BRANCH_DIRECTORY_READER, BranchDirectoryReader } from '../ports/branch-directory.reader';

export interface UpsertBranchMembershipInput {
  organizationId: string;
  restaurantId: string | null;
  userId: string;
  branchId: string;
  roleId: string;
  actorUserId: string;
}

/**
 * Grant (or change) a user's role at a branch (BR-1). One role per user per
 * branch — re-issuing for the same (user, branch) updates the role. This is how
 * a branch-scoped user gains access; it coexists with the user's restaurant-level
 * role (which, unless the BRANCH_SCOPED sentinel, already grants all branches).
 */
@Injectable()
export class UpsertBranchMembershipUseCase implements UseCase<
  UpsertBranchMembershipInput,
  BranchMembership
> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(BRANCH_MEMBERSHIP_REPOSITORY)
    private readonly memberships: BranchMembershipRepository,
    @Inject(BRANCH_DIRECTORY_READER) private readonly branches: BranchDirectoryReader,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: UpsertBranchMembershipInput): Promise<BranchMembership> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }

    const user = await this.users.findById(input.organizationId, input.userId);
    if (!user) {
      throw UserNotFound();
    }

    const role = await this.roles.findById(input.organizationId, input.roleId);
    if (!role) {
      throw RoleNotFound();
    }

    const branch = await this.branches.findActive(input.restaurantId, input.branchId);
    if (!branch) {
      throw BranchNotInRestaurant();
    }

    const existing = await this.memberships.findByUserAndBranch(input.userId, input.branchId);
    if (existing) {
      existing.changeRole(input.roleId);
      await this.memberships.upsert(existing);
      return existing;
    }

    const membership = BranchMembership.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      userId: input.userId,
      roleId: input.roleId,
      createdByUserId: input.actorUserId,
    });
    await this.memberships.upsert(membership);
    return membership;
  }
}
