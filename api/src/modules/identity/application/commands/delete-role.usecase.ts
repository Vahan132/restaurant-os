import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ROLE_REPOSITORY, RoleRepository } from '../../domain/repositories/role.repository';
import { RoleInUse, RoleNotFound } from '../application.errors';

export interface DeleteRoleInput {
  organizationId: string;
  roleId: string;
}

/**
 * Delete a role (tenant-scoped). System roles are protected (domain throws
 * SYSTEM_ROLE_NOT_DELETABLE); roles still assigned to users cannot be deleted.
 */
@Injectable()
export class DeleteRoleUseCase implements UseCase<DeleteRoleInput, void> {
  constructor(@Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository) {}

  async execute(input: DeleteRoleInput): Promise<void> {
    const role = await this.roles.findById(input.organizationId, input.roleId);
    if (!role) {
      throw RoleNotFound();
    }
    role.ensureDeletable(); // throws SystemRoleNotDeletableError for system roles

    const assigned = await this.roles.countUsers(input.organizationId, input.roleId);
    if (assigned > 0) {
      throw RoleInUse();
    }
    await this.roles.delete(input.organizationId, input.roleId);
  }
}
