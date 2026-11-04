/**
 * Derives a stable URL-safe slug from a human name for use as a per-branch `code`.
 * Lowercases, collapses runs of non-alphanumerics to a single '-', and trims
 * leading/trailing '-'. Returns the provided fallback when the result is empty.
 */
export function slugify(name: string, fallback = 'item'): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}
