'use client';

import { useCallback } from 'react';
import { useLocale } from 'next-intl';
import { useRestaurantControllerProfile } from '@/api/generated/restaurant/restaurant';
import { useAuthStore } from '@/stores/auth';
import { formatMoney, toMinor, fromMinor } from '@/lib/money';

const DEFAULT_CURRENCY = 'AMD';

/**
 * Caches the restaurant's currency (GET /restaurant) and exposes money helpers
 * bound to that currency + the active locale. Reused by P3–P5.
 */
export function useCurrency(): string {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { data } = useRestaurantControllerProfile({
    query: {
      enabled: Boolean(accessToken),
      staleTime: Infinity, // currency rarely changes within a session
    },
  });
  return data?.currency ?? DEFAULT_CURRENCY;
}

export function useMoney() {
  const currency = useCurrency();
  const locale = useLocale();

  const format = useCallback(
    (minor: number) => formatMoney(minor, currency, locale),
    [currency, locale],
  );
  const toMinorUnits = useCallback((major: number) => toMinor(major, currency), [currency]);
  const fromMinorUnits = useCallback((minor: number) => fromMinor(minor, currency), [currency]);

  return { currency, format, toMinor: toMinorUnits, fromMinor: fromMinorUnits };
}
