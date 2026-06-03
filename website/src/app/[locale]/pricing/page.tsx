import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeading } from "@/components/ui/Section";
import { ButtonLink } from "@/components/ui/Button";
import { PricingCards } from "@/components/pricing/PricingCards";
import { ComparisonTable } from "@/components/pricing/ComparisonTable";
import { FAQ } from "@/components/pricing/FAQ";
import { site } from "@/config/site";
import { localizedAlternates } from "@/i18n/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.pricing" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localizedAlternates(locale, "/pricing"),
  };
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pricing");

  return (
    <>
      {/* Header */}
      <section className="wash-warm layer-up pt-20 sm:pt-28">
        <Container>
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
            <Reveal trigger="mount">
              <span className="eyebrow">{t("eyebrow")}</span>
            </Reveal>
            <Reveal trigger="mount" delay={1}>
              <h1 className="text-balance font-display text-5xl sm:text-6xl">{t("title")}</h1>
            </Reveal>
            <Reveal trigger="mount" delay={2}>
              <p className="text-pretty text-lg text-muted">{t("intro")}</p>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Cards */}
      <section className="layer-up py-16 sm:py-20">
        <Container>
          <PricingCards />
          <Reveal>
            <p className="mt-8 text-center text-sm text-muted">{t("footnote")}</p>
          </Reveal>
        </Container>
      </section>

      {/* Comparison */}
      <Section tone="cream" id="compare">
        <SectionHeading
          eyebrow={t("compareEyebrow")}
          title={t("compareTitle")}
          intro={t("compareIntro")}
        />
        <Reveal className="mt-12">
          <ComparisonTable />
        </Reveal>
      </Section>

      {/* FAQ */}
      <Section tone="sand">
        <SectionHeading eyebrow={t("faqEyebrow")} title={t("faqTitle")} />
        <Reveal className="mt-12">
          <FAQ />
        </Reveal>
      </Section>

      {/* CTA */}
      <Section>
        <Reveal className="flex flex-col items-center gap-6 text-center">
          <h2 className="text-balance font-display text-4xl sm:text-5xl">
            {t("ctaTitle", { brand: site.name })}
          </h2>
          <p className="max-w-xl text-pretty text-lg text-muted">{t("ctaBody")}</p>
          <ButtonLink href={site.routes.signup} size="lg">
            {t("ctaButton")}
          </ButtonLink>
        </Reveal>
      </Section>
    </>
  );
}
