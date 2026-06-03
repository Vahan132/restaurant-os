export const PLAN_LIMITS_READER = Symbol('PlanLimitsReader');

/** Reads the acting organization's plan limits (from its subscription's plan). */
export interface PlanLimitsReader {
  /** Max branches per restaurant allowed by the org's plan, or null if unknown. */
  maxBranchesPerRestaurant(organizationId: string): Promise<number | null>;
}
