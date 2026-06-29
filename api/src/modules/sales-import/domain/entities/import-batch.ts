import { ImportBatchStatus } from '../enums';

/**
 * ImportBatch — tracks one CSV upload (5A): counts + outcome status. Pure domain.
 * The batch is the unit the importer reports on; its child ImportedSale rows
 * cascade with it.
 */
export interface ImportBatchProps {
  restaurantId: string;
  /** Null when the file spanned multiple branches; else the single branch. */
  branchId: string | null;
  fileName: string;
  importedByUserId: string;
  rowCount: number;
  successCount: number;
  errorCount: number;
  status: ImportBatchStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class ImportBatch {
  private constructor(
    private readonly _id: string,
    private readonly props: ImportBatchProps,
  ) {}

  /**
   * Build a finished batch from the import outcome. `status` is DERIVED from the
   * counts + structural validity so callers can never set an inconsistent state:
   *   - structurallyValid === false → FAILED (nothing imported)
   *   - errorCount === 0 && successCount > 0 → COMPLETED
   *   - otherwise → PARTIAL (valid file, some/all rows skipped)
   */
  static create(input: {
    id: string;
    restaurantId: string;
    branchId: string | null;
    fileName: string;
    importedByUserId: string;
    rowCount: number;
    successCount: number;
    errorCount: number;
    structurallyValid: boolean;
  }): ImportBatch {
    const now = new Date();
    const status = !input.structurallyValid
      ? ImportBatchStatus.FAILED
      : input.errorCount === 0 && input.successCount > 0
        ? ImportBatchStatus.COMPLETED
        : ImportBatchStatus.PARTIAL;
    return new ImportBatch(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      fileName: input.fileName,
      importedByUserId: input.importedByUserId,
      rowCount: input.rowCount,
      successCount: input.successCount,
      errorCount: input.errorCount,
      status,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: string, props: ImportBatchProps): ImportBatch {
    return new ImportBatch(id, props);
  }

  get id(): string {
    return this._id;
  }
  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string | null {
    return this.props.branchId;
  }
  get fileName(): string {
    return this.props.fileName;
  }
  get importedByUserId(): string {
    return this.props.importedByUserId;
  }
  get rowCount(): number {
    return this.props.rowCount;
  }
  get successCount(): number {
    return this.props.successCount;
  }
  get errorCount(): number {
    return this.props.errorCount;
  }
  get status(): ImportBatchStatus {
    return this.props.status;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
