import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { PlatformUser } from '../../domain/entities/platform-user';
import {
  PLATFORM_REFRESH_TOKEN_REPOSITORY,
  PlatformRefreshTokenRepository,
} from '../ports/platform-refresh-token.repository';
import { PLATFORM_TOKEN_SERVICE, PlatformTokenService } from '../ports/platform-token.service';

export interface IssuedPlatformTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Signs a platform access token and issues + stores a hashed refresh token. */
@Injectable()
export class PlatformTokenIssuer {
  constructor(
    @Inject(PLATFORM_TOKEN_SERVICE) private readonly tokens: PlatformTokenService,
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: PlatformRefreshTokenRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async issueFor(user: PlatformUser): Promise<IssuedPlatformTokens> {
    const accessToken = this.tokens.signAccessToken({
      sub: user.id,
      scope: 'platform',
      role: user.role,
    });
    const issued = this.tokens.issueRefreshToken(user.id);
    await this.refreshTokens.create({
      id: this.ids.generate(),
      platformUserId: user.id,
      tokenHash: issued.tokenHash,
      expiresAt: issued.expiresAt,
    });
    return {
      accessToken,
      refreshToken: issued.token,
      expiresIn: this.tokens.accessTokenTtlSeconds(),
    };
  }
}
