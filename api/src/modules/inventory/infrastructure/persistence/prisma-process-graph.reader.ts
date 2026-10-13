import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { InventoryItem } from '../../domain/entities/inventory-item';
import { ProcessGraphReader, RelatedItems } from '../../application/ports/process-graph.reader';
import { InventoryItemMapper } from './inventory.mappers';

/**
 * Resolves raw↔processed counterparts from the process graph. Tenant-scoped via
 * the parent Process.restaurantId; excludes soft-deleted processes and items.
 */
@Injectable()
export class PrismaProcessGraphReader implements ProcessGraphReader {
  constructor(private readonly prisma: PrismaService) {}

  async related(restaurantId: string, branchId: string, itemId: string): Promise<RelatedItems> {
    const [outputOf, inputOf] = await Promise.all([
      // Processes that OUTPUT this item -> their input items = rawSources.
      this.prisma.processOutput.findMany({
        where: { itemId, process: { restaurantId, branchId, deletedAt: null } },
        select: { processId: true },
      }),
      // Processes that take this item as INPUT -> their output items = processedOutputs.
      this.prisma.processInput.findMany({
        where: { itemId, process: { restaurantId, branchId, deletedAt: null } },
        select: { processId: true },
      }),
    ]);

    const producingProcessIds = [...new Set(outputOf.map((r) => r.processId))];
    const consumingProcessIds = [...new Set(inputOf.map((r) => r.processId))];

    const [rawSourceLinks, processedOutputLinks] = await Promise.all([
      producingProcessIds.length
        ? this.prisma.processInput.findMany({
            where: { processId: { in: producingProcessIds } },
            select: { itemId: true },
          })
        : Promise.resolve([]),
      consumingProcessIds.length
        ? this.prisma.processOutput.findMany({
            where: { processId: { in: consumingProcessIds } },
            select: { itemId: true },
          })
        : Promise.resolve([]),
    ]);

    const rawSourceIds = [...new Set(rawSourceLinks.map((r) => r.itemId))].filter(
      (id) => id !== itemId,
    );
    const processedOutputIds = [...new Set(processedOutputLinks.map((r) => r.itemId))].filter(
      (id) => id !== itemId,
    );

    const [rawSources, processedOutputs] = await Promise.all([
      this.loadItems(restaurantId, branchId, rawSourceIds),
      this.loadItems(restaurantId, branchId, processedOutputIds),
    ]);
    return { rawSources, processedOutputs };
  }

  private async loadItems(
    restaurantId: string,
    branchId: string,
    ids: string[],
  ): Promise<InventoryItem[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.prisma.inventoryItem.findMany({
      where: { id: { in: ids }, restaurantId, branchId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return rows.map(InventoryItemMapper.toDomain);
  }
}
