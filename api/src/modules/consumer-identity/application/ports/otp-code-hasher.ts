/** DI token for the OtpCodeHasher port. */
export const OTP_CODE_HASHER = Symbol('OtpCodeHasher');

/** Hashes + verifies short OTP codes (argon2 impl). Codes are never stored plain. */
export interface OtpCodeHasher {
  hash(code: string): Promise<string>;
  verify(hash: string, code: string): Promise<boolean>;
}
