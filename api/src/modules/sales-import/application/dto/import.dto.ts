import { ApiProperty } from '@nestjs/swagger';
import { ImportBatch } from '../../domain/entities/import-batch';
import { ImportBatchStatus } from '../../domain/enums';

/** Outcome of a single CSV data row. */
export type RowStatus = 'IMPORTED' | 'SKIPPED_DUPLICATE' | 'ERROR';

export class RowResultResponse {
  @ApiProperty({ description: '1-based data-row index (header excluded).' })
  row!: number;

  @ApiProperty({ enum: ['IMPORTED', 'SKIPPED_DUPLICATE', 'ERROR'] })
  status!: RowStatus;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Reason for a skip/error (null when imported).',
  })
  message!: string | null;
}

/** Full result of an upload: batch summary + per-row success/error breakdown. */
export class ImportResultResponse {
  @ApiProperty() batchId!: string;
  @ApiProperty() fileName!: string;

  @ApiProperty({
    enum: Object.values(ImportBatchStatus),
    description: 'COMPLETED | PARTIAL | FAILED.',
  })
  status!: ImportBatchStatus;

  @ApiProperty({ description: 'Total data rows in the file (header excluded).' })
  rowCount!: number;

  @ApiProperty({ description: 'Rows imported.' })
  successCount!: number;

  @ApiProperty({ description: 'Rows not imported (invalid + duplicates).' })
  errorCount!: number;

  @ApiProperty({ description: 'Of errorCount, how many were skipped duplicates.' })
  duplicateCount!: number;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Single resolved branch, or null when the file spanned branches.',
  })
  branchId!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Structural failure reason (e.g. missing columns); null otherwise.',
  })
  note!: string | null;

  @ApiProperty({ type: [RowResultResponse] })
  rows!: RowResultResponse[];
}

/** An import batch as listed / fetched. */
export class ImportBatchResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true, type: String }) branchId!: string | null;
  @ApiProperty() fileName!: string;
  @ApiProperty() importedByUserId!: string;
  @ApiProperty() rowCount!: number;
  @ApiProperty() successCount!: number;
  @ApiProperty() errorCount!: number;
  @ApiProperty({ enum: Object.values(ImportBatchStatus) }) status!: ImportBatchStatus;
  @ApiProperty() createdAt!: string;

  static from(batch: ImportBatch): ImportBatchResponse {
    return {
      id: batch.id,
      branchId: batch.branchId,
      fileName: batch.fileName,
      importedByUserId: batch.importedByUserId,
      rowCount: batch.rowCount,
      successCount: batch.successCount,
      errorCount: batch.errorCount,
      status: batch.status,
      createdAt: batch.createdAt.toISOString(),
    };
  }
}
