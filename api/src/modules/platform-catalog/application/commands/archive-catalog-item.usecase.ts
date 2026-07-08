import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { CatalogItem } from '../../domain/entities/catalog-item';
import {
  CATALOG_ITEM_REPOSITORY,
  CatalogItemRepository,
} from '../../domain/repositories/catalog-item.repository';
import { CatalogItemNotFound } from '../catalog.errors';

export interface ArchiveCatalogItemInput {
  catalogItemId: string;
}

/**
 * Archive (soft-delete) a CatalogItem. Never a hard delete — tenant catalogItemId
 * references must keep resolving (ADR §2/§4). Idempotent.
 */
@Injectable()
export class ArchiveCatalogItemUseCase implements UseCase<ArchiveCatalogItemInput, CatalogItem> {
  constructor(
    @Inject(CATALOG_ITEM_REPOSITORY) private readonly repo: CatalogItemRepository,
  ) {}

  async execute(input: ArchiveCatalogItemInput): Promise<CatalogItem> {
    const item = await this.repo.findById(input.catalogItemId);
    if (item === null) {
      throw CatalogItemNotFound();
    }
    item.archive();
    await this.repo.update(item);
    return item;
  }
}
