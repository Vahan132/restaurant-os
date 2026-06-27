import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { MissedCall } from '../../domain/entities/missed-call';
import {
  MISSED_CALL_REPOSITORY,
  MissedCallRepository,
} from '../../domain/repositories/missed-call.repository';

export interface IngestMissedCallItem {
  phoneNumber: string;
  occurredAt: Date;
  callerName?: string | null;
}

export interface IngestMissedCallsInput {
  restaurantId: string;
  /** Owning branch — comes from the registered device (DeviceTokenGuard). TODO(BR-7). */
  branchId: string;
  deviceId: string;
  calls: IngestMissedCallItem[];
}

export interface IngestMissedCallsResult {
  received: number;
  created: number;
  duplicates: number;
}

/** Rounding granularity for the dedupe window (occurredAt floored to the minute). */
const DEDUPE_BUCKET_MS = 60_000;

/**
 * Compute a stable dedupe key for a call: the same device reporting the same
 * number at (approximately) the same minute resolves to the same key, so retries
 * and overlapping batches are idempotent.
 */
export function computeDedupeKey(deviceId: string, phoneNumber: string, occurredAt: Date): string {
  const bucket = Math.floor(occurredAt.getTime() / DEDUPE_BUCKET_MS);
  return createHash('sha256').update(`${deviceId}|${phoneNumber}|${bucket}`).digest('hex');
}

/**
 * Ingest a batch of missed calls from an authenticated device. Tenant comes from
 * the device (never the body). Each call is upserted idempotently on
 * (restaurantId, dedupeKey); newly-created calls become status NEW and emit a
 * `missed_call.created` event (relayed to clients as `missedcall.new`). Recording
 * is allowed regardless of the enableReservations toggle.
 */
@Injectable()
export class IngestMissedCallsUseCase implements UseCase<
  IngestMissedCallsInput,
  IngestMissedCallsResult
> {
  constructor(
    @Inject(MISSED_CALL_REPOSITORY) private readonly missedCalls: MissedCallRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: IngestMissedCallsInput): Promise<IngestMissedCallsResult> {
    let created = 0;
    for (const item of input.calls) {
      const dedupeKey = computeDedupeKey(input.deviceId, item.phoneNumber, item.occurredAt);
      const call = MissedCall.create({
        id: this.ids.generate(),
        restaurantId: input.restaurantId,
        branchId: input.branchId,
        deviceId: input.deviceId,
        phoneNumber: item.phoneNumber,
        callerName: item.callerName ?? null,
        occurredAt: item.occurredAt,
        dedupeKey,
      });
      const inserted = await this.missedCalls.insertIfNew(call);
      if (inserted) {
        created += 1;
        await this.events.publishFromAggregate(call);
      } else {
        call.clearDomainEvents();
      }
    }
    return {
      received: input.calls.length,
      created,
      duplicates: input.calls.length - created,
    };
  }
}
