import { create } from 'zustand';

/**
 * Client-only "bump" set: fully-ready tickets the user has hidden from this
 * screen. There is no bump endpoint — the ticket also drops off naturally when
 * the order is served/closed and the read model stops returning it. Kept in
 * memory (not persisted): a reload re-shows ready tickets until they clear
 * server-side, which is the safe default for a shared kitchen screen.
 */
interface BumpState {
  bumped: Set<string>;
  bump: (key: string) => void;
  unbump: (key: string) => void;
  isBumped: (key: string) => boolean;
  /** Drop keys no longer present on the board so the set can't grow unbounded. */
  prune: (activeKeys: string[]) => void;
}

export const useBumpStore = create<BumpState>((set, get) => ({
  bumped: new Set<string>(),
  bump: (key) => set((s) => ({ bumped: new Set(s.bumped).add(key) })),
  unbump: (key) =>
    set((s) => {
      const next = new Set(s.bumped);
      next.delete(key);
      return { bumped: next };
    }),
  isBumped: (key) => get().bumped.has(key),
  prune: (activeKeys) =>
    set((s) => {
      const active = new Set(activeKeys);
      const next = new Set<string>();
      s.bumped.forEach((k) => {
        if (active.has(k)) next.add(k);
      });
      return next.size === s.bumped.size ? {} : { bumped: next };
    }),
}));
