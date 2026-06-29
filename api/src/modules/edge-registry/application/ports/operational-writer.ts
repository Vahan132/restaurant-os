import { PushEntry, PushResult } from '../../../../shared/edge/contracts/operational.contract';

export const OPERATIONAL_WRITER = Symbol('OperationalWriter');

/**
 * OPERATIONAL_WRITER — applies a pushed batch of operational outbox entries to
 * the cloud, idempotently, scoped to the node's branch. Implementations upsert
 * by id and reject any entry that does not belong to `branchId` (or, for
 * restaurant-scoped aggregates like STAFF_PIN_AUTH, `restaurantId`).
 */
export interface OperationalWriter {
  apply(branchId: string, restaurantId: string, entries: PushEntry[]): Promise<PushResult>;
}
