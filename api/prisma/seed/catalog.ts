/**
 * CATALOG-4 — idempotent kitchen-catalog upsert shared by the full seed (phase 14)
 * and the standalone platform seed (prisma/seed-platform.ts).
 *
 * Upserts BY SLUG (categories and items), so rows created earlier with other ids
 * (e.g. by curators in Platform Admin) are matched instead of colliding.
 */
import type { PrismaClient } from '@prisma/client';
import { KITCHEN_CATEGORIES, KITCHEN_ITEMS } from './data/kitchen-catalog';
import { catalogCategorySeedId, catalogItemSeedId } from './data/catalog';

export interface SeedCatalogOptions {
  /**
   * true  → overwrite labels/names/category/position with the definitions.
   * false → create missing categories/items only; never touch curated rows.
   */
  sync: boolean;
}

export async function seedKitchenCatalog(
  prisma: PrismaClient,
  { sync }: SeedCatalogOptions,
): Promise<{ categories: number; items: number; created: number }> {
  const categoryIds = new Map<string, string>();
  for (const [position, c] of KITCHEN_CATEGORIES.entries()) {
    const data = { labelHy: c.labelHy, labelRu: c.labelRu, labelEn: c.labelEn, position };
    const row = await prisma.catalogCategory.upsert({
      where: { slug: c.slug },
      update: sync ? data : {},
      create: { id: catalogCategorySeedId(c.slug), slug: c.slug, ...data },
    });
    categoryIds.set(c.slug, row.id);
  }

  const before = await prisma.catalogItem.count();
  for (const it of KITCHEN_ITEMS) {
    const data = {
      nameHy: it.nameHy,
      nameRu: it.nameRu,
      nameEn: it.nameEn,
      categoryId: categoryIds.get(it.categorySlug)!,
      baseUnit: it.baseUnit,
    };
    await prisma.catalogItem.upsert({
      where: { slug: it.slug },
      update: sync ? data : {},
      create: { id: catalogItemSeedId(it.slug), slug: it.slug, ...data },
    });
  }
  const after = await prisma.catalogItem.count();
  return { categories: KITCHEN_CATEGORIES.length, items: KITCHEN_ITEMS.length, created: after - before };
}
