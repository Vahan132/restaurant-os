/** DI token for the fiscal-config WRITE/STATUS store (platform-admin managed). */
export const FISCAL_CONFIG_STORE = Symbol('FiscalConfigStore');

export interface UpsertFiscalConfigInput {
  restaurantId: string;
  branchId: string;
  crn: string;
  cashierId: string;
  environment: 'PROD' | 'TEST';
  language: 'hy' | 'en' | 'ru';
  active: boolean;
  /** PEM (converted from .jks by ops before upload). Encrypted at rest; never stored plaintext. */
  clientCertPem: string;
  clientKeyPem: string;
}

export interface FiscalDepartmentInput {
  dep: string;
  taxRegime: string;
  label?: string | null;
}

/**
 * Non-secret status view — STRUCTURALLY has no cert/key/DEK field, so secrets
 * cannot leak through it. The decrypted buffers live ONLY on the internal
 * FiscalConfigPort return type (adapter-facing, never HTTP-serialized).
 */
export interface FiscalConfigStatus {
  restaurantId: string;
  branchId: string;
  crn: string;
  cashierId: string;
  environment: 'PROD' | 'TEST';
  language: string;
  active: boolean;
  departments: { dep: string; taxRegime: string; label: string | null }[];
  lastCheckConnectionAt: Date | null;
  lastCheckConnectionOk: boolean | null;
  updatedAt: Date;
}

export interface FiscalConfigStore {
  upsertConfig(input: UpsertFiscalConfigInput): Promise<void>;
  setDepartments(
    restaurantId: string,
    branchId: string,
    departments: FiscalDepartmentInput[],
  ): Promise<void>;
  getStatus(restaurantId: string, branchId: string): Promise<FiscalConfigStatus | null>;
  recordCheckConnection(restaurantId: string, branchId: string, ok: boolean): Promise<void>;
}
