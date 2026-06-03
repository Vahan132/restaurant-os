import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Role } from '../../domain/entities/role';
import { ROLE_REPOSITORY, RoleRepository } from '../../domain/repositories/role.repository';

export interface ListRolesInput {
  organizationId: string;
}

/** List all roles within the acting organization. */
@Injectable()
export class ListRolesUseCase implements UseCase<ListRolesInput, Role[]> {
  constructor(@Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository) {}

  execute(input: ListRolesInput): Promise<Role[]> {
    return this.roles.list(input.organizationId);
  }
}
