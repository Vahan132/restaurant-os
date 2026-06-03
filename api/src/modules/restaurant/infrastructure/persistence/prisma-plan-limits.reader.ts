import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { PlanLimitsReader } from '../../application/ports/plan-limits.reader';

/** Reads maxBranchesPerRestaurant from the org's subscription -> plan features. */
@Injectable()
export class PrismaPlanLimitsReader implements PlanLimitsReader {
  constructor(private readonly prisma: PrismaService) {}

  async maxBranchesPerRestaurant(organizationId: string): Promise<number | null> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { organizationId },
      select: { plan: { select: { features: true } } },
    });
    const features = subscription?.plan?.features as
      | { maxBranchesPerRestaurant?: number }
      | null
      | undefined;
    const max = features?.maxBranchesPerRestaurant;
    return typeof max === 'number' ? max : null;
  }
}
