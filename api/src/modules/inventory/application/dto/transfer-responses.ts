import { ApiProperty } from '@nestjs/swagger';
import { InventoryTransfer } from '../../domain/entities/inventory-transfer';
import { CreateTransferResult } from '../commands/create-transfer.usecase';

export class TransferSliceResponse {
  @ApiProperty({ nullable: true, type: String }) sourceLayerId!: string | null;
  @ApiProperty() destinationLayerId!: string;
  @ApiProperty() baseQty!: number;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  @ApiProperty() cost_amount!: number;
  @ApiProperty({ description: 'Carrying unit cost (MICRO precision, BigInt as string).' })
  unitCostMicro!: string;
}

/** Result of creating a transfer (slices + resulting on-hand at both locations). */
export class CreateTransferResponse {
  @ApiProperty() transferId!: string;
  @ApiProperty() itemId!: string;
  @ApiProperty() fromLocationId!: string;
  @ApiProperty() toLocationId!: string;
  @ApiProperty() baseQty!: number;
  @ApiProperty() occurredAt!: string;
  @ApiProperty() fromOnHandAfter!: number;
  @ApiProperty() toOnHandAfter!: number;
  @ApiProperty({ type: [TransferSliceResponse] }) slices!: TransferSliceResponse[];

  static from(r: CreateTransferResult): CreateTransferResponse {
    return {
      transferId: r.transferId,
      itemId: r.itemId,
      fromLocationId: r.fromLocationId,
      toLocationId: r.toLocationId,
      baseQty: r.baseQty,
      occurredAt: r.occurredAt.toISOString(),
      fromOnHandAfter: r.fromOnHandAfter,
      toOnHandAfter: r.toOnHandAfter,
      slices: r.slices.map((s) => ({
        sourceLayerId: s.sourceLayerId,
        destinationLayerId: s.destinationLayerId,
        baseQty: s.baseQty,
        cost_amount: s.costAmount,
        unitCostMicro: s.unitCostMicro.toString(),
      })),
    };
  }
}

/** A transfer header (list rows omit slices; the detail view includes them). */
export class TransferResponse {
  @ApiProperty() id!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty() itemId!: string;
  @ApiProperty() fromLocationId!: string;
  @ApiProperty() toLocationId!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() performedByUserId!: string;
  @ApiProperty() occurredAt!: string;
  @ApiProperty({ type: [TransferSliceResponse] }) slices!: TransferSliceResponse[];

  static from(t: InventoryTransfer): TransferResponse {
    return {
      id: t.id,
      restaurantId: t.restaurantId,
      branchId: t.branchId,
      itemId: t.itemId,
      fromLocationId: t.fromLocationId,
      toLocationId: t.toLocationId,
      quantity: t.quantity,
      performedByUserId: t.performedByUserId,
      occurredAt: t.occurredAt.toISOString(),
      slices: t.slices.map((s) => ({
        sourceLayerId: s.sourceLayerId,
        destinationLayerId: s.destinationLayerId,
        baseQty: s.baseQty,
        cost_amount: s.costAmount,
        unitCostMicro: s.unitCostMicro.toString(),
      })),
    };
  }
}
