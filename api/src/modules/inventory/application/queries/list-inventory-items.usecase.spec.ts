import 'reflect-metadata';
import { CatalogBrowseReader } from '../../../platform-catalog/domain/repositories/catalog-browse.reader';
import { CatalogLocalizedName } from '../../../platform-catalog/domain/repositories/catalog-item.reader';
import { InventoryItem } from '../../domain/entities/inventory-item';
import {
  InventoryItemListFilter,
  InventoryItemRepository,
} from '../../domain/repositories/inventory-item.repository';
import { InventoryItemNameResolver } from '../services/inventory-item-name.resolver';
import { ListInventoryItemsUseCase } from './list-inventory-items.usecase';

/** Minimal item shape the use-case touches (id, local name, catalogItemId). */
function item(id: string, name: string | null, catalogItemId: string | null): InventoryItem {
  return { id, name, catalogItemId } as unknown as InventoryItem;
}

// Dataset: two custom items + one adopted item (local name null, catalog name resolves).
const APPLE = item('a', 'Apple', null);
const MANGO = item('m', 'Mango', null);
const ADOPTED = item('c', null, 'cat-1'); // effective (catalog hy) name = 'Cherry'

const CATALOG_NAME: Record<string, CatalogLocalizedName> = {
  'cat-1': { hy: 'Cherry', ru: 'Вишня', en: 'Cherry' },
};

/** Fake repo emulating the two-step OR: local name OR adopted-by-matched-catalog-id. */
class FakeItems implements Partial<InventoryItemRepository> {
  constructor(private readonly data: InventoryItem[]) {}
  async list(filter: InventoryItemListFilter): Promise<InventoryItem[]> {
    if (!filter.search) {
      return [...this.data];
    }
    const term = filter.search.toLowerCase();
    const matched = new Set(filter.matchedCatalogItemIds ?? []);
    return this.data.filter(
      (i) =>
        (i.name?.toLowerCase().includes(term) ?? false) ||
        (i.catalogItemId !== null && matched.has(i.catalogItemId)),
    );
  }
}

/** Fake catalog: term → matching ACTIVE catalog ids (any-of-three locales). */
class FakeCatalog implements Partial<CatalogBrowseReader> {
  calls: string[] = [];
  async searchActiveIds(term: string): Promise<string[]> {
    this.calls.push(term);
    const t = term.toLowerCase();
    return Object.entries(CATALOG_NAME)
      .filter(([, n]) => [n.hy, n.ru, n.en].some((v) => v.toLowerCase().includes(t)))
      .map(([id]) => id);
  }
}

/** Fake resolver counting invocations (single-batched-resolve assertion). */
class FakeNames {
  calls = 0;
  async resolveMany(
    items: readonly { id: string; catalogItemId: string | null }[],
  ): Promise<Map<string, CatalogLocalizedName | null>> {
    this.calls += 1;
    return new Map(
      items.map((i) => [i.id, i.catalogItemId ? CATALOG_NAME[i.catalogItemId] ?? null : null]),
    );
  }
}

function build(data: InventoryItem[]) {
  const items = new FakeItems(data);
  const catalog = new FakeCatalog();
  const names = new FakeNames();
  const uc = new ListInventoryItemsUseCase(
    items as unknown as InventoryItemRepository,
    catalog as unknown as CatalogBrowseReader,
    names as unknown as InventoryItemNameResolver,
  );
  return { uc, catalog, names };
}

const R = { restaurantId: 'r1', branchId: 'b1' };

describe('ListInventoryItemsUseCase (INV-SEARCH-1)', () => {
  it('finds an adopted item by its live catalog (trilingual) name', async () => {
    const { uc, catalog } = build([APPLE, MANGO, ADOPTED]);
    const page = await uc.execute({ ...R, search: 'вишн' }); // Russian catalog name
    expect(catalog.calls).toEqual(['вишн']); // step 1 ran
    expect(page.data.map((r) => r.item.id)).toEqual(['c']);
    expect(page.data[0].catalogName).toEqual(CATALOG_NAME['cat-1']);
  });

  it('still finds a custom item by its local name', async () => {
    const { uc } = build([APPLE, MANGO, ADOPTED]);
    const page = await uc.execute({ ...R, search: 'app' });
    expect(page.data.map((r) => r.item.id)).toEqual(['a']);
  });

  it('returns nothing when the term matches neither a local nor a catalog name', async () => {
    const { uc } = build([APPLE, MANGO, ADOPTED]);
    const page = await uc.execute({ ...R, search: 'xyz' });
    expect(page.data).toEqual([]);
    expect(page.pagination.total).toBe(0);
  });

  it('interleaves adopted + custom items by effective name (not clustered at an end)', async () => {
    const { uc } = build([MANGO, ADOPTED, APPLE]); // unordered input
    const page = await uc.execute({ ...R });
    // Apple, Cherry(adopted), Mango — adopted sits in the middle, not first/last.
    expect(page.data.map((r) => r.item.id)).toEqual(['a', 'c', 'm']);
  });

  it('paginates the app-layer sort with a correct page + total', async () => {
    const { uc } = build([MANGO, ADOPTED, APPLE]);
    const p1 = await uc.execute({ ...R, page: 1, limit: 2 });
    expect(p1.data.map((r) => r.item.id)).toEqual(['a', 'c']);
    expect(p1.pagination.total).toBe(3);
    const p2 = await uc.execute({ ...R, page: 2, limit: 2 });
    expect(p2.data.map((r) => r.item.id)).toEqual(['m']);
  });

  it('resolves catalog names exactly once per call (no N+1, no controller re-resolve)', async () => {
    const { uc, names } = build([APPLE, MANGO, ADOPTED]);
    await uc.execute({ ...R });
    expect(names.calls).toBe(1);
  });
});
