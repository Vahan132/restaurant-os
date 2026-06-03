import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { PlatformUser } from '../../domain/entities/platform-user';
import { PlatformUserRepository } from '../../domain/repositories/platform-user.repository';
import { PlatformUserMapper } from './platform-user.mapper';

@Injectable()
export class PrismaPlatformUserRepository implements PlatformUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<PlatformUser | null> {
    const record = await this.prisma.platformUser.findFirst({ where: { id, deletedAt: null } });
    return record ? PlatformUserMapper.toDomain(record) : null;
  }

  async findByEmail(email: string): Promise<PlatformUser | null> {
    const record = await this.prisma.platformUser.findFirst({ where: { email, deletedAt: null } });
    return record ? PlatformUserMapper.toDomain(record) : null;
  }

  async update(user: PlatformUser): Promise<void> {
    await this.prisma.platformUser.update({
      where: { id: user.id },
      data: PlatformUserMapper.toUpdate(user),
    });
  }
}
