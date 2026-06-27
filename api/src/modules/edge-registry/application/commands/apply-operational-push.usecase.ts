import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { PushEntry, PushResult } from '../../../../shared/edge/contracts/operational.contract';
import { OPERATIONAL_WRITER, OperationalWriter } from '../ports/operational-writer';

export interface ApplyOperationalPushInput {
  branchId: string;
  entries: PushEntry[];
}

/**
 * Apply a pushed operational batch to the cloud, idempotently and scoped to the
 * node's branch (the branch comes from the authenticated node, never the body).
 */
@Injectable()
export class ApplyOperationalPushUseCase
  implements UseCase<ApplyOperationalPushInput, PushResult>
{
  constructor(@Inject(OPERATIONAL_WRITER) private readonly writer: OperationalWriter) {}

  async execute(input: ApplyOperationalPushInput): Promise<PushResult> {
    if (input.entries.length === 0) {
      return { appliedIds: [], lastAppliedSeq: null };
    }
    return this.writer.apply(input.branchId, input.entries);
  }
}
