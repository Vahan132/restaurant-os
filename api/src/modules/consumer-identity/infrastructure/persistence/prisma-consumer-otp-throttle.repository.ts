import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  ConsumerOtpThrottleRepository,
  ConsumerOtpThrottleState,
} from '../../domain/repositories/consumer-otp-throttle.repository';

/** Mirrors PrismaStepUpThrottleRepository, keyed by phone instead of deviceId. */
@Injectable()
export class PrismaConsumerOtpThrottleRepository implements ConsumerOtpThrottleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByPhone(phone: string): Promise<ConsumerOtpThrottleState | null> {
    const r = await this.prisma.consumerOtpThrottle.findUnique({ where: { phone } });
    return r
      ? { phone: r.phone, failedAttempts: r.failedAttempts, lockedUntil: r.lockedUntil }
      : null;
  }

  async save(state: ConsumerOtpThrottleState): Promise<void> {
    await this.prisma.consumerOtpThrottle.upsert({
      where: { phone: state.phone },
      create: {
        phone: state.phone,
        failedAttempts: state.failedAttempts,
        lockedUntil: state.lockedUntil,
      },
      update: { failedAttempts: state.failedAttempts, lockedUntil: state.lockedUntil },
    });
  }

  async clear(phone: string): Promise<void> {
    await this.prisma.consumerOtpThrottle.deleteMany({ where: { phone } });
  }
}
