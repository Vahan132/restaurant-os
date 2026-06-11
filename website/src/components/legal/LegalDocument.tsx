import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { resolveLegalDoc, legalLastUpdated, type LegalDocKey } from "@/config/legal";
import type { Locale } from "@/config/i18n";
import { LegalSectionView } from "./LegalBlocks";
import { LegalTOC } from "./LegalTOC";

export async function LegalDocument({
  docKey,
  locale,
}: {
  docKey: LegalDocKey;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "legal" });
  const { doc } = resolveLegalDoc(docKey, locale as Locale);
  const tocItems = doc.sections.map((s) => ({ id: s.id, title: s.title }));
  const lastUpdated = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(legalLastUpdated.iso));

  return (
    <Container size="wide" className="layer-up py-10 sm:py-14">
      <div className="mx-auto max-w-3xl xl:grid xl:max-w-none xl:grid-cols-[minmax(0,1fr)_15rem] xl:gap-14">
        {/* Left column: header + article share one readable measure so the
            title stays aligned with the body copy at every breakpoint. */}
        <div className="min-w-0 max-w-3xl xl:mx-auto">
          {/* Header */}
          <header>
            <div className="flex flex-col gap-4">
              <span className="eyebrow">{t("eyebrow")}</span>
              <h1 className="text-balance font-display text-4xl leading-tight max-[539px]:text-3xl max-[429px]:text-[2rem] sm:text-5xl">
                {doc.title}
              </h1>
              <p className="text-pretty text-lg text-muted">{doc.intro}</p>
              <p className="text-sm text-muted">
                {t("lastUpdated")}{" "}
                <time dateTime={legalLastUpdated.iso} className="font-medium text-ink-soft">
                  {lastUpdated}
                </time>
              </p>
            </div>

            {/* Prominent draft / review banner */}
            <div
              role="note"
              className="mt-7 flex gap-3.5 rounded-xl border border-saffron/50 bg-saffron/10 p-4 sm:p-5"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
                className="mt-0.5 h-5 w-5 shrink-0 text-[#a86412]"
              >
                <path
                  d="M12 9v4m0 3h.01M10.3 3.9 2.5 17.5A1.7 1.7 0 0 0 4 20h16a1.7 1.7 0 0 0 1.5-2.5L13.7 3.9a1.7 1.7 0 0 0-3 0Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#a86412]">{t("draftTitle")}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  {t.rich("draftBody", {
                    ph: (chunks) => (
                      <span className="rounded bg-saffron/15 px-1 font-mono text-[0.82em] text-[#a86412] ring-1 ring-saffron/40">
                        {chunks}
                      </span>
                    ),
                  })}
                </p>
              </div>
            </div>

            {/* Controlling-language note for Armenian readers */}
            {locale === "hy" ? (
              <div
                role="note"
                className="mt-3 rounded-xl border border-line bg-sand/50 p-4 text-sm leading-relaxed text-ink-soft sm:p-5"
              >
                {t.rich("controllingNote", {
                  b: (chunks) => <strong className="font-semibold text-ink">{chunks}</strong>,
                })}
              </div>
            ) : null}

            {/* Draft-translation notice for any non-English locale */}
            {locale !== "en" ? (
              <div
                role="note"
                className="mt-3 rounded-xl border border-line bg-sand/50 p-4 text-sm leading-relaxed text-ink-soft sm:p-5"
              >
                <p className="font-semibold text-ink-soft">{t("translationDraftTitle")}</p>
                <p className="mt-1">{t("translationDraftBody")}</p>
              </div>
            ) : null}
          </header>

          {/* Body */}
          <article className="mt-12 text-[1.0625rem]">
            {/* Inline TOC on small screens */}
            <details className="mb-10 rounded-xl border border-line bg-paper p-4 xl:hidden">
              <summary className="cursor-pointer text-sm font-semibold text-ink-soft">
                {t("onThisPage")}
              </summary>
              <ul className="mt-3 flex flex-col gap-2 border-l border-line pl-4">
                {tocItems.map((it) => (
                  <li key={it.id}>
                    <a
                      href={`#${it.id}`}
                      className="text-sm text-muted transition-colors hover:text-terracotta-ink"
                    >
                      {it.title}
                    </a>
                  </li>
                ))}
              </ul>
            </details>

            {doc.sections.map((section) => (
              <LegalSectionView key={section.id} section={section} />
            ))}

            <hr className="my-10 border-line" />
            <p className="text-sm text-muted">{t("footerNote")}</p>
          </article>
        </div>

        {/* Sticky TOC on wide screens */}
        <aside className="hidden xl:block">
          <div className="sticky top-[calc(var(--header-h)+1.5rem)]">
            <LegalTOC items={tocItems} label={t("onThisPage")} />
          </div>
        </aside>
      </div>
    </Container>
  );
}
