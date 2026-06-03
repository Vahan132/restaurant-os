import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Plan } from '../../domain/entities/plan';
import { PLAN_REPOSITORY, PlanRepository } from '../../domain/repositories/plan.repository';

/** List plans (optionally including inactive ones). */
@Injectable()
export class ListPlansUseCase implements UseCase<{ includeInactive?: boolean }, Plan[]> {
  constructor(@Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository) {}

  execute(input: { includeInactive?: boolean }): Promise<Plan[]> {
    return this.plans.list(input.includeInactive ?? false);
  }
}
