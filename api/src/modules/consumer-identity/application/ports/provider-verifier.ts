/** DI token for the ProviderVerifier port. */
export const PROVIDER_VERIFIER = Symbol('ProviderVerifier');

/** The verified identity extracted from a provider ID token (server-verified). */
export interface VerifiedProviderIdentity {
  provider: 'GOOGLE' | 'APPLE';
  /** Provider `sub` — the stable account key. */
  subject: string;
  /** Provider-asserted email, or null (e.g. Apple private relay / not shared). */
  email: string | null;
  /** Whether the provider asserts the email is verified (gates auto-linking). */
  emailVerified: boolean;
  /** Display name when present (Apple supplies it only on first auth, via the app). */
  name: string | null;
}

/**
 * Verifies provider ID tokens against the provider JWKS (signature + iss/aud/exp).
 * Never trusts client-supplied identity claims. Throws ProviderTokenInvalidError
 * on any failure. Provider specifics live in the adapter.
 */
export interface ProviderVerifier {
  verifyGoogle(idToken: string): Promise<VerifiedProviderIdentity>;
  verifyApple(idToken: string, firstAuthName?: string | null): Promise<VerifiedProviderIdentity>;
}
