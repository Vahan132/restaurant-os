import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Plan, PlanFeatures, PlanInterval } from '../../domain/entities/plan';
import { PLAN_REPOSITORY, PlanRepository } from '../../domain/repositories/plan.repository';
import { PlanNotFound } from '../application.errors';

export interface UpdatePlanInput {
  planId: string;
  name?: string;
  priceAmount?: number;
  currency?: string;
  interval?: PlanInterval;
  features?: PlanFeatures;
}

/** Update a plan's mutable fields (price validated as non-negative integer). */
@Injectable()
export class UpdatePlanUseCase implements UseCase<UpdatePlanInput, Plan> {
  constructor(@Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository) {}

  async execute(input: UpdatePlanInput): Promise<Plan> {
    const plan = await this.plans.findById(input.planId);
    if (!plan) {
      throw PlanNotFound();
    }
    plan.update({
      name: input.name,
      priceAmount: input.priceAmount,
      currency: input.currency,
      interval: input.interval,
      features: input.features,
    });
    await this.plans.update(plan);
    return plan;
  }
}
