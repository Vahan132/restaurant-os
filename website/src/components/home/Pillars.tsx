import type { ComponentType } from "react";
import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/Section";
import {
  POSVisual,
  KDSVisual,
  TablesVisual,
  QRVisual,
  ReportsVisual,
} from "@/components/visuals/Pillars";

/** Structural mapping of pillar id → visual; all copy comes from the catalog. */
const pillarVisuals: { id: string; visual: ComponentType }[] = [
  { id: "pos", visual: POSVisual },
  { id: "kds", visual: KDSVisual },
  { id: "tables", visual: TablesVisual },
  { id: "qr", visual: QRVisual },
  { id: "reports", visual: ReportsVisual },
];

export function Pillars() {
  const t = useTranslations("home.pillars");

  return (
    <section id="features" className="layer-up py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={t("title")}
          intro={t("intro")}
          titleClassName="leading-[1.2] sm:leading-[1.2]"
        />

        <div className="mt-20 flex flex-col gap-24 sm:gap-28">
          {pillarVisuals.map((p, i) => {
            const Visual = p.visual;
            const flip = i % 2 === 1;
            const points = t.raw(`${p.id}.points`) as string[];
            return (
              <div key={p.id} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                <Reveal className={flip ? "lg:order-2" : ""}>
                  <div className="flex flex-col items-start gap-5">
                    <span className="eyebrow">{t(`${p.id}.eyebrow`)}</span>
                    <h3 className="text-balance font-display text-3xl/[1.2] sm:text-4xl/[1.2]">
                      {t(`${p.id}.title`)}
                    </h3>
                    <p className="text-pretty text-lg text-muted">{t(`${p.id}.body`)}</p>
                    <ul className="flex flex-col gap-2.5 pt-1">
                      {points.map((pt) => (
                        <li key={pt} className="flex items-center gap-3 text-ink-soft">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-terracotta-soft text-terracotta-ink">
                            <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                              <path
                                d="M2.5 6.2 5 8.5l4.5-5"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>

                <Reveal delay={1} className={flip ? "lg:order-1" : ""}>
                  <Visual />
                </Reveal>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
