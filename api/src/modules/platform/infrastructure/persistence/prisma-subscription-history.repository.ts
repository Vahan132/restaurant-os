import { Injectable } from '@nestjs/common';
import { SubscriptionHistory as PrismaRow } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  ChangedByType,
  SubscriptionHistoryRecord,
  SubscriptionHistoryRepository,
} from '../../application/ports/subscription-history.repository';

function toRecord(r: PrismaRow): SubscriptionHistoryRecord {
  return {
    id: r.id,
    organizationId: r.organizationId,
    subscriptionId: r.subscriptionId,
    fromStatus: r.fromStatus,
    toStatus: r.toStatus,
    fromPlanId: r.fromPlanId,
    toPlanId: r.toPlanId,
    changedByType: r.changedByType as ChangedByType,
    changedByUserId: r.changedByUserId,
    reason: r.reason,
    createdAt: r.createdAt,
  };
}

@Injectable()
export class PrismaSubscriptionHistoryRepository implements SubscriptionHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async append(record: SubscriptionHistoryRecord): Promise<void> {
    await this.prisma.subscriptionHistory.create({ data: record });
  }

  async listByOrg(
    organizationId: string,
    skip: number,
    take: number,
  ): Promise<{ items: SubscriptionHistoryRecord[]; total: number }> {
    const where = { organizationId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.subscriptionHistory.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.subscriptionHistory.count({ where }),
    ]);
    return { items: rows.map(toRecord), total };
  }

  async recent(organizationId: string, limit: number): Promise<SubscriptionHistoryRecord[]> {
    const rows = await this.prisma.subscriptionHistory.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(toRecord);
  }
}
