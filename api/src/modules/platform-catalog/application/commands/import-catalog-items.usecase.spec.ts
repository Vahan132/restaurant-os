import 'reflect-metadata';
import { CatalogItem } from '../../domain/entities/catalog-item';
import { CatalogItemRepository } from '../../domain/repositories/catalog-item.repository';
import {
  AllergenView,
  CatalogCategoryView,
  CatalogTaxonomyReader,
} from '../../domain/repositories/catalog-taxonomy.reader';
import { IdGenerator } from '../../../identity/application/ports/id-generator';
import { ImportCatalogItemsUseCase } from './import-catalog-items.usecase';

const HEADER = 'slug,nameHy,nameRu,nameEn,category,adgCode,allergens,allergensReviewed,status';
const csv = (...rows: string[]): string => [HEADER, ...rows].join('\n');

/** In-memory repository fake capturing saveAll calls. */
class FakeRepo implements CatalogItemRepository {
  readonly store = new Map<string, CatalogItem>();
  saveAllCalls = 0;
  lastCreates: readonly CatalogItem[] = [];
  lastUpdates: readonly CatalogItem[] = [];

  constructor(seed: CatalogItem[] = []) {
    for (const item of seed) this.store.set(item.slug, item);
  }

  async findManyBySlugs(slugs: readonly string[]): Promise<CatalogItem[]> {
    return [...new Set(slugs)]
      .map((s) => this.store.get(s))
      .filter((i): i is CatalogItem => i !== undefined);
  }

  async saveAll(
    creates: readonly CatalogItem[],
    updates: readonly CatalogItem[],
  ): Promise<void> {
    this.saveAllCalls++;
    this.lastCreates = creates;
    this.lastUpdates = updates;
    for (const item of creates) this.store.set(item.slug, item);
  }

  // Unused by the importer.
  async create(): Promise<void> {
    throw new Error('not used');
  }
  async update(): Promise<void> {
    throw new Error('not used');
  }
  async findById(): Promise<CatalogItem | null> {
    throw new Error('not used');
  }
  async existsBySlug(): Promise<boolean> {
    throw new Error('not used');
  }
  async list(): Promise<never> {
    throw new Error('not used');
  }
}

const category = (slug: string, id: string): CatalogCategoryView => ({
  id,
  slug,
  labelHy: slug,
  labelRu: slug,
  labelEn: slug,
  position: 0,
});
const allergen = (slug: string): AllergenView => ({
  id: `al-${slug}`,
  slug,
  labelHy: slug,
  labelRu: slug,
  labelEn: slug,
  position: 0,
});

class FakeTaxonomy implements CatalogTaxonomyReader {
  async listCategories(): Promise<CatalogCategoryView[]> {
    return [category('produce', 'cat-produce'), category('dairy', 'cat-dairy')];
  }
  async listAllergens(): Promise<AllergenView[]> {
    return [allergen('gluten'), allergen('milk'), allergen('eggs')];
  }
  async findUnknownAllergenSlugs(): Promise<string[]> {
    return [];
  }
  async categoryExists(): Promise<boolean> {
    return true;
  }
}

class FakeIds implements IdGenerator {
  private n = 0;
  generate(): string {
    return `id-${++this.n}`;
  }
}

function makeUseCase(seed: CatalogItem[] = []): {
  useCase: ImportCatalogItemsUseCase;
  repo: FakeRepo;
} {
  const repo = new FakeRepo(seed);
  const useCase = new ImportCatalogItemsUseCase(repo, new FakeTaxonomy(), new FakeIds());
  return { useCase, repo };
}

const seededItem = (over: Partial<Parameters<typeof CatalogItem.create>[0]> = {}): CatalogItem =>
  CatalogItem.create({
    id: 'seed',
    slug: 'tomato',
    nameHy: 'a',
    nameRu: 'b',
    nameEn: 'Old',
    categoryId: null,
    adgCode: null,
    allergenSlugs: [],
    ...over,
  });

