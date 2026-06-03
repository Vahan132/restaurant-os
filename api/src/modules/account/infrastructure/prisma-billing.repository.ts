import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { BillingInfo, BillingRepository } from '../application/ports/billing.repository';

@Injectable()
export class PrismaBillingRepository implements BillingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(input: {
    id: string;
    organizationId: string;
    billingName?: string | null;
    billingEmail?: string | null;
    billingAddress?: string | null;
    taxId?: string | null;
  }): Promise<BillingInfo> {
    const data = {
      billingName: input.billingName ?? null,
      billingEmail: input.billingEmail ?? null,
      billingAddress: input.billingAddress ?? null,
      taxId: input.taxId ?? null,
    };
    const row = await this.prisma.organizationBillingInfo.upsert({
      where: { organizationId: input.organizationId },
      create: { id: input.id, organizationId: input.organizationId, ...data },
      update: data,
    });
    return {
      organizationId: row.organizationId,
      billingName: row.billingName,
      billingEmail: row.billingEmail,
      billingAddress: row.billingAddress,
      taxId: row.taxId,
    };
  }
}
