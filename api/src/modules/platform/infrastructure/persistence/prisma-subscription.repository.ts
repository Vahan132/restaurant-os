import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { Subscription, SubscriptionStatus } from '../../domain/entities/subscription';
import { SubscriptionRepository } from '../../domain/repositories/subscription.repository';

@Injectable()
export class PrismaSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByOrganizationId(organizationId: string): Promise<Subscription | null> {
    const r = await this.prisma.subscription.findUnique({ where: { organizationId } });
    if (!r) {
      return null;
    }
    return Subscription.reconstitute(r.id, {
      organizationId: r.organizationId,
      planId: r.planId,
      status: r.status as SubscriptionStatus,
      trialEndsAt: r.trialEndsAt,
      currentPeriodStart: r.currentPeriodStart,
      currentPeriodEnd: r.currentPeriodEnd,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }

  async update(subscription: Subscription): Promise<void> {
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        planId: subscription.planId,
        status: subscription.status as SubscriptionStatus,
        updatedAt: subscription.updatedAt,
      },
    });
  }
}
