import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AuditLogPayload,
  GoodsReceiptPayload,
  OrderPayload,
  ProcessRunPayload,
  PushEntry,
  PushResult,
  ReservationPayload,
  StaffPinAuthPayload,
  StockLayerPayload,
  StockMovementPayload,
  WriteOffPayload,
} from '../../../../shared/edge/contracts/operational.contract';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { OperationalWriter } from '../../application/ports/operational-writer';
import { CrossBranchEntry } from '../../application/edge-registry.errors';

/** Later of two nullable dates (null = "no lock"); null only if both are null. */
function laterDate(a: Date | null, b: Date | null): Date | null {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  return a.getTime() >= b.getTime() ? a : b;
}

/** Cast a JSON payload row to a Prisma "unchecked" create input (scalar FKs ok). */
function asCreate<T>(row: unknown): T {
  return row as unknown as T;
}

/**
 * PrismaOperationalWriter — replays pushed operational entries to the cloud,
 * idempotently (upsert by id) and STRICTLY scoped to the node's branch. The whole
 * batch applies in one transaction in edgeSeq order; aggregates with children
 * (ORDER, GOODS_RECEIPT, WRITE_OFF) replace their children. Replaying stock
 * movements (immutable, +reversedAt) and stock layer states converges the cloud's
 * branch stock exactly to the edge.
 */
@Injectable()
export class PrismaOperationalWriter implements OperationalWriter {
  constructor(private readonly prisma: PrismaService) {}

  async apply(branchId: string, restaurantId: string, entries: PushEntry[]): Promise<PushResult> {
    const ordered = [...entries].sort((a, b) => a.edgeSeq - b.edgeSeq);
    const appliedIds: string[] = [];
    let lastAppliedSeq: number | null = null;

    await this.prisma.$transaction(
      async (tx) => {
        // 6C: collect the (item, location) pairs touched by replayed stock
        // movements so the cloud on-hand projection can be reconciled from the
        // (now converged) ledger after the batch applies.
        const touched = new Map<string, { itemId: string; locationId: string }>();
        for (const entry of ordered) {
          await this.applyEntry(tx, branchId, restaurantId, entry);
          if (entry.aggregateType === 'STOCK_MOVEMENT') {
            const p = entry.payload as StockMovementPayload;
            touched.set(`${p.itemId}|${p.locationId}`, {
              itemId: p.itemId,
              locationId: p.locationId,
            });
          }
          appliedIds.push(entry.id);
          lastAppliedSeq = entry.edgeSeq;
        }
        await this.reconcileOnHand(tx, branchId, restaurantId, [...touched.values()]);
      },
      { timeout: 120_000, maxWait: 15_000 },
    );

    return { appliedIds, lastAppliedSeq };
  }

  /**
   * 6C: rebuild the cloud StockOnHand projection for each touched (item, location)
   * from the converged ledger (Σ baseQty). Edge serves push STOCK_MOVEMENT +
   * STOCK_LAYER rows but not the projection; this keeps cloud on-hand correct
   * without a new sync channel. Idempotent (recompute-to-state).
   */
  private async reconcileOnHand(
    tx: Prisma.TransactionClient,
    branchId: string,
    restaurantId: string,
    pairs: Array<{ itemId: string; locationId: string }>,
  ): Promise<void> {
    for (const { itemId, locationId } of pairs) {
      const agg = await tx.stockMovement.aggregate({
        where: { restaurantId, branchId, itemId, locationId },
        _sum: { baseQty: true },
      });
      const quantity = agg._sum.baseQty ?? 0;
      await tx.stockOnHand.upsert({
        where: { itemId_locationId: { itemId, locationId } },
        create: {
          id: `ioh_${itemId}_${locationId}`,
          restaurantId,
          branchId,
          itemId,
          locationId,
          quantity,
        },
        update: { quantity },
      });
    }
  }

