import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { CatalogItem } from '../../domain/entities/catalog-item';
import {
  CATALOG_ITEM_REPOSITORY,
  CatalogItemRepository,
} from '../../domain/repositories/catalog-item.repository';
import { CatalogItemNotFound } from '../catalog.errors';

export interface GetCatalogItemInput {
  catalogItemId: string;
}

/** Fetch one CatalogItem (any status). */
@Injectable()
export class GetCatalogItemUseCase implements UseCase<GetCatalogItemInput, CatalogItem> {
  constructor(
    @Inject(CATALOG_ITEM_REPOSITORY) private readonly repo: CatalogItemRepository,
  ) {}

  async execute(input: GetCatalogItemInput): Promise<CatalogItem> {
    const item = await this.repo.findById(input.catalogItemId);
    if (item === null) {
      throw CatalogItemNotFound();
    }
    return item;
  }
}
