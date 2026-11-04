import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  AttributeTaxonomyRepository,
  CreateCategoryInput,
  CreateValueInput,
  TaxonomyCategory,
  TaxonomyValue,
  UpdateCategoryInput,
  UpdateValueInput,
} from '../../domain/repositories/attribute-taxonomy.repository';

/**
 * Attribute taxonomy read/validation (Prisma directly — global reference data,
 * not tenant-scoped). Categories ordered by position, values by position.
 */
@Injectable()
export class PrismaAttributeTaxonomyRepository implements AttributeTaxonomyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(): Promise<TaxonomyCategory[]> {
    const rows = await this.prisma.attributeCategory.findMany({
      orderBy: { position: 'asc' },
      include: { values: { orderBy: { position: 'asc' } } },
    });
    return rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      labelHy: c.labelHy,
      labelRu: c.labelRu,
      labelEn: c.labelEn,
      position: c.position,
      isFilterable: c.isFilterable,
      values: c.values.map((v) => ({
        id: v.id,
        slug: v.slug,
        labelHy: v.labelHy,
        labelRu: v.labelRu,
        labelEn: v.labelEn,
        position: v.position,
      })),
    }));
  }

  async findMissingValueIds(attributeValueIds: string[]): Promise<string[]> {
    if (attributeValueIds.length === 0) {
      return [];
    }
    const found = await this.prisma.attributeValue.findMany({
      where: { id: { in: attributeValueIds } },
      select: { id: true },
    });
    const foundSet = new Set(found.map((r) => r.id));
    return attributeValueIds.filter((id) => !foundSet.has(id));
  }

  // ── taxonomy writes (CX-ADMIN, platform-scoped) ──────────────────────────────
  async categoryExists(categoryId: string): Promise<boolean> {
    const found = await this.prisma.attributeCategory.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    return found !== null;
  }

  async createCategory(input: CreateCategoryInput): Promise<TaxonomyCategory> {
    const created = await this.prisma.attributeCategory.create({
      data: {
        slug: input.slug,
        labelHy: input.labelHy,
        labelRu: input.labelRu,
        labelEn: input.labelEn,
        position: input.position ?? 0,
        isFilterable: input.isFilterable ?? true,
      },
      include: { values: { orderBy: { position: 'asc' } } },
    });
    return toTaxonomyCategory(created);
  }

  async updateCategory(categoryId: string, input: UpdateCategoryInput): Promise<TaxonomyCategory> {
    const updated = await this.prisma.attributeCategory.update({
      where: { id: categoryId },
      data: {
        labelHy: input.labelHy,
        labelRu: input.labelRu,
        labelEn: input.labelEn,
        position: input.position,
        isFilterable: input.isFilterable,
      },
      include: { values: { orderBy: { position: 'asc' } } },
    });
    return toTaxonomyCategory(updated);
  }

  async deleteCategory(categoryId: string): Promise<void> {
    // Values cascade-delete via the FK (onDelete: Cascade). Callers guard in-use.
    await this.prisma.attributeCategory.delete({ where: { id: categoryId } });
  }

  async createValue(categoryId: string, input: CreateValueInput): Promise<TaxonomyValue> {
    const created = await this.prisma.attributeValue.create({
      data: {
        categoryId,
        slug: input.slug,
        labelHy: input.labelHy,
        labelRu: input.labelRu,
        labelEn: input.labelEn,
        position: input.position ?? 0,
      },
    });
    return toTaxonomyValue(created);
  }

  async updateValue(valueId: string, input: UpdateValueInput): Promise<TaxonomyValue> {
    const updated = await this.prisma.attributeValue.update({
      where: { id: valueId },
      data: {
        labelHy: input.labelHy,
        labelRu: input.labelRu,
        labelEn: input.labelEn,
        position: input.position,
      },
    });
    return toTaxonomyValue(updated);
  }

  async deleteValue(valueId: string): Promise<void> {
    await this.prisma.attributeValue.delete({ where: { id: valueId } });
  }

  async countRestaurantsUsingValue(valueId: string): Promise<number> {
    return this.prisma.restaurantAttribute.count({ where: { attributeValueId: valueId } });
  }

  async countRestaurantsUsingCategory(categoryId: string): Promise<number> {
    return this.prisma.restaurantAttribute.count({
      where: { value: { categoryId } },
    });
  }
}

interface CategoryRow {
  id: string;
  slug: string;
  labelHy: string;
  labelRu: string;
  labelEn: string;
  position: number;
  isFilterable: boolean;
  values: ValueRow[];
}

interface ValueRow {
  id: string;
  slug: string;
  labelHy: string;
  labelRu: string;
  labelEn: string;
  position: number;
}

function toTaxonomyValue(v: ValueRow): TaxonomyValue {
  return {
    id: v.id,
    slug: v.slug,
    labelHy: v.labelHy,
    labelRu: v.labelRu,
    labelEn: v.labelEn,
    position: v.position,
  };
}

function toTaxonomyCategory(c: CategoryRow): TaxonomyCategory {
  return {
    id: c.id,
    slug: c.slug,
    labelHy: c.labelHy,
    labelRu: c.labelRu,
    labelEn: c.labelEn,
    position: c.position,
    isFilterable: c.isFilterable,
    values: c.values.map(toTaxonomyValue),
  };
}
