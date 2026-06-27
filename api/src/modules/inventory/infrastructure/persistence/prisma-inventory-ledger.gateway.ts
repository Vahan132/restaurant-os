import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OutboxRecord } from '../../../../shared/edge/contracts/operational.contract';
import { OUTBOX_RECORDER, OutboxRecorder } from '../../../../shared/edge/outbox-recorder';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import {
  OUT_MOVEMENT_TYPES,
  PROCESS_RUN_REF_TYPE,
  StockLayerStatus,
  StockMovementType,
} from '../../domain/enums';
import { StockConsumptionResult } from '../../domain/ports/stock-consumption.port';
import {
  GatewayConsumeInput,
  InventoryLedgerGateway,
  NewLayerSpec,
  NewMovementSpec,
  RecordInboundInput,
  RecordReceiptInput,
  ReverseLedgerInput,
  RunProcessAllocation,
  RunProcessInput,
  RunProcessResult,
} from '../../domain/repositories/inventory-ledger.gateway';
import { allocateCost } from '../../domain/services/cost-allocation';
import { OpenLayerSnapshot, planConsumption } from '../../domain/services/consumption-planner';
import { unitCostMicroFromLine } from '../../domain/value-objects/money';

/**
 * Transactional write side of the warehouse. Each public method runs in ONE
 * database transaction. The append-only movement ledger is never updated/
 * deleted; layers are mutated only here, during a draw-down. The FIFO/FEFO core
 * lives in `applyConsumptionTx` and is reused by both `consume` and `runProcess`.
 */
