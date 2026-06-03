import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import { defaultLocale, type Locale } from "@/config/i18n";

type Messages = Record<string, unknown>;

async function loadMessages(locale: Locale): Promise<Messages> {
  return (await import(`../../messages/${locale}.json`)).default as Messages;
}

/** Recursively overlay `override` onto `base` (override wins on leaves). */
function deepMerge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = out[key];
    if (
      existing &&
      typeof existing === "object" &&
      !Array.isArray(existing) &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      out[key] = deepMerge(existing as Messages, value as Messages);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Per-request i18n config. English is loaded as the base for every locale and
 * the requested locale is overlaid on top, so any key missing from hy/ru falls
 * back to the English string — a raw message key is never shown.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const base = await loadMessages(defaultLocale);
  const messages =
    locale === defaultLocale ? base : deepMerge(base, await loadMessages(locale));

  return {
    locale,
    messages,
    // Fixed zone keeps server/client date formatting consistent (no hydration
    // mismatch); the business is based in Yerevan.
    timeZone: "Asia/Yerevan",
    formats: {
      dateTime: {
        short: { day: "numeric", month: "short", year: "numeric" },
        long: { day: "numeric", month: "long", year: "numeric" },
      },
    },
  };
});
