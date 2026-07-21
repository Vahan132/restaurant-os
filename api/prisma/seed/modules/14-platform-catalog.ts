/**
 * Phase 14 — Platform catalog (CATALOG-1, ADR §2–§4, §10).
 *
 * 1) Platform reference data (inert config → deterministic upserts, like the CX-1
 *    consumer taxonomy): allergen taxonomy → catalog categories → catalog items +
 *    their allergen tag sets. Global, not tenant-scoped; carries no invariant, so
 *    it follows the taxonomy-upsert path rather than a use-case.
 * 2) Adoption demo (real cross-aggregate write): link a handful of seeded
 *    InventoryItems to a CatalogItem BY REFERENCE (both branches), incl. one
 *    per-branch allergen override, so reference-with-override (§3) is exercised.
 *
 * Runs AFTER phase 07 (inventory) so the adopted items exist. Idempotent: upserts
 * by deterministic id; the item→allergen joins are cleared + rebuilt per item.
 */
import type { SeedContext } from '../context';
import type { SeedState } from '../state';
import {
  ALLERGENS,
  CATALOG_ADOPTIONS,
  CATALOG_CATEGORIES,
  CATALOG_ITEMS,
  allergenSeedId,
  catalogCategorySeedId,
  catalogItemSeedId,
} from '../data/catalog';
import type { BranchKey } from '../data/iam';
import { seedId } from '../ids';

const BRANCH_KEYS: BranchKey[] = ['flagship', 'second'];

export async function seedPlatformCatalog(ctx: SeedContext, _state: SeedState): Promise<void> {
  const { prisma } = ctx;

  // ── 1) Allergen taxonomy (deterministic upserts) ────────────────────────────
  for (const a of ALLERGENS) {
    const fields = {
      slug: a.slug,
      labelHy: a.labelHy,
      labelRu: a.labelRu,
      labelEn: a.labelEn,
      position: a.position,
    };
    await prisma.allergen.upsert({
      where: { id: a.id },
      update: fields,
      create: { id: a.id, ...fields },
    });
  }

  // ── 2) Catalog categories (deterministic upserts) ───────────────────────────
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

  // ── 3) Catalog items + allergen joins (deterministic upserts) ───────────────
  for (const it of CATALOG_ITEMS) {
    const fields = {
      slug: it.slug,
      nameHy: it.nameHy,
      nameRu: it.nameRu,
      nameEn: it.nameEn,
      categoryId: catalogCategorySeedId(it.categorySlug),
      allergensReviewed: it.reviewed,
    };
    await prisma.catalogItem.upsert({
      where: { id: it.id },
      update: fields,
      create: { id: it.id, ...fields },
    });
    // Rebuild the tag set (idempotent): clear then re-create the joins.
    await prisma.catalogItemAllergen.deleteMany({ where: { catalogItemId: it.id } });
    for (const slug of it.allergenSlugs) {
      await prisma.catalogItemAllergen.create({
        data: { catalogItemId: it.id, allergenId: allergenSeedId(slug) },
      });
    }
  }

  // ── 4) Adoption demo — link seeded InventoryItems by reference (§3) ──────────
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
      // Only include allergenOverride when a tenant override is present; a nullable
      // Json column must not be assigned TS null (use omission to leave it NULL).
      const data: {
        catalogItemId: string;
        allergenOverride?: string[];
      } = {
        catalogItemId: catalogItemSeedId(link.catalogSlug),
      };
      if (link.allergenOverride !== undefined) {
        data.allergenOverride = link.allergenOverride;
      }
      await prisma.inventoryItem.update({ where: { id: inventoryItemId }, data });
    }
  }
}