@Injectable()
export class PrismaInventoryLedgerGateway implements InventoryLedgerGateway {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(OUTBOX_RECORDER) private readonly outbox: OutboxRecorder,
  ) {}

  /** Build outbox records for touched stock layers (UPSERT) + movements (CREATE). */
  private stockRecords(layerIds: Iterable<string>, movementIds: Iterable<string>): OutboxRecord[] {
    const records: OutboxRecord[] = [];
    for (const id of new Set(layerIds)) {
      records.push({ aggregateType: 'STOCK_LAYER', aggregateId: id, op: 'UPSERT' });
    }
    for (const id of new Set(movementIds)) {
      records.push({ aggregateType: 'STOCK_MOVEMENT', aggregateId: id, op: 'CREATE' });
    }
    return records;
  }

  async recordReceipt(input: RecordReceiptInput): Promise<void> {
    const { receipt, layers, movements, costUpdates } = input;
    await this.prisma.$transaction(async (tx) => {
      await tx.goodsReceipt.create({
        data: {
          id: receipt.id,
          restaurantId: receipt.restaurantId,
          branchId: receipt.branchId,
          supplierId: receipt.supplierId,
          reference: receipt.reference,
          receivedAt: receipt.receivedAt,
          note: receipt.note,
          createdByUserId: receipt.createdByUserId,
          createdAt: receipt.createdAt,
        },
      });
      await tx.goodsReceiptLine.createMany({
        data: receipt.lines.map((l) => ({
          id: l.id,
          receiptId: receipt.id,
          branchId: l.branchId,
          itemId: l.itemId,
          enteredUnit: l.enteredUnit,
          enteredQty: l.enteredQty,
          baseQty: l.baseQty,
          lineTotalCostAmount: l.lineTotalCostAmount,
          expiryDate: l.expiryDate,
        })),
      });
      await tx.stockLayer.createMany({ data: layers.map(toLayerRow) });
      await tx.stockMovement.createMany({ data: movements.map(toMovementRow) });
      for (const cu of costUpdates) {
        await tx.inventoryItem.updateMany({
          where: { id: cu.itemId, restaurantId: receipt.restaurantId },
          data: { lastUnitCostMicro: cu.lastUnitCostMicro },
        });
      }
      // OFF-4: capture the receipt header+lines + its new layers + movements.
      // (lastUnitCostMicro lives on the config InventoryItem and is NOT captured.)
      await this.outbox.record(tx, [
        { aggregateType: 'GOODS_RECEIPT', aggregateId: receipt.id, op: 'CREATE' },
        ...this.stockRecords(
          layers.map((l) => l.id),
          movements.map((m) => m.id),
        ),
      ]);
    });
  }

  async recordInboundAdjustment(input: RecordInboundInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.stockLayer.create({ data: toLayerRow(input.layer) });
      await tx.stockMovement.create({ data: toMovementRow(input.movement) });
      // OFF-4: capture the new layer + adjustment movement.
      await this.outbox.record(tx, this.stockRecords([input.layer.id], [input.movement.id]));
    });
  }

  async consume(input: GatewayConsumeInput): Promise<StockConsumptionResult> {
    return this.prisma.$transaction(async (tx) => {
      const { result, layerIds, movementIds } = await this.applyConsumptionTx(tx, input);
      await this.outbox.record(tx, this.stockRecords(layerIds, movementIds));
      return result;
    });
  }

  async reverse(input: ReverseLedgerInput): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const originals = await tx.stockMovement.findMany({
        where: {
          restaurantId: input.restaurantId,
          refType: input.refType,
          refId: input.refId,
          baseQty: { lt: 0 },
          reversedAt: null,
          type: { in: OUT_MOVEMENT_TYPES as StockMovementType[] },
        },
      });
      if (originals.length === 0) {
        return 0; // already reversed or never consumed — idempotent no-op
      }

      const layerIds: string[] = [];
      const movementIds: string[] = [];
      for (const orig of originals) {
        // Restore the source layer (flip DEPLETED -> OPEN if it now has stock).
        // Shortfall movements have no layerId — only the compensating + movement.
        if (orig.layerId) {
          const layer = await tx.stockLayer.findUnique({ where: { id: orig.layerId } });
          if (layer) {
            const restored = layer.baseQtyRemaining + Math.abs(orig.baseQty);
            await tx.stockLayer.update({
              where: { id: orig.layerId },
              data: {
                baseQtyRemaining: restored,
                status: restored > 0 ? StockLayerStatus.OPEN : layer.status,
              },
            });
            layerIds.push(orig.layerId);
          }
        }
        const reversalId = this.ids.generate();
        await tx.stockMovement.create({
          data: toMovementRow({
            id: reversalId,
            restaurantId: input.restaurantId,
            branchId: orig.branchId,
            itemId: orig.itemId,
            type: StockMovementType.CONSUMPTION_REVERSAL,
            baseQty: -orig.baseQty, // flip sign: + restores on-hand
            costAmount: -orig.costAmount,
            layerId: orig.layerId,
            reason: orig.reason,
            refType: orig.refType,
            refId: orig.refId,
            occurredAt: input.occurredAt,
            createdByUserId: input.createdByUserId,
          }),
        });
        await tx.stockMovement.update({
          where: { id: orig.id },
          data: { reversedAt: input.occurredAt },
        });
        // The new reversal movement AND the stamped original both changed.
        movementIds.push(reversalId, orig.id);
      }
      // OFF-4: capture restored layers + reversal/stamped movements.
      await this.outbox.record(tx, this.stockRecords(layerIds, movementIds));
      return originals.length;
    });
  }

  async runProcess(input: RunProcessInput): Promise<RunProcessResult> {
    const { run, inputs, outputs } = input;
    return this.prisma.$transaction(async (tx) => {
      const layerIds: string[] = [];
      const movementIds: string[] = [];

      // 1. Consume every input FIFO/FEFO (PROCESS_OUT), reusing the same core.
      let inputCostAmount = 0;
      let wentNegative = false;
      for (const inp of inputs) {
        const res = await this.applyConsumptionTx(tx, {
          restaurantId: run.restaurantId,
          branchId: inp.branchId,
          itemId: inp.itemId,
          baseQty: inp.baseQty,
          type: StockMovementType.PROCESS_OUT,
          reason: null,
          refType: PROCESS_RUN_REF_TYPE,
          refId: run.id,
          createdByUserId: run.createdByUserId,
          occurredAt: run.runAt,
          trackExpiry: inp.trackExpiry,
          lastUnitCostMicro: inp.lastUnitCostMicro,
        });
        inputCostAmount += res.result.totalCostAmount;
        wentNegative = wentNegative || res.result.wentNegative;
        layerIds.push(...res.layerIds);
        movementIds.push(...res.movementIds);
      }

      // 2. Roll input cost + the per-run processing cost into the outputs.
      const totalCostAmount = inputCostAmount + run.processingCostAmount;
      const allocated = allocateCost(
        totalCostAmount,
        outputs.map((o) => ({ isPrimary: o.isPrimary, costShareBps: o.costShareBps })),
      );

      // 3. Produce one PROCESSED layer + PROCESS_IN movement per output.
      const allocations: RunProcessAllocation[] = [];
      for (let i = 0; i < outputs.length; i++) {
        const o = outputs[i];
        const cost = allocated[i];
        const layerId = this.ids.generate();
        await tx.stockLayer.create({
          data: toLayerRow({
            id: layerId,
            restaurantId: run.restaurantId,
            branchId: o.branchId,
            itemId: o.itemId,
            sourceReceiptLineId: null,
            baseQtyReceived: o.baseQty,
            baseQtyRemaining: o.baseQty,
            lineTotalCostAmount: cost,
            receivedAt: run.runAt,
            expiryDate: o.expiryDate,
          }),
        });
        const outMovementId = this.ids.generate();
        await tx.stockMovement.create({
          data: toMovementRow({
            id: outMovementId,
            restaurantId: run.restaurantId,
            branchId: o.branchId,
            itemId: o.itemId,
            type: StockMovementType.PROCESS_IN,
            baseQty: o.baseQty,
            costAmount: cost,
            layerId,
            reason: null,
            refType: PROCESS_RUN_REF_TYPE,
            refId: run.id,
            occurredAt: run.runAt,
            createdByUserId: run.createdByUserId,
          }),
        });
        layerIds.push(layerId);
        movementIds.push(outMovementId);
        allocations.push({
          itemId: o.itemId,
          layerId,
          baseQty: o.baseQty,
          allocatedCostAmount: cost,
        });

        // INV-3 §3: refresh the output item's lastUnitCostMicro from this run's
        // derived output unit cost so processed ingredients estimate correctly.
        if (o.baseQty > 0) {
          await tx.inventoryItem.updateMany({
            where: { id: o.itemId, restaurantId: run.restaurantId },
            data: { lastUnitCostMicro: unitCostMicroFromLine(cost, o.baseQty) },
          });
        }
      }

      // 4. Persist the run with its cost snapshot.
      await tx.processRun.create({
        data: {
          id: run.id,
          restaurantId: run.restaurantId,
          branchId: run.branchId,
          processId: run.processId,
          multiplier: run.multiplier,
          inputCostAmount,
          processingCostAmount: run.processingCostAmount,
          totalCostAmount,
          wentNegative,
          runAt: run.runAt,
          note: run.note,
          createdByUserId: run.createdByUserId,
        },
      });

      // OFF-4: capture the process run + consumed/produced layers + movements.
      await this.outbox.record(tx, [
        { aggregateType: 'PROCESS_RUN', aggregateId: run.id, op: 'CREATE' },
        ...this.stockRecords(layerIds, movementIds),
      ]);

      return {
        runId: run.id,
        inputCostAmount,
        processingCostAmount: run.processingCostAmount,
        totalCostAmount,
        wentNegative,
        allocations,
      };
    });
  }

  /**
   * FIFO/FEFO draw-down within an existing transaction: read OPEN layers, plan
   * the consumption (pure domain), decrement layers, append one OUT movement per
   * layer drawn + a shortfall movement when negative. Never throws on shortage.
   */
  private async applyConsumptionTx(
    tx: Prisma.TransactionClient,
    input: GatewayConsumeInput,
  ): Promise<ConsumptionTxResult> {
    // Idempotency per (refType, refId, itemId): if an un-reversed OUT movement
    // already exists for this ref + item, skip re-consuming (prevents double
    // deduct on re-fire). Manual adjustments (no ref) are never skipped.
    if (input.refType && input.refId) {
      const existing = await tx.stockMovement.findFirst({
        where: {
          restaurantId: input.restaurantId,
          itemId: input.itemId,
          refType: input.refType,
          refId: input.refId,
          baseQty: { lt: 0 },
          reversedAt: null,
        },
        select: { id: true },
      });
      if (existing) {
        return {
          result: {
            itemId: input.itemId,
            requestedBaseQty: input.baseQty,
            consumedFromLayers: 0,
            layersDrawn: 0,
            shortfallBaseQty: 0,
            wentNegative: false,
            uncosted: false,
            totalCostAmount: 0,
          },
          layerIds: [],
          movementIds: [],
        };
      }
    }

    const openLayers = await tx.stockLayer.findMany({
      where: {
        restaurantId: input.restaurantId,
        branchId: input.branchId,
        itemId: input.itemId,
        status: StockLayerStatus.OPEN,
        baseQtyRemaining: { gt: 0 },
      },
    });

    const snapshots: OpenLayerSnapshot[] = openLayers.map((l) => ({
      layerId: l.id,
      baseQtyReceived: l.baseQtyReceived,
      baseQtyRemaining: l.baseQtyRemaining,
      lineTotalCostAmount: l.lineTotalCostAmount,
      receivedAt: l.receivedAt,
      expiryDate: l.expiryDate,
    }));

    const plan = planConsumption({
      requestedQty: input.baseQty,
      trackExpiry: input.trackExpiry,
      lastUnitCostMicro: input.lastUnitCostMicro,
      layers: snapshots,
    });

    let totalCostAmount = 0;
    const layerIds: string[] = [];
    const movementIds: string[] = [];

    for (const draw of plan.draws) {
      await tx.stockLayer.update({
        where: { id: draw.layerId },
        data: {
          baseQtyRemaining: draw.newRemaining,
          status: draw.depleted ? StockLayerStatus.DEPLETED : StockLayerStatus.OPEN,
        },
      });
      const movementId = this.ids.generate();
      await tx.stockMovement.create({
        data: toMovementRow({
          id: movementId,
          restaurantId: input.restaurantId,
          branchId: input.branchId,
          itemId: input.itemId,
          type: input.type,
          baseQty: -draw.qty,
          costAmount: -draw.costAmount,
          layerId: draw.layerId,
          reason: input.reason,
          refType: input.refType,
          refId: input.refId,
          occurredAt: input.occurredAt,
          createdByUserId: input.createdByUserId,
        }),
      });
      layerIds.push(draw.layerId);
      movementIds.push(movementId);
      totalCostAmount += draw.costAmount;
    }

    if (plan.shortfallQty > 0) {
      const movementId = this.ids.generate();
      await tx.stockMovement.create({
        data: toMovementRow({
          id: movementId,
          restaurantId: input.restaurantId,
          branchId: input.branchId,
          itemId: input.itemId,
          type: input.type,
          baseQty: -plan.shortfallQty,
          costAmount: -plan.shortfallCostAmount,
          layerId: null,
          reason: input.reason,
          refType: input.refType,
          refId: input.refId,
          occurredAt: input.occurredAt,
          createdByUserId: input.createdByUserId,
        }),
      });
      movementIds.push(movementId);
      totalCostAmount += plan.shortfallCostAmount;
    }

    return {
      result: {
        itemId: input.itemId,
        requestedBaseQty: input.baseQty,
        consumedFromLayers: plan.drawnQty,
        layersDrawn: plan.draws.length,
        shortfallBaseQty: plan.shortfallQty,
        wentNegative: plan.wentNegative,
        uncosted: plan.uncosted,
        totalCostAmount,
      },
      layerIds,
      movementIds,
    };
  }
}

