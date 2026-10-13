import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  normalizePagination,
  paginate,
  Paginated,
  toSkipTake,
} from '../../../../shared/application/pagination';
import {
  BRANCH_PUBLIC_REPOSITORY,
  BranchPublicRepository,
} from '../../domain/repositories/branch-public.repository';
import { ConsumerBranchCardResponse } from '../dto/responses';

export interface ListConsumerBranchesInput {
  q?: string;
  attributeValueIds?: string[];
  page?: number;
  limit?: number;
}

/**
 * ListConsumerBranches — effective-listed branch cards only. Search + attribute
 * filtering + pagination happen at the query level (see the repository). Anonymous.
 */
@Injectable()
export class ListConsumerBranchesUseCase
  implements UseCase<ListConsumerBranchesInput, Paginated<ConsumerBranchCardResponse>>
{
  constructor(
    @Inject(BRANCH_PUBLIC_REPOSITORY)
    private readonly branches: BranchPublicRepository,
  ) {}

  async execute(input: ListConsumerBranchesInput): Promise<Paginated<ConsumerBranchCardResponse>> {
    const pagination = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(pagination);

    const q = input.q?.trim() || undefined;
    const attributeValueIds = dedupe(input.attributeValueIds);

    const { items, total } = await this.branches.listConsumerBranches({
      q,
      attributeValueIds,
      skip,
      take,
    });

    const cards: ConsumerBranchCardResponse[] = items.map((b) => ({
      branchId: b.branchId,
      restaurantId: b.restaurantId,
      name: b.name,
      logoUrl: b.logoUrl,
      heroPhotoUrl: b.heroPhotoUrl,
      address: b.address,
      city: b.city,
      menuPublic: b.menuPublic,
      reservationsPublic: b.reservationsPublic,
      attributes: b.attributes,
    }));

    return paginate(cards, total, pagination);
  }
}

function dedupe(ids?: string[]): string[] | undefined {
  if (!ids || ids.length === 0) {
    return undefined;
  }
  const set = new Set(ids.map((s) => s.trim()).filter((s) => s.length > 0));
  return set.size > 0 ? [...set] : undefined;
}
