import { Inject, Injectable } from '@nestjs/common';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { UseCase } from '../../../../shared/application/use-case';
import {
  CATALOG_BROWSE_READER,
  CatalogBrowseReader,
  CatalogBrowseView,
} from '../../domain/repositories/catalog-browse.reader';

export interface BrowseCatalogItemsInput {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
}

/**
 * Tenant-facing paginated browse of the platform catalog. ACTIVE-only; search
 * matches slug + trilingual names. Read-only (ADR §4) — no tenant inventory access.
 */
@Injectable()
export class BrowseCatalogItemsUseCase
  implements UseCase<BrowseCatalogItemsInput, Paginated<CatalogBrowseView>>
{
  constructor(
    @Inject(CATALOG_BROWSE_READER) private readonly reader: CatalogBrowseReader,
  ) {}

  async execute(input: BrowseCatalogItemsInput): Promise<Paginated<CatalogBrowseView>> {
    const query = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(query);
    const { items, total } = await this.reader.listActive({
      skip,
      take,
      search: input.search,
      categoryId: input.categoryId,
    });
    return paginate(items, total, query);
  }
}
