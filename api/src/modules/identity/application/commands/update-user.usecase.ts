import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { User } from '../../domain/entities/user';
import { ROLE_REPOSITORY, RoleRepository } from '../../domain/repositories/role.repository';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import {
  BranchNotInRestaurant,
  RestaurantNotInOrg,
  RoleNotFound,
  UserNotFound,
} from '../application.errors';
import { TENANT_STRUCTURE_READER, TenantStructureReader } from '../ports/tenant-structure.reader';

export interface UpdateUserInput {
  organizationId: string;
  userId: string;
  fullName?: string;
  roleId?: string;
  restaurantId?: string | null;
  branchId?: string | null;
  /** Whether the scope fields were present in the request (to allow clearing). */
  scopeProvided?: boolean;
}

/** Update a user's profile, role, and tenancy scope (tenant-scoped). */
@Injectable()
export class UpdateUserUseCase implements UseCase<UpdateUserInput, User> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(TENANT_STRUCTURE_READER) private readonly structure: TenantStructureReader,
  ) {}

  async execute(input: UpdateUserInput): Promise<User> {
    const user = await this.users.findById(input.organizationId, input.userId);
    if (!user) {
      throw UserNotFound();
    }

    if (input.roleId !== undefined) {
      const role = await this.roles.findById(input.organizationId, input.roleId);
      if (!role) {
        throw RoleNotFound();
      }
      user.changeRole(input.roleId);
    }

    if (input.fullName !== undefined) {
      user.rename(input.fullName);
    }

    if (input.scopeProvided) {
      const restaurantId = input.restaurantId ?? null;
      const branchId = input.branchId ?? null;
      if (restaurantId) {
        if (!(await this.structure.restaurantInOrg(input.organizationId, restaurantId))) {
          throw RestaurantNotInOrg();
        }
        if (branchId && !(await this.structure.branchInRestaurant(restaurantId, branchId))) {
          throw BranchNotInRestaurant();
        }
      } else if (branchId) {
        throw BranchNotInRestaurant();
      }
      user.assignScope(restaurantId, branchId);
    }

    await this.users.update(user);
    return user;
  }
}
