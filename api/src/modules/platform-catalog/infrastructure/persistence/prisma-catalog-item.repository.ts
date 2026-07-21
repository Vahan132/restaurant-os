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

/** Prisma transaction client (works for both `$transaction(fn)` and the base client). */
type Tx = Prisma.TransactionClient;

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

/** Scalar fields for a create (id + createdAt included). */
function toCreateData(item: CatalogItem): Prisma.CatalogItemUncheckedCreateInput {
  return {
    id: item.id,
    slug: item.slug,
    nameHy: item.nameHy,
    nameRu: item.nameRu,
    nameEn: item.nameEn,
    categoryId: item.categoryId,
    allergensReviewed: item.allergensReviewed,
    status: toPrismaStatus(item.status),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    deletedAt: item.deletedAt,
  };
}

/** Scalar fields for an update (id + createdAt untouched). */
function toUpdateData(item: CatalogItem): Prisma.CatalogItemUncheckedUpdateInput {
  return {
    slug: item.slug,
    nameHy: item.nameHy,
    nameRu: item.nameRu,
    nameEn: item.nameEn,
    categoryId: item.categoryId,
    allergensReviewed: item.allergensReviewed,
    status: toPrismaStatus(item.status),
    updatedAt: item.updatedAt,
    deletedAt: item.deletedAt,
  };
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
    const idBySlug = await this.allergenIdBySlug(item.allergenSlugs);
    await this.prisma.$transaction(async (tx) => {
      await tx.catalogItem.create({ data: toCreateData(item) });
      await this.writeAllergenJoin(tx, item, idBySlug, false);
    });
  }

  async update(item: CatalogItem): Promise<void> {
    const idBySlug = await this.allergenIdBySlug(item.allergenSlugs);
    await this.prisma.$transaction(async (tx) => {
      await tx.catalogItem.update({ where: { id: item.id }, data: toUpdateData(item) });
      await this.writeAllergenJoin(tx, item, idBySlug, true);
    });
  }

  async findById(id: string): Promise<CatalogItem | null> {
    const r = await this.prisma.catalogItem.findUnique({ where: { id }, include: ITEM_INCLUDE });
    return r ? toDomain(r) : null;
  }

  async existsBySlug(slug: string): Promise<boolean> {
    return (await this.prisma.catalogItem.count({ where: { slug } })) > 0;
  }

  async findManyBySlugs(slugs: readonly string[]): Promise<CatalogItem[]> {
    const unique = [...new Set(slugs)];
    if (unique.length === 0) {
      return [];
    }
    const rows = await this.prisma.catalogItem.findMany({
      where: { slug: { in: unique } },
      include: ITEM_INCLUDE,
    });
    return rows.map(toDomain);
  }

  async saveAll(
    creates: readonly CatalogItem[],
    updates: readonly CatalogItem[],
  ): Promise<void> {
    if (creates.length === 0 && updates.length === 0) {
      return;
    }
    // Resolve every allergen slug used across the batch once (no N+1).
    const allSlugs = new Set<string>();
    for (const item of [...creates, ...updates]) {
      for (const s of item.allergenSlugs) {
        allSlugs.add(s);
      }
    }
    const idBySlug = await this.allergenIdBySlug([...allSlugs]);

    await this.prisma.$transaction(async (tx) => {
      for (const item of creates) {
        await tx.catalogItem.create({ data: toCreateData(item) });
        await this.writeAllergenJoin(tx, item, idBySlug, false);
      }
      for (const item of updates) {
        await tx.catalogItem.update({ where: { id: item.id }, data: toUpdateData(item) });
        await this.writeAllergenJoin(tx, item, idBySlug, true);
      }
    });
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

  /**
   * Replace an item's allergen join rows to match its current tag set. When
   * `replaceExisting` is true (update path) existing rows are cleared first.
   */
  private async writeAllergenJoin(
    tx: Tx,
    item: CatalogItem,
    idBySlug: Map<string, string>,
    replaceExisting: boolean,
  ): Promise<void> {
    if (replaceExisting) {
      await tx.catalogItemAllergen.deleteMany({ where: { catalogItemId: item.id } });
    }
    const allergenIds = item.allergenSlugs
      .map((slug) => idBySlug.get(slug))
      .filter((id): id is string => id !== undefined);
    if (allergenIds.length > 0) {
      await tx.catalogItemAllergen.createMany({
        data: allergenIds.map((allergenId) => ({ catalogItemId: item.id, allergenId })),
      });
    }
  }

  /** Resolve (already-validated) allergen slugs to a slug→id map for join rows. */
  private async allergenIdBySlug(slugs: readonly string[]): Promise<Map<string, string>> {
    const unique = [...new Set(slugs)];
    if (unique.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.allergen.findMany({
      where: { slug: { in: unique } },
      select: { id: true, slug: true },
    });
    return new Map(rows.map((r) => [r.slug, r.id]));
  }
}
