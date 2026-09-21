/**
 * Phase 14 — Platform catalog (CATALOG-1, ADR §2–§4, §10).
 *
 * 1) Platform reference data (inert config → deterministic upserts, like the CX-1
 *    consumer taxonomy): catalog categories → catalog items. Global, not
 *    tenant-scoped; carries no invariant, so it follows the taxonomy-upsert path
 *    rather than a use-case.
 * 2) Adoption demo (real cross-aggregate write): link a handful of seeded
 *    InventoryItems to a CatalogItem BY REFERENCE (both branches), so
 *    resolution-by-reference (§3) is exercised.
 *
 * Runs AFTER phase 07 (inventory) so the adopted items exist. Idempotent: upserts
 * by deterministic id.
 */
import type { SeedContext } from '../context';
import type { SeedState } from '../state';
import {
  CATALOG_ADOPTIONS,
  CATALOG_CATEGORIES,
  CATALOG_ITEMS,
  catalogCategorySeedId,
  catalogItemSeedId,
} from '../data/catalog';
import type { BranchKey } from '../data/iam';
import { seedId } from '../ids';

const BRANCH_KEYS: BranchKey[] = ['flagship', 'second'];

export async function seedPlatformCatalog(ctx: SeedContext, _state: SeedState): Promise<void> {
  const { prisma } = ctx;

  // ── 1) Catalog categories (deterministic upserts) ───────────────────────────
  for (const c of CATALOG_CATEGORIES) {
    const fields = {
      slug: c.slug,
      labelHy: c.labelHy,
      labelRu: c.labelRu,
      labelEn: c.labelEn,
      position: c.position,
    };
    await prisma.catalogCategory.upsert({
      where: { id: c.id },
      update: fields,
      create: { id: c.id, ...fields },
    });
  }

  // ── 2) Catalog items (deterministic upserts) ────────────────────────────────
  for (const it of CATALOG_ITEMS) {
    const fields = {
      slug: it.slug,
      nameHy: it.nameHy,
      nameRu: it.nameRu,
      nameEn: it.nameEn,
      categoryId: catalogCategorySeedId(it.categorySlug),
    };
    await prisma.catalogItem.upsert({
      where: { id: it.id },
      update: fields,
      create: { id: it.id, ...fields },
    });
  }

  // ── 3) Adoption demo — link seeded InventoryItems by reference (§3) ──────────
  for (const bk of BRANCH_KEYS) {
    for (const link of CATALOG_ADOPTIONS) {
      const inventoryItemId = seedId(`item:${bk}:${link.inventorySlug}`);
      const exists = await prisma.inventoryItem.findUnique({
        where: { id: inventoryItemId },
        select: { id: true },
      });
      if (exists === null) {
        continue; // item not seeded in this branch — no-op
      }
      await prisma.inventoryItem.update({
        where: { id: inventoryItemId },
        data: { catalogItemId: catalogItemSeedId(link.catalogSlug) },
      });
    }
  }
}
