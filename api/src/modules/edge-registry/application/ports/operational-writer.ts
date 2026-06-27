import { PushEntry, PushResult } from '../../../../shared/edge/contracts/operational.contract';

export const OPERATIONAL_WRITER = Symbol('OperationalWriter');

/**
 * OPERATIONAL_WRITER — applies a pushed batch of operational outbox entries to
 * the cloud, idempotently, scoped to the node's branch. Implementations upsert
 * by id and reject any entry that does not belong to `branchId`.
 */
export interface OperationalWriter {
  apply(branchId: string, entries: PushEntry[]): Promise<PushResult>;
}
