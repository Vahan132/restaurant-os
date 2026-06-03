import { Floor as PrismaFloor, RestaurantTable as PrismaTable } from '@prisma/client';
import { Floor } from '../../domain/entities/floor';
import { RestaurantTable } from '../../domain/entities/restaurant-table';
import { TableStatus, ZoneStatus } from '../../domain/enums';

export class FloorMapper {
  static toDomain(r: PrismaFloor): Floor {
    return Floor.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      name: r.name,
      description: r.description,
      displayOrder: r.displayOrder,
      status: r.status as ZoneStatus,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
    });
  }

  static toCreate(f: Floor) {
    return {
      id: f.id,
      restaurantId: f.restaurantId,
      name: f.name,
      description: f.description,
      displayOrder: f.displayOrder,
      status: f.status as ZoneStatus,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      deletedAt: f.deletedAt,
    };
  }

  static toUpdate(f: Floor) {
    return {
      name: f.name,
      description: f.description,
      displayOrder: f.displayOrder,
      status: f.status as ZoneStatus,
      updatedAt: f.updatedAt,
      deletedAt: f.deletedAt,
    };
  }
}

export class TableMapper {
  static toDomain(r: PrismaTable): RestaurantTable {
    return RestaurantTable.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      floorId: r.floorId,
      name: r.name,
      seatCapacity: r.seatCapacity,
      status: r.status as TableStatus,
      qrIdentifier: r.qrIdentifier,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
    });
  }

  static toCreate(t: RestaurantTable) {
    return {
      id: t.id,
      restaurantId: t.restaurantId,
      floorId: t.floorId,
      name: t.name,
      seatCapacity: t.seatCapacity,
      status: t.status as TableStatus,
      qrIdentifier: t.qrIdentifier,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      deletedAt: t.deletedAt,
    };
  }

  static toUpdate(t: RestaurantTable) {
    return {
      floorId: t.floorId,
      name: t.name,
      seatCapacity: t.seatCapacity,
      status: t.status as TableStatus,
      qrIdentifier: t.qrIdentifier,
      updatedAt: t.updatedAt,
      deletedAt: t.deletedAt,
    };
  }
}
