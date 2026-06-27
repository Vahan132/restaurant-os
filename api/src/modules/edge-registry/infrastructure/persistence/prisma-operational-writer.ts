import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  GoodsReceiptPayload,
  OrderPayload,
  ProcessRunPayload,
  PushEntry,
  PushResult,
  ReservationPayload,
  StockLayerPayload,
  StockMovementPayload,
  WriteOffPayload,
} from '../../../../shared/edge/contracts/operational.contract';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { OperationalWriter } from '../../application/ports/operational-writer';
import { CrossBranchEntry } from '../../application/edge-registry.errors';

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

  async apply(branchId: string, entries: PushEntry[]): Promise<PushResult> {
    const ordered = [...entries].sort((a, b) => a.edgeSeq - b.edgeSeq);
    const appliedIds: string[] = [];
    let lastAppliedSeq: number | null = null;

    await this.prisma.$transaction(
      async (tx) => {
        for (const entry of ordered) {
          await this.applyEntry(tx, branchId, entry);
          appliedIds.push(entry.id);
          lastAppliedSeq = entry.edgeSeq;
        }
      },
      { timeout: 120_000, maxWait: 15_000 },
    );

    return { appliedIds, lastAppliedSeq };
  }

  private async applyEntry(
    tx: Prisma.TransactionClient,
    branchId: string,
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
      default: {
        const _exhaustive: never = entry.aggregateType;
        return _exhaustive;
      }
    }
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
}
