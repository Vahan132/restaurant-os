import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OutboxRecord } from '../../../../shared/edge/contracts/operational.contract';
import { OUTBOX_RECORDER, OutboxRecorder } from '../../../../shared/edge/outbox-recorder';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import {
  InventoryLocationType,
  LowStockAlertStatus,
  OUT_MOVEMENT_TYPES,
  PROCESS_RUN_REF_TYPE,
  StockLayerStatus,
  StockMovementType,
  TRANSFER_REF_TYPE,
} from '../../domain/enums';
import { StockConsumptionResult } from '../../domain/ports/stock-consumption.port';
import {
  CountAdjustmentResult,
  GatewayConsumeInput,
  InventoryLedgerGateway,
  NewLayerSpec,
  NewMovementSpec,
  RecordInboundInput,
  RecordReceiptInput,
  ReverseLedgerInput,
  RunProcessAllocation,
  RunProcessInput,
  RunProcessInputConsumption,
  RunProcessResult,
  SetCountedOnHandInput,
  TransferLedgerInput,
  TransferLedgerResult,
  TransferSliceRecord,
} from '../../domain/repositories/inventory-ledger.gateway';
import { allocateCost } from '../../domain/services/cost-allocation';
import { OpenLayerSnapshot, planConsumption } from '../../domain/services/consumption-planner';
import {
  costFromUnitCostMicro,
  unitCostMicroFromLine,
} from '../../domain/value-objects/money';
import { TransferExceedsOnHand } from '../../application/application.errors';

/** refType marker for 6A correction (counted-on-hand) adjustments. */
const COUNT_ADJUSTMENT_REF_TYPE = 'COUNT_ADJUSTMENT';

