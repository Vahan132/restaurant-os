import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';
import { UseCase } from '../../../../shared/application/use-case';
import { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import { E164Phone } from '../../domain/value-objects/e164-phone';
import { isLocked } from '../../domain/services/otp-lockout';
import { OtpRequestRateLimitedError } from '../../domain/consumer-identity.errors';
import {
  CONSUMER_OTP_THROTTLE_REPOSITORY,
  ConsumerOtpThrottleRepository,
} from '../../domain/repositories/consumer-otp-throttle.repository';
import { PHONE_OTP_REPOSITORY, PhoneOtpRepository } from '../../domain/repositories/phone-otp.repository';
import { OTP_CODE_HASHER, OtpCodeHasher } from '../ports/otp-code-hasher';
import { SMS_SENDER, SmsSender } from '../ports/sms-sender';
import { otpMessage } from '../../infrastructure/services/sms-message';

export interface RequestPhoneOtpInput {
  phone: string;
  /** Preferred SMS locale (hy/ru/en). */
  locale?: string | null;
}

/**
 * Issue a phone OTP: normalize → rate-limit (reused throttle + resend cooldown) →
 * store a HASHED code with a short TTL → send via SmsSender.
 *
 * Critically, SMS send is best-effort: a send failure is logged but MUST NOT abort
 * OTP record creation (the record is already committed before send), so a flaky
 * gateway can't deny a user the ability to verify a code that was actually queued.
 */
@Injectable()
export class RequestPhoneOtpUseCase implements UseCase<RequestPhoneOtpInput, void> {
  private readonly logger = new Logger(RequestPhoneOtpUseCase.name);

  constructor(
    @Inject(CONSUMER_OTP_THROTTLE_REPOSITORY)
    private readonly throttles: ConsumerOtpThrottleRepository,
    @Inject(PHONE_OTP_REPOSITORY) private readonly otps: PhoneOtpRepository,
    @Inject(OTP_CODE_HASHER) private readonly hasher: OtpCodeHasher,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async execute(input: RequestPhoneOtpInput): Promise<void> {
    const phone = E164Phone.normalizeOrThrow(input.phone);
    const now = new Date();

    // Lockout (too many recent failures) → treat as rate-limited.
    const throttle = await this.throttles.findByPhone(phone);
    if (isLocked(throttle, now)) {
      throw new OtpRequestRateLimitedError();
    }

    // Resend cooldown: refuse if an active code was just sent.
    const cooldownMs = this.config.get('OTP_RESEND_COOLDOWN_SECONDS', { infer: true }) * 1000;
    const active = await this.otps.findActiveByPhone(phone, now);
    if (active && now.getTime() - active.createdAt.getTime() < cooldownMs) {
      throw new OtpRequestRateLimitedError();
    }

    // Generate + store a hashed code.
    const length = this.config.get('OTP_CODE_LENGTH', { infer: true });
    const code = generateNumericCode(length);
    const ttlMs = this.config.get('OTP_TTL_MINUTES', { infer: true }) * 60 * 1000;
    const codeHash = await this.hasher.hash(code);
    await this.otps.create({ phone, codeHash, expiresAt: new Date(now.getTime() + ttlMs) });

    // Best-effort send — never let a gateway failure abort the (already-committed) OTP.
    try {
      await this.sms.send({ to: phone, body: otpMessage(code, input.locale) });
    } catch (err) {
      this.logger.error(`OTP SMS send failed for ${phone}: ${(err as Error).message}`);
    }
  }
}

function generateNumericCode(length: number): string {
  let code = '';
  for (let i = 0; i < length; i++) code += randomInt(0, 10).toString();
  return code;
}
