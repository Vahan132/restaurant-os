import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  WriteOffSummary,
  WriteOffSummaryFilter,
  WriteOffSummaryReader,
  WriteOffSummaryRow,
} from '../../application/ports/write-off-summary.reader';
import { WriteOffReason } from '../../domain/enums';

/**
 * Waste summary grouped by reason (§5). Reason lives on the write-off header, so
 * we sum each non-voided write-off's line costs into its reason bucket.
 */
@Injectable()
export class PrismaWriteOffSummaryReader implements WriteOffSummaryReader {
  constructor(private readonly prisma: PrismaService) {}

  async summary(filter: WriteOffSummaryFilter): Promise<WriteOffSummary> {
    const where: Prisma.WriteOffWhereInput = {
      restaurantId: filter.restaurantId,
      branchId: filter.branchId,
      voidedAt: null,
      ...(filter.from || filter.to
        ? {
            occurredAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
    };

    const writeOffs = await this.prisma.writeOff.findMany({
      where,
      select: { reason: true, lines: { select: { costAmount: true } } },
    });

    const buckets = new Map<string, { lineCount: number; totalCost: number }>();
    let overallLineCount = 0;
    let overallTotalCostAmount = 0;
    for (const w of writeOffs) {
      const bucket = buckets.get(w.reason) ?? { lineCount: 0, totalCost: 0 };
      for (const line of w.lines) {
        bucket.lineCount += 1;
        bucket.totalCost += line.costAmount;
        overallLineCount += 1;
        overallTotalCostAmount += line.costAmount;
      }
      buckets.set(w.reason, bucket);
    }

    const byReason: WriteOffSummaryRow[] = [...buckets.entries()].map(([reason, b]) => ({
      reason: reason as WriteOffReason,
      lineCount: b.lineCount,
      totalCostAmount: b.totalCost,
    }));
    byReason.sort((a, b) => b.totalCostAmount - a.totalCostAmount);

    return { byReason, overallLineCount, overallTotalCostAmount };
  }
}
