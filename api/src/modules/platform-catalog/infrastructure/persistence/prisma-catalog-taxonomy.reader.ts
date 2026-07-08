import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  AllergenView,
  CatalogCategoryView,
  CatalogTaxonomyReader,
} from '../../domain/repositories/catalog-taxonomy.reader';

/**
 * Allergen + category taxonomy read/validation over Prisma (global reference data).
 * Powers the curation picker and write-time validation. No tenant scope.
 */
@Injectable()
export class PrismaCatalogTaxonomyReader implements CatalogTaxonomyReader {
  constructor(private readonly prisma: PrismaService) {}

  async listAllergens(): Promise<AllergenView[]> {
    const rows = await this.prisma.allergen.findMany({ orderBy: { position: 'asc' } });
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      labelHy: r.labelHy,
      labelRu: r.labelRu,
      labelEn: r.labelEn,
      position: r.position,
    }));
  }

  async listCategories(): Promise<CatalogCategoryView[]> {
    const rows = await this.prisma.catalogCategory.findMany({ orderBy: { position: 'asc' } });
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      labelHy: r.labelHy,
      labelRu: r.labelRu,
      labelEn: r.labelEn,
      position: r.position,
    }));
  }

  async findUnknownAllergenSlugs(slugs: readonly string[]): Promise<string[]> {
    if (slugs.length === 0) {
      return [];
    }
    const unique = [...new Set(slugs)];
    const found = await this.prisma.allergen.findMany({
      where: { slug: { in: unique } },
      select: { slug: true },
    });
    const foundSet = new Set(found.map((r) => r.slug));
    return unique.filter((s) => !foundSet.has(s));
  }

  async categoryExists(categoryId: string): Promise<boolean> {
    return (await this.prisma.catalogCategory.count({ where: { id: categoryId } })) > 0;
  }
}
