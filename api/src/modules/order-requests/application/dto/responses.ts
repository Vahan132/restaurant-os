import { ApiProperty } from '@nestjs/swagger';
import { CustomerOrderRequest } from '../../domain/entities/customer-order-request';

const STATUSES = ['PENDING', 'CONFIRMED', 'REJECTED'];

export class OrderRequestModifierLine {
  @ApiProperty() name!: string;
  @ApiProperty() priceDelta!: number;
}
export class OrderRequestItemLine {
  @ApiProperty() name!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() unitPriceAmount!: number;
  @ApiProperty() lineTotalAmount!: number;
  @ApiProperty({ type: [OrderRequestModifierLine] }) modifiers!: OrderRequestModifierLine[];
}

function itemLines(r: CustomerOrderRequest): OrderRequestItemLine[] {
  return r.items.map((i) => ({
    name: i.nameSnapshot,
    quantity: i.quantity,
    unitPriceAmount: i.unitPriceAmount,
    lineTotalAmount: i.lineTotalAmount,
    modifiers: i.modifiers.map((m) => ({ name: m.nameSnapshot, priceDelta: m.priceDeltaAmount })),
  }));
}

/** Public-safe view (the id is the capability token). No other-request/order data. */
export class PublicOrderRequestResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: STATUSES }) status!: string;
  @ApiProperty({ nullable: true, type: String }) rejectedReason!: string | null;
  @ApiProperty({ type: [OrderRequestItemLine] }) items!: OrderRequestItemLine[];

  static from(r: CustomerOrderRequest): PublicOrderRequestResponse {
    return { id: r.id, status: r.status, rejectedReason: r.rejectedReason, items: itemLines(r) };
  }
}

/** Staff view (adds table + customer + handling metadata). */
export class StaffOrderRequestResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: STATUSES }) status!: string;
  @ApiProperty() tableId!: string;
  @ApiProperty({ nullable: true, type: String }) tableName!: string | null;
  @ApiProperty({ nullable: true, type: String }) customerName!: string | null;
  @ApiProperty({ nullable: true, type: String }) note!: string | null;
  @ApiProperty({ nullable: true, type: String }) linkedOrderId!: string | null;
  @ApiProperty({ nullable: true, type: String }) rejectedReason!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ type: [OrderRequestItemLine] }) items!: OrderRequestItemLine[];

  static from(r: CustomerOrderRequest, tableName: string | null): StaffOrderRequestResponse {
    return {
      id: r.id,
      status: r.status,
      tableId: r.tableId,
      tableName,
      customerName: r.customerName,
      note: r.note,
      linkedOrderId: r.linkedOrderId,
      rejectedReason: r.rejectedReason,
      createdAt: r.createdAt.toISOString(),
      items: itemLines(r),
    };
  }
}
