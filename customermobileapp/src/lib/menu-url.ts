/**
 * menu-url — bridge the discovery world (branchId) to the storefront world (slugs).
 *
 * ORDER-3: the app navigates branches by their globally-unique `branchId`, but the
 * PUBLIC menu endpoint (`usePublicStorefrontControllerBranchMenu`) is keyed by
 * `restaurantSlug` + `branchSlug`. The discovery detail response does not expose those
 * slugs as separate fields — it only exposes `menuUrl`, the server-built storefront path:
 *
 *     /public/{restaurantSlug}/branch/{branchSlug}/menu
 *
 * (see api get-consumer-branch-detail.usecase.ts; non-null only when `menuPublic`).
 * We parse the two slugs out of that path. This keeps ORDER-3 fully client-side — no
 * backend change. If the backend later adds explicit slug fields to the detail DTO,
 * prefer those and delete this parser.
 */

export interface MenuSlugs {
  restaurantSlug: string;
  branchSlug: string;
}

/** `/public/{restaurantSlug}/branch/{branchSlug}/menu` — leading slash + trailing "menu". */
const MENU_PATH = /^\/?public\/([^/]+)\/branch\/([^/]+)\/menu\/?$/;

/**
 * Parse the storefront `menuUrl` into its `{ restaurantSlug, branchSlug }`.
 * Returns null for null/empty/malformed input (caller should gate on `menuPublic`,
 * which guarantees a non-null menuUrl, so null here is a genuine "no menu" signal).
 */
export function parseMenuUrl(menuUrl: string | null | undefined): MenuSlugs | null {
  if (!menuUrl) return null;
  const match = MENU_PATH.exec(menuUrl.trim());
  if (!match) return null;
  const [, restaurantSlug, branchSlug] = match;
  if (!restaurantSlug || !branchSlug) return null;
  return {
    restaurantSlug: decodeURIComponent(restaurantSlug),
    branchSlug: decodeURIComponent(branchSlug),
  };
}
