"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { DocsSidebar } from "./DocsSidebar";
import { cn } from "@/lib/cn";

/** Collapsible docs navigation for small screens (drawer style). */
export function DocsMobileNav() {
  const t = useTranslations("docs");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink shadow-xs"
      >
        {t("mobileNav")}
        <svg
          viewBox="0 0 20 20"
          className={cn("h-5 w-5 text-muted transition-transform duration-base", open && "rotate-180")}
          fill="none"
          aria-hidden
        >
          <path d="m5 8 5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        className={cn(
          "grid transition-all duration-base ease-out-expo",
          open ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="rounded-xl border border-line bg-cream/60 p-4">
            <DocsSidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      </div>
    </div>
  );
}
