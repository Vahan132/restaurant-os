import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Role } from '../../domain/entities/role';
import { ROLE_REPOSITORY, RoleRepository } from '../../domain/repositories/role.repository';
import { RoleCodeAlreadyExists } from '../application.errors';
import { ID_GENERATOR, IdGenerator } from '../ports/id-generator';

export interface CreateRoleInput {
  organizationId: string;
  name: string;
  code: string;
  permissions: string[];
}

/** Create a custom (non-system) role within the organization. */
@Injectable()
export class CreateRoleUseCase implements UseCase<CreateRoleInput, Role> {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateRoleInput): Promise<Role> {
    const code = input.code.trim().toUpperCase();
    if (await this.roles.existsByCode(input.organizationId, code)) {
      throw RoleCodeAlreadyExists();
    }
    // Role.create validates the permission keys against the catalog.
    const role = Role.create({
      id: this.ids.generate(),
      organizationId: input.organizationId,
      name: input.name,
      code,
      permissions: input.permissions,
      isSystem: false,
    });
    await this.roles.create(role);
    return role;
  }
}
