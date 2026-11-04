/**
 * JWT payload contracts (framework-free types shared across layers).
 *
 * The access token SNAPSHOTS the user's permissions so authorization checks are
 * stateless and fast. Permission/role changes therefore propagate to a client
 * only on the next token refresh (short access-token TTL keeps the window small).
 */

/** Claims carried by the short-lived access token (also the request.user shape). */
export interface AccessTokenPayload {
  /** Subject — the user id. */
  sub: string;
  organizationId: string;
  restaurantId: string | null;
  branchId: string | null;
  roleId: string;
  permissions: string[];
}

/** Claims carried by the long-lived refresh token. */
export interface RefreshTokenPayload {
  sub: string;
  organizationId: string;
  /**
   * OFF-5: the restaurant whose per-restaurant key signed this token. Read
   * UNVERIFIED on refresh to resolve the signing key, then the token is verified
   * with it. Null for restaurant-less (org-level) principals → global fallback.
   */
  restaurantId: string | null;
  /** Random token id — makes each issued refresh token unique. */
  jti: string;
}
