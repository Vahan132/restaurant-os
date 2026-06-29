import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { AuthPolicyReader, BranchIpPolicy } from '../../application/ports/auth-policy.reader';

/**
 * Prisma-backed AuthPolicyReader. Reads the `branches` and `restaurant_settings`
 * tables so the identity login flow can apply branch IP policy + the admin
 * anchoring toggle without importing the restaurant module.
 */
@Injectable()
export class PrismaAuthPolicyReader implements AuthPolicyReader {
  constructor(private readonly prisma: PrismaService) {}

  async getBranchIpPolicy(restaurantId: string, branchId: string): Promise<BranchIpPolicy | null> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, restaurantId, deletedAt: null },
      select: { ipBindingMode: true, ipAllowlist: true },
    });
    if (!branch) {
      return null;
    }
    return { mode: branch.ipBindingMode, allowlist: branch.ipAllowlist };
  }

  async allowsUnanchoredAdminLogin(restaurantId: string): Promise<boolean> {
    const settings = await this.prisma.restaurantSettings.findUnique({
      where: { restaurantId },
      select: { allowUnanchoredAdminLogin: true },
    });
    // Default to the safe (anchored) behavior if settings are missing.
    return settings?.allowUnanchoredAdminLogin ?? false;
  }
}
