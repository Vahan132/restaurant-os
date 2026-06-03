import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  OrderRestaurantSettings,
  OrderSettingsReader,
} from '../../application/ports/order-settings.reader';

/** Joins restaurant currency + RestaurantSettings flags for the orders module. */
@Injectable()
export class PrismaOrderSettingsReader implements OrderSettingsReader {
  constructor(private readonly prisma: PrismaService) {}

  async get(restaurantId: string): Promise<OrderRestaurantSettings> {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId },
      select: { currency: true },
    });
    const settings = await this.prisma.restaurantSettings.findUnique({
      where: { restaurantId },
      select: {
        serviceFeeRateBps: true,
        allowDiscounts: true,
        allowOrderCancellation: true,
        requireApprovalForDiscount: true,
        requireApprovalForCancellation: true,
        allowManualTableStatus: true,
      },
    });
    return {
      currency: restaurant?.currency ?? 'USD',
      serviceFeeRateBps: settings?.serviceFeeRateBps ?? 0,
      allowDiscounts: settings?.allowDiscounts ?? true,
      allowOrderCancellation: settings?.allowOrderCancellation ?? true,
      requireApprovalForDiscount: settings?.requireApprovalForDiscount ?? false,
      requireApprovalForCancellation: settings?.requireApprovalForCancellation ?? false,
      allowManualTableStatus: settings?.allowManualTableStatus ?? false,
    };
  }
}
