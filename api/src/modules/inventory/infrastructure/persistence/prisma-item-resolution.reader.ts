import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  ItemResolutionReader,
  ItemResolutionRow,
} from '../../application/ports/item-resolution.reader';

/** Coerce InventoryItem.allergenOverride (Json?) to string[] | null (CATALOG-1). */
function toAllergenOverride(value: unknown): string[] | null {
  if (value === null || value === undefined) {
    return null; // null = defer to the catalog (distinct from an empty override)
  }
  if (Array.isArray(value)) {
    return value.filter((s): s is string => typeof s === 'string');
  }
  return null;
}

/**
 * Reads InventoryItem resolution inputs + display fields by id (CATALOG-3).
 * Tenant-scoped via restaurantId + branchId; excludes soft-deleted items.
 */
@Injectable()
export class PrismaItemResolutionReader implements ItemResolutionReader {
  constructor(private readonly prisma: PrismaService) {}

  async byIds(
    restaurantId: string,
    branchId: string,
    itemIds: readonly string[],
  ): Promise<Map<string, ItemResolutionRow>> {
    const out = new Map<string, ItemResolutionRow>();
    const ids = [...new Set(itemIds)];
    if (ids.length === 0) {
      return out;
    }
    const rows = await this.prisma.inventoryItem.findMany({
      where: { id: { in: ids }, restaurantId, branchId, deletedAt: null },
      select: {
        id: true,
        name: true,
        baseUnit: true,
        catalogItemId: true,
        allergenOverride: true,
      },
    });
    for (const r of rows) {
      out.set(r.id, {
        itemId: r.id,
        name: r.name,
        baseUnit: r.baseUnit,
        catalogItemId: r.catalogItemId ?? null,
        allergenOverride: toAllergenOverride(r.allergenOverride),
      });
    }
    return out;
  }
}
