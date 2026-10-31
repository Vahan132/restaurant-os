/** DI token for the FiscalConfigPort (FISCAL-1, decision D). */
export const FISCAL_CONFIG_PORT = Symbol('FiscalConfigPort');

export type FiscalEnvironment = 'PROD' | 'TEST';
export type FiscalLanguage = 'hy' | 'en' | 'ru';

/**
 * Per-(restaurant,branch) SRC e-HDM configuration the adapter needs to talk to
 * the tax service. SECRETS (client cert/key) are PEM buffers/strings converted
 * from the tenant's `.jks` by ops (keytool/openssl) — the adapter consumes PEM,
 * never parses `.jks`. Backed by an env/file adapter now; FISCAL-4 swaps in a DB
 * + secret store + admin UI without touching call sites.
 */
export interface TenantFiscalConfig {
  /** SRC company registration number; MUST match the client cert's CRN. */
  crn: string;
  /** Virtual cashier id for this branch (SRC `cashierId`). */
  cashierId: string;
  environment: FiscalEnvironment;
  /** Resolved SRC root URL for `environment` (prod vs test 10.3.14.123:447). */
  baseUrl: string;
  /** Client certificate (PEM). */
  clientCert: string | Buffer;
  /** Client private key (PEM). */
  clientKey: string | Buffer;
  /** SRC CA root (PEM) to trust — TLS verification is NEVER disabled. */
  caRoot: string | Buffer;
  language: FiscalLanguage;
  /**
   * Reserved fiscal department mapping (`dep`). `dep` is deferred to fiscal-config
   * (FISCAL-0 kept it null), so this may be empty; wired in a later prompt.
   */
  departmentMap: Record<string, string>;
  /**
   * FISCAL-EDGE-1: OPTIONAL physical-HDM device for this branch (1:1). Present
   * only when a device is configured. `devicePassword` is decrypted IN-PROCESS
   * for the future physical adapter — it is NEVER returned on any HTTP read model
   * or logged. Absent (undefined) for e-HDM-only branches.
   */
  device?: FiscalDeviceConfig;
}

/**
 * HDM-TM-1: decrypted physical-HDM device config (hub-side only, never on an HTTP
 * read model). Resolvable WITHOUT an e-HDM cert — a branch that only has a
 * physical TouchMaster HDM has no SRC web-service certificate at all.
 */
export interface FiscalDeviceConfig {
  host: string;
  port: number;
  /** Integration password set on the HDM ("ՀԴՄ գաղտնաբառ"). */
  password: string;
  /** HDM operator code for login (fn 2); null when not yet configured. */
  cashierId: number | null;
  /** Operator PIN; null when not yet configured. */
  pin: string | null;
  /** Cards on a separate bank terminal (true) vs the HDM's own card app (false). */
  useExtPos: boolean;
}

export interface FiscalConfigPort {
  /**
   * Resolve the e-HDM config for a branch. Throws FatalFiscalError when the tenant
   * is not provisioned (a fatal-config stop — QR/APP fiscalization fails closed
   * until secrets are in place), never a retryable error.
   */
  getConfig(restaurantId: string, branchId: string): Promise<TenantFiscalConfig>;

  /**
   * HDM-TM-1: resolve ONLY the physical-device config (no e-HDM cert required).
   * Throws FatalFiscalError DEVICE_NOT_CONFIGURED when absent/inactive.
   */
  getDeviceConfig(restaurantId: string, branchId: string): Promise<FiscalDeviceConfig>;
}
