export const TENANT_FISCAL_DEPARTMENT_READER = Symbol('TenantFiscalDepartmentReader');

/** A single non-secret fiscal department entry for the tenant-facing read. */
export interface TenantFiscalDepartmentView {
  dep: string;
  label: string | null;
  taxRegime: string;
}

export interface BranchFiscalDepartments {
  /** Whether the branch's fiscal config is active (false when unconfigured). */
  fiscalActive: boolean;
  /** Non-secret department list; empty when the branch has none registered. */
  departments: TenantFiscalDepartmentView[];
}

/**
 * FISCAL-DEPT-3A: tenant-facing, NON-SECRET read of a branch's fiscal departments
 * for the restaurant-admin menu editor. Deliberately narrow — the implementation
 * must NEVER select or return cert/key material, device host/port/password, CRN,
 * cashier id, or any envelope-encrypted field. Only dep/label/taxRegime + the
 * active flag. Distinct from the platform-admin status read.
 */
export interface TenantFiscalDepartmentReader {
  getBranchDepartments(restaurantId: string, branchId: string): Promise<BranchFiscalDepartments>;
}
