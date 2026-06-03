import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/user';
import { Email } from '../../domain/value-objects/email';
import { PasswordHash } from '../../domain/value-objects/password-hash';
import { RawPassword } from '../../domain/value-objects/raw-password';
import { ID_GENERATOR, IdGenerator } from '../ports/id-generator';
import { PASSWORD_HASHER, PasswordHasher } from '../ports/password-hasher';

export interface BuildUserInput {
  organizationId: string;
  email: string;
  password: string;
  fullName: string;
  roleId: string;
  restaurantId?: string | null;
  branchId?: string | null;
  actorUserId?: string | null;
}

/**
 * Reusable user-creation logic (validation + hashing + aggregate construction).
 * Returns a fresh User aggregate WITHOUT persisting it, so callers can persist
 * via a repository (CreateUserUseCase) or inside a transaction (platform
 * provisioning). Centralizes "how a user is built" so it is never duplicated.
 */
@Injectable()
export class UserFactory {
  constructor(
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async build(input: BuildUserInput): Promise<User> {
    const email = Email.create(input.email);
    const raw = RawPassword.create(input.password);
    const passwordHash = PasswordHash.fromHash(await this.hasher.hash(raw.value));
    return User.create({
      id: this.ids.generate(),
      organizationId: input.organizationId,
      restaurantId: input.restaurantId ?? null,
      branchId: input.branchId ?? null,
      email,
      passwordHash,
      fullName: input.fullName,
      roleId: input.roleId,
      actorUserId: input.actorUserId ?? null,
    });
  }
}
