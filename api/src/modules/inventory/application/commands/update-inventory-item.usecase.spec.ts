import 'reflect-metadata';
import { InventoryItem } from '../../domain/entities/inventory-item';
import { InventoryBaseUnit } from '../../domain/enums';
import { InventoryCategoryRepository } from '../../domain/repositories/inventory-category.repository';
import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository';
import { UpdateInventoryItemUseCase } from './update-inventory-item.usecase';

class FakeItems implements Partial<InventoryItemRepository> {
  updated: InventoryItem[] = [];
  constructor(private readonly item: InventoryItem | null) {}
  async findById(): Promise<InventoryItem | null> {
    return this.item;
  }
  async existsBySku(): Promise<boolean> {
    return false;
  }
  async update(item: InventoryItem): Promise<void> {
    this.updated.push(item);
  }
}

const categories = {
  findById: async () => ({ id: 'c1' }),
} as unknown as InventoryCategoryRepository;

function make(item: InventoryItem | null): {
  useCase: UpdateInventoryItemUseCase;
  items: FakeItems;
} {
  const items = new FakeItems(item);
  const useCase = new UpdateInventoryItemUseCase(
    items as unknown as InventoryItemRepository,
    categories,
  );
  return { useCase, items };
}

const adopted = () =>
  InventoryItem.create({
    id: 'inv-1',
    restaurantId: 'r1',
    branchId: 'b1',
    name: null,
    baseUnit: InventoryBaseUnit.GRAM,
    catalogItemId: 'cat-1',
  });

const custom = () =>
  InventoryItem.create({
    id: 'inv-2',
    restaurantId: 'r1',
    branchId: 'b1',
    name: 'House Blend',
    baseUnit: InventoryBaseUnit.GRAM,
  });

const base = { restaurantId: 'r1', branchId: 'b1' };

describe('UpdateInventoryItemUseCase — PLATCAT-ADOPT-1B name ownership', () => {
  it('rejects setting a name on an adopted item (platform-owned)', async () => {
    const { useCase, items } = make(adopted());
    await expect(
      useCase.execute({ ...base, itemId: 'inv-1', name: 'My Tomato' }),
    ).rejects.toMatchObject({ response: { code: 'INVENTORY_ITEM_NAME_PLATFORM_OWNED' } });
    expect(items.updated).toHaveLength(0);
  });

  it('allows other edits on an adopted item when name is omitted', async () => {
    const { useCase, items } = make(adopted());
    await useCase.execute({ ...base, itemId: 'inv-1', trackExpiry: true });
    expect(items.updated).toHaveLength(1);
  });

  it('lets a custom item edit its name freely', async () => {
    const { useCase, items } = make(custom());
    const item = await useCase.execute({ ...base, itemId: 'inv-2', name: 'New Name' });
    expect(item.name).toBe('New Name');
    expect(items.updated).toHaveLength(1);
  });
});
