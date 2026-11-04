import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { docsNav } from "@/config/nav";
import { localizedAlternates } from "@/i18n/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.docs" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localizedAlternates(locale, "/docs"),
  };
}

export default async function DocsIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DocsIndex />;
}

function DocsIndex() {
  const t = useTranslations("docs");
  return (
    <div>
      <span className="eyebrow">{t("index.eyebrow")}</span>
      <h1 className="mb-4 mt-3 font-display text-2xl leading-[1.2] min-[400px]:text-3xl/[1.2] sm:text-4xl/[1.2] md:text-5xl/[1.2]">{t("index.title")}</h1>
      <p className="max-w-2xl text-pretty text-lg text-muted">
        {t.rich("index.intro", {
          link: (chunks) => (
            <Link
              href="/docs/getting-started"
              className="font-medium text-terracotta-ink underline decoration-terracotta/30 underline-offset-2 hover:decoration-terracotta"
            >
              {chunks}
            </Link>
          ),
        })}
      </p>

      <div className="mt-12 flex flex-col gap-10">
        {docsNav.map((section) => (
          <section key={section.key}>
            <h2 className="font-display text-xl leading-[1.2] text-ink-soft">{t(`sections.${section.key}`)}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-paper p-4 shadow-xs transition-all duration-base hover:-translate-y-0.5 hover:border-terracotta/40 hover:shadow-sm"
                >
                  <span className="font-medium text-ink">{t(`pages.${item.slug}`)}</span>
                  <span
                    aria-hidden
                    className="text-terracotta-ink transition-transform duration-base group-hover:translate-x-1"
                  >
                    →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
