import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

/**
 * next-intl middleware: detects the locale on first visit (Accept-Language),
 * persists the choice in the NEXT_LOCALE cookie, and redirects unprefixed paths
 * to the resolved locale. Matcher uses logical paths — Next strips the `/res`
 * basePath before middleware runs.
 */
export default createMiddleware(routing);

export const config = {
  matcher: ["/", "/(en|hy|ru)/:path*", "/((?!_next|_vercel|.*\\..*).*)"],
};
