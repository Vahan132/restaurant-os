import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Locale, resolveEffectiveLocale } from '../../../../shared/i18n/locale';
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
  /**
   * LOCALE-1: the guest's REQUESTED locale (validated `X-Locale`, via @GuestLocale),
   * or null when unset/invalid. The effective locale is computed here (requested ??
   * restaurant.defaultLanguage ?? 'en') so it is resolved once, where restaurantId
   * and the default are known.
   */
  requestedLocale?: Locale | null;
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
    // LOCALE-1: effective locale = guest request ?? restaurant default ?? 'en'.
    const defaultLanguage = await this.query.defaultLanguage(input.restaurantId);
    const locale = resolveEffectiveLocale(input.requestedLocale ?? null, defaultLanguage);
    const categories = await this.query.menuTree(input.restaurantId, branchId, locale);
    return { currency, categories };
  }
}
