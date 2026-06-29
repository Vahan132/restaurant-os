import { Injectable } from '@nestjs/common';
import { Branch as PrismaBranch } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { Branch, BranchIpBindingMode, BranchStatus } from '../../domain/entities/branch';
import { BranchRepository } from '../../domain/repositories/branch.repository';

@Injectable()
export class PrismaBranchRepository implements BranchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByRestaurant(restaurantId: string): Promise<Branch[]> {
    const records = await this.prisma.branch.findMany({
      where: { restaurantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByIdInRestaurant(restaurantId: string, branchId: string): Promise<Branch | null> {
    const r = await this.prisma.branch.findFirst({
      where: { id: branchId, restaurantId, deletedAt: null },
    });
    return r ? this.toDomain(r) : null;
  }

  async findDefault(restaurantId: string): Promise<Branch | null> {
    const r = await this.prisma.branch.findFirst({
      where: { restaurantId, isDefault: true, status: 'ACTIVE', deletedAt: null },
    });
    return r ? this.toDomain(r) : null;
  }

  async countActive(restaurantId: string): Promise<number> {
    return this.prisma.branch.count({
      where: { restaurantId, status: 'ACTIVE', deletedAt: null },
    });
  }

  async existsBySlug(restaurantId: string, slug: string): Promise<boolean> {
    // Spans soft-deleted rows: the unique index is on (restaurantId, slug).
    const count = await this.prisma.branch.count({ where: { restaurantId, slug } });
    return count > 0;
  }

  async makeDefault(restaurantId: string, branchId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.branch.updateMany({
        where: { restaurantId, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.branch.updateMany({
        where: { id: branchId, restaurantId, deletedAt: null },
        data: { isDefault: true },
      }),
    ]);
  }

  async create(branch: Branch): Promise<void> {
    await this.prisma.branch.create({
      data: {
        id: branch.id,
        restaurantId: branch.restaurantId,
        name: branch.name,
        slug: branch.slug,
        isDefault: branch.isDefault,
        status: branch.status as BranchStatus,
        createdAt: branch.createdAt,
        updatedAt: branch.updatedAt,
      },
    });
  }

  async update(branch: Branch): Promise<void> {
    // NOTE: isDefault is moved only via makeDefault() (atomic swap), never here.
    await this.prisma.branch.updateMany({
      where: { id: branch.id, restaurantId: branch.restaurantId },
      data: {
        name: branch.name,
        status: branch.status as BranchStatus,
        ipBindingMode: branch.ipBindingMode as BranchIpBindingMode,
        ipAllowlist: branch.ipAllowlist,
        updatedAt: branch.updatedAt,
      },
    });
  }

  private toDomain(r: PrismaBranch): Branch {
    return Branch.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      name: r.name,
      slug: r.slug,
      isDefault: r.isDefault,
      status: r.status as BranchStatus,
      ipBindingMode: r.ipBindingMode as BranchIpBindingMode,
      ipAllowlist: r.ipAllowlist,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
    });
  }
}