describe('ImportCatalogItemsUseCase', () => {
  it('creates a new item on APPLY and writes it', async () => {
    const { useCase, repo } = makeUseCase();
    const result = await useCase.execute({
      mode: 'APPLY',
      csv: csv('tomato,Ա,Б,Tomato,produce,,gluten|milk,true,ACTIVE'),
    });
    expect(result.applied).toBe(true);
    expect(result.summary.toCreate).toBe(1);
    expect(result.rows[0].action).toBe('CREATE');
    const saved = repo.store.get('tomato');
    expect(saved?.categoryId).toBe('cat-produce');
    expect(saved?.allergenSlugs).toEqual(['gluten', 'milk']);
    expect(saved?.allergensReviewed).toBe(true);
  });

  it('updates an existing item on OVERWRITE', async () => {
    const { useCase, repo } = makeUseCase([seededItem()]);
    const result = await useCase.execute({
      mode: 'APPLY',
      csv: csv('tomato,Ա,Б,Tomato,produce,,,false,ACTIVE'),
    });
    expect(result.rows[0].action).toBe('UPDATE');
    expect(result.applied).toBe(true);
    expect(repo.store.get('tomato')?.nameEn).toBe('Tomato');
    expect(repo.store.get('tomato')?.categoryId).toBe('cat-produce');
  });

  it('marks a byte-identical existing row UNCHANGED and writes nothing', async () => {
    const seed = seededItem({
      nameHy: 'Ա',
      nameRu: 'Б',
      nameEn: 'Tomato',
      categoryId: 'cat-produce',
      allergenSlugs: ['milk', 'gluten'],
    });
    const { useCase, repo } = makeUseCase([seed]);
    const result = await useCase.execute({
      mode: 'APPLY',
      csv: csv('tomato,Ա,Б,Tomato,produce,,gluten|milk,false,ACTIVE'),
    });
    expect(result.rows[0].action).toBe('UNCHANGED');
    expect(result.summary.unchanged).toBe(1);
    expect(repo.lastCreates).toHaveLength(0);
    expect(repo.lastUpdates).toHaveLength(0);
  });

  it('skips an existing row when conflictStrategy=SKIP', async () => {
    const { useCase } = makeUseCase([seededItem()]);
    const result = await useCase.execute({
      mode: 'DRY_RUN',
      conflictStrategy: 'SKIP',
      csv: csv('tomato,Ա,Б,New,produce,,,false,ACTIVE'),
    });
    expect(result.rows[0].action).toBe('SKIP');
    expect(result.summary.skipped).toBe(1);
  });

  it('DRY_RUN never writes', async () => {
    const { useCase, repo } = makeUseCase();
    const result = await useCase.execute({
      mode: 'DRY_RUN',
      csv: csv('basil,Ա,Б,Basil,produce,,,,'),
    });
    expect(result.applied).toBe(false);
    expect(result.rows[0].action).toBe('CREATE');
    expect(repo.saveAllCalls).toBe(0);
  });

  it('reports UNKNOWN_CATEGORY and aborts APPLY', async () => {
    const { useCase, repo } = makeUseCase();
    const result = await useCase.execute({
      mode: 'APPLY',
      csv: csv('kiwi,Ա,Б,Kiwi,nope,,,,'),
    });
    expect(result.rows[0].action).toBe('ERROR');
    expect(result.rows[0].messages[0].code).toBe('UNKNOWN_CATEGORY');
    expect(result.applied).toBe(false);
    expect(repo.saveAllCalls).toBe(0);
  });

  it('reports UNKNOWN_ALLERGEN', async () => {
    const { useCase } = makeUseCase();
    const result = await useCase.execute({
      mode: 'DRY_RUN',
      csv: csv('kiwi,Ա,Б,Kiwi,,,peanut,,'),
    });
    expect(result.rows[0].action).toBe('ERROR');
    expect(result.rows[0].messages.some((m) => m.code === 'UNKNOWN_ALLERGEN')).toBe(true);
  });

  it('flags every DUPLICATE_SLUG_IN_FILE occurrence', async () => {
    const { useCase } = makeUseCase();
    const result = await useCase.execute({
      mode: 'DRY_RUN',
      csv: csv('dup,Ա,Б,One,,,,,', 'dup,Ա,Б,Two,,,,,'),
    });
    expect(result.summary.errors).toBe(2);
    expect(
      result.rows.every((r) => r.messages.some((m) => m.code === 'DUPLICATE_SLUG_IN_FILE')),
    ).toBe(true);
  });

  it('aborts APPLY entirely when any row errors', async () => {
    const { useCase, repo } = makeUseCase();
    const result = await useCase.execute({
      mode: 'APPLY',
      csv: csv('good,Ա,Б,Good,produce,,,,', 'bad,,,,,,,,'),
    });
    expect(result.applied).toBe(false);
    expect(repo.saveAllCalls).toBe(0);
    expect(result.rows[0].action).toBe('CREATE');
    expect(result.rows[1].action).toBe('ERROR');
  });

  it('throws CATALOG_IMPORT_INVALID_CSV on missing required headers', async () => {
    const { useCase } = makeUseCase();
    await expect(
      useCase.execute({ mode: 'DRY_RUN', csv: 'slug,nameHy,nameRu\nx,a,b' }),
    ).rejects.toMatchObject({ response: { code: 'CATALOG_IMPORT_INVALID_CSV' } });
  });

  it('maps headers tolerantly and parses quoted fields', async () => {
    const { useCase } = makeUseCase();
    const result = await useCase.execute({
      mode: 'DRY_RUN',
      csv: 'Slug,name_hy,NAME RU,nameEn,Category\n"herb-mix",Ա,Б,"Basil, dried",produce',
    });
    expect(result.rows[0].action).toBe('CREATE');
    expect(result.rows[0].slug).toBe('herb-mix');
  });
});
