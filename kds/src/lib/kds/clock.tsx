'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * A single ticking clock for the whole board. One setInterval drives every
 * timer so hundreds of tickets don't each spin up their own interval.
 * Consumers read `useNow()` (epoch ms, updated ~1/s).
 */
const ClockContext = createContext<number>(Date.now());

export function ClockProvider({ children }: { children: ReactNode }) {
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    ref.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(ref.current);
  }, []);

  return <ClockContext.Provider value={now}>{children}</ClockContext.Provider>;
}

export function useNow(): number {
  return useContext(ClockContext);
}

/** Format a non-negative seconds count as mm:ss (or h:mm:ss past an hour). */
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(hours > 0 ? minutes : minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