/** Internal result of a FIFO draw-down: the domain result + ids it touched. */
interface ConsumptionTxResult {
  result: StockConsumptionResult;
  layerIds: string[];
  movementIds: string[];
}

function toLayerRow(l: NewLayerSpec): Prisma.StockLayerCreateManyInput {
  return {
    id: l.id,
    restaurantId: l.restaurantId,
    branchId: l.branchId,
    itemId: l.itemId,
    sourceReceiptLineId: l.sourceReceiptLineId,
    baseQtyReceived: l.baseQtyReceived,
    baseQtyRemaining: l.baseQtyRemaining,
    lineTotalCostAmount: l.lineTotalCostAmount,
    receivedAt: l.receivedAt,
    expiryDate: l.expiryDate,
  };
}

function toMovementRow(m: NewMovementSpec): Prisma.StockMovementCreateManyInput {
  return {
    id: m.id,
    restaurantId: m.restaurantId,
    branchId: m.branchId,
    itemId: m.itemId,
    type: m.type,
    baseQty: m.baseQty,
    costAmount: m.costAmount,
    layerId: m.layerId,
    reason: m.reason,
    refType: m.refType,
    refId: m.refId,
    occurredAt: m.occurredAt,
    createdByUserId: m.createdByUserId,
  };
}
