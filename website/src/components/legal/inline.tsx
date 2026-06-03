import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Tiny inline-markup renderer for legal content. Supports exactly three tokens
 * so the source text in `config/legal.ts` reads naturally while still rendering
 * to the W1 design system:
 *
 *   [label](/path) or [label](https://…)  → link (internal uses next/link)
 *   **bold**                              → emphasised text
 *   [PLACEHOLDER]                          → highlighted placeholder chip
 *
 * Links are matched before bare brackets so a markdown link is never mistaken
 * for a placeholder.
 */
const TOKEN = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\[([^\]]+)\]/g;

export function renderInline(text: string, keyPrefix = "t"): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let i = 0;
  TOKEN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = TOKEN.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const key = `${keyPrefix}-${i++}`;

    const [, linkLabel, linkHref, boldText, placeholder] = match;

    if (linkLabel !== undefined && linkHref !== undefined) {
      const className =
        "font-medium text-terracotta-ink underline decoration-terracotta/30 underline-offset-2 transition-colors hover:decoration-terracotta";
      const isInternal = linkHref.startsWith("/") || linkHref.startsWith("#");
      nodes.push(
        isInternal ? (
          <Link key={key} href={linkHref} className={className}>
            {linkLabel}
          </Link>
        ) : (
          <a
            key={key}
            href={linkHref}
            target="_blank"
            rel="noreferrer"
            className={className}
          >
            {linkLabel}
          </a>
        ),
      );
    } else if (boldText !== undefined) {
      nodes.push(
        <strong key={key} className="font-semibold text-ink">
          {boldText}
        </strong>,
      );
    } else if (placeholder !== undefined) {
      nodes.push(
        <mark
          key={key}
          title="Placeholder — to be completed by the company"
          className="rounded bg-saffron/15 px-1.5 py-0.5 font-mono text-[0.82em] font-medium text-[#a86412] ring-1 ring-saffron/40"
        >
          [{placeholder}]
        </mark>,
      );
    }

    last = match.index + match[0].length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
