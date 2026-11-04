export const FISCAL_DEPARTMENT_READER = Symbol('MenuFiscalDepartmentReader');

/**
 * FISCAL-DEPT-1: reads the set of fiscal department codes registered for a branch
 * (its FiscalConfig.departments[].dep), so the menu module can validate a dish's
 * assigned `dep` against the branch it belongs to WITHOUT importing the fiscal
 * domain. Branch-scoped. Implemented in infrastructure via Prisma.
 *
 * NOTE: this is deliberately independent of whether the branch is fiscal-ACTIVE.
 * Assignment validation only asks "does this dep exist for the branch?"; the
 * active-vs-not gate lives at fiscalize time (fail-closed for active branches,
 * ignored otherwise).
 */
export interface FiscalDepartmentReader {
  /**
   * The branch's registered dep codes (empty when the branch has no fiscal config
   * or no departments). An assignable `dep` must be a member of this set.
   */
  listDeps(restaurantId: string, branchId: string): Promise<string[]>;
}
