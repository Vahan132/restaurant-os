/**
 * Consumer Saved client hub (CX-APP-3).
 *
 * Single re-export point for the orval-generated Consumer Saved hooks, plus the
 * saved-state helpers the rest of the app uses. The `/consumer/saved` list query is
 * the SINGLE SOURCE OF TRUTH for whether a branch is saved — discovery cards, the
 * detail bookmark, and the Saved tab all derive their state from it, and every
 * save/unsave invalidates it so they stay in sync.
 *
 * Generated from operationIds:
 *   ConsumerSavedController_list / save / unsave  (tag "Consumer Saved")
 */
import { useConsumerSavedControllerList } from './generated/consumer-saved/consumer-saved';
import {
  consumerSavedControllerSave,
  consumerSavedControllerUnsave,
  getConsumerSavedControllerListQueryKey,
} from './generated/consumer-saved/consumer-saved';
import type { SavedRestaurantCardResponse } from './generated/model';
import { useAuthStore } from '@/store/auth';
import { queryClient } from './query-client';

export type { SavedRestaurantCardResponse } from './generated/model';
export { useConsumerSavedControllerList };

/** Stable query key for the saved list (used for reads + invalidation). */
export const savedListQueryKey = getConsumerSavedControllerListQueryKey();

/**
 * The saved list, fetched only when authenticated. Anonymous users observe an empty
 * (disabled) query — nothing is "saved" until they sign in.
 */
export function useSavedList() {
  const status = useAuthStore((s) => s.status);
  return useConsumerSavedControllerList({ query: { enabled: status === 'authed' } });
}

/** Whether a branch is currently in the saved list (reactive). */
export function useIsBranchSaved(branchId: string): boolean {
  const { data } = useSavedList();
  return !!data?.some((c) => c.branchId === branchId);
}

/** Non-hook read of saved state (for imperative flows like resume-intent). */
export function isBranchSavedNow(branchId: string): boolean {
  const list = queryClient.getQueryData<SavedRestaurantCardResponse[]>(savedListQueryKey);
  return !!list?.some((c) => c.branchId === branchId);
}

/** A minimal optimistic stub: branchId is required, everything else best-effort. */
export type OptimisticSavedCard = Pick<SavedRestaurantCardResponse, 'branchId'> &
  Partial<SavedRestaurantCardResponse>;

function buildStub(card: OptimisticSavedCard): SavedRestaurantCardResponse {
  return {
    branchId: card.branchId,
    savedAt: card.savedAt ?? new Date().toISOString(),
    listed: card.listed ?? true,
    restaurantId: card.restaurantId ?? null,
    name: card.name ?? null,
    logoUrl: card.logoUrl ?? null,
    heroPhotoUrl: card.heroPhotoUrl ?? null,
    address: card.address ?? null,
    city: card.city ?? null,
    menuPublic: card.menuPublic ?? null,
    reservationsPublic: card.reservationsPublic ?? null,
    attributes: card.attributes ?? [],
  };
}

/**
 * Optimistically add a branch to the saved list, then PUT. Rolls back on error and
 * always invalidates so the canonical card replaces the stub.
 */
export async function performSave(card: OptimisticSavedCard): Promise<void> {
  const prev = queryClient.getQueryData<SavedRestaurantCardResponse[]>(savedListQueryKey);
  if (!prev?.some((c) => c.branchId === card.branchId)) {
    queryClient.setQueryData<SavedRestaurantCardResponse[]>(savedListQueryKey, [
      buildStub(card),
      ...(prev ?? []),
    ]);
  }
  try {
    await consumerSavedControllerSave(card.branchId);
  } catch (e) {
    queryClient.setQueryData(savedListQueryKey, prev);
    throw e;
  } finally {
    void queryClient.invalidateQueries({ queryKey: savedListQueryKey });
  }
}

/**
 * Optimistically remove a branch from the saved list, then DELETE. Rolls back on error
 * and invalidates to reconcile.
 */
export async function performUnsave(branchId: string): Promise<void> {
  const prev = queryClient.getQueryData<SavedRestaurantCardResponse[]>(savedListQueryKey);
  queryClient.setQueryData<SavedRestaurantCardResponse[]>(
    savedListQueryKey,
    (prev ?? []).filter((c) => c.branchId !== branchId),
  );
  try {
    await consumerSavedControllerUnsave(branchId);
  } catch (e) {
    queryClient.setQueryData(savedListQueryKey, prev);
    throw e;
  } finally {
    void queryClient.invalidateQueries({ queryKey: savedListQueryKey });
  }
}
