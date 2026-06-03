import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { Restaurant, RestaurantStatus } from '../../domain/entities/restaurant';
import { RestaurantRepository } from '../../domain/repositories/restaurant.repository';

@Injectable()
export class PrismaRestaurantRepository implements RestaurantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdInOrg(organizationId: string, restaurantId: string): Promise<Restaurant | null> {
    const r = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, organizationId, deletedAt: null },
    });
    if (!r) {
      return null;
    }
    return Restaurant.reconstitute(r.id, {
      organizationId: r.organizationId,
      name: r.name,
      slug: r.slug,
      currency: r.currency,
      defaultLanguage: r.defaultLanguage,
      timezone: r.timezone,
      status: r.status as RestaurantStatus,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }

  async update(restaurant: Restaurant): Promise<void> {
    // org in the filter guarantees tenant isolation on writes.
    await this.prisma.restaurant.updateMany({
      where: { id: restaurant.id, organizationId: restaurant.organizationId },
      data: {
        name: restaurant.name,
        currency: restaurant.currency,
        defaultLanguage: restaurant.defaultLanguage,
        timezone: restaurant.timezone,
        status: restaurant.status as RestaurantStatus,
        updatedAt: restaurant.updatedAt,
      },
    });
  }
}
