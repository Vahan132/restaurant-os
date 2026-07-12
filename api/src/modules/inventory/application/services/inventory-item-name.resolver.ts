import { Injectable } from '@nestjs/common';
import { CatalogLocalizedName } from '../../../platform-catalog/domain/repositories/catalog-item.reader';
import { CatalogResolutionService } from '../../../platform-catalog/application/services/catalog-resolution.service';

/** The minimum an item must expose to have its display name resolved. */
export interface ItemNameSource {
  id: string;
  /** InventoryItem.catalogItemId — null for a custom, uncatalogued item. */
  catalogItemId: string | null;
}

/**
 * PLATCAT-ADOPT-1B — the single item display-name resolver for the inventory read
 * layer. For an ADOPTED item (catalogItemId set) it returns the platform catalog's
 * trilingual name, resolved LIVE (so a catalog name fix propagates to every tenant);
 * for a custom item it returns null and the caller falls back to the item's local
 * `name`. Batches the catalog read via `resolveMany` (no N+1) and issues ZERO catalog
 * I/O when every item is custom. This is the one place the "if catalogItemId" branch
 * lives — consumers must not scatter it.
 *
 * Contract (matches the catalog browse response): callers expose BOTH the local
 * `name: string | null` AND `catalogName: {hy,ru,en} | null`, and pick per locale on
 * the client as `catalogName ? catalogName[locale] : name`.
 */
@Injectable()
export class InventoryItemNameResolver {
  constructor(private readonly catalog: CatalogResolutionService) {}

  /** Live trilingual catalog name per item id (null for custom / unresolvable). */
  async resolveMany(
    items: readonly ItemNameSource[],
  ): Promise<Map<string, CatalogLocalizedName | null>> {
    const effective = await this.catalog.resolveMany(
      items.map((i) => ({
        key: i.id,
        catalogItemId: i.catalogItemId,
        allergenOverride: null,
        adgCodeOverride: null,
      })),
    );
    const out = new Map<string, CatalogLocalizedName | null>();
    for (const i of items) {
      out.set(i.id, effective.get(i.id)?.catalogName ?? null);
    }
    return out;
  }

  /** Convenience for single-item routes (get / create / adopt / update responses). */
  async resolveOne(item: ItemNameSource): Promise<CatalogLocalizedName | null> {
    const map = await this.resolveMany([item]);
    return map.get(item.id) ?? null;
  }
}
