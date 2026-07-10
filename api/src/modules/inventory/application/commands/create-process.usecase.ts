import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { Process } from '../../domain/entities/process';
import {
  PROCESS_REPOSITORY,
  ProcessRepository,
} from '../../domain/repositories/process.repository';
import { NoRestaurantInScope } from '../application.errors';
import {
  ProcessDefinitionAssembler,
  RawInput,
  RawOutput,
} from '../services/process-definition.assembler';
import { ProcessGraphCycleChecker } from '../services/process-graph-cycle.checker';

export interface CreateProcessInput {
  restaurantId: string | null;
  branchId: string;
  name: string;
  processingCostAmount?: number;
  note?: string | null;
  inputs: RawInput[];
  outputs: RawOutput[];
  actorUserId: string;
}

/** Create a process definition (validates items, kinds, and allocation shape). */
@Injectable()
export class CreateProcessUseCase implements UseCase<CreateProcessInput, Process> {
  constructor(
    @Inject(PROCESS_REPOSITORY) private readonly processes: ProcessRepository,
    private readonly assembler: ProcessDefinitionAssembler,
    private readonly cycleChecker: ProcessGraphCycleChecker,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: CreateProcessInput): Promise<Process> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const { inputs, outputs } = await this.assembler.build(
      input.restaurantId,
      input.branchId,
      input.inputs,
      input.outputs,
    );
    await this.cycleChecker.assertAcyclic({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      processId: null,
      processName: input.name,
      inputItemIds: inputs.map((i) => i.itemId),
      outputItemIds: outputs.map((o) => o.itemId),
    });
    const process = Process.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      name: input.name,
      processingCostAmount: input.processingCostAmount,
      note: input.note ?? null,
      inputs,
      outputs,
      actorUserId: input.actorUserId,
    });
    await this.processes.create(process);
    await this.events.publishFromAggregate(process);
    return process;
  }
}
