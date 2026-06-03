import { notFound } from "next/navigation";

/**
 * Catch-all so any unmatched path under a locale renders the localized
 * not-found page (with full chrome) rather than the bare global 404.
 */
export default function CatchAllPage() {
  notFound();
}
