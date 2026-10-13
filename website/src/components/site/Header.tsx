"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { HashLink } from "@/components/site/HashLink";
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (href: string) =>
    href.startsWith("/") && !href.includes("#") && pathname.startsWith(href);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-base ease-out-soft",
          scrolled
            ? "bg-cream/85 backdrop-blur-md supports-[backdrop-filter]:bg-cream/70"
            : "bg-transparent",
        )}
      >
        <Container className="flex h-[var(--header-h)] items-center justify-between gap-6">
          <Logo />

          <nav
            aria-label={t("primary")}
            className="hidden items-center gap-1 min-[1100px]:flex"
          >
            {mainNav.map((item) => (
              <HashLink
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center justify-center rounded-pill px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors duration-fast hover:text-ink hover:bg-sand/60",
                  isActive(item.href) && "text-terracotta-ink",
                )}
              >
                {t(item.key)}
              </HashLink>
            ))}
          </nav>

          <div className="hidden items-center gap-2 min-[1100px]:flex">
            <LanguageSwitcher />
            {signedIn ? (
              <ButtonLink href="/account" size="sm">
                {t("goToAccount")}
              </ButtonLink>
            ) : (
              <>
                <Link
                  href={site.routes.login}
                  className="inline-flex items-center justify-center rounded-pill px-3.5 py-2 text-sm font-semibold text-ink-soft transition-colors duration-fast hover:text-ink"
                >
                  {t("login")}
                </Link>
                <ButtonLink href={site.routes.signup} size="sm">
                  {t("getStarted")}
                </ButtonLink>
              </>
            )}
          </div>

          <button
            type="button"
            className="relative z-50 inline-flex h-10 w-10 items-center justify-center rounded-full text-ink min-[1100px]:hidden"
            aria-label={open ? t("closeMenu") : t("openMenu")}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="relative block h-4 w-5">
              <span
                className={cn(
                  "absolute left-0 h-0.5 w-5 rounded-full bg-ink transition-all duration-base ease-out-expo",
                  open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-0",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-5 rounded-full bg-ink transition-opacity duration-fast",
                  open && "opacity-0",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 h-0.5 w-5 rounded-full bg-ink transition-all duration-base ease-out-expo",
                  open ? "top-1/2 -translate-y-1/2 -rotate-45" : "bottom-0",
                )}
              />
            </span>
          </button>
        </Container>
      </header>

      <div
        id="mobile-menu"
        className={cn(
          "min-[1100px]:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          aria-label={t("closeMenu")}
          onClick={() => setOpen(false)}
          className={cn(
            "fixed inset-x-0 bottom-0 top-[var(--header-h)] z-40 w-full cursor-default bg-ink/25 backdrop-blur-sm transition-opacity duration-base ease-out-soft",
            open ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        />

        <div
          className={cn(
            "fixed inset-x-0 top-[var(--header-h)] z-50 origin-top bg-cream/95 backdrop-blur-md transition-all duration-base ease-out-expo",
            open ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0",
          )}
        >
          <Container className="flex flex-col gap-1 py-6">
            {mainNav.map((item) => (
              <HashLink
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-lg font-medium text-ink hover:bg-sand/70"
              >
                {t(item.key)}
              </HashLink>
            ))}
            <div className="flex flex-col gap-3 pt-5">
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
    </>
  );
}
