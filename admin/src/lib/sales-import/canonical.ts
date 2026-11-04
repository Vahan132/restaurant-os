/**
 * Canonical sales-CSV schema + client-side CSV helpers (5B).
 *
 * The backend performs tolerant column mapping, but the Admin upload flow gives
 * the user an explicit mapping step when a file's headers don't match this
 * canonical schema. When they do match we submit the file verbatim; when they
 * don't we rewrite the CSV with canonical headers (in canonical order) using
 * the user's chosen mapping before upload, so the backend always receives a
 * file it understands.
 */

export interface CanonicalField {
  key: string;
  required: boolean;
  /** Normalized header names that auto-map to this field (best-guess). */
  aliases: string[];
}

/**
 * Canonical columns for an external/historical sales row. Mirrors what the
 * imported analytics expose (date bucket, item, quantity, line revenue, and an
 * optional payment method). Amounts are line totals in the file's own units;
 * the backend normalizes them (NON-FISCAL, reports-only).
 */
export const CANONICAL_FIELDS: CanonicalField[] = [
  { key: 'date', required: true, aliases: ['date', 'saledate', 'datetime', 'day', 'timestamp', 'time'] },
  {
    key: 'itemDescription',
    required: true,
    aliases: ['itemdescription', 'item', 'description', 'product', 'productname', 'name', 'menuitem'],
  },
  { key: 'quantity', required: true, aliases: ['quantity', 'qty', 'count', 'units', 'qtysold'] },
  {
    key: 'amount',
    required: true,
    aliases: ['amount', 'total', 'revenue', 'linetotal', 'price', 'sum', 'grosssales', 'sales'],
  },
  {
    key: 'paymentMethod',
    required: false,
    aliases: ['paymentmethod', 'payment', 'method', 'tender', 'paytype'],
  },
];

export const CANONICAL_KEYS = CANONICAL_FIELDS.map((f) => f.key);
export const REQUIRED_KEYS = CANONICAL_FIELDS.filter((f) => f.required).map((f) => f.key);

/** A mapping from canonical field key -> source column index (or null). */
export type ColumnMapping = Record<string, number | null>;

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

/** Lowercase + strip everything but a–z0–9 for tolerant header comparison. */
export function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Minimal RFC-4180-ish CSV parser. Handles quoted fields, escaped quotes
 * (""), commas and newlines inside quotes, and CRLF line endings. Good enough
 * for the upload preview; the backend remains the source of truth on parsing.
 */
export function parseCsv(text: string): ParsedCsv {
  const stripped = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // BOM
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i];
    if (inQuotes) {
      if (ch === '"') {
        if (stripped[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      record.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && stripped[i + 1] === '\n') i++;
      record.push(field);
      records.push(record);
      field = '';
      record = [];
    } else {
      field += ch;
    }
  }
  // Trailing field/record (file not ending in newline).
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  // Drop blank trailing lines.
  const nonEmpty = records.filter((r) => r.some((c) => c.trim() !== ''));
  const headerRow = nonEmpty[0];
  if (!headerRow) return { headers: [], rows: [] };
  return { headers: headerRow.map((h) => h.trim()), rows: nonEmpty.slice(1) };
}

/**
 * Best-guess mapping of canonical fields to source columns. A field maps to the
 * first header whose normalized name equals the field key or one of its
 * aliases. Unmatched fields are null.
 */
export function autoDetectMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const used = new Set<number>();
  const mapping: ColumnMapping = {};
  for (const field of CANONICAL_FIELDS) {
    const candidates = [normalizeHeader(field.key), ...field.aliases];
    let found: number | null = null;
    for (const cand of candidates) {
      const idx = normalized.findIndex((h, i) => !used.has(i) && h === cand);
      if (idx !== -1) {
        found = idx;
        used.add(idx);
        break;
      }
    }
    mapping[field.key] = found;
  }
  return mapping;
}

/**
 * True when the file's headers already match the canonical schema: every
 * required canonical field is present by its own (normalized) key name. In that
 * case we can submit the file verbatim.
 */
export function headersMatchCanonical(headers: string[]): boolean {
  const set = new Set(headers.map(normalizeHeader));
  return REQUIRED_KEYS.every((k) => set.has(normalizeHeader(k)));
}

/** All required canonical fields are assigned a source column. */
export function isMappingComplete(mapping: ColumnMapping): boolean {
  return REQUIRED_KEYS.every((k) => mapping[k] != null);
}

function escapeCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Rewrite parsed rows into a canonical-header CSV using the chosen mapping.
 * Columns are emitted in canonical order; unmapped optional fields are blank.
 */
export function buildCanonicalCsv(parsed: ParsedCsv, mapping: ColumnMapping): string {
  const keys = CANONICAL_KEYS.filter((k) => REQUIRED_KEYS.includes(k) || mapping[k] != null);
  const header = keys.map(escapeCell).join(',');
  const body = parsed.rows.map((row) =>
    keys
      .map((k) => {
        const idx = mapping[k];
        return escapeCell(idx == null ? '' : (row[idx] ?? '').trim());
      })
      .join(','),
  );
  // BOM so Excel reads UTF-8 (Armenian/Russian item names) correctly.
  return '﻿' + [header, ...body].join('\n');
}

/** Wrap CSV text as a File suitable for the multipart upload. */
export function csvTextToFile(text: string, fileName: string): File {
  const name = fileName.toLowerCase().endsWith('.csv') ? fileName : `${fileName}.csv`;
  return new File([text], name, { type: 'text/csv' });
}
