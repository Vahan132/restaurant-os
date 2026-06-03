import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/cn";
import { plans, formatPrice } from "@/config/plans";

export function PricingCards() {
  const t = useTranslations("plans");

  return (
    <div className="grid items-start gap-6 lg:grid-cols-3">
      {plans.map((plan, i) => (
        <Reveal
          as="div"
          key={plan.id}
          delay={i}
          className={cn(
            "relative flex h-full flex-col rounded-2xl border bg-paper p-7 sm:p-8",
            plan.popular
              ? "border-terracotta/40 shadow-glow lg:-mt-4 lg:mb-4"
              : "border-line shadow-sm",
          )}
        >
          {plan.popular ? (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-pill bg-terracotta px-3.5 py-1 text-2xs font-semibold uppercase tracking-eyebrow text-white shadow-sm">
              {t("popularBadge")}
            </span>
          ) : null}

          <div className="flex flex-col gap-2">
            <h3 className="font-display text-2xl">{t(`items.${plan.id}.name`)}</h3>
            <p className="min-h-[2.75rem] text-pretty text-sm text-muted">
              {t(`items.${plan.id}.tagline`)}
            </p>
          </div>

          <div className="mt-6 flex items-end gap-1.5">
            <span className="font-display text-5xl text-ink">{formatPrice(plan.price)}</span>
            <span className="pb-2 text-sm text-muted">
              {t("priceSuffix", { interval: plan.price.interval })}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">{t(`items.${plan.id}.limit`)}</p>

          <ButtonLink
            href={plan.href}
            variant={plan.popular ? "primary" : "secondary"}
            size="md"
            className="mt-6 w-full"
          >
            {t(`items.${plan.id}.cta`)}
          </ButtonLink>

          <ul className="mt-7 flex flex-col gap-3 border-t border-line pt-6">
            {plan.featureKeys.map((key) => (
              <li key={key} className="flex items-start gap-3 text-sm text-ink-soft">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-terracotta-soft text-terracotta-ink">
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
                {t(`features.${key}`)}
              </li>
            ))}
          </ul>
        </Reveal>
      ))}
    </div>
  );
}
