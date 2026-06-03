'use client';

import type { ReactNode } from 'react';
import { TopBar } from './TopBar';

/**
 * Wraps authenticated workflow screens. The top bar stays fixed; the main area
 * renders the active workflow (home = table-select). Landscape-first, no
 * page-level scroll jank on tablets.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-gray-100">
      <TopBar />
      <main className="flex-1 overflow-y-auto p-4">{children}</main>
    </div>
  );
}
