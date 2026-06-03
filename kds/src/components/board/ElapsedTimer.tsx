'use client';

import { memo } from 'react';
import { formatElapsed, useNow } from '@/lib/kds/clock';

/**
 * Counts up from `anchorMs`, redrawing on the shared clock tick. `className`
 * carries the escalation color decided by the parent.
 */
function ElapsedTimerBase({ anchorMs, className }: { anchorMs: number; className?: string }) {
  const now = useNow();
  const seconds = (now - anchorMs) / 1000;
  return (
    <span className={className} aria-label="elapsed time">
      {formatElapsed(seconds)}
    </span>
  );
}

export const ElapsedTimer = memo(ElapsedTimerBase);
