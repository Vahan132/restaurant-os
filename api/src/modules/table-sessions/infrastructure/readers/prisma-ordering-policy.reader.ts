import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { EffectiveOrderingPolicy } from '../../domain/ordering-flow.policy';
import { OrderingPolicyReader } from '../../application/ports/ordering-policy.reader';

/**
 * Assembles the EFFECTIVE ordering policy: the restaurant ceiling
 * (RestaurantSettings.enableCustomerOrdering / enableQrMenu) plus the branch
 * OrderingConfig flags. Returns null if the branch doesn't exist.
 */
@Injectable()
export class PrismaOrderingPolicyReader implements OrderingPolicyReader {
  constructor(private readonly prisma: PrismaService) {}

  async get(restaurantId: string, branchId: string): Promise<EffectiveOrderingPolicy | null> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, restaurantId, deletedAt: null },
      select: {
        orderingPrepaymentEnabled: true,
        orderingPayAtEndEnabled: true,
        orderingQrEnabled: true,
      },
    });
    if (!branch) {
      return null;
    }
    const settings = await this.prisma.restaurantSettings.findUnique({
      where: { restaurantId },
      select: { enableCustomerOrdering: true, enableQrMenu: true },
    });
    return {
      restaurantOrderingEnabled: settings?.enableCustomerOrdering ?? false,
      restaurantQrMenuEnabled: settings?.enableQrMenu ?? false,
      prepaymentEnabled: branch.orderingPrepaymentEnabled,
      payAtEndEnabled: branch.orderingPayAtEndEnabled,
      qrOrderingEnabled: branch.orderingQrEnabled,
    };
  }
}
