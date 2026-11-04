import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  CatalogCategoryView,
  CatalogTaxonomyReader,
} from '../../domain/repositories/catalog-taxonomy.reader';

/**
 * Category taxonomy read/validation over Prisma (global reference data). Powers
 * the curation picker and write-time validation. No tenant scope.
 */
@Injectable()
export class PrismaCatalogTaxonomyReader implements CatalogTaxonomyReader {
  constructor(private readonly prisma: PrismaService) {}

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

  async categoryExists(categoryId: string): Promise<boolean> {
    return (await this.prisma.catalogCategory.count({ where: { id: categoryId } })) > 0;
  }
}
