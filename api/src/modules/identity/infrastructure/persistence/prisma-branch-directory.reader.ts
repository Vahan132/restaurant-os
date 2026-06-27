import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  BranchDirectoryEntry,
  BranchDirectoryReader,
} from '../../application/ports/branch-directory.reader';

/**
 * Prisma-backed BranchDirectoryReader. Reads the `branches` table directly so the
 * identity module can resolve branch access without importing the restaurant
 * module. Only ACTIVE, non-deleted branches are returned.
 */
@Injectable()
export class PrismaBranchDirectoryReader implements BranchDirectoryReader {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(restaurantId: string): Promise<BranchDirectoryEntry[]> {
    const records = await this.prisma.branch.findMany({
      where: { restaurantId, status: 'ACTIVE', deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, isDefault: true },
    });
    return records;
  }

  async findActive(restaurantId: string, branchId: string): Promise<BranchDirectoryEntry | null> {
    const record = await this.prisma.branch.findFirst({
      where: { id: branchId, restaurantId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true, isDefault: true },
    });
    return record ?? null;
  }

  async findDefault(restaurantId: string): Promise<BranchDirectoryEntry | null> {
    const record = await this.prisma.branch.findFirst({
      where: { restaurantId, isDefault: true, status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true, isDefault: true },
    });
    return record ?? null;
  }
}
