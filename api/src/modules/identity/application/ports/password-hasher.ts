/** DI token for the PasswordHasher port. */
export const PASSWORD_HASHER = Symbol('PasswordHasher');

/**
 * PasswordHasher port. Implemented in infrastructure (argon2).
 * The domain/application never deal with raw hashing internals.
 */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}
