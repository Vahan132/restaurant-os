import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey, verify as cryptoVerify, KeyObject } from 'node:crypto';
import { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import {
  ProviderVerifier,
  VerifiedProviderIdentity,
} from '../../application/ports/provider-verifier';
import { ProviderTokenInvalidError } from '../../domain/consumer-identity.errors';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';

const JWKS_TTL_MS = 60 * 60 * 1000; // cache provider keys for 1h
const CLOCK_SKEW_S = 60;

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
}
interface JwtClaims {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  exp?: number;
  nbf?: number;
  email?: string;
  email_verified?: boolean | string;
  is_private_email?: boolean | string;
  name?: string;
}

/**
 * Verifies Google/Apple ID tokens against the provider JWKS using node:crypto only
 * (no external JWT/JWKS library). Checks RS256 signature, issuer, audience and
 * expiry. Any failure → ProviderTokenInvalidError. Never trusts client claims.
 */
@Injectable()
export class JwksProviderVerifier implements ProviderVerifier {
  private readonly logger = new Logger(JwksProviderVerifier.name);
  private readonly googleAudiences: string[];
  private readonly appleAudiences: string[];
  private readonly jwksCache = new Map<string, { keys: Jwk[]; fetchedAt: number }>();

  constructor(config: ConfigService<AppConfig, true>) {
    this.googleAudiences = splitCsv(config.get('GOOGLE_CLIENT_IDS', { infer: true }));
    this.appleAudiences = splitCsv(config.get('APPLE_CLIENT_IDS', { infer: true }));
  }

  async verifyGoogle(idToken: string): Promise<VerifiedProviderIdentity> {
    const claims = await this.verifyToken(idToken, {
      jwksUrl: GOOGLE_JWKS_URL,
      issuers: GOOGLE_ISSUERS,
      audiences: this.googleAudiences,
    });
    const emailVerified = toBool(claims.email_verified);
    return {
      provider: 'GOOGLE',
      subject: requireSub(claims),
      email: claims.email ?? null,
      emailVerified,
      name: claims.name ?? null,
    };
  }

  async verifyApple(
    idToken: string,
    firstAuthName?: string | null,
  ): Promise<VerifiedProviderIdentity> {
    const claims = await this.verifyToken(idToken, {
      jwksUrl: APPLE_JWKS_URL,
      issuers: [APPLE_ISSUER],
      audiences: this.appleAudiences,
    });
    // Apple private-relay addresses must NOT auto-link — treat as unverified for
    // linking purposes (the use-case keeps such accounts standalone).
    const isPrivate = toBool(claims.is_private_email);
    const emailVerified = toBool(claims.email_verified) && !isPrivate;
    return {
      provider: 'APPLE',
      subject: requireSub(claims),
      email: claims.email ?? null,
      emailVerified,
      // Apple omits name from the ID token; the app passes it on first auth.
      name: firstAuthName ?? claims.name ?? null,
    };
  }

  private async verifyToken(
    token: string,
    opts: { jwksUrl: string; issuers: string[]; audiences: string[] },
  ): Promise<JwtClaims> {
    const parts = token.split('.');
    if (parts.length !== 3) throw new ProviderTokenInvalidError('Malformed token.');
    const [headerB64, payloadB64, sigB64] = parts;

    let header: { alg?: string; kid?: string };
    let claims: JwtClaims;
    try {
      header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
      claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    } catch {
      throw new ProviderTokenInvalidError('Token is not valid JSON.');
    }

    if (header.alg !== 'RS256' || !header.kid) {
      throw new ProviderTokenInvalidError('Unsupported token algorithm.');
    }

    const key = await this.resolveKey(opts.jwksUrl, header.kid);
    const signed = Buffer.from(`${headerB64}.${payloadB64}`);
    const signature = Buffer.from(sigB64, 'base64url');
    const ok = cryptoVerify('RSA-SHA256', signed, key, signature);
    if (!ok) throw new ProviderTokenInvalidError('Signature verification failed.');

    // Claim checks.
    const now = Math.floor(Date.now() / 1000);
    if (typeof claims.exp === 'number' && claims.exp + CLOCK_SKEW_S < now) {
      throw new ProviderTokenInvalidError('Token expired.');
    }
    if (typeof claims.nbf === 'number' && claims.nbf - CLOCK_SKEW_S > now) {
      throw new ProviderTokenInvalidError('Token not yet valid.');
    }
    if (!claims.iss || !opts.issuers.includes(claims.iss)) {
      throw new ProviderTokenInvalidError('Unexpected token issuer.');
    }
    const auds = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
    if (opts.audiences.length === 0 || !auds.some((a) => opts.audiences.includes(a))) {
      throw new ProviderTokenInvalidError('Token audience mismatch.');
    }
    return claims;
  }

  private async resolveKey(jwksUrl: string, kid: string): Promise<KeyObject> {
    let entry = this.jwksCache.get(jwksUrl);
    if (!entry || Date.now() - entry.fetchedAt > JWKS_TTL_MS || !entry.keys.some((k) => k.kid === kid)) {
      entry = { keys: await this.fetchJwks(jwksUrl), fetchedAt: Date.now() };
      this.jwksCache.set(jwksUrl, entry);
    }
    const jwk = entry.keys.find((k) => k.kid === kid && k.kty === 'RSA');
    if (!jwk) throw new ProviderTokenInvalidError('Signing key not found.');
    try {
      return createPublicKey({ key: jwk, format: 'jwk' } as unknown as import('node:crypto').JsonWebKeyInput);
    } catch {
      throw new ProviderTokenInvalidError('Malformed signing key.');
    }
  }

  private async fetchJwks(jwksUrl: string): Promise<Jwk[]> {
    try {
      const res = await fetch(jwksUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { keys?: Jwk[] };
      if (!body.keys?.length) throw new Error('empty JWKS');
      return body.keys;
    } catch (err) {
      this.logger.error(`Failed to fetch JWKS from ${jwksUrl}: ${(err as Error).message}`);
      throw new ProviderTokenInvalidError('Could not retrieve provider signing keys.');
    }
  }
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function toBool(v: boolean | string | undefined): boolean {
  return v === true || v === 'true';
}

function requireSub(claims: JwtClaims): string {
  if (!claims.sub) throw new ProviderTokenInvalidError('Token missing subject.');
  return claims.sub;
}
