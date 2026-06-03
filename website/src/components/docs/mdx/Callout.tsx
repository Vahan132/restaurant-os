import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "note" | "tip" | "warning";

const styles: Record<Tone, { wrap: string; icon: string; label: string }> = {
  note: {
    wrap: "border-sage/30 bg-sage-soft/50",
    icon: "text-sage-deep",
    label: "Note",
  },
  tip: {
    wrap: "border-terracotta/30 bg-terracotta-soft/60",
    icon: "text-terracotta-ink",
    label: "Tip",
  },
  warning: {
    wrap: "border-saffron/40 bg-saffron/10",
    icon: "text-[#a86412]",
    label: "Heads up",
  },
};

const icons: Record<Tone, ReactNode> = {
  note: <path d="M12 8h.01M11 12h1v4h1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
  tip: <path d="M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2h5c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
  warning: <path d="M12 9v4m0 3h.01M10.3 3.9 2.5 17.5A1.7 1.7 0 0 0 4 20h16a1.7 1.7 0 0 0 1.5-2.5L13.7 3.9a1.7 1.7 0 0 0-3 0Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
};

/** Callout / Note block for MDX docs. Usage: <Callout tone="tip">…</Callout> */
export function Callout({
  tone = "note",
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
}) {
  const s = styles[tone];
  return (
    <div className={cn("my-6 flex gap-3.5 rounded-xl border p-4 sm:p-5", s.wrap)}>
      <svg viewBox="0 0 24 24" fill="none" className={cn("mt-0.5 h-5 w-5 shrink-0", s.icon)} aria-hidden>
        {icons[tone]}
      </svg>
      <div className="min-w-0 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
        <p className={cn("mb-1 text-sm font-semibold", s.icon)}>{title ?? s.label}</p>
        <div className="text-sm leading-relaxed text-ink-soft [&>p]:my-2">{children}</div>
      </div>
    </div>
  );
}

/** Convenience alias used in some pages. */
export function Note({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <Callout tone="note" title={title}>
      {children}
    </Callout>
  );
}
