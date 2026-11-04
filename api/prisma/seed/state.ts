/**
 * Mutable state threaded through the seed modules (in FK order). Each phase fills
 * in the ids it owns so later phases can cross-reference them deterministically.
 */
import type { BranchKey } from './data/iam';
import type { LocationKey } from './data/inventory';
import type { ModifierGroupKey } from './data/menu';

export interface SeedState {
  roleIdByCode: Record<string, string>;
  userIdBySlug: Record<string, string>;
  locationIds: Record<BranchKey, Record<LocationKey, string>>;
  categoryIds: Record<BranchKey, Record<string, string>>;
  modifierGroupIds: Record<BranchKey, Record<string, string>>;
  /** key = `${groupKey}:${optionSlug}` */
  modifierOptionIds: Record<BranchKey, Record<string, string>>;
  itemIds: Record<BranchKey, Record<string, string>>;
  dishIds: Record<BranchKey, Record<string, string>>;
  processIds: Record<BranchKey, Record<string, string>>;
  tableIds: Record<BranchKey, string[]>;
  /** Human-readable secrets/PINs to print at the end (dev only). */
  printouts: string[];
  counts: Record<string, number>;
}

export function emptyState(): SeedState {
  const perBranch = <T>(make: () => T): Record<BranchKey, T> => ({
    flagship: make(),
    second: make(),
  });
  return {
    roleIdByCode: {},
    userIdBySlug: {},
    locationIds: perBranch(() => ({}) as Record<LocationKey, string>),
    categoryIds: perBranch(() => ({})),
    modifierGroupIds: perBranch(() => ({}) as Record<ModifierGroupKey, string>),
    modifierOptionIds: perBranch(() => ({})),
    itemIds: perBranch(() => ({})),
    dishIds: perBranch(() => ({})),
    processIds: perBranch(() => ({})),
    tableIds: perBranch(() => []),
    printouts: [],
    counts: {},
  };
}
