'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RealtimeProvider } from '@/lib/realtime/RealtimeProvider';
import { HubHealthProvider } from '@/lib/hub/HubHealthProvider';
import { Toaster } from '@/lib/toast';
import { ConnectionBanner } from '@/components/shell/ConnectionBanner';
import { HubBlockingOverlay } from '@/components/shell/HubBlockingOverlay';
import { OrderReadyNotifier } from '@/components/shell/OrderReadyNotifier';
import { AuthGate } from '@/components/auth/AuthGate';
import { BranchGate } from '@/components/branch/BranchGate';

/**
 * Client-side provider stack: React Query + realtime socket + global
 * notification surfaces (connection banner, order-ready toasts) + auth routing.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 30 * 1000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <HubHealthProvider>
        <RealtimeProvider>
          <AuthGate>
            <BranchGate>{children}</BranchGate>
          </AuthGate>
          <ConnectionBanner />
          <HubBlockingOverlay />
          <OrderReadyNotifier />
          <Toaster />
        </RealtimeProvider>
      </HubHealthProvider>
    </QueryClientProvider>
  );
}
