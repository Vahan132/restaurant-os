import { ApiProperty } from '@nestjs/swagger';
import { WriteOff, WriteOffLine } from '../../domain/entities/write-off';
import { WriteOffSummary } from '../ports/write-off-summary.reader';

export class WriteOffLineResponse {
  @ApiProperty() id!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty({ enum: ['ITEM', 'DISH'] }) kind!: string;
  @ApiProperty({ nullable: true, type: String }) itemId!: string | null;
  @ApiProperty({ nullable: true, type: String }) menuItemId!: string | null;
  @ApiProperty({ nullable: true, type: String }) enteredUnit!: string | null;
  @ApiProperty({ nullable: true, type: Number }) enteredQty!: number | null;
  @ApiProperty({ nullable: true, type: Number }) baseQty!: number | null;
  @ApiProperty({ nullable: true, type: Number }) units!: number | null;
  @ApiProperty({ nullable: true, type: [String] }) modifierOptionIds!: string[] | null;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  @ApiProperty() cost_amount!: number;

  static from(l: WriteOffLine): WriteOffLineResponse {
    return {
      id: l.id,
      branchId: l.branchId,
      kind: l.kind,
      itemId: l.itemId,
      menuItemId: l.menuItemId,
      enteredUnit: l.enteredUnit,
      enteredQty: l.enteredQty,
      baseQty: l.baseQty,
      units: l.units,
      modifierOptionIds: l.modifierOptionIds,
      cost_amount: l.costAmount,
    };
  }
}

export class WriteOffResponse {
  @ApiProperty() id!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty({ enum: ['STAFF_MEAL', 'SPOILAGE', 'WASTE', 'BREAKAGE', 'THEFT', 'OTHER'] })
  reason!: string;
  @ApiProperty({ nullable: true, type: String }) note!: string | null;
  @ApiProperty() occurredAt!: string;
  @ApiProperty() createdByUserId!: string;
  @ApiProperty({ nullable: true, type: String }) voidedAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) voidedByUserId!: string | null;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  @ApiProperty() totalCost_amount!: number;
  @ApiProperty({ type: [WriteOffLineResponse] }) lines!: WriteOffLineResponse[];

  static from(w: WriteOff): WriteOffResponse {
    return {
      id: w.id,
      restaurantId: w.restaurantId,
      branchId: w.branchId,
      reason: w.reason,
      note: w.note,
      occurredAt: w.occurredAt.toISOString(),
      createdByUserId: w.createdByUserId,
      voidedAt: w.voidedAt ? w.voidedAt.toISOString() : null,
      voidedByUserId: w.voidedByUserId,
      totalCost_amount: w.totalCostAmount,
      lines: w.lines.map(WriteOffLineResponse.from),
    };
  }
}

export class WriteOffSummaryRowResponse {
  @ApiProperty({ enum: ['STAFF_MEAL', 'SPOILAGE', 'WASTE', 'BREAKAGE', 'THEFT', 'OTHER'] })
  reason!: string;
  @ApiProperty() lineCount!: number;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  @ApiProperty() totalCost_amount!: number;
}

export class WriteOffSummaryResponse {
  @ApiProperty({ type: [WriteOffSummaryRowResponse] }) byReason!: WriteOffSummaryRowResponse[];
  @ApiProperty() overallLineCount!: number;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  @ApiProperty() overallTotalCost_amount!: number;

  static from(s: WriteOffSummary): WriteOffSummaryResponse {
    return {
      byReason: s.byReason.map((r) => ({
        reason: r.reason,
        lineCount: r.lineCount,
        totalCost_amount: r.totalCostAmount,
      })),
      overallLineCount: s.overallLineCount,
      overallTotalCost_amount: s.overallTotalCostAmount,
    };
  }
}
