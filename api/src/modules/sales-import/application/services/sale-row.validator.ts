import { Injectable } from '@nestjs/common';
import { CanonicalColumn } from '../../domain/value-objects/canonical-columns';
import { parseMoneyToMinor, parseOccurredAt, parseQuantity } from './row-parsing';

/** canonical column → its 0-based index in each record's cell array. */
export type ColumnIndex = Partial<Record<CanonicalColumn, number>>;

/** A row that passed field-level validation (branch still a raw string). */
export interface ParsedRow {
  occurredAt: Date;
  rawBranch: string;
  itemDescription: string;
  quantity: number;
  unitPriceAmount: number;
  lineTotalAmount: number;
  paymentMethod: string | null;
  externalReference: string | null;
}

export type RowOutcome = { ok: true; row: ParsedRow } | { ok: false; reason: string };

@Injectable()
export class SaleRowValidator {
  /**
   * Validate + parse a single record's FIELDS (branch resolution + scope +
   * dedup happen in the use case). Enforces required fields, numeric/date
   * validity, and the documented line-total consistency rule.
   */
  validate(cells: string[], columns: ColumnIndex): RowOutcome {
    const cell = (col: CanonicalColumn): string => {
      const idx = columns[col];
      return idx === undefined ? '' : (cells[idx] ?? '').trim();
    };

    const occurredAt = parseOccurredAt(cell('occurredAt'));
    if (!occurredAt) {
      return { ok: false, reason: `Unparseable or missing date: "${cell('occurredAt')}".` };
    }

    const rawBranch = cell('branch');
    if (rawBranch === '') {
      return { ok: false, reason: 'Missing branch.' };
    }

    const itemDescription = cell('item');
    if (itemDescription === '') {
      return { ok: false, reason: 'Missing item description.' };
    }

    const quantity = parseQuantity(cell('quantity'));
    if (quantity === null) {
      return { ok: false, reason: `Quantity must be an integer ≥ 1: "${cell('quantity')}".` };
    }

    const unitPriceAmount = parseMoneyToMinor(cell('unitPrice'));
    if (unitPriceAmount === null || unitPriceAmount < 0) {
      return { ok: false, reason: `Invalid unit price: "${cell('unitPrice')}".` };
    }

    const lineTotalAmount = parseMoneyToMinor(cell('lineTotal'));
    if (lineTotalAmount === null || lineTotalAmount < 0) {
      return { ok: false, reason: `Invalid line total: "${cell('lineTotal')}".` };
    }

    // Line-total consistency: must equal quantity × unitPrice within a rounding
    // tolerance of `quantity` minor units (absorbs per-unit rounding). Flagged,
    // never silently recomputed.
    const expected = quantity * unitPriceAmount;
    if (Math.abs(lineTotalAmount - expected) > quantity) {
      return {
        ok: false,
        reason: `Line total ${lineTotalAmount} ≠ quantity × unit price (${expected}) beyond rounding tolerance.`,
      };
    }

    const paymentMethodRaw = cell('paymentMethod');
    const externalReferenceRaw = cell('externalReference');

    return {
      ok: true,
      row: {
        occurredAt,
        rawBranch,
        itemDescription,
        quantity,
        unitPriceAmount,
        lineTotalAmount,
        paymentMethod: paymentMethodRaw === '' ? null : paymentMethodRaw,
        externalReference: externalReferenceRaw === '' ? null : externalReferenceRaw,
      },
    };
  }
}
