import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { BranchMembership } from '../../domain/entities/branch-membership';
import { BranchMembershipRepository } from '../../domain/repositories/branch-membership.repository';
import { BranchMembershipMapper } from './branch-membership.mapper';

/** Prisma-backed BranchMembershipRepository (keyed by branchId + userId). */
@Injectable()
export class PrismaBranchMembershipRepository implements BranchMembershipRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserAndBranch(userId: string, branchId: string): Promise<BranchMembership | null> {
    const record = await this.prisma.branchMembership.findUnique({
      where: { branchId_userId: { branchId, userId } },
    });
    return record ? BranchMembershipMapper.toDomain(record) : null;
  }

  async listByUser(restaurantId: string, userId: string): Promise<BranchMembership[]> {
    const records = await this.prisma.branchMembership.findMany({
      where: { restaurantId, userId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(BranchMembershipMapper.toDomain);
  }

  async upsert(membership: BranchMembership): Promise<void> {
    await this.prisma.branchMembership.upsert({
      where: { branchId_userId: { branchId: membership.branchId, userId: membership.userId } },
      create: {
        id: membership.id,
        restaurantId: membership.restaurantId,
        branchId: membership.branchId,
        userId: membership.userId,
        roleId: membership.roleId,
        createdByUserId: membership.createdByUserId,
        createdAt: membership.createdAt,
        updatedAt: membership.updatedAt,
      },
      // On conflict only the granted role (and updatedAt) change; the original
      // creator/createdAt are preserved.
      update: {
        roleId: membership.roleId,
        updatedAt: new Date(),
      },
    });
  }

  async deleteByUserAndBranch(userId: string, branchId: string): Promise<void> {
    await this.prisma.branchMembership.deleteMany({ where: { branchId, userId } });
  }
}
