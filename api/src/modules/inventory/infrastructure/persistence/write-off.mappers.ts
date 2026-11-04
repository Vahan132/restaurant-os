import { WriteOff as PrismaWriteOff, WriteOffLine as PrismaWriteOffLine } from '@prisma/client';
import { WriteOff, WriteOffLine } from '../../domain/entities/write-off';
import { WriteOffLineKind, WriteOffReason } from '../../domain/enums';

type WriteOffRow = PrismaWriteOff & { lines: PrismaWriteOffLine[] };

export class WriteOffMapper {
  static toDomain(r: WriteOffRow): WriteOff {
    return WriteOff.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      reason: r.reason as WriteOffReason,
      note: r.note,
      occurredAt: r.occurredAt,
      createdByUserId: r.createdByUserId,
      voidedAt: r.voidedAt,
      voidedByUserId: r.voidedByUserId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      lines: r.lines.map(
        (l) =>
          new WriteOffLine({
            id: l.id,
            branchId: l.branchId,
            kind: l.kind as WriteOffLineKind,
            itemId: l.itemId,
            menuItemId: l.menuItemId,
            enteredUnit: l.enteredUnit,
            enteredQty: l.enteredQty,
            baseQty: l.baseQty,
            units: l.units,
            modifierOptionIds: Array.isArray(l.modifierOptionIds)
              ? (l.modifierOptionIds as unknown as string[])
              : null,
            costAmount: l.costAmount,
          }),
      ),
    });
  }

  static toHeaderCreate(w: WriteOff) {
    return {
      id: w.id,
      restaurantId: w.restaurantId,
      branchId: w.branchId,
      reason: w.reason as WriteOffReason,
      note: w.note,
      occurredAt: w.occurredAt,
      createdByUserId: w.createdByUserId,
      voidedAt: w.voidedAt,
      voidedByUserId: w.voidedByUserId,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    };
  }

  static toLineRows(w: WriteOff) {
    return w.lines.map((l) => ({
      id: l.id,
      writeOffId: w.id,
      branchId: l.branchId,
      kind: l.kind as WriteOffLineKind,
      itemId: l.itemId,
      menuItemId: l.menuItemId,
      enteredUnit: l.enteredUnit,
      enteredQty: l.enteredQty,
      baseQty: l.baseQty,
      units: l.units,
      modifierOptionIds: l.modifierOptionIds ?? undefined,
      costAmount: l.costAmount,
    }));
  }

  static toVoidUpdate(w: WriteOff) {
    return { voidedAt: w.voidedAt, voidedByUserId: w.voidedByUserId, updatedAt: w.updatedAt };
  }
}
