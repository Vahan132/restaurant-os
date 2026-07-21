import { Injectable } from '@nestjs/common';
import { CatalogItemStatus as PrismaCatalogItemStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { CatalogItemStatus } from '../../domain/entities/catalog-item';
import {
  CatalogBrowseFilter,
  CatalogBrowseReader,
  CatalogBrowseView,
} from '../../domain/repositories/catalog-browse.reader';

const BROWSE_SELECT = {
  id: true,
  slug: true,
  nameHy: true,
  nameRu: true,
  nameEn: true,
  categoryId: true,
  status: true,
  allergensReviewed: true,
  allergens: { select: { allergen: { select: { slug: true } } } },
  category: { select: { id: true, slug: true, labelHy: true, labelRu: true, labelEn: true } },
} as const;

type BrowseRow = Prisma.CatalogItemGetPayload<{ select: typeof BROWSE_SELECT }>;

function toView(r: BrowseRow): CatalogBrowseView {
  return {
    id: r.id,
    slug: r.slug,
    name: { hy: r.nameHy, ru: r.nameRu, en: r.nameEn },
    categoryId: r.categoryId,
    category: r.category
      ? {
          id: r.category.id,
          slug: r.category.slug,
          name: { hy: r.category.labelHy, ru: r.category.labelRu, en: r.category.labelEn },
        }
      : null,
    allergenSlugs: r.allergens.map((a) => a.allergen.slug).sort(),
    allergensReviewed: r.allergensReviewed,
    status:
      r.status === PrismaCatalogItemStatus.ARCHIVED
        ? CatalogItemStatus.ARCHIVED
        : CatalogItemStatus.ACTIVE,
  };
}

/**
 * Tenant-facing catalog browse over Prisma. Global reference data — not tenant-
 * scoped, read-only. `listActive` is ACTIVE-only; `findById` returns any status so
 * adopt can distinguish not-found from not-adoptable. Touches CatalogItem + its
 * taxonomy only (ADR §4).
 */
@Injectable()
export class PrismaCatalogBrowseReader implements CatalogBrowseReader {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(
    filter: CatalogBrowseFilter,
  ): Promise<{ items: CatalogBrowseView[]; total: number }> {
    const where: Prisma.CatalogItemWhereInput = { status: PrismaCatalogItemStatus.ACTIVE };
    if (filter.categoryId) {
      where.categoryId = filter.categoryId;
    }
    if (filter.search && filter.search.trim().length > 0) {
      const q = filter.search.trim();
      where.OR = [
        { slug: { contains: q, mode: 'insensitive' } },
        { nameHy: { contains: q, mode: 'insensitive' } },
        { nameRu: { contains: q, mode: 'insensitive' } },
        { nameEn: { contains: q, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.catalogItem.findMany({
        where,
        select: BROWSE_SELECT,
        orderBy: { nameEn: 'asc' },
        skip: filter.skip,
        take: filter.take,
      }),
      this.prisma.catalogItem.count({ where }),
    ]);
    return { items: rows.map(toView), total };
  }

  async searchActiveIds(term: string): Promise<string[]> {
    const q = term.trim();
    if (q.length === 0) {
      return [];
    }
    const rows = await this.prisma.catalogItem.findMany({
      where: {
        status: PrismaCatalogItemStatus.ACTIVE,
        OR: [
          { slug: { contains: q, mode: 'insensitive' } },
          { nameHy: { contains: q, mode: 'insensitive' } },
          { nameRu: { contains: q, mode: 'insensitive' } },
          { nameEn: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async findById(catalogItemId: string): Promise<CatalogBrowseView | null> {
    const row = await this.prisma.catalogItem.findUnique({
      where: { id: catalogItemId },
      select: BROWSE_SELECT,
    });
    return row === null ? null : toView(row);
  }
}
