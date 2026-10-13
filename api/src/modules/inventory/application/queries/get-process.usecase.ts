import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Process } from '../../domain/entities/process';
import {
  PROCESS_REPOSITORY,
  ProcessRepository,
} from '../../domain/repositories/process.repository';
import { NoRestaurantInScope, ProcessNotFound } from '../application.errors';

export interface GetProcessInput {
  restaurantId: string | null;
  branchId: string;
  processId: string;
}

@Injectable()
export class GetProcessUseCase implements UseCase<GetProcessInput, Process> {
  constructor(@Inject(PROCESS_REPOSITORY) private readonly processes: ProcessRepository) {}

  async execute(input: GetProcessInput): Promise<Process> {
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
    return process;
  }
}
