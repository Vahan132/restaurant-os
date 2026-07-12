import { CatalogLocalizedName } from '../../../platform-catalog/domain/repositories/catalog-item.reader';

/**
 * INV-SEARCH-1: the adopted-inclusive inventory lists (item list, stock list, stock
 * reports) must order rows by their EFFECTIVE display name — the live catalog name for
 * an adopted item (local `name` is null), the local name otherwise. A null local column
 * can't order adopted rows in SQL, so ordering is done in the application layer after the
 * name resolver has run. These endpoints carry no locale, so the sort key uses one FIXED
 * locale for stable, deterministic ordering. This affects ORDER ONLY — never the name a
 * client displays (clients still pick their own display locale from name/catalogName).
 */

/** Fixed sort-key locale (Armenian market). Ordering only; not a display choice. */
export const SORT_LOCALE: keyof CatalogLocalizedName = 'hy';

/**
 * Effective name used purely as a sort key: the catalog name (adopted) in the fixed sort
 * locale, else the local name, else '' (keeps localeCompare total on missing names).
 */
export function effectiveSortName(
  localName: string | null,
  catalogName: CatalogLocalizedName | null | undefined,
): string {
  return catalogName ? catalogName[SORT_LOCALE] : (localName ?? '');
}

/** Compare two rows by effective name (case/locale aware). Adopted + custom interleave. */
export function compareByEffectiveName(
  aLocal: string | null,
  aCatalog: CatalogLocalizedName | null | undefined,
  bLocal: string | null,
  bCatalog: CatalogLocalizedName | null | undefined,
): number {
  return effectiveSortName(aLocal, aCatalog).localeCompare(effectiveSortName(bLocal, bCatalog));
}
