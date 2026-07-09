import { Injectable } from '@nestjs/common';
import { CatalogItemStatus as PrismaCatalogItemStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { CatalogItem, CatalogItemStatus } from '../../domain/entities/catalog-item';
import {
  CatalogItemListFilter,
  CatalogItemListResult,
  CatalogItemRepository,
} from '../../domain/repositories/catalog-item.repository';

const ITEM_INCLUDE = {
  allergens: { select: { allergen: { select: { slug: true } } } },
} satisfies Prisma.CatalogItemInclude;

type ItemRecord = Prisma.CatalogItemGetPayload<{ include: typeof ITEM_INCLUDE }>;

function toPrismaStatus(s: CatalogItemStatus): PrismaCatalogItemStatus {
  return s === CatalogItemStatus.ARCHIVED
    ? PrismaCatalogItemStatus.ARCHIVED
    : PrismaCatalogItemStatus.ACTIVE;
}

function toDomain(r: ItemRecord): CatalogItem {
  return CatalogItem.reconstitute(r.id, {
    slug: r.slug,
    nameHy: r.nameHy,
    nameRu: r.nameRu,
    nameEn: r.nameEn,
    categoryId: r.categoryId,
    adgCode: r.adgCode,
    allergenSlugs: r.allergens.map((a) => a.allergen.slug).sort(),
    allergensReviewed: r.allergensReviewed,
    status:
      r.status === PrismaCatalogItemStatus.ARCHIVED
        ? CatalogItemStatus.ARCHIVED
        : CatalogItemStatus.ACTIVE,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt,
  });
}

/**
 * CatalogItem write + admin-read repository (Prisma). Touches catalog_items + its
 * allergen join only — never tenant inventory (ADR §4). Allergen tags are stored
 * as a fully-replaced join set inside a transaction with the item write.
 */
@Injectable()
export class PrismaCatalogItemRepository implements CatalogItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(item: CatalogItem): Promise<void> {
    const allergenIds = await this.resolveAllergenIds(item.allergenSlugs);
    await this.prisma.$transaction(async (tx) => {
      await tx.catalogItem.create({
        data: {
          id: item.id,
          slug: item.slug,
          nameHy: item.nameHy,
          nameRu: item.nameRu,
          nameEn: item.nameEn,
          categoryId: item.categoryId,
          adgCode: item.adgCode,
          allergensReviewed: item.allergensReviewed,
          status: toPrismaStatus(item.status),
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          deletedAt: item.deletedAt,
        },
      });
      if (allergenIds.length > 0) {
        await tx.catalogItemAllergen.createMany({
          data: allergenIds.map((allergenId) => ({ catalogItemId: item.id, allergenId })),
        });
      }
    });
  }

  async update(item: CatalogItem): Promise<void> {
    const allergenIds = await this.resolveAllergenIds(item.allergenSlugs);
    await this.prisma.$transaction(async (tx) => {
      await tx.catalogItem.update({
        where: { id: item.id },
        data: {
          slug: item.slug,
          nameHy: item.nameHy,
          nameRu: item.nameRu,
          nameEn: item.nameEn,
          categoryId: item.categoryId,
          adgCode: item.adgCode,
          allergensReviewed: item.allergensReviewed,
          status: toPrismaStatus(item.status),
          updatedAt: item.updatedAt,
          deletedAt: item.deletedAt,
        },
      });
      await tx.catalogItemAllergen.deleteMany({ where: { catalogItemId: item.id } });
      if (allergenIds.length > 0) {
        await tx.catalogItemAllergen.createMany({
          data: allergenIds.map((allergenId) => ({ catalogItemId: item.id, allergenId })),
        });
      }
    });
  }

  async findById(id: string): Promise<CatalogItem | null> {
    const r = await this.prisma.catalogItem.findUnique({ where: { id }, include: ITEM_INCLUDE });
    return r ? toDomain(r) : null;
  }

  async existsBySlug(slug: string): Promise<boolean> {
    return (await this.prisma.catalogItem.count({ where: { slug } })) > 0;
  }

  async list(filter: CatalogItemListFilter): Promise<CatalogItemListResult> {
    const where: Prisma.CatalogItemWhereInput = {};
    if (filter.status) {
      where.status = toPrismaStatus(filter.status);
    }
    if (filter.categoryId) {
      where.categoryId = filter.categoryId;
    }
    if (filter.reviewed !== undefined) {
      where.allergensReviewed = filter.reviewed;
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
        include: ITEM_INCLUDE,
        orderBy: { nameEn: 'asc' },
        skip: filter.skip,
        take: filter.take,
      }),
      this.prisma.catalogItem.count({ where }),
    ]);
    return { items: rows.map(toDomain), total };
  }

  /** Resolve (already-validated) allergen slugs to ids for the join rows. */
  private async resolveAllergenIds(slugs: string[]): Promise<string[]> {
    if (slugs.length === 0) {
      return [];
    }
    const rows = await this.prisma.allergen.findMany({
      where: { slug: { in: slugs } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
}
