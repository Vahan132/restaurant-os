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
