"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Logo } from "@/components/ui/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { LanguageSwitcher } from "@/components/site/LanguageSwitcher";
import { mainNav } from "@/config/nav";
import { site } from "@/config/site";
import { cn } from "@/lib/cn";
import { useSession } from "@/hooks/useSession";

export function Header() {
  const t = useTranslations("nav");
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { ready, isAuthenticated } = useSession();
  const signedIn = ready && isAuthenticated;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu on route change.
  useEffect(() => setOpen(false), [pathname]);

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) =>
    href.startsWith("/") && !href.includes("#") && pathname.startsWith(href);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-base ease-out-soft",
        scrolled
          ? "border-b border-line/80 bg-cream/85 backdrop-blur-md supports-[backdrop-filter]:bg-cream/70"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <Container className="flex h-[var(--header-h)] items-center justify-between gap-6">
        <Logo />

        <nav aria-label={t("primary")} className="hidden items-center gap-1 md:flex">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-pill px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors duration-fast hover:text-ink hover:bg-sand/60",
                isActive(item.href) && "text-terracotta-ink",
              )}
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <LanguageSwitcher />
          {signedIn ? (
            <ButtonLink href="/account" size="sm">
              {t("goToAccount")}
            </ButtonLink>
          ) : (
            <>
              <Link
                href={site.routes.login}
                className="rounded-pill px-3.5 py-2 text-sm font-semibold text-ink-soft transition-colors duration-fast hover:text-ink"
              >
                {t("login")}
              </Link>
              <ButtonLink href={site.routes.signup} size="sm">
                {t("getStarted")}
              </ButtonLink>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink md:hidden"
          aria-label={open ? t("closeMenu") : t("openMenu")}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="relative block h-4 w-5">
            <span
              className={cn(
                "absolute left-0 top-0 h-0.5 w-5 bg-ink transition-all duration-base ease-out-expo",
                open && "top-1.5 rotate-45",
              )}
            />
            <span
              className={cn(
                "absolute left-0 top-1.5 h-0.5 w-5 bg-ink transition-opacity duration-fast",
                open && "opacity-0",
              )}
            />
            <span
              className={cn(
                "absolute left-0 top-3 h-0.5 w-5 bg-ink transition-all duration-base ease-out-expo",
                open && "top-1.5 -rotate-45",
              )}
            />
          </span>
        </button>
      </Container>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        className={cn(
          "md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <div
          className={cn(
            "absolute inset-x-0 top-[var(--header-h)] origin-top border-b border-line bg-cream/95 backdrop-blur-md transition-all duration-base ease-out-expo",
            open ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0",
          )}
        >
          <Container className="flex flex-col gap-1 py-6">
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-3 text-lg font-medium text-ink hover:bg-sand/70"
              >
                {t(item.key)}
              </Link>
            ))}
            <div className="mt-4 flex flex-col gap-3 border-t border-line pt-5">
              {signedIn ? (
                <ButtonLink href="/account" size="md">
                  {t("goToAccount")}
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink href={site.routes.login} variant="secondary" size="md">
                    {t("login")}
                  </ButtonLink>
                  <ButtonLink href={site.routes.signup} size="md">
                    {t("getStarted")}
                  </ButtonLink>
                </>
              )}
              <div className="pt-2">
                <LanguageSwitcher />
              </div>
            </div>
          </Container>
        </div>
      </div>
    </header>
  );
}
