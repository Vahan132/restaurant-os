import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  NewPlatformRefreshToken,
  PlatformRefreshTokenRecord,
  PlatformRefreshTokenRepository,
} from '../../application/ports/platform-refresh-token.repository';

@Injectable()
export class PrismaPlatformRefreshTokenRepository implements PlatformRefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(token: NewPlatformRefreshToken): Promise<void> {
    await this.prisma.platformRefreshToken.create({
      data: {
        id: token.id,
        platformUserId: token.platformUserId,
        tokenHash: token.tokenHash,
        expiresAt: token.expiresAt,
      },
    });
  }

  async findByHash(tokenHash: string): Promise<PlatformRefreshTokenRecord | null> {
    const r = await this.prisma.platformRefreshToken.findFirst({ where: { tokenHash } });
    if (!r) {
      return null;
    }
    return {
      id: r.id,
      platformUserId: r.platformUserId,
      tokenHash: r.tokenHash,
      expiresAt: r.expiresAt,
      revokedAt: r.revokedAt,
      createdAt: r.createdAt,
    };
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.platformRefreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
