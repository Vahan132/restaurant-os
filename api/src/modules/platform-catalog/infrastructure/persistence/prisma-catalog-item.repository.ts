import { Injectable } from '@nestjs/common';
import { CatalogItemStatus as PrismaCatalogItemStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { CatalogItem, CatalogItemStatus } from '../../domain/entities/catalog-item';
import {
  CatalogItemListFilter,
  CatalogItemListResult,
  CatalogItemRepository,
} from '../../domain/repositories/catalog-item.repository';

type ItemRecord = Prisma.CatalogItemGetPayload<object>;

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
    status: toPrismaStatus(item.status),
    updatedAt: item.updatedAt,
    deletedAt: item.deletedAt,
  };
}

/**
 * CatalogItem write + admin-read repository (Prisma). Touches catalog_items only
 * — never tenant inventory (ADR §4).
 */
@Injectable()
export class PrismaCatalogItemRepository implements CatalogItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(item: CatalogItem): Promise<void> {
    await this.prisma.catalogItem.create({ data: toCreateData(item) });
  }

  async update(item: CatalogItem): Promise<void> {
    await this.prisma.catalogItem.update({ where: { id: item.id }, data: toUpdateData(item) });
  }

  async findById(id: string): Promise<CatalogItem | null> {
    const r = await this.prisma.catalogItem.findUnique({ where: { id } });
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
    await this.prisma.$transaction(async (tx) => {
      for (const item of creates) {
        await tx.catalogItem.create({ data: toCreateData(item) });
      }
      for (const item of updates) {
        await tx.catalogItem.update({ where: { id: item.id }, data: toUpdateData(item) });
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
        orderBy: { nameEn: 'asc' },
        skip: filter.skip,
        take: filter.take,
      }),
      this.prisma.catalogItem.count({ where }),
    ]);
    return { items: rows.map(toDomain), total };
  }

}
