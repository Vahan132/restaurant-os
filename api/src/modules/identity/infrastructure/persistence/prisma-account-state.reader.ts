import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { AccountState, AccountStateReader } from '../../application/ports/account-state.reader';

/** Reads Organization.status + Subscription.status for account-state gating. */
@Injectable()
export class PrismaAccountStateReader implements AccountStateReader {
  constructor(private readonly prisma: PrismaService) {}

  async getByOrganization(organizationId: string): Promise<AccountState | null> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { status: true, subscription: { select: { status: true } } },
    });
    if (!org) {
      return null;
    }
    return {
      organizationStatus: org.status,
      subscriptionStatus: org.subscription?.status ?? null,
    };
  }
}
