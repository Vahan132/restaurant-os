import 'reflect-metadata';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { IdGenerator } from '../../../identity/application/ports/id-generator';
import {
  CatalogItemStatus,
  CatalogUnit,
} from '../../../platform-catalog/domain/entities/catalog-item';
import {
  CatalogBrowseReader,
  CatalogBrowseView,
} from '../../../platform-catalog/domain/repositories/catalog-browse.reader';
import { InventoryItem } from '../../domain/entities/inventory-item';
import { InventoryBaseUnit } from '../../domain/enums';
import { InventoryCategoryRepository } from '../../domain/repositories/inventory-category.repository';
import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository';
import { BulkAdoptCatalogItemsUseCase } from './bulk-adopt-catalog-items.usecase';

const view = (id: string, over: Partial<CatalogBrowseView> = {}): CatalogBrowseView => ({
  id,
  slug: id,
  name: { hy: id, ru: id, en: id },
  categoryId: null,
  category: null,
  baseUnit: CatalogUnit.GRAM,
  status: CatalogItemStatus.ACTIVE,
  ...over,
});

class FakeItems implements Partial<InventoryItemRepository> {
  created: InventoryItem[] = [];
  constructor(private readonly adopted: string[] = []) {}
  async listAdoptedCatalogItemIds(): Promise<string[]> {
    return this.adopted;
  }
  async create(item: InventoryItem): Promise<void> {
    this.created.push(item);
  }
}

class FakeCatalog implements Partial<CatalogBrowseReader> {
  lastFilter: unknown = null;
  constructor(private readonly views: CatalogBrowseView[]) {}
  async findById(id: string): Promise<CatalogBrowseView | null> {
    return this.views.find((v) => v.id === id) ?? null;
  }
  async listAllActive(filter: unknown): Promise<CatalogBrowseView[]> {
    this.lastFilter = filter;
    return this.views.filter((v) => v.status === CatalogItemStatus.ACTIVE);
  }
}

class FakeCategories implements Partial<InventoryCategoryRepository> {
  constructor(private readonly exists = true) {}
  async findById(): Promise<never | null> {
    return this.exists ? ({ id: 'c1' } as never) : null;
  }
}

function make(views: CatalogBrowseView[], adopted: string[] = [], categoryExists = true) {
  let n = 0;
  const ids: IdGenerator = { generate: () => `inv-${++n}` };
  const events = { publishFromAggregate: async () => undefined } as unknown as DomainEventPublisher;
  const items = new FakeItems(adopted);
  const catalog = new FakeCatalog(views);
  const useCase = new BulkAdoptCatalogItemsUseCase(
    items as unknown as InventoryItemRepository,
    new FakeCategories(categoryExists) as unknown as InventoryCategoryRepository,
    catalog as unknown as CatalogBrowseReader,
    ids,
    events,
  );
  return { useCase, items, catalog };
}

const base = { restaurantId: 'r1', branchId: 'b1', actorUserId: 'u1' };

describe('BulkAdoptCatalogItemsUseCase', () => {
  it('adopts selected ids with the catalog unit, skipping already-adopted and archived', async () => {
    const { useCase, items } = make(
      [
        view('milk', { baseUnit: CatalogUnit.MILLILITER }),
        view('egg', { baseUnit: CatalogUnit.PIECE }),
        view('flour'),
        view('old', { status: CatalogItemStatus.ARCHIVED }),
      ],
      ['flour'],
    );
    const res = await useCase.execute({
      ...base,
      catalogItemIds: ['milk', 'egg', 'flour', 'old', 'missing', 'milk'],
    });
    expect(res).toEqual({ requested: 5, adopted: 2, skipped: 1, unavailable: 2 });
    expect(items.created.map((i) => [i.catalogItemId, i.baseUnit])).toEqual([
      ['milk', InventoryBaseUnit.MILLILITER],
      ['egg', InventoryBaseUnit.PIECE],
    ]);
    expect(items.created.every((i) => i.name === null)).toBe(true);
  });

  it('all=true adopts every active match and passes the filters through', async () => {
    const { useCase, items, catalog } = make([view('a'), view('b'), view('c')], ['b']);
    const res = await useCase.execute({
      ...base,
      all: true,
      search: 'x',
      catalogCategoryId: 'cat-veg',
    });
    expect(res).toEqual({ requested: 3, adopted: 2, skipped: 1, unavailable: 0 });
    expect(items.created.map((i) => i.catalogItemId)).toEqual(['a', 'c']);
    expect(catalog.lastFilter).toMatchObject({ search: 'x', categoryId: 'cat-veg' });
  });

  it('rejects an unknown inventory category before adopting anything', async () => {
    const { useCase, items } = make([view('a')], [], false);
    await expect(
      useCase.execute({ ...base, catalogItemIds: ['a'], categoryId: 'nope' }),
    ).rejects.toBeDefined();
    expect(items.created).toHaveLength(0);
  });

  it('requires a restaurant in scope', async () => {
    const { useCase } = make([view('a')]);
    await expect(
      useCase.execute({ ...base, restaurantId: null, catalogItemIds: ['a'] }),
    ).rejects.toBeDefined();
  });
});
