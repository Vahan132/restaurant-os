import type {
  PublicModifierGroupResponse,
  PublicModifierOptionResponse,
} from '@/api/generated/model';

/**
 * modifiers — pure selection logic for the ORDER-4 interactive modifier picker.
 *
 * Selection is `{ [groupId]: selectedOptionId[] }`. SINGLE groups hold 0–1 ids;
 * MULTIPLE groups hold up to `maxSelect`. The server re-validates rules and prices on
 * validate-cart, so this is UX guidance, not the source of truth.
 */
export type ModifierSelection = Record<string, string[]>;

/** Default selection: pre-pick the first option of each required SINGLE group. */
export function initialSelection(groups: PublicModifierGroupResponse[]): ModifierSelection {
  const sel: ModifierSelection = {};
  for (const g of groups) {
    if (g.selectionType === 'SINGLE' && g.required && g.options.length > 0) {
      sel[g.id] = [g.options[0].id];
    } else {
      sel[g.id] = [];
    }
  }
  return sel;
}

/** Toggle an option within a group, honoring SINGLE/MULTIPLE + required + maxSelect. */
export function toggleModifierOption(
  group: PublicModifierGroupResponse,
  selection: ModifierSelection,
  optionId: string,
): string[] {
  const current = selection[group.id] ?? [];
  if (group.selectionType === 'SINGLE') {
    if (current.includes(optionId)) {
      // Tapping the selected one deselects only if the group is optional.
      return group.required ? current : [];
    }
    return [optionId];
  }
  // MULTIPLE
  if (current.includes(optionId)) {
    return current.filter((id) => id !== optionId);
  }
  if (group.maxSelect != null && current.length >= group.maxSelect) {
    return current; // at max — ignore the add
  }
  return [...current, optionId];
}

/** Whether every group's rule (required / min / max) is satisfied by the selection. */
export function isSelectionValid(
  groups: PublicModifierGroupResponse[],
  selection: ModifierSelection,
): boolean {
  for (const g of groups) {
    const count = (selection[g.id] ?? []).length;
    if (g.selectionType === 'SINGLE') {
      if (g.required && count < 1) return false;
    } else {
      const min = g.required ? Math.max(1, g.minSelect ?? 1) : (g.minSelect ?? 0);
      if (count < min) return false;
      if (g.maxSelect != null && count > g.maxSelect) return false;
    }
  }
  return true;
}

export interface SelectedModifier {
  groupId: string;
  option: PublicModifierOptionResponse;
}

/** Flatten the selection into the concrete selected options (for the cart line). */
export function selectedModifiers(
  groups: PublicModifierGroupResponse[],
  selection: ModifierSelection,
): SelectedModifier[] {
  const out: SelectedModifier[] = [];
  for (const g of groups) {
    const ids = selection[g.id] ?? [];
    for (const id of ids) {
      const option = g.options.find((o) => o.id === id);
      if (option) out.push({ groupId: g.id, option });
    }
  }
  return out;
}
