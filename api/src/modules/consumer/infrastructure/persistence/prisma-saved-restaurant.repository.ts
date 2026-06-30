import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  SavedRestaurantRecord,
  SavedRestaurantRepository,
} from '../../domain/repositories/saved-restaurant.repository';

@Injectable()
export class PrismaSavedRestaurantRepository implements SavedRestaurantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(customerAccountId: string, branchId: string): Promise<void> {
    // Idempotent: the unique (customerAccountId, branchId) makes a repeat save a
    // no-op update. Keeps the original createdAt.
    await this.prisma.savedRestaurant.upsert({
      where: { customerAccountId_branchId: { customerAccountId, branchId } },
      update: {},
      create: { customerAccountId, branchId },
    });
  }

  async remove(customerAccountId: string, branchId: string): Promise<void> {
    await this.prisma.savedRestaurant.deleteMany({ where: { customerAccountId, branchId } });
  }

  async listByConsumer(customerAccountId: string): Promise<SavedRestaurantRecord[]> {
    const rows = await this.prisma.savedRestaurant.findMany({
      where: { customerAccountId },
      orderBy: { createdAt: 'desc' },
      select: { branchId: true, createdAt: true },
    });
    return rows.map((r) => ({ branchId: r.branchId, createdAt: r.createdAt }));
  }
}
