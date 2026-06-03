import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { site } from "@/config/site";

/**
 * Wordmark + mark. The mark is a warm "plate" — a filled terracotta disc with
 * a sage ring, echoing a place setting. Purely CSS/SVG so it stays crisp.
 */
export function Logo({ className }: { className?: string }) {
  const t = useTranslations("nav");
  return (
    <Link
      href="/"
      aria-label={t("homeAria", { brand: site.name })}
      className={cn(
        "group inline-flex items-center gap-2.5 font-display text-xl tracking-tightest text-ink",
        className,
      )}
    >
      <span aria-hidden className="relative inline-flex h-8 w-8 items-center justify-center">
        <svg viewBox="0 0 32 32" className="h-8 w-8">
          <circle
            cx="16"
            cy="16"
            r="14"
            fill="none"
            stroke="rgb(var(--color-sage))"
            strokeWidth="1.5"
            opacity="0.7"
          />
          <circle
            cx="16"
            cy="16"
            r="8.5"
            fill="rgb(var(--color-terracotta))"
            className="origin-center transition-transform duration-base ease-out-expo group-hover:scale-110"
          />
          <circle cx="13" cy="13" r="2.4" fill="#fff" opacity="0.85" />
        </svg>
      </span>
      <span className="font-medium leading-none">
        Restaurant<span className="text-terracotta-ink">OS</span>
      </span>
    </Link>
  );
}
