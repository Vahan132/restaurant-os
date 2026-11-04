import 'reflect-metadata';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { PrismaInventoryItemRepository } from './prisma-inventory-item.repository';

interface CapturedWhere {
  restaurantId?: string;
  branchId?: string;
  deletedAt?: null;
  categoryId?: string;
  kind?: string;
  name?: unknown;
  OR?: Array<Record<string, unknown>>;
}
interface CapturedFindMany {
  where: CapturedWhere;
  skip?: number;
  take?: number;
  orderBy?: unknown;
}

function fakePrisma(): { prisma: PrismaService; calls: { findMany?: CapturedFindMany } } {
  const calls: { findMany?: CapturedFindMany } = {};
  const prisma = {
    inventoryItem: {
      findMany: (args: CapturedFindMany) => {
        calls.findMany = args;
        return Promise.resolve([]); // mapper not exercised — we assert on the query
      },
    },
  };
  return { prisma: prisma as unknown as PrismaService, calls };
}

const base = { restaurantId: 'r1', branchId: 'b1' };

describe('PrismaInventoryItemRepository.list (INV-SEARCH-1)', () => {
  it('builds a two-step OR (local name OR adopted catalog match) when a term matches catalog ids', async () => {
    const { prisma, calls } = fakePrisma();
    const repo = new PrismaInventoryItemRepository(prisma);
    await repo.list({ ...base, search: 'tom', matchedCatalogItemIds: ['c1', 'c2'] });

    const or = calls.findMany!.where.OR!;
    expect(or).toEqual([
      { name: { contains: 'tom', mode: 'insensitive' } },
      { catalogItemId: { in: ['c1', 'c2'] } },
    ]);
    // Sort + pagination moved to the app layer.
    expect(calls.findMany!.orderBy).toBeUndefined();
    expect(calls.findMany!.skip).toBeUndefined();
    expect(calls.findMany!.take).toBeUndefined();
  });

  it('keeps only the local-name clause when the term matches no catalog id', async () => {
    const { prisma, calls } = fakePrisma();
    const repo = new PrismaInventoryItemRepository(prisma);
    await repo.list({ ...base, search: 'zzz', matchedCatalogItemIds: [] });

    expect(calls.findMany!.where.OR).toEqual([{ name: { contains: 'zzz', mode: 'insensitive' } }]);
  });

  it('emits no OR when there is no search term', async () => {
    const { prisma, calls } = fakePrisma();
    const repo = new PrismaInventoryItemRepository(prisma);
    await repo.list({ ...base, categoryId: 'cat1' });

    expect(calls.findMany!.where.OR).toBeUndefined();
    expect(calls.findMany!.where.categoryId).toBe('cat1');
    expect(calls.findMany!.where.deletedAt).toBeNull();
  });
});
