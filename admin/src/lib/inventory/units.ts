/**
 * Inventory unit helpers.
 *
 * Quantities are stored and returned by the API in the item's BASE unit
 * (GRAM / MILLILITER / PIECE). Items may define alternate units via a
 * `conversionFactor` (integer count of base units per alternate unit), e.g.
 * `kg -> 1000` means 1 kg = 1000 g.
 *
 * These helpers convert between base and chosen units and render the friendly
 * "4,800 g (4.8 kg)" string used across the warehouse screens.
 */
import type { AlternateUnit } from '@/api/generated/model';

export type BaseUnit = 'GRAM' | 'MILLILITER' | 'PIECE';

/** Short symbol shown next to quantities for each base unit. */
export const BASE_UNIT_ABBR: Record<BaseUnit, string> = {
  GRAM: 'g',
  MILLILITER: 'ml',
  PIECE: 'pc',
};

export interface UnitOption {
  /** Wire value sent in the `unit` field (base unit -> its enum, e.g. GRAM). */
  value: string;
  /** Human label shown in the select (base unit -> symbol, e.g. g). */
  label: string;
  /** Base units per one of this unit (base unit itself is 1). */
  conversionFactor: number;
  /** True for the implicit base unit row. */
  isBase: boolean;
}

/** Base-unit option followed by the item's alternate units (factor asc). */
export function unitOptions(
  baseUnit: BaseUnit | string,
  alternateUnits: AlternateUnit[] = [],
): UnitOption[] {
  const base: UnitOption = {
    value: baseUnit,
    label: BASE_UNIT_ABBR[baseUnit as BaseUnit] ?? baseUnit,
    conversionFactor: 1,
    isBase: true,
  };
  const alts = [...alternateUnits]
    .filter((u) => u.conversionFactor >= 1)
    .sort((a, b) => a.conversionFactor - b.conversionFactor)
    .map((u) => ({
      value: u.name,
      label: u.name,
      conversionFactor: u.conversionFactor,
      isBase: false,
    }));
  return [base, ...alts];
}

/** Find the conversion factor for a chosen unit value (defaults to 1 / base). */
export function factorForUnit(
  unitValue: string,
  baseUnit: BaseUnit | string,
  alternateUnits: AlternateUnit[] = [],
): number {
  const match = unitOptions(baseUnit, alternateUnits).find((u) => u.value === unitValue);
  return match?.conversionFactor ?? 1;
}

/** Convert a quantity expressed in `unitValue` into base units. */
export function toBaseQty(
  qty: number,
  unitValue: string,
  baseUnit: BaseUnit | string,
  alternateUnits: AlternateUnit[] = [],
): number {
  return qty * factorForUnit(unitValue, baseUnit, alternateUnits);
}

/** Locale-aware number with thousands separators, trimming trailing zeros. */
export function formatNumber(value: number, maxFractionDigits = 3): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
}

/** The largest-factor alternate unit, if any (used for the friendly display). */
export function largestAlternate(
  alternateUnits: AlternateUnit[] = [],
): AlternateUnit | null {
  const valid = alternateUnits.filter((u) => u.conversionFactor > 1);
  if (valid.length === 0) return null;
  return valid.reduce((max, u) => (u.conversionFactor > max.conversionFactor ? u : max));
}

/**
 * Render an on-hand quantity in the base unit with a muted conversion to the
 * item's largest alternate unit, e.g. `formatBaseQty(4800, 'GRAM', [{name:'kg',
 * conversionFactor:1000}])` -> `{ base: "4,800 g", alt: "4.8 kg" }`.
 * `alt` is null when the item has no alternate unit.
 */
export function formatBaseQty(
  baseQty: number,
  baseUnit: BaseUnit | string,
  alternateUnits: AlternateUnit[] = [],
): { base: string; alt: string | null } {
  const abbr = BASE_UNIT_ABBR[baseUnit as BaseUnit] ?? baseUnit;
  const base = `${formatNumber(baseQty)} ${abbr}`;
  const largest = largestAlternate(alternateUnits);
  if (!largest) return { base, alt: null };
  const altValue = baseQty / largest.conversionFactor;
  return { base, alt: `${formatNumber(altValue)} ${largest.name}` };
}
