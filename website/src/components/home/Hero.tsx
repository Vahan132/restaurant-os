import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { HeroVisual } from "@/components/visuals/HeroVisual";
import { site } from "@/config/site";

export function Hero() {
  const t = useTranslations("home.hero");

  return (
    <section className="wash-warm layer-up relative overflow-hidden">
      {/* decorative arc */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-terracotta/5 blur-3xl"
      />
      <Container className="relative grid items-center gap-14 py-20 sm:py-28 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:py-32">
        <div className="flex flex-col items-start gap-6">
          <Reveal trigger="mount">
            <span className="inline-flex items-center gap-2 rounded-pill border border-line bg-paper/70 px-3.5 py-1.5 text-xs font-semibold text-ink-soft shadow-xs backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-sage" />
              {t("badge")}
            </span>
          </Reveal>

          <Reveal trigger="mount" delay={1}>
            <h1 className="text-balance font-display text-5xl leading-[1.02] sm:text-6xl lg:text-7xl">
              {t.rich("title", {
                em: (chunks) => <span className="italic text-terracotta-ink">{chunks}</span>,
              })}
            </h1>
          </Reveal>

          <Reveal trigger="mount" delay={2}>
            <p className="max-w-xl text-pretty text-lg text-muted sm:text-xl">
              {t("body", { brand: site.name })}
            </p>
          </Reveal>

          <Reveal trigger="mount" delay={3}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink href={site.routes.signup} size="lg">
                {t("ctaPrimary")}
              </ButtonLink>
              <ButtonLink href={site.routes.docs} variant="secondary" size="lg">
                {t("ctaSecondary")}
              </ButtonLink>
            </div>
          </Reveal>

          <Reveal trigger="mount" delay={4}>
            <p className="text-sm text-muted">{t("trialNote")}</p>
          </Reveal>
        </div>

        <Reveal trigger="mount" delay={2} className="relative">
          <HeroVisual />
        </Reveal>
      </Container>
    </section>
  );
}
