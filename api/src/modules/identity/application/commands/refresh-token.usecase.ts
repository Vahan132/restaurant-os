import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { User } from '../../domain/entities/user';
import { ROLE_REPOSITORY, RoleRepository } from '../../domain/repositories/role.repository';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { AccountBlocked, InvalidRefreshToken } from '../application.errors';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from '../ports/refresh-token.repository';
import { TOKEN_SERVICE, TokenService } from '../ports/token.service';
import { AccountStateChecker } from '../services/account-state.checker';
import { AuthTokenIssuer } from '../services/auth-token-issuer';

export interface RefreshInput {
  refreshToken: string;
}

export interface RefreshOutput {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
  permissions: string[];
}

/** Rotate a refresh token; reuse of a revoked/expired token fails. */
@Injectable()
export class RefreshTokenUseCase implements UseCase<RefreshInput, RefreshOutput> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    private readonly issuer: AuthTokenIssuer,
    private readonly accountState: AccountStateChecker,
  ) {}

  async execute(input: RefreshInput): Promise<RefreshOutput> {
    let payload;
    try {
      payload = this.tokens.verifyRefreshToken(input.refreshToken);
    } catch {
      throw InvalidRefreshToken();
    }

    const hash = this.tokens.hashRefreshToken(input.refreshToken);
    const record = await this.refreshTokens.findByHash(hash);
    if (!record || record.revokedAt || record.expiresAt.getTime() <= Date.now()) {
      throw InvalidRefreshToken();
    }

    const user = await this.users.findById(payload.organizationId, payload.sub);
    if (!user || user.isDeleted()) {
      throw InvalidRefreshToken();
    }
    if (!user.isActive()) {
      throw AccountBlocked();
    }

    // Re-check billing/account standing on every refresh.
    await this.accountState.assertGoodStanding(user.organizationId);

    await this.refreshTokens.revoke(record.id);

    const role = await this.roles.findById(user.organizationId, user.roleId);
    const permissions = role?.permissions ?? [];
    const issued = await this.issuer.issueFor(user, permissions);
    return { ...issued, user, permissions };
  }
}
