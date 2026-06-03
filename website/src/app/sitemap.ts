import type { MetadataRoute } from "next";
import { site } from "@/config/site";
import { docsFlat } from "@/config/nav";
import { routing } from "@/i18n/routing";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = site.url.replace(/\/$/, "") + basePath;

  // Indexable, locale-agnostic paths (legal + auth + account are noindex).
  const paths = ["", "/pricing", "/about", "/docs", ...docsFlat.map((d) => d.href)];

  return paths.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: `${origin}/${locale}${path}`,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, `${origin}/${l}${path}`]),
        ),
      },
    })),
  );
}
