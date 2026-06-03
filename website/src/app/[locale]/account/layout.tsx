import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AccountShell } from "@/components/account/AccountShell";
import { localizedAlternates } from "@/i18n/metadata";
import { site } from "@/config/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.account" });
  return {
    title: { default: t("title"), template: `%s · ${t("title")} · ${site.name}` },
    description: t("description"),
    robots: { index: false },
    alternates: localizedAlternates(locale, "/account"),
  };
}

export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AccountShell>{children}</AccountShell>;
}
