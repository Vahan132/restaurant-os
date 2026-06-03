import { Inject, Injectable } from '@nestjs/common';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { UseCase } from '../../../../shared/application/use-case';
import {
  ORGANIZATION_REPOSITORY,
  OrganizationListItem,
  OrganizationRepository,
} from '../../domain/repositories/organization.repository';

export interface ListOrganizationsInput {
  page?: number;
  limit?: number;
}

/** Paginated, platform-wide (cross-tenant) listing of organizations. */
@Injectable()
export class ListOrganizationsUseCase implements UseCase<
  ListOrganizationsInput,
  Paginated<OrganizationListItem>
> {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizations: OrganizationRepository,
  ) {}

  async execute(input: ListOrganizationsInput): Promise<Paginated<OrganizationListItem>> {
    const query = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(query);
    const { items, total } = await this.organizations.list(skip, take);
    return paginate(items, total, query);
  }
}
