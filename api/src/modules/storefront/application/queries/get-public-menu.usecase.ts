import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { PUBLIC_STOREFRONT_QUERY, PublicStorefrontQuery } from '../ports/public-query.port';
import { PublicMenuResponse } from '../dto/responses';

export interface GetPublicMenuInput {
  restaurantId: string;
}

/** Public menu tree (ACTIVE categories -> ACTIVE items + modifiers; availability flagged). */
@Injectable()
export class GetPublicMenuUseCase implements UseCase<GetPublicMenuInput, PublicMenuResponse> {
  constructor(@Inject(PUBLIC_STOREFRONT_QUERY) private readonly query: PublicStorefrontQuery) {}

  async execute(input: GetPublicMenuInput): Promise<PublicMenuResponse> {
    const categories = await this.query.menuTree(input.restaurantId);
    return { categories };
  }
}
