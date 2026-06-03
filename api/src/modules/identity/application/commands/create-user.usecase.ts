import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { User } from '../../domain/entities/user';
import { ROLE_REPOSITORY, RoleRepository } from '../../domain/repositories/role.repository';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { Email } from '../../domain/value-objects/email';
import {
  BranchNotInRestaurant,
  EmailAlreadyExists,
  RestaurantNotInOrg,
  RoleNotFound,
} from '../application.errors';
import { TENANT_STRUCTURE_READER, TenantStructureReader } from '../ports/tenant-structure.reader';
import { UserFactory } from '../services/user-factory';

export interface CreateUserInput {
  organizationId: string;
  email: string;
  password: string;
  fullName: string;
  roleId: string;
  restaurantId?: string | null;
  branchId?: string | null;
  actorUserId?: string | null;
}

/** Create a user inside the acting organization. Reuses UserFactory for build+hash. */
@Injectable()
export class CreateUserUseCase implements UseCase<CreateUserInput, User> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(TENANT_STRUCTURE_READER) private readonly structure: TenantStructureReader,
    private readonly userFactory: UserFactory,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: CreateUserInput): Promise<User> {
    const email = Email.create(input.email);

    const role = await this.roles.findById(input.organizationId, input.roleId);
    if (!role) {
      throw RoleNotFound();
    }

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

    if (await this.users.existsByEmail(input.organizationId, email.value)) {
      throw EmailAlreadyExists();
    }

    const user = await this.userFactory.build({
      organizationId: input.organizationId,
      email: input.email,
      password: input.password,
      fullName: input.fullName,
      roleId: input.roleId,
      restaurantId,
      branchId,
      actorUserId: input.actorUserId ?? null,
    });

    await this.users.create(user);
    await this.events.publishFromAggregate(user);
    return user;
  }
}