/**
 * Transactional write side of the warehouse. Each public method runs in ONE
 * database transaction. The append-only movement ledger is never updated/
 * deleted; layers are mutated only here, during a draw-down. The FIFO/FEFO core
 * lives in `applyConsumptionTx` and is reused by both `consume` and `runProcess`.
 *
 * 6A: every ledger append now also maintains the per-(item, location) StockOnHand
 * projection and reconciles low-stock alerts IN THE SAME TRANSACTION (§4). On-hand
 * is rebuildable from the ledger by summing baseQty grouped by location+item.
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
      // 6C backfill rule: if the target location has negative on-hand for the
      // item, the receipt FIRST cancels the negative (reconciling the prior
      // shortfall) and only the REMAINDER becomes new positive layer stock. The
      // RECEIPT_IN movement still records the full received quantity, so the
      // ledger reconciles (Σ movements == on-hand) and a fully-absorbed layer is
      // created DEPLETED. Processed sequentially so multiple lines for the same
      // (item, location) draw down the same deficit.
      const cache = new Map<string, number | null>();
      for (const l of layers) {
        const existing = await tx.stockOnHand.findFirst({
          where: {
            restaurantId: l.restaurantId,
            branchId: l.branchId,
            itemId: l.itemId,
            locationId: l.locationId,
          },
          select: { quantity: true },
        });
        const onHandBefore = existing?.quantity ?? 0;
        const deficit = onHandBefore < 0 ? -onHandBefore : 0;
        const remaining = Math.max(0, l.baseQtyReceived - deficit);
        await tx.stockLayer.create({
          data: {
            ...toLayerRow(l),
            baseQtyRemaining: remaining,
            status: remaining > 0 ? StockLayerStatus.OPEN : StockLayerStatus.DEPLETED,
          },
        });
        await this.touchOnHand(
          tx,
          {
            restaurantId: l.restaurantId,
            branchId: l.branchId,
            itemId: l.itemId,
            locationId: l.locationId,
            delta: l.baseQtyReceived,
          },
          receipt.receivedAt,
          cache,
        );
      }
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
      // 6A: raise on-hand at the adjustment's location.
      await this.touchOnHand(
        tx,
        {
          restaurantId: input.movement.restaurantId,
          branchId: input.movement.branchId,
          itemId: input.movement.itemId,
          locationId: input.movement.locationId,
          delta: input.movement.baseQty,
        },
        input.movement.occurredAt,
        new Map(),
      );
      // OFF-4: capture the new layer + adjustment movement.
      await this.outbox.record(tx, this.stockRecords([input.layer.id], [input.movement.id]));
    });
  }

  async consume(input: GatewayConsumeInput): Promise<StockConsumptionResult> {
    return this.prisma.$transaction(async (tx) => {
      const { result, layerIds, movementIds } = await this.applyConsumptionTx(tx, input, new Map());
      await this.outbox.record(tx, this.stockRecords(layerIds, movementIds));
      return result;
    });
  }

  async setCountedOnHand(input: SetCountedOnHandInput): Promise<CountAdjustmentResult> {
    return this.prisma.$transaction(async (tx) => {
      const cache = new Map<string, number | null>();
      const layerIds: string[] = [];
      const movementIds: string[] = [];

      const existing = await tx.stockOnHand.findUnique({
        where: { itemId_locationId: { itemId: input.itemId, locationId: input.locationId } },
        select: { quantity: true },
      });
      const before = existing?.quantity ?? 0;
      const delta = input.countedBaseQty - before;

      if (delta === 0) {
        return {
          beforeBaseQty: before,
          afterBaseQty: before,
          deltaBaseQty: 0,
          uncosted: false,
          lowStockRaised: false,
          thresholdBase: null,
        };
      }

      let uncosted = false;
      let lowStockRaised = false;
      let thresholdBase: number | null = null;

      if (delta > 0) {
        // Surplus: value at last known unit cost (flag uncosted if none).
        const hasCost = input.lastUnitCostMicro !== null && input.lastUnitCostMicro > 0n;
        const lineTotalCostAmount = hasCost
          ? costFromUnitCostMicro(input.lastUnitCostMicro as bigint, delta)
          : 0;
        uncosted = !hasCost;

        const layerId = this.ids.generate();
        await tx.stockLayer.create({
          data: toLayerRow({
            id: layerId,
            restaurantId: input.restaurantId,
            branchId: input.branchId,
            locationId: input.locationId,
            itemId: input.itemId,
            sourceReceiptLineId: null,
            baseQtyReceived: delta,
            baseQtyRemaining: delta,
            lineTotalCostAmount,
            receivedAt: input.occurredAt,
            expiryDate: null,
          }),
        });
        const movementId = this.ids.generate();
        await tx.stockMovement.create({
          data: toMovementRow({
            id: movementId,
            restaurantId: input.restaurantId,
            branchId: input.branchId,
            locationId: input.locationId,
            itemId: input.itemId,
            type: StockMovementType.ADJUSTMENT_IN,
            baseQty: delta,
            costAmount: lineTotalCostAmount,
            layerId,
            reason: input.reason,
            refType: COUNT_ADJUSTMENT_REF_TYPE,
            refId: null,
            occurredAt: input.occurredAt,
            createdByUserId: input.createdByUserId,
          }),
        });
        layerIds.push(layerId);
        movementIds.push(movementId);

        const r = await this.touchOnHand(
          tx,
          {
            restaurantId: input.restaurantId,
            branchId: input.branchId,
            itemId: input.itemId,
            locationId: input.locationId,
            delta,
          },
          input.occurredAt,
          cache,
        );
        lowStockRaised = r.raised;
        thresholdBase = r.thresholdBase;
      } else {
        // Shortfall: location-scoped FIFO/FEFO draw of abs(delta).
        const res = await this.applyConsumptionTx(
          tx,
          {
            restaurantId: input.restaurantId,
            branchId: input.branchId,
            itemId: input.itemId,
            baseQty: -delta,
            type: StockMovementType.ADJUSTMENT_OUT,
            reason: input.reason,
            refType: COUNT_ADJUSTMENT_REF_TYPE,
            refId: null,
            createdByUserId: input.createdByUserId,
            occurredAt: input.occurredAt,
            trackExpiry: input.trackExpiry,
            lastUnitCostMicro: input.lastUnitCostMicro,
            locationId: input.locationId,
          },
          cache,
        );
        layerIds.push(...res.layerIds);
        movementIds.push(...res.movementIds);
        lowStockRaised = res.lowStockRaised;
        thresholdBase = res.thresholdBase;
      }

      await this.outbox.record(tx, this.stockRecords(layerIds, movementIds));

      return {
        beforeBaseQty: before,
        afterBaseQty: input.countedBaseQty,
        deltaBaseQty: delta,
        uncosted,
        lowStockRaised,
        thresholdBase,
      };
    });
  }

  async transfer(input: TransferLedgerInput): Promise<TransferLedgerResult> {
    return this.prisma.$transaction(async (tx) => {
      const cache = new Map<string, number | null>();

      // 1. FIFO/FEFO-consume from the source location (TRANSFER_OUT). This also
      //    decrements the source on-hand projection + reconciles its alerts.
      const src = await this.applyConsumptionTx(
        tx,
        {
          restaurantId: input.restaurantId,
          branchId: input.branchId,
          itemId: input.itemId,
          baseQty: input.baseQty,
          type: StockMovementType.TRANSFER_OUT,
          reason: null,
          refType: TRANSFER_REF_TYPE,
          refId: input.transferId,
          createdByUserId: input.performedByUserId,
          occurredAt: input.occurredAt,
          trackExpiry: input.trackExpiry,
          lastUnitCostMicro: input.lastUnitCostMicro,
          locationId: input.fromLocationId,
        },
        cache,
      );
      // Authoritative over-transfer guard: a shortfall means Q exceeded the
      // source lots — reject and roll the whole transaction back (no negatives).
      if (src.result.shortfallBaseQty > 0) {
        throw TransferExceedsOnHand();
      }

      const layerIds = [...src.layerIds];
      const movementIds = [...src.movementIds];

      // 2. Group consumed slices by carrying unit cost (preserve cost fidelity —
      //    same-cost slices merge; different costs stay separate). Preserve source
      //    consumption order as the tiebreaker among same-instant destination lots.
      const grouped = new Map<
        string,
        { unitCostMicro: bigint; qty: number; cost: number; slices: DrawSlice[] }
      >();
      const groupOrder: string[] = [];
      for (const d of src.draws) {
        const unitCostMicro = unitCostMicroFromLine(d.costAmount, d.qty);
        const key = unitCostMicro.toString();
        let g = grouped.get(key);
        if (!g) {
          g = { unitCostMicro, qty: 0, cost: 0, slices: [] };
          grouped.set(key, g);
          groupOrder.push(key);
        }
        g.qty += d.qty;
        g.cost += d.costAmount;
        g.slices.push(d);
      }

      // 3. Create one destination lot per cost group (acquiredAt = transfer time)
      //    + a TRANSFER_IN movement, and record the audit slices.
      const sliceRecords: TransferSliceRecord[] = [];
      let movedTotal = 0;
      for (const key of groupOrder) {
        const g = grouped.get(key)!;
        const destLayerId = this.ids.generate();
        await tx.stockLayer.create({
          data: toLayerRow({
            id: destLayerId,
            restaurantId: input.restaurantId,
            branchId: input.branchId,
            locationId: input.toLocationId,
            itemId: input.itemId,
            sourceReceiptLineId: null,
            baseQtyReceived: g.qty,
            baseQtyRemaining: g.qty,
            lineTotalCostAmount: g.cost,
            receivedAt: input.occurredAt,
            expiryDate: null,
          }),
        });
        const inMovementId = this.ids.generate();
        await tx.stockMovement.create({
          data: toMovementRow({
            id: inMovementId,
            restaurantId: input.restaurantId,
            branchId: input.branchId,
            locationId: input.toLocationId,
            itemId: input.itemId,
            type: StockMovementType.TRANSFER_IN,
            baseQty: g.qty,
            costAmount: g.cost,
            layerId: destLayerId,
            reason: null,
            refType: TRANSFER_REF_TYPE,
            refId: input.transferId,
            occurredAt: input.occurredAt,
            createdByUserId: input.performedByUserId,
          }),
        });
        layerIds.push(destLayerId);
        movementIds.push(inMovementId);
        movedTotal += g.qty;
        for (const s of g.slices) {
          sliceRecords.push({
            sourceLayerId: s.sourceLayerId,
            destinationLayerId: destLayerId,
            baseQty: s.qty,
            costAmount: s.costAmount,
            unitCostMicro: g.unitCostMicro,
          });
        }
      }

      // 4. Raise destination on-hand (resolves a destination alert if recovered).
      await this.touchOnHand(
        tx,
        {
          restaurantId: input.restaurantId,
          branchId: input.branchId,
          itemId: input.itemId,
          locationId: input.toLocationId,
          delta: movedTotal,
        },
        input.occurredAt,
        cache,
      );

      // 5. Persist the transfer header + consumed-slice audit trail.
      await tx.inventoryTransfer.create({
        data: {
          id: input.transferId,
          restaurantId: input.restaurantId,
          branchId: input.branchId,
          itemId: input.itemId,
          fromLocationId: input.fromLocationId,
          toLocationId: input.toLocationId,
          quantity: input.baseQty,
          performedByUserId: input.performedByUserId,
          occurredAt: input.occurredAt,
        },
      });
      await tx.inventoryTransferSlice.createMany({
        data: sliceRecords.map((s) => ({
          id: this.ids.generate(),
          transferId: input.transferId,
          itemId: input.itemId,
          sourceLayerId: s.sourceLayerId,
          destinationLayerId: s.destinationLayerId,
          baseQty: s.baseQty,
          costAmount: s.costAmount,
          unitCostMicro: s.unitCostMicro,
        })),
      });

      // 6. Snapshot both on-hand figures for the response.
      const [fromRow, toRow] = await Promise.all([
        tx.stockOnHand.findFirst({
          where: {
            restaurantId: input.restaurantId,
            branchId: input.branchId,
            itemId: input.itemId,
            locationId: input.fromLocationId,
          },
          select: { quantity: true },
        }),
        tx.stockOnHand.findFirst({
          where: {
            restaurantId: input.restaurantId,
            branchId: input.branchId,
            itemId: input.itemId,
            locationId: input.toLocationId,
          },
          select: { quantity: true },
        }),
      ]);

      // OFF-4: capture the touched source + destination lots/movements (the
      // transfer header/slices are rebuildable from the captured ledger).
      await this.outbox.record(tx, this.stockRecords(layerIds, movementIds));

      return {
        transferId: input.transferId,
        slices: sliceRecords,
        fromOnHandAfter: fromRow?.quantity ?? 0,
        toOnHandAfter: toRow?.quantity ?? 0,
        lowStockRaised: src.lowStockRaised,
      };
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
      const cache = new Map<string, number | null>();
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
            locationId: orig.locationId,
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
        // 6A: restore on-hand at the original movement's location.
        await this.touchOnHand(
          tx,
          {
            restaurantId: input.restaurantId,
            branchId: orig.branchId,
            itemId: orig.itemId,
            locationId: orig.locationId,
            delta: -orig.baseQty,
          },
          input.occurredAt,
          cache,
        );
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
      const cache = new Map<string, number | null>();

      // 1. Consume every input FIFO/FEFO (PROCESS_OUT), reusing the same core.
      //    7A: each input is depleted from its own default CONSUMPTION location
      //    (inp.locationId) — the draw is location-scoped and the shortfall is
      //    attributed there, exactly like serving a dish.
      let inputCostAmount = 0;
      let wentNegative = false;
      const inputConsumptions: RunProcessInputConsumption[] = [];
      for (const inp of inputs) {
        const res = await this.applyConsumptionTx(
          tx,
          {
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
            locationId: inp.locationId,
          },
          cache,
        );
        inputCostAmount += res.result.totalCostAmount;
        wentNegative = wentNegative || res.result.wentNegative;
        layerIds.push(...res.layerIds);
        movementIds.push(...res.movementIds);
        inputConsumptions.push({
          itemId: inp.itemId,
          locationId: inp.locationId,
          baseQty: inp.baseQty,
          costAmount: res.result.totalCostAmount,
          wentNegative: res.result.wentNegative,
        });
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
            locationId: o.locationId,
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
            locationId: o.locationId,
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
          locationId: o.locationId,
          layerId,
          baseQty: o.baseQty,
          allocatedCostAmount: cost,
        });

        if (o.baseQty > 0) {
          // 6A: raise on-hand at the output location.
          await this.touchOnHand(
            tx,
            {
              restaurantId: run.restaurantId,
              branchId: o.branchId,
              itemId: o.itemId,
              locationId: o.locationId,
              delta: o.baseQty,
            },
            run.runAt,
            cache,
          );
          // INV-3 §3: refresh the output item's lastUnitCostMicro from this run's
          // derived output unit cost so processed ingredients estimate correctly.
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
        inputs: inputConsumptions,
        allocations,
      };
    });
  }

  /**
   * FIFO/FEFO draw-down within an existing transaction: read OPEN layers (scoped
   * to a location when `input.locationId` is set), plan the consumption (pure
   * domain), decrement layers, append one OUT movement per layer drawn + a
   * shortfall movement when negative, and maintain the per-location on-hand
   * projection + alerts. Never throws on shortage.
   */
  private async applyConsumptionTx(
    tx: Prisma.TransactionClient,
    input: GatewayConsumeInput,
    itemThresholdCache: Map<string, number | null>,
  ): Promise<ConsumptionTxResult> {
    const empty: ConsumptionTxResult = {
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
      lowStockRaised: false,
      thresholdBase: null,
      draws: [],
    };

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
        return empty;
      }
    }

    const openLayers = await tx.stockLayer.findMany({
      where: {
        restaurantId: input.restaurantId,
        branchId: input.branchId,
        itemId: input.itemId,
        status: StockLayerStatus.OPEN,
        baseQtyRemaining: { gt: 0 },
        ...(input.locationId ? { locationId: input.locationId } : {}),
      },
    });

    const layerLocation = new Map<string, string>();
    for (const l of openLayers) {
      layerLocation.set(l.id, l.locationId);
    }

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

    // Where shortfall + on-hand for unlocated draws land: the explicit location,
    // else the branch default (Main Storage), else the first drawn layer.
    let fallbackLocation: string | null =
      input.locationId ??
      (await this.resolveDefaultLocationId(tx, input.restaurantId, input.branchId));
    if (!fallbackLocation && plan.draws.length > 0) {
      fallbackLocation = layerLocation.get(plan.draws[0].layerId) ?? null;
    }

    let totalCostAmount = 0;
    const layerIds: string[] = [];
    const movementIds: string[] = [];
    const draws: DrawSlice[] = [];
    const deltaByLocation = new Map<string, number>();

    for (const draw of plan.draws) {
      const locationId = layerLocation.get(draw.layerId) ?? fallbackLocation;
      if (!locationId) {
        continue; // defensive: a drawn layer always has a location post-migration
      }
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
          locationId,
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
      draws.push({ sourceLayerId: draw.layerId, qty: draw.qty, costAmount: draw.costAmount });
      totalCostAmount += draw.costAmount;
      deltaByLocation.set(locationId, (deltaByLocation.get(locationId) ?? 0) - draw.qty);
    }

    if (plan.shortfallQty > 0 && fallbackLocation) {
      const movementId = this.ids.generate();
      await tx.stockMovement.create({
        data: toMovementRow({
          id: movementId,
          restaurantId: input.restaurantId,
          branchId: input.branchId,
          locationId: fallbackLocation,
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
      draws.push({
        sourceLayerId: null,
        qty: plan.shortfallQty,
        costAmount: plan.shortfallCostAmount,
      });
      totalCostAmount += plan.shortfallCostAmount;
      deltaByLocation.set(
        fallbackLocation,
        (deltaByLocation.get(fallbackLocation) ?? 0) - plan.shortfallQty,
      );
    }

    // 6A: apply the aggregated per-location on-hand deltas + reconcile alerts.
    let lowStockRaised = false;
    let thresholdBase: number | null = null;
    for (const [locationId, delta] of deltaByLocation) {
      const r = await this.touchOnHand(
        tx,
        {
          restaurantId: input.restaurantId,
          branchId: input.branchId,
          itemId: input.itemId,
          locationId,
          delta,
        },
        input.occurredAt,
        itemThresholdCache,
      );
      lowStockRaised = lowStockRaised || r.raised;
      if (input.locationId && locationId === input.locationId) {
        thresholdBase = r.thresholdBase;
      }
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
      lowStockRaised,
      thresholdBase,
      draws,
    };
  }

  /** The branch's default (Main Storage) location id, or null if unseeded. */
  private async resolveDefaultLocationId(
    tx: Prisma.TransactionClient,
    restaurantId: string,
    branchId: string,
  ): Promise<string | null> {
    const def = await tx.inventoryLocation.findFirst({
      where: { restaurantId, branchId, isDefault: true, deletedAt: null },
      select: { id: true },
    });
    if (def) {
      return def.id;
    }
    const main = await tx.inventoryLocation.findFirst({
      where: {
        restaurantId,
        branchId,
        systemType: InventoryLocationType.MAIN_STORAGE,
        deletedAt: null,
      },
      select: { id: true },
    });
    return main?.id ?? null;
  }

  /**
   * Upsert the (item, location) on-hand projection by `delta`, then raise/resolve
   * the pre-zero low-stock alert. Effective threshold = per-location override else
   * the item's lowStockThresholdBase. Returns whether a NEW alert was raised.
   */
  private async touchOnHand(
    tx: Prisma.TransactionClient,
    p: { restaurantId: string; branchId: string; itemId: string; locationId: string; delta: number },
    now: Date,
    itemThresholdCache: Map<string, number | null>,
  ): Promise<{ raised: boolean; thresholdBase: number | null; newQty: number }> {
    const row = await tx.stockOnHand.upsert({
      where: { itemId_locationId: { itemId: p.itemId, locationId: p.locationId } },
      create: {
        id: this.ids.generate(),
        restaurantId: p.restaurantId,
        branchId: p.branchId,
        itemId: p.itemId,
        locationId: p.locationId,
        quantity: p.delta,
      },
      update: { quantity: { increment: p.delta } },
      select: { quantity: true, lowStockThresholdBase: true },
    });
    const newQty = row.quantity;

    // Resolve the effective threshold (per-location override else item-level).
    let itemThreshold = itemThresholdCache.get(p.itemId);
    if (itemThreshold === undefined) {
      const item = await tx.inventoryItem.findUnique({
        where: { id: p.itemId },
        select: { lowStockThresholdBase: true },
      });
      itemThreshold = item?.lowStockThresholdBase ?? null;
      itemThresholdCache.set(p.itemId, itemThreshold);
    }
    const eff = row.lowStockThresholdBase ?? itemThreshold;

    let raised = false;
    if (eff !== null) {
      if (newQty >= 0 && newQty <= eff) {
        const open = await tx.lowStockAlert.findFirst({
          where: { itemId: p.itemId, locationId: p.locationId, status: LowStockAlertStatus.OPEN },
          select: { id: true },
        });
        if (!open) {
          await tx.lowStockAlert.create({
            data: {
              id: this.ids.generate(),
              restaurantId: p.restaurantId,
              branchId: p.branchId,
              itemId: p.itemId,
              locationId: p.locationId,
              thresholdBase: eff,
              onHandBase: newQty,
              status: LowStockAlertStatus.OPEN,
              raisedAt: now,
            },
          });
          raised = true;
        } else {
          await tx.lowStockAlert.update({
            where: { id: open.id },
            data: { onHandBase: newQty, thresholdBase: eff },
          });
        }
      } else if (newQty > eff) {
        // Recovered above the threshold — resolve any open alert.
        await tx.lowStockAlert.updateMany({
          where: { itemId: p.itemId, locationId: p.locationId, status: LowStockAlertStatus.OPEN },
          data: { status: LowStockAlertStatus.RESOLVED, resolvedAt: now },
        });
      }
    }

    return { raised, thresholdBase: eff, newQty };
  }
}

/** One consumed slice of a FIFO draw-down (the source lot + its carrying cost). */
interface DrawSlice {
  sourceLayerId: string | null;
  qty: number;
  costAmount: number;
}

/** Internal result of a FIFO draw-down: the domain result + ids it touched. */
interface ConsumptionTxResult {
  result: StockConsumptionResult;
  layerIds: string[];
  movementIds: string[];
  lowStockRaised: boolean;
  thresholdBase: number | null;
  /** Per-slice breakdown (source lot → qty → carrying cost). Used by transfers. */
  draws: DrawSlice[];
}

function toLayerRow(l: NewLayerSpec): Prisma.StockLayerCreateManyInput {
  return {
    id: l.id,
    restaurantId: l.restaurantId,
    branchId: l.branchId,
    locationId: l.locationId,
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
    locationId: m.locationId,
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
