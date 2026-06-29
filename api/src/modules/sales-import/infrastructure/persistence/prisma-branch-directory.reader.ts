import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  BranchDirectoryEntry,
  BranchDirectoryReader,
} from '../../application/ports/branch-directory.reader';

@Injectable()
export class PrismaBranchDirectoryReader implements BranchDirectoryReader {
  constructor(private readonly prisma: PrismaService) {}

  async listBranches(restaurantId: string): Promise<BranchDirectoryEntry[]> {
    const rows = await this.prisma.branch.findMany({
      where: { restaurantId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true },
    });
    return rows.map((r) => ({ id: r.id, name: r.name }));
  }
}
