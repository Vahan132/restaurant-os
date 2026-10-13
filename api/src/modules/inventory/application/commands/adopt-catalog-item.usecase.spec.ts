import 'reflect-metadata';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { IdGenerator } from '../../../identity/application/ports/id-generator';
import { CatalogItemStatus } from '../../../platform-catalog/domain/entities/catalog-item';
import {
  CatalogBrowseReader,
  CatalogBrowseView,
} from '../../../platform-catalog/domain/repositories/catalog-browse.reader';
import { InventoryItem } from '../../domain/entities/inventory-item';
import { InventoryBaseUnit } from '../../domain/enums';
import { InventoryCategoryRepository } from '../../domain/repositories/inventory-category.repository';
import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository';
import { AdoptCatalogItemUseCase } from './adopt-catalog-item.usecase';

const activeView = (over: Partial<CatalogBrowseView> = {}): CatalogBrowseView => ({
  id: 'cat-1',
  slug: 'tomato',
  name: { hy: 'Լոլիկ', ru: 'Помидор', en: 'Tomato' },
  categoryId: null,
  category: null,
  status: CatalogItemStatus.ACTIVE,
  ...over,
});

class FakeItems implements Partial<InventoryItemRepository> {
  created: InventoryItem[] = [];
  constructor(
    private readonly opts: { already?: InventoryItem | null; skuExists?: boolean } = {},
  ) {}
  async findByCatalogItemId(): Promise<InventoryItem | null> {
    return this.opts.already ?? null;
  }
  async existsBySku(): Promise<boolean> {
    return this.opts.skuExists ?? false;
  }
  async create(item: InventoryItem): Promise<void> {
    this.created.push(item);
  }
}

class FakeCategories implements Partial<InventoryCategoryRepository> {
  constructor(private readonly exists = true) {}
  async findById(): Promise<never | null> {
    return this.exists ? ({ id: 'c1' } as never) : null;
  }
}

class FakeCatalog implements CatalogBrowseReader {
  constructor(private readonly view: CatalogBrowseView | null) {}
  async findById(): Promise<CatalogBrowseView | null> {
    return this.view;
  }
  async listActive(): Promise<{ items: CatalogBrowseView[]; total: number }> {
    return { items: [], total: 0 };
  }
  async searchActiveIds(): Promise<string[]> {
    return [];
  }
}

const ids: IdGenerator = { generate: () => 'inv-1' };
const events = { publishFromAggregate: async () => undefined } as unknown as DomainEventPublisher;

function makeUseCase(opts: {
  view?: CatalogBrowseView | null;
  already?: InventoryItem | null;
  skuExists?: boolean;
  categoryExists?: boolean;
}): { useCase: AdoptCatalogItemUseCase; items: FakeItems } {
  const items = new FakeItems({ already: opts.already, skuExists: opts.skuExists });
  const useCase = new AdoptCatalogItemUseCase(
    items as unknown as InventoryItemRepository,
    new FakeCategories(opts.categoryExists ?? true) as unknown as InventoryCategoryRepository,
    new FakeCatalog(opts.view === undefined ? activeView() : opts.view),
    ids,
    events,
  );
  return { useCase, items };
}

const base = {
  restaurantId: 'r1',
  branchId: 'b1',
  catalogItemId: 'cat-1',
  baseUnit: InventoryBaseUnit.GRAM,
  actorUserId: 'u1',
};

describe('AdoptCatalogItemUseCase', () => {
  it('creates an InventoryItem with catalogItemId set and NO local name (name resolves live)', async () => {
    // PLATCAT-ADOPT-1B: the platform owns an adopted item's name; adopt persists none.
    const { useCase, items } = makeUseCase({});
    const item = await useCase.execute({ ...base });
    expect(item.catalogItemId).toBe('cat-1');
    expect(item.name).toBeNull();
    expect(item.baseUnit).toBe(InventoryBaseUnit.GRAM);
    expect(items.created).toHaveLength(1);
  });

  it('passes alternateUnits through to the created item', async () => {
    const { useCase } = makeUseCase({});
    const item = await useCase.execute({ ...base, alternateUnits: [{ name: 'kg', factor: 1000 }] });
    expect(item.alternateUnits.map((a) => ({ name: a.name, factor: a.factor }))).toEqual([
      { name: 'kg', factor: 1000 },
    ]);
  });

  it('throws CATALOG_ITEM_NOT_FOUND when the catalog item is missing', async () => {
    const { useCase } = makeUseCase({ view: null });
    await expect(useCase.execute({ ...base })).rejects.toMatchObject({
      response: { code: 'CATALOG_ITEM_NOT_FOUND' },
    });
  });

  it('throws CATALOG_ITEM_NOT_ADOPTABLE for an archived catalog item', async () => {
    const { useCase } = makeUseCase({ view: activeView({ status: CatalogItemStatus.ARCHIVED }) });
    await expect(useCase.execute({ ...base })).rejects.toMatchObject({
      response: { code: 'CATALOG_ITEM_NOT_ADOPTABLE' },
    });
  });

  it('throws CATALOG_ITEM_ALREADY_ADOPTED with the existing item id', async () => {
    const existing = InventoryItem.create({
      id: 'existing-77',
      restaurantId: 'r1',
      branchId: 'b1',
      name: 'x',
      baseUnit: InventoryBaseUnit.GRAM,
      catalogItemId: 'cat-1',
    });
    const { useCase, items } = makeUseCase({ already: existing });
    await expect(useCase.execute({ ...base })).rejects.toMatchObject({
      response: { code: 'CATALOG_ITEM_ALREADY_ADOPTED', details: { existingItemId: 'existing-77' } },
    });
    expect(items.created).toHaveLength(0);
  });

  it('validates a provided categoryId', async () => {
    const { useCase } = makeUseCase({ categoryExists: false });
    await expect(useCase.execute({ ...base, categoryId: 'bad' })).rejects.toMatchObject({
      response: { code: 'INVENTORY_CATEGORY_NOT_FOUND' },
    });
  });

  it('rejects a duplicate sku', async () => {
    const { useCase } = makeUseCase({ skuExists: true });
    await expect(useCase.execute({ ...base, sku: 'S1' })).rejects.toMatchObject({
      response: { code: 'INVENTORY_SKU_ALREADY_EXISTS' },
    });
  });
});
