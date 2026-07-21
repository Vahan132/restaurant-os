import { Inject, Injectable } from '@nestjs/common';
import {
  CATALOG_ITEM_READER,
  CatalogItemReader,
  CatalogLocalizedName,
  CatalogResolution,
} from '../../domain/repositories/catalog-item.reader';
import { resolveEffectiveAllergens } from '../../domain/allergen-precedence';

/** The tenant-side inputs for one stock item (InventoryItem columns). */
export interface StockItemResolutionInput {
  /** InventoryItem.catalogItemId — null for a custom, uncatalogued item. */
  catalogItemId: string | null;
  /** InventoryItem.allergenOverride — null = defer; [] or [slugs] = override. */
  allergenOverride: string[] | null;
}

/** Provenance of the effective allergen set (for later surfacing / debugging). */
export type AllergenSource = 'override' | 'catalog' | 'none';

export interface EffectiveStockItem {
  allergenSlugs: string[];
  allergenSource: AllergenSource;
  /**
   * True when this item is catalog-sourced (has a resolvable CatalogItem). A false
   * value marks an unverified leaf whose allergens are self-declared or absent —
   * CATALOG-3 (§8) uses this to flag a dish's allergen profile incomplete.
   */
  catalogSourced: boolean;
  /**
   * CATALOG-3 §Locked-3: a leaf is VERIFIED only when catalogSourced AND the catalog
   * item's allergensReviewed flag is set. Any false here (custom/uncatalogued, stale
   * link, or catalogued-but-not-reviewed) => the dish allergen profile is incomplete.
   * NEVER infer verification from an empty allergenSlugs array (empty = known-none).
   */
  verified: boolean;
  /**
   * Localized catalog display names (hy/ru/en), or null for a custom/uncatalogued
   * item. The customer projection falls back to InventoryItem.name when this is null.
   */
  catalogName: CatalogLocalizedName | null;
}

/**
 * Effective-value resolution (ADR §3) — the READ path consumed by CATALOG-3/4.
 * Resolves a stock item's effective allergens by precedence
 * (tenant override → catalog via catalogItemId → null), never from a stale copy.
 */
@Injectable()
export class CatalogResolutionService {
  constructor(
    @Inject(CATALOG_ITEM_READER) private readonly catalog: CatalogItemReader,
  ) {}

  async resolve(input: StockItemResolutionInput): Promise<EffectiveStockItem> {
    const resolution =
      input.catalogItemId !== null
        ? await this.catalog.getResolution(input.catalogItemId)
        : null;
    return this.project(input, resolution);
  }

  /** Batch resolution for the allergen rollup (CATALOG-4) — one catalog read. */
  async resolveMany(
    inputs: readonly (StockItemResolutionInput & { key: string })[],
  ): Promise<Map<string, EffectiveStockItem>> {
    const ids = inputs
      .map((i) => i.catalogItemId)
      .filter((id): id is string => id !== null);
    const resolutions =
      ids.length > 0 ? await this.catalog.getResolutions(ids) : new Map();

    const out = new Map<string, EffectiveStockItem>();
    for (const input of inputs) {
      const resolution =
        input.catalogItemId !== null
          ? resolutions.get(input.catalogItemId) ?? null
          : null;
      out.set(input.key, this.project(input, resolution));
    }
    return out;
  }

  private project(
    input: StockItemResolutionInput,
    resolution: CatalogResolution | null,
  ): EffectiveStockItem {
    const catalogAllergens = resolution ? resolution.allergenSlugs : null;
    return {
      allergenSlugs: resolveEffectiveAllergens(
        input.allergenOverride,
        catalogAllergens,
      ),
      allergenSource:
        input.allergenOverride !== null
          ? 'override'
          : catalogAllergens !== null
            ? 'catalog'
            : 'none',
      catalogSourced: resolution !== null,
      verified: resolution !== null && resolution.allergensReviewed,
      catalogName: resolution ? resolution.name : null,
    };
  }
}
