import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Plan } from '../../domain/entities/plan';
import { PLAN_REPOSITORY, PlanRepository } from '../../domain/repositories/plan.repository';
import { PlanNotFound } from '../application.errors';

/** Deactivate a plan (no longer offered; existing subscriptions keep working). */
@Injectable()
export class DeactivatePlanUseCase implements UseCase<{ planId: string }, Plan> {
  constructor(@Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository) {}

  async execute(input: { planId: string }): Promise<Plan> {
    const plan = await this.plans.findById(input.planId);
    if (!plan) {
      throw PlanNotFound();
    }
    plan.deactivate();
    await this.plans.update(plan);
    return plan;
  }
}
