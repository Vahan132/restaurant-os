import { Inject, Injectable } from '@nestjs/common';
import {
  BRANCH_ACCESS_RESOLVER,
  BranchAccessResolver,
} from '../../../../shared/auth/branch-access.resolver';
import { UseCase } from '../../../../shared/application/use-case';
import { EdgeConfigService } from '../../../../shared/edge/edge-config.service';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { User } from '../../domain/entities/user';
import { ROLE_REPOSITORY, RoleRepository } from '../../domain/repositories/role.repository';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { AccountBlocked, InvalidCredentials, NoBranchAccessAtEdge } from '../application.errors';
import { PASSWORD_HASHER, PasswordHasher } from '../ports/password-hasher';
import { AccountStateChecker } from '../services/account-state.checker';
import { AuthTokenIssuer } from '../services/auth-token-issuer';

export interface LoginInput {
  email: string;
  password: string;
  organizationId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface LoginOutput {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
  permissions: string[];
}

/** Authenticate by email + password and issue an access/refresh token pair. */
@Injectable()
export class LoginUseCase implements UseCase<LoginInput, LoginOutput> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(BRANCH_ACCESS_RESOLVER) private readonly branchAccess: BranchAccessResolver,
    private readonly issuer: AuthTokenIssuer,
    private readonly accountState: AccountStateChecker,
    private readonly events: DomainEventPublisher,
    private readonly edge: EdgeConfigService,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const email = input.email.trim().toLowerCase();

    const user = input.organizationId
      ? await this.users.findByEmail(input.organizationId, email)
      : await this.users.findByEmailGlobalUnique(email);

    if (!user || user.isDeleted()) {
      throw InvalidCredentials();
    }

    const ok = await this.hasher.verify(user.passwordHash.value, input.password);
    if (!ok) {
      throw InvalidCredentials();
    }

    if (!user.isActive()) {
      throw AccountBlocked();
    }

    // OFF-5: at the edge, a user may log in ONLY if they have access to the
    // branch this hub serves (a membership at it, or an all-branch role).
    if (this.edge.isEdge) {
      const id = this.edge.getIdentity();
      const access = await this.branchAccess.resolveForBranch({
        organizationId: user.organizationId,
        restaurantId: id.restaurantId,
        userId: user.id,
        branchId: id.branchId,
      });
      if (!access.branchExists || !access.hasAccess) {
        throw NoBranchAccessAtEdge();
      }
    }

    // Connect billing to access: org must be ACTIVE + subscription in good standing.
    await this.accountState.assertGoodStanding(user.organizationId);

    const role = await this.roles.findById(user.organizationId, user.roleId);
    const permissions = role?.permissions ?? [];

    user.recordLogin(new Date(), input.ip ?? null, input.userAgent ?? null);
    await this.users.update(user);
    await this.events.publishFromAggregate(user);

    const tokens = await this.issuer.issueFor(user, permissions);
    return { ...tokens, user, permissions };
  }
}
