import { CatalogImportInvalidCsv } from '../catalog.errors';

/**
 * Dependency-free CSV parsing for the platform catalog bulk import.
 *
 * The repo has no CSV library as a direct dependency (the tenant importer takes an
 * already-parsed bundle, not raw CSV), so we parse here with a small quote-aware
 * splitter rather than add a package. Header mapping is tolerant: case-insensitive,
 * trimmed, and alias-collapsing (`nameHy` / `name_hy` / `name hy` all match).
 */

/**
 * Canonical column keys we understand (unknown columns are ignored). A legacy
 * `adgcode` column is no longer part of the contract (ADGCODE-CLEANUP-1); since
 * unknown headers are ignored, files that still carry it import unchanged.
 */
export const KNOWN_COLUMNS = [
  'slug',
  'namehy',
  'nameru',
  'nameen',
  'category',
  'status',
] as const;

const REQUIRED_HEADERS = ['slug', 'namehy', 'nameru', 'nameen'] as const;

/** A single data row: its 1-based source line + cell values keyed by canonical header. */
export interface ParsedCsvRow {
  line: number;
  cells: Record<string, string>;
}

interface RawRow {
  line: number;
  cells: string[];
}

/** Collapse a header to a canonical key: lowercase, strip all non-alphanumerics. */
function canonical(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Split raw CSV text into rows of string cells, tracking the 1-based source line
 * each row starts on. Quote-aware (RFC-4180 style): fields may be double-quoted,
 * `""` is an escaped quote, and quoted fields may contain commas / newlines.
 * Fully-empty rows are skipped (but still advance the line counter).
 */
function splitCsv(text: string): RawRow[] {
  const out: RawRow[] = [];
  let field = '';
  let cells: string[] = [];
  let inQuotes = false;
  let line = 1;
  let rowStart = 1;
  let rowStarted = false;

  const endField = (): void => {
    cells.push(field);
    field = '';
  };
  const endRow = (): void => {
    endField();
    if (cells.some((c) => c.trim() !== '')) {
      out.push({ line: rowStart, cells });
    }
    cells = [];
    rowStarted = false;
  };

  let i = 0;
  if (text.charCodeAt(0) === 0xfeff) {
    i = 1; // strip BOM
  }

  for (; i < text.length; i++) {
    const c = text[i];
    if (!rowStarted && !inQuotes) {
      rowStart = line;
    }
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (c === '\n') {
          line++;
        }
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      rowStarted = true;
    } else if (c === ',') {
      endField();
      rowStarted = true;
    } else if (c === '\n') {
      line++;
      endRow();
    } else if (c === '\r') {
      // ignore; newline handling keys off \n
    } else {
      field += c;
      if (c.trim() !== '') {
        rowStarted = true;
      }
    }
  }
  if (field !== '' || cells.length > 0 || rowStarted) {
    endRow();
  }
  return out;
}

/**
 * Parse the CSV into typed data rows. Throws `CATALOG_IMPORT_INVALID_CSV` when the
 * file is empty or a required header (`slug`, `nameHy`, `nameRu`, `nameEn`) is
 * missing. A header-only file parses to zero rows (a valid no-op import).
 */
export function parseCatalogCsv(csv: string): ParsedCsvRow[] {
  const rows = splitCsv(csv);
  if (rows.length === 0) {
    throw CatalogImportInvalidCsv('The CSV file is empty.');
  }

  const header = rows[0].cells.map(canonical);
  const headerIndex = new Map<string, number>();
  header.forEach((key, idx) => {
    if (key !== '' && !headerIndex.has(key)) {
      headerIndex.set(key, idx);
    }
  });

  const missing = REQUIRED_HEADERS.filter((h) => !headerIndex.has(h));
  if (missing.length > 0) {
    throw CatalogImportInvalidCsv(`Missing required column(s): ${missing.join(', ')}.`);
  }

  return rows.slice(1).map((raw) => {
    const cells: Record<string, string> = {};
    for (const col of KNOWN_COLUMNS) {
      const idx = headerIndex.get(col);
      cells[col] = idx === undefined ? '' : (raw.cells[idx] ?? '');
    }
    return { line: raw.line, cells };
  });
}
