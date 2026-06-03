import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { PUBLIC_STOREFRONT_QUERY, PublicStorefrontQuery } from '../ports/public-query.port';
import { PublicRestaurantResponse } from '../dto/responses';

const SUPPORTED_LANGUAGES = ['hy', 'ru', 'en'];

export interface GetPublicRestaurantInput {
  restaurantId: string;
}

/** Public-safe restaurant info for the resolved restaurant. */
@Injectable()
export class GetPublicRestaurantUseCase implements UseCase<
  GetPublicRestaurantInput,
  PublicRestaurantResponse
> {
  constructor(@Inject(PUBLIC_STOREFRONT_QUERY) private readonly query: PublicStorefrontQuery) {}

  async execute(input: GetPublicRestaurantInput): Promise<PublicRestaurantResponse> {
    const info = await this.query.restaurantInfo(input.restaurantId);
    if (!info) {
      throw new NotFoundException({
        code: 'RESTAURANT_NOT_AVAILABLE',
        message: 'No public menu is available for this address.',
      });
    }
    return { ...info, supportedLanguages: SUPPORTED_LANGUAGES };
  }
}
