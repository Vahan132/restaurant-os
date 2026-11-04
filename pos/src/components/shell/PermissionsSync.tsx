'use client';

import { usePermissionsRealtimeSync } from '@/lib/realtime/usePermissionsRealtimeSync';

/**
 * Invisible mount point that keeps permissions live app-wide. Must render inside
 * RealtimeProvider (socket) and QueryClientProvider (cache). Renders nothing.
 */
export function PermissionsSync(): null {
  usePermissionsRealtimeSync();
  return null;
}
