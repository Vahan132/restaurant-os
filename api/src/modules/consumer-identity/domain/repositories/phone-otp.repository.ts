export const PHONE_OTP_REPOSITORY = Symbol('PhoneOtpRepository');

export interface PhoneOtpRecord {
  id: string;
  phone: string;
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  attemptCount: number;
  createdAt: Date;
}

export interface PhoneOtpRepository {
  /** Create a new OTP challenge (code already hashed). */
  create(input: { phone: string; codeHash: string; expiresAt: Date }): Promise<PhoneOtpRecord>;
  /** Latest unconsumed, unexpired challenge for a phone, or null. */
  findActiveByPhone(phone: string, now: Date): Promise<PhoneOtpRecord | null>;
  incrementAttempt(id: string): Promise<void>;
  markConsumed(id: string, consumedAt: Date): Promise<void>;
}
