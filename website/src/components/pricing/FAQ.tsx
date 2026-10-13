import { useTranslations } from "next-intl";
import { faqKeys } from "@/config/plans";

/**
 * Native <details>/<summary> accordion — fully keyboard accessible and works
 * without JavaScript. Styled to the system with a rotating chevron.
 */
export function FAQ() {
  const t = useTranslations("plans.faq");

  return (
    <div className="mx-auto max-w-3xl divide-y divide-line rounded-2xl border border-line bg-paper">
      {faqKeys.map((key) => (
        <details key={key} className="group px-6 py-1 open:bg-cream/40">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left font-display text-lg text-ink marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta">
            {t(`${key}.q`)}
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-terracotta-ink transition-transform duration-base ease-out-expo group-open:rotate-45"
            >
              <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none">
                <path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
          </summary>
          <p className="text-pretty pb-6 pr-6 text-muted sm:pr-10">{t(`${key}.a`)}</p>
        </details>
      ))}
    </div>
  );
}
