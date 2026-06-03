import { Plan } from '../entities/plan';

export const PLAN_REPOSITORY = Symbol('PlanRepository');

export interface PlanRepository {
  list(includeInactive: boolean): Promise<Plan[]>;
  findById(id: string): Promise<Plan | null>;
  findByCode(code: string): Promise<Plan | null>;
  existsByCode(code: string): Promise<boolean>;
  create(plan: Plan): Promise<void>;
  update(plan: Plan): Promise<void>;
}
