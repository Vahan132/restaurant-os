import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";

// Fictional customer wordmarks — proper nouns, shown identically in every locale.
const logos = ["Olive & Ember", "Trattoria Nonna", "Za’atar House", "The Copper Spoon", "Marigold"];

const quoteIds = ["0", "1", "2"] as const;

export function Testimonials() {
  const t = useTranslations("home.testimonials");

  return (
    <section className="layer-up py-20 sm:py-28">
      <Container>
        <Reveal className="flex flex-col items-center gap-3 text-center">
          <span className="eyebrow">{t("eyebrow")}</span>
          <h2 className="max-w-2xl text-balance text-3xl sm:text-4xl">{t("title")}</h2>
        </Reveal>

        {/* logo strip (placeholder wordmarks) */}
        <Reveal delay={1}>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-70">
            {logos.map((l) => (
              <span key={l} className="font-display text-lg italic text-ink-soft">
                {l}
              </span>
            ))}
          </div>
        </Reveal>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {quoteIds.map((id, i) => {
            const name = t(`items.${id}.name`);
            return (
              <Reveal
                as="div"
                key={id}
                delay={i}
                className="flex flex-col gap-5 rounded-2xl border border-line bg-paper p-7 shadow-sm"
              >
                <svg viewBox="0 0 24 24" className="h-7 w-7 text-terracotta/40" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M9.5 7C6.5 8 5 10.5 5 14v3h5v-5H7.5c.2-1.8 1.1-3 2.9-3.6L9.5 7Zm9 0c-3 1-4.5 3.5-4.5 7v3h5v-5h-2.5c.2-1.8 1.1-3 2.9-3.6L18.5 7Z"
                  />
                </svg>
                <p className="text-pretty text-lg leading-relaxed text-ink-soft">
                  “{t(`items.${id}.quote`)}”
                </p>
                <div className="mt-auto flex items-center gap-3 pt-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-saffron to-terracotta font-display text-sm text-white">
                    {name.charAt(0)}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{name}</p>
                    <p className="text-xs text-muted">{t(`items.${id}.role`)}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
