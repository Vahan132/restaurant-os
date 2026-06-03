'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RealtimeProvider } from '@/lib/realtime/RealtimeProvider';
import { Toaster } from '@/lib/toast';
import { ConnectionBanner } from '@/components/shell/ConnectionBanner';
import { OrderReadyNotifier } from '@/components/shell/OrderReadyNotifier';
import { AuthGate } from '@/components/auth/AuthGate';

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
      <RealtimeProvider>
        <AuthGate>{children}</AuthGate>
        <ConnectionBanner />
        <OrderReadyNotifier />
        <Toaster />
      </RealtimeProvider>
    </QueryClientProvider>
  );
}
