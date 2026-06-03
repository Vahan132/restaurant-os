import { Inject, Injectable } from '@nestjs/common';
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
  permissions: string[];
}

/** Return the current user with their role and effective permissions. */
@Injectable()
export class GetMeUseCase implements UseCase<GetMeInput, GetMeOutput> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
  ) {}

  async execute(input: GetMeInput): Promise<GetMeOutput> {
    const user = await this.users.findById(input.organizationId, input.userId);
    if (!user) {
      throw UserNotFound();
    }
    const role = await this.roles.findById(input.organizationId, user.roleId);
    return { user, role, permissions: role?.permissions ?? [] };
  }
}
