import { ImportBatch as PrismaImportBatch } from '@prisma/client';
import { ImportBatch } from '../../domain/entities/import-batch';
import { ImportBatchStatus } from '../../domain/enums';

export class ImportBatchMapper {
  static toDomain(record: PrismaImportBatch): ImportBatch {
    return ImportBatch.reconstitute(record.id, {
      restaurantId: record.restaurantId,
      branchId: record.branchId,
      fileName: record.fileName,
      importedByUserId: record.importedByUserId,
      rowCount: record.rowCount,
      successCount: record.successCount,
      errorCount: record.errorCount,
      status: record.status as ImportBatchStatus,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toCreate(batch: ImportBatch) {
    return {
      id: batch.id,
      restaurantId: batch.restaurantId,
      branchId: batch.branchId,
      fileName: batch.fileName,
      importedByUserId: batch.importedByUserId,
      rowCount: batch.rowCount,
      successCount: batch.successCount,
      errorCount: batch.errorCount,
      status: batch.status,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
    };
  }
}
