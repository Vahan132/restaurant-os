import 'reflect-metadata';
import { IdGenerator } from '../../../identity/application/ports/id-generator';
import { OrderItemBuilder } from './order-item-builder';
import {
  MenuItemForOrder,
  MenuItemWithModifiersForOrder,
  MenuReader,
} from '../ports/menu-reader.port';

/** FISCAL-DEPT-1 — the branch fiscal department is snapshotted onto the order line. */

const menuItem = (over: Partial<MenuItemForOrder> = {}): MenuItemForOrder => ({
  id: 'mi-1',
  branchId: 'b1',
  code: 'coffee',
  adgCode: '2130000000',
  dep: '7',
  name: 'Coffee',
  priceAmount: 50000,
  preparationStation: 'BAR',
  status: 'ACTIVE',
  availability: 'AVAILABLE',
  ...over,
});

class FakeMenuReader implements MenuReader {
  constructor(private readonly item: MenuItemForOrder) {}
  async getItemWithModifiers(): Promise<MenuItemWithModifiersForOrder | null> {
    return { item: this.item, groups: [] };
  }
}

let counter = 0;
const ids: IdGenerator = { generate: () => `id-${(counter += 1)}` };

const buildInput = {
  restaurantId: 'r1',
  branchId: 'b1',
  orderId: 'o1',
  menuItemId: 'mi-1',
  quantity: 2,
  selectedOptionIds: [],
  note: null,
};

describe('OrderItemBuilder — dep snapshot (FISCAL-DEPT-1)', () => {
  it('snapshots the menu item dep onto the order line', async () => {
    const builder = new OrderItemBuilder(new FakeMenuReader(menuItem({ dep: '7' })), ids);
    const line = await builder.build(buildInput);
    expect(line.dep).toBe('7');
  });

  it('snapshots null when the dish is unassigned (fail-closed happens later, at fiscalize)', async () => {
    const builder = new OrderItemBuilder(new FakeMenuReader(menuItem({ dep: null })), ids);
    const line = await builder.build(buildInput);
    expect(line.dep).toBeNull();
  });
});
