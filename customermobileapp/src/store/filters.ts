import { create } from 'zustand';

/**
 * Single shared filter store. BOTH the search-bar category strip and the full Filters
 * sheet read/write this — so they can never disagree (CX-APP-1 acceptance).
 *
 * - `searchQuery` drives the list's `q` param (debounced at the input).
 * - `selectedAttributeValueIds` drives the list's `attributeValueIds` param.
 * - `pendingExpandCategoryId` is a one-shot hint: tapping a strip chip sets it, the
 *   Filters sheet consumes it on open to auto-expand/scroll to that category.
 */
interface FiltersState {
  searchQuery: string;
  selectedAttributeValueIds: string[];
  pendingExpandCategoryId: string | null;

  setSearchQuery: (q: string) => void;
  toggleValue: (id: string) => void;
  isSelected: (id: string) => boolean;
  /** Number of selected value ids within a given set (e.g. a category's value ids). */
  countSelectedIn: (ids: string[]) => number;
  /** Reset filters = clear selected ids only (search is left intact). */
  clearSelected: () => void;
  setPendingExpandCategory: (categoryId: string | null) => void;
}

export const useFiltersStore = create<FiltersState>((set, get) => ({
  searchQuery: '',
  selectedAttributeValueIds: [],
  pendingExpandCategoryId: null,

  setSearchQuery: (q) => set({ searchQuery: q }),

  toggleValue: (id) =>
    set((s) => ({
      selectedAttributeValueIds: s.selectedAttributeValueIds.includes(id)
        ? s.selectedAttributeValueIds.filter((x) => x !== id)
        : [...s.selectedAttributeValueIds, id],
    })),

  isSelected: (id) => get().selectedAttributeValueIds.includes(id),

  countSelectedIn: (ids) => {
    const sel = get().selectedAttributeValueIds;
    return ids.reduce((n, id) => (sel.includes(id) ? n + 1 : n), 0);
  },

  clearSelected: () => set({ selectedAttributeValueIds: [] }),

  setPendingExpandCategory: (categoryId) => set({ pendingExpandCategoryId: categoryId }),
}));
