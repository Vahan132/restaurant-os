import { Inject, Injectable } from '@nestjs/common';
import {
  BRANCH_ACCESS_RESOLVER,
  BranchAccessResolver,
} from '../../../../shared/auth/branch-access.resolver';
import { UseCase } from '../../../../shared/application/use-case';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { ImportBatch } from '../../domain/entities/import-batch';
import { ImportedSale } from '../../domain/entities/imported-sale';
import { ImportBatchStatus } from '../../domain/enums';
import {
  SALES_IMPORT_REPOSITORY,
  SalesImportRepository,
} from '../../domain/repositories/sales-import.repository';
import { REQUIRED_COLUMNS, mapHeader } from '../../domain/value-objects/canonical-columns';
import { NoRestaurantInScope } from '../application.errors';
import {
  BRANCH_DIRECTORY_READER,
  BranchDirectoryReader,
} from '../ports/branch-directory.reader';
import { RowStatus } from '../dto/import.dto';
import { CsvParserService } from '../services/csv-parser.service';
import { ColumnIndex, ParsedRow, SaleRowValidator } from '../services/sale-row.validator';

/** Hard ceiling on data rows per upload (defensive). */
const MAX_ROWS = 100_000;

export interface ImportSalesCsvInput {
  organizationId: string;
  restaurantId: string | null;
  userId: string;
  fileName: string;
  /** Decoded CSV text (UTF-8). */
  content: string;
}

export interface RowResult {
  row: number;
  status: RowStatus;
  message: string | null;
}

export interface ImportSalesCsvOutput {
  batchId: string;
  fileName: string;
  status: ImportBatchStatus;
  rowCount: number;
  successCount: number;
  errorCount: number;
  duplicateCount: number;
  branchId: string | null;
  note: string | null;
  rows: RowResult[];
}

/**
 * Parse → validate → import a CSV of historical/external sales (5A).
 *
 * Structural isolation guarantee: this use case ONLY writes ImportBatch +
 * ImportedSale rows. It NEVER touches orders, payments, fiscalization, or the
 * inventory ledger — imported sales cannot enter any fiscal total or deplete
 * stock by construction.
 */
@Injectable()
export class ImportSalesCsvUseCase implements UseCase<ImportSalesCsvInput, ImportSalesCsvOutput> {
  constructor(
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(SALES_IMPORT_REPOSITORY) private readonly repo: SalesImportRepository,
    @Inject(BRANCH_DIRECTORY_READER) private readonly branchDirectory: BranchDirectoryReader,
    @Inject(BRANCH_ACCESS_RESOLVER) private readonly branchAccess: BranchAccessResolver,
    private readonly csv: CsvParserService,
    private readonly validator: SaleRowValidator,
  ) {}

  async execute(input: ImportSalesCsvInput): Promise<ImportSalesCsvOutput> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const restaurantId = input.restaurantId;

    const parsed = this.csv.parse(input.content);
    if (!parsed) {
      return this.failStructural(restaurantId, input, 0, 'CSV is empty or unreadable.');
    }
    if (parsed.records.length > MAX_ROWS) {
      return this.failStructural(
        restaurantId,
        input,
        parsed.records.length,
        `File exceeds the ${MAX_ROWS}-row import limit.`,
      );
    }

    // Map headers → canonical columns (tolerant) and check required coverage.
    const columns: ColumnIndex = {};
    parsed.headers.forEach((h, idx) => {
      const canonical = mapHeader(h);
      if (canonical && columns[canonical] === undefined) columns[canonical] = idx;
    });
    const missing = REQUIRED_COLUMNS.filter((c) => columns[c] === undefined);
    if (missing.length > 0) {
      return this.failStructural(
        restaurantId,
        input,
        parsed.records.length,
        `Missing required column(s): ${missing.join(', ')}.`,
      );
    }

    // Branch resolution maps (by id and by lowercased name) + caller's reach.
    const branches = await this.branchDirectory.listBranches(restaurantId);
    const byId = new Set(branches.map((b) => b.id));
    const byName = new Map(branches.map((b) => [b.name.trim().toLowerCase(), b.id]));

    const access = await this.branchAccess.resolveAccessibleBranches({
      organizationId: input.organizationId,
      restaurantId,
      userId: input.userId,
    });
    const accessibleSet: Set<string> | null = access.allBranches
      ? null // null => every branch reachable
      : new Set(access.branches.map((b) => b.id));

