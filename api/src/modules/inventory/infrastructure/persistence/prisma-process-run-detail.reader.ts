import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  ProcessRunDetail,
  ProcessRunDetailReader,
} from '../../application/ports/process-run-detail.reader';
import { PROCESS_RUN_REF_TYPE, StockMovementType } from '../../domain/enums';
import { StockLayerMapper, StockMovementMapper } from './inventory.mappers';

/**
 * Assembles a run's ledger footprint via refType=PROCESS_RUN, refId=run.id:
 * the consumed (PROCESS_OUT) + produced (PROCESS_IN) movements and the layers
 * created by the run. Tenant-scoped by restaurantId.
 */
@Injectable()
export class PrismaProcessRunDetailReader implements ProcessRunDetailReader {
  constructor(private readonly prisma: PrismaService) {}

  async detail(restaurantId: string, branchId: string, runId: string): Promise<ProcessRunDetail> {
    const movements = await this.prisma.stockMovement.findMany({
      where: { restaurantId, branchId, refType: PROCESS_RUN_REF_TYPE, refId: runId },
      orderBy: { createdAt: 'asc' },
    });

    const consumed = movements.filter((m) => m.type === StockMovementType.PROCESS_OUT);
    const produced = movements.filter((m) => m.type === StockMovementType.PROCESS_IN);

    const layerIds = produced.map((m) => m.layerId).filter((id): id is string => id !== null);

    const layers = layerIds.length
      ? await this.prisma.stockLayer.findMany({
          where: { restaurantId, branchId, id: { in: layerIds } },
          orderBy: { receivedAt: 'asc' },
        })
      : [];

    return {
      consumed: consumed.map(StockMovementMapper.toDomain),
      produced: produced.map(StockMovementMapper.toDomain),
      producedLayers: layers.map(StockLayerMapper.toDomain),
    };
  }
}
