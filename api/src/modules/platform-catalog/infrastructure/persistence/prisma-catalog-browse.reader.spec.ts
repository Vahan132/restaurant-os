import 'reflect-metadata';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { CatalogItemStatus } from '../../domain/entities/catalog-item';
import { PrismaCatalogBrowseReader } from './prisma-catalog-browse.reader';

interface CapturedWhere {
  status?: string;
  categoryId?: string;
  OR?: Array<Record<string, unknown>>;
}
interface CapturedListArgs {
  where: CapturedWhere;
  skip: number;
  take: number;
}
interface Calls {
  findMany?: CapturedListArgs;
  count?: { where: CapturedWhere };
  findUnique?: unknown;
}

/** Minimal Prisma stub capturing the args the reader builds. */
function fakePrisma(rows: unknown[], total: number, one: unknown = null): {
  prisma: PrismaService;
  calls: Calls;
} {
  const calls: Calls = {};
  const prisma = {
    catalogItem: {
      findMany: (args: CapturedListArgs) => {
        calls.findMany = args;
        return Promise.resolve(rows);
      },
      count: (args: { where: CapturedWhere }) => {
        calls.count = args;
        return Promise.resolve(total);
      },
      findUnique: (args: unknown) => {
        calls.findUnique = args;
        return Promise.resolve(one);
      },
    },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  return { prisma: prisma as unknown as PrismaService, calls };
}

const row = (over: Record<string, unknown> = {}) => ({
  id: 'i1',
  slug: 'tomato',
  nameHy: 'Լոլիկ',
  nameRu: 'Помидор',
  nameEn: 'Tomato',
  categoryId: null,
  adgCode: null,
  status: 'ACTIVE',
  allergensReviewed: false,
  allergens: [],
  category: null,
  ...over,
});

describe('PrismaCatalogBrowseReader', () => {
  it('lists ACTIVE-only and searches slug + all three name locales', async () => {
    const { prisma, calls } = fakePrisma([row()], 1);
    const reader = new PrismaCatalogBrowseReader(prisma);
    await reader.listActive({ search: 'tom', categoryId: 'produce', skip: 20, take: 10 });

    expect(calls.findMany!.where.status).toBe('ACTIVE');
    expect(calls.findMany!.where.categoryId).toBe('produce');
    expect(calls.findMany!.skip).toBe(20);
    expect(calls.findMany!.take).toBe(10);
    const orFields = (calls.findMany!.where.OR ?? []).map((c) => Object.keys(c)[0]);
    expect(orFields.sort()).toEqual(['nameEn', 'nameHy', 'nameRu', 'slug']);
    // count uses the same ACTIVE-scoped filter.
    expect(calls.count!.where.status).toBe('ACTIVE');
  });

  it('omits the search OR when no search term is given', async () => {
    const { prisma, calls } = fakePrisma([], 0);
    const reader = new PrismaCatalogBrowseReader(prisma);
    await reader.listActive({ skip: 0, take: 20 });
    expect(calls.findMany!.where.status).toBe('ACTIVE');
    expect(calls.findMany!.where.OR).toBeUndefined();
  });

  it('maps a row to a browse view (sorted allergens, localized category, status)', async () => {
    const { prisma } = fakePrisma(
      [],
      0,
      row({
        categoryId: 'c1',
        adgCode: '01',
        allergensReviewed: true,
        status: 'ARCHIVED',
        allergens: [{ allergen: { slug: 'milk' } }, { allergen: { slug: 'gluten' } }],
        category: { id: 'c1', slug: 'produce', labelHy: 'x', labelRu: 'y', labelEn: 'z' },
      }),
    );
    const reader = new PrismaCatalogBrowseReader(prisma);
    const view = await reader.findById('i1');
    expect(view).not.toBeNull();
    expect(view!.status).toBe(CatalogItemStatus.ARCHIVED);
    expect(view!.allergenSlugs).toEqual(['gluten', 'milk']);
    expect(view!.category).toEqual({
      id: 'c1',
      slug: 'produce',
      name: { hy: 'x', ru: 'y', en: 'z' },
    });
    expect(view!.name).toEqual({ hy: 'Լոլիկ', ru: 'Помидор', en: 'Tomato' });
  });

  it('returns null from findById when the row is absent', async () => {
    const { prisma } = fakePrisma([], 0, null);
    const reader = new PrismaCatalogBrowseReader(prisma);
    expect(await reader.findById('missing')).toBeNull();
  });

  // INV-SEARCH-1: ids-by-search projection backing the two-step adopted-item search.
  it('searchActiveIds returns ids, ACTIVE-scoped, matching slug + all three locales', async () => {
    const { prisma, calls } = fakePrisma([{ id: 'a' }, { id: 'b' }], 2);
    const reader = new PrismaCatalogBrowseReader(prisma);
    const ids = await reader.searchActiveIds('  tom  ');

    expect(ids).toEqual(['a', 'b']);
    expect(calls.findMany!.where.status).toBe('ACTIVE');
    const orFields = (calls.findMany!.where.OR ?? []).map((c) => Object.keys(c)[0]);
    expect(orFields.sort()).toEqual(['nameEn', 'nameHy', 'nameRu', 'slug']);
    // ids-only projection (no pagination on this call — all matches for the term).
    expect((calls.findMany as unknown as { select?: unknown }).select).toEqual({ id: true });
    expect(calls.findMany!.skip).toBeUndefined();
    expect(calls.findMany!.take).toBeUndefined();
  });

  it('searchActiveIds short-circuits to [] on a blank term (no query)', async () => {
    const { prisma, calls } = fakePrisma([{ id: 'a' }], 1);
    const reader = new PrismaCatalogBrowseReader(prisma);
    expect(await reader.searchActiveIds('   ')).toEqual([]);
    expect(calls.findMany).toBeUndefined();
  });
});
