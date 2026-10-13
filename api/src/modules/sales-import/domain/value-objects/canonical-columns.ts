/**
 * Canonical CSV column schema + TOLERANT header mapping (5A).
 *
 * Pure domain (no framework imports). This is the single source of truth for the
 * documented import schema. Pointing the importer at a differently-named source
 * file later is a SMALL CHANGE HERE (add aliases) — never a rebuild.
 *
 * See `CSV_SCHEMA.md` in this module for the human-readable documentation.
 */

/** The canonical fields the importer understands. */
export type CanonicalColumn =
  | 'occurredAt'
  | 'branch'
  | 'item'
  | 'quantity'
  | 'unitPrice'
  | 'lineTotal'
  | 'paymentMethod'
  | 'externalReference';

/** Columns that MUST be present (after mapping) for the file to be importable. */
export const REQUIRED_COLUMNS: readonly CanonicalColumn[] = [
  'occurredAt',
  'branch',
  'item',
  'quantity',
  'unitPrice',
  'lineTotal',
] as const;

/** Optional columns — absence is fine. */
export const OPTIONAL_COLUMNS: readonly CanonicalColumn[] = [
  'paymentMethod',
  'externalReference',
] as const;

/**
 * Tolerant alias table: NORMALIZED header → canonical column. Headers are
 * normalized with {@link normalizeHeader} before lookup, so casing, spaces,
 * hyphens, and punctuation never matter ("Unit Price", "unit-price",
 * "UNIT_PRICE" all map to `unitPrice`).
 */
export const COLUMN_ALIASES: Readonly<Record<string, CanonicalColumn>> = {
  // occurredAt
  date: 'occurredAt',
  datetime: 'occurredAt',
  date_time: 'occurredAt',
  occurred_at: 'occurredAt',
  occurred: 'occurredAt',
  timestamp: 'occurredAt',
  time: 'occurredAt',
  sold_at: 'occurredAt',
  sale_date: 'occurredAt',
  transaction_date: 'occurredAt',
  // branch
  branch: 'branch',
  branch_name: 'branch',
  branch_id: 'branch',
  location: 'branch',
  store: 'branch',
  outlet: 'branch',
  site: 'branch',
  // item
  item: 'item',
  item_name: 'item',
  item_description: 'item',
  description: 'item',
  product: 'item',
  product_name: 'item',
  menu_item: 'item',
  name: 'item',
  // quantity
  quantity: 'quantity',
  qty: 'quantity',
  units: 'quantity',
  count: 'quantity',
  // unitPrice
  unit_price: 'unitPrice',
  unitprice: 'unitPrice',
  price: 'unitPrice',
  price_each: 'unitPrice',
  unit_cost: 'unitPrice',
  // lineTotal
  total: 'lineTotal',
  line_total: 'lineTotal',
  amount: 'lineTotal',
  total_price: 'lineTotal',
  line_amount: 'lineTotal',
  gross: 'lineTotal',
  // paymentMethod
  payment_method: 'paymentMethod',
  payment: 'paymentMethod',
  payment_type: 'paymentMethod',
  tender: 'paymentMethod',
  tender_type: 'paymentMethod',
  // externalReference
  external_reference: 'externalReference',
  reference: 'externalReference',
  ref: 'externalReference',
  external_id: 'externalReference',
  transaction_id: 'externalReference',
  transaction_ref: 'externalReference',
  receipt_no: 'externalReference',
  receipt_number: 'externalReference',
  order_id: 'externalReference',
};

/**
 * Normalize a raw header for tolerant matching: trim, lowercase, collapse any
 * run of non-alphanumerics into a single underscore, strip leading/trailing
 * underscores. e.g. " Unit  Price (€) " → "unit_price".
 */
export function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Map a raw CSV header to its canonical column, or null if unrecognized. */
export function mapHeader(raw: string): CanonicalColumn | null {
  return COLUMN_ALIASES[normalizeHeader(raw)] ?? null;
}
