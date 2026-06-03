import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import "../globals.css";
import { fontDisplay, fontSans } from "@/lib/fonts";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Providers } from "@/components/providers/Providers";
import { routing } from "@/i18n/routing";
import { localizedAlternates } from "@/i18n/metadata";
import { site } from "@/config/site";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    metadataBase: new URL(site.url),
    title: {
      default: t("defaultTitle"),
      template: `%s · ${site.name}`,
    },
    description: t("siteDescription"),
    keywords: [
      "restaurant POS",
      "kitchen display system",
      "KDS",
      "restaurant reservations",
      "QR menu ordering",
      "restaurant management software",
    ],
    authors: [{ name: site.name }],
    alternates: localizedAlternates(locale, ""),
    openGraph: {
      type: "website",
      siteName: site.name,
      title: t("defaultTitle"),
      description: t("siteDescription"),
      locale,
    },
    twitter: {
      card: "summary_large_image",
      title: t("defaultTitle"),
      description: t("siteDescription"),
      creator: site.social.twitter,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#faf6ee",
  colorScheme: "light",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Enable static rendering for this locale.
  setRequestLocale(locale);

  const messages = await getMessages();
  const t = await getTranslations("common");

  return (
    <html lang={locale} className={`${fontDisplay.variable} ${fontSans.variable}`}>
      <body className="min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-terracotta focus:px-4 focus:py-2 focus:text-white"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <Header />
            <main id="main" className="layer-up pt-[var(--header-h)]">
              {children}
            </main>
            <Footer />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
