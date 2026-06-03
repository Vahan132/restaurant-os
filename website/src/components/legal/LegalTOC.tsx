"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type TocItem = { id: string; title: string };

/**
 * On-page table of contents for the legal pages. Unlike the docs TOC (which
 * scrapes the DOM), this one is driven by the section list so it renders
 * identically on the server; the IntersectionObserver only adds the
 * "active section" highlight as the reader scrolls.
 */
export function LegalTOC({ items, label }: { items: TocItem[]; label: string }) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");

  useEffect(() => {
    const nodes = items
      .map((it) => document.getElementById(it.id))
      .filter((n): n is HTMLElement => n !== null);
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav aria-label="On this page" className="flex flex-col gap-3">
      <p className="text-2xs font-semibold uppercase tracking-eyebrow text-muted">{label}</p>
      <ul className="flex flex-col gap-1 border-l border-line">
        {items.map((it) => {
          const active = activeId === it.id;
          return (
            <li key={it.id}>
              <a
                href={`#${it.id}`}
                className={cn(
                  "-ml-px block border-l-2 py-1 pl-4 text-sm transition-colors duration-fast",
                  active
                    ? "border-terracotta font-medium text-terracotta-ink"
                    : "border-transparent text-muted hover:text-ink",
                )}
              >
                {it.title}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
