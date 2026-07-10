import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  ProcessGraphEdgesReader,
} from '../../application/ports/process-graph-edges.reader';
import { ProcessEdgeSet } from '../../domain/services/process-graph-cycle';

/**
 * Reads every non-deleted process in the branch with its input/output item ids
 * (CATALOG-1b §5). Tenant-scoped via Process.restaurantId + branchId.
 */
@Injectable()
export class PrismaProcessGraphEdgesReader implements ProcessGraphEdgesReader {
  constructor(private readonly prisma: PrismaService) {}

  async loadEdges(restaurantId: string, branchId: string): Promise<ProcessEdgeSet[]> {
    const rows = await this.prisma.process.findMany({
      where: { restaurantId, branchId, deletedAt: null },
      select: {
        id: true,
        inputs: { select: { itemId: true } },
        outputs: { select: { itemId: true } },
      },
    });
    return rows.map((r) => ({
      processId: r.id,
      inputItemIds: r.inputs.map((i) => i.itemId),
      outputItemIds: r.outputs.map((o) => o.itemId),
    }));
  }
}
