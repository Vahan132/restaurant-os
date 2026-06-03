"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Container } from "@/components/ui/Container";
import { useRequireAuth, useSession } from "@/hooks/useSession";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";

const nav = [
  { key: "overview", href: "/account" },
  { key: "profile", href: "/account/profile" },
  { key: "subscription", href: "/account/subscription" },
  { key: "billing", href: "/account/billing" },
  { key: "settings", href: "/account/settings" },
];

export function AccountShell({ children }: { children: ReactNode }) {
  const t = useTranslations("account");
  const { ready, isAuthenticated } = useRequireAuth();
  const { user } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);

  function logout() {
    clear();
    toast.success(t("logoutToast"));
    router.replace("/login");
  }

  const isActive = (href: string) =>
    href === "/account" ? pathname === "/account" : pathname.startsWith(href);

  // Avoid flashing the account UI before we know the session state.
  if (!ready || !isAuthenticated) {
    return (
      <Container className="flex min-h-[60vh] items-center justify-center py-20">
        <div
          className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-terracotta"
          role="status"
          aria-label={t("loadingAria")}
        />
      </Container>
    );
  }

  return (
    <Container className="layer-up py-10 sm:py-14">
      <div className="mb-8 flex flex-col gap-1">
        <span className="eyebrow">{t("eyebrow")}</span>
        <h1 className="font-display text-3xl sm:text-4xl">
          {(user?.fullName as string) || t("fallbackName")}
        </h1>
      </div>

      <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
        {/* Sidebar / tabs */}
        <aside className="mb-8 lg:mb-0">
          <nav
            aria-label={t("eyebrow")}
            className="flex gap-1 overflow-x-auto border-b border-line pb-px lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:flex-col lg:border-b-0 lg:pb-0"
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-terracotta-soft text-terracotta-ink lg:bg-terracotta-soft"
                    : "text-ink-soft hover:bg-sand/70 hover:text-ink",
                )}
              >
                {t(`nav.${item.key}`)}
              </Link>
            ))}
            <button
              type="button"
              onClick={logout}
              className="ml-auto whitespace-nowrap rounded-md px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-terracotta-ink lg:ml-0 lg:mt-4 lg:border-t lg:border-line lg:pt-4 lg:text-left"
            >
              {t("logout")}
            </button>
          </nav>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
