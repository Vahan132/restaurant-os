import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  BRANCH_MEMBERSHIP_REPOSITORY,
  BranchMembershipRepository,
} from '../../domain/repositories/branch-membership.repository';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { UserNotFound } from '../application.errors';

export interface RemoveBranchMembershipInput {
  organizationId: string;
  userId: string;
  branchId: string;
}

/** Revoke a user's role at a branch (idempotent). */
@Injectable()
export class RemoveBranchMembershipUseCase implements UseCase<RemoveBranchMembershipInput, void> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(BRANCH_MEMBERSHIP_REPOSITORY)
    private readonly memberships: BranchMembershipRepository,
  ) {}

  async execute(input: RemoveBranchMembershipInput): Promise<void> {
    // Confirm the user is in the acting org before mutating their memberships.
    const user = await this.users.findById(input.organizationId, input.userId);
    if (!user) {
      throw UserNotFound();
    }
    await this.memberships.deleteByUserAndBranch(input.userId, input.branchId);
  }
}
