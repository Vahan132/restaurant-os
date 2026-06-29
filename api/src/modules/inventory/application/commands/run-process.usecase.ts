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
import { InventoryLocationProvisioner } from '../services/inventory-location-provisioner.service';
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

// NOTE (7A inspection — process model + stock effects, pre-existing state):
//   • A Process (catalog, branch-scoped) declares ProcessInput rows (itemId +
//     baseQty) and ProcessOutput rows (itemId + baseQty + isPrimary +
//     costShareBps). A run scales every qty by an integer `multiplier`.
//   • Run stock writes live in PrismaInventoryLedgerGateway.runProcess (ONE tx),
//     reusing the shared FIFO core `applyConsumptionTx`: inputs → PROCESS_OUT,
//     outputs → PROCESS_IN (refType=PROCESS_RUN, refId=run.id).
//   • LOCATION (the gap 7A closes): pre-7A the input draw passed NO locationId, so
//     it consumed across ALL of the branch's lots and dropped shortfall on Main
//     Storage; outputs landed on the branch default (Main Storage via
//     resolveDefaultLocationId) — NOT the per-item location. 7A routes both through
//     the 6C per-item resolveConsumptionLocationId (item override else Main Storage).
//   • COSTING already rolls input cost INTO the produced layers — output unit cost
//     = (Σ consumed input cost + the per-run processingCost snapshot) ÷ output qty,
//     allocated across outputs by allocateCost, acquiredAt = run completion. 7A keeps
//     this (the spec's "rolled-up input cost" plus the existing processing-cost add-on,
//     a superset — not zero/other-cost). lastUnitCostMicro of each output is refreshed.
//   • NEVER-BLOCK: runProcess/consume never throw on short stock (negative allowed,
//     shortfall costed at lastUnitCostMicro) — process runs inherit serve parity, no
//     intentional block. On-hand + low-stock alerts are maintained in-tx (touchOnHand).
//   • AUTHZ: the run endpoint is @BranchScoped + @RequirePermissions(
//     inventory:process:run) — previously held only by OWNER/MANAGER (ALL_PERMISSIONS).
//     7A grants the same capability to new CHEF/SOUS_CHEF roles so KDS PIN sessions
//     (which carry the role's permission snapshot — identical guard path to admin)
//     can run processes. No endpoint/guard change needed; gating IS the capability.
/**
 * Execute a production run. Consumes inputs FIFO/FEFO (PROCESS_OUT, reusing the
 * INV-1 stock machinery) from each input item's default consumption location,
 * rolls input cost + the process's processing cost into the produced
 * PROCESSED-item layers (PROCESS_IN) at each output item's default location, and
 * records the run — all in ONE transaction (the ledger gateway). Never throws on
 * short input stock: the run completes with wentNegative=true. No undo in MVP —
 * correct via INV-1 manual adjustments.
 */
@Injectable()
export class RunProcessUseCase implements UseCase<RunProcessUseCaseInput, ProcessRun> {
  constructor(
    @Inject(PROCESS_REPOSITORY) private readonly processes: ProcessRepository,
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    @Inject(INVENTORY_LEDGER_GATEWAY) private readonly ledger: InventoryLedgerGateway,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly locations: InventoryLocationProvisioner,
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

    // 7A: every input is consumed from ITS OWN default consumption location (the
    // 6C per-item resolver — item override else branch Main Storage), depleting
    // that location's FIFO lots exactly like serving a dish. (Pre-7A the draw was
    // not location-scoped.)
    const inputs: RunProcessInputSpec[] = [];
    for (const pi of process.inputs) {
      const item = byId.get(pi.itemId)!;
      const locationId = await this.locations.resolveConsumptionLocationId(
        input.restaurantId,
        pi.branchId,
        item.consumptionLocationId,
      );
      inputs.push({
        itemId: pi.itemId,
        branchId: pi.branchId,
        locationId,
        baseQty: pi.baseQty * multiplier,
        trackExpiry: item.trackExpiry,
        lastUnitCostMicro: item.lastUnitCostMicro,
      });
    }

    // 7A: each output is produced INTO its own default consumption location (same
    // per-item resolver), so a processed item lands where it will be served from.
    // (6A produced into the branch default Main Storage; 7A made it per-item.)
    const outputs: RunProcessOutputSpec[] = [];
    for (const po of process.outputs) {
      const item = byId.get(po.itemId)!;
      const expiryDate = item.trackExpiry ? (expiryByItem.get(po.itemId) ?? null) : null;
      const locationId = await this.locations.resolveConsumptionLocationId(
        input.restaurantId,
        po.branchId,
        item.consumptionLocationId,
      );
      outputs.push({
        itemId: po.itemId,
        branchId: po.branchId,
        locationId,
        baseQty: po.baseQty * multiplier,
        isPrimary: po.isPrimary,
        costShareBps: po.costShareBps,
        expiryDate,
      });
    }

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
        input.branchId,
        process.id,
        multiplier,
        result.inputCostAmount,
        result.processingCostAmount,
        result.totalCostAmount,
        result.wentNegative,
        result.inputs.map((i) => ({
          itemId: i.itemId,
          locationId: i.locationId,
          baseQty: i.baseQty,
          costAmount: i.costAmount,
        })),
        result.allocations.map((a) => ({
          itemId: a.itemId,
          locationId: a.locationId,
          baseQty: a.baseQty,
          costAmount: a.allocatedCostAmount,
        })),
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
