import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { InventoryLocation } from '../../domain/entities/inventory-location';
import { InventoryLocationRepository } from '../../domain/repositories/inventory-location.repository';
import { InventoryLocationMapper } from './inventory.mappers';

@Injectable()
export class PrismaInventoryLocationRepository implements InventoryLocationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByBranch(restaurantId: string, branchId: string): Promise<InventoryLocation[]> {
    const rows = await this.prisma.inventoryLocation.findMany({
      where: { restaurantId, branchId, deletedAt: null },
      // Default (Main Storage) first, then alphabetical.
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    return rows.map(InventoryLocationMapper.toDomain);
  }

  async findById(
    restaurantId: string,
    branchId: string,
    id: string,
  ): Promise<InventoryLocation | null> {
    const r = await this.prisma.inventoryLocation.findFirst({
      where: { id, restaurantId, branchId, deletedAt: null },
    });
    return r ? InventoryLocationMapper.toDomain(r) : null;
  }

  async findDefaultId(restaurantId: string, branchId: string): Promise<string | null> {
    const r = await this.prisma.inventoryLocation.findFirst({
      where: { restaurantId, branchId, isDefault: true, deletedAt: null },
      select: { id: true },
    });
    return r?.id ?? null;
  }

  async existsActiveByName(
    restaurantId: string,
    branchId: string,
    name: string,
  ): Promise<boolean> {
    const r = await this.prisma.inventoryLocation.findFirst({
      where: {
        restaurantId,
        branchId,
        deletedAt: null,
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    return r !== null;
  }

  async create(location: InventoryLocation): Promise<void> {
    await this.prisma.inventoryLocation.create({
      data: InventoryLocationMapper.toCreate(location),
    });
  }

  async update(location: InventoryLocation): Promise<void> {
    await this.prisma.inventoryLocation.updateMany({
      where: { id: location.id, restaurantId: location.restaurantId },
      data: InventoryLocationMapper.toUpdate(location),
    });
  }
}
