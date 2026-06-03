import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { User } from '../../domain/entities/user';
import { UserListFilter, UserRepository } from '../../domain/repositories/user.repository';
import { UserMapper } from './user.mapper';

/** Prisma-backed UserRepository. Every method is scoped by organizationId. */
@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(organizationId: string, id: string): Promise<User | null> {
    const record = await this.prisma.user.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    return record ? UserMapper.toDomain(record) : null;
  }

  async findByIdGlobal(id: string): Promise<User | null> {
    const record = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    return record ? UserMapper.toDomain(record) : null;
  }

  async findByEmail(organizationId: string, email: string): Promise<User | null> {
    const record = await this.prisma.user.findFirst({
      where: { organizationId, email, deletedAt: null },
    });
    return record ? UserMapper.toDomain(record) : null;
  }

  async findByEmailGlobalUnique(email: string): Promise<User | null> {
    // take 2 so we can detect ambiguity (same email across multiple orgs).
    const records = await this.prisma.user.findMany({
      where: { email, deletedAt: null },
      take: 2,
    });
    return records.length === 1 ? UserMapper.toDomain(records[0]) : null;
  }

  async existsByEmail(organizationId: string, email: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { organizationId, email, deletedAt: null },
    });
    return count > 0;
  }

  async list(filter: UserListFilter): Promise<{ items: User[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      organizationId: filter.organizationId,
      deletedAt: null,
      ...(filter.restaurantId ? { restaurantId: filter.restaurantId } : {}),
      ...(filter.search
        ? {
            OR: [
              { fullName: { contains: filter.search, mode: 'insensitive' } },
              { email: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [records, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items: records.map(UserMapper.toDomain), total };
  }

  async create(user: User): Promise<void> {
    await this.prisma.user.create({ data: UserMapper.toCreate(user) });
  }

  async update(user: User): Promise<void> {
    // updateMany with the org in the filter guarantees tenant isolation.
    await this.prisma.user.updateMany({
      where: { id: user.id, organizationId: user.organizationId },
      data: UserMapper.toUpdate(user),
    });
  }

  async softDelete(organizationId: string, id: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
}
