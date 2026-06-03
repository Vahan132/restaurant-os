'use client';

import { useCallback, useMemo, useState } from 'react';

import type { PublicModifierGroupResponse } from '@/api/generated/model';
import type { CartModifierSelection } from '@/lib/cart';

export type Selections = Record<string, string[]>; // groupId -> optionIds

/** Minimum number of selections a group requires. */
export function minFor(group: PublicModifierGroupResponse): number {
  if (group.selectionType === 'SINGLE') return group.required ? 1 : 0;
  if (group.minSelect != null) return group.minSelect;
  return group.required ? 1 : 0;
}

/** Maximum number of selections a group allows (Infinity if unbounded). */
export function maxFor(group: PublicModifierGroupResponse): number {
  if (group.selectionType === 'SINGLE') return 1;
  return group.maxSelect != null ? group.maxSelect : Infinity;
}

export function isGroupValid(group: PublicModifierGroupResponse, selected: string[]): boolean {
  const n = selected.length;
  return n >= minFor(group) && n <= maxFor(group);
}

/** Manages modifier selections for an item and reports validity + price impact. */
export function useModifierSelection(groups: PublicModifierGroupResponse[]) {
  const [selections, setSelections] = useState<Selections>({});

  const toggle = useCallback(
    (group: PublicModifierGroupResponse, optionId: string) => {
      setSelections((prev) => {
        const current = prev[group.id] ?? [];
        if (group.selectionType === 'SINGLE') {
          return { ...prev, [group.id]: [optionId] };
        }
        // MULTIPLE
        if (current.includes(optionId)) {
          return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
        }
        if (current.length >= maxFor(group)) return prev; // at max — ignore
        return { ...prev, [group.id]: [...current, optionId] };
      });
    },
    [],
  );

  const isSelected = useCallback(
    (groupId: string, optionId: string) => (selections[groupId] ?? []).includes(optionId),
    [selections],
  );

  const allValid = useMemo(
    () => groups.every((g) => isGroupValid(g, selections[g.id] ?? [])),
    [groups, selections],
  );

  const selectedModifiers = useMemo<CartModifierSelection[]>(() => {
    const out: CartModifierSelection[] = [];
    for (const group of groups) {
      const ids = selections[group.id] ?? [];
      for (const id of ids) {
        const opt = group.options.find((o) => o.id === id);
        if (opt) {
          out.push({
            modifierGroupId: group.id,
            modifierOptionId: opt.id,
            name: opt.name,
            priceDelta: opt.priceDeltaAmount,
          });
        }
      }
    }
    return out;
  }, [groups, selections]);

  return { selections, toggle, isSelected, allValid, selectedModifiers };
}
