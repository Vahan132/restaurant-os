'use client';

import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { getErrorMessage, isApiError } from '@/lib/api-error';
import { toast } from '@/stores/toast';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    // Global error toast for any failed query.
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Allow individual queries to opt out of the global toast.
        if (query.meta?.suppressErrorToast) return;
        toast.error(getErrorMessage(error));
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Retry transient/server errors, but never client (4xx) errors.
        retry: (failureCount, error) => {
          if (isApiError(error) && error.status && error.status >= 400 && error.status < 500) {
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // Keep one client per browser session (stable across re-renders).
  const [queryClient] = useState(makeQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
