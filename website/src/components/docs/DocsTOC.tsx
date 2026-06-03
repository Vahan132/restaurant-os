"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

type Heading = { id: string; text: string; level: number };

/**
 * On-page table of contents. Reads h2/h3 headings out of the rendered MDX
 * article (which get ids from rehype-slug) and highlights the section in view.
 * Works for any docs page without per-page configuration.
 */
export function DocsTOC() {
  const t = useTranslations("docs");
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const article = document.getElementById("docs-article");
    if (!article) return;

    const nodes = Array.from(article.querySelectorAll<HTMLElement>("h2, h3")).filter(
      (n) => n.id,
    );
    setHeadings(
      nodes.map((n) => ({
        id: n.id,
        text: n.textContent?.replace(/#$/, "").trim() ?? "",
        level: n.tagName === "H3" ? 3 : 2,
      })),
    );

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
  }, []);

  if (headings.length === 0) return null;

  return (
    <nav aria-label="On this page" className="flex flex-col gap-3">
      <p className="text-2xs font-semibold uppercase tracking-eyebrow text-muted">{t("toc")}</p>
      <ul className="flex flex-col gap-1 border-l border-line">
        {headings.map((h) => {
          const active = activeId === h.id;
          return (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                className={cn(
                  "-ml-px block border-l-2 py-1 text-sm transition-colors duration-fast",
                  h.level === 3 ? "pl-6" : "pl-4",
                  active
                    ? "border-terracotta font-medium text-terracotta-ink"
                    : "border-transparent text-muted hover:text-ink",
                )}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
