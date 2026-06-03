import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { docsSlugs } from "@/config/nav";
import { loadDoc } from "@/content/docs/registry";
import { localizedAlternates } from "@/i18n/metadata";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    docsSlugs.map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const mod = await loadDoc(locale, slug);
  if (!mod) return {};
  return {
    title: mod.metadata.title,
    description: mod.metadata.description,
    alternates: localizedAlternates(locale, `/docs/${slug}`),
  };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  if (!docsSlugs.includes(slug)) notFound();

  const mod = await loadDoc(locale, slug);
  if (!mod) notFound();

  const Doc = mod.default;
  return <Doc />;
}
