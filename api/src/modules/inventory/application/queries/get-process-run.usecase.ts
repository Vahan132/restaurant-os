import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ProcessRun } from '../../domain/entities/process-run';
import {
  PROCESS_RUN_REPOSITORY,
  ProcessRunRepository,
} from '../../domain/repositories/process-run.repository';
import {
  PROCESS_RUN_DETAIL_READER,
  ProcessRunDetail,
  ProcessRunDetailReader,
} from '../ports/process-run-detail.reader';
import { NoRestaurantInScope, ProcessRunNotFound } from '../application.errors';

export interface GetProcessRunInput {
  restaurantId: string | null;
  branchId: string;
  runId: string;
}

export interface ProcessRunWithDetail {
  run: ProcessRun;
  detail: ProcessRunDetail;
}

/** Fetch a run with its consumed/produced movements + produced layers. */
@Injectable()
export class GetProcessRunUseCase implements UseCase<GetProcessRunInput, ProcessRunWithDetail> {
  constructor(
    @Inject(PROCESS_RUN_REPOSITORY) private readonly runs: ProcessRunRepository,
    @Inject(PROCESS_RUN_DETAIL_READER) private readonly reader: ProcessRunDetailReader,
  ) {}

  async execute(input: GetProcessRunInput): Promise<ProcessRunWithDetail> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const run = await this.runs.findById(input.restaurantId, input.branchId, input.runId);
    if (!run) {
      throw ProcessRunNotFound();
    }
    const detail = await this.reader.detail(input.restaurantId, input.branchId, input.runId);
    return { run, detail };
  }
}
