import { Injectable } from '@nestjs/common';

/** A parsed CSV: the header cells + the data records (each a cell array). */
export interface ParsedCsv {
  headers: string[];
  /** Data rows (header excluded), in file order. */
  records: string[][];
}

/**
 * Dependency-free CSV parser (RFC-4180-ish): handles quoted fields, embedded
 * commas, embedded newlines, and escaped quotes (`""`); tolerates CRLF or LF.
 * Kept tiny and portable — no third-party parser dependency. The FIRST non-empty
 * record is the header; fully-blank rows are skipped. Per-row errors are later
 * reported by 1-based DATA-row index (header excluded), which is stable
 * regardless of embedded newlines.
 */
@Injectable()
export class CsvParserService {
  /** Returns null if the text contains no usable (non-empty) rows. */
  parse(text: string): ParsedCsv | null {
    const clean = text.replace(/^﻿/, ''); // strip UTF-8 BOM
    const rows = this.tokenize(clean).filter((cells) => cells.some((c) => c.trim() !== ''));
    if (rows.length === 0) return null;
    const headers = rows[0].map((c) => c.trim());
    return { headers, records: rows.slice(1) };
  }

  /** Tokenize the whole text into rows of raw cell strings. */
  private tokenize(text: string): string[][] {
    const rows: string[][] = [];
    let cells: string[] = [];
    let field = '';
    let inQuotes = false;

    const endField = (): void => {
      cells.push(field);
      field = '';
    };
    const endRow = (): void => {
      endField();
      rows.push(cells);
      cells = [];
    };

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
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
      switch (ch) {
        case '"':
          inQuotes = true;
          break;
        case ',':
          endField();
          break;
        case '\r':
          if (text[i + 1] === '\n') i++;
          endRow();
          break;
        case '\n':
          endRow();
          break;
        default:
          field += ch;
      }
    }
    // flush trailing field/row when the file has no terminating newline
    if (field !== '' || cells.length > 0) endRow();
    return rows;
  }
}
