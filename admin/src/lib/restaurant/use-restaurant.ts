'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/api/mutator';

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  currency: string;
  defaultLanguage: string;
  timezone: string;
  status: string;
}

/** Current restaurant context (name, currency) for the app shell. */
export function useRestaurant() {
  return useQuery({
    queryKey: ['restaurant'],
    queryFn: async () => {
      const { data } = await api.get<Restaurant>('/restaurant');
      return data;
    },
    staleTime: 5 * 60_000,
    // Shell-level convenience fetch; failures shouldn't pop a global toast.
    meta: { suppressErrorToast: true },
  });
}
