import { formatMoney } from '@/lib/money';

/** Humanize an action/entity code: SNAKE_CASE or camelCase -> Title Case. */
export function humanize(code: string): string {
  const spaced = code
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

type Json = Record<string, unknown> | null | undefined;

export interface DiffEntry {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  changed: boolean;
}

/** True for keys that hold integer minor-unit money (formatted with currency). */
export function isAmountKey(key: string): boolean {
  return /(_amount|amount)$/i.test(key);
}

/** Best-effort readable rendering of an audit value, money-aware. */
export function formatAuditValue(key: string, value: unknown, currency: string): string {
  if (value === null || value === undefined) return '—';
  if (isAmountKey(key) && typeof value === 'number' && Number.isFinite(value)) {
    return formatMoney(value, currency);
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Key-by-key diff over the union of keys in old/new. `changed` marks keys whose
 * serialized values differ (covers add/remove/modify).
 */
export function computeDiff(oldVal: Json, newVal: Json): DiffEntry[] {
  const keys = Array.from(
    new Set([...Object.keys(oldVal ?? {}), ...Object.keys(newVal ?? {})]),
  ).sort();
  return keys.map((key) => {
    const o = oldVal?.[key];
    const n = newVal?.[key];
    return { key, oldValue: o, newValue: n, changed: JSON.stringify(o) !== JSON.stringify(n) };
  });
}