    // ── Pass 1: field validation + branch resolution + scope check ───────────
    const results: RowResult[] = [];
    const candidates: { row: number; branchId: string; data: ParsedRow }[] = [];

    parsed.records.forEach((cells, i) => {
      const rowNo = i + 1;
      const outcome = this.validator.validate(cells, columns);
      if (!outcome.ok) {
        results.push({ row: rowNo, status: 'ERROR', message: outcome.reason });
        return;
      }
      const r = outcome.row;

      const resolvedId = byId.has(r.rawBranch)
        ? r.rawBranch
        : byName.get(r.rawBranch.trim().toLowerCase());
      if (!resolvedId) {
        results.push({ row: rowNo, status: 'ERROR', message: `Unknown branch: "${r.rawBranch}".` });
        return;
      }
      if (accessibleSet && !accessibleSet.has(resolvedId)) {
        results.push({
          row: rowNo,
          status: 'ERROR',
          message: `Branch "${r.rawBranch}" is outside your permitted scope.`,
        });
        return;
      }

      candidates.push({ row: rowNo, branchId: resolvedId, data: r });
    });

    // ── Idempotency: skip references already imported (DB) or repeated in-file ─
    const refs = candidates
      .map((c) => c.data.externalReference)
      .filter((x): x is string => x !== null);
    const existing = refs.length
      ? await this.repo.findExistingExternalReferences(restaurantId, refs)
      : new Set<string>();
    const seenInFile = new Set<string>();

    const batchId = this.ids.generate();
    const toImport: ImportedSale[] = [];
    let duplicateCount = 0;

    for (const c of candidates) {
      const ref = c.data.externalReference;
      if (ref !== null && (existing.has(ref) || seenInFile.has(ref))) {
        duplicateCount++;
        results.push({
          row: c.row,
          status: 'SKIPPED_DUPLICATE',
          message: `Duplicate external reference "${ref}" — already imported.`,
        });
        continue;
      }
      if (ref !== null) seenInFile.add(ref);
      toImport.push(
        ImportedSale.create({
          id: this.ids.generate(),
          restaurantId,
          branchId: c.branchId,
          importBatchId: batchId,
          occurredAt: c.data.occurredAt,
          itemDescription: c.data.itemDescription,
          // itemId left null: only set on a CONFIDENT catalog match (future hook).
          itemId: null,
          quantity: c.data.quantity,
          unitPriceAmount: c.data.unitPriceAmount,
          lineTotalAmount: c.data.lineTotalAmount,
          paymentMethod: c.data.paymentMethod,
          externalReference: ref,
        }),
      );
      results.push({ row: c.row, status: 'IMPORTED', message: null });
    }

    const rowCount = parsed.records.length;
    const successCount = toImport.length;
    const errorCount = rowCount - successCount;

    // Single resolved branch iff every imported row shares one; else null.
    const branchIds = new Set(toImport.map((s) => s.branchId));
    const batchBranchId = branchIds.size === 1 ? [...branchIds][0] : null;

    const batch = ImportBatch.create({
      id: batchId,
      restaurantId,
      branchId: batchBranchId,
      fileName: input.fileName,
      importedByUserId: input.userId,
      rowCount,
      successCount,
      errorCount,
      structurallyValid: true,
    });
    await this.repo.persistImport(batch, toImport);

    results.sort((a, b) => a.row - b.row);
    return {
      batchId,
      fileName: input.fileName,
      status: batch.status,
      rowCount,
      successCount,
      errorCount,
      duplicateCount,
      branchId: batchBranchId,
      note: null,
      rows: results,
    };
  }

  /** Persist a FAILED batch (structurally invalid file) and return its summary. */
  private async failStructural(
    restaurantId: string,
    input: ImportSalesCsvInput,
    rowCount: number,
    note: string,
  ): Promise<ImportSalesCsvOutput> {
    const batchId = this.ids.generate();
    const batch = ImportBatch.create({
      id: batchId,
      restaurantId,
      branchId: null,
      fileName: input.fileName,
      importedByUserId: input.userId,
      rowCount,
      successCount: 0,
      errorCount: rowCount,
      structurallyValid: false,
    });
    await this.repo.persistImport(batch, []);
    return {
      batchId,
      fileName: input.fileName,
      status: ImportBatchStatus.FAILED,
      rowCount,
      successCount: 0,
      errorCount: rowCount,
      duplicateCount: 0,
      branchId: null,
      note,
      rows: [],
    };
  }
}
