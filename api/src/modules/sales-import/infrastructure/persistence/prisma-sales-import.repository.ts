import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { ImportBatch } from '../../domain/entities/import-batch';
import { ImportedSale } from '../../domain/entities/imported-sale';
import {
  BranchScope,
  ListBatchesArgs,
  SalesImportRepository,
} from '../../domain/repositories/sales-import.repository';
import { ImportBatchMapper } from './import-batch.mapper';
import { ImportedSaleMapper } from './imported-sale.mapper';

@Injectable()
export class PrismaSalesImportRepository implements SalesImportRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Branch-scope predicate for ImportBatch reads. All-branch callers match every
   * row; branch-explicit callers match only batches whose single resolved branch
   * is in their set (multi-branch batches — branchId null — are NOT shown to a
   * branch-explicit caller, preserving isolation). An empty set matches nothing.
   */
  private batchScopeWhere(scope: BranchScope): Prisma.ImportBatchWhereInput {
    if (scope.all) return {};
    return { branchId: { in: scope.branchIds } };
  }

  async persistImport(batch: ImportBatch, sales: ImportedSale[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.importBatch.create({ data: ImportBatchMapper.toCreate(batch) });
      if (sales.length > 0) {
        await tx.importedSale.createMany({
          data: sales.map((s) => ImportedSaleMapper.toCreate(s)),
        });
      }
    });
  }

  async findExistingExternalReferences(
    restaurantId: string,
    references: string[],
  ): Promise<Set<string>> {
    if (references.length === 0) return new Set();
    const unique = [...new Set(references)];
    const rows = await this.prisma.importedSale.findMany({
      where: { restaurantId, externalReference: { in: unique } },
      select: { externalReference: true },
    });
    return new Set(rows.map((r) => r.externalReference).filter((r): r is string => r !== null));
  }

  async listBatches(args: ListBatchesArgs): Promise<{ rows: ImportBatch[]; total: number }> {
    const where: Prisma.ImportBatchWhereInput = {
      restaurantId: args.restaurantId,
      ...this.batchScopeWhere(args.scope),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.importBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: args.skip,
        take: args.take,
      }),
      this.prisma.importBatch.count({ where }),
    ]);
    return { rows: records.map(ImportBatchMapper.toDomain), total };
  }

  async findBatchById(
    restaurantId: string,
    id: string,
    scope: BranchScope,
  ): Promise<ImportBatch | null> {
    const record = await this.prisma.importBatch.findFirst({
      where: { id, restaurantId, ...this.batchScopeWhere(scope) },
    });
    return record ? ImportBatchMapper.toDomain(record) : null;
  }
}
