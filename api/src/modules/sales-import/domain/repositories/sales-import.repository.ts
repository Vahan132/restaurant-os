import { ImportBatch } from '../entities/import-batch';
import { ImportedSale } from '../entities/imported-sale';

/** DI token for the SalesImportRepository port. */
export const SALES_IMPORT_REPOSITORY = Symbol('SalesImportRepository');

/**
 * Branch scope for read queries. `all` (e.g. OWNER) sees every branch; otherwise
 * results are restricted to `branchIds` (an empty array reaches no branch).
 */
export type BranchScope = { all: true } | { all: false; branchIds: string[] };

export interface ListBatchesArgs {
  restaurantId: string;
  scope: BranchScope;
  skip: number;
  take: number;
}

/**
 * Repository PORT for the import aggregate (batch + its sales). The Prisma
 * implementation lives in infrastructure/persistence. Reads are branch-scoped;
 * writes persist the batch + its valid sales atomically.
 */
export interface SalesImportRepository {
  /**
   * Persist an import batch together with its valid sales rows in ONE
   * transaction. No fiscal/inventory side effects — pure inserts into the two
   * imported-sales tables.
   */
  persistImport(batch: ImportBatch, sales: ImportedSale[]): Promise<void>;

  /**
   * Of the supplied external references, return the subset that ALREADY exist
   * for this restaurant (idempotent re-import guard).
   */
  findExistingExternalReferences(
    restaurantId: string,
    references: string[],
  ): Promise<Set<string>>;

  /** List import batches (newest first), branch-scoped, with a total count. */
  listBatches(args: ListBatchesArgs): Promise<{ rows: ImportBatch[]; total: number }>;

  /**
   * Find one batch by id within the restaurant + branch scope. Returns null when
   * absent OR out of the caller's branch reach.
   */
  findBatchById(
    restaurantId: string,
    id: string,
    scope: BranchScope,
  ): Promise<ImportBatch | null>;
}
