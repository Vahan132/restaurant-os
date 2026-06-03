import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  ReservationRestaurantSettings,
  ReservationSettingsReader,
} from '../../application/ports/reservation-settings.reader';

/** Joins RestaurantSettings flags + restaurant timezone for the reservations module. */
@Injectable()
export class PrismaReservationSettingsReader implements ReservationSettingsReader {
  constructor(private readonly prisma: PrismaService) {}

  async get(restaurantId: string): Promise<ReservationRestaurantSettings> {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId },
      select: { timezone: true },
    });
    const settings = await this.prisma.restaurantSettings.findUnique({
      where: { restaurantId },
      select: { enableReservations: true, allowManualTableStatus: true },
    });
    return {
      enableReservations: settings?.enableReservations ?? false,
      allowManualTableStatus: settings?.allowManualTableStatus ?? false,
      timezone: restaurant?.timezone ?? 'UTC',
    };
  }
}
