import type { MetadataRoute } from "next";
import { site } from "@/config/site";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function robots(): MetadataRoute.Robots {
  const base = site.url.replace(/\/$/, "") + basePath;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Locale-prefixed private areas (auth, account, draft legal pages).
      disallow: [
        "/*/login",
        "/*/signup",
        "/*/forgot-password",
        "/*/reset-password",
        "/*/account",
        "/*/legal",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
