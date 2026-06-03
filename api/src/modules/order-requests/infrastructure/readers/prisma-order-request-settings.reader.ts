import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  OrderRequestSettings,
  OrderRequestSettingsReader,
} from '../../application/ports/order-request-settings.reader';

@Injectable()
export class PrismaOrderRequestSettingsReader implements OrderRequestSettingsReader {
  constructor(private readonly prisma: PrismaService) {}

  async get(restaurantId: string): Promise<OrderRequestSettings> {
    const s = await this.prisma.restaurantSettings.findUnique({
      where: { restaurantId },
      select: { enableQrMenu: true, enableCustomerOrdering: true },
    });
    return {
      enableQrMenu: s?.enableQrMenu ?? false,
      enableCustomerOrdering: s?.enableCustomerOrdering ?? false,
    };
  }
}
