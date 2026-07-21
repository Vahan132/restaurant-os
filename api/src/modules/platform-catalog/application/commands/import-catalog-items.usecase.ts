import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { CatalogItem, CatalogItemStatus } from '../../domain/entities/catalog-item';
import {
  CATALOG_ITEM_REPOSITORY,
  CatalogItemRepository,
} from '../../domain/repositories/catalog-item.repository';
import {
  CATALOG_TAXONOMY_READER,
  CatalogTaxonomyReader,
} from '../../domain/repositories/catalog-taxonomy.reader';
import {
  ConflictStrategy,
  ImportCatalogItemsResponse,
  ImportItemRowResponse,
  ImportMode,
  ImportRowAction,
  ImportRowMessageResponse,
} from '../dto/import-catalog-items.dto';
import { parseCatalogCsv, ParsedCsvRow } from './catalog-csv';

export interface ImportCatalogItemsInput {
  mode: ImportMode;
  conflictStrategy?: ConflictStrategy;
  csv: string;
}

const SLUG_RE = /^[a-z0-9-]+$/;
const TRUE_VALUES = new Set(['true', '1', 'yes']);
const FALSE_VALUES = new Set(['false', '0', 'no']);

/** A validated row plus its resolved target fields, ready for APPLY. */
interface RowPlan {
  line: number;
  slug: string;
  action: ImportRowAction;
  messages: ImportRowMessageResponse[];
  resolved?: {
    slug: string;
    nameHy: string;
    nameRu: string;
    nameEn: string;
    categoryId: string | null;
    allergenSlugs: string[];
    allergensReviewed: boolean;
    status: CatalogItemStatus;
    /** Present when the slug already exists (UPDATE / UNCHANGED / SKIP). */
    existing?: CatalogItem;
  };
}

/**
 * Bulk-import platform CatalogItems from a CSV (PLATCAT-IMPORT-1).
 *
 * Single pass, no N+1: parse → batch-load taxonomy + existing slugs once → validate
 * every row (collecting per-row errors, never throwing on the first) → DRY_RUN
 * returns the plan without writing; APPLY aborts writing if ANY row errored,
 * otherwise executes all creates/updates in one transaction reusing the same
 * entity construction the single-item use-cases use.
 *
 * References categories + allergens by slug against seed-managed reference data —
 * it NEVER creates a category or allergen. `status` is honored on CREATE only;
 * archive/restore of an existing item is the dedicated archive endpoint's job (the
 * domain has no restore), so the column is ignored for existing rows.
 */
