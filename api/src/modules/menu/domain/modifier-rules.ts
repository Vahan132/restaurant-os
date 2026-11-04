import { ModifierSelectionType } from './enums';

/**
 * Pure resolver for a dish's EFFECTIVE modifier rules (Prompt 1A).
 *
 * A reusable modifier group carries base rules; a dish attachment may override
 * `required`/`min`/`max`. A null override inherits the group value. The resolved
 * rules are returned to clients so the frontend never recomputes them.
 *
 * Invariants applied here (the single source of truth for "effective" rules):
 *   - SINGLE caps the effective max at 1.
 *   - `required` implies effective min >= 1.
 *   - effective min <= effective max (min is clamped down to max when a cap exists).
 *
 * No framework / Prisma imports — safe to reuse from any layer.
 */
export interface ModifierGroupRuleBase {
  selectionType: ModifierSelectionType | string;
  required: boolean;
  minSelect: number | null;
  maxSelect: number | null;
}

export interface ModifierAttachmentOverrides {
  requiredOverride: boolean | null;
  minOverride: number | null;
  maxOverride: number | null;
}

export interface EffectiveModifierRules {
  selectionType: string;
  required: boolean;
  /** Always a concrete number (>= 0). */
  minSelect: number;
  /** null = unlimited (only possible under MULTIPLE). */
  maxSelect: number | null;
}

export function resolveEffectiveModifierRules(
  base: ModifierGroupRuleBase,
  overrides: ModifierAttachmentOverrides | null,
): EffectiveModifierRules {
  const ov = overrides ?? { requiredOverride: null, minOverride: null, maxOverride: null };
  const selectionType = String(base.selectionType);
  const required = ov.requiredOverride ?? base.required;

  if (selectionType === ModifierSelectionType.SINGLE) {
    // Single = pick exactly one when required, else at most one.
    return { selectionType, required, minSelect: required ? 1 : 0, maxSelect: 1 };
  }

  let min = ov.minOverride ?? base.minSelect ?? (required ? 1 : 0);
  let max = ov.maxOverride ?? base.maxSelect ?? null;
  if (min < 0) min = 0;
  if (required && min < 1) min = 1;
  if (max !== null && max < 1) max = 1;
  if (max !== null && min > max) min = max;
  return { selectionType, required, minSelect: min, maxSelect: max };
}
