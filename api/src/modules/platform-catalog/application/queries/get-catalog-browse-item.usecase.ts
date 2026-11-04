import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  CATALOG_BROWSE_READER,
  CatalogBrowseReader,
  CatalogBrowseView,
} from '../../domain/repositories/catalog-browse.reader';
import { CatalogItemNotFound } from '../catalog.errors';

export interface GetCatalogBrowseItemInput {
  catalogItemId: string;
}

/**
 * Tenant-facing single-item read (any status — the tenant sees archived items too,
 * so the UI can explain why an item can't be adopted). Read-only (ADR §4).
 */
@Injectable()
export class GetCatalogBrowseItemUseCase
  implements UseCase<GetCatalogBrowseItemInput, CatalogBrowseView>
{
  constructor(
    @Inject(CATALOG_BROWSE_READER) private readonly reader: CatalogBrowseReader,
  ) {}

  async execute(input: GetCatalogBrowseItemInput): Promise<CatalogBrowseView> {
    const item = await this.reader.findById(input.catalogItemId);
    if (item === null) {
      throw CatalogItemNotFound();
    }
    return item;
  }
}
