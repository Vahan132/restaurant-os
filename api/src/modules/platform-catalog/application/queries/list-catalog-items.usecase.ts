import { Inject, Injectable } from '@nestjs/common';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { UseCase } from '../../../../shared/application/use-case';
import { CatalogItem, CatalogItemStatus } from '../../domain/entities/catalog-item';
import {
  CATALOG_ITEM_REPOSITORY,
  CatalogItemRepository,
} from '../../domain/repositories/catalog-item.repository';

export interface ListCatalogItemsInput {
  page?: number;
  limit?: number;
  q?: string;
  categoryId?: string;
  includeArchived?: boolean;
  reviewed?: 'all' | 'reviewed' | 'unreviewed';
}

/**
 * Paginated catalog listing. Active-only by default; archived items are hidden
 * unless includeArchived (curation still touches CatalogItem only — ADR §4).
 */
@Injectable()
export class ListCatalogItemsUseCase
  implements UseCase<ListCatalogItemsInput, Paginated<CatalogItem>>
{
  constructor(
    @Inject(CATALOG_ITEM_REPOSITORY) private readonly repo: CatalogItemRepository,
  ) {}

  async execute(input: ListCatalogItemsInput): Promise<Paginated<CatalogItem>> {
    const query = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(query);
    const { items, total } = await this.repo.list({
      skip,
      take,
      search: input.q,
      categoryId: input.categoryId,
      status: input.includeArchived ? undefined : CatalogItemStatus.ACTIVE,
      reviewed:
        input.reviewed === 'reviewed'
          ? true
          : input.reviewed === 'unreviewed'
            ? false
            : undefined,
    });
    return paginate(items, total, query);
  }
}
