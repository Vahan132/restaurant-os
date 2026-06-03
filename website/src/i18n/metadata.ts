import { routing } from "./routing";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Build `alternates` (canonical + hreflang languages) for a page, resolved
 * against `metadataBase`. Pass the locale-agnostic path, e.g. "/pricing" or ""
 * for the home page; this prepends the basePath and each locale segment.
 */
export function localizedAlternates(locale: string, path = "") {
  const clean = path === "/" ? "" : path;
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = `${basePath}/${l}${clean}`;
  }
  languages["x-default"] = `${basePath}/${routing.defaultLocale}${clean}`;
  return {
    canonical: `${basePath}/${locale}${clean}`,
    languages,
  };
}
