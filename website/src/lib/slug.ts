/**
 * Client-side subdomain format validation, mirroring the server's rules so we
 * only hit the availability endpoint for plausibly-valid slugs. The server
 * remains the source of truth (uniqueness + reserved words).
 */
export const SLUG_MIN = 3;
export const SLUG_MAX = 30;

/**
 * Reason codes for an invalid slug. The component maps these to localized
 * messages under `validation.slug.<code>` (some take {min}/{max} params), so
 * this validator stays locale-agnostic.
 */
export type SlugReason =
  | "required"
  | "tooShort"
  | "tooLong"
  | "charset"
  | "hyphenEdge"
  | "consecutive";

export function validateSlugFormat(slug: string): { valid: boolean; reason?: SlugReason } {
  if (!slug) return { valid: false, reason: "required" };
  if (slug.length < SLUG_MIN) return { valid: false, reason: "tooShort" };
  if (slug.length > SLUG_MAX) return { valid: false, reason: "tooLong" };
  if (!/^[a-z0-9-]+$/.test(slug)) return { valid: false, reason: "charset" };
  if (/^-|-$/.test(slug)) return { valid: false, reason: "hyphenEdge" };
  if (/--/.test(slug)) return { valid: false, reason: "consecutive" };
  return { valid: true };
}

/** Normalize free text into a slug candidate as the user types. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, SLUG_MAX);
}
