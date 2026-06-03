import { Plan as PrismaPlan } from '@prisma/client';
import { Plan, PlanFeatures, PlanInterval } from '../../domain/entities/plan';

export class PlanMapper {
  static toDomain(record: PrismaPlan): Plan {
    return Plan.reconstitute(record.id, {
      code: record.code,
      name: record.name,
      priceAmount: record.priceAmount,
      currency: record.currency,
      interval: record.interval as PlanInterval,
      features: record.features as unknown as PlanFeatures,
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toCreate(plan: Plan) {
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      priceAmount: plan.priceAmount,
      currency: plan.currency,
      interval: plan.interval as PlanInterval,
      features: plan.features as unknown as object,
      isActive: plan.isActive,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }

  static toUpdate(plan: Plan) {
    return {
      name: plan.name,
      priceAmount: plan.priceAmount,
      currency: plan.currency,
      interval: plan.interval as PlanInterval,
      features: plan.features as unknown as object,
      isActive: plan.isActive,
      updatedAt: plan.updatedAt,
    };
  }
}
