import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ProcessDeletedEvent } from '../../domain/events/inventory-events';
import {
  PROCESS_REPOSITORY,
  ProcessRepository,
} from '../../domain/repositories/process.repository';
import { NoRestaurantInScope, ProcessNotFound } from '../application.errors';

export interface DeleteProcessInput {
  restaurantId: string | null;
  branchId: string;
  processId: string;
  actorUserId: string;
}

/** Soft-delete a process definition. Past runs and produced stock are unaffected. */
@Injectable()
export class DeleteProcessUseCase implements UseCase<DeleteProcessInput, void> {
  constructor(
    @Inject(PROCESS_REPOSITORY) private readonly processes: ProcessRepository,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: DeleteProcessInput): Promise<void> {
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
    process.softDelete();
    await this.processes.update(process);
    await this.events.publish(
      new ProcessDeletedEvent(process.id, process.restaurantId, input.actorUserId),
    );
  }
}
