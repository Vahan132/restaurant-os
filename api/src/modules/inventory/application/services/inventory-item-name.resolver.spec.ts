import 'reflect-metadata';
import {
  CatalogResolutionService,
  EffectiveStockItem,
  StockItemResolutionInput,
} from '../../../platform-catalog/application/services/catalog-resolution.service';
import { InventoryItemNameResolver } from './inventory-item-name.resolver';

/**
 * A fake CatalogResolutionService that returns a live trilingual name for any input
 * carrying a catalogItemId, and counts how many times resolveMany was invoked so we
 * can assert the resolver batches (no N+1).
 */
class FakeCatalog {
  public calls = 0;
  constructor(private readonly names: Record<string, { hy: string; ru: string; en: string }>) {}

  async resolveMany(
    inputs: readonly (StockItemResolutionInput & { key: string })[],
  ): Promise<Map<string, EffectiveStockItem>> {
    this.calls += 1;
    const out = new Map<string, EffectiveStockItem>();
    for (const i of inputs) {
      const catalogName = i.catalogItemId ? this.names[i.catalogItemId] ?? null : null;
      out.set(i.key, {
        allergenSlugs: [],
        allergenSource: 'none',
        adgCode: null,
        catalogSourced: i.catalogItemId !== null,
        verified: false,
        catalogName,
      });
    }
    return out;
  }
}

function make(names: Record<string, { hy: string; ru: string; en: string }> = {}) {
  const catalog = new FakeCatalog(names);
  const resolver = new InventoryItemNameResolver(
    catalog as unknown as CatalogResolutionService,
  );
  return { resolver, catalog };
}

describe('InventoryItemNameResolver', () => {
  it('returns the live trilingual catalog name for an adopted item', async () => {
    const { resolver } = make({ 'cat-1': { hy: 'Լոլիկ', ru: 'Помидор', en: 'Tomato' } });
    const map = await resolver.resolveMany([{ id: 'inv-1', catalogItemId: 'cat-1' }]);
    expect(map.get('inv-1')).toEqual({ hy: 'Լոլիկ', ru: 'Помидор', en: 'Tomato' });
  });

  it('propagation: a platform catalog name edit changes the resolved name for an already-adopted item', async () => {
    // Same adopted item id, but the catalog now returns a corrected name — the resolver
    // reflects it live (no denormalized copy on the inventory item).
    const before = make({ 'cat-1': { hy: 'Լոլик', ru: 'Помидор', en: 'Tomato' } });
    const after = make({ 'cat-1': { hy: 'Լոլик', ru: 'Помидор', en: 'Tomatoes' } });
    const b = await before.resolver.resolveOne({ id: 'inv-1', catalogItemId: 'cat-1' });
    const a = await after.resolver.resolveOne({ id: 'inv-1', catalogItemId: 'cat-1' });
    expect(b?.en).toBe('Tomato');
    expect(a?.en).toBe('Tomatoes');
  });

  it('returns null for a custom (uncatalogued) item so the caller falls back to the local name', async () => {
    const { resolver } = make();
    const map = await resolver.resolveMany([{ id: 'inv-2', catalogItemId: null }]);
    expect(map.get('inv-2')).toBeNull();
  });

  it('batches: one catalog resolution for many items (no N+1)', async () => {
    const { resolver, catalog } = make({
      'cat-1': { hy: 'a', ru: 'a', en: 'a' },
      'cat-2': { hy: 'b', ru: 'b', en: 'b' },
    });
    await resolver.resolveMany([
      { id: 'inv-1', catalogItemId: 'cat-1' },
      { id: 'inv-2', catalogItemId: 'cat-2' },
      { id: 'inv-3', catalogItemId: null },
    ]);
    expect(catalog.calls).toBe(1);
  });
});
