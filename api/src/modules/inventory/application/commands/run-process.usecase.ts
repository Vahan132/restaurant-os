import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { InventoryItem } from '../../domain/entities/inventory-item';
import { ProcessRun } from '../../domain/entities/process-run';
import { ProcessRunExecutedEvent } from '../../domain/events/inventory-events';
import { InvalidMultiplierError } from '../../domain/inventory.errors';
import {
  INVENTORY_LEDGER_GATEWAY,
  InventoryLedgerGateway,
  RunProcessInputSpec,
  RunProcessOutputSpec,
} from '../../domain/repositories/inventory-ledger.gateway';
import {
  INVENTORY_ITEM_REPOSITORY,
  InventoryItemRepository,
} from '../../domain/repositories/inventory-item.repository';
import {
  PROCESS_REPOSITORY,
  ProcessRepository,
} from '../../domain/repositories/process.repository';
import { InventoryItemNotFound, NoRestaurantInScope, ProcessNotFound } from '../application.errors';

export interface RunProcessUseCaseInput {
  restaurantId: string | null;
  branchId: string;
  processId: string;
  multiplier?: number;
  runAt?: Date | null;
  note?: string | null;
  outputExpiry?: Array<{ itemId: string; expiryDate: Date }>;
  actorUserId: string;
}

/**
 * Execute a production run. Consumes inputs FIFO/FEFO (PROCESS_OUT, reusing the
 * INV-1 stock machinery), rolls input cost + the process's processing cost into
 * the produced PROCESSED-item layers (PROCESS_IN), and records the run — all in
 * ONE transaction (the ledger gateway). Never throws on short input stock:
 * the run completes with wentNegative=true. No undo in MVP — correct via INV-1
 * manual adjustments.
 */
@Injectable()
export class RunProcessUseCase implements UseCase<RunProcessUseCaseInput, ProcessRun> {
  constructor(
    @Inject(PROCESS_REPOSITORY) private readonly processes: ProcessRepository,
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    @Inject(INVENTORY_LEDGER_GATEWAY) private readonly ledger: InventoryLedgerGateway,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: RunProcessUseCaseInput): Promise<ProcessRun> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const multiplier = input.multiplier ?? 1;
    if (!Number.isInteger(multiplier) || multiplier < 1) {
      throw new InvalidMultiplierError();
    }

    const process = await this.processes.findById(
      input.restaurantId,
      input.branchId,
      input.processId,
    );
    if (!process) {
      throw ProcessNotFound();
    }

    const itemIds = [
      ...new Set([...process.inputs.map((i) => i.itemId), ...process.outputs.map((o) => o.itemId)]),
    ];
    const rows = await this.items.findManyByIds(input.restaurantId, input.branchId, itemIds);
    const byId = new Map<string, InventoryItem>(rows.map((r) => [r.id, r]));
    for (const id of itemIds) {
      if (!byId.has(id)) {
        throw InventoryItemNotFound();
      }
    }

    const expiryByItem = new Map<string, Date>(
      (input.outputExpiry ?? []).map((e) => [e.itemId, e.expiryDate]),
    );
    const runAt = input.runAt ?? new Date();

    const inputs: RunProcessInputSpec[] = process.inputs.map((pi) => {
      const item = byId.get(pi.itemId)!;
      return {
        itemId: pi.itemId,
        branchId: pi.branchId,
        baseQty: pi.baseQty * multiplier,
        trackExpiry: item.trackExpiry,
        lastUnitCostMicro: item.lastUnitCostMicro,
      };
    });

    const outputs: RunProcessOutputSpec[] = process.outputs.map((po) => {
      const item = byId.get(po.itemId)!;
      const expiryDate = item.trackExpiry ? (expiryByItem.get(po.itemId) ?? null) : null;
      return {
        itemId: po.itemId,
        branchId: po.branchId,
        baseQty: po.baseQty * multiplier,
        isPrimary: po.isPrimary,
        costShareBps: po.costShareBps,
        expiryDate,
      };
    });

    const runId = this.ids.generate();
    const result = await this.ledger.runProcess({
      run: {
        id: runId,
        restaurantId: input.restaurantId,
        branchId: input.branchId,
        processId: process.id,
        multiplier,
        processingCostAmount: process.processingCostAmount,
        runAt,
        note: input.note ?? null,
        createdByUserId: input.actorUserId,
      },
      inputs,
      outputs,
    });

    await this.events.publish(
      new ProcessRunExecutedEvent(
        runId,
        input.restaurantId,
        process.id,
        result.totalCostAmount,
        result.wentNegative,
        input.actorUserId,
      ),
    );

    const now = new Date();
    return ProcessRun.reconstitute(runId, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      processId: process.id,
      multiplier,
      inputCostAmount: result.inputCostAmount,
      processingCostAmount: result.processingCostAmount,
      totalCostAmount: result.totalCostAmount,
      wentNegative: result.wentNegative,
      runAt,
      note: input.note ?? null,
      createdByUserId: input.actorUserId,
      createdAt: now,
      updatedAt: now,
    });
  }
}
