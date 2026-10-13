import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/Section";

const stepIds = [
  { n: "01", id: "signup" },
  { n: "02", id: "subdomain" },
  { n: "03", id: "serving" },
];

export function HowItWorks() {
  const t = useTranslations("home.howItWorks");

  return (
    <section id="how-it-works" className="layer-up bg-sand py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={t("title")}
          intro={t("intro")}
          titleClassName="leading-[1.2] sm:leading-[1.2]"
        />

        <ol className="relative mt-16 grid gap-10 lg:grid-cols-3 lg:gap-6">
          {/* connecting line */}
          <div
            aria-hidden
            className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-line to-transparent lg:block"
          />
          {stepIds.map((s, i) => (
            <Reveal as="li" key={s.n} delay={i} className="relative flex flex-col items-start gap-4">
              <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border border-line bg-paper font-display text-xl text-terracotta-ink shadow-sm">
                {s.n}
              </span>
              <h3 className="hyphens-auto break-words font-display text-2xl/[1.2]">
                {t(`steps.${s.id}.title`)}
              </h3>
              <p className="text-pretty text-muted">{t(`steps.${s.id}.body`)}</p>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}
