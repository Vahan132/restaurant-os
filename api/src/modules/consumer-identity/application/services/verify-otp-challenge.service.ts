import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import { isLocked, registerFailure } from '../../domain/services/otp-lockout';
import {
  OtpInvalidOrExpiredError,
  OtpLockedOutError,
} from '../../domain/consumer-identity.errors';
import {
  CONSUMER_OTP_THROTTLE_REPOSITORY,
  ConsumerOtpThrottleRepository,
} from '../../domain/repositories/consumer-otp-throttle.repository';
import { PHONE_OTP_REPOSITORY, PhoneOtpRepository } from '../../domain/repositories/phone-otp.repository';
import { OTP_CODE_HASHER, OtpCodeHasher } from '../ports/otp-code-hasher';

/**
 * Raw OTP challenge verification (no account/session concerns). Shared by phone
 * login (VerifyPhoneOtp) and phone change (ConfirmPhoneChange).
 *
 * On success: consumes the challenge + clears the throttle. On failure: feeds the
 * reused lockout primitive and throws OTP_INVALID_OR_EXPIRED / OTP_LOCKED_OUT.
 */
@Injectable()
export class VerifyOtpChallenge {
  constructor(
    @Inject(CONSUMER_OTP_THROTTLE_REPOSITORY)
    private readonly throttles: ConsumerOtpThrottleRepository,
    @Inject(PHONE_OTP_REPOSITORY) private readonly otps: PhoneOtpRepository,
    @Inject(OTP_CODE_HASHER) private readonly hasher: OtpCodeHasher,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Verifies `code` for `phone` (E.164, already normalized). Throws on failure. */
  async execute(phone: string, code: string): Promise<void> {
    const now = new Date();
    const throttle = await this.throttles.findByPhone(phone);
    if (isLocked(throttle, now)) throw new OtpLockedOutError();

    const policy = {
      maxAttempts: this.config.get('OTP_MAX_ATTEMPTS', { infer: true }),
      lockoutMs: this.config.get('OTP_LOCKOUT_MINUTES', { infer: true }) * 60 * 1000,
    };

    const active = await this.otps.findActiveByPhone(phone, now);
    if (!active) {
      await this.fail(phone, throttle, policy, now);
      return; // unreachable (fail throws)
    }

    await this.otps.incrementAttempt(active.id);
    const ok = await this.hasher.verify(active.codeHash, code);
    if (!ok) {
      await this.fail(phone, throttle, policy, now);
      return;
    }

    await this.otps.markConsumed(active.id, now);
    await this.throttles.clear(phone);
  }

  private async fail(
    phone: string,
    current: { phone: string; failedAttempts: number; lockedUntil: Date | null } | null,
    policy: { maxAttempts: number; lockoutMs: number },
    now: Date,
  ): Promise<never> {
    const next = registerFailure(current, phone, policy, now);
    await this.throttles.save(next);
    if (isLocked(next, now)) throw new OtpLockedOutError();
    throw new OtpInvalidOrExpiredError();
  }
}
