import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  OBJECT_STORAGE_PORT,
  ObjectStoragePort,
} from '../../../media/application/ports/object-storage.port';
import {
  I18nText,
  RESTAURANT_MARKETING_REPOSITORY,
  RestaurantMarketingRepository,
} from '../../domain/repositories/restaurant-marketing.repository';
import { PhotoUrl } from '../../domain/value-objects/photo-url';

export interface AddRestaurantPhotoInput {
  restaurantId: string;
  /** URL-paste source (validated https). Ignored when objectKey is present. */
  url?: string;
  /** MEDIA-1: uploaded object key (finalize). When present, the stored url is the
   *  resolved public URL and objectKey is recorded as the durable reference. */
  objectKey?: string | null;
  alt?: I18nText;
  width?: number | null;
  height?: number | null;
}

/**
 * AddRestaurantPhoto — append a photo to the brand gallery. Either a validated
 * https URL (URL-paste, INVALID_PHOTO_URL) or an uploaded object key (MEDIA-1)
 * must be supplied. An uploaded key is resolved to its public URL and must sit
 * under the caller's tenant prefix (defence-in-depth).
 */
@Injectable()
export class AddRestaurantPhotoUseCase
  implements UseCase<AddRestaurantPhotoInput, { photoId: string }>
{
  constructor(
    @Inject(RESTAURANT_MARKETING_REPOSITORY)
    private readonly marketing: RestaurantMarketingRepository,
    @Inject(OBJECT_STORAGE_PORT)
    private readonly storage: ObjectStoragePort,
  ) {}

  async execute(input: AddRestaurantPhotoInput): Promise<{ photoId: string }> {
    let url: string;
    let objectKey: string | null = null;

    if (input.objectKey) {
      if (!input.objectKey.startsWith(`restaurants/${input.restaurantId}/`)) {
        throw new BadRequestException({
          code: 'OBJECT_KEY_OUTSIDE_TENANT',
          message: 'The object key does not belong to your restaurant.',
        });
      }
      objectKey = input.objectKey;
      url = this.storage.publicUrl(input.objectKey);
    } else {
      if (!input.url) {
        throw new BadRequestException({
          code: 'PHOTO_SOURCE_REQUIRED',
          message: 'Provide either an uploaded objectKey or a photo url.',
        });
      }
      url = PhotoUrl.create(input.url).value;
    }

    const photoId = await this.marketing.addPhoto(input.restaurantId, {
      url,
      objectKey,
      alt: input.alt ?? {},
      width: input.width ?? null,
      height: input.height ?? null,
    });
    return { photoId };
  }
}