@Injectable()
export class ImportCatalogItemsUseCase
  implements UseCase<ImportCatalogItemsInput, ImportCatalogItemsResponse>
{
  constructor(
    @Inject(CATALOG_ITEM_REPOSITORY) private readonly repo: CatalogItemRepository,
    @Inject(CATALOG_TAXONOMY_READER) private readonly taxonomy: CatalogTaxonomyReader,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: ImportCatalogItemsInput): Promise<ImportCatalogItemsResponse> {
    const conflictStrategy: ConflictStrategy = input.conflictStrategy ?? 'OVERWRITE';
    const rows = parseCatalogCsv(input.csv); // throws CATALOG_IMPORT_INVALID_CSV

    // Batch-load reference data + existing items once.
    const [categories, allergens] = await Promise.all([
      this.taxonomy.listCategories(),
      this.taxonomy.listAllergens(),
    ]);
    const categoryIdBySlug = new Map(categories.map((c) => [c.slug, c.id]));
    const allergenSlugs = new Set(allergens.map((a) => a.slug));

    const candidateSlugs = rows
      .map((r) => r.cells.slug.trim().toLowerCase())
      .filter((s) => s.length > 0);
    const existing = await this.repo.findManyBySlugs(candidateSlugs);
    const existingBySlug = new Map(existing.map((e) => [e.slug, e]));

    // Count slug occurrences (for DUPLICATE_SLUG_IN_FILE — flags every duplicate).
    const slugCounts = new Map<string, number>();
    for (const s of candidateSlugs) {
      slugCounts.set(s, (slugCounts.get(s) ?? 0) + 1);
    }

    const plans = rows.map((row) =>
      this.validateRow(row, {
        conflictStrategy,
        categoryIdBySlug,
        allergenSlugs,
        existingBySlug,
        slugCounts,
      }),
    );

    const summary = this.summarize(plans);
    const hasErrors = summary.errors > 0;

    let applied = false;
    if (input.mode === 'APPLY' && !hasErrors) {
      await this.apply(plans);
      applied = true;
    }

    return {
      mode: input.mode,
      conflictStrategy,
      applied,
      summary,
      rows: plans.map(
        (p): ImportItemRowResponse => ({
          line: p.line,
          slug: p.slug,
          action: p.action,
          messages: p.messages,
        }),
      ),
    };
  }

  private validateRow(
    row: ParsedCsvRow,
    ctx: {
      conflictStrategy: ConflictStrategy;
      categoryIdBySlug: Map<string, string>;
      allergenSlugs: Set<string>;
      existingBySlug: Map<string, CatalogItem>;
      slugCounts: Map<string, number>;
    },
  ): RowPlan {
    const messages: ImportRowMessageResponse[] = [];
    const c = row.cells;

    const rawSlug = c.slug.trim();
    const slug = rawSlug.toLowerCase();
    const nameHy = c.namehy.trim();
    const nameRu = c.nameru.trim();
    const nameEn = c.nameen.trim();

    // Required fields.
    if (rawSlug === '') {
      messages.push(err('MISSING_REQUIRED_FIELD', 'slug', 'slug is required.'));
    } else if (!SLUG_RE.test(slug)) {
      messages.push(err('INVALID_SLUG', 'slug', 'slug must match [a-z0-9-]+.'));
    } else if ((ctx.slugCounts.get(slug) ?? 0) > 1) {
      messages.push(err('DUPLICATE_SLUG_IN_FILE', 'slug', `slug "${slug}" appears more than once.`));
    }
    if (nameHy === '') messages.push(err('MISSING_REQUIRED_FIELD', 'nameHy', 'nameHy is required.'));
    if (nameRu === '') messages.push(err('MISSING_REQUIRED_FIELD', 'nameRu', 'nameRu is required.'));
    if (nameEn === '') messages.push(err('MISSING_REQUIRED_FIELD', 'nameEn', 'nameEn is required.'));

    // Category (slug → id; blank = null).
    const categoryRaw = c.category.trim();
    let categoryId: string | null = null;
    if (categoryRaw !== '') {
      const resolved = ctx.categoryIdBySlug.get(categoryRaw);
      if (resolved === undefined) {
        messages.push(err('UNKNOWN_CATEGORY', 'category', `Unknown category slug "${categoryRaw}".`));
      } else {
        categoryId = resolved;
      }
    }

    // Allergens (|-delimited existing slugs).
    const allergenList = c.allergens
      .split('|')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const a of allergenList) {
      if (!ctx.allergenSlugs.has(a)) {
        messages.push(err('UNKNOWN_ALLERGEN', 'allergens', `Unknown allergen slug "${a}".`));
      }
    }

    // allergensReviewed (default false).
    const reviewedRaw = c.allergensreviewed.trim().toLowerCase();
    let allergensReviewed = false;
    if (reviewedRaw !== '') {
      if (TRUE_VALUES.has(reviewedRaw)) allergensReviewed = true;
      else if (FALSE_VALUES.has(reviewedRaw)) allergensReviewed = false;
      else
        messages.push(
          err('INVALID_VALUE', 'allergensReviewed', `Not a boolean: "${reviewedRaw}".`),
        );
    }

    // status (default ACTIVE).
    const statusRaw = c.status.trim().toUpperCase();
    let status = CatalogItemStatus.ACTIVE;
    if (statusRaw !== '') {
      if (statusRaw === CatalogItemStatus.ACTIVE || statusRaw === CatalogItemStatus.ARCHIVED) {
        status = statusRaw as CatalogItemStatus;
      } else {
        messages.push(err('INVALID_VALUE', 'status', `Not a valid status: "${statusRaw}".`));
      }
    }

    const reportSlug = slug !== '' ? slug : rawSlug;
    if (messages.length > 0) {
      return { line: row.line, slug: reportSlug, action: 'ERROR', messages };
    }

    // Determine action for a fully valid row.
    const existing = ctx.existingBySlug.get(slug);
    const allergenSlugs = normalize(allergenList);
    const resolved = {
      slug,
      nameHy,
      nameRu,
      nameEn,
      categoryId,
      allergenSlugs,
      allergensReviewed,
      status,
      existing,
    };

    let action: ImportRowAction;
    if (!existing) {
      action = 'CREATE';
    } else if (ctx.conflictStrategy === 'SKIP') {
      action = 'SKIP';
    } else if (isUnchanged(existing, resolved)) {
      action = 'UNCHANGED';
    } else {
      action = 'UPDATE';
    }

    return { line: row.line, slug: reportSlug, action, messages, resolved };
  }

  /** Build entities from valid plans and persist creates + updates in one transaction. */
  private async apply(plans: RowPlan[]): Promise<void> {
    const creates: CatalogItem[] = [];
    const updates: CatalogItem[] = [];

    for (const plan of plans) {
      const r = plan.resolved;
      if (!r) continue;
      if (plan.action === 'CREATE') {
        const item = CatalogItem.create({
          id: this.ids.generate(),
          slug: r.slug,
          nameHy: r.nameHy,
          nameRu: r.nameRu,
          nameEn: r.nameEn,
          categoryId: r.categoryId,
          allergenSlugs: r.allergenSlugs,
          allergensReviewed: r.allergensReviewed,
        });
        if (r.status === CatalogItemStatus.ARCHIVED) {
          item.archive();
        }
        creates.push(item);
      } else if (plan.action === 'UPDATE' && r.existing) {
        r.existing.update({
          nameHy: r.nameHy,
          nameRu: r.nameRu,
          nameEn: r.nameEn,
          categoryId: r.categoryId,
          allergenSlugs: r.allergenSlugs,
          allergensReviewed: r.allergensReviewed,
        });
        updates.push(r.existing);
      }
    }

    await this.repo.saveAll(creates, updates);
  }

  private summarize(plans: RowPlan[]): ImportCatalogItemsResponse['summary'] {
    const summary = { total: plans.length, toCreate: 0, toUpdate: 0, unchanged: 0, skipped: 0, errors: 0 };
    for (const p of plans) {
      switch (p.action) {
        case 'CREATE':
          summary.toCreate++;
          break;
        case 'UPDATE':
          summary.toUpdate++;
          break;
        case 'UNCHANGED':
          summary.unchanged++;
          break;
        case 'SKIP':
          summary.skipped++;
          break;
        case 'ERROR':
          summary.errors++;
          break;
      }
    }
    return summary;
  }
}

function err(code: string, field: string, detail: string): ImportRowMessageResponse {
  return { code, field, detail };
}

function normalize(slugs: string[]): string[] {
  return Array.from(new Set(slugs)).sort();
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** True when an existing item's resolvable fields already match the row (status excluded). */
function isUnchanged(
  existing: CatalogItem,
  r: {
    nameHy: string;
    nameRu: string;
    nameEn: string;
    categoryId: string | null;
    allergenSlugs: string[];
    allergensReviewed: boolean;
  },
): boolean {
  return (
    existing.nameHy === r.nameHy &&
    existing.nameRu === r.nameRu &&
    existing.nameEn === r.nameEn &&
    existing.categoryId === r.categoryId &&
    existing.allergensReviewed === r.allergensReviewed &&
    arraysEqual(existing.allergenSlugs, r.allergenSlugs)
  );
}