  private async applyEntry(
    tx: Prisma.TransactionClient,
    branchId: string,
    restaurantId: string,
    entry: PushEntry,
  ): Promise<void> {
    switch (entry.aggregateType) {
      case 'ORDER':
        return this.applyOrder(tx, branchId, entry.payload as OrderPayload);
      case 'RESERVATION': {
        const p = entry.payload as ReservationPayload;
        this.assertBranch(branchId, p.branchId);
        const data = asCreate<Prisma.ReservationUncheckedCreateInput>(p);
        await tx.reservation.upsert({ where: { id: p.id }, create: data, update: data });
        return;
      }
      case 'STOCK_LAYER': {
        const p = entry.payload as StockLayerPayload;
        this.assertBranch(branchId, p.branchId);
        const data = asCreate<Prisma.StockLayerUncheckedCreateInput>(p);
        await tx.stockLayer.upsert({ where: { id: p.id }, create: data, update: data });
        return;
      }
      case 'STOCK_MOVEMENT': {
        const p = entry.payload as StockMovementPayload;
        this.assertBranch(branchId, p.branchId);
        const data = asCreate<Prisma.StockMovementUncheckedCreateInput>(p);
        // Immutable except reversedAt — upsert-to-state keeps it idempotent.
        await tx.stockMovement.upsert({ where: { id: p.id }, create: data, update: data });
        return;
      }
      case 'PROCESS_RUN': {
        const p = entry.payload as ProcessRunPayload;
        this.assertBranch(branchId, p.branchId);
        const data = asCreate<Prisma.ProcessRunUncheckedCreateInput>(p);
        await tx.processRun.upsert({ where: { id: p.id }, create: data, update: data });
        return;
      }
      case 'GOODS_RECEIPT':
        return this.applyGoodsReceipt(tx, branchId, entry.payload as GoodsReceiptPayload);
      case 'WRITE_OFF':
        return this.applyWriteOff(tx, branchId, entry.payload as WriteOffPayload);
      case 'STAFF_PIN_AUTH':
        return this.applyStaffPinAuth(tx, restaurantId, entry.payload as StaffPinAuthPayload);
      case 'AUDIT_LOG':
        return this.applyAuditLog(tx, restaurantId, entry.payload as AuditLogPayload);
      default: {
        const _exhaustive: never = entry.aggregateType;
        return _exhaustive;
      }
    }
  }

  /**
   * 3B: reconcile offline PIN auth-state up. COUNTERS ONLY — never touches the
   * pinHash/status/mustRotate (config is cloud-authoritative and flows DOWN).
   * failedAttempts takes the MAX and lockedUntil the LATER of cloud vs edge, so a
   * reconnect can neither reset an active lockout nor double-count. Skips if the
   * row is absent on the cloud (the config row should already exist).
   */
  private async applyStaffPinAuth(
    tx: Prisma.TransactionClient,
    restaurantId: string,
    payload: StaffPinAuthPayload,
  ): Promise<void> {
    this.assertRestaurant(restaurantId, payload.restaurantId);
    const existing = await tx.staffPin.findUnique({ where: { id: payload.id } });
    if (!existing) {
      return;
    }
    const edgeLockedUntil = payload.lockedUntil ? new Date(payload.lockedUntil) : null;
    await tx.staffPin.update({
      where: { id: payload.id },
      data: {
        failedAttempts: Math.max(existing.failedAttempts, payload.failedAttempts),
        lockedUntil: laterDate(existing.lockedUntil, edgeLockedUntil),
      },
    });
  }

