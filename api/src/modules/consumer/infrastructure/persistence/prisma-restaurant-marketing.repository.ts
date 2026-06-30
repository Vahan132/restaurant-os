import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  AddPhotoInput,
  BrandSummary,
  I18nText,
  PhotoRecord,
  RestaurantMarketingRepository,
} from '../../domain/repositories/restaurant-marketing.repository';

/**
 * Restaurant marketing profile persistence (Prisma directly). `logo` lives on
 * RestaurantSettings; `about`/`website` on the Restaurant; gallery + attribute
 * selections in the consumer join/photo tables.
 */
@Injectable()
export class PrismaRestaurantMarketingRepository implements RestaurantMarketingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async loadBrandSummary(restaurantId: string): Promise<BrandSummary | null> {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        aboutHy: true,
        aboutRu: true,
        aboutEn: true,
        website: true,
        settings: { select: { logoUrl: true } },
      },
    });
    if (!restaurant) {
      return null;
    }
    const photoCount = await this.prisma.restaurantPhoto.count({ where: { restaurantId } });
    return {
      restaurantId: restaurant.id,
      name: restaurant.name,
      logoUrl: restaurant.settings?.logoUrl ?? null,
      about: { hy: restaurant.aboutHy, ru: restaurant.aboutRu, en: restaurant.aboutEn },
      website: restaurant.website,
      photoCount,
    };
  }

  async listSelectedAttributeValueIds(restaurantId: string): Promise<string[]> {
    const rows = await this.prisma.restaurantAttribute.findMany({
      where: { restaurantId },
      select: { attributeValueId: true },
    });
    return rows.map((r) => r.attributeValueId);
  }

  async loadConsumerListingSuppressed(restaurantId: string): Promise<boolean | null> {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, deletedAt: null },
      select: { consumerListingSuppressed: true },
    });
    return restaurant ? restaurant.consumerListingSuppressed : null;
  }

  async setConsumerListingSuppressed(restaurantId: string, value: boolean): Promise<void> {
    await this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { consumerListingSuppressed: value },
    });
  }

  async saveProfile(restaurantId: string, about: I18nText, website: string | null): Promise<void> {
    await this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        aboutHy: about.hy ?? null,
        aboutRu: about.ru ?? null,
        aboutEn: about.en ?? null,
        website,
      },
    });
  }

  async setAttributes(restaurantId: string, attributeValueIds: string[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.restaurantAttribute.deleteMany({ where: { restaurantId } }),
      this.prisma.restaurantAttribute.createMany({
        data: attributeValueIds.map((attributeValueId) => ({ restaurantId, attributeValueId })),
        skipDuplicates: true,
      }),
    ]);
  }

  async listPhotos(restaurantId: string): Promise<PhotoRecord[]> {
    const rows = await this.prisma.restaurantPhoto.findMany({
      where: { restaurantId },
      orderBy: { position: 'asc' },
    });
    return rows.map(toPhotoRecord);
  }

  async addPhoto(restaurantId: string, input: AddPhotoInput): Promise<string> {
    const agg = await this.prisma.restaurantPhoto.aggregate({
      where: { restaurantId },
      _max: { position: true },
    });
    const nextPosition = (agg._max.position ?? -1) + 1;
    const created = await this.prisma.restaurantPhoto.create({
      data: {
        restaurantId,
        position: nextPosition,
        url: input.url,
        altHy: input.alt.hy ?? null,
        altRu: input.alt.ru ?? null,
        altEn: input.alt.en ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
      },
      select: { id: true },
    });
    return created.id;
  }

  async reorderPhotos(restaurantId: string, orderedPhotoIds: string[]): Promise<void> {
    // Re-number scoped to this restaurant; ids not belonging to it match nothing.
    await this.prisma.$transaction(
      orderedPhotoIds.map((id, index) =>
        this.prisma.restaurantPhoto.updateMany({
          where: { id, restaurantId },
          data: { position: index },
        }),
      ),
    );
  }

  async removePhoto(restaurantId: string, photoId: string): Promise<void> {
    await this.prisma.restaurantPhoto.deleteMany({ where: { id: photoId, restaurantId } });
  }
}

function toPhotoRecord(p: {
  id: string;
  position: number;
  url: string;
  altHy: string | null;
  altRu: string | null;
  altEn: string | null;
  width: number | null;
  height: number | null;
}): PhotoRecord {
  return {
    id: p.id,
    position: p.position,
    url: p.url,
    alt: { hy: p.altHy, ru: p.altRu, en: p.altEn },
    width: p.width,
    height: p.height,
  };
}
