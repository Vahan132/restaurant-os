import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  CatalogItemReader,
  CatalogResolution,
} from '../../domain/repositories/catalog-item.reader';

const RESOLUTION_SELECT = {
  id: true,
  nameHy: true,
  nameRu: true,
  nameEn: true,
} as const;

interface ResolutionRow {
  id: string;
  nameHy: string;
  nameRu: string;
  nameEn: string;
}

function toResolution(row: ResolutionRow): CatalogResolution {
  return {
    catalogItemId: row.id,
    name: { hy: row.nameHy, ru: row.nameRu, en: row.nameEn },
  };
}

/**
 * Catalog read/validation over Prisma (global reference data, not tenant-scoped).
 * Resolves catalogItemId → its curated values. Never queries tenant inventory
 * (ADR §4 boundary — there is no relation to traverse anyway).
 */
@Injectable()
export class PrismaCatalogItemReader implements CatalogItemReader {
  constructor(private readonly prisma: PrismaService) {}

  async getResolution(catalogItemId: string): Promise<CatalogResolution | null> {
    const row = await this.prisma.catalogItem.findUnique({
      where: { id: catalogItemId },
      select: RESOLUTION_SELECT,
    });
    return row === null ? null : toResolution(row);
  }

  async getResolutions(
    catalogItemIds: readonly string[],
  ): Promise<Map<string, CatalogResolution>> {
    const out = new Map<string, CatalogResolution>();
    if (catalogItemIds.length === 0) {
      return out;
    }
    const rows = await this.prisma.catalogItem.findMany({
      where: { id: { in: [...new Set(catalogItemIds)] } },
      select: RESOLUTION_SELECT,
    });
    for (const row of rows) {
      out.set(row.id, toResolution(row));
    }
    return out;
  }
}
