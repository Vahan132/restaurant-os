import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { Plan, PlanFeatures, PlanInterval } from '../../domain/entities/plan';
import { PLAN_REPOSITORY, PlanRepository } from '../../domain/repositories/plan.repository';
import { PlanCodeAlreadyExists } from '../application.errors';

export interface CreatePlanInput {
  code: string;
  name: string;
  priceAmount: number;
  currency: string;
  interval: PlanInterval;
  features: PlanFeatures;
}

/** Create a subscription plan (price in integer minor units). */
@Injectable()
export class CreatePlanUseCase implements UseCase<CreatePlanInput, Plan> {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreatePlanInput): Promise<Plan> {
    const code = input.code.trim();
    if (await this.plans.existsByCode(code)) {
      throw PlanCodeAlreadyExists();
    }
    const plan = Plan.create({
      id: this.ids.generate(),
      code,
      name: input.name,
      priceAmount: input.priceAmount,
      currency: input.currency,
      interval: input.interval,
      features: input.features,
    });
    await this.plans.create(plan);
    return plan;
  }
}
