import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { site } from "@/config/site";

export function ClosingCTA() {
  const t = useTranslations("home.closing");

  return (
    <section className="layer-up py-16 sm:py-28">
      <Container>
        <Reveal>
          <div className="wash-warm relative overflow-hidden rounded-2xl border border-line bg-paper px-6 py-12 text-center shadow-md sm:px-16 sm:py-20">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-saffron/15 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-sage/10 blur-3xl"
            />
            <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-5 sm:gap-6">
              <span className="eyebrow">{t("eyebrow")}</span>
              <h2 className="text-balance font-display text-4xl max-[529px]:text-3xl sm:text-5xl">
                {t("title")}
              </h2>
              <p className="text-pretty text-lg text-muted">{t("body")}</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <ButtonLink href={site.routes.signup} size="lg">
                  {t("ctaPrimary")}
                </ButtonLink>
                <ButtonLink href="/pricing" variant="secondary" size="lg">
                  {t("ctaSecondary")}
                </ButtonLink>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
