import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { FloorPlanFloor, FloorPlanReader } from '../../application/ports/floor-plan.reader';

/**
 * Builds the floor-plan read model. ACTIVE floors (ordered) with their
 * non-deleted tables. INACTIVE floors + soft-deleted rows are excluded.
 */
@Injectable()
export class PrismaFloorPlanReader implements FloorPlanReader {
  constructor(private readonly prisma: PrismaService) {}

  async getFloorPlan(restaurantId: string): Promise<FloorPlanFloor[]> {
    const floors = await this.prisma.floor.findMany({
      where: { restaurantId, status: 'ACTIVE', deletedAt: null },
      orderBy: { displayOrder: 'asc' },
    });

    const result: FloorPlanFloor[] = [];
    for (const floor of floors) {
      const tables = await this.prisma.restaurantTable.findMany({
        where: { restaurantId, floorId: floor.id, deletedAt: null },
        orderBy: { name: 'asc' },
      });
      result.push({
        id: floor.id,
        name: floor.name,
        description: floor.description,
        displayOrder: floor.displayOrder,
        tables: tables.map((t) => ({
          id: t.id,
          name: t.name,
          seatCapacity: t.seatCapacity,
          status: t.status,
          qrIdentifier: t.qrIdentifier,
        })),
      });
    }
    return result;
  }
}
