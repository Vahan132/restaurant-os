/** DI token for the per-branch fiscal print-mode reader (FISCAL-EDGE-3). */
export const FISCAL_PRINT_MODE_READER = Symbol('FiscalPrintModeReader');

/** Per-branch dine-in fiscalize behaviour. */
export type FiscalPrintMode = 'AUTO' | 'MANUAL';

/**
 * Lightweight, NON-THROWING read of a branch's dine-in fiscalize mode. Distinct
 * from FISCAL_CONFIG_PORT.getConfig (which decrypts secrets and FAILS CLOSED):
 * this reads a single non-secret scalar and returns `null` when the branch has no
 * ACTIVE fiscal config — the signal for the dine-in trigger to leave the order's
 * fiscal state COMPLETELY UNTOUCHED (never marked FAILED on a non-fiscal branch).
 */
export interface FiscalPrintModeReader {
  /**
   * The branch's print mode when an ACTIVE fiscal config exists; `null` when there
   * is no row or it is inactive (⇒ skip fiscalization entirely).
   */
  getPrintMode(restaurantId: string, branchId: string): Promise<FiscalPrintMode | null>;
}
