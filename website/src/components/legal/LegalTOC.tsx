"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type TocItem = { id: string; title: string };

/**
 * On-page table of contents for the legal pages. Unlike the docs TOC (which
 * scrapes the DOM), this one is driven by the section list so it renders
 * identically on the server.
 *
 * The active section is resolved from scroll position rather than an
 * IntersectionObserver: we pick the last section whose heading has scrolled
 * above a trigger line just below the sticky header. This is deterministic for
 * sections of any length — including short, closely-spaced ones (1↔2, 2↔3),
 * where an observer band tall enough to hold several headings at once would
 * make the highlight stick on the wrong section or skip one entirely.
 */
export function LegalTOC({ items, label }: { items: TocItem[]; label: string }) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");

  useEffect(() => {
    const ids = items.map((it) => it.id);
    if (ids.length === 0) return;

    let frame = 0;

    const compute = () => {
      frame = 0;
      // Trigger line sits just below the sticky header — matched to the page's
      // scroll-padding-top (--header-h + 24px) so a section that was just
      // clicked, and therefore parked at that offset, reads as active.
      const headerH =
        parseInt(
          getComputedStyle(document.documentElement).getPropertyValue("--header-h"),
          10,
        ) || 72;
      const line = headerH + 24 + 16;

      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - line <= 1) current = id;
        else break;
      }

      // At the very bottom of the page the final (often short) section can never
      // reach the trigger line, so force-select it once we've hit the end.
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;
      if (atBottom) current = ids[ids.length - 1];

      setActiveId(current);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
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
