/**
 * Minimal className joiner. Filters out falsy values so conditional classes
 * read cleanly without pulling in a dependency.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
