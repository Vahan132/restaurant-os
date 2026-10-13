import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  ReservationPublicInfo,
  ReservationPublicInfoReader,
} from '../../application/ports/reservation-public-info.reader';

/** Joins Restaurant (name + timezone) with RestaurantSettings (toggle + hours). */
@Injectable()
export class PrismaReservationPublicInfoReader implements ReservationPublicInfoReader {
  constructor(private readonly prisma: PrismaService) {}

  async get(restaurantId: string, branchId: string): Promise<ReservationPublicInfo> {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId },
      select: { name: true, timezone: true },
    });
    const settings = await this.prisma.restaurantSettings.findUnique({
      where: { restaurantId },
      select: { enableReservations: true, openingHours: true },
    });
    // BR-9: branch resolved upstream from the URL slug; surface its name.
    // (enableReservations stays a restaurant-level setting for now.)
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, restaurantId },
      select: { name: true },
    });
    return {
      enableReservations: settings?.enableReservations ?? false,
      restaurantName: restaurant?.name ?? '',
      branchName: branch?.name ?? '',
      timezone: restaurant?.timezone ?? 'UTC',
      businessHours: settings?.openingHours ?? null,
    };
  }
}
