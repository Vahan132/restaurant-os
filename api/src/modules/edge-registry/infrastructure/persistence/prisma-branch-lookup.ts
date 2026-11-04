import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { BranchLookup } from '../../application/ports/branch-lookup.port';

@Injectable()
export class PrismaBranchLookup implements BranchLookup {
  constructor(private readonly prisma: PrismaService) {}

  async existsActive(restaurantId: string, branchId: string): Promise<boolean> {
    const row = await this.prisma.branch.findFirst({
      where: { id: branchId, restaurantId, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    return row !== null;
  }
}
