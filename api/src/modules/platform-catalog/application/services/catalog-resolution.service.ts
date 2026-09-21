import { Inject, Injectable } from '@nestjs/common';
import {
  CATALOG_ITEM_READER,
  CatalogItemReader,
  CatalogLocalizedName,
  CatalogResolution,
} from '../../domain/repositories/catalog-item.reader';

/** The tenant-side inputs for one stock item (InventoryItem columns). */
export interface StockItemResolutionInput {
  /** InventoryItem.catalogItemId — null for a custom, uncatalogued item. */
  catalogItemId: string | null;
}

export interface EffectiveStockItem {
  /**
   * True when this item is catalog-sourced (has a resolvable CatalogItem). False
   * for a custom/uncatalogued item or a stale link.
   */
  catalogSourced: boolean;
  /**
   * Localized catalog display names (hy/ru/en), or null for a custom/uncatalogued
   * item. The customer projection falls back to InventoryItem.name when this is null.
   */
  catalogName: CatalogLocalizedName | null;
}

/**
 * Effective-value resolution (ADR §3) — the READ path for a stock item's
 * catalog-sourced values. Always resolved live through catalogItemId, never from
 * a stale copy on the tenant row.
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

  /** Batch resolution over many stock items — one catalog read. */
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
    _input: StockItemResolutionInput,
    resolution: CatalogResolution | null,
  ): EffectiveStockItem {
    return {
      catalogSourced: resolution !== null,
      catalogName: resolution ? resolution.name : null,
    };
  }
}
