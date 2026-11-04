import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeading } from "@/components/ui/Section";
import { ButtonLink } from "@/components/ui/Button";
import { site } from "@/config/site";
import { localizedAlternates } from "@/i18n/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.about" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localizedAlternates(locale, "/about"),
  };
}

const valueKeys = ["craft", "calm", "fast", "honest"] as const;
const teamKeys = ["0", "1", "2", "3"] as const;

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");

  return (
    <>
      {/* Hero */}
      <section className="wash-warm layer-up pb-8 pt-20 sm:pt-28">
        <Container>
          <div className="relative grid items-center gap-12 overflow-hidden min-[1025px]:grid-cols-[1fr_0.95fr] min-[1025px]:overflow-visible max-[1024px]:min-h-[500px]">
            <div className="relative z-10 flex flex-col items-start gap-6 max-[1024px]:p-6">
              <Reveal trigger="mount">
                <span className="eyebrow">{t("eyebrow")}</span>
              </Reveal>
              <Reveal trigger="mount" delay={1}>
                <h1 className="text-balance font-display leading-[1.2] text-[clamp(2.125rem,calc(16px+4.8vw),3.25rem)]">
                  {t("title")}
                </h1>
              </Reveal>
              <Reveal trigger="mount" delay={2}>
                <p className="max-w-xl text-pretty text-muted text-[clamp(0.9375rem,calc(10px+1.333vw),1.25rem)]">
                  {t("lead", { brand: site.name })}
                </p>
              </Reveal>
            </div>
            <Reveal
              delay={2}
              className="max-[1024px]:absolute max-[1024px]:inset-y-0 max-[1024px]:right-0 max-[1024px]:z-0 max-[1024px]:w-[min(500px,100%)] min-[1025px]:relative"
            >
              <div
                className="w-full rounded-2xl border border-line shadow-lg min-[1025px]:aspect-[4/5] max-[1024px]:h-full"
                role="img"
                aria-label={t("heroImageAlt")}
                style={{
                  background:
                    "radial-gradient(120% 100% at 20% 10%, #f6ddc2 0%, #e7b079 40%, #c5612e 80%, #9c4520 100%)",
                }}
              />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Mission */}
      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="eyebrow">{t("missionEyebrow")}</span>
          </Reveal>
          <Reveal delay={1}>
            <p className="mt-5 text-balance font-display font-[480] leading-[1.2] text-ink text-[clamp(1.5rem,calc(7px+4.53vw),2.25rem)]">
              {t("mission")}
            </p>
          </Reveal>
        </div>
      </Section>

      {/* Values */}
      <Section tone="sand">
        <SectionHeading
          eyebrow={t("valuesEyebrow")}
          title={t("valuesTitle")}
          titleClassName="leading-[1.2] sm:leading-[1.2]"
        />
        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
          {valueKeys.map((k, i) => (
            <Reveal
              as="div"
              key={k}
              delay={i}
              className="rounded-2xl border border-line bg-paper p-7 shadow-sm"
            >
              <h3 className="font-display text-2xl leading-[1.2]">{t(`values.${k}.title`)}</h3>
              <p className="mt-3 text-pretty text-muted">{t(`values.${k}.body`)}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Team */}
      <Section>
        <SectionHeading
          eyebrow={t("teamEyebrow")}
          title={t("teamTitle")}
          intro={t("teamIntro")}
          titleClassName="leading-[1.2] sm:leading-[1.2]"
        />
        <div className="mt-14 grid gap-6 min-[650px]:grid-cols-2 lg:grid-cols-4 max-[649px]:mt-8 max-[649px]:gap-0 max-[649px]:divide-y max-[649px]:divide-line">
          {teamKeys.map((k, i) => (
            <Reveal
              as="div"
              key={k}
              delay={i}
              className="flex flex-col items-center text-center max-[649px]:flex-row max-[649px]:gap-4 max-[649px]:py-5 max-[649px]:text-left"
            >
              <div
                className="mb-4 h-28 w-28 shrink-0 rounded-full border border-line shadow-sm max-[649px]:mb-0 max-[649px]:h-16 max-[649px]:w-16"
                aria-hidden
                style={{
                  background: `radial-gradient(100% 100% at 30% 25%, rgb(var(--color-saffron)), rgb(var(--color-terracotta)))`,
                }}
              />
              <div className="min-w-0">
                <h3 className="font-display text-xl leading-[1.2]">{t(`team.${k}.name`)}</h3>
                <p className="text-sm font-semibold text-terracotta-ink">{t(`team.${k}.role`)}</p>
                <p className="mt-1 text-xs text-muted">{t(`team.${k}.from`)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section tone="sand">
        <Reveal className="flex flex-col items-center gap-6 text-center">
          <h2 className="text-balance font-display text-4xl leading-[1.2] sm:text-5xl/[1.2]">{t("ctaTitle")}</h2>
          <p className="max-w-xl text-pretty text-lg text-muted">{t("ctaBody")}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={site.routes.signup} size="lg">
              {t("ctaPrimary")}
            </ButtonLink>
            <ButtonLink href="/pricing" variant="secondary" size="lg">
              {t("ctaSecondary")}
            </ButtonLink>
          </div>
        </Reveal>
      </Section>
    </>
  );
}
