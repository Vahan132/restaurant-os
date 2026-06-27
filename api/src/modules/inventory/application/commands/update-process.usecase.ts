import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Process } from '../../domain/entities/process';
import {
  PROCESS_REPOSITORY,
  ProcessRepository,
} from '../../domain/repositories/process.repository';
import { NoRestaurantInScope, ProcessNotFound } from '../application.errors';
import {
  ProcessDefinitionAssembler,
  RawInput,
  RawOutput,
} from '../services/process-definition.assembler';

export interface UpdateProcessInput {
  restaurantId: string | null;
  branchId: string;
  processId: string;
  name?: string;
  processingCostAmount?: number;
  note?: string | null;
  inputs?: RawInput[];
  outputs?: RawOutput[];
}

/**
 * Update a process definition. Inputs/outputs are FULLY replaced when provided
 * (re-validates items, kinds, and allocation shape).
 */
@Injectable()
export class UpdateProcessUseCase implements UseCase<UpdateProcessInput, Process> {
  constructor(
    @Inject(PROCESS_REPOSITORY) private readonly processes: ProcessRepository,
    private readonly assembler: ProcessDefinitionAssembler,
  ) {}

  async execute(input: UpdateProcessInput): Promise<Process> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const process = await this.processes.findById(
      input.restaurantId,
      input.branchId,
      input.processId,
    );
    if (!process) {
      throw ProcessNotFound();
    }

    // Only rebuild children when the caller provided a replacement array.
    const rebuilt =
      input.inputs !== undefined || input.outputs !== undefined
        ? await this.assembler.build(
            input.restaurantId,
            input.branchId,
            input.inputs ?? process.inputs.map((i) => ({ itemId: i.itemId, baseQty: i.baseQty })),
            input.outputs ??
              process.outputs.map((o) => ({
                itemId: o.itemId,
                baseQty: o.baseQty,
                isPrimary: o.isPrimary,
                costShareBps: o.costShareBps,
              })),
          )
        : null;

    process.update({
      name: input.name,
      processingCostAmount: input.processingCostAmount,
      note: input.note,
      inputs: rebuilt?.inputs,
      outputs: rebuilt?.outputs,
    });
    await this.processes.update(process);
    return process;
  }
}