  /**
   * 4A: replay an edge-produced audit row to the cloud. Audit logs are immutable
   * and append-only, so an upsert-by-id is idempotent (a re-pushed entry is a
   * no-op). Scoped to the node's restaurant; a branchId may be null (org/
   * restaurant-level actions) so we assert RESTAURANT, not branch.
   */
  private async applyAuditLog(
    tx: Prisma.TransactionClient,
    restaurantId: string,
    payload: AuditLogPayload,
  ): Promise<void> {
    if (payload.restaurantId !== null) {
      this.assertRestaurant(restaurantId, payload.restaurantId);
    }
    // Nullable Json columns must use DbNull (not JS null) on write.
    const row = {
      ...payload,
      oldValue: payload.oldValue == null ? Prisma.DbNull : payload.oldValue,
      newValue: payload.newValue == null ? Prisma.DbNull : payload.newValue,
    };
    const data = asCreate<Prisma.AuditLogUncheckedCreateInput>(row);
    await tx.auditLog.upsert({ where: { id: payload.id }, create: data, update: data });
  }

  private async applyOrder(
    tx: Prisma.TransactionClient,
    branchId: string,
    payload: OrderPayload,
  ): Promise<void> {
    this.assertBranch(branchId, payload.branchId);
    const { items, payments, ...orderRow } = payload;
    const data = asCreate<Prisma.OrderUncheckedCreateInput>(orderRow);
    await tx.order.upsert({ where: { id: payload.id }, create: data, update: data });

    // Replace children (orderItem delete cascades its modifiers).
    await tx.orderItem.deleteMany({ where: { orderId: payload.id } });
    await tx.payment.deleteMany({ where: { orderId: payload.id } });
    for (const item of items) {
      const { modifiers, ...itemRow } = item;
      await tx.orderItem.create({ data: asCreate<Prisma.OrderItemUncheckedCreateInput>(itemRow) });
      for (const m of modifiers) {
        await tx.orderItemModifier.create({
          data: asCreate<Prisma.OrderItemModifierUncheckedCreateInput>(m),
        });
      }
    }
    for (const pay of payments) {
      await tx.payment.create({ data: asCreate<Prisma.PaymentUncheckedCreateInput>(pay) });
    }
  }

  private async applyGoodsReceipt(
    tx: Prisma.TransactionClient,
    branchId: string,
    payload: GoodsReceiptPayload,
  ): Promise<void> {
    this.assertBranch(branchId, payload.branchId);
    const { lines, ...header } = payload;
    const data = asCreate<Prisma.GoodsReceiptUncheckedCreateInput>(header);
    await tx.goodsReceipt.upsert({ where: { id: payload.id }, create: data, update: data });
    await tx.goodsReceiptLine.deleteMany({ where: { receiptId: payload.id } });
    for (const line of lines) {
      await tx.goodsReceiptLine.create({
        data: asCreate<Prisma.GoodsReceiptLineUncheckedCreateInput>(line),
      });
    }
  }

  private async applyWriteOff(
    tx: Prisma.TransactionClient,
    branchId: string,
    payload: WriteOffPayload,
  ): Promise<void> {
    this.assertBranch(branchId, payload.branchId);
    const { lines, ...header } = payload;
    const data = asCreate<Prisma.WriteOffUncheckedCreateInput>(header);
    await tx.writeOff.upsert({ where: { id: payload.id }, create: data, update: data });
    await tx.writeOffLine.deleteMany({ where: { writeOffId: payload.id } });
    for (const line of lines) {
      const row = {
        ...line,
        // modifierOptionIds is nullable Json — normalise null for Prisma.
        modifierOptionIds: line.modifierOptionIds == null ? Prisma.DbNull : line.modifierOptionIds,
      };
      await tx.writeOffLine.create({
        data: asCreate<Prisma.WriteOffLineUncheckedCreateInput>(row),
      });
    }
  }

  private assertBranch(branchId: string, payloadBranchId: unknown): void {
    if (payloadBranchId !== branchId) {
      throw CrossBranchEntry();
    }
  }

  private assertRestaurant(restaurantId: string, payloadRestaurantId: unknown): void {
    if (payloadRestaurantId !== restaurantId) {
      throw CrossBranchEntry();
    }
  }
}
