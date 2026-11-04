import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { PUBLIC_STOREFRONT_QUERY, PublicStorefrontQuery } from '../ports/public-query.port';
import { PublicBranchResponse } from '../dto/responses';

export interface ListPublicBranchesInput {
  restaurantId: string;
}

/**
 * BR-9: the restaurant's ACTIVE branches for a public location picker
 * (reservation page / "choose location" landing). Public-safe: id, name, slug only.
 */
@Injectable()
export class ListPublicBranchesUseCase implements UseCase<
  ListPublicBranchesInput,
  PublicBranchResponse[]
> {
  constructor(@Inject(PUBLIC_STOREFRONT_QUERY) private readonly query: PublicStorefrontQuery) {}

  async execute(input: ListPublicBranchesInput): Promise<PublicBranchResponse[]> {
    const branches = await this.query.activeBranches(input.restaurantId);
    return branches.map((b) => ({ id: b.id, name: b.name, slug: b.slug }));
  }
}
