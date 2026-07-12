import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { InventoryItem } from '../../domain/entities/inventory-item';
import {
  InventoryItemListFilter,
  InventoryItemRepository,
} from '../../domain/repositories/inventory-item.repository';
import { InventoryItemMapper } from './inventory.mappers';

@Injectable()
export class PrismaInventoryItemRepository implements InventoryItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: InventoryItemListFilter): Promise<InventoryItem[]> {
    const where: Prisma.InventoryItemWhereInput = {
      restaurantId: filter.restaurantId,
      branchId: filter.branchId,
      deletedAt: null,
      ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
      ...(filter.kind ? { kind: filter.kind } : {}),
      // INV-SEARCH-1: two-step search — local name OR an adopted item whose catalog name
      // matched (catalogItemId in the ids resolved by the use-case). No catalog match =>
      // just the local-name clause (correctly matches only custom items by that name).
      ...(filter.search
        ? {
            OR: [
              { name: { contains: filter.search, mode: 'insensitive' } },
              ...(filter.matchedCatalogItemIds && filter.matchedCatalogItemIds.length > 0
                ? [{ catalogItemId: { in: filter.matchedCatalogItemIds } }]
                : []),
            ],
          }
        : {}),
    };
    // No pagination / no DB `orderBy: name`: the use-case resolves effective names, sorts,
    // then slices (adopted rows carry a null local `name` that SQL can't order).
    const records = await this.prisma.inventoryItem.findMany({ where });
    return records.map(InventoryItemMapper.toDomain);
  }

  async findById(
    restaurantId: string,
    branchId: string,
    id: string,
  ): Promise<InventoryItem | null> {
    const r = await this.prisma.inventoryItem.findFirst({
      where: { id, restaurantId, branchId, deletedAt: null },
    });
    return r ? InventoryItemMapper.toDomain(r) : null;
  }

  async findInRestaurant(restaurantId: string, id: string): Promise<InventoryItem | null> {
    const r = await this.prisma.inventoryItem.findFirst({
      where: { id, restaurantId, deletedAt: null },
    });
    return r ? InventoryItemMapper.toDomain(r) : null;
  }

  async findManyByIds(
    restaurantId: string,
    branchId: string,
    ids: string[],
  ): Promise<InventoryItem[]> {
    if (ids.length === 0) {
      return [];
    }
    const records = await this.prisma.inventoryItem.findMany({
      where: { id: { in: ids }, restaurantId, branchId, deletedAt: null },
    });
    return records.map(InventoryItemMapper.toDomain);
  }

  async findByCatalogItemId(
    restaurantId: string,
    branchId: string,
    catalogItemId: string,
  ): Promise<InventoryItem | null> {
    const r = await this.prisma.inventoryItem.findFirst({
      where: { restaurantId, branchId, catalogItemId, deletedAt: null },
    });
    return r ? InventoryItemMapper.toDomain(r) : null;
  }

  async existsBySku(
    restaurantId: string,
    branchId: string,
    sku: string,
    excludeId?: string,
  ): Promise<boolean> {
    // No deletedAt filter: the unique index (restaurantId, branchId, sku) spans
    // soft-deleted rows, so a soft-deleted item still reserves its sku.
    const count = await this.prisma.inventoryItem.count({
      where: {
        restaurantId,
        branchId,
        sku,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    return count > 0;
  }

  async create(item: InventoryItem): Promise<void> {
    await this.prisma.inventoryItem.create({ data: InventoryItemMapper.toCreate(item) });
  }

  async update(item: InventoryItem): Promise<void> {
    await this.prisma.inventoryItem.updateMany({
      where: { id: item.id, restaurantId: item.restaurantId },
      data: InventoryItemMapper.toUpdate(item),
    });
  }
}
