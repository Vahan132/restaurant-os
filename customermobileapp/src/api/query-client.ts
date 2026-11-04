import { QueryClient } from '@tanstack/react-query';

/**
 * Shared React Query client. Conservative defaults for a mobile discovery app:
 * a short stale window and a single retry (the mutator already normalizes errors).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
