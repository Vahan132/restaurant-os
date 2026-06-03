'use client';

import { useRestaurantControllerSettings } from '@/api/generated/restaurant/restaurant';
import { useAuthStore } from '@/stores/auth';

/**
 * Restaurant settings (GET /restaurant/settings) — drives the action gating
 * toggles: allowDiscounts, allowOrderCancellation, requireApprovalForDiscount,
 * requireApprovalForCancellation, etc. Cached for the session.
 */
export function useSettings() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useRestaurantControllerSettings({
    query: {
      enabled: Boolean(accessToken),
      staleTime: 5 * 60 * 1000,
    },
  });
}
