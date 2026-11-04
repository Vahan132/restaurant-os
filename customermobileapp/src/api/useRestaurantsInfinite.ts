import { useInfiniteQuery } from '@tanstack/react-query';
import { publicDiscoveryControllerRestaurants } from '@/api/generated/discovery/discovery';
import type { ConsumerBranchCardResponse } from '@/api/generated/model';

/** Page size for the discovery list. */
export const RESTAURANTS_LIMIT = 10;

/**
 * Infinite-scroll wrapper around the generated `restaurants` fetcher.
 *
 * The list endpoint returns a bare `ConsumerBranchCardResponse[]` (no cursor/total), so
 * we page by length: if a page came back full (=== limit), assume there's another.
 * Refetches automatically when `q` or `attributeValueIds` change (they're in the key).
 */
export function useRestaurantsInfinite(q: string, attributeValueIds: string[]) {
  return useInfiniteQuery<ConsumerBranchCardResponse[]>({
    queryKey: ['discovery-restaurants', q, attributeValueIds],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      publicDiscoveryControllerRestaurants(
        {
          q: q.trim() ? q.trim() : undefined,
          attributeValueIds: attributeValueIds.length ? attributeValueIds : undefined,
          page: pageParam as number,
          limit: RESTAURANTS_LIMIT,
        },
        undefined,
        signal,
      ),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === RESTAURANTS_LIMIT ? allPages.length + 1 : undefined,
  });
}
