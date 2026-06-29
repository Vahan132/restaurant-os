import type {
  AttachedModifierGroupResponse,
  MenuItemDetailResponse,
} from '@/api/generated/model';

/** Selected option ids keyed by modifier group id. */
export type ModifierSelection = Record<string, string[]>;

/**
 * Min/max selections a group requires, normalized across SINGLE/MULTIPLE.
 * Reads the backend-resolved (`effective`) rules — overrides are already applied
 * server-side, so POS consumes them rather than recomputing.
 */
export function groupBounds(group: AttachedModifierGroupResponse): { min: number; max: number } {
  const { selectionType, required, minSelect, maxSelect } = group.effective;
  if (selectionType === 'SINGLE') {
    return { min: required ? 1 : 0, max: 1 };
  }
  const min = required ? Math.max(minSelect ?? 1, 1) : (minSelect ?? 0);
  const max = maxSelect ?? Number.POSITIVE_INFINITY;
  return { min, max };
}

/** Whether a single group's current selection satisfies its rules. */
export function isGroupValid(
  group: AttachedModifierGroupResponse,
  selectedIds: string[],
): boolean {
  const { min, max } = groupBounds(group);
  return selectedIds.length >= min && selectedIds.length <= max;
}

/** Whether the whole selection satisfies every group's rules. */
export function isSelectionValid(
  groups: AttachedModifierGroupResponse[],
  selection: ModifierSelection,
): boolean {
  return groups.every((g) => isGroupValid(g, selection[g.id] ?? []));
}

/** Flatten the selection into the `selectedOptionIds` array the API expects. */
export function collectSelectedOptionIds(selection: ModifierSelection): string[] {
  return Object.values(selection).flat();
}

/** Unit price (minor units) = base + sum of selected option deltas. */
export function computeUnitPrice(
  item: MenuItemDetailResponse,
  selection: ModifierSelection,
): number {
  let total = item.priceAmount;
  for (const group of item.modifierGroups) {
    const chosen = new Set(selection[group.id] ?? []);
    for (const opt of group.options) {
      if (chosen.has(opt.id)) total += opt.priceDeltaAmount;
    }
  }
  return total;
}

/** Toggle an option within a group, honoring SINGLE (replace) vs MULTIPLE (add up to max). */
export function toggleOption(
  group: AttachedModifierGroupResponse,
  selection: ModifierSelection,
  optionId: string,
): ModifierSelection {
  const current = selection[group.id] ?? [];
  const has = current.includes(optionId);

  if (group.effective.selectionType === 'SINGLE') {
    // Radio: selecting replaces; tapping the selected one clears it only if optional.
    const next = has && !group.effective.required ? [] : [optionId];
    return { ...selection, [group.id]: next };
  }

  // MULTIPLE checkbox.
  if (has) {
    return { ...selection, [group.id]: current.filter((id) => id !== optionId) };
  }
  const { max } = groupBounds(group);
  if (current.length >= max) return selection; // at cap — ignore
  return { ...selection, [group.id]: [...current, optionId] };
}
