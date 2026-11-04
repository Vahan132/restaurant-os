'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  getAdminConsumerListingControllerReadRestaurantQueryKey,
  getAdminConsumerListingControllerReadBranchQueryKey,
} from '@/api/generated/admin-consumer-listing/admin-consumer-listing';
import type {
  AttributeCategoryResponse,
  AttributeValueResponse,
} from '@/api/generated/model';
import type { Locale } from '@/i18n/config';

/**
 * Cache invalidation for the consumer-listing reads. Every mutation in this
 * area returns the updated resource, but we still refetch the relevant read so
 * the readiness checklist and derived fields (`effectiveListed`) update live.
 */
export function useConsumerListingInvalidation() {
  const qc = useQueryClient();

  const invalidateRestaurant = useCallback(
    () =>
      qc.invalidateQueries({
        queryKey: getAdminConsumerListingControllerReadRestaurantQueryKey(),
      }),
    [qc],
  );

  const invalidateBranch = useCallback(
    (branchId: string) =>
      qc.invalidateQueries({
        queryKey: getAdminConsumerListingControllerReadBranchQueryKey(branchId),
      }),
    [qc],
  );

  return { invalidateRestaurant, invalidateBranch };
}

/** Pick the label for the active locale from a flat label* attribute record. */
export function attributeLabel(
  item: AttributeCategoryResponse | AttributeValueResponse,
  locale: Locale,
): string {
  if (locale === 'hy') return item.labelHy || item.labelEn || item.labelRu;
  if (locale === 'ru') return item.labelRu || item.labelEn || item.labelHy;
  return item.labelEn || item.labelRu || item.labelHy;
}
