import { ApiProperty } from '@nestjs/swagger';
import { Floor } from '../../domain/entities/floor';
import { RestaurantTable } from '../../domain/entities/restaurant-table';

export class FloorResponse {
  @ApiProperty() id!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty() displayOrder!: number;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] }) status!: string;

  static from(f: Floor): FloorResponse {
    return {
      id: f.id,
      restaurantId: f.restaurantId,
      name: f.name,
      description: f.description,
      displayOrder: f.displayOrder,
      status: f.status,
    };
  }
}

export class TableResponse {
  @ApiProperty() id!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty() floorId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() seatCapacity!: number;
  @ApiProperty({ enum: ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'DISABLED'] })
  status!: string;
  @ApiProperty({ nullable: true, type: String }) qrIdentifier!: string | null;

  static from(t: RestaurantTable): TableResponse {
    return {
      id: t.id,
      restaurantId: t.restaurantId,
      floorId: t.floorId,
      name: t.name,
      seatCapacity: t.seatCapacity,
      status: t.status,
      qrIdentifier: t.qrIdentifier,
    };
  }
}
