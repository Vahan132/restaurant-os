import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { footerNav } from "@/config/nav";
import { site } from "@/config/site";

export function Footer() {
  const t = useTranslations("footer");
  const year = new Date().getFullYear();

  return (
    <footer className="layer-up border-t border-line bg-sand/60">
      <Container className="py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div className="flex flex-col gap-5">
            <Logo />
            <p className="max-w-xs text-pretty text-muted">{t("tagline")}</p>
            <p className="max-w-xs text-sm text-muted/90">{t("blurb")}</p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {footerNav.map((col) => (
              <nav key={col.key} aria-label={t(`columns.${col.key}`)} className="flex flex-col gap-3">
                <h3 className="text-2xs font-semibold uppercase tracking-eyebrow text-ink-soft">
                  {t(`columns.${col.key}`)}
                </h3>
                <ul className="flex flex-col gap-2.5">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted transition-colors duration-fast hover:text-terracotta-ink"
                      >
                        {t(`links.${link.key}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-6 border-t border-line pt-8 sm:flex-row sm:items-center">
          <p className="text-sm text-muted">{t("copyright", { year, brand: site.name })}</p>
          <LanguageSwitcher placement="up" />
        </div>
      </Container>
    </footer>
  );
}
