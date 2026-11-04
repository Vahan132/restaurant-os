import { Inject, Injectable } from '@nestjs/common';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { UseCase } from '../../../../shared/application/use-case';
import { Role } from '../../domain/entities/role';
import { ROLE_REPOSITORY, RoleRepository } from '../../domain/repositories/role.repository';
import { RolePermissionsCache } from '../../infrastructure/services/role-permissions.cache';
import { RoleNotFound } from '../application.errors';

export interface UpdateRoleInput {
  organizationId: string;
  roleId: string;
  name?: string;
  permissions?: string[];
}

/**
 * Update a role's name and/or permission set (tenant-scoped). Permission keys
 * are validated against the catalog by the Role aggregate.
 */
@Injectable()
export class UpdateRoleUseCase implements UseCase<UpdateRoleInput, Role> {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    private readonly rolePermissions: RolePermissionsCache,
    private readonly publisher: DomainEventPublisher,
  ) {}

  async execute(input: UpdateRoleInput): Promise<Role> {
    const role = await this.roles.findById(input.organizationId, input.roleId);
    if (!role) {
      throw RoleNotFound();
    }
    if (input.name !== undefined) {
      role.rename(input.name);
    }
    if (input.permissions !== undefined) {
      role.replacePermissions(input.permissions); // validates against catalog
    }
    await this.roles.update(role);
    // Drop the cached snapshot so the guard re-resolves fresh, THEN broadcast so
    // open sessions refetch — order matters: invalidate before the push, or a
    // client could refetch and re-cache the stale value.
    await this.rolePermissions.invalidate(role.id);
    await this.publisher.publishFromAggregate(role);
    return role;
  }
}
