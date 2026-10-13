import type { CatalogNameView } from '@/api/generated/model';
import { defaultLocale, isLocale } from '@/i18n/config';

/**
 * A trilingual name payload. Both the platform catalog browse name
 * (`CatalogBrowseNameResponse`) and the live-resolved `CatalogNameView` carried
 * on adopted inventory items share this `{ hy, ru, en }` shape.
 */
export type TrilingualName = CatalogNameView;

/**
 * Pick a trilingual name for the active UI locale. Falls back `hy → en → ru`
 * when the active-locale string is empty/missing (per the catalog ADR: Armenian
 * is the source-of-truth locale).
 */
export function pickName(name: TrilingualName, locale: string): string {
  const active = isLocale(locale) ? name[locale] : name[defaultLocale];
  return (active || name.hy || name.en || name.ru || '').trim();
}

/**
 * Display name for an inventory item (or any stock/report row derived from one).
 *
 * Adopted items carry no local name (`name = null`) and expose a live
 * `catalogName`; custom items carry a local `name` and `catalogName = null`.
 * Rendering raw `.name`/`.itemName` would show blank for adopted items — every
 * item-name surface should route through this helper instead.
 *
 * Accepts either a `name` field (items, stock rows) or an `itemName` field
 * (on-hand / low-stock report rows); `catalogName` is optional so counterparts
 * that lack it (e.g. recipe warnings) still resolve to their local name.
 */
export function itemDisplayName(
  item: {
    name?: string | null;
    itemName?: string | null;
    catalogName?: CatalogNameView | null;
  },
  locale: string,
): string {
  if (item.catalogName) return pickName(item.catalogName, locale);
  return item.name ?? item.itemName ?? '';
}
