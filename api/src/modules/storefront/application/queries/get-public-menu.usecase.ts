import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { PUBLIC_STOREFRONT_QUERY, PublicStorefrontQuery } from '../ports/public-query.port';
import { PublicMenuResponse } from '../dto/responses';

export interface GetPublicMenuInput {
  restaurantId: string;
  /**
   * BR-9: the resolved branch (from the URL slug or table token). When omitted
   * (restaurant-only entry, e.g. GET /public/menu), the restaurant's DEFAULT
   * branch is served as the landing menu.
   */
  branchId?: string | null;
}

/** Public menu tree (ACTIVE categories -> ACTIVE items + modifiers; availability flagged). */
@Injectable()
export class GetPublicMenuUseCase implements UseCase<GetPublicMenuInput, PublicMenuResponse> {
  constructor(@Inject(PUBLIC_STOREFRONT_QUERY) private readonly query: PublicStorefrontQuery) {}

  async execute(input: GetPublicMenuInput): Promise<PublicMenuResponse> {
    // ORDER-4: the menu carries its display currency (Restaurant.currency) so the
    // app/QR client can render prices; present in both return branches.
    const currency = await this.query.menuCurrency(input.restaurantId);
    const branchId = input.branchId ?? (await this.query.defaultBranchId(input.restaurantId));
    if (!branchId) {
      return { currency, categories: [] };
    }
    const categories = await this.query.menuTree(input.restaurantId, branchId);
    return { currency, categories };
  }
}
