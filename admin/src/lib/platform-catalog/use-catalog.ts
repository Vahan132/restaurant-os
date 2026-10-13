'use client';

import { keepPreviousData, useQueryClient } from '@tanstack/react-query';

import {
  getPlatformCatalogItemsControllerListQueryKey,
  usePlatformCatalogItemsControllerArchive,
  usePlatformCatalogItemsControllerCreate,
  usePlatformCatalogItemsControllerList,
  usePlatformCatalogItemsControllerUpdate,
} from '@/api/generated/platform-catalog-items/platform-catalog-items';
import { usePlatformCatalogTaxonomyControllerGet } from '@/api/generated/platform-catalog-taxonomy/platform-catalog-taxonomy';
import type {
  CatalogItemResponse,
  PlatformCatalogItemsControllerListParams,
} from '@/api/generated/model';
import { normalizeList } from '@/lib/normalize-list';

/**
 * View model with the nullable fields coerced to `string | null`. The backend
 * returns `string | null`, but orval typed the nullable-without-`type` schema as
 * `{ [key: string]: unknown } | null`; we confine that coercion to this one place.
 */
export interface CatalogItemVM {
  id: string;
  slug: string;
  nameHy: string;
  nameRu: string;
  nameEn: string;
  categoryId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function toCatalogVM(r: CatalogItemResponse): CatalogItemVM {
  return {
    id: r.id,
    slug: r.slug,
    nameHy: r.nameHy,
    nameRu: r.nameRu,
    nameEn: r.nameEn,
    categoryId: (r.categoryId as unknown as string | null) ?? null,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** Localized taxonomy label for the current UI locale (hy primary per the ADR). */
export function taxonomyLabel(
  x: { labelHy: string; labelRu: string; labelEn: string },
  locale: string,
): string {
  if (locale === 'hy') return x.labelHy;
  if (locale === 'ru') return x.labelRu;
  return x.labelEn;
}

export function useCatalogList(params: PlatformCatalogItemsControllerListParams) {
  const query = usePlatformCatalogItemsControllerList(params, {
    query: { placeholderData: keepPreviousData },
  });
  const { items, pagination } = normalizeList<CatalogItemResponse>(query.data);
  return { ...query, items: items.map(toCatalogVM), pagination };
}

export function useCatalogTaxonomy() {
  return usePlatformCatalogTaxonomyControllerGet();
}

/** Invalidate every catalog list variation after a mutation. */
export function useCatalogInvalidation() {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({ queryKey: getPlatformCatalogItemsControllerListQueryKey() });
}

export {
  usePlatformCatalogItemsControllerCreate as useCatalogCreate,
  usePlatformCatalogItemsControllerUpdate as useCatalogUpdate,
  usePlatformCatalogItemsControllerArchive as useCatalogArchive,
};
