/** DI token for the fiscal-config WRITE/STATUS store (platform-admin managed). */
export const FISCAL_CONFIG_STORE = Symbol('FiscalConfigStore');

/** Config scalars only — cert is a SEPARATE action (see setCert). */
export interface UpsertFiscalConfigInput {
  restaurantId: string;
  branchId: string;
  crn: string;
  cashierId: string;
  environment: 'PROD' | 'TEST';
  language: 'hy' | 'en' | 'ru';
  active: boolean;
}

/** Cert upload — its own write. PEM (converted from .jks by ops). Encrypted at rest. */
export interface SetFiscalCertInput {
  restaurantId: string;
  branchId: string;
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
 * cannot leak through it. `certConfigured` reflects only WHETHER a cert is set,
 * never its bytes.
 */
export interface FiscalConfigStatus {
  restaurantId: string;
  branchId: string;
  crn: string;
  cashierId: string;
  environment: 'PROD' | 'TEST';
  language: string;
  active: boolean;
  /** True once a cert/key has been uploaded (never exposes the material). */
  certConfigured: boolean;
  departments: { dep: string; taxRegime: string; label: string | null }[];
  lastCheckConnectionAt: Date | null;
  lastCheckConnectionOk: boolean | null;
  updatedAt: Date;
}

export interface FiscalConfigStore {
  /** Create/replace the config scalars (does NOT touch the cert). */
  upsertConfig(input: UpsertFiscalConfigInput): Promise<void>;
  /** Upload/replace the cert (row must already exist). */
  setCert(input: SetFiscalCertInput): Promise<void>;
  setDepartments(
    restaurantId: string,
    branchId: string,
    departments: FiscalDepartmentInput[],
  ): Promise<void>;
  getStatus(restaurantId: string, branchId: string): Promise<FiscalConfigStatus | null>;
  recordCheckConnection(restaurantId: string, branchId: string, ok: boolean): Promise<void>;
}
