import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { SessionContext } from '../../../../shared/storefront/session-context';
import {
  SESSION_TOKEN_SERVICE,
  SessionTokenService,
} from '../../application/ports/session-token.service';
import {
  TABLE_SESSION_REPOSITORY,
  TableSessionRepository,
} from '../../domain/repositories/table-session.repository';

/**
 * SessionTokenGuard — the ORDER-2 read side of the ORDER-1 opaque session token.
 *
 * Runs AFTER PublicRestaurantResolverGuard (which resolves the restaurant from
 * host/slug into `request.public`). Reads the plaintext reattach token from the
 * `X-Session-Token` header, hashes it, and resolves the NON-TERMINAL session for
 * that (restaurant, hash). On success it attaches `request.tableSession` so
 * downstream handlers are scoped to exactly that session's branch + table. Any
 * missing/invalid/expired token is an opaque 401 — a QR order read/write is only
 * ever performed for the session the caller actually holds a token for.
 */
@Injectable()
export class SessionTokenGuard implements CanActivate {
  constructor(
    @Inject(TABLE_SESSION_REPOSITORY) private readonly sessions: TableSessionRepository,
    @Inject(SESSION_TOKEN_SERVICE) private readonly tokens: SessionTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const restaurantId = request.public?.restaurantId;
    if (!restaurantId) {
      // PublicRestaurantResolverGuard must run first.
      throw this.invalid();
    }

    const header = request.headers['x-session-token'];
    const token = (Array.isArray(header) ? header[0] : header)?.trim();
    if (!token) {
      throw this.invalid();
    }

    const tokenHash = this.tokens.hash(token);
    const session = await this.sessions.findByTokenHash(restaurantId, tokenHash);
    if (!session || session.isTerminal()) {
      throw this.invalid();
    }

    const ctx: SessionContext = {
      sessionId: session.id,
      restaurantId: session.restaurantId,
      branchId: session.branchId,
      tableId: session.tableId,
    };
    request.tableSession = ctx;
    return true;
  }

  /** Opaque 401 — never distinguishes missing vs. wrong vs. expired token. */
  private invalid(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'SESSION_TOKEN_INVALID',
      message: 'A valid session token is required.',
    });
  }
}
