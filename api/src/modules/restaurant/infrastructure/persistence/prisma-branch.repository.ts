import { Injectable } from '@nestjs/common';
import { Branch as PrismaBranch } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { Branch, BranchStatus } from '../../domain/entities/branch';
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

  async countActive(restaurantId: string): Promise<number> {
    return this.prisma.branch.count({
      where: { restaurantId, status: 'ACTIVE', deletedAt: null },
    });
  }

  async create(branch: Branch): Promise<void> {
    await this.prisma.branch.create({
      data: {
        id: branch.id,
        restaurantId: branch.restaurantId,
        name: branch.name,
        status: branch.status as BranchStatus,
        createdAt: branch.createdAt,
        updatedAt: branch.updatedAt,
      },
    });
  }

  async update(branch: Branch): Promise<void> {
    await this.prisma.branch.updateMany({
      where: { id: branch.id, restaurantId: branch.restaurantId },
      data: {
        name: branch.name,
        status: branch.status as BranchStatus,
        updatedAt: branch.updatedAt,
      },
    });
  }

  private toDomain(r: PrismaBranch): Branch {
    return Branch.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      name: r.name,
      status: r.status as BranchStatus,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
    });
  }
}
