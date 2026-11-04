import { Inject, Injectable } from '@nestjs/common';
import { AccessTokenPayload } from '../../../../shared/auth/jwt-payload';
import { User } from '../../domain/entities/user';
import { SigningKeyUnavailable } from '../application.errors';
import { ID_GENERATOR, IdGenerator } from '../ports/id-generator';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from '../ports/refresh-token.repository';
import { RESTAURANT_KEY_PROVIDER, RestaurantKeyProvider } from '../ports/restaurant-key.provider';
import { TOKEN_SERVICE, TokenService } from '../ports/token.service';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Internal application service: builds the access-token payload (snapshotting
 * the user's current permissions), signs the access token with the restaurant's
 * per-restaurant key (OFF-5), and issues + stores a hashed refresh token. Shared
 * by LoginUseCase and RefreshTokenUseCase.
 */
@Injectable()
export class AuthTokenIssuer {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(RESTAURANT_KEY_PROVIDER) private readonly keys: RestaurantKeyProvider,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async issueFor(user: User, permissions: string[]): Promise<IssuedTokens> {
    const signingKey = await this.keys.getSigningKey(user.restaurantId);
    if (!signingKey) {
      throw SigningKeyUnavailable();
    }

    const payload: AccessTokenPayload = {
      sub: user.id,
      organizationId: user.organizationId,
      restaurantId: user.restaurantId,
      branchId: user.branchId,
      roleId: user.roleId,
      permissions,
    };

    const accessToken = this.tokens.signAccessToken(payload, signingKey);
    const issued = this.tokens.issueRefreshToken(
      {
        sub: user.id,
        organizationId: user.organizationId,
        restaurantId: user.restaurantId,
      },
      signingKey,
    );

    await this.refreshTokens.create({
      id: this.ids.generate(),
      userId: user.id,
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
