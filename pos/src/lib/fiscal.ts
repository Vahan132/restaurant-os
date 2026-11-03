/**
 * Fiscal error-code classification shared by the POS fiscal UI.
 *
 * The backend preserves a fatal SRC code on `order.fiscalError` when
 * `fiscalStatus === 'FAILED'`. Codes 155/156 are the special "device needs
 * sync" case — a FAILED an operator can't fix from the POS right now, but that
 * may succeed once the device is synced. Everything else is a generic fatal.
 */
export const DEVICE_SYNC_CODES = new Set(['155', '156']);

/** True when the fatal code means "device needs sync" (155/156). */
export function isDeviceSyncCode(code?: string | null): boolean {
  return code != null && DEVICE_SYNC_CODES.has(code.trim());
}

/**
 * HDM-EDGE-3: codes with a specific, fixable cause — shown instead of the generic
 * "device rejected" text. 192 / DEP_REQUIRED are raised by OUR pre-flight check
 * (nothing was sent to the device); 151/152 come from the HDM itself.
 */
export const FISCAL_HINT_CODES = new Set(['192', 'DEP_REQUIRED', '151', '152']);

/** i18n key under `fiscal.hint` for a known code, else null. */
export function fiscalHintKey(code?: string | null): string | null {
  const c = code?.trim();
  return c && FISCAL_HINT_CODES.has(c) ? `hint.${c}` : null;
}

