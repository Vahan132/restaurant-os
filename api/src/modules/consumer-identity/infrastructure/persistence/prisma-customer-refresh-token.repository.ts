import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  CustomerRefreshTokenRepository,
  RefreshTokenRecord,
} from '../../domain/repositories/customer-refresh-token.repository';

@Injectable()
export class PrismaCustomerRefreshTokenRepository implements CustomerRefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    customerAccountId: string;
    familyId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord> {
    const r = await this.prisma.customerRefreshToken.create({ data: input });
    return this.map(r);
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const r = await this.prisma.customerRefreshToken.findUnique({ where: { tokenHash } });
    return r ? this.map(r) : null;
  }

  async markRevoked(id: string, replacedById: string | null): Promise<void> {
    await this.prisma.customerRefreshToken.update({
      where: { id },
      data: { revokedAt: new Date(), replacedById },
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.customerRefreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private map(r: {
    id: string;
    customerAccountId: string;
    familyId: string;
    tokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
    replacedById: string | null;
  }): RefreshTokenRecord {
    return {
      id: r.id,
      customerAccountId: r.customerAccountId,
      familyId: r.familyId,
      tokenHash: r.tokenHash,
      expiresAt: r.expiresAt,
      revokedAt: r.revokedAt,
      replacedById: r.replacedById,
    };
  }
}
