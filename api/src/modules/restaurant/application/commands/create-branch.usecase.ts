import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { BranchMembership } from '../../../identity/domain/entities/branch-membership';
import {
  BRANCH_MEMBERSHIP_REPOSITORY,
  BranchMembershipRepository,
} from '../../../identity/domain/repositories/branch-membership.repository';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../identity/domain/repositories/user.repository';
import { Branch } from '../../domain/entities/branch';
import { BRANCH_REPOSITORY, BranchRepository } from '../../domain/repositories/branch.repository';
import {
  RESTAURANT_REPOSITORY,
  RestaurantRepository,
} from '../../domain/repositories/restaurant.repository';
import {
  BranchLimitExceeded,
  NoRestaurantInScope,
  RestaurantNotFound,
} from '../application.errors';
import { PLAN_LIMITS_READER, PlanLimitsReader } from '../ports/plan-limits.reader';

export interface CreateBranchInput {
  organizationId: string;
  restaurantId: string | null;
  name: string;
  /** The user creating the branch — auto-granted a membership at the new branch. */
  actorUserId: string;
}

/** BR-9: derive a URL-safe slug from a branch name (empty → 'branch'). */
function slugifyBranchName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'branch';
}

/** Create a branch, enforcing the plan's maxBranchesPerRestaurant. */
@Injectable()
export class CreateBranchUseCase implements UseCase<CreateBranchInput, Branch> {
  constructor(
    @Inject(RESTAURANT_REPOSITORY) private readonly restaurants: RestaurantRepository,
    @Inject(BRANCH_REPOSITORY) private readonly branches: BranchRepository,
    @Inject(PLAN_LIMITS_READER) private readonly planLimits: PlanLimitsReader,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(BRANCH_MEMBERSHIP_REPOSITORY)
    private readonly memberships: BranchMembershipRepository,
  ) {}

  async execute(input: CreateBranchInput): Promise<Branch> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const restaurant = await this.restaurants.findByIdInOrg(
      input.organizationId,
      input.restaurantId,
    );
    if (!restaurant) {
      throw RestaurantNotFound();
    }

    const max = await this.planLimits.maxBranchesPerRestaurant(input.organizationId);
    if (max !== null) {
      const active = await this.branches.countActive(input.restaurantId);
      if (active + 1 > max) {
        throw BranchLimitExceeded(max);
      }
    }

    // BR-9: derive a per-restaurant unique public slug from the name (append a
    // -2/-3 suffix on collision, incl. against soft-deleted branches).
    const base = slugifyBranchName(input.name);
    let slug = base;
    for (let n = 2; await this.branches.existsBySlug(input.restaurantId, slug); n++) {
      slug = `${base}-${n}`;
    }

    // The first branch of a restaurant becomes its default (BR-1 invariant:
    // exactly one default). Subsequent branches are non-default; an admin can
    // promote one via make-default.
    const existingDefault = await this.branches.findDefault(input.restaurantId);
    const branch = Branch.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      name: input.name,
      slug,
      isDefault: existingDefault === null,
    });
    await this.branches.create(branch);

    // FIX-BR-1: branch access is always explicit. Auto-grant the creating user a
    // BranchMembership (with their existing restaurant role) at the new branch so
    // it is immediately operable by whoever made it. Other users gain access only
    // when explicitly assigned a membership.
    const creator = await this.users.findById(input.organizationId, input.actorUserId);
    if (creator) {
      const membership = BranchMembership.create({
        id: this.ids.generate(),
        restaurantId: input.restaurantId,
        branchId: branch.id,
        userId: creator.id,
        roleId: creator.roleId,
        createdByUserId: creator.id,
      });
      await this.memberships.upsert(membership);
    }

    return branch;
  }
}
