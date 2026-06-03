import { Injectable } from '@nestjs/common';
import { RestaurantSettings as PrismaSettings } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { OpeningHour, RestaurantSettings } from '../../domain/entities/restaurant-settings';
import { RestaurantSettingsRepository } from '../../domain/repositories/restaurant-settings.repository';

@Injectable()
export class PrismaRestaurantSettingsRepository implements RestaurantSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByRestaurantId(restaurantId: string): Promise<RestaurantSettings | null> {
    const r = await this.prisma.restaurantSettings.findUnique({ where: { restaurantId } });
    return r ? this.toDomain(r) : null;
  }

  async update(settings: RestaurantSettings): Promise<void> {
    const p = settings.snapshot;
    await this.prisma.restaurantSettings.update({
      where: { restaurantId: p.restaurantId },
      data: {
        logoUrl: p.logoUrl,
        phone: p.phone,
        address: p.address,
        taxRateBps: p.taxRateBps,
        serviceFeeRateBps: p.serviceFeeRateBps,
        receiptFooter: p.receiptFooter,
        openingHours: p.openingHours === null ? undefined : (p.openingHours as unknown as object),
        allowDiscounts: p.allowDiscounts,
        allowOrderCancellation: p.allowOrderCancellation,
        requireApprovalForCancellation: p.requireApprovalForCancellation,
        requireApprovalForDiscount: p.requireApprovalForDiscount,
        enableReservations: p.enableReservations,
        enableKds: p.enableKds,
        allowManualTableStatus: p.allowManualTableStatus,
        enableQrMenu: p.enableQrMenu,
        enableCustomerOrdering: p.enableCustomerOrdering,
        updatedAt: p.updatedAt,
      },
    });
  }

  private toDomain(r: PrismaSettings): RestaurantSettings {
    return RestaurantSettings.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      logoUrl: r.logoUrl,
      phone: r.phone,
      address: r.address,
      taxRateBps: r.taxRateBps,
      serviceFeeRateBps: r.serviceFeeRateBps,
      receiptFooter: r.receiptFooter,
      openingHours: (r.openingHours as unknown as OpeningHour[] | null) ?? null,
      allowDiscounts: r.allowDiscounts,
      allowOrderCancellation: r.allowOrderCancellation,
      requireApprovalForCancellation: r.requireApprovalForCancellation,
      requireApprovalForDiscount: r.requireApprovalForDiscount,
      enableReservations: r.enableReservations,
      enableKds: r.enableKds,
      allowManualTableStatus: r.allowManualTableStatus,
      enableQrMenu: r.enableQrMenu,
      enableCustomerOrdering: r.enableCustomerOrdering,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }
}
