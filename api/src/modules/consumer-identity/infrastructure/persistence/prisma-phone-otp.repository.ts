import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  PhoneOtpRecord,
  PhoneOtpRepository,
} from '../../domain/repositories/phone-otp.repository';

@Injectable()
export class PrismaPhoneOtpRepository implements PhoneOtpRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    phone: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<PhoneOtpRecord> {
    const r = await this.prisma.phoneOtp.create({ data: input });
    return this.map(r);
  }

  async findActiveByPhone(phone: string, now: Date): Promise<PhoneOtpRecord | null> {
    const r = await this.prisma.phoneOtp.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });
    return r ? this.map(r) : null;
  }

  async incrementAttempt(id: string): Promise<void> {
    await this.prisma.phoneOtp.update({
      where: { id },
      data: { attemptCount: { increment: 1 } },
    });
  }

  async markConsumed(id: string, consumedAt: Date): Promise<void> {
    await this.prisma.phoneOtp.update({ where: { id }, data: { consumedAt } });
  }

  private map(r: {
    id: string;
    phone: string;
    codeHash: string;
    expiresAt: Date;
    consumedAt: Date | null;
    attemptCount: number;
    createdAt: Date;
  }): PhoneOtpRecord {
    return {
      id: r.id,
      phone: r.phone,
      codeHash: r.codeHash,
      expiresAt: r.expiresAt,
      consumedAt: r.consumedAt,
      attemptCount: r.attemptCount,
      createdAt: r.createdAt,
    };
  }
}
