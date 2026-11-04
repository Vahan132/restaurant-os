import { useInfiniteQuery } from '@tanstack/react-query';
import { consumerBookingControllerList } from '@/api/generated/consumer-booking/consumer-booking';
import type {
  ConsumerReservationResponse,
  ConsumerBookingControllerListScope,
} from '@/api/generated/model';
import { useAuthStore } from '@/store/auth';

/** Page size for the reservations lists. */
export const RESERVATIONS_LIMIT = 20;

/**
 * Infinite-scroll wrapper around the generated `list` fetcher, one query per `scope`.
 *
 * The endpoint returns a bare `ConsumerReservationResponse[]` (no cursor/total), so we
 * page by length: a full page (=== limit) implies there may be another. Only runs when
 * authenticated. The query key shares the `/consumer/reservations` base so
 * `invalidateReservations()` refetches it after a booking or cancel.
 */
export function useReservationsInfinite(scope: ConsumerBookingControllerListScope) {
  const status = useAuthStore((s) => s.status);
  return useInfiniteQuery<ConsumerReservationResponse[]>({
    queryKey: ['/consumer/reservations', { scope }],
    enabled: status === 'authed',
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      consumerBookingControllerList(
        { scope, page: pageParam as number, limit: RESERVATIONS_LIMIT },
        undefined,
        signal,
      ),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === RESERVATIONS_LIMIT ? allPages.length + 1 : undefined,
  });
}
