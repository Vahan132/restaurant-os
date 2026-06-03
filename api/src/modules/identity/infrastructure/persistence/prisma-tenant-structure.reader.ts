import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { TenantStructureReader } from '../../application/ports/tenant-structure.reader';

/** Prisma-backed checks against the tenancy backbone (Restaurant/Branch). */
@Injectable()
export class PrismaTenantStructureReader implements TenantStructureReader {
  constructor(private readonly prisma: PrismaService) {}

  async restaurantInOrg(organizationId: string, restaurantId: string): Promise<boolean> {
    const count = await this.prisma.restaurant.count({
      where: { id: restaurantId, organizationId, deletedAt: null },
    });
    return count > 0;
  }

  async branchInRestaurant(restaurantId: string, branchId: string): Promise<boolean> {
    const count = await this.prisma.branch.count({
      where: { id: branchId, restaurantId, deletedAt: null },
    });
    return count > 0;
  }
}
