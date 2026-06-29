/**
 * Phase 09 — KDS prep/production processes (decision I). Definitions are created
 * through the REAL CreateProcessUseCase (validates item kinds + cost allocation:
 * outputs must be PROCESSED), and at least one process RUN is driven through
 * RunProcessUseCase so the ledger shows input depletion (PROCESS_OUT) + output
 * accrual (PROCESS_IN) with rolled-up cost. Seeded on the flagship branch.
 */
import type { SeedContext } from '../context';
import type { SeedState } from '../state';
import { RESTAURANT, BRANCHES } from '../data/core';
import { PROCESSES } from '../data/inventory';

export async function seedProcesses(ctx: SeedContext, state: SeedState): Promise<void> {
  const { uc } = ctx;
  const rid = RESTAURANT.id;
  const bk = 'flagship' as const;
  const branchId = BRANCHES[bk].id;
  const ownerId = state.userIdBySlug['owner'];

  for (const proc of PROCESSES) {
    const created = await uc.createProcess.execute({
      restaurantId: rid,
      branchId,
      name: proc.name,
      processingCostAmount: proc.processingCostAmount,
      note: 'SEED-1 process definition',
      inputs: proc.inputs.map((i) => ({ itemId: state.itemIds[bk][i.item], baseQty: i.baseQty })),
      outputs: proc.outputs.map((o) => ({
        itemId: state.itemIds[bk][o.item],
        baseQty: o.baseQty,
        isPrimary: o.isPrimary,
        costShareBps: o.costShareBps ?? null,
      })),
      actorUserId: ownerId,
    });
    state.processIds[bk][proc.slug] = created.id;
  }

  // Drive one production run (pork marinade ×2) through the ledger.
  await uc.runProcess.execute({
    restaurantId: rid,
    branchId,
    processId: state.processIds[bk]['pork-marinade'],
    multiplier: 2,
    runAt: new Date(),
    note: 'SEED-1 production run',
    actorUserId: ownerId,
  });
}
