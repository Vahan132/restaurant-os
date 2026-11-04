import { Injectable } from '@nestjs/common';
import { CatalogReport } from '../catalog-report';
import { CatalogSection } from '../catalog-bundle';
import { CatalogExportService } from './catalog-export.service';
import { CatalogImportService } from './catalog-import.service';

export interface CloneInput {
  /** Restaurant that owns the SOURCE branch (may differ from the target's). */
  sourceRestaurantId: string;
  sourceBranchId: string;
  /** Restaurant that owns the TARGET branch (the caller's active restaurant). */
  targetRestaurantId: string;
  targetBranchId: string;
  include?: CatalogSection[];
  mode: 'DRY_RUN' | 'APPLY';
  conflictStrategy?: 'SKIP' | 'OVERWRITE';
}

/**
 * In-app branch clone (BR-6 §E): export the source branch's catalog to an
 * in-memory bundle, then import it into the target branch via the SAME engine.
 * No file is produced. Cross-restaurant clone is supported (the source restaurant
 * id is supplied separately); access is validated by the controller.
 */
@Injectable()
export class CatalogCloneService {
  constructor(
    private readonly exportService: CatalogExportService,
    private readonly importService: CatalogImportService,
  ) {}

  async clone(input: CloneInput): Promise<CatalogReport> {
    const bundle = await this.exportService.export({
      restaurantId: input.sourceRestaurantId,
      branchId: input.sourceBranchId,
      include: input.include,
    });

    return this.importService.import({
      restaurantId: input.targetRestaurantId,
      targetBranchId: input.targetBranchId,
      bundle,
      mode: input.mode,
      conflictStrategy: input.conflictStrategy,
    });
  }
}
